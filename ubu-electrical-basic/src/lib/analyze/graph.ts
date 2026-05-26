// Convert React Flow nodes/edges → a CircuitGraph the solver can consume.
//
// Model:
//   - Each component (resistor, source, switch, ground, junction, meter) lives as
//     an RF node with `data.kind` ∈ ComponentKind.
//   - Wires (RF edges) connect (rfNodeId, handleId) terminal points.
//   - All terminals connected through wires share one electrical node.
//   - A `ground` component anchors node "0" (the reference).
//
// Branches (the solver-facing components) are extracted from the RF nodes whose
// kind we know how to stamp (resistor, dcsource, switch-when-closed, etc.).
// Components that don't influence the solve (voltmeter, ammeter, junction, ground
// in DC) are skipped here — they appear in the rendered diagram but not in the
// MNA matrix. Meters get their readings AFTER the solve from node voltages.

import type { Node, Edge } from '@xyflow/react';
import { IECNodeData, DESCRIPTORS } from '../../components/nodes/iec';
import { parseValue } from './units';

export type BranchKind = 'R' | 'V' | 'I';

export interface Branch {
  /** Source RF node id this branch came from (component label e.g. R1, V1). */
  id: string;
  label: string;
  kind: BranchKind;
  /** Circuit node index of terminal 'a' (left/+ for sources). */
  na: number;
  /** Circuit node index of terminal 'b' (right/− for sources). */
  nb: number;
  /** Ohms (R), volts (V), or amperes (I). */
  value: number;
}

export interface CircuitGraph {
  /** Total number of distinct circuit nodes including ground at index 0. */
  numNodes: number;
  /** Branches the solver will stamp. */
  branches: Branch[];
  /**
   * Map from (rfNodeId, handleId) → circuit node index. Used by meters /
   * step renderer to look up "what node is this terminal on?".
   */
  terminalToNode: Map<string, number>;
  /**
   * Diagnostic messages — non-fatal hints about why a circuit is unsolvable
   * or what's missing (no ground, no source, etc.).
   */
  warnings: string[];
}

interface UF {
  parent: Map<string, string>;
  find: (x: string) => string;
  union: (a: string, b: string) => void;
}

function makeUF(): UF {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let p = parent.get(x);
    if (p == null) { parent.set(x, x); return x; }
    if (p === x) return x;
    const root = find(p);
    parent.set(x, root);
    return root;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  return { parent, find, union };
}

const termKey = (rfId: string, handleId: string) => `${rfId}:${handleId}`;

/** What every component does to the graph. */
type Stamp = (rfNode: Node<IECNodeData>) => Omit<Branch, 'na' | 'nb'> | null;

const STAMPS: Partial<Record<IECNodeData['kind'], Stamp>> = {
  resistor: (n) => ({
    id: n.id,
    label: n.data.label || n.id,
    kind: 'R',
    value: Math.max(parseValue(n.data.value) || 1e3, 1e-12),
  }),
  dcsource: (n) => ({
    id: n.id,
    label: n.data.label || n.id,
    kind: 'V',
    // For DCSource symbol: 'a' (left) is +, 'b' (right) is −. The simulator
    // treats handle 'a' as the positive terminal, so V_a − V_b = +value.
    value: parseValue(n.data.value) || 0,
  }),
  // Inductor in DC steady state → short. Treat by merging its two terminals
  // (handled in collapseWires below by adding a virtual wire).
  // Capacitor in DC steady state → open. Skip entirely.
  // Switch when closed → short (handled in collapseWires). When open → skip.
  // Voltmeter / Ammeter → read-only, no branch contribution.
  // Ground / Junction → topology only, no branch.
};

/** Components that act as "wires" (short between their two terminals) in DC. */
function isShortInDC(n: Node<IECNodeData>): boolean {
  const k = n.data.kind;
  if (k === 'inductor') return true;
  if (k === 'switch' && !!n.data.closed) return true;
  // Ammeter is ideally zero-resistance → treat as wire.
  if (k === 'ammeter') return true;
  // Junction is a visible dot, electrically a wire.
  if (k === 'junction') return true;
  return false;
}

/** Components that are "open" in DC (don't connect their terminals). */
function isOpenInDC(n: Node<IECNodeData>): boolean {
  const k = n.data.kind;
  if (k === 'capacitor') return true;
  if (k === 'switch' && !n.data.closed) return true;
  // Voltmeter is ideally infinite resistance → treat as open.
  if (k === 'voltmeter') return true;
  return false;
}

export function buildGraph(rfNodes: Node[], rfEdges: Edge[]): CircuitGraph {
  const warnings: string[] = [];
  const iecNodes = rfNodes.filter(
    (n): n is Node<IECNodeData> => n.type === 'iec',
  );

  const uf = makeUF();

  // 1. Wires: union the terminals each edge connects.
  for (const e of rfEdges) {
    if (!e.source || !e.target) continue;
    const sh = e.sourceHandle || 'a';
    const th = e.targetHandle || 'a';
    uf.union(termKey(e.source, sh), termKey(e.target, th));
  }

  // 2. "Short" components merge ALL their terminals into the same electrical node.
  // Two-terminal shorts (inductor at DC, closed switch, ammeter) union a–b. A
  // 4-handle junction unions a–b–c–d so a wire tee'd in from any side is the
  // same node — otherwise unused handles float and the MNA matrix goes singular.
  for (const n of iecNodes) {
    if (isShortInDC(n)) {
      const hs = handlesOf(n);
      for (let i = 1; i < hs.length; i++) {
        uf.union(termKey(n.id, hs[0]), termKey(n.id, hs[i]));
      }
    }
  }

  // 3. Assign electrical-node indices. Ground node(s) get index 0.
  const classToIdx = new Map<string, number>();
  const groundClasses = new Set<string>();
  for (const n of iecNodes) {
    if (n.data.kind === 'ground') {
      // Ground's only handle is 'a'.
      groundClasses.add(uf.find(termKey(n.id, 'a')));
    }
  }
  // Merge all ground classes into one root (still index 0).
  let groundRoot: string | null = null;
  for (const g of groundClasses) {
    if (groundRoot == null) groundRoot = uf.find(g);
    else uf.union(g, groundRoot);
  }
  if (groundRoot != null) {
    classToIdx.set(uf.find(groundRoot), 0);
  } else {
    warnings.push('No ground component found — circuit needs a ground to define V = 0.');
  }

  // Collect all terminal points and assign remaining nodes.
  const terminalToNode = new Map<string, number>();
  let nextIdx = classToIdx.size; // 1 if we have ground, 0 otherwise
  for (const n of iecNodes) {
    for (const h of handlesOf(n)) {
      const k = termKey(n.id, h);
      const root = uf.find(k); // ensures the terminal exists in UF even if isolated
      if (!classToIdx.has(root)) classToIdx.set(root, nextIdx++);
      terminalToNode.set(k, classToIdx.get(root)!);
    }
  }
  const numNodes = nextIdx > 0 ? nextIdx : 1;

  // 4. Extract branches for solver.
  const branches: Branch[] = [];
  for (const n of iecNodes) {
    if (isShortInDC(n) || isOpenInDC(n)) continue;
    if (n.data.kind === 'ground') continue;
    const stamp = STAMPS[n.data.kind];
    if (!stamp) continue;
    const base = stamp(n);
    if (!base) continue;
    const na = terminalToNode.get(termKey(n.id, 'a'));
    const nb = terminalToNode.get(termKey(n.id, 'b'));
    if (na == null || nb == null) continue;
    branches.push({ ...base, na, nb });
  }

  // 5. Prune circuit-node indices that no branch touches. Isolated junctions,
  // unwired voltmeters, and similar would otherwise create all-zero rows in
  // the MNA matrix and the solver would report "singular".
  const used = new Set<number>([0]); // always keep ground
  for (const br of branches) { used.add(br.na); used.add(br.nb); }
  let prunedNumNodes = numNodes;
  if (used.size < numNodes) {
    const oldToNew = new Map<number, number>();
    let next = 0;
    for (let i = 0; i < numNodes; i++) {
      if (used.has(i)) oldToNew.set(i, next++);
    }
    for (const br of branches) {
      br.na = oldToNew.get(br.na)!;
      br.nb = oldToNew.get(br.nb)!;
    }
    for (const [k, v] of terminalToNode) {
      const m = oldToNew.get(v);
      if (m == null) terminalToNode.delete(k);
      else terminalToNode.set(k, m);
    }
    prunedNumNodes = next;
  }

  // 6. Sanity warnings.
  if (groundRoot != null) {
    const hasSource = branches.some((b) => b.kind === 'V' || b.kind === 'I');
    if (!hasSource) warnings.push('No source (DC source / current source) in the circuit.');
    const hasLoad = branches.some((b) => b.kind === 'R');
    if (hasSource && !hasLoad) warnings.push('Source has no resistor load — circuit will short.');
  }

  return { numNodes: prunedNumNodes, branches, terminalToNode, warnings };
}

/** Handle ids for a given component kind — read straight from the canonical
 * DESCRIPTORS table so we never drift out of sync (junction = t/r/b/l, not
 * a/b/c/d; npn = c/b/e; etc.).
 */
function handlesOf(n: Node<IECNodeData>): string[] {
  const desc = DESCRIPTORS[n.data.kind];
  if (!desc) return ['a', 'b'];
  return desc.handles.map((h) => h.id);
}

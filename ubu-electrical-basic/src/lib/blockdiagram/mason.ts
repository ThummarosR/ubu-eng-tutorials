// Mason's gain formula for SISO block diagrams.
//
//   T(s) = (1 / Δ) · Σ_k P_k · Δ_k
//
// Where:
//   P_k = gain of the k-th forward path from input to output
//   Δ   = 1 − Σ L_i  +  Σ L_i L_j (i, j non-touching)  −  Σ L_i L_j L_k …
//   Δ_k = Δ evaluated only over loops that DO NOT touch path k
//
// This is the textbook generalisation that handles multi-loop, cross-coupled,
// and feedforward topologies — anything the iterative series/parallel/feedback
// merger in `reduce.ts` can't handle.
//
// The implementation models the block diagram as a small signal-flow graph
// where each iec node has a "transition gain" depending on which input handle
// the path enters via. The graph is tiny in practice (textbook problems have
// < 20 nodes) so we just brute-force enumerate paths and cycles via DFS.

import type { Edge, Node } from '@xyflow/react';
import type { IECNodeData, ComponentKind } from '../../components/nodes/iec';
import { tryParseRat } from './sympoly';
import {
  SymExpr, sym, lit, neg, mul, formatSym, isNumeric, toRat, ONE,
} from './symexpr';
import type { Rat } from '../analyze/poly';
import { cleanRat } from '../analyze/clean';

const BLOCK_KINDS = new Set<ComponentKind>([
  'block_g', 'block_h', 'block_k', 'block_p', 'block_i', 'block_d',
]);

export interface MasonStep {
  title: string;
  detail?: string[];
}

export interface MasonResult {
  tf: SymExpr | null;
  numericTF: Rat | null;
  steps: MasonStep[];
  paths: ForwardPath[];
  loops: Loop[];
  delta: SymExpr;
  errors: string[];
  warnings: string[];
}

export interface ForwardPath {
  /** Ordered iec-node ids visited (input, ..., output). */
  nodes: string[];
  /** Ordered edge ids traversed. */
  edges: string[];
  /** Symbolic gain (product of node transitions). */
  gain: SymExpr;
  /** Cofactor Δ_k. */
  cofactor: SymExpr;
}

export interface Loop {
  /** Cycle as a list of iec-node ids (no repeat). */
  nodes: string[];
  /** Edge ids traversed in order. */
  edges: string[];
  /** Symbolic gain (product of node transitions around the cycle). */
  gain: SymExpr;
}

// ─── Public entry point ─────────────────────────────────────────────────

export function reduceMason(nodes: Node[], edges: Edge[]): MasonResult {
  const steps: MasonStep[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  // Index iec nodes by id.
  const iec = new Map<string, Node<IECNodeData>>();
  for (const n of nodes) if (n.type === 'iec') iec.set(n.id, n as Node<IECNodeData>);

  // Build outgoing-edge map; skip edges between unrelated kinds.
  const outEdges = new Map<string, Edge[]>();
  for (const e of edges) {
    if (!iec.has(e.source) || !iec.has(e.target)) continue;
    if (!outEdges.has(e.source)) outEdges.set(e.source, []);
    outEdges.get(e.source)!.push(e);
  }

  // Locate input/output markers.
  const inputs = [...iec.values()].filter((n) => n.data.kind === 'bd_input');
  const outputs = [...iec.values()].filter((n) => n.data.kind === 'bd_output');
  if (inputs.length === 0) errors.push('ต้องมี R(s) input marker บน canvas');
  if (outputs.length === 0) errors.push('ต้องมี Y(s) output marker บน canvas');
  if (inputs.length > 1) warnings.push('มี input หลายตัว — ใช้ตัวแรก');
  if (outputs.length > 1) warnings.push('มี output หลายตัว — ใช้ตัวแรก');
  if (inputs.length === 0 || outputs.length === 0) {
    return { tf: null, numericTF: null, steps, paths: [], loops: [],
             delta: ONE, errors, warnings };
  }
  const input = inputs[0];
  const output = outputs[0];

  // ─── Enumerate forward paths ──────────────────────────────────────────
  const forwardPaths = enumerateForwardPaths(input.id, output.id, outEdges, iec);
  if (forwardPaths.length === 0) {
    errors.push('ไม่มี forward path จาก R(s) ไปยัง Y(s)');
    return { tf: null, numericTF: null, steps, paths: [], loops: [],
             delta: ONE, errors, warnings };
  }

  // ─── Enumerate loops ──────────────────────────────────────────────────
  const loops = enumerateLoops(outEdges, iec);

  // ─── Compute Δ ────────────────────────────────────────────────────────
  // Touch matrix: loops[i] and loops[j] touch iff they share at least one node.
  const touchSet = loops.map((l) => new Set(l.nodes));
  const touches = (i: number, j: number) => {
    for (const n of touchSet[i]) if (touchSet[j].has(n)) return true;
    return false;
  };

  const delta = computeDelta(loops.map((l) => l.gain), loops.length, touches);

  // ─── Δ_k for each forward path ────────────────────────────────────────
  const paths: ForwardPath[] = forwardPaths.map((p) => {
    // Loops NOT touching path p: no shared node.
    const pathNodes = new Set(p.nodes);
    const nonTouching: number[] = [];
    for (let i = 0; i < loops.length; i++) {
      let touchesPath = false;
      for (const n of loops[i].nodes) if (pathNodes.has(n)) { touchesPath = true; break; }
      if (!touchesPath) nonTouching.push(i);
    }
    const subGains = nonTouching.map((i) => loops[i].gain);
    const subTouches = (a: number, b: number) => touches(nonTouching[a], nonTouching[b]);
    const cofactor = computeDelta(subGains, subGains.length, subTouches);
    return { ...p, cofactor };
  });

  // ─── T(s) = Σ P_k Δ_k / Δ ────────────────────────────────────────────
  const numer = paths.reduce<SymExpr>(
    (acc, p) => addSym(acc, mul([p.gain, p.cofactor])),
    lit({ n: [0], d: [1] }),
  );
  const T = divSym(numer, delta);

  // ─── Build walkthrough steps ──────────────────────────────────────────
  steps.push({
    title: `ขั้นที่ 1 — Forward paths (เส้นทางจาก R(s) → Y(s))`,
    detail: paths.length === 0
      ? ['ไม่พบ forward path']
      : paths.map((p, k) => `P_${k + 1} = ${formatSym(p.gain)}`),
  });

  steps.push({
    title: `ขั้นที่ 2 — Loops (ลูป feedback ในวงจร)`,
    detail: loops.length === 0
      ? ['ไม่มี loop — Δ = 1, T(s) = ผลรวมของ forward paths']
      : loops.map((l, k) => `L_${k + 1} = ${formatSym(l.gain)}`),
  });

  if (loops.length >= 2) {
    const ntPairs: string[] = [];
    for (let i = 0; i < loops.length; i++) {
      for (let j = i + 1; j < loops.length; j++) {
        if (!touches(i, j)) ntPairs.push(`L_${i + 1} · L_${j + 1} = ${formatSym(mul([loops[i].gain, loops[j].gain]))}`);
      }
    }
    if (ntPairs.length > 0) {
      steps.push({
        title: `ขั้นที่ 3 — Non-touching loop pairs (คู่ลูปที่ไม่สัมผัสกัน)`,
        detail: ntPairs,
      });
    } else {
      steps.push({
        title: `ขั้นที่ 3 — Non-touching loops`,
        detail: ['ทุกลูปสัมผัสกันหมด — ไม่มีพจน์ L_i·L_j ใน Δ'],
      });
    }
  }

  steps.push({
    title: `ขั้นที่ ${loops.length >= 2 ? 4 : 3} — Δ (determinant)`,
    detail: [
      loops.length === 0
        ? `Δ = 1`
        : `Δ = 1 − Σ L_k + Σ L_i·L_j (non-touching) − …`,
      `Δ = ${formatSym(delta)}`,
    ],
  });

  for (let k = 0; k < paths.length; k++) {
    steps.push({
      title: `ขั้นที่ ${(loops.length >= 2 ? 5 : 4) + k} — Δ_${k + 1} (cofactor ของ P_${k + 1})`,
      detail: [
        `Δ_${k + 1} = Δ ที่ลบลูปที่สัมผัสกับ P_${k + 1} ออก`,
        `Δ_${k + 1} = ${formatSym(paths[k].cofactor)}`,
      ],
    });
  }

  steps.push({
    title: `ขั้นสุดท้าย — Mason's gain formula`,
    detail: [
      `T(s) = (1/Δ) · Σ P_k · Δ_k`,
      `T(s) = ${formatSym(T)}`,
    ],
  });

  // Collapse + clean: cross-multiplying rationals during Mason addition can
  // leave redundant common factors that floating-point GCD didn't fully cancel.
  // cleanRat() factors num + den into real linear/quadratic pieces, matches
  // factors within tolerance, and drops cancelling pairs.
  const numericTF = isNumeric(T) ? cleanRat(toRat(T)) : null;

  return { tf: T, numericTF, steps, paths, loops, delta, errors, warnings };
}

// ─── Path / loop enumeration ────────────────────────────────────────────

function enumerateForwardPaths(
  startId: string,
  endId: string,
  outEdges: Map<string, Edge[]>,
  iec: Map<string, Node<IECNodeData>>,
): ForwardPath[] {
  const paths: ForwardPath[] = [];
  const visited = new Set<string>();

  const dfs = (
    cur: string,
    nodes: string[],
    edges: string[],
    enterHandle: string | null,
    gain: SymExpr,
  ) => {
    if (cur === endId) {
      paths.push({ nodes: [...nodes, cur], edges: [...edges], gain, cofactor: ONE });
      return;
    }
    visited.add(cur);
    for (const e of outEdges.get(cur) ?? []) {
      if (visited.has(e.target)) continue;
      // Don't re-enter the input or revisit it.
      const transition = transitionGain(iec.get(cur)!, enterHandle, e.sourceHandle ?? null);
      const newGain = transition ? mul([gain, transition]) : gain;
      dfs(e.target, [...nodes, cur], [...edges, e.id], e.targetHandle ?? null, newGain);
    }
    visited.delete(cur);
  };

  dfs(startId, [], [], null, ONE);
  return paths;
}

function enumerateLoops(
  outEdges: Map<string, Edge[]>,
  iec: Map<string, Node<IECNodeData>>,
): Loop[] {
  // Johnson-style: for each node as a candidate start, DFS-find cycles that
  // return to the start. To avoid duplicates, only emit cycles whose minimum
  // node id equals the start (canonical rotation).
  const loops: Loop[] = [];
  const allIds = [...iec.keys()];

  for (const startId of allIds) {
    const path: string[] = [];
    const pathEdges: string[] = [];
    const visited = new Set<string>();

    const dfs = (
      cur: string,
      enterHandle: string | null,
      gain: SymExpr,
    ) => {
      visited.add(cur);
      path.push(cur);
      for (const e of outEdges.get(cur) ?? []) {
        const transition = transitionGain(iec.get(cur)!, enterHandle, e.sourceHandle ?? null);
        const newGain = transition ? mul([gain, transition]) : gain;
        if (e.target === startId && path.length >= 1) {
          // Found a cycle. Canonicalise: only emit if start is the lexicographic
          // minimum of the cycle nodes (avoids enumerating the same loop N times
          // for an N-node cycle). Also: apply the start node's transition for
          // the handle the cycle closes on — this is where the summer's feedback
          // sign comes from for a negative-feedback loop.
          const isCanonical = path.every((id) => id >= startId);
          if (isCanonical) {
            const closeTransition = transitionGain(iec.get(startId)!, e.targetHandle ?? null, null);
            const finalGain = closeTransition ? mul([newGain, closeTransition]) : newGain;
            loops.push({
              nodes: [...path],
              edges: [...pathEdges, e.id],
              gain: finalGain,
            });
          }
          continue;
        }
        if (visited.has(e.target)) continue;
        pathEdges.push(e.id);
        dfs(e.target, e.targetHandle ?? null, newGain);
        pathEdges.pop();
      }
      visited.delete(cur);
      path.pop();
    };

    dfs(startId, null, ONE);
  }

  return loops;
}

/** Gain contribution of a node when a path passes through it. enterHandle is
 *  the handle id the path arrived at; leaveHandle is the handle id the path
 *  exits from. For blocks: just the TF. For summers: the sign of the entered
 *  input. For pickoffs/markers: 1. */
function transitionGain(
  node: Node<IECNodeData>,
  enterHandle: string | null,
  _leaveHandle: string | null,
): SymExpr | null {
  const k = node.data.kind;
  if (BLOCK_KINDS.has(k)) return blockExpr(node);
  if (k === 'summer') {
    if (!enterHandle) return ONE; // shouldn't happen mid-path
    const m = /^in(\d+)$/.exec(enterHandle);
    if (!m) return ONE;
    const idx = parseInt(m[1], 10);
    const sign = node.data.signs?.[idx] ?? (idx === 0 ? '+' : '-');
    return sign === '+' ? ONE : neg(ONE);
  }
  return ONE; // pickoff, bd_input, bd_output
}

function blockExpr(n: Node<IECNodeData>): SymExpr {
  const label = n.data.label || (
    n.data.kind === 'block_k' ? 'K' :
    n.data.kind === 'block_p' ? 'P' :
    n.data.kind === 'block_i' ? 'I' :
    n.data.kind === 'block_d' ? 'D' :
    n.data.kind === 'block_h' ? 'H' : 'G'
  );
  const value = (n.data.value ?? '').trim();
  if (!value) return sym(`${label}(s)`);
  const r = tryParseRat(value);
  if (r) return lit(r, value);
  return sym(value);
}

// ─── Δ computation ──────────────────────────────────────────────────────

/** Generalised Mason determinant for any list of loop gains + touch predicate.
 *  Δ = 1 − Σ L_i + Σ L_i L_j (non-touching) − Σ L_i L_j L_k (mutually
 *  non-touching) + …
 *
 *  Walks combinations of size 1..N, summing the product when every pair in the
 *  combination is non-touching. Sign alternates: odd → subtract, even → add. */
function computeDelta(
  loopGains: SymExpr[],
  N: number,
  touches: (i: number, j: number) => boolean,
): SymExpr {
  let delta: SymExpr = ONE;
  for (let k = 1; k <= N; k++) {
    const combos = pickNonTouchingCombos(N, k, touches);
    if (combos.length === 0) break; // no more non-touching combos at higher k
    const sumOfProducts = combos.reduce<SymExpr>((acc, combo) => {
      const prod = mul(combo.map((i) => loopGains[i]));
      return addSym(acc, prod);
    }, lit({ n: [0], d: [1] }));
    // alternate sign: k=1 → subtract, k=2 → add, k=3 → subtract, …
    delta = k % 2 === 1 ? subSym(delta, sumOfProducts) : addSym(delta, sumOfProducts);
  }
  return delta;
}

/** All size-k subsets of [0..N-1] whose every pair is non-touching. */
function pickNonTouchingCombos(
  N: number,
  k: number,
  touches: (i: number, j: number) => boolean,
): number[][] {
  const out: number[][] = [];
  const cur: number[] = [];
  const rec = (start: number) => {
    if (cur.length === k) { out.push([...cur]); return; }
    for (let i = start; i < N; i++) {
      let ok = true;
      for (const j of cur) {
        if (touches(j, i)) { ok = false; break; }
      }
      if (ok) {
        cur.push(i);
        rec(i + 1);
        cur.pop();
      }
    }
  };
  rec(0);
  return out;
}

// ─── SymExpr helpers (small wrappers to avoid editing symexpr.ts) ──────

function addSym(a: SymExpr, b: SymExpr): SymExpr {
  // Convenience: avoid `add([])` when one operand is exactly 0/1.
  if (a.kind === 'rat' && a.r.n.length === 1 && a.r.n[0] === 0) return b;
  if (b.kind === 'rat' && b.r.n.length === 1 && b.r.n[0] === 0) return a;
  return { kind: 'add', terms: [a, b] };
}

function subSym(a: SymExpr, b: SymExpr): SymExpr {
  if (b.kind === 'rat' && b.r.n.length === 1 && b.r.n[0] === 0) return a;
  return addSym(a, neg(b));
}

function divSym(n: SymExpr, d: SymExpr): SymExpr {
  // 1 in denominator → drop.
  if (d.kind === 'rat'
      && d.r.n.length === 1 && Math.abs(d.r.n[0] - 1) < 1e-12
      && d.r.d.length === 1 && Math.abs(d.r.d[0] - 1) < 1e-12) {
    return n;
  }
  return { kind: 'div', n, d };
}

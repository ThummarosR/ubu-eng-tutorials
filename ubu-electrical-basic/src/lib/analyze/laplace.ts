// Polynomial MNA in the Laplace domain.
//
// Stamps:
//   - Resistor R(a,b)   : conductance 1/R between a and b           (constant Rat)
//   - Inductor L(a,b)   : modeled with extra current variable I_L,
//                         constraint V_a − V_b = sL·I_L              (adds row+col)
//   - Capacitor C(a,b)  : admittance sC between a and b              (linear-in-s Rat)
//   - V source V(a,b)   : extra current variable + constraint
//                         V_a − V_b = V                              (adds row+col)
//   - I source I(a→b)   : injects current at the RHS only
//
// SISO TF marker semantics:
//   - vin  : behaves as a V source whose value is the symbolic input U(s) = 1.
//            We build H(s) = Vout(s) / U(s) so any output is the TF directly.
//   - iin  : behaves as an I source with value 1.
//   - vout : nondisturbing voltage probe between two nodes — H = V_a − V_b.
//   - iout : nondisturbing series ammeter — adds extra current variable with
//            constraint V_a = V_b (zero-impedance), and the output equals that
//            extra current.
//
// All other "live" V/I sources in the circuit are zeroed for TF analysis
// (superposition: input only).

import type { Node, Edge } from '@xyflow/react';
import { IECNodeData, DESCRIPTORS } from '../../components/nodes/iec';
import { parseValue } from './units';
import {
  Rat, addR, subR, mulR, divR, rat, RAT_ZERO, RAT_ONE,
  Poly, isZero, scaleP,
} from './poly';

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

const termKey = (rfId: string, h: string) => `${rfId}:${h}`;

function handlesOf(n: Node<IECNodeData>): string[] {
  const desc = DESCRIPTORS[n.data.kind];
  if (!desc) return ['a', 'b'];
  return desc.handles.map((h) => h.id);
}

export interface LaplaceWarning {
  msg: string;
}

export interface TFResult {
  ok: boolean;
  error?: string;
  warnings: LaplaceWarning[];
  /** H(s) = num/den (one rational function). */
  H?: Rat;
  /** Numeric label of input port for display ("Vin" / "Iin"). */
  inputKind?: 'vin' | 'iin';
  outputKind?: 'vout' | 'iout';
  /** All non-ground node voltages as rational functions of s (relative to ground = 0). */
  nodeTFs?: Rat[];
  /** Map: (rfNodeId, handleId) → circuit-node index. Used by AC annotations. */
  terminalToNode?: Map<string, number>;
  /** Resistor / capacitor branches keyed by source rfNodeId — needed for branch-current AC eval. */
  passives?: Array<{ id: string; kind: 'R' | 'C'; value: number; na: number; nb: number }>;
  /** Rational function for the input source's current (Vin's I, or always 1 for Iin). */
  inputCurrentTF?: Rat;
}

/** Multiply two rational matrices in-place style. Helper for Gaussian elimination. */
function ratMatCopy(M: Rat[][]): Rat[][] {
  return M.map((row) => row.slice());
}

/** Solve A · x = b symbolically over rational functions. Returns x or null if singular. */
function solveRat(A: Rat[][], b: Rat[]): Rat[] | null {
  const n = A.length;
  const M: Rat[][] = ratMatCopy(A);
  const v: Rat[] = b.slice();
  for (let col = 0; col < n; col++) {
    // Pivot: pick first nonzero in this column at or below row `col`.
    let pivot = col;
    while (pivot < n && isZero(M[pivot][col].n)) pivot++;
    if (pivot === n) return null;
    if (pivot !== col) {
      const tm = M[pivot]; M[pivot] = M[col]; M[col] = tm;
      const tv = v[pivot]; v[pivot] = v[col]; v[col] = tv;
    }
    // Normalize row `col` so pivot is 1
    const inv = divR(RAT_ONE, M[col][col]);
    for (let j = col; j < n; j++) M[col][j] = mulR(M[col][j], inv);
    v[col] = mulR(v[col], inv);
    // Eliminate
    for (let i = 0; i < n; i++) {
      if (i === col) continue;
      const factor = M[i][col];
      if (isZero(factor.n)) continue;
      for (let j = col; j < n; j++) {
        M[i][j] = subR(M[i][j], mulR(factor, M[col][j]));
      }
      v[i] = subR(v[i], mulR(factor, v[col]));
    }
  }
  return v;
}

export function buildTF(rfNodes: Node[], rfEdges: Edge[]): TFResult {
  const warnings: LaplaceWarning[] = [];
  const iec = rfNodes.filter((n): n is Node<IECNodeData> => n.type === 'iec');

  const uf = makeUF();
  // Wires
  for (const e of rfEdges) {
    if (!e.source || !e.target) continue;
    uf.union(termKey(e.source, e.sourceHandle || 'a'), termKey(e.target, e.targetHandle || 'a'));
  }
  // "Short" passive components in DC sense; here at AC we treat inductor as a
  // separate branch (extra current var), so only switch-closed/ammeter/junction
  // get unioned. Capacitor is open at DC but a real branch at AC.
  //
  // NOTE: Iout is NOT merged here even though electrically it's a short. It's
  // modelled as its own branch (Z=0, with an extra current variable) so we can
  // read the current through it as the output. Merging would collapse its two
  // terminals into one node and make that current variable singular.
  for (const n of iec) {
    const k = n.data.kind;
    const merge = k === 'junction' || k === 'ammeter' || (k === 'switch' && !!n.data.closed);
    if (merge) {
      const hs = handlesOf(n);
      for (let i = 1; i < hs.length; i++) uf.union(termKey(n.id, hs[0]), termKey(n.id, hs[i]));
    }
  }

  // Find input / output markers.
  const vin = iec.find((n) => n.data.kind === 'vin');
  const iin = iec.find((n) => n.data.kind === 'iin');
  const vout = iec.find((n) => n.data.kind === 'vout');
  const iout = iec.find((n) => n.data.kind === 'iout');
  if (!vin && !iin) {
    return { ok: false, error: 'No input marker — drop a Vin or Iin on the canvas.', warnings };
  }
  if (vin && iin) {
    return { ok: false, error: 'SISO: only one of Vin or Iin allowed (not both).', warnings };
  }
  if (!vout && !iout) {
    return { ok: false, error: 'No output marker — drop a Vout or Iout on the canvas.', warnings };
  }
  if (vout && iout) {
    return { ok: false, error: 'SISO: only one of Vout or Iout allowed (not both).', warnings };
  }
  void (vin ?? iin); void (vout ?? iout); // satisfy unused-var checker — we already branched above

  // Ground assignment.
  const grounds = iec.filter((n) => n.data.kind === 'ground');
  if (grounds.length === 0) {
    return { ok: false, error: 'Need a ground to define V = 0.', warnings };
  }
  let groundRoot = uf.find(termKey(grounds[0].id, 'a'));
  for (const g of grounds.slice(1)) uf.union(termKey(g.id, 'a'), groundRoot);
  groundRoot = uf.find(groundRoot);

  // Assign node indices, ground = 0.
  const classToIdx = new Map<string, number>();
  classToIdx.set(groundRoot, 0);
  const terminalToNode = new Map<string, number>();
  let nextIdx = 1;
  for (const n of iec) {
    for (const h of handlesOf(n)) {
      const k = termKey(n.id, h);
      const root = uf.find(k);
      if (!classToIdx.has(root)) classToIdx.set(root, nextIdx++);
      terminalToNode.set(k, classToIdx.get(root)!);
    }
  }
  const N = nextIdx; // total nodes including ground
  const nVars = N - 1; // non-ground node voltages

  // Collect "current-variable" branches: inductors, V sources (real or input vin),
  // and the iout probe (constraint V_a = V_b with auxiliary current).
  interface CurrentBranch {
    label: string;
    na: number; // + side (a-handle)
    nb: number; // - side (b-handle)
    /** Impedance polynomial: 0 for V source (constraint V_a − V_b = value),
     *  sL for inductor, 0 for iout probe.
     *  Always represented as a Rat. */
    Z: Rat;
    /** RHS value: 1 if this is the input V source, else 0. */
    rhs: Rat;
    /** If this branch is the iout probe, its current is the output. */
    isOutput?: boolean;
  }

  const branches: CurrentBranch[] = [];
  let vinBranchIdx = -1;

  const otherSourcesZeroed: string[] = [];

  for (const n of iec) {
    const k = n.data.kind;
    const naIdx = terminalToNode.get(termKey(n.id, 'a'));
    const nbIdx = terminalToNode.get(termKey(n.id, 'b'));
    if (naIdx == null || nbIdx == null) continue;
    if (k === 'inductor') {
      const L = Math.max(parseValue(n.data.value) || 1e-3, 1e-18);
      branches.push({ label: n.data.label || n.id, na: naIdx, nb: nbIdx, Z: rat([0, L]), rhs: RAT_ZERO });
    } else if (k === 'vin') {
      // Input V source: the SYMBOL has + on the right (arrow out the right), so the
      // user naturally wires Vin.b → circuit and Vin.a → ground. We want
      // V_(Vin.b) − V_(Vin.a) = +1. Swap na/nb to make that the constraint.
      vinBranchIdx = branches.length;
      branches.push({ label: 'Vin', na: nbIdx, nb: naIdx, Z: RAT_ZERO, rhs: RAT_ONE });
    } else if (k === 'dcsource' || k === 'acsource') {
      // Other sources — zeroed for TF (V → short, i.e. constraint V_a − V_b = 0).
      branches.push({ label: n.data.label || n.id, na: naIdx, nb: nbIdx, Z: RAT_ZERO, rhs: RAT_ZERO });
      otherSourcesZeroed.push(n.data.label || n.id);
    } else if (k === 'iout') {
      // Output ammeter probe: constraint V_a = V_b, output = its current.
      branches.push({ label: 'Iout', na: naIdx, nb: nbIdx, Z: RAT_ZERO, rhs: RAT_ZERO, isOutput: true });
    }
  }

  const nCB = branches.length;
  const dim = nVars + nCB;
  if (dim === 0) return { ok: false, error: 'Empty circuit.', warnings };

  // Build A · x = b. x = [V_1..V_{N-1}, I_b1..I_bK]
  const A: Rat[][] = Array.from({ length: dim }, () => new Array<Rat>(dim).fill(RAT_ZERO));
  const bvec: Rat[] = new Array<Rat>(dim).fill(RAT_ZERO);

  const ix = (node: number) => node - 1; // map node i>=1 → matrix row/col

  // Track passives for AC branch-current evaluation later.
  const passives: NonNullable<TFResult['passives']> = [];

  // Resistor / capacitor admittance stamps + current-source RHS.
  for (const n of iec) {
    const k = n.data.kind;
    const naIdx = terminalToNode.get(termKey(n.id, 'a'));
    const nbIdx = terminalToNode.get(termKey(n.id, 'b'));
    if (naIdx == null || nbIdx == null) continue;
    let Y: Rat | null = null;
    if (k === 'resistor') {
      const R = Math.max(parseValue(n.data.value) || 1e3, 1e-12);
      Y = rat(1 / R);
      passives.push({ id: n.id, kind: 'R', value: R, na: naIdx, nb: nbIdx });
    } else if (k === 'capacitor') {
      const C = Math.max(parseValue(n.data.value) || 1e-6, 1e-30);
      Y = rat([0, C]); // sC
      passives.push({ id: n.id, kind: 'C', value: C, na: naIdx, nb: nbIdx });
    }
    if (Y) {
      const a = naIdx, c = nbIdx;
      if (a !== 0) A[ix(a)][ix(a)] = addR(A[ix(a)][ix(a)], Y);
      if (c !== 0) A[ix(c)][ix(c)] = addR(A[ix(c)][ix(c)], Y);
      if (a !== 0 && c !== 0) {
        A[ix(a)][ix(c)] = subR(A[ix(a)][ix(c)], Y);
        A[ix(c)][ix(a)] = subR(A[ix(c)][ix(a)], Y);
      }
    }
    if (k === 'iin') {
      // Symbolic input current source: 1 A from a → b means inject +1 at b, −1 at a.
      if (naIdx !== 0) bvec[ix(naIdx)] = subR(bvec[ix(naIdx)], RAT_ONE);
      if (nbIdx !== 0) bvec[ix(nbIdx)] = addR(bvec[ix(nbIdx)], RAT_ONE);
    }
  }

  // Current-variable branches: stamp the augmented rows / cols.
  for (let k = 0; k < nCB; k++) {
    const br = branches[k];
    const row = nVars + k;
    if (br.na !== 0) {
      A[ix(br.na)][row] = addR(A[ix(br.na)][row], RAT_ONE);
      A[row][ix(br.na)] = addR(A[row][ix(br.na)], RAT_ONE);
    }
    if (br.nb !== 0) {
      A[ix(br.nb)][row] = subR(A[ix(br.nb)][row], RAT_ONE);
      A[row][ix(br.nb)] = subR(A[row][ix(br.nb)], RAT_ONE);
    }
    // Constraint diagonal: V_a − V_b − Z·I = value → matrix row has −Z on the current diag.
    A[row][row] = subR(A[row][row], br.Z);
    bvec[row] = br.rhs;
  }

  if (otherSourcesZeroed.length > 0) {
    warnings.push({ msg: `Other sources held at 0 for TF (superposition): ${otherSourcesZeroed.join(', ')}` });
  }

  const x = solveRat(A, bvec);
  if (!x) return { ok: false, error: 'Singular MNA system — check the topology around Vin/Iin/Vout/Iout.', warnings };

  // Build H(s) from the output marker.
  let H: Rat;
  if (vout) {
    const a = terminalToNode.get(termKey(vout.id, 'a'))!;
    const b = terminalToNode.get(termKey(vout.id, 'b'))!;
    const va: Rat = a === 0 ? RAT_ZERO : x[ix(a)];
    const vb: Rat = b === 0 ? RAT_ZERO : x[ix(b)];
    H = subR(va, vb);
  } else {
    // iout — find the branch and read its current.
    const outBranchIdx = branches.findIndex((b) => b.isOutput);
    if (outBranchIdx < 0) return { ok: false, error: 'Internal error: iout branch missing.', warnings };
    H = x[nVars + outBranchIdx];
  }

  // Build per-node TF array (index 0 = ground = 0; index ≥ 1 = x[ix(i)]).
  const nodeTFs: Rat[] = [RAT_ZERO];
  for (let i = 1; i < N; i++) nodeTFs.push(x[ix(i)]);

  // Input current as a rational function:
  //   - Vin path: I_Vin is one of the augmented-current variables.
  //     Solver convention: stamps make this current POSITIVE when flowing internally
  //     a → b (i.e. + → − inside the source). Real-world "delivered current" is the
  //     opposite sign → negate so I_in matches conventional current LEAVING the
  //     + terminal into the external network.
  //   - Iin path: the input itself IS a 1 A current; H_I_in(s) = 1.
  let inputCurrentTF: Rat | undefined;
  if (vin && vinBranchIdx >= 0) {
    inputCurrentTF = { n: scaleP(x[nVars + vinBranchIdx].n, -1), d: x[nVars + vinBranchIdx].d };
  } else if (iin) {
    inputCurrentTF = RAT_ONE;
  }

  return {
    ok: true,
    warnings,
    H,
    inputKind: (vin ? 'vin' : 'iin'),
    outputKind: (vout ? 'vout' : 'iout'),
    nodeTFs,
    terminalToNode,
    passives,
    inputCurrentTF,
  };
}

export interface ACSnapshot {
  /** Complex voltage at each circuit node (index 0 = ground, V_0 = 0). */
  nodeV: Array<{ re: number; im: number }>;
  /** Complex current through each passive branch, keyed by rfNodeId. (a→b direction) */
  branchI: Map<string, { re: number; im: number }>;
}

/** Evaluate the polynomial-MNA solution at angular frequency ω (s = jω). */
export function snapshotAt(tf: TFResult, omega: number): ACSnapshot | null {
  if (!tf.ok || !tf.nodeTFs || !tf.passives) return null;
  const nodeV = tf.nodeTFs.map((rat) => evalH(rat, 0, omega));
  const branchI = new Map<string, { re: number; im: number }>();
  for (const p of tf.passives) {
    const va = nodeV[p.na];
    const vb = nodeV[p.nb];
    // Admittance: R → 1/R (real); C → jωC.
    const Yre = p.kind === 'R' ? 1 / p.value : 0;
    const Yim = p.kind === 'C' ? omega * p.value : 0;
    // I = Y · (V_a − V_b)
    const dRe = va.re - vb.re;
    const dIm = va.im - vb.im;
    branchI.set(p.id, {
      re: Yre * dRe - Yim * dIm,
      im: Yre * dIm + Yim * dRe,
    });
  }
  return { nodeV, branchI };
}

/** Evaluate H(s) at a complex frequency point — returns { re, im }. */
export function evalH(H: Rat, sRe: number, sIm: number): { re: number; im: number } {
  const num = evalCplx(H.n, sRe, sIm);
  const den = evalCplx(H.d, sRe, sIm);
  // Divide: (a+bi)/(c+di) = ((ac+bd) + (bc−ad)i) / (c²+d²)
  const denom = den.re * den.re + den.im * den.im;
  if (denom < 1e-30) return { re: Infinity, im: Infinity };
  return {
    re: (num.re * den.re + num.im * den.im) / denom,
    im: (num.im * den.re - num.re * den.im) / denom,
  };
}

function evalCplx(p: Poly, re: number, im: number): { re: number; im: number } {
  let outRe = 0, outIm = 0;
  let powRe = 1, powIm = 0;
  for (let i = 0; i < p.length; i++) {
    outRe += p[i] * powRe;
    outIm += p[i] * powIm;
    const nRe = powRe * re - powIm * im;
    const nIm = powRe * im + powIm * re;
    powRe = nRe; powIm = nIm;
  }
  return { re: outRe, im: outIm };
}

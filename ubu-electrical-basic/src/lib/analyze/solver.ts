// DC Modified Nodal Analysis (MNA) solver.
//
// Builds A·x = b where x = [node voltages V_1..V_{n-1}, source currents I_v1..]
// and node 0 is ground (V_0 = 0).
// Resistor between (a,b) with conductance G stamps ±G into the conductance block.
// Voltage source between (a,b) with V adds one extra row/col (current variable)
// and stamps a 1, -1 in the appropriate places.
// Current source between (a,b) with I injects ±I into the RHS at nodes b/a.
//
// Solves via partial-pivot Gaussian elimination — small (n ≤ 50) is plenty for
// a teaching tool.

import type { CircuitGraph } from './graph';

export interface SolveResult {
  ok: boolean;
  error?: string;
  /** Voltage at each circuit node. nodeVoltages[0] = 0 (ground). */
  nodeVoltages: number[];
  /** Current through each voltage source / current source, keyed by branch id. */
  branchCurrents: Map<string, number>;
}

export function solveDC(graph: CircuitGraph): SolveResult {
  const n = graph.numNodes;
  if (n <= 1) {
    return { ok: false, error: 'Circuit has no non-ground nodes.', nodeVoltages: new Array(n).fill(0), branchCurrents: new Map() };
  }

  // Voltage sources need extra unknowns (their through-currents).
  const vSources = graph.branches.filter((b) => b.kind === 'V');
  const vIdx = new Map<string, number>();
  vSources.forEach((b, i) => vIdx.set(b.id, (n - 1) + i));

  const dim = (n - 1) + vSources.length;
  if (dim === 0) {
    return { ok: false, error: 'Nothing to solve.', nodeVoltages: new Array(n).fill(0), branchCurrents: new Map() };
  }

  const A: number[][] = Array.from({ length: dim }, () => new Array(dim).fill(0));
  const b: number[] = new Array(dim).fill(0);

  const ix = (node: number) => node - 1; // map circuit node i (>= 1) → matrix row/col

  for (const br of graph.branches) {
    if (br.kind === 'R') {
      const G = 1 / br.value;
      const a = br.na;
      const c = br.nb;
      if (a !== 0) { A[ix(a)][ix(a)] += G; }
      if (c !== 0) { A[ix(c)][ix(c)] += G; }
      if (a !== 0 && c !== 0) {
        A[ix(a)][ix(c)] -= G;
        A[ix(c)][ix(a)] -= G;
      }
    } else if (br.kind === 'V') {
      const a = br.na; // +
      const c = br.nb; // −
      const k = vIdx.get(br.id)!;
      // KCL at node a: +I_v
      if (a !== 0) { A[ix(a)][k] += 1; A[k][ix(a)] += 1; }
      // KCL at node c: -I_v
      if (c !== 0) { A[ix(c)][k] -= 1; A[k][ix(c)] -= 1; }
      // Constraint row: V_a − V_c = V
      b[k] = br.value;
    } else if (br.kind === 'I') {
      // Current source flows from a → b (out of +); pulls current from node a, delivers to b.
      const a = br.na;
      const c = br.nb;
      if (a !== 0) b[ix(a)] -= br.value;
      if (c !== 0) b[ix(c)] += br.value;
    }
  }

  // Gaussian elimination with partial pivoting.
  const x = gaussSolve(A, b);
  if (!x) {
    return {
      ok: false,
      error: 'Singular matrix — circuit may have unconnected sub-graphs or a floating node.',
      nodeVoltages: new Array(n).fill(0),
      branchCurrents: new Map(),
    };
  }

  const nodeVoltages = new Array(n).fill(0);
  for (let i = 1; i < n; i++) nodeVoltages[i] = x[ix(i)];

  const branchCurrents = new Map<string, number>();
  for (const b of vSources) {
    branchCurrents.set(b.id, x[vIdx.get(b.id)!]);
  }
  // Compute resistor currents from node voltages (a → b direction).
  for (const br of graph.branches) {
    if (br.kind === 'R') {
      const Va = nodeVoltages[br.na];
      const Vb = nodeVoltages[br.nb];
      branchCurrents.set(br.id, (Va - Vb) / br.value);
    } else if (br.kind === 'I') {
      branchCurrents.set(br.id, br.value);
    }
  }

  return { ok: true, nodeVoltages, branchCurrents };
}

function gaussSolve(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  // Augmented matrix [A | b].
  const M = A.map((row, i) => [...row, b[i]]);
  const EPS = 1e-12;

  for (let col = 0; col < n; col++) {
    // Partial pivot.
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    }
    if (Math.abs(M[piv][col]) < EPS) return null; // singular
    if (piv !== col) { const tmp = M[piv]; M[piv] = M[col]; M[col] = tmp; }
    // Eliminate below.
    for (let r = col + 1; r < n; r++) {
      const factor = M[r][col] / M[col][col];
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= factor * M[col][c];
    }
  }
  // Back substitute.
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let sum = M[r][n];
    for (let c = r + 1; c < n; c++) sum -= M[r][c] * x[c];
    x[r] = sum / M[r][r];
  }
  return x;
}

/** Lookup helpers for the step renderer. */
export function nodeVoltageAt(result: SolveResult, nodeIdx: number): number {
  return result.nodeVoltages[nodeIdx] ?? 0;
}

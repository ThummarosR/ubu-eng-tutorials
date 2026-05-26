// Pole-zero cleanup for rationals produced by symbolic manipulation.
//
// `reduce()` in poly.ts uses Euclidean GCD on floating-point coefficients,
// which is fragile at high polynomial degrees — redundant common factors
// (from e.g. Mason summing several rationals sharing a denominator) don't
// always fully cancel. The leftover polynomial has the same algebraic value
// as the simplified form but `findRoots` finds ghost root clusters at the
// "would-have-cancelled" locations.
//
// cleanRat() does the cancellation at the root level: factor both polynomials
// (real linear + real quadratic factors), match factors within tolerance, drop
// matched pairs, and reconstruct. Result has real coefficients and the same
// VALUE as the input (within tolerance) but a much tighter degree.

import { Poly, Rat, mulP, reduce, trim, scaleP } from './poly';
import { findRoots, type CRoot } from './roots';

interface LinearFactor { kind: 'linear'; root: number }
interface QuadraticFactor { kind: 'quadratic'; re: number; im: number /* > 0 */ }
type RealFactor = LinearFactor | QuadraticFactor;

const TOL_DEFAULT = 1e-4;

function isReal(r: CRoot, tol = 1e-7): boolean {
  return Math.abs(r.im) < tol;
}

/** Group findRoots() output into linear and quadratic real factors. Complex
 *  roots are paired by conjugate matching. Lone unpaired complex roots are
 *  dropped (shouldn't happen for real-coefficient input). */
function factorise(p: Poly): RealFactor[] {
  const roots = findRoots(trim(p));
  const used = new Array(roots.length).fill(false);
  const factors: RealFactor[] = [];
  for (let i = 0; i < roots.length; i++) {
    if (used[i]) continue;
    const r = roots[i];
    if (isReal(r)) {
      factors.push({ kind: 'linear', root: r.re });
      used[i] = true;
      continue;
    }
    if (r.im < 0) continue; // wait for its + counterpart
    // Find its conjugate: same re, opposite-sign im.
    let conjIdx = -1;
    for (let j = 0; j < roots.length; j++) {
      if (j === i || used[j]) continue;
      if (Math.abs(roots[j].re - r.re) < 1e-5 && Math.abs(roots[j].im + r.im) < 1e-5) {
        conjIdx = j;
        break;
      }
    }
    if (conjIdx >= 0) {
      factors.push({ kind: 'quadratic', re: r.re, im: Math.abs(r.im) });
      used[i] = true;
      used[conjIdx] = true;
    }
    // else: orphan complex root — skip (input wasn't perfectly real-coef).
  }
  // Stragglers (negative-im roots without matched conjugate from above)
  for (let i = 0; i < roots.length; i++) {
    if (used[i]) continue;
    const r = roots[i];
    if (isReal(r)) factors.push({ kind: 'linear', root: r.re });
  }
  return factors;
}

function factorsMatch(a: RealFactor, b: RealFactor, tol: number): boolean {
  if (a.kind === 'linear' && b.kind === 'linear') {
    return Math.abs(a.root - b.root) < tol;
  }
  if (a.kind === 'quadratic' && b.kind === 'quadratic') {
    return Math.abs(a.re - b.re) < tol && Math.abs(a.im - b.im) < tol;
  }
  return false;
}

function polyFromFactors(factors: RealFactor[]): Poly {
  let p: Poly = [1];
  for (const f of factors) {
    if (f.kind === 'linear') {
      // (s − root)
      p = mulP(p, [-f.root, 1]);
    } else {
      // (s − (re + im·j))(s − (re − im·j)) = s² − 2·re·s + (re² + im²)
      p = mulP(p, [f.re * f.re + f.im * f.im, -2 * f.re, 1]);
    }
  }
  return p;
}

/**
 * Cancel near-coincident pole-zero pairs in a rational function. Useful as a
 * final cleanup after symbolic manipulation produces redundant factors that
 * floating-point GCD couldn't fully cancel.
 *
 * Returns a new Rat whose value equals the input (within tolerance) but whose
 * degree is reduced by the number of matched pairs.
 */
export function cleanRat(r: Rat, tol = TOL_DEFAULT): Rat {
  // Trivially simple — nothing to clean.
  if (trim(r.n).length <= 2 && trim(r.d).length <= 2) return reduce(r);

  const numFactors = factorise(r.n);
  const denFactors = factorise(r.d);

  // Greedy pairing: for each numerator factor, find an unused matching
  // denominator factor and cancel both.
  const dUsed = new Array(denFactors.length).fill(false);
  const remN: RealFactor[] = [];
  for (const nf of numFactors) {
    const idx = denFactors.findIndex((df, j) => !dUsed[j] && factorsMatch(nf, df, tol));
    if (idx >= 0) {
      dUsed[idx] = true; // cancel
    } else {
      remN.push(nf);
    }
  }
  const remD = denFactors.filter((_, j) => !dUsed[j]);

  // Reconstruct. The factored polynomials are monic; scale by the original
  // leading coefficients to preserve the overall gain.
  const leadN = r.n[trim(r.n).length - 1];
  const leadD = r.d[trim(r.d).length - 1];
  const newN = scaleP(polyFromFactors(remN), leadN);
  const newD = scaleP(polyFromFactors(remD), leadD);

  return reduce({ n: newN, d: newD });
}

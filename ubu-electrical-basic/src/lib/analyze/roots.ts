// Polynomial root finding via Durand-Kerner iteration.
// Robust for low-degree polynomials (n ≤ ~10) typical of teaching circuits.

import { Poly, trim, isZero } from './poly';

export interface CRoot { re: number; im: number }

function evalC(p: Poly, sRe: number, sIm: number): { re: number; im: number } {
  let outRe = 0, outIm = 0;
  let powRe = 1, powIm = 0;
  for (let i = 0; i < p.length; i++) {
    outRe += p[i] * powRe;
    outIm += p[i] * powIm;
    const nRe = powRe * sRe - powIm * sIm;
    const nIm = powRe * sIm + powIm * sRe;
    powRe = nRe; powIm = nIm;
  }
  return { re: outRe, im: outIm };
}

/** Find all complex roots of `p` (polynomial in ascending-degree coefficients). */
export function findRoots(p: Poly): CRoot[] {
  const a = trim(p);
  if (isZero(a) || a.length === 1) return [];
  const n = a.length - 1;
  if (n === 1) {
    return [{ re: -a[0] / a[1], im: 0 }];
  }
  if (n === 2) {
    // Quadratic formula: a2·s² + a1·s + a0 = 0
    const a2 = a[2], a1 = a[1], a0 = a[0];
    const disc = a1 * a1 - 4 * a2 * a0;
    const inv2a = 1 / (2 * a2);
    if (disc >= 0) {
      const sq = Math.sqrt(disc);
      return [{ re: (-a1 + sq) * inv2a, im: 0 }, { re: (-a1 - sq) * inv2a, im: 0 }];
    }
    const sq = Math.sqrt(-disc);
    return [{ re: -a1 * inv2a, im: sq * inv2a }, { re: -a1 * inv2a, im: -sq * inv2a }];
  }

  // Durand-Kerner: monic polynomial first.
  const lc = a[n];
  const monic = a.map((c) => c / lc);
  // Initial guesses: evenly spaced on a circle in the complex plane.
  const roots: CRoot[] = [];
  for (let i = 0; i < n; i++) {
    const theta = (2 * Math.PI * i) / n + 0.4;
    roots.push({ re: Math.cos(theta), im: Math.sin(theta) });
  }
  // Iterate.
  const MAX_ITER = 200;
  const TOL = 1e-10;
  for (let it = 0; it < MAX_ITER; it++) {
    let maxDelta = 0;
    for (let i = 0; i < n; i++) {
      const pi = evalC(monic, roots[i].re, roots[i].im);
      // Compute product (r_i - r_j) for j != i
      let prodRe = 1, prodIm = 0;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const dRe = roots[i].re - roots[j].re;
        const dIm = roots[i].im - roots[j].im;
        const nRe = prodRe * dRe - prodIm * dIm;
        const nIm = prodRe * dIm + prodIm * dRe;
        prodRe = nRe; prodIm = nIm;
      }
      // Divide pi / prod
      const denom = prodRe * prodRe + prodIm * prodIm;
      if (denom < 1e-30) continue;
      const corrRe = (pi.re * prodRe + pi.im * prodIm) / denom;
      const corrIm = (pi.im * prodRe - pi.re * prodIm) / denom;
      roots[i].re -= corrRe;
      roots[i].im -= corrIm;
      maxDelta = Math.max(maxDelta, Math.abs(corrRe) + Math.abs(corrIm));
    }
    if (maxDelta < TOL) break;
  }
  // Clean up small imaginary parts (numerical noise) so real roots show as real.
  for (const r of roots) {
    if (Math.abs(r.im) < 1e-7 * Math.max(1, Math.abs(r.re))) r.im = 0;
  }
  return roots;
}

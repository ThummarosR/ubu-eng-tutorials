// Unit-step response y(t) for a SISO transfer function H(s).
// Input is U(s) = 1/s; so Y(s) = H(s) / s. Partial-fraction expand:
//   Y(s) = K_∞/s + Σ_k K_k / (s − p_k)
// then inverse-Laplace gives:
//   y(t) = K_∞ + Σ_k K_k · exp(p_k · t)
// Complex-conjugate pole pairs combine into damped sinusoids automatically
// because we sum complex exponentials and take real part.

import { Rat, mulP, addP, scaleP, isZero } from './poly';
import { findRoots, CRoot } from './roots';

interface Residue { p: CRoot; K: { re: number; im: number } }

function evalC(coeffs: number[], sRe: number, sIm: number): { re: number; im: number } {
  let outRe = 0, outIm = 0;
  let powRe = 1, powIm = 0;
  for (let i = 0; i < coeffs.length; i++) {
    outRe += coeffs[i] * powRe;
    outIm += coeffs[i] * powIm;
    const nRe = powRe * sRe - powIm * sIm;
    const nIm = powRe * sIm + powIm * sRe;
    powRe = nRe; powIm = nIm;
  }
  return { re: outRe, im: outIm };
}

/** Compute step response y(t) samples at evenly spaced times in [0, T]. */
export function stepResponse(H: Rat, T: number, nSamples = 240): { t: number[]; y: number[] } {
  // Y(s) = H(s)·(1/s) = H.n / (H.d · s)
  const N = H.n;
  const Dext = mulP(H.d, [0, 1]); // multiply by s

  // Find poles of Dext.
  const poles = findRoots(Dext);

  // For each pole p, residue K_p = lim_(s→p) (s − p) · Y(s)
  //   = N(p) / D'(p), where D'(s) is the derivative of Dext.
  // For repeated poles this is wrong, but we accept that for the teaching tool.
  const Dprime = derivative(Dext);

  const residues: Residue[] = poles.map((p) => {
    const num = evalC(N, p.re, p.im);
    const den = evalC(Dprime, p.re, p.im);
    const denMag = den.re * den.re + den.im * den.im;
    if (denMag < 1e-30) return { p, K: { re: 0, im: 0 } };
    return {
      p,
      K: {
        re: (num.re * den.re + num.im * den.im) / denMag,
        im: (num.im * den.re - num.re * den.im) / denMag,
      },
    };
  });

  // Sample y(t).
  const t = new Array<number>(nSamples);
  const y = new Array<number>(nSamples);
  for (let i = 0; i < nSamples; i++) {
    const ti = (i / (nSamples - 1)) * T;
    let sumRe = 0;
    for (const r of residues) {
      // exp(p·t) = exp(re·t) · (cos(im·t) + j·sin(im·t))
      const exp = Math.exp(r.p.re * ti);
      const c = Math.cos(r.p.im * ti);
      const s = Math.sin(r.p.im * ti);
      // K·exp(p·t) — take real part of (K.re + j·K.im)·exp·(c + j·s)
      // = exp · (K.re·c − K.im·s) + j·exp · (K.re·s + K.im·c)
      sumRe += exp * (r.K.re * c - r.K.im * s);
    }
    t[i] = ti;
    y[i] = sumRe;
  }
  return { t, y };
}

function derivative(p: number[]): number[] {
  if (p.length <= 1) return [0];
  const out = new Array<number>(p.length - 1);
  for (let i = 1; i < p.length; i++) out[i - 1] = i * p[i];
  return out;
}

/** Pick a reasonable simulation horizon T from the pole locations. */
export function suggestT(H: Rat): number {
  const Dext = mulP(H.d, [0, 1]);
  const poles = findRoots(Dext);
  // Slowest non-trivial pole sets the time constant (1 / |Re|).
  let tauMax = 0;
  for (const p of poles) {
    if (Math.abs(p.re) < 1e-9 && Math.abs(p.im) < 1e-9) continue;
    if (p.re < 0) tauMax = Math.max(tauMax, -1 / p.re);
    // Oscillatory: use 1/|imag| as a period proxy.
    if (Math.abs(p.im) > 1e-9) tauMax = Math.max(tauMax, 2 / Math.abs(p.im));
  }
  if (tauMax === 0) tauMax = 1;
  return 6 * tauMax; // ~6 time constants
}

// Silence unused-import lint warnings in case future imports change.
void addP; void scaleP; void isZero;

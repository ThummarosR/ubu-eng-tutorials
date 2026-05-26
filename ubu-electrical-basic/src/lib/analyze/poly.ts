// Polynomial + rational-function arithmetic for symbolic H(s) extraction.
// Polynomial = number[] of coefficients in ASCENDING degree order:
//   [c0, c1, c2] represents c0 + c1·s + c2·s²

export type Poly = number[];

const EPS = 1e-12;

export function trim(p: Poly): Poly {
  let n = p.length;
  while (n > 1 && Math.abs(p[n - 1]) < EPS) n--;
  return p.slice(0, n);
}

export function constPoly(c: number): Poly { return [c]; }
export const ZERO: Poly = [0];
export const ONE: Poly = [1];

export function addP(a: Poly, b: Poly): Poly {
  const n = Math.max(a.length, b.length);
  const out: Poly = new Array(n).fill(0);
  for (let i = 0; i < n; i++) out[i] = (a[i] ?? 0) + (b[i] ?? 0);
  return trim(out);
}

export function subP(a: Poly, b: Poly): Poly {
  const n = Math.max(a.length, b.length);
  const out: Poly = new Array(n).fill(0);
  for (let i = 0; i < n; i++) out[i] = (a[i] ?? 0) - (b[i] ?? 0);
  return trim(out);
}

export function mulP(a: Poly, b: Poly): Poly {
  if (isZero(a) || isZero(b)) return [0];
  const out: Poly = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) out[i + j] += a[i] * b[j];
  }
  return trim(out);
}

export function scaleP(a: Poly, k: number): Poly {
  if (k === 0) return [0];
  return a.map((c) => c * k);
}

export function isZero(p: Poly): boolean {
  for (const c of p) if (Math.abs(c) > EPS) return false;
  return true;
}

export function degree(p: Poly): number {
  const t = trim(p);
  return t.length - 1;
}

/** Polynomial long division: a / b → { q, r } with a = b·q + r, deg(r) < deg(b). */
export function divP(a: Poly, b: Poly): { q: Poly; r: Poly } {
  const bb = trim(b);
  if (isZero(bb)) throw new Error('divide by zero polynomial');
  const aa = trim(a).slice();
  const bd = bb.length - 1;
  if (aa.length - 1 < bd) return { q: [0], r: aa };
  const q: Poly = new Array(aa.length - bd).fill(0);
  const r = aa.slice();
  for (let i = r.length - 1; i >= bd; i--) {
    const c = r[i] / bb[bd];
    q[i - bd] = c;
    for (let j = 0; j <= bd; j++) r[i - j] -= c * bb[bd - j];
  }
  return { q: trim(q), r: trim(r.slice(0, bd)) };
}

/** GCD via Euclidean algorithm — used to reduce rational functions. */
export function gcdP(a: Poly, b: Poly): Poly {
  let x = trim(a);
  let y = trim(b);
  while (!isZero(y)) {
    const { r } = divP(x, y);
    x = y;
    y = r;
  }
  // Normalize: leading coefficient = 1
  if (x[x.length - 1] !== 0) {
    const lc = x[x.length - 1];
    x = x.map((c) => c / lc);
  }
  return x;
}

// ===== Rational function = (numerator, denominator) =====

export interface Rat { n: Poly; d: Poly }

export const RAT_ZERO: Rat = { n: [0], d: [1] };
export const RAT_ONE: Rat = { n: [1], d: [1] };

export function rat(n: number | Poly, d: number | Poly = 1): Rat {
  const N = typeof n === 'number' ? [n] : n;
  const D = typeof d === 'number' ? [d] : d;
  return reduce({ n: N, d: D });
}

export function addR(a: Rat, b: Rat): Rat {
  return reduce({ n: addP(mulP(a.n, b.d), mulP(b.n, a.d)), d: mulP(a.d, b.d) });
}

export function subR(a: Rat, b: Rat): Rat {
  return reduce({ n: subP(mulP(a.n, b.d), mulP(b.n, a.d)), d: mulP(a.d, b.d) });
}

export function mulR(a: Rat, b: Rat): Rat {
  return reduce({ n: mulP(a.n, b.n), d: mulP(a.d, b.d) });
}

export function divR(a: Rat, b: Rat): Rat {
  if (isZero(b.n)) throw new Error('rational divide by zero');
  return reduce({ n: mulP(a.n, b.d), d: mulP(a.d, b.n) });
}

export function negR(a: Rat): Rat {
  return { n: scaleP(a.n, -1), d: a.d };
}

/** Reduce by canceling polynomial GCD, then normalize denominator's leading coefficient to 1. */
export function reduce(r: Rat): Rat {
  const n = trim(r.n);
  const d = trim(r.d);
  if (isZero(n)) return { n: [0], d: [1] };
  const g = gcdP(n, d);
  let nn = divP(n, g).q;
  let dd = divP(d, g).q;
  // Normalize leading coefficient of denominator to +1 (push sign to numerator).
  if (dd.length > 0) {
    const lc = dd[dd.length - 1];
    if (lc !== 0 && Math.abs(lc - 1) > EPS) {
      nn = scaleP(nn, 1 / lc);
      dd = scaleP(dd, 1 / lc);
    }
  }
  return { n: trim(nn), d: trim(dd) };
}

/** Evaluate a polynomial at a complex point s = re + im·j. */
export function evalPolyAt(p: Poly, re: number, im: number): { re: number; im: number } {
  let outRe = 0;
  let outIm = 0;
  let powRe = 1;
  let powIm = 0;
  for (let i = 0; i < p.length; i++) {
    outRe += p[i] * powRe;
    outIm += p[i] * powIm;
    // pow *= s
    const nRe = powRe * re - powIm * im;
    const nIm = powRe * im + powIm * re;
    powRe = nRe;
    powIm = nIm;
  }
  return { re: outRe, im: outIm };
}

/** Format a polynomial as a human-readable string in 's'. */
export function fmtPoly(p: Poly, varName = 's', digits = 3): string {
  const t = trim(p);
  if (isZero(t)) return '0';
  const parts: string[] = [];
  for (let i = t.length - 1; i >= 0; i--) {
    const c = t[i];
    if (Math.abs(c) < EPS) continue;
    const sign = c < 0 ? '−' : parts.length === 0 ? '' : '+';
    // parseFloat round-trip strips trailing zeros AFTER a decimal point
    // (1.500 → 1.5) without stripping them from integers (100 stays 100).
    const mag = parseFloat(Math.abs(c).toPrecision(digits)).toString();
    const term =
      i === 0
        ? mag
        : i === 1
          ? `${mag === '1' ? '' : mag + '·'}${varName}`
          : `${mag === '1' ? '' : mag + '·'}${varName}^${i}`;
    parts.push((parts.length === 0 ? sign : ` ${sign} `) + term);
  }
  return parts.join('').trim();
}

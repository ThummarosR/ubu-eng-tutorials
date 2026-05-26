// Lightweight CAS-lite for symbolic block-diagram reduction.
//
// A SymExpr is either:
//   - A symbolic leaf — a block whose TF the user hasn't filled in (e.g. "G1")
//   - A numeric leaf — a parsed rational function (Rat)
//   - A composition: series (mul), parallel (add), feedback (div by 1 ± loop)
//
// When every leaf is numeric, toRat() collapses the tree to a single Rat that
// can be fed straight into the existing Bode/Step/PZ plot machinery.

import { Rat, RAT_ONE, addR, mulR, divR, scaleP } from '../analyze/poly';
import { formatRat } from './sympoly';

export type SymExpr =
  | { kind: 'sym'; name: string }                          // unfilled "G1"
  | { kind: 'rat'; r: Rat; src?: string }                  // numeric TF
  | { kind: 'neg'; a: SymExpr }                            // -A
  | { kind: 'add'; terms: SymExpr[] }                      // A + B + C
  | { kind: 'mul'; factors: SymExpr[] }                    // A · B · C
  | { kind: 'div'; n: SymExpr; d: SymExpr };               // A / B

export const ONE: SymExpr = { kind: 'rat', r: RAT_ONE };

export function sym(name: string): SymExpr { return { kind: 'sym', name }; }
export function lit(r: Rat, src?: string): SymExpr { return { kind: 'rat', r, src }; }

export function neg(a: SymExpr): SymExpr {
  if (a.kind === 'rat') return { kind: 'rat', r: { n: scaleP(a.r.n, -1), d: a.r.d } };
  if (a.kind === 'neg') return a.a;
  return { kind: 'neg', a };
}

export function add(terms: SymExpr[]): SymExpr {
  const filtered = terms.filter((t) => !isZero(t));
  if (filtered.length === 0) return { kind: 'rat', r: { n: [0], d: [1] } };
  if (filtered.length === 1) return filtered[0];
  return { kind: 'add', terms: filtered };
}

export function mul(factors: SymExpr[]): SymExpr {
  const filtered = factors.filter((f) => !isOne(f));
  if (filtered.length === 0) return ONE;
  if (filtered.length === 1) return filtered[0];
  return { kind: 'mul', factors: filtered };
}

export function div(n: SymExpr, d: SymExpr): SymExpr {
  if (isOne(d)) return n;
  return { kind: 'div', n, d };
}

function isZero(e: SymExpr): boolean {
  return e.kind === 'rat' && e.r.n.every((c) => Math.abs(c) < 1e-12);
}

function isOne(e: SymExpr): boolean {
  if (e.kind !== 'rat') return false;
  return e.r.n.length === 1 && Math.abs(e.r.n[0] - 1) < 1e-12 &&
         e.r.d.length === 1 && Math.abs(e.r.d[0] - 1) < 1e-12;
}

/** True iff every leaf of the tree is numeric (no `sym` nodes). */
export function isNumeric(e: SymExpr): boolean {
  switch (e.kind) {
    case 'sym': return false;
    case 'rat': return true;
    case 'neg': return isNumeric(e.a);
    case 'add': return e.terms.every(isNumeric);
    case 'mul': return e.factors.every(isNumeric);
    case 'div': return isNumeric(e.n) && isNumeric(e.d);
  }
}

/** Collapse to a single Rat. Throws if any leaf is symbolic — caller must guard
 *  with isNumeric() first (or catch). */
export function toRat(e: SymExpr): Rat {
  switch (e.kind) {
    case 'sym': throw new Error(`cannot collapse symbolic "${e.name}" to Rat`);
    case 'rat': return e.r;
    case 'neg': {
      const r = toRat(e.a);
      return { n: scaleP(r.n, -1), d: r.d };
    }
    case 'add': return e.terms.map(toRat).reduce((acc, r) => addR(acc, r), { n: [0], d: [1] } as Rat);
    case 'mul': return e.factors.map(toRat).reduce((acc, r) => mulR(acc, r), RAT_ONE);
    case 'div': return divR(toRat(e.n), toRat(e.d));
  }
}

/** Render a SymExpr as readable math text. Numeric leaves use the polynomial
 *  formatter; symbolic leaves use their name. */
export function formatSym(e: SymExpr, parentPrec = 0): string {
  // Precedence: add = 1, mul = 2, neg = 3, div = 0 (handled specially), atom = 4
  const wrap = (s: string, prec: number) => prec < parentPrec ? `(${s})` : s;
  switch (e.kind) {
    case 'sym': return e.name;
    case 'rat': {
      const s = formatRat(e.r);
      // If the rendered form contains spaces or operators, wrap based on context.
      const needsParen = /[+\-/\s]/.test(s) && parentPrec >= 2;
      return needsParen ? `(${s})` : s;
    }
    case 'neg': return wrap(`−${formatSym(e.a, 3)}`, 3);
    case 'add': return wrap(e.terms.map((t, i) => {
      // First term: no leading operator. Subsequent: " + " or " − ".
      if (t.kind === 'neg') {
        return (i === 0 ? '−' : ' − ') + formatSym(t.a, 1);
      }
      return (i === 0 ? '' : ' + ') + formatSym(t, 1);
    }).join(''), 1);
    case 'mul': return wrap(e.factors.map((f) => formatSym(f, 2)).join(' · '), 2);
    case 'div': return `${formatSym(e.n, 2)} / ${formatSym(e.d, 2)}`;
  }
}

/** Standard block-diagram operations on SymExpr. */
export function series(a: SymExpr, b: SymExpr): SymExpr {
  return mul([a, b]);
}

export function parallel(a: SymExpr, b: SymExpr): SymExpr {
  return add([a, b]);
}

/** Negative feedback: T = G / (1 + G·H). Positive feedback: T = G / (1 − G·H). */
export function feedback(G: SymExpr, H: SymExpr, positive = false): SymExpr {
  const loop = mul([G, H]);
  const denom = positive ? add([ONE, neg(loop)]) : add([ONE, loop]);
  return div(G, denom);
}

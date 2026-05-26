import { describe, it, expect } from 'vitest';
import {
  SymExpr, sym, lit, neg, add, mul, div, isNumeric, toRat, formatSym,
  series, parallel, feedback, ONE,
} from './symexpr';
import { tryParseRat } from './sympoly';

const ZERO: SymExpr = lit({ n: [0], d: [1] });

describe('SymExpr factory simplifications', () => {
  it('add filters out zero terms', () => {
    const x = sym('X');
    expect(add([ZERO, x])).toBe(x);
    expect(add([ZERO])).toEqual(ZERO);
  });

  it('mul filters out one factors', () => {
    const x = sym('X');
    expect(mul([ONE, x])).toBe(x);
    expect(mul([ONE, ONE])).toBe(ONE);
  });

  it('neg(neg(x)) = x', () => {
    const x = sym('X');
    expect(neg(neg(x))).toBe(x);
  });

  it('neg of numeric flips sign of coefficients', () => {
    const r = neg(lit({ n: [2], d: [1] }));
    expect(r).toMatchObject({ kind: 'rat', r: { n: [-2], d: [1] } });
  });

  it('div by one returns numerator', () => {
    const x = sym('X');
    expect(div(x, ONE)).toBe(x);
  });
});

describe('isNumeric / toRat', () => {
  it('isNumeric: pure symbolic leaf is not numeric', () => {
    expect(isNumeric(sym('G1'))).toBe(false);
  });

  it('isNumeric: rat leaf is numeric', () => {
    expect(isNumeric(lit({ n: [1], d: [1, 1] }))).toBe(true);
  });

  it('isNumeric: mixed tree is not numeric', () => {
    expect(isNumeric(mul([sym('G'), lit({ n: [1], d: [1] })]))).toBe(false);
  });

  it('toRat collapses series of rats', () => {
    // G1 = 1/(s+1), G2 = 2 → series = 2/(s+1)
    const G1 = lit(tryParseRat('1/(s+1)')!);
    const G2 = lit(tryParseRat('2')!);
    const r = toRat(series(G1, G2));
    expect(r.n).toEqual([2]);
    expect(r.d).toEqual([1, 1]);
  });

  it('toRat collapses feedback formula', () => {
    // G = 1/(s+1), H = 1 → T = G/(1+GH) = 1/(s+2)
    const G = lit(tryParseRat('1/(s+1)')!);
    const H = lit(tryParseRat('1')!);
    const T = feedback(G, H);
    expect(isNumeric(T)).toBe(true);
    const r = toRat(T);
    // Expected: 1/(s+2) — but after reduce, the form is [1]/[2,1].
    expect(r.n).toEqual([1]);
    expect(r.d).toEqual([2, 1]);
  });

  it('toRat throws on symbolic leaf', () => {
    expect(() => toRat(sym('G1'))).toThrow();
  });
});

describe('series / parallel / feedback', () => {
  it('series(G, H) is symbolic G·H when both unfilled', () => {
    const T = series(sym('G(s)'), sym('H(s)'));
    expect(isNumeric(T)).toBe(false);
    expect(formatSym(T)).toBe('G(s) · H(s)');
  });

  it('parallel(G, H) is symbolic G+H', () => {
    const T = parallel(sym('G(s)'), sym('H(s)'));
    expect(formatSym(T)).toBe('G(s) + H(s)');
  });

  it('feedback negative: T = G/(1+GH)', () => {
    const T = feedback(sym('G(s)'), sym('H(s)'));
    // Format should contain G and (1 + G·H) shape
    const s = formatSym(T);
    expect(s).toContain('G(s)');
    expect(s).toContain('H(s)');
    expect(s).toContain('/');
  });
});

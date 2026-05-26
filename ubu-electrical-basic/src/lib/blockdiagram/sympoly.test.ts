import { describe, it, expect } from 'vitest';
import { tryParseRat, formatPoly, formatRat } from './sympoly';

describe('tryParseRat — numeric polynomial parser', () => {
  it('parses numeric constants', () => {
    expect(tryParseRat('1')).toEqual({ n: [1], d: [1] });
    expect(tryParseRat('0.5')).toEqual({ n: [0.5], d: [1] });
    expect(tryParseRat('-1')).toEqual({ n: [-1], d: [1] });
  });

  it('parses s monomial', () => {
    expect(tryParseRat('s')).toEqual({ n: [0, 1], d: [1] });
  });

  it('parses simple polynomial', () => {
    expect(tryParseRat('s+1')).toEqual({ n: [1, 1], d: [1] });
    expect(tryParseRat('s + 1')).toEqual({ n: [1, 1], d: [1] });
  });

  it('parses polynomial with caret-power', () => {
    expect(tryParseRat('s^2 + 3*s + 2')).toEqual({ n: [2, 3, 1], d: [1] });
  });

  it('parses polynomial with superscript power', () => {
    expect(tryParseRat('s² + 1')).toEqual({ n: [1, 0, 1], d: [1] });
  });

  it('parses 1/s', () => {
    // After reduce: n=[1], d=[0,1]
    const r = tryParseRat('1/s');
    expect(r).not.toBeNull();
    expect(r!.n).toEqual([1]);
    expect(r!.d).toEqual([0, 1]);
  });

  it('parses 1/(s+1)', () => {
    const r = tryParseRat('1/(s+1)');
    expect(r).not.toBeNull();
    expect(r!.n).toEqual([1]);
    expect(r!.d).toEqual([1, 1]);
  });

  it('parses rational with quadratic denominator', () => {
    const r = tryParseRat('(s+2)/(s^2+3*s+5)');
    expect(r).not.toBeNull();
    expect(r!.n).toEqual([2, 1]);
    expect(r!.d).toEqual([5, 3, 1]);
  });

  it('parses implicit multiplication: 2s', () => {
    expect(tryParseRat('2s')).toEqual({ n: [0, 2], d: [1] });
  });

  it('parses implicit multiplication: 2(s+1)', () => {
    expect(tryParseRat('2(s+1)')).toEqual({ n: [2, 2], d: [1] });
  });

  it('parses implicit multiplication: (s+1)(s+2)', () => {
    // (s+1)(s+2) = s² + 3s + 2 → coefs [2, 3, 1]
    expect(tryParseRat('(s+1)(s+2)')).toEqual({ n: [2, 3, 1], d: [1] });
  });

  it('parses denominator without inner parens: 1/(s+1)(s+2)', () => {
    const r = tryParseRat('1/(s+1)(s+2)');
    expect(r).not.toBeNull();
    expect(r!.n).toEqual([1]);
    expect(r!.d).toEqual([2, 3, 1]);
  });

  it('returns null for non-numeric identifiers', () => {
    expect(tryParseRat('K')).toBeNull();
    expect(tryParseRat('G1')).toBeNull();
    expect(tryParseRat('K_p')).toBeNull();
    expect(tryParseRat('K/(s+1)')).toBeNull();
  });

  it('returns null for empty / whitespace', () => {
    expect(tryParseRat('')).toBeNull();
    expect(tryParseRat('   ')).toBeNull();
  });

  it('returns null for malformed syntax', () => {
    expect(tryParseRat('(s+1')).toBeNull();        // missing close paren
    expect(tryParseRat('1//s')).toBeNull();        // double slash
    expect(tryParseRat('s+')).toBeNull();          // trailing operator
  });

  it('tolerates redundant leading + operators', () => {
    // Permissive: s++1 → s + (+1) → s + 1
    expect(tryParseRat('s++1')).toEqual({ n: [1, 1], d: [1] });
  });
});

describe('formatPoly', () => {
  it('formats zero', () => {
    expect(formatPoly([0])).toBe('0');
  });

  it('formats constant', () => {
    expect(formatPoly([3])).toBe('3');
  });

  it('formats linear', () => {
    expect(formatPoly([1, 1])).toBe('1 + s');
    expect(formatPoly([2, 3])).toBe('2 + 3s');
  });

  it('formats quadratic with hat notation', () => {
    expect(formatPoly([1, 0, 1])).toBe('1 + s^2');
  });

  it('formats negative coefficients', () => {
    expect(formatPoly([1, -1])).toBe('1 − s');
  });
});

describe('formatRat', () => {
  it('hides unit denominator', () => {
    expect(formatRat({ n: [1, 1], d: [1] })).toBe('1 + s');
  });

  it('shows non-unit denominator', () => {
    expect(formatRat({ n: [1], d: [1, 1] })).toBe('(1) / (1 + s)');
  });
});

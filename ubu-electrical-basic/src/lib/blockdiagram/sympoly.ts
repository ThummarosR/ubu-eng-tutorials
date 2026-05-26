// Tiny s-polynomial / rational-function string parser.
//
// Accepted shapes (whitespace-flexible, both `^` and `²/³…` for powers, `*`
// optional between number and `s`):
//   "1"
//   "K"                   → not numeric — caller treats as symbolic
//   "1/s"                 → 1 / s
//   "s+1"                 → polynomial
//   "1/(s+1)"             → rational
//   "(s+2)/(s^2 + 3*s + 5)"
//   "2.5(s+1)/(s²(s+10))"
//
// Returns a Rat when the expression is fully numeric (every leaf is a number).
// Returns null when any token is non-numeric (e.g. "K", "G1") — caller should
// keep the original string as a symbolic expression.

import { Poly, Rat, addP, mulP, scaleP, ONE, ZERO, reduce } from '../analyze/poly';

interface ParseState {
  src: string;
  pos: number;
}

const isDigit = (c: string) => c >= '0' && c <= '9';
const isLetter = (c: string) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
const isAlphaNum = (c: string) => isDigit(c) || isLetter(c) || c === '_';

function skipWs(s: ParseState) { while (s.pos < s.src.length && /\s/.test(s.src[s.pos])) s.pos++; }

function eat(s: ParseState, ch: string): boolean {
  skipWs(s);
  if (s.src[s.pos] === ch) { s.pos++; return true; }
  return false;
}

function parseSuperscript(s: ParseState): number | null {
  // Accept ² ³ ⁴ ⁵ ⁶ ⁷ ⁸ ⁹ as instant exponents.
  const map: Record<string, number> = { '²': 2, '³': 3, '⁴': 4, '⁵': 5, '⁶': 6, '⁷': 7, '⁸': 8, '⁹': 9 };
  const c = s.src[s.pos];
  if (c in map) { s.pos++; return map[c]; }
  return null;
}

/** Parse a numeric literal. Returns null if no digit at the cursor. */
function parseNumber(s: ParseState): number | null {
  skipWs(s);
  const start = s.pos;
  while (s.pos < s.src.length && (isDigit(s.src[s.pos]) || s.src[s.pos] === '.')) s.pos++;
  if (s.pos === start) return null;
  return parseFloat(s.src.slice(start, s.pos));
}

/** Parse a non-numeric identifier ("s", "K", "G1"). Returns the name or null. */
function parseIdent(s: ParseState): string | null {
  skipWs(s);
  if (!isLetter(s.src[s.pos] ?? '')) return null;
  const start = s.pos;
  while (s.pos < s.src.length && isAlphaNum(s.src[s.pos])) s.pos++;
  return s.src.slice(start, s.pos);
}

// ─── Polynomial parsing ─────────────────────────────────────────────────
//
// Grammar (numeric only — any non-numeric ident → throws, caller swallows):
//   expr   = term { '+' term | '-' term }
//   term   = factor { factor | '*' factor }
//   factor = number | '(' expr ')' | 's' [ '^' int | superscript ]
//   "factor factor" is implicit multiplication (`2(s+1)`, `(s+1)(s+2)`).

class NonNumeric extends Error {}

function parsePoly(s: ParseState): Poly {
  let p = parseTerm(s);
  while (true) {
    skipWs(s);
    if (eat(s, '+')) p = addP(p, parseTerm(s));
    else if (eat(s, '-')) p = addP(p, scaleP(parseTerm(s), -1));
    else break;
  }
  return p;
}

function parseTerm(s: ParseState): Poly {
  // Unary minus on the first factor of a term.
  let sign = 1;
  while (eat(s, '+')) {} // no-op
  if (eat(s, '-')) sign = -1;
  let p = parseFactor(s);
  while (true) {
    skipWs(s);
    const c = s.src[s.pos];
    if (c === '*') { s.pos++; p = mulP(p, parseFactor(s)); }
    else if (c === '(' || isLetter(c) || isDigit(c)) { p = mulP(p, parseFactor(s)); }
    else break;
  }
  return sign === -1 ? scaleP(p, -1) : p;
}

function parseFactor(s: ParseState): Poly {
  skipWs(s);
  if (eat(s, '(')) {
    const p = parsePoly(s);
    if (!eat(s, ')')) throw new Error('expected )');
    return applyPower(s, p);
  }
  const num = parseNumber(s);
  if (num !== null) return applyPower(s, [num]);
  const id = parseIdent(s);
  if (id === 's') return applyPower(s, [0, 1]); // s¹
  if (id != null) throw new NonNumeric(`non-numeric identifier "${id}"`);
  throw new Error(`unexpected token at "${s.src.slice(s.pos)}"`);
}

function applyPower(s: ParseState, p: Poly): Poly {
  skipWs(s);
  if (eat(s, '^')) {
    const k = parseNumber(s);
    if (k == null || !Number.isInteger(k) || k < 0) throw new Error('expected non-negative integer exponent');
    return powP(p, k);
  }
  const sup = parseSuperscript(s);
  if (sup != null) return powP(p, sup);
  return p;
}

function powP(p: Poly, k: number): Poly {
  let r: Poly = ONE.slice();
  for (let i = 0; i < k; i++) r = mulP(r, p);
  return r.length === 0 ? ZERO.slice() : r;
}

/** Parse a rational expression. Numerator [ "/" denominator ]. Throws if non-numeric. */
function parseRat(src: string): Rat {
  const s: ParseState = { src, pos: 0 };
  const num = parsePoly(s);
  skipWs(s);
  let den: Poly = ONE.slice();
  if (eat(s, '/')) {
    // The denominator after `/` is also a term-level expression — but for safety
    // we require parentheses around multi-term denominators. Single factor OK.
    skipWs(s);
    if (s.src[s.pos] === '(') {
      den = parseFactor(s);
    } else {
      // bare factor (number or s or s^n)
      den = parseFactor(s);
    }
    // Allow trailing factors on the denominator (e.g. "1/(s+1)(s+2)" without an inner paren).
    while (true) {
      skipWs(s);
      const c = s.src[s.pos];
      if (c === '*') { s.pos++; den = mulP(den, parseFactor(s)); }
      else if (c === '(' || isLetter(c) || isDigit(c)) { den = mulP(den, parseFactor(s)); }
      else break;
    }
  }
  skipWs(s);
  if (s.pos < s.src.length) throw new Error(`trailing junk at "${s.src.slice(s.pos)}"`);
  return reduce({ n: num, d: den });
}

/**
 * Try to parse `src` as a numeric rational function in s. Return the Rat on
 * success, or null if any non-numeric identifier appears (e.g. "K", "G1") OR
 * the syntax is malformed. Caller decides what to do with null (e.g. keep as
 * symbolic expression).
 */
export function tryParseRat(src: string): Rat | null {
  if (!src || !src.trim()) return null;
  try {
    return parseRat(src);
  } catch (e) {
    if (e instanceof NonNumeric) return null;
    // Syntax errors → null; let the caller surface "invalid TF" if it wants.
    return null;
  }
}

/** Pretty-print a polynomial as ascending-degree text: "1 + 2s + 3s²". */
export function formatPoly(p: Poly): string {
  const trimmed: Poly = [];
  for (const c of p) trimmed.push(c);
  while (trimmed.length > 1 && Math.abs(trimmed[trimmed.length - 1]) < 1e-12) trimmed.pop();
  if (trimmed.length === 1 && Math.abs(trimmed[0]) < 1e-12) return '0';
  const parts: string[] = [];
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i];
    if (Math.abs(c) < 1e-12) continue;
    const sign = c < 0 ? '−' : parts.length > 0 ? '+' : '';
    const abs = Math.abs(c);
    const coef = i === 0 ? `${trimNum(abs)}` : abs === 1 ? '' : `${trimNum(abs)}`;
    const sterm = i === 0 ? '' : i === 1 ? 's' : `s^${i}`;
    parts.push(`${sign}${parts.length > 0 ? ' ' : ''}${coef}${sterm}`);
  }
  return parts.join(' ');
}

function trimNum(n: number): string {
  return Number.isInteger(n) ? String(n) : parseFloat(n.toFixed(4)).toString();
}

export function formatRat(r: Rat): string {
  if (r.d.length === 1 && Math.abs(r.d[0] - 1) < 1e-12) return formatPoly(r.n);
  return `(${formatPoly(r.n)}) / (${formatPoly(r.d)})`;
}

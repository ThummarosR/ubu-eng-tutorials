// Render a worked-example line with per-quantity color coding.
// Voltage/current/resistance/power/etc. tokens are colored consistently with
// the canvas annotations so a student can scan the math by colour.

import { Fragment } from 'react';

// Unit suffix → tailwind colour class. Longer prefixes must come first in the
// regex alternation below to win the match (kΩ before Ω, etc.).
const UNIT_CLASS: Record<string, string> = {
  V: 'text-blue-700', mV: 'text-blue-700', kV: 'text-blue-700', µV: 'text-blue-700', uV: 'text-blue-700',
  A: 'text-emerald-600', mA: 'text-emerald-600', µA: 'text-emerald-600', uA: 'text-emerald-600', kA: 'text-emerald-600',
  Ω: 'text-amber-700', mΩ: 'text-amber-700', kΩ: 'text-amber-700', MΩ: 'text-amber-700',
  W: 'text-purple-700', mW: 'text-purple-700', kW: 'text-purple-700', µW: 'text-purple-700',
  Hz: 'text-cyan-700', kHz: 'text-cyan-700', MHz: 'text-cyan-700',
  H: 'text-teal-700', mH: 'text-teal-700', µH: 'text-teal-700', uH: 'text-teal-700',
  F: 'text-pink-700', mF: 'text-pink-700', µF: 'text-pink-700', uF: 'text-pink-700', nF: 'text-pink-700', pF: 'text-pink-700',
  s: 'text-slate-600', ms: 'text-slate-600', µs: 'text-slate-600', us: 'text-slate-600',
  '°': 'text-slate-600',
};

// Variable letter → tailwind colour class. Matches the unit scheme so V_R1
// and "12 V" both render blue. Control-system variables (G, H, K, T) are
// included so root-locus rule prose and block-diagram walkthroughs colour
// consistently.
const VAR_CLASS: Record<string, string> = {
  V: 'text-blue-700 font-semibold',
  I: 'text-emerald-600 font-semibold',
  R: 'text-amber-700 font-semibold',
  P: 'text-purple-700 font-semibold',
  L: 'text-teal-700 font-semibold',
  C: 'text-pink-700 font-semibold',
  Q: 'text-fuchsia-700 font-semibold',
  S: 'text-rose-700 font-semibold',
  // Control-systems palette:
  G: 'text-sky-700 font-semibold',       // plant / forward gain
  H: 'text-fuchsia-700 font-semibold',   // feedback transfer function
  K: 'text-purple-700 font-semibold',    // gain (same family as P)
  T: 'text-amber-700 font-semibold',     // closed-loop transfer function
};

// Greek letters that appear in control-systems pedagogy — coloured separately
// since they're outside the ASCII variable class.
const GREEK_CLASS: Record<string, string> = {
  Δ: 'text-indigo-700 font-semibold',     // Mason determinant
  Σ: 'text-slate-700 font-semibold',      // sum
  ω: 'text-cyan-700 font-semibold',       // angular frequency
  σ: 'text-orange-700 font-semibold',     // real-part / asymptote centroid
  ζ: 'text-violet-700 font-semibold',     // damping ratio
  τ: 'text-teal-700 font-semibold',       // time constant
};

// Group 1: number (with optional decimal). Group 2: optional unit suffix.
// Group 3: variable letter. Group 4: optional subscript (e.g. _R1).
// Group 5: operator/arrow. Group 6: Greek letter.
const TOKEN_RE =
  /(\d+(?:\.\d+)?)\s*(kΩ|MΩ|mΩ|Ω|kHz|MHz|Hz|kV|mV|µV|uV|V|kA|mA|µA|uA|A|kW|mW|µW|W|mH|µH|uH|H|µF|uF|nF|pF|mF|F|ms|µs|us|s|°)?|([VIRPLCQSGHKT])(_[A-Za-z0-9]+)?\b|([=+·−→])|([ΔΣωσζτ])/g;

interface Span {
  text: string;
  cls?: string;
}

function tokenize(line: string): Span[] {
  const out: Span[] = [];
  let cursor = 0;
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(line)) !== null) {
    if (m.index > cursor) out.push({ text: line.slice(cursor, m.index) });
    const [whole, num, unit, varLetter, subscript, op, greek] = m;
    if (num != null) {
      // "12 V" or just "12" — colour by unit if present, otherwise neutral.
      const cls = unit ? UNIT_CLASS[unit] : 'text-slate-800';
      out.push({ text: whole, cls });
    } else if (varLetter != null) {
      const cls = VAR_CLASS[varLetter] ?? 'text-slate-700 font-medium';
      out.push({ text: varLetter + (subscript ?? ''), cls });
    } else if (op != null) {
      out.push({ text: op, cls: 'text-slate-400' });
    } else if (greek != null) {
      out.push({ text: greek, cls: GREEK_CLASS[greek] ?? 'text-slate-700 font-medium' });
    }
    cursor = m.index + whole.length;
  }
  if (cursor < line.length) out.push({ text: line.slice(cursor) });
  return out;
}

// A line ending with ":" and containing no equation operator is a section
// header — show it in bold dark for contrast against equation lines.
function isHeader(line: string): boolean {
  const trimmed = line.trimEnd();
  if (!trimmed.endsWith(':')) return false;
  return !/[=+·→]/.test(trimmed);
}

interface Props {
  lines: string[];
  className?: string;
}

export function FormattedStep({ lines, className }: Props) {
  return (
    <pre
      className={
        'text-[12.5px] leading-relaxed font-mono whitespace-pre-wrap ' +
        (className ?? '')
      }
    >
      {lines.map((line, i) => {
        if (line === '') return <Fragment key={i}>{'\n'}</Fragment>;
        if (isHeader(line)) {
          return (
            <Fragment key={i}>
              <span className="text-slate-900 font-semibold">{line}</span>
              {'\n'}
            </Fragment>
          );
        }
        const spans = tokenize(line);
        return (
          <Fragment key={i}>
            {spans.map((s, j) =>
              s.cls ? (
                <span key={j} className={s.cls}>{s.text}</span>
              ) : (
                <Fragment key={j}>{s.text}</Fragment>
              ),
            )}
            {'\n'}
          </Fragment>
        );
      })}
    </pre>
  );
}

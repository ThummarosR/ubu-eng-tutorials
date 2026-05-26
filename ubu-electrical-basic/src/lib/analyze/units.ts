// Parse and format SI-prefixed values used in component value strings
// ("1 kΩ", "12 V", "5 mA", "10 µF", "10 mH" etc.).

const PREFIX: Record<string, number> = {
  T: 1e12,
  G: 1e9,
  M: 1e6,
  k: 1e3,
  '': 1,
  m: 1e-3,
  u: 1e-6,
  µ: 1e-6,
  n: 1e-9,
  p: 1e-12,
};

const VALUE_RE = /^\s*([+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*([TGMkmuµnp]?)\s*([A-Za-zΩ°]*)\s*$/;

/** Parse a value string like "1 kΩ" into a numeric value in base units. Returns NaN on failure. */
export function parseValue(s: string | undefined | null): number {
  if (s == null) return NaN;
  const m = VALUE_RE.exec(String(s));
  if (!m) return NaN;
  const mantissa = parseFloat(m[1]);
  const prefix = m[2] ?? '';
  const mult = PREFIX[prefix];
  if (mult == null) return NaN;
  return mantissa * mult;
}

/** Format a numeric value back into a readable string with an SI prefix. */
export function formatValue(v: number, unit = '', digits = 3): string {
  if (!Number.isFinite(v)) return `— ${unit}`.trim();
  if (v === 0) return `0 ${unit}`.trim();
  const abs = Math.abs(v);
  const choices: Array<[number, string]> = [
    [1e12, 'T'],
    [1e9, 'G'],
    [1e6, 'M'],
    [1e3, 'k'],
    [1, ''],
    [1e-3, 'm'],
    [1e-6, 'µ'],
    [1e-9, 'n'],
    [1e-12, 'p'],
  ];
  for (const [mag, prefix] of choices) {
    if (abs >= mag) {
      const scaled = v / mag;
      return `${trim(scaled, digits)} ${prefix}${unit}`.trim();
    }
  }
  return `${trim(v, digits)} ${unit}`.trim();
}

function trim(n: number, digits: number): string {
  // Show up to `digits` significant figures, drop trailing zeros.
  const s = n.toPrecision(digits);
  return parseFloat(s).toString();
}

/** Multiply the numeric magnitude of a value string by `factor`, keep the unit.
 *  e.g. scaleValueStr("1 kΩ", 2) → "2 kΩ". Returns null if the string can't be parsed. */
export function scaleValueStr(s: string, factor: number): string | null {
  const num = parseValue(s);
  if (!Number.isFinite(num) || num === 0) return null;
  // Extract the unit suffix (alphabetic / Ω tail).
  const m = /([A-Za-zΩ°]+)\s*$/.exec(s.trim());
  const unit = m ? m[1] : '';
  return formatValue(num * factor, unit);
}

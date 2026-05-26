// 3-phase phasor analysis for Lab 11.
// Scope (v1):
//   - One src3p (balanced source: V_phase ∠0/-120/+120, ABC sequence)
//   - One loady3p OR loadd3p (balanced load, R + L per phase)
//   - Optional: source.n wired to load.n (Y-Y with grounded neutral)
// Outputs complex phasors and standard 3-phase power quantities.

import type { Node } from '@xyflow/react';
import { IECNodeData } from '../../components/nodes/iec';
import { parseValue } from './units';

export interface Cplx { re: number; im: number }
const cZero: Cplx = { re: 0, im: 0 };
const cAdd = (a: Cplx, b: Cplx): Cplx => ({ re: a.re + b.re, im: a.im + b.im });
const cSub = (a: Cplx, b: Cplx): Cplx => ({ re: a.re - b.re, im: a.im - b.im });
const cMul = (a: Cplx, b: Cplx): Cplx => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
const cDiv = (a: Cplx, b: Cplx): Cplx => {
  const denom = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / denom, im: (a.im * b.re - a.re * b.im) / denom };
};
const cAbs = (a: Cplx): number => Math.sqrt(a.re * a.re + a.im * a.im);
const cAngDeg = (a: Cplx): number => (Math.atan2(a.im, a.re) * 180) / Math.PI;
const cConj = (a: Cplx): Cplx => ({ re: a.re, im: -a.im });
const cPolar = (mag: number, degAng: number): Cplx => {
  const rad = (degAng * Math.PI) / 180;
  return { re: mag * Math.cos(rad), im: mag * Math.sin(rad) };
};

export interface ThreePhaseResult {
  ok: boolean;
  warnings: string[];
  error?: string;
  /** Source description label (e.g. "Y-Y", "Y-Δ"). */
  topology?: string;
  freqHz?: number;
  /** Phase voltages at the source side (line-to-neutral). */
  Va?: Cplx; Vb?: Cplx; Vc?: Cplx;
  /** Line-to-line voltages. */
  Vab?: Cplx; Vbc?: Cplx; Vca?: Cplx;
  /** Line currents (a, b, c). */
  Ia?: Cplx; Ib?: Cplx; Ic?: Cplx;
  /** Neutral current (Y load only; 0 for balanced). */
  In?: Cplx;
  /** Per-phase + total real, reactive, apparent power. */
  Pa?: number; Pb?: number; Pc?: number; Ptot?: number;
  Qa?: number; Qb?: number; Qc?: number; Qtot?: number;
  Stot?: number;
  PF?: number;
  /** Phase angle between V and I (positive = inductive lag). */
  phi?: number;
  /** Per-phase load impedance Z = R + jωL (for display). For balanced this is one value;
   *  for unbalanced it's the (a-phase) value. The full triplet sits in Zphases. */
  Zphase?: Cplx;
  Zphases?: [Cplx, Cplx, Cplx];
  balanced?: boolean;
}

/** Parse a single token, which may itself be slash-separated for per-phase values.
 *  e.g. "10 Ω" → [10,10,10] (balanced)
 *       "10/15/20 Ω" → [10,15,20] (unbalanced)
 */
function parseTriple(s: string, fallback: number): [number, number, number] {
  const m = /([A-Za-zΩ°]+)\s*$/.exec(s.trim());
  const unit = m ? m[1] : '';
  const numeric = m ? s.slice(0, m.index).trim() : s.trim();
  const parts = numeric.split('/').map((p) => p.trim());
  const parsed = parts.map((p) => {
    const v = parseValue(p + (unit ? ' ' + unit : ''));
    return Number.isFinite(v) ? v : fallback;
  });
  if (parsed.length === 1) return [parsed[0], parsed[0], parsed[0]];
  if (parsed.length === 3) return [parsed[0], parsed[1], parsed[2]];
  return [parsed[0] ?? fallback, parsed[0] ?? fallback, parsed[0] ?? fallback];
}

/** Parse a load value string like "10 Ω, 30 mH" — or unbalanced "10/15/20 Ω, 30/40/50 mH". */
function parseLoad(s: string | undefined): { R: [number, number, number]; L: [number, number, number]; balanced: boolean } {
  if (!s) return { R: [10, 10, 10], L: [0, 0, 0], balanced: true };
  const parts = s.split(',').map((x) => x.trim());
  const R = parseTriple(parts[0] ?? '', 10);
  const L = parts.length > 1 ? parseTriple(parts[1] ?? '', 0) : [0, 0, 0] as [number, number, number];
  const balanced = R[0] === R[1] && R[1] === R[2] && L[0] === L[1] && L[1] === L[2];
  return { R, L, balanced };
}

/** Parse a source value string like "230 V, 50 Hz" into V_phase and f. */
function parseSource(s: string | undefined): { Vp: number; f: number } {
  if (!s) return { Vp: 230, f: 50 };
  const parts = s.split(',').map((x) => x.trim());
  const Vp = Math.max(parseValue(parts[0]) || 230, 1e-3);
  const f = parts.length > 1 ? Math.max(parseValue(parts[1]) || 50, 1e-3) : 50;
  return { Vp, f };
}

export function solveThreePhase(rfNodes: Node[]): ThreePhaseResult {
  const warnings: string[] = [];
  const iec = rfNodes.filter((n): n is Node<IECNodeData> => n.type === 'iec');

  const src = iec.find((n) => n.data.kind === 'src3p');
  const loady = iec.find((n) => n.data.kind === 'loady3p');
  const loadd = iec.find((n) => n.data.kind === 'loadd3p');
  if (!src) return { ok: false, warnings, error: 'No 3-phase source — drop a "Src" component on the canvas.' };
  if (!loady && !loadd) return { ok: false, warnings, error: 'No 3-phase load — drop a Y or Δ load.' };
  if (loady && loadd) return { ok: false, warnings, error: 'Pick ONE load (Y or Δ), not both.' };
  const load = loady ?? loadd!;

  const { Vp, f } = parseSource(src.data.value);
  const { R, L, balanced } = parseLoad(load.data.value);
  const omega = 2 * Math.PI * f;
  const Zphases: [Cplx, Cplx, Cplx] = [
    { re: R[0], im: omega * L[0] },
    { re: R[1], im: omega * L[1] },
    { re: R[2], im: omega * L[2] },
  ];
  const Zphase: Cplx = Zphases[0]; // display value

  // Source phasors — balanced ABC sequence, V_phase = line-to-neutral.
  const Va: Cplx = cPolar(Vp, 0);
  const Vb: Cplx = cPolar(Vp, -120);
  const Vc: Cplx = cPolar(Vp, 120);
  // Line-to-line voltages.
  const Vab = cSub(Va, Vb);
  const Vbc = cSub(Vb, Vc);
  const Vca = cSub(Vc, Va);

  let Ia: Cplx, Ib: Cplx, Ic: Cplx, In: Cplx, topology: string;
  if (loady) {
    topology = balanced
      ? 'Y-Y (balanced, grounded neutral)'
      : 'Y-Y (unbalanced, grounded neutral)';
    // I_line = V_phase / Z_phase for each leg.
    Ia = cDiv(Va, Zphases[0]);
    Ib = cDiv(Vb, Zphases[1]);
    Ic = cDiv(Vc, Zphases[2]);
    In = cAdd(cAdd(Ia, Ib), Ic); // nonzero for unbalanced
  } else {
    topology = balanced ? 'Y-Δ (balanced)' : 'Y-Δ (unbalanced)';
    // Δ load: phase currents Iab = Vab / Z_ab. Per-leg impedances map to Zphases[0..2]
    // as [ab, bc, ca].
    const Iab = cDiv(Vab, Zphases[0]);
    const Ibc = cDiv(Vbc, Zphases[1]);
    const Ica = cDiv(Vca, Zphases[2]);
    Ia = cSub(Iab, Ica);
    Ib = cSub(Ibc, Iab);
    Ic = cSub(Ica, Ibc);
    In = cZero;
  }

  // Per-phase power: S_phase = V_phase · conj(I_line) for Y; for Δ phase
  // we'd use V_line · conj(I_phase) — but I_phase = I_line/√3 ∠+30° relationship,
  // so total power is the same either way. Per-phase numbers below assume Y-style.
  const Sa = cMul(Va, cConj(Ia));
  const Sb = cMul(Vb, cConj(Ib));
  const Sc = cMul(Vc, cConj(Ic));
  const Ptot = Sa.re + Sb.re + Sc.re;
  const Qtot = Sa.im + Sb.im + Sc.im;
  const Stot = Math.sqrt(Ptot * Ptot + Qtot * Qtot);
  const PF = Stot > 1e-9 ? Ptot / Stot : 1;
  // Phase angle (V vs I per leg) — same for all 3 in balanced system.
  const phi = cAngDeg(Va) - cAngDeg(Ia);

  if (loady && cAbs(In) > 1e-6 * Vp) {
    warnings.push(`Neutral current = ${cAbs(In).toPrecision(3)} A (≈ 0 expected for balanced loads).`);
  }

  return {
    ok: true,
    warnings,
    topology,
    freqHz: f,
    Va, Vb, Vc,
    Vab, Vbc, Vca,
    Ia, Ib, Ic, In,
    Pa: Sa.re, Pb: Sb.re, Pc: Sc.re, Ptot,
    Qa: Sa.im, Qb: Sb.im, Qc: Sc.im, Qtot,
    Stot, PF, phi,
    Zphase,
    Zphases,
    balanced,
  };
}

// Convenience exports for the bench rendering.
export { cAbs, cAngDeg };

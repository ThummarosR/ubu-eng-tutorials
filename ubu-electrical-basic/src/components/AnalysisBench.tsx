// Bottom "lab bench" drawer for AC analyze mode.
// Holds 4 tabs: Bode · Phasor · Step · Pole-Zero, all derived from one H(s).

import { useMemo, useState } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { buildTF, evalH, TFResult } from '../lib/analyze/laplace';
import { findRoots, CRoot } from '../lib/analyze/roots';
import { stepResponse, suggestT } from '../lib/analyze/step';
import { fmtPoly } from '../lib/analyze/poly';
import { scaleValueStr } from '../lib/analyze/units';
import { useStore } from '../store';

interface Props {
  nodes: Node[];
  edges: Edge[];
}

/** For each original pole, find the closest pole in `alt`. Return distances + indices. */
function poleDiff(orig: CRoot[], alt: CRoot[]): { distFromAlt: number[] } {
  const dist: number[] = [];
  for (const p of orig) {
    let best = Infinity;
    for (const a of alt) {
      const d = Math.hypot(p.re - a.re, p.im - a.im);
      if (d < best) best = d;
    }
    dist.push(best);
  }
  return { distFromAlt: dist };
}

type Tab = 'bode' | 'phasor' | 'step' | 'pz' | 'power';

const TAB_LABEL: Record<Tab, string> = {
  bode: 'Bode',
  phasor: 'Phasor',
  step: 'Step response',
  pz: 'Pole-zero',
  power: 'Power',
};

export function AnalysisBench({ nodes, edges }: Props) {
  const tf: TFResult = useMemo(() => buildTF(nodes, edges), [nodes, edges]);
  const [tab, setTab] = useState<Tab>('bode');
  const [collapsed, setCollapsed] = useState(false);
  const acFrequency = useStore((s) => s.acFrequency);
  const setAcFrequency = useStore((s) => s.setAcFrequency);
  const acHighlightId = useStore((s) => s.acHighlightId);

  // Provenance: if the user has selected an R/L/C, build an alternate TF where
  // that one component's VALUE is scaled by 2× (preserves topology so the SISO
  // markers still solve). The pole whose position moves the FARTHEST between
  // the two solves is "the pole this component sets the location of".
  const altTF = useMemo(() => {
    if (!acHighlightId) return null;
    const altNodes = nodes.map((n) => {
      if (n.id !== acHighlightId || n.type !== 'iec') return n;
      const data = n.data as { value?: string };
      const scaled = data.value ? scaleValueStr(data.value, 2) : null;
      if (!scaled) return n;
      return { ...n, data: { ...n.data, value: scaled } };
    });
    return buildTF(altNodes, edges);
  }, [acHighlightId, nodes, edges]);

  // Parameter trajectory locus: sweep the highlighted component's value across
  // a log-scale range (×1/10 to ×10 of its current value) and collect every
  // resulting pole set. Drawn as a trail on the pole-zero plot.
  const locusTrail = useMemo<CRoot[][] | undefined>(() => {
    if (!acHighlightId || !tf.ok || !tf.H) return undefined;
    const N = 24;
    const trail: CRoot[][] = [];
    for (let i = 0; i < N; i++) {
      const factor = Math.pow(10, (i / (N - 1)) * 2 - 1); // 0.1 … 10
      const swept = nodes.map((n) => {
        if (n.id !== acHighlightId || n.type !== 'iec') return n;
        const data = n.data as { value?: string };
        const scaled = data.value ? scaleValueStr(data.value, factor) : null;
        if (!scaled) return n;
        return { ...n, data: { ...n.data, value: scaled } };
      });
      const sweptTF = buildTF(swept, edges);
      if (sweptTF.ok && sweptTF.H) trail.push(findRoots(sweptTF.H.d));
    }
    return trail.length > 0 ? trail : undefined;
  }, [acHighlightId, nodes, edges, tf]);

  if (collapsed) {
    return (
      <div className="h-7 shrink-0 border-t border-slate-200 bg-white flex items-center px-3 gap-2">
        <button
          onClick={() => setCollapsed(false)}
          className="text-xs text-brand-900 hover:text-brand-950 font-medium"
        >
          ▴ Show analysis bench
        </button>
        <div className="text-[11px] text-slate-500">
          AC mode · {tf.ok ? 'H(s) ready' : tf.error ?? '…'}
        </div>
      </div>
    );
  }

  return (
    <div className="h-64 shrink-0 border-t border-slate-200 bg-white flex flex-col">
      <header className="h-9 shrink-0 border-b border-slate-200 bg-gradient-to-r from-brand-50 to-white flex items-center pl-3 pr-2 gap-1">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-950 flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-gold ring-2 ring-brand-gold/30" />
          Analysis bench
        </div>
        <div className="ml-3 flex gap-1">
          {(['bode', 'phasor', 'step', 'pz', 'power'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={
                'px-3 py-1 text-xs rounded-md transition-colors font-medium ' +
                (tab === t
                  ? 'bg-brand-950 text-brand-gold'
                  : 'text-slate-600 hover:bg-slate-100')
              }
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
        <div className="ml-4 flex items-center gap-2 text-[11px] text-slate-600">
          <label className="flex items-center gap-1">
            <span className="uppercase tracking-wider">f</span>
            <input
              type="number"
              value={acFrequency}
              min={0.001}
              step={10}
              onChange={(e) => setAcFrequency(parseFloat(e.target.value) || 1)}
              className="w-20 border border-slate-200 rounded px-1.5 py-0.5 text-xs"
            />
            Hz
          </label>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => setCollapsed(true)}
          title="Hide bench"
          className="text-slate-400 hover:text-brand-900 text-base leading-none px-2"
        >
          ▾
        </button>
      </header>

      {!tf.ok && (
        <div className="flex-1 flex flex-col items-center justify-center text-sm text-slate-500 italic px-6 text-center gap-2">
          <div>{tf.error}</div>
          <div className="text-[11px] text-slate-400 not-italic">
            Need a Vin/Iin, a Vout/Iout, and a ground. Drop the markers from the palette.
          </div>
        </div>
      )}
      {/* Health-check hints — flagged ABOVE the plots so students notice. */}
      {tf.ok && tf.H && (() => {
        const allPoles = findRoots(tf.H.d);
        const unstable = allPoles.some((p) => p.re > 1e-6);
        const dcGain = (() => {
          const num = tf.H!.n[0] ?? 0;
          const den = tf.H!.d[0] ?? 0;
          return den !== 0 ? num / den : Infinity;
        })();
        const blocksDC = Math.abs(dcGain) < 1e-9 && (tf.H!.n[0] === 0 || Math.abs((tf.H!.n[0] ?? 0)) < 1e-12);
        const hints: string[] = [];
        if (unstable) hints.push('⚠ At least one pole is in the right-half-plane — circuit is UNSTABLE (step response will blow up).');
        if (blocksDC) hints.push('ℹ H(s)|_{s=0} ≈ 0 — this circuit blocks DC. Probably a series capacitor or a differentiator topology.');
        if (hints.length === 0) return null;
        return (
          <div className="px-3 py-1 bg-amber-50 border-b border-amber-200 text-[11px] text-amber-900">
            {hints.map((h, i) => <div key={i}>{h}</div>)}
          </div>
        );
      })()}
      {tf.ok && tf.H && (
        <div className="flex-1 min-h-0 flex">
          <div className="w-64 shrink-0 border-r border-slate-200 px-3 py-2 overflow-y-auto bg-slate-50">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
              Transfer function H(s)
            </div>
            <div className="text-[11px] font-mono leading-tight bg-white border border-slate-200 rounded p-2 break-words">
              <div className="text-slate-700">{fmtPoly(tf.H.n)}</div>
              <div className="border-t border-slate-300 my-1"></div>
              <div className="text-slate-700">{fmtPoly(tf.H.d)}</div>
            </div>
            <div className="text-[10px] text-slate-500 mt-2">
              In: <span className="font-semibold text-brand-900">{tf.inputKind === 'vin' ? 'Vin (V)' : 'Iin (A)'}</span>
              {' · '}
              Out: <span className="font-semibold text-amber-700">{tf.outputKind === 'vout' ? 'Vout (V)' : 'Iout (A)'}</span>
            </div>
            {tf.warnings.length > 0 && (
              <div className="mt-2 text-[10px] text-amber-800">
                {tf.warnings.map((w, i) => (<div key={i}>⚠ {w.msg}</div>))}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 p-3">
            {tab === 'bode' && <BodePlot H={tf.H} />}
            {tab === 'phasor' && <PhasorPlot H={tf.H} freq={acFrequency} />}
            {tab === 'step' && <StepPlot H={tf.H} />}
            {tab === 'pz' && (
              <PoleZeroPlot
                H={tf.H}
                altH={altTF?.ok ? altTF.H : undefined}
                highlightLabel={acHighlightLabel(nodes, acHighlightId)}
                locusPoles={locusTrail}
              />
            )}
            {tab === 'power' && (
              <PowerTab H={tf.H} inputCurrent={tf.inputCurrentTF} inputKind={tf.inputKind!} freq={acFrequency} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Bode plot — magnitude (dB) + phase (deg) over a frequency sweep.
// Clickable: clicking anywhere on either subplot sets the global acFrequency,
// which in turn snaps the phasor view + the on-canvas annotations.
// =====================================================================
export function BodePlot({ H }: { H: import('../lib/analyze/poly').Rat }) {
  const acFrequency = useStore((s) => s.acFrequency);
  const setAcFrequency = useStore((s) => s.setAcFrequency);
  const data = useMemo(() => {
    const N = 200;
    const fMin = 0.1, fMax = 1e6;
    const log0 = Math.log10(fMin), log1 = Math.log10(fMax);
    const pts: { f: number; magDb: number; phaseDeg: number }[] = [];
    for (let i = 0; i < N; i++) {
      const f = Math.pow(10, log0 + (i / (N - 1)) * (log1 - log0));
      const w = 2 * Math.PI * f;
      const h = evalH(H, 0, w);
      const mag = Math.sqrt(h.re * h.re + h.im * h.im);
      const phase = (Math.atan2(h.im, h.re) * 180) / Math.PI;
      pts.push({ f, magDb: 20 * Math.log10(Math.max(mag, 1e-30)), phaseDeg: phase });
    }
    return pts;
  }, [H]);

  const W = 700, H_ = 110;
  const fMin = 0.1, fMax = 1e6;
  const xs = (f: number) => ((Math.log10(f) - Math.log10(fMin)) / (Math.log10(fMax) - Math.log10(fMin))) * (W - 40) + 35;
  const fFromXs = (x: number) => Math.pow(10, Math.log10(fMin) + ((x - 35) / (W - 40)) * (Math.log10(fMax) - Math.log10(fMin)));
  const minMag = Math.min(...data.map((d) => d.magDb));
  const maxMag = Math.max(...data.map((d) => d.magDb));
  const magRange = Math.max(1, maxMag - minMag);
  const ysMag = (db: number) => H_ - 5 - ((db - minMag) / magRange) * (H_ - 25);
  const ysPh = (deg: number) => H_ - 5 - ((deg + 180) / 360) * (H_ - 25);

  const magPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xs(d.f).toFixed(1)} ${ysMag(d.magDb).toFixed(1)}`).join(' ');
  const phPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xs(d.f).toFixed(1)} ${ysPh(d.phaseDeg).toFixed(1)}`).join(' ');

  const decadeTicks = [0.1, 1, 10, 100, 1e3, 1e4, 1e5, 1e6];

  // Cursor: current frequency snapped onto the plot.
  const cursorX = xs(Math.min(fMax, Math.max(fMin, acFrequency)));
  const cursorH = evalH(H, 0, 2 * Math.PI * acFrequency);
  const cursorMagDb = 20 * Math.log10(Math.max(Math.sqrt(cursorH.re * cursorH.re + cursorH.im * cursorH.im), 1e-30));
  const cursorPhase = (Math.atan2(cursorH.im, cursorH.re) * 180) / Math.PI;

  const onChartClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xRel = ((e.clientX - rect.left) / rect.width) * W;
    const f = fFromXs(xRel);
    if (Number.isFinite(f) && f > 0) setAcFrequency(f);
  };

  return (
    <div className="flex flex-col gap-2 h-full">
      <BodeSubplot
        title={`Magnitude   ${minMag.toFixed(0)} … ${maxMag.toFixed(0)} dB     ●  f = ${acFrequency.toPrecision(3)} Hz → ${cursorMagDb.toFixed(2)} dB`}
        W={W} H_={H_} path={magPath} xs={xs} ticks={decadeTicks}
        yTicks={[{ y: ysMag(maxMag), label: `${maxMag.toFixed(0)} dB` }, { y: ysMag(minMag), label: `${minMag.toFixed(0)} dB` }]}
        color="#1d4ed8"
        cursorX={cursorX}
        cursorY={ysMag(cursorMagDb)}
        onClick={onChartClick}
      />
      <BodeSubplot
        title={`Phase   −180° … +180°     ●  ${cursorPhase.toFixed(2)}°`}
        W={W} H_={H_} path={phPath} xs={xs} ticks={decadeTicks}
        yTicks={[{ y: ysPh(180), label: '180°' }, { y: ysPh(0), label: '0°' }, { y: ysPh(-180), label: '−180°' }]}
        color="#b45309"
        cursorX={cursorX}
        cursorY={ysPh(cursorPhase)}
        onClick={onChartClick}
      />
      <div className="text-[10px] text-slate-400 italic px-1">
        Click anywhere on the plot to snap the cursor — phasor + canvas annotations update to that frequency.
      </div>
    </div>
  );
}

function BodeSubplot({
  title, W, H_, path, xs, ticks, yTicks, color, cursorX, cursorY, onClick,
}: {
  title: string; W: number; H_: number; path: string;
  xs: (f: number) => number; ticks: number[];
  yTicks: { y: number; label: string }[]; color: string;
  cursorX?: number; cursorY?: number;
  onClick?: (e: React.MouseEvent<SVGSVGElement>) => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="text-[10px] text-slate-500 uppercase tracking-wider px-1">{title}</div>
      <svg
        viewBox={`0 0 ${W} ${H_}`}
        className="w-full h-auto border border-slate-200 rounded bg-slate-50 cursor-crosshair"
        onClick={onClick}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={xs(t)} x2={xs(t)} y1={5} y2={H_ - 5} stroke="#e2e8f0" strokeDasharray="2,2" />
            <text x={xs(t)} y={H_ - 1} fontSize="8" textAnchor="middle" fill="#94a3b8">{tickLabel(t)}</text>
          </g>
        ))}
        {yTicks.map((yt, i) => (
          <g key={i}>
            <line x1={35} x2={W - 5} y1={yt.y} y2={yt.y} stroke="#e2e8f0" strokeDasharray="2,2" />
            <text x={3} y={yt.y + 3} fontSize="8" fill="#94a3b8">{yt.label}</text>
          </g>
        ))}
        <path d={path} fill="none" stroke={color} strokeWidth="1.4" />
        {cursorX != null && (
          <g>
            <line x1={cursorX} x2={cursorX} y1={5} y2={H_ - 5} stroke="#fde047" strokeWidth="1.5" />
            {cursorY != null && <circle cx={cursorX} cy={cursorY} r={3.5} fill="#fde047" stroke="#0c1e5c" strokeWidth="1" />}
          </g>
        )}
      </svg>
    </div>
  );
}

function tickLabel(f: number): string {
  if (f >= 1e6) return '1M';
  if (f >= 1e3) return f / 1e3 + 'k';
  if (f >= 1) return String(f);
  return String(f);
}

// =====================================================================
// Phasor diagram — magnitude + angle of H(jω) at the chosen frequency,
// rendered as an arrow on a polar plot. (For SISO this is the output
// phasor for unit-magnitude input.)
// =====================================================================
export function PhasorPlot({ H, freq }: { H: import('../lib/analyze/poly').Rat; freq: number }) {
  const w = 2 * Math.PI * freq;
  const h = evalH(H, 0, w);
  const mag = Math.sqrt(h.re * h.re + h.im * h.im);
  const phase = Math.atan2(h.im, h.re);
  const phaseDeg = (phase * 180) / Math.PI;

  const W = 460, Hpx = 220;
  const cx = W / 2, cy = Hpx / 2;
  const R = Math.min(W, Hpx) / 2 - 20;
  // Use log-friendly normalization so phasor is always visible.
  const normMag = mag > 0 ? 1 : 0;
  const tipX = cx + R * normMag * Math.cos(phase);
  const tipY = cy - R * normMag * Math.sin(phase);

  return (
    <div className="flex h-full gap-4">
      <svg viewBox={`0 0 ${W} ${Hpx}`} className="h-full w-auto border border-slate-200 rounded bg-slate-50">
        {/* Axes */}
        <line x1={20} x2={W - 20} y1={cy} y2={cy} stroke="#cbd5e1" />
        <line x1={cx} x2={cx} y1={20} y2={Hpx - 20} stroke="#cbd5e1" />
        {/* Unit circle */}
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#e2e8f0" strokeDasharray="2,3" />
        {/* Phasor arrow */}
        <line x1={cx} y1={cy} x2={tipX} y2={tipY} stroke="#1d4ed8" strokeWidth="2.5" />
        <circle cx={tipX} cy={tipY} r={4} fill="#1d4ed8" />
        {/* Real / Imag labels */}
        <text x={W - 16} y={cy - 4} fontSize="9" fill="#64748b">Re</text>
        <text x={cx + 4} y={20} fontSize="9" fill="#64748b">Im</text>
      </svg>
      <div className="flex flex-col gap-2 justify-center text-xs text-slate-700 font-mono">
        <div>f = {freq} Hz · ω = {(w).toPrecision(4)} rad/s</div>
        <div>|H(jω)| = <span className="text-brand-900 font-semibold">{mag.toPrecision(4)}</span></div>
        <div>|H(jω)|_dB = <span className="text-brand-900 font-semibold">{(20 * Math.log10(Math.max(mag, 1e-30))).toFixed(2)} dB</span></div>
        <div>∠H(jω) = <span className="text-amber-700 font-semibold">{phaseDeg.toFixed(2)}°</span></div>
        <div>Re = {h.re.toPrecision(4)}, Im = {h.im.toPrecision(4)}</div>
      </div>
    </div>
  );
}

// =====================================================================
// Step response — y(t) for unit step input.
// =====================================================================
export function StepPlot({ H }: { H: import('../lib/analyze/poly').Rat }) {
  const T = useMemo(() => suggestT(H), [H]);
  const { t, y } = useMemo(() => stepResponse(H, T, 240), [H, T]);
  const yMin = Math.min(0, ...y);
  const yMax = Math.max(...y);
  const range = Math.max(1e-9, yMax - yMin);

  const W = 700, Hpx = 220;
  const xs = (ti: number) => 40 + (ti / T) * (W - 50);
  const ys = (yi: number) => Hpx - 25 - ((yi - yMin) / range) * (Hpx - 40);

  const path = t.map((ti, i) => `${i === 0 ? 'M' : 'L'} ${xs(ti).toFixed(1)} ${ys(y[i]).toFixed(1)}`).join(' ');
  // Final value (DC gain) line:
  const yFinal = y[y.length - 1];

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="text-[10px] text-slate-500 uppercase tracking-wider px-1">
        Step response · 0 ≤ t ≤ {T.toPrecision(3)} s · final ≈ {yFinal.toPrecision(3)}
      </div>
      <svg viewBox={`0 0 ${W} ${Hpx}`} className="w-full h-auto border border-slate-200 rounded bg-slate-50">
        {/* Zero line */}
        {yMin < 0 && yMax > 0 && (
          <line x1={40} x2={W - 5} y1={ys(0)} y2={ys(0)} stroke="#cbd5e1" />
        )}
        {/* Final-value asymptote */}
        <line x1={40} x2={W - 5} y1={ys(yFinal)} y2={ys(yFinal)} stroke="#e2e8f0" strokeDasharray="3,3" />
        <text x={3} y={ys(yMax) + 3} fontSize="8" fill="#94a3b8">{yMax.toPrecision(3)}</text>
        <text x={3} y={ys(yMin) + 3} fontSize="8" fill="#94a3b8">{yMin.toPrecision(3)}</text>
        <text x={W / 2} y={Hpx - 5} fontSize="8" textAnchor="middle" fill="#94a3b8">t (s)</text>
        <path d={path} fill="none" stroke="#1d4ed8" strokeWidth="1.6" />
      </svg>
    </div>
  );
}

// =====================================================================
// Power tab — Lab 10. P / Q / S triangle, power factor, phase angle.
// Assumes unit-amplitude sinusoidal input (Vrms = Irms = 1 in normalized units).
// =====================================================================
export function PowerTab({ H, inputCurrent, inputKind, freq }: {
  H: import('../lib/analyze/poly').Rat;
  inputCurrent?: import('../lib/analyze/poly').Rat;
  inputKind: 'vin' | 'iin';
  freq: number;
}) {
  const w = 2 * Math.PI * freq;
  const Hjw = evalH(H, 0, w);
  const Ijw = inputCurrent ? evalH(inputCurrent, 0, w) : { re: 0, im: 0 };

  // For a unit input, |V_in_rms| = 1 (Vin path). Source current is Ijw.
  // S = V · I*  →  P = Re(S),  Q = Im(S)
  // For Vin path: V = 1∠0°, I = Ijw → S = 1·conj(Ijw) = Re(Ijw) − j·Im(Ijw)
  //   ⇒ P = Re(Ijw), Q = -Im(Ijw)
  // For Iin path: I = 1∠0° at source, V = Hjw (V across input).
  let P: number, Q: number;
  if (inputKind === 'vin') {
    P = Ijw.re;
    Q = -Ijw.im;
  } else {
    // I = 1, V = output of the source (which our model returns as Hjw if Vout looks at it).
    // Simpler convention: treat as V·I* with V=Hjw, I=1.
    P = Hjw.re;
    Q = -Hjw.im;
  }
  const S = Math.sqrt(P * P + Q * Q);
  const pf = S > 1e-12 ? P / S : 1;
  const phi = (Math.atan2(Q, P) * 180) / Math.PI;
  const cap = Q < 0; // capacitive (current leads V) when Q < 0

  // Layout: triangle on left, numbers on right.
  const W = 360, Hpx = 200;
  const cx = 70, cy = Hpx - 40;
  const scale = Math.min((W - 100) / Math.max(Math.abs(P), 1e-9), (Hpx - 60) / Math.max(Math.abs(Q), 1e-9), 200);
  const x1 = cx + P * scale;
  const y1 = cy - Q * scale;
  const labelP = `P = ${P.toPrecision(3)} W`;
  const labelQ = `Q = ${Q.toPrecision(3)} VAR`;
  const labelS = `|S| = ${S.toPrecision(3)} VA`;

  return (
    <div className="flex h-full gap-4">
      <svg viewBox={`0 0 ${W} ${Hpx}`} className="h-full w-auto border border-slate-200 rounded bg-slate-50">
        <line x1={cx - 10} x2={W - 10} y1={cy} y2={cy} stroke="#cbd5e1" />
        <line x1={cx} x2={cx} y1={10} y2={cy + 10} stroke="#cbd5e1" />
        {/* Power triangle */}
        <line x1={cx} y1={cy} x2={x1} y2={cy} stroke="#1d4ed8" strokeWidth="2" />
        <line x1={x1} y1={cy} x2={x1} y2={y1} stroke="#b45309" strokeWidth="2" />
        <line x1={cx} y1={cy} x2={x1} y2={y1} stroke="#0c1e5c" strokeWidth="2" />
        <text x={(cx + x1) / 2} y={cy + 11} fontSize="9" fill="#1d4ed8" textAnchor="middle">P</text>
        <text x={x1 + 4} y={(cy + y1) / 2} fontSize="9" fill="#b45309">Q</text>
        <text x={(cx + x1) / 2 - 14} y={(cy + y1) / 2 - 4} fontSize="9" fill="#0c1e5c">S</text>
        <text x={W - 12} y={cy - 4} fontSize="8" fill="#64748b">P (W)</text>
        <text x={cx + 4} y={14} fontSize="8" fill="#64748b">Q (VAR)</text>
      </svg>
      <div className="flex flex-col gap-1.5 text-xs text-slate-700 font-mono justify-center">
        <div>f = {freq} Hz</div>
        <div className="text-brand-900">{labelP}</div>
        <div className="text-amber-700">{labelQ}</div>
        <div className="text-brand-950 font-semibold">{labelS}</div>
        <div className="border-t border-slate-200 my-1" />
        <div>Power factor: <span className="font-semibold">{pf.toFixed(3)}</span></div>
        <div>Phase angle φ: <span className="font-semibold">{phi.toFixed(2)}°</span></div>
        <div className="text-[10px] text-slate-500 italic mt-1">
          {Math.abs(Q) < 1e-9 ? 'purely resistive — unity PF' : cap ? 'capacitive load → current leads voltage' : 'inductive load → current lags voltage'}
        </div>
        <div className="text-[10px] text-slate-400 italic mt-1">
          Computed for unit-amplitude input; multiply by V_rms² to scale to real values.
        </div>
      </div>
    </div>
  );
}

export function acHighlightLabel(nodes: Node[], id: string | null): string | null {
  if (!id) return null;
  const n = nodes.find((m) => m.id === id);
  if (!n || n.type !== 'iec') return null;
  const d = n.data as { label?: string };
  return d.label ?? id;
}

// =====================================================================
// Pole-zero map. Highlights the pole(s) contributed by the currently-selected
// passive component (computed via remove-and-resolve diff).
// =====================================================================
export function PoleZeroPlot({ H, altH, highlightLabel, locusPoles }: {
  H: import('../lib/analyze/poly').Rat;
  altH?: import('../lib/analyze/poly').Rat;
  highlightLabel?: string | null;
  locusPoles?: CRoot[][];
}) {
  const zeros = useMemo(() => findRoots(H.n), [H]);
  const poles = useMemo(() => findRoots(H.d), [H]);
  const altPoles = useMemo(() => altH ? findRoots(altH.d) : null, [altH]);

  // Mark which original poles "belong to" the highlighted component.
  // With value-perturbation (×2) the topology is preserved, so pole count
  // matches. Compute per-pole shift; rank by relative shift; highlight any
  // pole that moved by ≥10 % of its magnitude (those are the ones most
  // sensitive to this component's value).
  const provenanceMask = useMemo(() => {
    if (!altPoles || altPoles.length === 0) return null;
    const { distFromAlt } = poleDiff(poles, altPoles);
    const mask = poles.map((p, i) => {
      const mag = Math.max(Math.hypot(p.re, p.im), 1);
      return distFromAlt[i] / mag >= 0.1;
    });
    // If none crossed the threshold, fall back to highlighting the single
    // most-affected pole (so the user always sees a marker).
    if (!mask.some(Boolean) && distFromAlt.length > 0) {
      const best = distFromAlt.indexOf(Math.max(...distFromAlt));
      mask[best] = true;
    }
    return mask;
  }, [poles, altPoles]);

  const all = [...zeros, ...poles, ...(locusPoles ?? []).flat()];
  const reMax = Math.max(1, ...all.map((r) => Math.abs(r.re)));
  const imMax = Math.max(1, ...all.map((r) => Math.abs(r.im)));
  const lim = Math.max(reMax, imMax) * 1.25;

  const W = 460, Hpx = 220;
  const cx = W / 2, cy = Hpx / 2;
  const xs = (re: number) => cx + (re / lim) * (W / 2 - 20);
  const ys = (im: number) => cy - (im / lim) * (Hpx / 2 - 20);

  return (
    <div className="flex h-full gap-4">
      <svg viewBox={`0 0 ${W} ${Hpx}`} className="h-full w-auto border border-slate-200 rounded bg-slate-50">
        {/* Axes */}
        <line x1={20} x2={W - 20} y1={cy} y2={cy} stroke="#cbd5e1" />
        <line x1={cx} x2={cx} y1={20} y2={Hpx - 20} stroke="#cbd5e1" />
        {/* Stability boundary (jω axis = cx vertical) shaded as right-half-plane (unstable). */}
        <rect x={cx} y={20} width={W - cx - 20} height={Hpx - 40} fill="#fef2f2" opacity={0.5} />
        <text x={cx + 4} y={Hpx - 25} fontSize="8" fill="#dc2626">unstable (RHP)</text>
        {/* Parameter trajectory locus: draw each pole's path through the swept values. */}
        {locusPoles && locusPoles.length > 1 && (() => {
          // Build one path per pole-index across the trail (assumes pole count stays constant).
          const n = locusPoles[0].length;
          const paths: string[] = [];
          for (let p = 0; p < n; p++) {
            const pts = locusPoles
              .filter((set) => set[p] != null)
              .map((set) => `${xs(set[p].re).toFixed(1)},${ys(set[p].im).toFixed(1)}`);
            if (pts.length > 1) paths.push(`M ${pts.join(' L ')}`);
          }
          return paths.map((d, i) => (
            <path key={'locus' + i} d={d} fill="none" stroke="#fde047" strokeWidth="1" opacity={0.7} />
          ));
        })()}
        {/* Plot zeros as circles, poles as ×. */}
        {zeros.map((z, i) => (
          <circle key={'z' + i} cx={xs(z.re)} cy={ys(z.im)} r={5} fill="none" stroke="#b45309" strokeWidth="1.5" />
        ))}
        {poles.map((p, i) => {
          const highlighted = provenanceMask?.[i];
          const color = highlighted ? '#0c1e5c' : '#1d4ed8';
          const sw = highlighted ? 2.2 : 1.5;
          return (
            <g key={'p' + i} stroke={color} strokeWidth={sw}>
              {highlighted && (
                <circle cx={xs(p.re)} cy={ys(p.im)} r={10} fill="none" stroke="#fde047" strokeWidth="2" />
              )}
              <line x1={xs(p.re) - 5} y1={ys(p.im) - 5} x2={xs(p.re) + 5} y2={ys(p.im) + 5} />
              <line x1={xs(p.re) + 5} y1={ys(p.im) - 5} x2={xs(p.re) - 5} y2={ys(p.im) + 5} />
            </g>
          );
        })}
        <text x={W - 16} y={cy - 4} fontSize="9" fill="#64748b">σ</text>
        <text x={cx + 4} y={20} fontSize="9" fill="#64748b">jω</text>
      </svg>
      <div className="flex flex-col gap-1 text-xs text-slate-700 font-mono justify-center min-w-0">
        {highlightLabel && (
          <div className="text-[11px] text-brand-950 font-sans bg-brand-gold-soft border border-brand-gold rounded px-2 py-1 mb-1">
            <span className="font-semibold">{highlightLabel}</span> selected — its pole(s) circled in gold.
          </div>
        )}
        <div className="text-[10px] uppercase tracking-wider text-amber-700 mt-1">Zeros</div>
        {zeros.length === 0 && <div className="text-slate-400 italic text-[11px]">none</div>}
        {zeros.map((z, i) => (
          <div key={i}>z{i + 1} = {z.re.toPrecision(3)} {z.im >= 0 ? '+' : '−'} {Math.abs(z.im).toPrecision(3)}j</div>
        ))}
        <div className="text-[10px] uppercase tracking-wider text-brand-900 mt-2">Poles</div>
        {poles.length === 0 && <div className="text-slate-400 italic text-[11px]">none</div>}
        {poles.map((p, i) => (
          <div key={i}>p{i + 1} = {p.re.toPrecision(3)} {p.im >= 0 ? '+' : '−'} {Math.abs(p.im).toPrecision(3)}j</div>
        ))}
      </div>
    </div>
  );
}

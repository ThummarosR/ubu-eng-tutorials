// Root-locus plot for v0.3 — sweeps K from 0 → K_max on `1 + K·H(s) = 0`,
// plots the resulting closed-loop pole trajectory. v0.3.1 adds the RLocusGui-
// style rule walkthrough: each textbook rule (Symmetry, Branches, Real-axis
// segments, Asymptotes, …) renders prose + overlay markers on the plot.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Rat } from '../lib/analyze/poly';
import { findRoots, CRoot } from '../lib/analyze/roots';
import { addP, scaleP } from '../lib/analyze/poly';
import { RLOCUS_RULES, type Overlay } from '../lib/blockdiagram/rlocus_rules';
import { FormattedStep } from './FormattedStep';

interface Props {
  /** Open-loop transfer function (G·H or just G for unity feedback). */
  H: Rat;
}

/** Compute closed-loop poles for `1 + K·H = 0` ↔ `d(s) + K·n(s) = 0`. */
function polesAtK(H: Rat, K: number): CRoot[] {
  // characteristic polynomial: H.d + K · H.n
  const charPoly = addP(H.d, scaleP(H.n, K));
  return findRoots(charPoly);
}

export function RootLocusPlot({ H }: Props) {
  const [kIndex, setKIndex] = useState(20); // 0..N-1 step on a log sweep
  const [ruleId, setRuleId] = useState<string>('info');
  const N = 50;
  const ruleResult = useMemo(() => {
    const rule = RLOCUS_RULES.find((r) => r.id === ruleId) ?? RLOCUS_RULES[0];
    return rule.compute(H);
  }, [H, ruleId]);

  // Log-spaced K sweep from 1e-3 to 1e3.
  const Ks = useMemo(() => {
    const arr: number[] = [0];
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      arr.push(Math.pow(10, -3 + t * 6));
    }
    return arr;
  }, [N]);

  // For each K, compute closed-loop poles.
  const trail = useMemo(() => Ks.map((K) => polesAtK(H, K)), [H, Ks]);

  // Plot range: encompass all roots + a bit of margin. Default to ±10 if empty.
  // This is the "auto-fit" extent the Reset button snaps back to.
  const fitView = useMemo(() => {
    const allPts = trail.flat();
    const reVals = allPts.map((p) => p.re);
    const imVals = allPts.map((p) => p.im);
    const minR = Math.min(-10, ...reVals);
    const maxR = Math.max(10, ...reVals);
    const minI = Math.min(-10, ...imVals);
    const maxI = Math.max(10, ...imVals);
    const padR = (maxR - minR) * 0.1;
    const padI = (maxI - minI) * 0.1;
    return {
      xMin: minR - padR, xMax: maxR + padR,
      yMin: minI - padI, yMax: maxI + padI,
    };
  }, [trail]);

  // User-controlled view (wheel-zoom + drag-pan). Initialised + reset to fitView.
  const [view, setView] = useState(fitView);
  useEffect(() => { setView(fitView); }, [fitView]);

  // Plot dimensions in SVG units. Container CSS controls actual on-screen size;
  // the viewBox lets the SVG fill that container while these units stay stable.
  const W = 800, Hpx = 560, PAD = 36;
  const xs = useCallback(
    (re: number) => PAD + ((re - view.xMin) / (view.xMax - view.xMin)) * (W - 2 * PAD),
    [view, W, PAD],
  );
  const ys = useCallback(
    (im: number) => Hpx - PAD - ((im - view.yMin) / (view.yMax - view.yMin)) * (Hpx - 2 * PAD),
    [view, Hpx, PAD],
  );
  const xMin = view.xMin, xMax = view.xMax, yMin = view.yMin, yMax = view.yMax;

  // Wheel-zoom (around cursor) + drag-pan handlers.
  const svgRef = useRef<SVGSVGElement>(null);
  const screenToData = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return { re: 0, im: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const sx = ((clientX - rect.left) / rect.width) * W;
    const sy = ((clientY - rect.top) / rect.height) * Hpx;
    const re = view.xMin + ((sx - PAD) / (W - 2 * PAD)) * (view.xMax - view.xMin);
    const im = view.yMin + ((Hpx - PAD - sy) / (Hpx - 2 * PAD)) * (view.yMax - view.yMin);
    return { re, im };
  }, [view, W, Hpx, PAD]);

  const onWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.2 : 1 / 1.2;
    const pivot = screenToData(e.clientX, e.clientY);
    setView((v) => ({
      xMin: pivot.re + (v.xMin - pivot.re) * factor,
      xMax: pivot.re + (v.xMax - pivot.re) * factor,
      yMin: pivot.im + (v.yMin - pivot.im) * factor,
      yMax: pivot.im + (v.yMax - pivot.im) * factor,
    }));
  }, [screenToData]);

  const dragStartRef = useRef<{ clientX: number; clientY: number; view: typeof view } | null>(null);
  const onPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    dragStartRef.current = { clientX: e.clientX, clientY: e.clientY, view };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, [view]);
  const onPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const start = dragStartRef.current;
    if (!start || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const dxData = ((e.clientX - start.clientX) / rect.width) * (start.view.xMax - start.view.xMin);
    const dyData = ((e.clientY - start.clientY) / rect.height) * (start.view.yMax - start.view.yMin);
    setView({
      xMin: start.view.xMin - dxData,
      xMax: start.view.xMax - dxData,
      yMin: start.view.yMin + dyData,
      yMax: start.view.yMax + dyData,
    });
  }, []);
  const onPointerUp = useCallback(() => { dragStartRef.current = null; }, []);

  const resetView = useCallback(() => setView(fitView), [fitView]);

  // Open-loop poles (at K=0) and zeros (start and end of locus).
  const olPoles = useMemo(() => findRoots(H.d), [H]);
  const olZeros = useMemo(() => findRoots(H.n), [H]);

  // Branches: track each open-loop pole's trajectory across K.
  // Crude tracking by nearest-neighbour matching.
  const branches = useMemo<CRoot[][]>(() => {
    if (trail.length === 0) return [];
    const M = trail[0].length;
    const out: CRoot[][] = Array.from({ length: M }, (_, i) => [trail[0][i]]);
    for (let k = 1; k < trail.length; k++) {
      const prev = out.map((br) => br[br.length - 1]);
      const used = new Array(trail[k].length).fill(false);
      for (let i = 0; i < M; i++) {
        let best = -1, bestD = Infinity;
        for (let j = 0; j < trail[k].length; j++) {
          if (used[j]) continue;
          const d = Math.hypot(prev[i].re - trail[k][j].re, prev[i].im - trail[k][j].im);
          if (d < bestD) { bestD = d; best = j; }
        }
        if (best >= 0) {
          used[best] = true;
          out[i].push(trail[k][best]);
        }
      }
    }
    return out;
  }, [trail]);

  // Cursor poles at current K.
  const curK = Ks[kIndex];
  const curPoles = trail[kIndex] ?? [];

  // Reduce K_max range for axis cleanliness (unused but kept for future): _.

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex items-center gap-3 text-[11px] text-slate-600">
        <span className="uppercase tracking-wider font-semibold text-slate-500">K =</span>
        <input
          type="range"
          min={0}
          max={Ks.length - 1}
          value={kIndex}
          onChange={(e) => setKIndex(parseInt(e.target.value, 10))}
          className="flex-1 accent-brand-900"
        />
        <span className="font-mono text-amber-700 w-16 text-right">
          {curK < 0.01 ? curK.toExponential(2) : curK < 1000 ? curK.toFixed(3) : curK.toExponential(2)}
        </span>
        <button
          onClick={resetView}
          title="Reset view to fit all data"
          className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-semibold text-slate-500 hover:text-brand-900 border border-slate-200 rounded hover:bg-slate-100"
        >
          Fit
        </button>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${Hpx}`}
        preserveAspectRatio="xMidYMid meet"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="w-full border border-slate-200 rounded bg-slate-50 cursor-grab active:cursor-grabbing select-none"
        style={{ height: 'min(70vh, 600px)', touchAction: 'none' }}
      >
        {/* Axes */}
        <line x1={xs(0)} y1={PAD} x2={xs(0)} y2={Hpx - PAD} stroke="#cbd5e1" strokeWidth="1"/>
        <line x1={PAD} y1={ys(0)} x2={W - PAD} y2={ys(0)} stroke="#cbd5e1" strokeWidth="1"/>
        {/* Axis labels */}
        <text x={W - PAD - 4} y={ys(0) - 4} fontSize="9" textAnchor="end" fill="#64748b">Re(s)</text>
        <text x={xs(0) + 4} y={PAD + 4} fontSize="9" textAnchor="start" fill="#64748b">Im(s)</text>
        {/* Locus branches */}
        {branches.map((br, i) => {
          const path = br.map((p, k) => `${k === 0 ? 'M' : 'L'} ${xs(p.re).toFixed(1)} ${ys(p.im).toFixed(1)}`).join(' ');
          return <path key={i} d={path} fill="none" stroke="#0c1e5c" strokeWidth="1.4" opacity="0.7"/>;
        })}
        {/* Open-loop poles (× markers) */}
        {olPoles.map((p, i) => (
          <g key={`p${i}`} transform={`translate(${xs(p.re)} ${ys(p.im)})`}>
            <line x1="-6" y1="-6" x2="6" y2="6" stroke="#dc2626" strokeWidth="2"/>
            <line x1="-6" y1="6" x2="6" y2="-6" stroke="#dc2626" strokeWidth="2"/>
          </g>
        ))}
        {/* Open-loop zeros (○ markers) */}
        {olZeros.map((z, i) => (
          <circle key={`z${i}`} cx={xs(z.re)} cy={ys(z.im)} r="6" fill="none" stroke="#059669" strokeWidth="2"/>
        ))}
        {/* Current closed-loop poles (filled gold dots) */}
        {curPoles.map((p, i) => (
          <circle key={`cur${i}`} cx={xs(p.re)} cy={ys(p.im)} r="4" fill="#fde047" stroke="#0c1e5c" strokeWidth="1.2"/>
        ))}
        {/* Rule overlays */}
        {renderOverlays(ruleResult.overlays, xs, ys, xMin, xMax, yMin, yMax)}
      </svg>
      <div className="text-[10px] text-slate-500 flex gap-3 px-1 flex-wrap">
        <span><span className="text-red-600 font-bold">×</span> open-loop poles</span>
        <span><span className="text-emerald-600">○</span> open-loop zeros</span>
        <span><span className="text-amber-400">●</span> closed-loop poles at K = {curK < 0.01 ? curK.toExponential(2) : curK.toFixed(3)}</span>
        <span className="ml-auto text-slate-400">scroll = zoom · drag = pan · Fit = reset</span>
      </div>

      {/* Rule walkthrough — RLocusGui-style: pick a rule, see prose + overlays */}
      <div className="mt-2 border-t border-slate-200 pt-2">
        <div className="flex items-center gap-1 flex-wrap mb-2">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mr-1">
            Rules:
          </span>
          {RLOCUS_RULES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRuleId(r.id)}
              className={
                'px-2 py-0.5 text-[10px] rounded-md transition-colors ' +
                (ruleId === r.id
                  ? 'bg-brand-950 text-brand-gold font-semibold'
                  : 'text-slate-600 bg-slate-100 hover:bg-slate-200')
              }
              title={r.nameTh}
            >
              {r.name}
            </button>
          ))}
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded p-2">
          <FormattedStep lines={ruleResult.description} className="!text-[11px]" />
        </div>
      </div>
    </div>
  );
}

function renderOverlays(
  overlays: Overlay[],
  xs: (re: number) => number,
  ys: (im: number) => number,
  xMin: number, xMax: number, yMin: number, yMax: number,
) {
  return overlays.map((o, i) => {
    if (o.kind === 'realSegment') {
      const from = Math.max(o.from, xMin);
      const to = Math.min(o.to, xMax);
      return (
        <line key={i}
          x1={xs(from)} y1={ys(0)}
          x2={xs(to)} y2={ys(0)}
          stroke={o.color ?? '#f59e0b'} strokeWidth="3" opacity="0.6"/>
      );
    }
    if (o.kind === 'asymptoteRay') {
      // Extend ray from (cx, cy) at angleDeg out to the bounding box.
      const ang = (o.angleDeg * Math.PI) / 180;
      const dx = Math.cos(ang), dy = Math.sin(ang);
      // Find parameter t such that we exit the box.
      const ts: number[] = [];
      if (dx !== 0) {
        ts.push((xMax - o.cx) / dx, (xMin - o.cx) / dx);
      }
      if (dy !== 0) {
        ts.push((yMax - o.cy) / dy, (yMin - o.cy) / dy);
      }
      const t = Math.max(0, Math.min(...ts.filter((v) => v > 0)));
      const ex = o.cx + dx * t, ey = o.cy + dy * t;
      return (
        <line key={i}
          x1={xs(o.cx)} y1={ys(o.cy)}
          x2={xs(ex)} y2={ys(ey)}
          stroke={o.color ?? '#0ea5e9'} strokeWidth="1.5"
          strokeDasharray="4 3" opacity="0.7"/>
      );
    }
    if (o.kind === 'centroid') {
      return (
        <g key={i}>
          <circle cx={xs(o.re)} cy={ys(0)} r="5" fill="none" stroke={o.color ?? '#0ea5e9'} strokeWidth="2"/>
          {o.label && <text x={xs(o.re) + 8} y={ys(0) + 4} fontSize="10" fill={o.color ?? '#0ea5e9'}>{o.label}</text>}
        </g>
      );
    }
    if (o.kind === 'point') {
      const shape = o.shape ?? 'dot';
      if (shape === 'cross') {
        return (
          <g key={i} transform={`translate(${xs(o.re)} ${ys(o.im)})`}>
            <line x1="-7" y1="-7" x2="7" y2="7" stroke={o.color ?? '#dc2626'} strokeWidth="2.5"/>
            <line x1="-7" y1="7" x2="7" y2="-7" stroke={o.color ?? '#dc2626'} strokeWidth="2.5"/>
            {o.label && <text x="10" y="4" fontSize="9" fill={o.color ?? '#dc2626'}>{o.label}</text>}
          </g>
        );
      }
      if (shape === 'circle') {
        return (
          <g key={i}>
            <circle cx={xs(o.re)} cy={ys(o.im)} r="7" fill="none" stroke={o.color ?? '#059669'} strokeWidth="2.5"/>
            {o.label && <text x={xs(o.re) + 10} y={ys(o.im) + 4} fontSize="9" fill={o.color ?? '#059669'}>{o.label}</text>}
          </g>
        );
      }
      return (
        <g key={i}>
          <circle cx={xs(o.re)} cy={ys(o.im)} r="4" fill={o.color ?? '#fde047'} stroke="#0c1e5c" strokeWidth="1"/>
          {o.label && <text x={xs(o.re) + 8} y={ys(o.im) + 4} fontSize="9" fill={o.color ?? '#0c1e5c'}>{o.label}</text>}
        </g>
      );
    }
    if (o.kind === 'imagCross') {
      return (
        <g key={i}>
          <circle cx={xs(0)} cy={ys(o.im)} r="4" fill="#a855f7" stroke="#0c1e5c" strokeWidth="1"/>
          {o.label && <text x={xs(0) + 8} y={ys(o.im) + 4} fontSize="9" fill="#a855f7">{o.label}</text>}
        </g>
      );
    }
    if (o.kind === 'annotation') {
      return (
        <text key={i} x={xs(o.re)} y={ys(o.im)} fontSize="10" fill={o.color ?? '#64748b'}>{o.text}</text>
      );
    }
    return null;
  });
}

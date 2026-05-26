// 3-phase analysis bench (Lab 11). Shows the phasor diagram (3 V's + 3 I's)
// plus a numerical results table. One-shot solve per (source, load) pair —
// no transfer function involved.

import { useMemo, useState } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { solveThreePhase, cAbs, cAngDeg, ThreePhaseResult, Cplx } from '../lib/analyze/threephase';

interface Props {
  nodes: Node[];
  edges: Edge[];
}

export function ThreePhaseBench({ nodes, edges }: Props) {
  void edges; // edges aren't needed (compound components carry all data)
  const result: ThreePhaseResult = useMemo(() => solveThreePhase(nodes), [nodes]);
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <div className="h-7 shrink-0 border-t border-slate-200 bg-white flex items-center px-3 gap-2">
        <button
          onClick={() => setCollapsed(false)}
          className="text-xs text-brand-900 hover:text-brand-950 font-medium"
        >
          ▴ Show 3-phase bench
        </button>
        <div className="text-[11px] text-slate-500">
          {result.ok ? `${result.topology} · f = ${result.freqHz} Hz` : (result.error ?? '…')}
        </div>
      </div>
    );
  }

  return (
    <div className="h-64 shrink-0 border-t border-slate-200 bg-white flex flex-col">
      <header className="h-9 shrink-0 border-b border-slate-200 bg-gradient-to-r from-brand-50 to-white flex items-center pl-3 pr-2 gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-950 flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-gold ring-2 ring-brand-gold/30" />
          3-Phase Analysis (Lab 11)
        </div>
        {result.ok && (
          <div className="text-[11px] text-slate-600 ml-2">
            {result.topology} · f = {result.freqHz} Hz
          </div>
        )}
        <div className="flex-1" />
        <button
          onClick={() => setCollapsed(true)}
          title="Hide bench"
          className="text-slate-400 hover:text-brand-900 text-base leading-none px-2"
        >▾</button>
      </header>

      {!result.ok && (
        <div className="flex-1 flex items-center justify-center text-sm text-slate-500 italic px-6 text-center">
          {result.error}
        </div>
      )}

      {result.ok && (
        <div className="flex-1 min-h-0 flex">
          {/* Phasor diagram */}
          <div className="w-80 shrink-0 border-r border-slate-200 p-2">
            <ThreePhasePhasor result={result} />
          </div>
          {/* Numerical table */}
          <div className="flex-1 p-3 overflow-auto">
            <ThreePhaseTable result={result} />
          </div>
          {/* Power summary */}
          <div className="w-56 shrink-0 border-l border-slate-200 p-3 bg-slate-50 overflow-auto">
            <ThreePhasePower result={result} />
          </div>
        </div>
      )}
    </div>
  );
}

export function ThreePhasePhasor({ result }: { result: ThreePhaseResult }) {
  const Va = result.Va!, Vb = result.Vb!, Vc = result.Vc!;
  const Ia = result.Ia!, Ib = result.Ib!, Ic = result.Ic!;
  const Vmax = Math.max(cAbs(Va), cAbs(Vb), cAbs(Vc));
  const Imax = Math.max(cAbs(Ia), cAbs(Ib), cAbs(Ic), 1e-9);
  const W = 280, H = 200;
  const cx = W / 2, cy = H / 2;
  const Rv = Math.min(W, H) / 2 - 22;
  const Ri = Rv * 0.85; // smaller circle for currents

  const drawV = (p: Cplx, color: string, label: string) => {
    const mag = cAbs(p) / Vmax;
    const tx = cx + Rv * mag * Math.cos(Math.atan2(p.im, p.re));
    const ty = cy - Rv * mag * Math.sin(Math.atan2(p.im, p.re));
    return (
      <g>
        <line x1={cx} y1={cy} x2={tx} y2={ty} stroke={color} strokeWidth="2"/>
        <text x={tx + 4} y={ty - 2} fontSize="9" fill={color}>{label}</text>
      </g>
    );
  };
  const drawI = (p: Cplx, color: string, label: string) => {
    const mag = cAbs(p) / Imax;
    const tx = cx + Ri * mag * Math.cos(Math.atan2(p.im, p.re));
    const ty = cy - Ri * mag * Math.sin(Math.atan2(p.im, p.re));
    return (
      <g>
        <line x1={cx} y1={cy} x2={tx} y2={ty} stroke={color} strokeWidth="1.5" strokeDasharray="3,2"/>
        <text x={tx + 4} y={ty - 2} fontSize="9" fill={color}>{label}</text>
      </g>
    );
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto border border-slate-200 rounded bg-slate-50">
      <line x1={cx - Rv} x2={cx + Rv} y1={cy} y2={cy} stroke="#cbd5e1"/>
      <line x1={cx} x2={cx} y1={cy - Rv} y2={cy + Rv} stroke="#cbd5e1"/>
      <circle cx={cx} cy={cy} r={Rv} fill="none" stroke="#e2e8f0" strokeDasharray="2,3"/>
      {drawV(Va, '#dc2626', 'Va')}
      {drawV(Vb, '#16a34a', 'Vb')}
      {drawV(Vc, '#1d4ed8', 'Vc')}
      {drawI(Ia, '#fca5a5', 'Ia')}
      {drawI(Ib, '#86efac', 'Ib')}
      {drawI(Ic, '#93c5fd', 'Ic')}
      <text x={4} y={H - 4} fontSize="9" fill="#64748b">solid = V (line-to-neutral), dashed = I (line)</text>
    </svg>
  );
}

function fmtC(p: Cplx, unit: string): string {
  return `${cAbs(p).toPrecision(4)} ${unit} ∠${cAngDeg(p).toFixed(2)}°`;
}

export function ThreePhaseTable({ result }: { result: ThreePhaseResult }) {
  const Zs = result.Zphases!;
  const fmtZ = (Z: Cplx) => `${Z.re.toPrecision(3)} + j${Z.im.toPrecision(3)} Ω  (|Z| = ${Math.sqrt(Z.re*Z.re + Z.im*Z.im).toPrecision(3)} Ω ∠${cAngDeg(Z).toFixed(2)}°)`;
  return (
    <div className="text-[11px] font-mono leading-relaxed">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Phase voltages (line-to-neutral)</div>
      <div className="text-red-600">Va = {fmtC(result.Va!, 'V')}</div>
      <div className="text-green-700">Vb = {fmtC(result.Vb!, 'V')}</div>
      <div className="text-blue-700">Vc = {fmtC(result.Vc!, 'V')}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mt-2 mb-1">Line voltages</div>
      <div>Vab = {fmtC(result.Vab!, 'V')}</div>
      <div>Vbc = {fmtC(result.Vbc!, 'V')}</div>
      <div>Vca = {fmtC(result.Vca!, 'V')}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mt-2 mb-1">Line currents</div>
      <div className="text-red-600">Ia = {fmtC(result.Ia!, 'A')}</div>
      <div className="text-green-700">Ib = {fmtC(result.Ib!, 'A')}</div>
      <div className="text-blue-700">Ic = {fmtC(result.Ic!, 'A')}</div>
      <div className="mt-1">In = {fmtC(result.In!, 'A')} <span className="text-slate-400">{cAbs(result.In!) < 1e-6 ? '(balanced → 0)' : '(unbalanced)'}</span></div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mt-2 mb-1">Per-phase impedance</div>
      {result.balanced ? (
        <div>Z = {fmtZ(Zs[0])}</div>
      ) : (
        <>
          <div className="text-red-600">Za = {fmtZ(Zs[0])}</div>
          <div className="text-green-700">Zb = {fmtZ(Zs[1])}</div>
          <div className="text-blue-700">Zc = {fmtZ(Zs[2])}</div>
        </>
      )}
    </div>
  );
}

export function ThreePhasePower({ result }: { result: ThreePhaseResult }) {
  return (
    <div className="text-[11px] font-mono leading-relaxed">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Per-phase power</div>
      <div>Pa = {result.Pa!.toPrecision(4)} W</div>
      <div>Pb = {result.Pb!.toPrecision(4)} W</div>
      <div>Pc = {result.Pc!.toPrecision(4)} W</div>
      <div className="border-t border-slate-200 mt-2 pt-2">
        <div className="text-brand-900 font-semibold">P_total = {result.Ptot!.toPrecision(4)} W</div>
        <div className="text-amber-700">Q_total = {result.Qtot!.toPrecision(4)} VAR</div>
        <div className="text-brand-950 font-semibold">|S|_total = {result.Stot!.toPrecision(4)} VA</div>
      </div>
      <div className="border-t border-slate-200 mt-2 pt-2">
        <div>PF = <span className="font-semibold">{result.PF!.toFixed(4)}</span></div>
        <div>φ = <span className="font-semibold">{result.phi!.toFixed(2)}°</span></div>
        <div className="text-[10px] text-slate-500 italic mt-1">
          {result.phi! > 1 ? 'lagging (inductive)' : result.phi! < -1 ? 'leading (capacitive)' : 'unity PF (resistive)'}
        </div>
      </div>
    </div>
  );
}

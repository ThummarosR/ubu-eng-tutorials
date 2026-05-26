// Combined analysis panel for all three domains (DC / AC / 3φ).
// Three size states: collapsed (28 px strip) · normal (drag-resizable, default 384 px)
// · fullscreen (overlays the canvas — for studying plots without distraction).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { CircuitGraph } from '../lib/analyze/graph';
import type { SolveResult } from '../lib/analyze/solver';
import { METHODS } from '../lib/analyze/methods';
import { buildTF, TFResult } from '../lib/analyze/laplace';
import { findRoots, CRoot } from '../lib/analyze/roots';
import { fmtPoly } from '../lib/analyze/poly';
import { scaleValueStr } from '../lib/analyze/units';
import { solveThreePhase, ThreePhaseResult } from '../lib/analyze/threephase';
import { useStore } from '../store';
import { FormattedStep } from './FormattedStep';
import {
  BodePlot, PhasorPlot, StepPlot, PoleZeroPlot, PowerTab, acHighlightLabel,
} from './AnalysisBench';
import {
  ThreePhasePhasor, ThreePhaseTable, ThreePhasePower,
} from './ThreePhaseBench';

interface Props {
  graph: CircuitGraph;
  solve: SolveResult;
  nodes: Node[];
  edges: Edge[];
}

type Size = 'collapsed' | 'normal' | 'fullscreen';
type DcTab = 'walkthrough' | 'nodes';
type AcTab = 'bode' | 'phasor' | 'step' | 'pz' | 'power' | 'hs';
type TpTab = 'phasor' | 'table' | 'power';

const AC_TABS: { id: AcTab; label: string }[] = [
  { id: 'bode', label: 'Bode' },
  { id: 'phasor', label: 'Phasor' },
  { id: 'step', label: 'Step' },
  { id: 'pz', label: 'Pole-Zero' },
  { id: 'power', label: 'Power' },
  { id: 'hs', label: 'H(s)' },
];

const TP_TABS: { id: TpTab; label: string }[] = [
  { id: 'phasor', label: 'Phasor' },
  { id: 'table', label: 'Numbers' },
  { id: 'power', label: 'Power' },
];

const WIDTH_KEY = 'eeubudraw:analysisPanelWidth';
const WIDTH_DEFAULT = 384;
const WIDTH_MIN = 280;
const WIDTH_MAX_FRAC = 0.85; // never push the canvas below 15 % of viewport

function loadInitialWidth(): number {
  if (typeof window === 'undefined') return WIDTH_DEFAULT;
  const v = parseFloat(window.localStorage.getItem(WIDTH_KEY) ?? '');
  if (!Number.isFinite(v)) return WIDTH_DEFAULT;
  return Math.max(WIDTH_MIN, Math.min(window.innerWidth * WIDTH_MAX_FRAC, v));
}

/**
 * Serialise every SVG inside a container, stack them vertically on a canvas,
 * and trigger a PNG download. Rendered at 2× DPI for crisp lab-report inserts.
 * Inline-styled SVGs only — no external CSS is applied during raster.
 */
async function exportChartsAsPng(container: HTMLElement, filename: string) {
  const svgs = Array.from(container.querySelectorAll('svg')) as SVGElement[];
  if (svgs.length === 0) return;
  const items = svgs.map((svg) => {
    const rect = svg.getBoundingClientRect();
    return { svg, w: Math.max(1, rect.width), h: Math.max(1, rect.height) };
  });
  const PAD = 16;
  const maxW = Math.max(...items.map((i) => i.w));
  const totalH = items.reduce((s, i) => s + i.h, 0) + PAD * (items.length - 1);

  const dpr = 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(maxW * dpr);
  canvas.height = Math.ceil(totalH * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, maxW, totalH);

  let y = 0;
  for (const item of items) {
    let xml = new XMLSerializer().serializeToString(item.svg);
    if (!xml.includes('xmlns="http://www.w3.org/2000/svg"')) {
      xml = xml.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    await new Promise<void>((res, rej) => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, y, item.w, item.h);
        URL.revokeObjectURL(url);
        res();
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('SVG render failed')); };
      img.src = url;
    });
    y += item.h + PAD;
  }

  canvas.toBlob((blob) => {
    if (!blob) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }, 'image/png');
}

export function AnalysisPanel({ graph, solve, nodes, edges }: Props) {
  const showCanvasAnalysis = useStore((s) => s.showCanvasAnalysis);
  const setShowCanvasAnalysis = useStore((s) => s.setShowCanvasAnalysis);
  const analysisDomain = useStore((s) => s.analysisDomain);
  const setAnalysisDomain = useStore((s) => s.setAnalysisDomain);
  const examplePrompts = useStore((s) => s.examplePrompts);
  const setExamplePrompts = useStore((s) => s.setExamplePrompts);
  const acFrequency = useStore((s) => s.acFrequency);
  const setAcFrequency = useStore((s) => s.setAcFrequency);
  const acHighlightId = useStore((s) => s.acHighlightId);

  const [size, setSize] = useState<Size>('normal');
  const [width, setWidth] = useState<number>(loadInitialWidth);
  const [dcTab, setDcTab] = useState<DcTab>('walkthrough');
  const [acTab, setAcTab] = useState<AcTab>('bode');
  const [tpTab, setTpTab] = useState<TpTab>('phasor');
  const [methodId, setMethodId] = useState<string>('vdiv');
  const [showStyleB, setShowStyleB] = useState(false);

  // Refs to the chart-tab containers (used by export).
  const acBodyRef = useRef<HTMLDivElement>(null);
  const tpBodyRef = useRef<HTMLDivElement>(null);

  // Esc exits fullscreen.
  useEffect(() => {
    if (size !== 'fullscreen') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSize('normal');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [size]);

  // Persist drag-resize width to localStorage. Clamp to viewport on every
  // window resize so the panel stays visible after the browser shrinks.
  useEffect(() => {
    window.localStorage.setItem(WIDTH_KEY, String(width));
  }, [width]);
  useEffect(() => {
    const onResize = () => {
      const max = window.innerWidth * WIDTH_MAX_FRAC;
      setWidth((w) => Math.min(max, w));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Left-edge drag handle: track pointer, update width on move.
  const onResizeStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    const onMove = (ev: PointerEvent) => {
      const max = window.innerWidth * WIDTH_MAX_FRAC;
      const next = Math.max(WIDTH_MIN, Math.min(max, startW + (startX - ev.clientX)));
      setWidth(next);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [width]);

  // Export-PNG handler: routes to the right tab body ref + filename.
  const onExport = useCallback(() => {
    if (analysisDomain === 'ac' && acBodyRef.current) {
      exportChartsAsPng(acBodyRef.current, `eeubudraw-ac-${acTab}.png`);
    } else if (analysisDomain === '3p' && tpBodyRef.current) {
      exportChartsAsPng(tpBodyRef.current, `eeubudraw-3p-${tpTab}.png`);
    }
  }, [analysisDomain, acTab, tpTab]);

  const exportAvailable =
    (analysisDomain === 'ac' && acTab !== 'hs') ||
    (analysisDomain === '3p' && tpTab === 'phasor');

  // DC: build method analyses (always — used by DC walkthrough tab).
  const analyses = useMemo(
    () => new Map(METHODS.map((m) => [m.id, m.analyze(graph, solve)])),
    [graph, solve],
  );
  const currentMethod = METHODS.find((m) => m.id === methodId)!;
  const currentResult = analyses.get(methodId)!;

  // AC: build TF only when AC is the active domain (perf).
  const tf: TFResult | null = useMemo(
    () => (analysisDomain === 'ac' ? buildTF(nodes, edges) : null),
    [analysisDomain, nodes, edges],
  );

  // PZ extras: alt-TF for 2× scale of the highlighted component, plus locus trail.
  const altTF = useMemo(() => {
    if (analysisDomain !== 'ac' || !acHighlightId) return null;
    const altNodes = nodes.map((n) => {
      if (n.id !== acHighlightId || n.type !== 'iec') return n;
      const data = n.data as { value?: string };
      const scaled = data.value ? scaleValueStr(data.value, 2) : null;
      if (!scaled) return n;
      return { ...n, data: { ...n.data, value: scaled } };
    });
    return buildTF(altNodes, edges);
  }, [analysisDomain, acHighlightId, nodes, edges]);

  const locusTrail = useMemo<CRoot[][] | undefined>(() => {
    if (analysisDomain !== 'ac' || !acHighlightId || !tf?.ok || !tf.H) return undefined;
    const N = 24;
    const trail: CRoot[][] = [];
    for (let i = 0; i < N; i++) {
      const factor = Math.pow(10, (i / (N - 1)) * 2 - 1);
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
  }, [analysisDomain, acHighlightId, nodes, edges, tf]);

  // 3φ: solve only when active.
  const tpResult: ThreePhaseResult | null = useMemo(
    () => (analysisDomain === '3p' ? solveThreePhase(nodes) : null),
    [analysisDomain, nodes],
  );

  if (size === 'collapsed') {
    return (
      <aside className="w-7 shrink-0 border-l border-slate-200 bg-white flex flex-col">
        <button
          onClick={() => setSize('normal')}
          title="Show circuit analysis"
          className="w-full py-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 text-sm"
        >
          ‹
        </button>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[10px] text-slate-400 -rotate-90 whitespace-nowrap select-none">
            Circuit analysis
          </span>
        </div>
      </aside>
    );
  }

  const isFs = size === 'fullscreen';
  const wrapperClass = isFs
    ? 'fixed inset-x-0 top-12 bottom-0 z-30 bg-white flex flex-col shadow-2xl'
    : 'shrink-0 border-l border-slate-200 bg-white flex flex-col overflow-hidden relative';

  return (
    <aside
      className={wrapperClass}
      style={isFs ? undefined : { width: `${width}px` }}
    >
      {!isFs && (
        <div
          onPointerDown={onResizeStart}
          className="absolute left-0 top-0 bottom-0 w-1.5 -ml-0.5 cursor-col-resize hover:bg-brand-gold/40 transition-colors z-10"
          title="Drag to resize"
        />
      )}
      {/* ─── Header ───────────────────────────────────────────────── */}
      <header className="px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-brand-50 to-white shrink-0">
        <div className="flex justify-between items-start gap-2">
          <div>
            <div className="text-sm font-semibold text-brand-950 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-gold ring-2 ring-brand-gold/30" />
              Circuit analysis
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {analysisDomain === 'dc' && 'DC mode · เลือกวิธี solve เพื่อดู worked example'}
              {analysisDomain === 'ac' && 'AC / Laplace · ดู H(s) และ frequency response'}
              {analysisDomain === '3p' && '3-phase (Lab 11) · โหลด Y / Δ แบบ balanced'}
            </div>
          </div>
          <div className="flex items-center gap-0.5 text-slate-400">
            {exportAvailable && (
              <button
                onClick={onExport}
                title="Export current chart as PNG"
                className="hover:text-brand-900 px-1.5 py-0.5 rounded hover:bg-slate-100 text-base leading-none"
              >
                ⬇
              </button>
            )}
            <button
              onClick={() => setSize(size === 'fullscreen' ? 'normal' : 'fullscreen')}
              title={size === 'fullscreen' ? 'Exit fullscreen (Esc)' : 'Fullscreen (covers canvas)'}
              className="hover:text-brand-900 px-1.5 py-0.5 rounded hover:bg-slate-100"
            >
              {size === 'fullscreen' ? '⤡' : '⤢'}
            </button>
            <button
              onClick={() => setSize('collapsed')}
              title="Hide panel"
              className="hover:text-brand-900 px-1.5 py-0.5 rounded hover:bg-slate-100"
            >
              ›
            </button>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <div className="flex items-center rounded-md overflow-hidden ring-1 ring-brand-100 bg-white text-[11px]">
            {(['dc', 'ac', '3p'] as const).map((d, i) => (
              <button
                key={d}
                onClick={() => setAnalysisDomain(d)}
                className={
                  'px-2.5 py-0.5 transition-colors ' +
                  (i > 0 ? 'border-l border-brand-100 ' : '') +
                  (analysisDomain === d
                    ? 'bg-brand-950 text-brand-gold font-medium'
                    : 'text-brand-900 hover:bg-brand-50')
                }
              >
                {d === 'dc' ? 'DC' : d === 'ac' ? 'AC' : '3φ'}
              </button>
            ))}
          </div>
          <label
            className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer select-none"
            title="Toggle I / V labels on each component in the canvas"
          >
            <input
              type="checkbox"
              checked={showCanvasAnalysis}
              onChange={(e) => setShowCanvasAnalysis(e.target.checked)}
              className="accent-brand-900 w-3.5 h-3.5"
            />
            Show on diagram
          </label>
        </div>
      </header>

      {examplePrompts.length > 0 && (
        <div className="px-3 py-2 bg-brand-gold-soft border-b border-amber-200 shrink-0">
          <div className="flex items-center justify-between mb-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-800">
              ลองเล่นดู
            </div>
            <button
              onClick={() => setExamplePrompts([])}
              className="text-[10px] text-amber-700 hover:text-amber-900"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
          <ul className="text-[11px] text-amber-900 leading-snug space-y-1">
            {examplePrompts.map((p, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="text-amber-600">{i + 1}.</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ─── Body ────────────────────────────────────────────────── */}
      {analysisDomain === 'dc' && (
        <DcBody
          graph={graph}
          solve={solve}
          tab={dcTab}
          setTab={setDcTab}
          methodId={methodId}
          setMethodId={setMethodId}
          currentMethod={currentMethod}
          currentResult={currentResult}
          analyses={analyses}
          showStyleB={showStyleB}
          setShowStyleB={setShowStyleB}
        />
      )}

      {analysisDomain === 'ac' && (
        <AcBody
          tf={tf}
          tab={acTab}
          setTab={setAcTab}
          acFrequency={acFrequency}
          setAcFrequency={setAcFrequency}
          altTF={altTF}
          locusTrail={locusTrail}
          highlightLabel={acHighlightLabel(nodes, acHighlightId)}
          bodyRef={acBodyRef}
        />
      )}

      {analysisDomain === '3p' && (
        <TpBody
          result={tpResult}
          tab={tpTab}
          setTab={setTpTab}
          isWide={size === 'fullscreen'}
          bodyRef={tpBodyRef}
        />
      )}
    </aside>
  );
}

// ─── DC body ────────────────────────────────────────────────────
function DcBody({
  graph,
  solve,
  tab,
  setTab,
  methodId,
  setMethodId,
  currentMethod,
  currentResult,
  analyses,
  showStyleB,
  setShowStyleB,
}: {
  graph: CircuitGraph;
  solve: SolveResult;
  tab: DcTab;
  setTab: (t: DcTab) => void;
  methodId: string;
  setMethodId: (id: string) => void;
  currentMethod: typeof METHODS[number];
  currentResult: ReturnType<typeof METHODS[number]['analyze']>;
  analyses: Map<string, ReturnType<typeof METHODS[number]['analyze']>>;
  showStyleB: boolean;
  setShowStyleB: (fn: (s: boolean) => boolean) => void;
}) {
  return (
    <>
      <SubTabRow
        tabs={[
          { id: 'walkthrough', label: 'Walkthrough' },
          { id: 'nodes', label: 'Node voltages' },
        ]}
        active={tab}
        onChange={(id) => setTab(id as DcTab)}
      />

      {graph.warnings.length > 0 && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 shrink-0">
          {graph.warnings.map((w, i) => (
            <div key={i} className="text-xs text-amber-800 leading-snug">⚠ {w}</div>
          ))}
        </div>
      )}

      {!solve.ok && solve.error && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-xs text-red-800 leading-snug shrink-0">
          ✗ {solve.error}
        </div>
      )}

      {tab === 'walkthrough' && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-3 py-2 border-b border-slate-200">
            <label htmlFor="method-select" className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block px-1">
              เลือกวิธี solve
            </label>
            <select
              id="method-select"
              value={methodId}
              onChange={(e) => setMethodId(e.target.value)}
              className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm bg-white hover:bg-slate-50 focus:outline-none focus:border-slate-400"
            >
              {METHODS.map((m) => {
                const r = analyses.get(m.id)!;
                const enabled = m.implemented && r.applicable;
                const suffix = !m.implemented
                  ? '  — coming in v2'
                  : !r.applicable
                    ? '  — ใช้ไม่ได้กับวงจรนี้'
                    : '';
                return (
                  <option key={m.id} value={m.id} disabled={!enabled}>
                    {m.name} ({m.nameTh}){suffix}
                  </option>
                );
              })}
            </select>
            <div className="text-[11px] text-slate-500 mt-1 px-1">{currentMethod.blurb}</div>
            {!currentResult.applicable && currentResult.reason && (
              <div className="text-[11px] text-amber-700 mt-1 px-1 italic">
                ⚠ {currentResult.reason}
              </div>
            )}
          </div>

          <div className="px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
              {currentMethod.name} — ตัวอย่างการคำนวณ
            </div>
            {currentResult.applicable && currentResult.styleA.length > 0 ? (
              <>
                <FormattedStep lines={currentResult.styleA} />
                {currentResult.answer && (
                  <div className="mt-3 px-3 py-2 bg-brand-950 text-brand-gold rounded-md text-sm font-medium font-mono shadow-sm">
                    = {currentResult.answer}
                  </div>
                )}
                {currentResult.styleB.length > 0 && (
                  <div className="mt-4 border-t border-slate-200 pt-3">
                    <button
                      onClick={() => setShowStyleB((s) => !s)}
                      className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-800 flex items-center gap-1"
                    >
                      <span>{showStyleB ? '▾' : '▸'}</span>
                      <span>ที่มาจากหลักการพื้นฐาน (KVL / KCL)</span>
                    </button>
                    {showStyleB && (
                      <FormattedStep
                        lines={currentResult.styleB}
                        className="mt-2 pl-3 border-l-2 border-slate-200"
                      />
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-slate-500 italic">
                {currentResult.reason ?? 'วาดวงจรและเลือกวิธี solve เพื่อดูตัวอย่างการคำนวณ'}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'nodes' && (
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Node voltages (solved by MNA)
          </div>
          {solve.ok && solve.nodeVoltages.length > 1 ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] font-mono text-slate-700">
              {solve.nodeVoltages.map((v, i) => (
                <div key={i} className="px-2 py-1 bg-slate-50 rounded border border-slate-100">
                  V<sub>{i}</sub> = {i === 0 ? <span className="text-slate-400">0 V (gnd)</span> : <span className="text-blue-700 font-semibold">{v.toFixed(3)} V</span>}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-500 italic">
              ต้องมี ground reference ในวงจรก่อนถึงจะแสดง node voltages
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ─── AC body ────────────────────────────────────────────────────
function AcBody({
  tf,
  tab,
  setTab,
  acFrequency,
  setAcFrequency,
  altTF,
  locusTrail,
  highlightLabel,
  bodyRef,
}: {
  tf: TFResult | null;
  tab: AcTab;
  setTab: (t: AcTab) => void;
  acFrequency: number;
  setAcFrequency: (f: number) => void;
  altTF: TFResult | null;
  locusTrail: CRoot[][] | undefined;
  highlightLabel: string | null;
  bodyRef: React.RefObject<HTMLDivElement>;
}) {
  if (!tf) return null;
  return (
    <>
      <SubTabRow
        tabs={AC_TABS}
        active={tab}
        onChange={(id) => setTab(id as AcTab)}
        right={
          <label className="flex items-center gap-1 text-[11px] text-slate-600">
            <span className="uppercase tracking-wider">f</span>
            <input
              type="number"
              value={acFrequency}
              min={0.001}
              step={10}
              onChange={(e) => setAcFrequency(parseFloat(e.target.value) || 1)}
              className="w-20 border border-slate-200 rounded px-1.5 py-0.5 text-xs"
            />
            <span className="text-cyan-700">Hz</span>
          </label>
        }
      />

      {!tf.ok && (
        <div className="flex-1 flex flex-col items-center justify-center text-sm text-slate-500 italic px-6 text-center gap-2">
          <div>{tf.error}</div>
          <div className="text-[11px] text-slate-400 not-italic">
            ต้องมี Vin/Iin, Vout/Iout และ ground ในวงจร — ลาก marker จาก palette มาวาง
          </div>
        </div>
      )}

      {tf.ok && tf.H && (
        <>
          <AcHealthHints H={tf.H} />
          <div ref={bodyRef} className="flex-1 min-h-0 p-3 overflow-y-auto">
            {tab === 'bode' && <BodePlot H={tf.H} />}
            {tab === 'phasor' && <PhasorPlot H={tf.H} freq={acFrequency} />}
            {tab === 'step' && <StepPlot H={tf.H} />}
            {tab === 'pz' && (
              <PoleZeroPlot
                H={tf.H}
                altH={altTF?.ok ? altTF.H : undefined}
                highlightLabel={highlightLabel}
                locusPoles={locusTrail}
              />
            )}
            {tab === 'power' && (
              <PowerTab H={tf.H} inputCurrent={tf.inputCurrentTF} inputKind={tf.inputKind!} freq={acFrequency} />
            )}
            {tab === 'hs' && <HsPanel tf={tf} />}
          </div>
        </>
      )}
    </>
  );
}

function AcHealthHints({ H }: { H: import('../lib/analyze/poly').Rat }) {
  const allPoles = findRoots(H.d);
  const unstable = allPoles.some((p) => p.re > 1e-6);
  const dcGain = (() => {
    const num = H.n[0] ?? 0;
    const den = H.d[0] ?? 0;
    return den !== 0 ? num / den : Infinity;
  })();
  const blocksDC =
    Math.abs(dcGain) < 1e-9 && (H.n[0] === 0 || Math.abs(H.n[0] ?? 0) < 1e-12);
  const hints: string[] = [];
  if (unstable) hints.push('⚠ มี pole อยู่ใน right-half-plane — วงจร UNSTABLE (step response จะระเบิด)');
  if (blocksDC) hints.push('ℹ H(s)|_{s=0} ≈ 0 — วงจรนี้ block DC ไว้ (น่าจะมี capacitor อนุกรม หรือเป็น differentiator)');
  if (hints.length === 0) return null;
  return (
    <div className="px-3 py-1 bg-amber-50 border-b border-amber-200 text-[11px] text-amber-900 shrink-0">
      {hints.map((h, i) => <div key={i}>{h}</div>)}
    </div>
  );
}

function HsPanel({ tf }: { tf: TFResult }) {
  if (!tf.ok || !tf.H) return null;
  return (
    <div className="text-[12px] leading-relaxed">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
        Transfer function H(s) = เอาต์พุต / อินพุต
      </div>
      <div className="font-mono leading-tight bg-slate-50 border border-slate-200 rounded p-3 break-words">
        <div className="text-slate-800">{fmtPoly(tf.H.n)}</div>
        <div className="border-t border-slate-300 my-1.5"></div>
        <div className="text-slate-800">{fmtPoly(tf.H.d)}</div>
      </div>
      <div className="text-[11px] text-slate-600 mt-3 space-y-0.5">
        <div>
          อินพุต: <span className="font-semibold text-blue-700">{tf.inputKind === 'vin' ? 'Vin (V)' : 'Iin (A)'}</span>
        </div>
        <div>
          เอาต์พุต: <span className="font-semibold text-amber-700">{tf.outputKind === 'vout' ? 'Vout (V)' : 'Iout (A)'}</span>
        </div>
      </div>
      {tf.warnings.length > 0 && (
        <div className="mt-3 text-[11px] text-amber-800 space-y-0.5">
          {tf.warnings.map((w, i) => (<div key={i}>⚠ {w.msg}</div>))}
        </div>
      )}
    </div>
  );
}

// ─── 3φ body ────────────────────────────────────────────────────
function TpBody({
  result,
  tab,
  setTab,
  isWide,
  bodyRef,
}: {
  result: ThreePhaseResult | null;
  tab: TpTab;
  setTab: (t: TpTab) => void;
  isWide: boolean;
  bodyRef: React.RefObject<HTMLDivElement>;
}) {
  if (!result) return null;
  return (
    <>
      <SubTabRow
        tabs={TP_TABS}
        active={tab}
        onChange={(id) => setTab(id as TpTab)}
        right={
          result.ok ? (
            <span className="text-[11px] text-slate-600">
              {result.topology} · f = <span className="text-cyan-700 font-semibold">{result.freqHz} Hz</span>
            </span>
          ) : undefined
        }
      />

      {!result.ok && (
        <div className="flex-1 flex items-center justify-center text-sm text-slate-500 italic px-6 text-center">
          {result.error}
        </div>
      )}

      {result.ok && isWide && (
        // Fullscreen / wide: show all three side by side, ignore the tab.
        <div ref={bodyRef} className="flex-1 min-h-0 flex">
          <div className="w-[420px] shrink-0 border-r border-slate-200 p-3">
            <ThreePhasePhasor result={result} />
          </div>
          <div className="flex-1 p-3 overflow-auto">
            <ThreePhaseTable result={result} />
          </div>
          <div className="w-72 shrink-0 border-l border-slate-200 p-3 bg-slate-50 overflow-auto">
            <ThreePhasePower result={result} />
          </div>
        </div>
      )}

      {result.ok && !isWide && (
        <div ref={bodyRef} className="flex-1 min-h-0 p-3 overflow-y-auto">
          {tab === 'phasor' && <ThreePhasePhasor result={result} />}
          {tab === 'table' && <ThreePhaseTable result={result} />}
          {tab === 'power' && <ThreePhasePower result={result} />}
        </div>
      )}
    </>
  );
}

// ─── Sub-tab row ────────────────────────────────────────────────
function SubTabRow<T extends string>({
  tabs,
  active,
  onChange,
  right,
}: {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
  right?: React.ReactNode;
}) {
  return (
    <div className="px-2 py-1.5 border-b border-slate-200 bg-slate-50 flex items-center gap-1 shrink-0 overflow-x-auto">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={
            'px-2.5 py-0.5 text-[11px] rounded-md whitespace-nowrap transition-colors font-medium ' +
            (active === t.id
              ? 'bg-brand-950 text-brand-gold'
              : 'text-slate-600 hover:bg-slate-200')
          }
        >
          {t.label}
        </button>
      ))}
      {right && <div className="ml-auto pl-2">{right}</div>}
    </div>
  );
}

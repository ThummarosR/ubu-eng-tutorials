// Block-diagram analysis panel (v0.3.0 MVP). Mirrors AnalysisPanel chrome
// (collapsed / normal / fullscreen with drag-resize, PNG export of charts),
// shows reduction walkthrough + reduced TF + Bode/Step/PZ when numeric.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { reduceMason } from '../lib/blockdiagram/mason';
import { formatSym, isNumeric } from '../lib/blockdiagram/symexpr';
import { FormattedStep } from './FormattedStep';
import { BodePlot, StepPlot, PoleZeroPlot } from './AnalysisBench';
import { RootLocusPlot } from './RootLocusPlot';

interface Props {
  nodes: Node[];
  edges: Edge[];
}

type Size = 'collapsed' | 'normal' | 'fullscreen';
type Tab = 'walkthrough' | 'bode' | 'step' | 'pz' | 'rlocus';

const TABS: { id: Tab; label: string; needsNumeric?: boolean }[] = [
  { id: 'walkthrough', label: 'Walkthrough' },
  { id: 'bode',        label: 'Bode',        needsNumeric: true },
  { id: 'step',        label: 'Step',        needsNumeric: true },
  { id: 'pz',          label: 'Pole-Zero',   needsNumeric: true },
  { id: 'rlocus',      label: 'Root Locus',  needsNumeric: true },
];

const WIDTH_KEY = 'eeubudraw:blockPanelWidth';
const WIDTH_DEFAULT = 480;
const WIDTH_MIN = 320;
const WIDTH_MAX_FRAC = 0.85;

function loadInitialWidth(): number {
  if (typeof window === 'undefined') return WIDTH_DEFAULT;
  const v = parseFloat(window.localStorage.getItem(WIDTH_KEY) ?? '');
  if (!Number.isFinite(v)) return WIDTH_DEFAULT;
  return Math.max(WIDTH_MIN, Math.min(window.innerWidth * WIDTH_MAX_FRAC, v));
}

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
      img.onload = () => { ctx.drawImage(img, 0, y, item.w, item.h); URL.revokeObjectURL(url); res(); };
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

export function BlockDiagramPanel({ nodes, edges }: Props) {
  const [size, setSize] = useState<Size>('normal');
  const [width, setWidth] = useState<number>(loadInitialWidth);
  const [tab, setTab] = useState<Tab>('walkthrough');
  const bodyRef = useRef<HTMLDivElement>(null);

  const result = useMemo(() => reduceMason(nodes, edges), [nodes, edges]);
  const numericTF = result.numericTF;
  const numericOK = numericTF !== null;

  // Esc exits fullscreen
  useEffect(() => {
    if (size !== 'fullscreen') return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSize('normal'); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [size]);

  // Persist width
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

  const onExport = useCallback(() => {
    if (!bodyRef.current) return;
    exportChartsAsPng(bodyRef.current, `eeubudraw-block-${tab}.png`);
  }, [tab]);

  const exportAvailable = tab !== 'walkthrough';

  // Auto-disable charts tab if not numeric.
  useEffect(() => {
    if (!numericOK && TABS.find((t) => t.id === tab)?.needsNumeric) {
      setTab('walkthrough');
    }
  }, [numericOK, tab]);

  if (size === 'collapsed') {
    return (
      <aside className="w-7 shrink-0 border-l border-slate-200 bg-white flex flex-col">
        <button
          onClick={() => setSize('normal')}
          title="Show block diagram analysis"
          className="w-full py-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 text-sm"
        >
          ‹
        </button>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[10px] text-slate-400 -rotate-90 whitespace-nowrap select-none">
            Block diagram
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

      <header className="px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-brand-50 to-white shrink-0">
        <div className="flex justify-between items-start gap-2">
          <div>
            <div className="text-sm font-semibold text-brand-950 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-gold ring-2 ring-brand-gold/30" />
              Block Diagram
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              ลด block diagram เป็น T(s) — Linear SISO control systems
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
              onClick={() => setSize(isFs ? 'normal' : 'fullscreen')}
              title={isFs ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
              className="hover:text-brand-900 px-1.5 py-0.5 rounded hover:bg-slate-100"
            >
              {isFs ? '⤡' : '⤢'}
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
      </header>

      {/* Sub-tab row */}
      <div className="px-2 py-1.5 border-b border-slate-200 bg-slate-50 flex items-center gap-1 shrink-0 overflow-x-auto">
        {TABS.map((t) => {
          const disabled = t.needsNumeric && !numericOK;
          return (
            <button
              key={t.id}
              onClick={() => !disabled && setTab(t.id)}
              disabled={disabled}
              title={disabled ? 'ต้องกำหนด TF ให้ block ทุกตัวก่อน (เป็นตัวเลข) จึงจะดู plot ได้' : undefined}
              className={
                'px-2.5 py-0.5 text-[11px] rounded-md whitespace-nowrap transition-colors font-medium ' +
                (tab === t.id
                  ? 'bg-brand-950 text-brand-gold'
                  : disabled
                    ? 'text-slate-300 cursor-not-allowed'
                    : 'text-slate-600 hover:bg-slate-200')
              }
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Errors / warnings */}
      {result.errors.length > 0 && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-xs text-red-800 leading-snug shrink-0">
          {result.errors.map((e, i) => <div key={i}>✗ {e}</div>)}
        </div>
      )}
      {result.warnings.length > 0 && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-800 leading-snug shrink-0">
          {result.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
        </div>
      )}

      {/* Body */}
      <div ref={bodyRef} className="flex-1 min-h-0 overflow-y-auto p-3">
        {tab === 'walkthrough' && (
          <>
            {!result.tf && (
              <div className="text-sm text-slate-500 italic">
                วาง R(s), block และ Y(s) บน canvas แล้วเชื่อมเข้าด้วยกันเพื่อดู reduction
              </div>
            )}
            {result.tf && result.steps.length === 0 && (
              <div className="text-sm text-slate-500 italic">
                ไม่มีขั้นตอน reduction — diagram ง่ายเกินไป
              </div>
            )}
            {result.tf && result.steps.length > 0 && (
              <div className="space-y-3">
                {result.steps.map((s, i) => (
                  <div key={i} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                    <div className="text-[12px] font-semibold text-brand-950 mb-1">{s.title}</div>
                    {s.detail && (
                      <FormattedStep lines={s.detail} className="!text-[12px]" />
                    )}
                  </div>
                ))}
              </div>
            )}
            {result.tf && (
              <div className="mt-4 px-3 py-3 bg-brand-950 text-brand-gold rounded-md shadow-sm">
                <div className="text-[10px] uppercase tracking-wider opacity-70 mb-1">Reduced T(s)</div>
                <div className="font-mono text-sm break-words">
                  T(s) = {formatSym(result.tf)}
                </div>
                {!isNumeric(result.tf) && (
                  <div className="text-[10px] mt-2 opacity-70">
                    Symbolic — ใส่ค่า TF เป็นตัวเลขในทุก block เพื่อดู Bode / Step / PZ / Root Locus
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {tab === 'bode' && numericTF && <BodePlot H={numericTF} />}
        {tab === 'step' && numericTF && <StepPlot H={numericTF} />}
        {tab === 'pz' && numericTF && (
          <PoleZeroPlot H={numericTF} highlightLabel={null} />
        )}
        {tab === 'rlocus' && numericTF && <RootLocusPlot H={numericTF} />}
      </div>
    </aside>
  );
}

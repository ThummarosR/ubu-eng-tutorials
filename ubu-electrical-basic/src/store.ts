import { create } from 'zustand';
import { ComponentKind, COMPONENT_CATALOG } from './components/nodes/iec';
import { DEFAULT_TITLE_BLOCK, PaperSize, TitleBlock } from './sheet';

interface CounterMap {
  [k: string]: number;
}

export type AppMode = 'draw' | 'analyze' | 'block';
export type AnalysisDomain = 'dc' | 'ac' | '3p';
/** Schematic-mode sub-view. 'normal' = drawing/documentation (no energised glow).
 *  'energise' = full live simulation feedback (current default). Lamps + motors still react
 *  in both — only the wire glow effect is gated. */
export type SimView = 'normal' | 'energise';

interface AppState {
  mode: AppMode;
  /** Within draw mode: 'normal' for documentation, 'energise' for live simulation glow. */
  simView: SimView;
  /** Within analyze mode: DC (steady-state numbers) or AC (TF + Bode + phasor + step + locus). */
  analysisDomain: AnalysisDomain;
  /** AC analysis frequency in Hz — used for phasor diagram + AC steady-state probe. */
  acFrequency: number;
  /** RF node id of the passive component (R/L/C) whose poles should be highlighted on the PZ plot. */
  acHighlightId: string | null;
  /** Pedagogical prompts for the most-recently-loaded example. Cleared when the user
   *  hits Clear or loads a different example. */
  examplePrompts: string[];
  counters: CounterMap;
  titleBlock: TitleBlock;
  paperSize: PaperSize;
  /** When true, analyze-mode draws computed I / V annotations on each component. */
  showCanvasAnalysis: boolean;
  nextLabel: (kind: ComponentKind) => { label: string; value?: string };
  setMode: (m: AppMode) => void;
  setSimView: (v: SimView) => void;
  setAnalysisDomain: (d: AnalysisDomain) => void;
  setAcFrequency: (hz: number) => void;
  setAcHighlightId: (id: string | null) => void;
  setExamplePrompts: (p: string[]) => void;
  setTitleBlock: (tb: TitleBlock) => void;
  setPaperSize: (s: PaperSize) => void;
  setShowCanvasAnalysis: (b: boolean) => void;
  reset: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  mode: 'draw',
  simView: 'energise',
  analysisDomain: 'dc',
  acFrequency: 1000, // 1 kHz default
  acHighlightId: null,
  examplePrompts: [],
  counters: {},
  titleBlock: DEFAULT_TITLE_BLOCK,
  paperSize: 'A2',
  showCanvasAnalysis: true,
  nextLabel: (kind) => {
    const meta = COMPONENT_CATALOG.find((c) => c.kind === kind);
    if (!meta || !meta.label) return { label: '', value: meta?.defaultValue };
    const counters = { ...get().counters };
    counters[meta.label] = (counters[meta.label] ?? 0) + 1;
    set({ counters });
    return { label: `${meta.label}${counters[meta.label]}`, value: meta.defaultValue };
  },
  setMode: (m) => set({ mode: m }),
  setSimView: (v) => set({ simView: v }),
  setAnalysisDomain: (d) => set({ analysisDomain: d }),
  setAcFrequency: (hz) => set({ acFrequency: Math.max(1e-3, hz) }),
  setAcHighlightId: (id) => set({ acHighlightId: id }),
  setExamplePrompts: (p) => set({ examplePrompts: p }),
  setTitleBlock: (tb) => set({ titleBlock: tb }),
  setPaperSize: (s) => set({ paperSize: s }),
  setShowCanvasAnalysis: (b) => set({ showCanvasAnalysis: b }),
  reset: () => set({ counters: {} }),
}));

import { useState, useRef, useEffect } from 'react';
import { PaperSize, PAPER_DIMS } from '../sheet';
import { EXAMPLES, Example } from '../lib/examples';
import { useStore, AppMode } from '../store';

interface Props {
  onExportPng: () => void;
  onExportSvg: () => void;
  onSave: () => void;
  onLoad: () => void;
  onClear: () => void;
  onEditTitleBlock: () => void;
  onAddText: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onLoadExample: (ex: Example) => void;
  canUndo: boolean;
  canRedo: boolean;
  paperSize: PaperSize;
  onPaperSizeChange: (s: PaperSize) => void;
}

const MODE_LABELS: Record<AppMode, { en: string; th: string }> = {
  draw: { en: 'Schematic', th: 'แผนผังวงจร' },
  analyze: { en: 'Circuit Analysis', th: 'การวิเคราะห์วงจร' },
  block: { en: 'Block Diagram', th: 'บล็อกไดอะแกรม' },
};

export function Toolbar({
  onExportPng,
  onExportSvg,
  onSave,
  onLoad,
  onClear,
  onEditTitleBlock,
  onAddText,
  onUndo,
  onRedo,
  onLoadExample,
  canUndo,
  canRedo,
  paperSize,
  onPaperSizeChange,
}: Props) {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const simView = useStore((s) => s.simView);
  const setSimView = useStore((s) => s.setSimView);
  return (
    <header className="h-14 shrink-0 border-b border-slate-200 bg-white flex items-center px-4 gap-2 shadow-brand">
      {/* Logo + word mark */}
      <div className="flex items-center gap-2 mr-2">
        <img src="/icon.svg" alt="" className="w-8 h-8 rounded-md shadow-sm" />
        <div className="leading-none">
          <div className="text-[15px] font-semibold text-brand-950 tracking-tight">UBUElectricalBasic</div>
          <div className="text-[10px] text-slate-500 mt-0.5">UBU · Electrical Engineering</div>
        </div>
      </div>

      <Divider />

      {/* Mode toggle — primary nav */}
      <div className="flex items-center rounded-lg overflow-hidden ring-1 ring-brand-100 bg-brand-50">
        <ModeBtn
          active={mode === 'draw'}
          onClick={() => setMode('draw')}
          title="Schematic editor — draw motor-control diagrams (1306 211 Workshop)"
        >
          {MODE_LABELS.draw.en}
        </ModeBtn>
        <ModeBtn
          active={mode === 'analyze'}
          onClick={() => setMode('analyze')}
          title="Circuit analysis — compute V, I, walk through methods (1306 210 Lab I)"
        >
          {MODE_LABELS.analyze.en}
        </ModeBtn>
        <ModeBtn
          active={mode === 'block'}
          onClick={() => setMode('block')}
          title="Block diagram — linear SISO control systems: reduce, plot Bode/Step/Pole-Zero/Root-Locus"
        >
          {MODE_LABELS.block.en}
        </ModeBtn>
      </div>

      {mode === 'draw' && (
        <div className="flex items-center rounded-lg overflow-hidden ring-1 ring-slate-200 bg-slate-50 ml-2">
          <ModeBtn
            active={simView === 'normal'}
            onClick={() => setSimView('normal')}
            title="Normal: clean drawing view, wires don't glow when energised. Lamps + switches still react."
          >
            Normal
          </ModeBtn>
          <ModeBtn
            active={simView === 'energise'}
            onClick={() => setSimView('energise')}
            title="Energise: live simulation glow on wires carrying current."
          >
            Energise
          </ModeBtn>
        </div>
      )}

      <Divider />

      {/* File */}
      <Btn onClick={onSave} variant="primary" title="Save diagram to JSON">
        Save
      </Btn>
      <Btn onClick={onLoad} title="Open a .elecdraw.json file">
        Open
      </Btn>
      <ExamplesMenu onPick={onLoadExample} currentMode={mode} />

      <Divider />

      {/* History */}
      <IconBtn onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">↶</IconBtn>
      <IconBtn onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">↷</IconBtn>

      <Divider />

      {/* Page (was: Title block + + Text + Paper) */}
      <PageMenu
        paperSize={paperSize}
        onPaperSizeChange={onPaperSizeChange}
        onEditTitleBlock={onEditTitleBlock}
        onAddText={onAddText}
      />

      {/* Export (was: PNG + SVG) */}
      <ExportMenu onExportPng={onExportPng} onExportSvg={onExportSvg} />

      <div className="flex-1" />

      <Btn onClick={onClear} variant="danger" title="Clear all components from the canvas">
        Clear
      </Btn>
    </header>
  );
}

function ExamplesMenu({
  onPick,
  currentMode,
}: {
  onPick: (ex: Example) => void;
  currentMode: AppMode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // Show only examples for the current mode — the two classes never share a list.
  const visible = EXAMPLES.filter((ex) => (ex.mode ?? 'draw') === currentMode);
  const setMode = useStore((s) => s.setMode);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="px-3 py-1.5 text-sm rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors font-medium"
      >
        Examples ▾
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1 overflow-hidden">
          <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {MODE_LABELS[currentMode].en} examples
          </div>
          {visible.length === 0 ? (
            <div className="px-3 py-3 text-xs text-slate-500 italic">
              No examples yet for this mode.
            </div>
          ) : (
            visible.map((ex) => (
              <button
                key={ex.id}
                onClick={() => {
                  onPick(ex);
                  setOpen(false);
                }}
                className="block w-full text-left px-3 py-2 hover:bg-brand-50 transition-colors"
              >
                <div className="text-sm text-slate-800 font-medium">
                  {ex.nameTh} <span className="text-slate-400 font-normal">/ {ex.nameEn}</span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{ex.desc}</div>
              </button>
            ))
          )}
          {/* Mode hint: use top-bar tabs to switch between Schematic / Circuit Analysis / Block Diagram. */}
          <div className="border-t border-slate-100 mt-1 px-3 py-2 text-[11px] text-slate-500 bg-slate-50">
            Switch mode at top to see examples for{' '}
            {(['draw', 'analyze', 'block'] as AppMode[])
              .filter((m) => m !== currentMode)
              .map((m, i, arr) => (
                <span key={m}>
                  <button
                    onClick={() => { setMode(m); setOpen(false); }}
                    className="text-brand-900 hover:underline font-medium"
                  >
                    {MODE_LABELS[m].en}
                  </button>
                  {i < arr.length - 1 ? ' or ' : ''}
                </span>
              ))}
            .
          </div>
        </div>
      )}
    </div>
  );
}

function PageMenu({
  paperSize,
  onPaperSizeChange,
  onEditTitleBlock,
  onAddText,
}: {
  paperSize: PaperSize;
  onPaperSizeChange: (s: PaperSize) => void;
  onEditTitleBlock: () => void;
  onAddText: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="px-3 py-1.5 text-sm rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors font-medium"
        title="Page settings: title block, paper size, notes"
      >
        Page ▾
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1 overflow-hidden">
          <MenuItem
            onClick={() => { onEditTitleBlock(); setOpen(false); }}
            label="Title block"
            sub="Edit drawing header — project, title, date, drawn-by, page"
          />
          <MenuItem
            onClick={() => { onAddText(); setOpen(false); }}
            label="Add note"
            sub="Drop a text annotation on the canvas (Ctrl+T)"
          />
          <div className="px-3 py-2 border-t border-slate-100 flex items-center justify-between gap-2">
            <span className="text-sm text-slate-700">Paper size</span>
            <select
              value={paperSize}
              onChange={(e) => onPaperSizeChange(e.target.value as PaperSize)}
              className="border border-slate-200 rounded px-2 py-1 text-sm bg-white hover:bg-slate-50 focus:outline-none focus:border-brand-500"
              title={PAPER_DIMS[paperSize].label}
            >
              {(Object.keys(PAPER_DIMS) as PaperSize[]).map((s) => (
                <option key={s} value={s}>
                  {s} — {PAPER_DIMS[s].label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

function ExportMenu({
  onExportPng,
  onExportSvg,
}: {
  onExportPng: () => void;
  onExportSvg: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="px-3 py-1.5 text-sm rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors font-medium"
        title="Export the diagram as an image"
      >
        Export ▾
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1 overflow-hidden">
          <MenuItem
            onClick={() => { onExportPng(); setOpen(false); }}
            label="PNG"
            sub="Raster image — for slides, docs, screenshots"
          />
          <MenuItem
            onClick={() => { onExportSvg(); setOpen(false); }}
            label="SVG"
            sub="Vector — scalable, editable in CAD/drawing tools"
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  onClick,
  label,
  sub,
}: {
  onClick: () => void;
  label: string;
  sub?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="block w-full text-left px-3 py-2 hover:bg-brand-50 transition-colors"
    >
      <div className="text-sm text-slate-800 font-medium">{label}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-7 bg-slate-200 mx-1" />;
}

function ModeBtn({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={[
        'px-4 py-1.5 text-sm font-medium transition-colors whitespace-nowrap',
        active
          ? 'bg-brand-950 text-brand-gold shadow-inner'
          : 'text-brand-900 hover:bg-brand-100',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function IconBtn({
  children,
  onClick,
  disabled = false,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      className={[
        'w-8 h-8 rounded-md text-base flex items-center justify-center transition-colors',
        disabled
          ? 'text-slate-300 cursor-not-allowed'
          : 'text-slate-600 hover:bg-slate-100 hover:text-brand-900',
      ].join(' ')}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}

function Btn({
  children,
  onClick,
  variant = 'default',
  disabled = false,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger' | 'primary';
  disabled?: boolean;
  title?: string;
}) {
  const base = 'px-3 py-1.5 text-sm rounded-md border transition-colors font-medium';
  const enabledStyles =
    variant === 'danger'
      ? 'border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300'
      : variant === 'primary'
        ? 'bg-brand-900 text-white border-brand-900 hover:bg-brand-950 shadow-sm'
        : 'border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300';
  const disabledStyles = 'border-slate-100 text-slate-300 cursor-not-allowed';
  return (
    <button
      className={`${base} ${disabled ? disabledStyles : enabledStyles}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}

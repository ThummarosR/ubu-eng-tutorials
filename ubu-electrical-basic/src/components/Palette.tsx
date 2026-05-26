import { useState } from 'react';
import {
  ComponentKind,
  COMPONENT_NAMES,
  PaletteIcon,
  PALETTE_SECTIONS,
  ANALYZE_PALETTE_SECTIONS,
  BLOCK_PALETTE_SECTIONS,
} from './nodes/iec';
import { useStore } from '../store';

interface Props {
  onDragStart: (e: React.DragEvent, kind: ComponentKind) => void;
}

export function Palette({ onDragStart }: Props) {
  const mode = useStore((s) => s.mode);
  const sections =
    mode === 'analyze' ? ANALYZE_PALETTE_SECTIONS
    : mode === 'block' ? BLOCK_PALETTE_SECTIONS
    : PALETTE_SECTIONS;
  // Track which sections are open. Default for draw: power + control. Analyze + block: all.
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    PALETTE_SECTIONS.forEach((s, i) => { o[s.name] = i < 2; });
    ANALYZE_PALETTE_SECTIONS.forEach((s) => { o[s.name] = true; });
    BLOCK_PALETTE_SECTIONS.forEach((s) => { o[s.name] = true; });
    return o;
  });
  const toggle = (name: string) => setOpen((s) => ({ ...s, [name]: !s[name] }));
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <aside className="w-7 shrink-0 border-r border-slate-200 bg-panel flex flex-col">
        <button
          onClick={() => setCollapsed(false)}
          title="Show components"
          className="w-full py-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 text-sm"
        >
          ›
        </button>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[10px] text-slate-400 -rotate-90 whitespace-nowrap select-none">
            Components
          </span>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-60 shrink-0 border-r border-slate-200 bg-panel overflow-y-auto flex flex-col">
      <button
        onClick={() => setCollapsed(true)}
        title="Hide components"
        className="px-3 py-2 text-[11px] text-brand-950 hover:bg-brand-100 flex justify-between items-center border-b border-slate-200 bg-gradient-to-r from-brand-50 to-panel"
      >
        <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-gold ring-2 ring-brand-gold/30" />
          Components
        </span>
        <span>‹</span>
      </button>
      {sections.map((section) => (
        <div key={section.name}>
          <button
            onClick={() => toggle(section.name)}
            className="w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200 flex justify-between items-center hover:bg-slate-100"
          >
            <span>{section.name}</span>
            <span className="text-slate-400">{open[section.name] ? '−' : '+'}</span>
          </button>
          {open[section.name] && (
            <ul className="p-1.5 space-y-0.5">
              {section.items.map(({ kind }) => (
                <li
                  key={kind}
                  draggable
                  onDragStart={(e) => onDragStart(e, kind)}
                  className="palette-item flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white border border-transparent hover:border-slate-200"
                  title={`Drag ${COMPONENT_NAMES[kind]} onto the canvas`}
                >
                  <div
                    className="shrink-0 flex items-center justify-center"
                    style={{ width: 56, height: 44, transform: 'scale(0.5)', transformOrigin: 'center' }}
                  >
                    <PaletteIcon kind={kind} />
                  </div>
                  <span className="text-xs text-slate-700 leading-tight">{COMPONENT_NAMES[kind]}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      <div className="px-3 py-2 text-[11px] text-slate-500 border-t border-slate-200 leading-snug">
        Drag onto canvas. Press <strong>R</strong> to rotate. Click switches to toggle. <strong>Ctrl+Z</strong> undo.
      </div>
    </aside>
  );
}

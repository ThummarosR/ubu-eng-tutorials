import { Node } from '@xyflow/react';
import {
  COMPONENT_NAMES,
  IECNodeData,
  Rotation,
  SWITCH_BEHAVIOR,
} from './nodes/iec';
import { parseValue, formatValue } from '../lib/analyze/units';

interface Props {
  node: Node<IECNodeData> | null;
  onChange: (patch: Partial<IECNodeData>) => void;
  onDelete: () => void;
}

const NO_VALUE_KINDS = new Set(['ground', 'junction', 'pushbutton', 'switch', 'spdt', 'relaycontact', 'relaycoil', 'summer', 'pickoff', 'bd_input', 'bd_output']);
const BLOCK_TF_KINDS = new Set(['block_g', 'block_k', 'block_p', 'block_i', 'block_d']);

// Per-component-kind: numeric range (log10 decades) + unit string for the slider.
// Slider is shown only when the kind matches AND the current value parses to a number.
const SLIDER_RANGE: Partial<Record<IECNodeData['kind'], { min: number; max: number; unit: string }>> = {
  resistor:  { min: 0,    max: 7,  unit: 'Ω' },   // 1Ω … 10 MΩ
  pot:       { min: 0,    max: 7,  unit: 'Ω' },
  capacitor: { min: -12,  max: 0,  unit: 'F' },   // 1 pF … 1 F
  inductor:  { min: -9,   max: 1,  unit: 'H' },   // 1 nH … 10 H
  dcsource:  { min: -3,   max: 3,  unit: 'V' },   // 1 mV … 1 kV
  acsource:  { min: -3,   max: 3,  unit: 'V' },
  fuse:      { min: -2,   max: 3,  unit: 'A' },
  // Block-diagram scalar gains — 0.001 … 1000 log scale, no unit.
  block_k:   { min: -3,   max: 3,  unit: '' },
  block_p:   { min: -3,   max: 3,  unit: '' },
};

export function PropertiesPanel({ node, onChange, onDelete }: Props) {
  if (!node) return null;
  const d = node.data;
  const showValue = !NO_VALUE_KINDS.has(d.kind);
  const switchable = !!SWITCH_BEHAVIOR[d.kind];
  const rot: Rotation = (d.rotation ?? 0) as Rotation;

  return (
    <div className="absolute top-2 right-2 w-64 bg-white border border-slate-200 rounded-lg shadow-md p-3 text-sm pointer-events-auto z-10">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-slate-800">{COMPONENT_NAMES[d.kind]}</div>
        <button
          onClick={onDelete}
          className="text-red-500 hover:text-red-700 text-xs"
          title="Delete (or press Delete key)"
        >
          ✕ Delete
        </button>
      </div>

      <Field label="Label">
        <input
          type="text"
          value={d.label ?? ''}
          onChange={(e) => onChange({ label: e.target.value })}
          className="w-full border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-accent"
        />
      </Field>

      {showValue && (
        <Field label={BLOCK_TF_KINDS.has(d.kind) ? 'Transfer function' : 'Value'}>
          <input
            type="text"
            value={d.value ?? ''}
            onChange={(e) => onChange({ value: e.target.value })}
            placeholder={BLOCK_TF_KINDS.has(d.kind) ? 'e.g. 1/(s+1),  (s+2)/(s^2+3s+5),  10' : 'e.g. 1 kΩ, 9 V, 10 µF'}
            className="w-full border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-accent"
          />
          <ValueSlider kind={d.kind} value={d.value ?? ''} onChange={(v) => onChange({ value: v })} />
          {BLOCK_TF_KINDS.has(d.kind) && (
            <div className="mt-1 text-[10px] text-slate-500">
              เว้นว่างไว้ = symbolic (block reduce ออกมาเป็นสมการ ไม่ใช่ตัวเลข)
            </div>
          )}
        </Field>
      )}

      {d.kind === 'summer' && (
        <Field label="Inputs">
          {/* Header: count selector */}
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-slate-500">Number of inputs</span>
            <select
              value={d.arity ?? 2}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                const signs: ('+' | '-')[] = Array.from({ length: n }, (_, i) =>
                  (d.signs?.[i] ?? (i === 0 ? '+' : '-'))
                );
                onChange({ arity: n, signs });
              }}
              className="border border-slate-300 rounded px-1.5 py-0.5 text-xs bg-white hover:bg-slate-50 focus:outline-none focus:border-accent"
            >
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </div>

          {/* Per-input rows: handle name on the left, segmented +/− toggle on the right */}
          <div className="border border-slate-200 rounded divide-y divide-slate-100 bg-white overflow-hidden">
            {Array.from({ length: d.arity ?? 2 }).map((_, i) => {
              const sign = d.signs?.[i] ?? (i === 0 ? '+' : '-');
              const setSign = (s: '+' | '-') => {
                if (s === sign) return;
                const next: ('+' | '-')[] = Array.from({ length: d.arity ?? 2 }, (_, j) =>
                  (d.signs?.[j] ?? (j === 0 ? '+' : '-'))
                );
                next[i] = s;
                onChange({ signs: next });
              };
              return (
                <div key={i} className="flex items-center justify-between px-2.5 py-1.5">
                  <span className="font-mono text-[12px] text-slate-700">
                    in<sub className="text-[10px] text-slate-500">{i}</sub>
                  </span>
                  <div className="inline-flex rounded-md ring-1 ring-slate-300 overflow-hidden text-[12px] font-mono font-semibold">
                    <button
                      type="button"
                      onClick={() => setSign('-')}
                      title="Negative input"
                      className={
                        'w-7 h-6 transition-colors ' +
                        (sign === '-'
                          ? 'bg-red-500 text-white'
                          : 'bg-white text-slate-500 hover:bg-slate-100')
                      }
                    >
                      −
                    </button>
                    <button
                      type="button"
                      onClick={() => setSign('+')}
                      title="Positive input"
                      className={
                        'w-7 h-6 transition-colors border-l border-slate-300 ' +
                        (sign === '+'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-white text-slate-500 hover:bg-slate-100')
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Field>
      )}

      {d.kind === 'pickoff' && (
        <Field label="Outputs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500">Number of outputs</span>
            <select
              value={d.arity ?? 2}
              onChange={(e) => onChange({ arity: parseInt(e.target.value, 10) })}
              className="border border-slate-300 rounded px-1.5 py-0.5 text-xs bg-white hover:bg-slate-50 focus:outline-none focus:border-accent"
            >
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </div>
        </Field>
      )}

      <Field label="Rotation">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onChange({ rotation: (((rot + 270) % 360) as Rotation) })}
            className="px-2 py-1 border border-slate-200 rounded hover:bg-slate-50"
            title="Rotate counter-clockwise (Shift+R)"
          >
            ↺
          </button>
          <span className="flex-1 text-center text-slate-700">{rot}°</span>
          <button
            onClick={() => onChange({ rotation: (((rot + 90) % 360) as Rotation) })}
            className="px-2 py-1 border border-slate-200 rounded hover:bg-slate-50"
            title="Rotate clockwise (R)"
          >
            ↻
          </button>
        </div>
      </Field>

      {switchable && (
        <Field label="State">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!d.closed}
              onChange={(e) => onChange({ closed: e.target.checked })}
            />
            <span className="text-slate-700">{d.closed ? 'Closed (conducting)' : 'Open'}</span>
          </label>
        </Field>
      )}
    </div>
  );
}

function ValueSlider({
  kind, value, onChange,
}: {
  kind: IECNodeData['kind'];
  value: string;
  onChange: (next: string) => void;
}) {
  const range = SLIDER_RANGE[kind];
  if (!range) return null;
  const num = parseValue(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  const log = Math.log10(num);
  // Clamp into the range so the slider doesn't jump out of view.
  const display = Math.min(range.max, Math.max(range.min, log));
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <span className="text-[10px] text-slate-400 w-8 text-right">{decadeLabel(range.min)}</span>
      <input
        type="range"
        min={range.min}
        max={range.max}
        step={0.01}
        value={display}
        onChange={(e) => {
          const newVal = Math.pow(10, parseFloat(e.target.value));
          onChange(formatValue(newVal, range.unit));
        }}
        className="flex-1 accent-brand-900"
        title="Drag to vary on a logarithmic scale — every plot updates live"
      />
      <span className="text-[10px] text-slate-400 w-10">{decadeLabel(range.max)}</span>
    </div>
  );
}

function decadeLabel(log10: number): string {
  if (log10 >= 6) return `1M`;
  if (log10 >= 3) return `1k`;
  if (log10 >= 0) return `${Math.pow(10, log10)}`;
  if (log10 >= -3) return `${Math.pow(10, log10 + 3).toPrecision(2)}m`;
  if (log10 >= -6) return `${Math.pow(10, log10 + 6).toPrecision(2)}µ`;
  if (log10 >= -9) return `${Math.pow(10, log10 + 9).toPrecision(2)}n`;
  return `${Math.pow(10, log10 + 12).toPrecision(2)}p`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-2">
      <span className="block text-xs text-slate-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

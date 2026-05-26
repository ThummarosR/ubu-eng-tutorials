import { Edge } from '@xyflow/react';

interface Props {
  edge: Edge | null;
  onDelete: () => void;
}

export function EdgePropertiesPanel({ edge, onDelete }: Props) {
  if (!edge) return null;

  return (
    <div className="absolute top-2 right-2 w-64 bg-white border border-slate-200 rounded-lg shadow-md p-3 text-sm pointer-events-auto z-10">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-slate-800">Wire</div>
        <button
          onClick={onDelete}
          className="text-red-500 hover:text-red-700 text-xs"
          title="Delete (or press Delete key)"
        >
          ✕ Delete
        </button>
      </div>

      <div className="text-[11px] text-slate-500 leading-snug space-y-1">
        <div>Wire colour is derived from topology:</div>
        <ul className="ml-3 list-disc space-y-0.5">
          <li><span className="font-semibold text-[#dc2626]">red</span> — connected to phase (L1/L2/L3)</li>
          <li><span className="font-semibold text-[#1e40af]">blue</span> — connected to neutral / return</li>
          <li><span className="font-semibold text-[#16a34a]">green</span> — protective earth (PE)</li>
          <li><span className="font-semibold text-[#d946ef]">magenta ⚠</span> — short across sources</li>
          <li><span className="font-semibold text-[#0f172a]">black</span> — floating (no source path)</li>
        </ul>
        <div className="pt-1">Energised wires glow in their own hue when a closed loop carries current.</div>
      </div>
    </div>
  );
}

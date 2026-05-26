import { useEffect, useState } from 'react';
import { TitleBlock } from '../sheet';

interface Props {
  open: boolean;
  value: TitleBlock;
  onClose: () => void;
  onSave: (next: TitleBlock) => void;
}

const FIELDS: { key: keyof TitleBlock; labelTh: string; labelEn: string; placeholder?: string }[] = [
  { key: 'institution', labelTh: 'สถาบัน', labelEn: 'Institution' },
  { key: 'project', labelTh: 'ชื่อโครงการ', labelEn: 'Project' },
  { key: 'title', labelTh: 'ชื่อแบบ', labelEn: 'Drawing Title (Título)' },
  { key: 'drawnBy', labelTh: 'ชื่อผู้เขียน', labelEn: 'Drawn by (Name)' },
  { key: 'drawnDate', labelTh: 'วันที่เขียน', labelEn: 'Drawn date', placeholder: 'YYYY-MM-DD' },
  { key: 'signature', labelTh: 'ลายเซ็น', labelEn: 'Signature' },
  { key: 'designedBy', labelTh: 'ออกแบบโดย', labelEn: 'Designed by' },
  { key: 'date', labelTh: 'วันที่', labelEn: 'Date', placeholder: 'YYYY-MM-DD' },
  { key: 'page', labelTh: 'หน้า', labelEn: 'Página / Page', placeholder: '1/1' },
  { key: 'fileName', labelTh: 'ชื่อไฟล์', labelEn: 'File name' },
];

export function TitleBlockDialog({ open, value, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<TitleBlock>(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-[520px] max-w-[90vw] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Title Block / ตารางรายการ</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="p-5 space-y-3">
          {FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="block text-xs text-slate-500 mb-1">
                {f.labelTh} <span className="text-slate-400">/ {f.labelEn}</span>
              </span>
              <input
                type="text"
                value={draft[f.key]}
                placeholder={f.placeholder}
                onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-accent"
              />
            </label>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSave(draft);
              onClose();
            }}
            className="px-3 py-1.5 text-sm rounded bg-accent text-white hover:bg-sky-600"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

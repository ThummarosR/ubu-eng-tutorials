import { NodeProps } from '@xyflow/react';
import { useEffect, useRef, useState } from 'react';

export interface TextNodeData extends Record<string, unknown> {
  text: string;
  fontSize?: number;
}

export function TextNode({ data, id, selected }: NodeProps) {
  const d = data as TextNodeData;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(d.text);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(d.text);
  }, [d.text]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== d.text) {
      // Bubble change via a custom event so App.tsx can update node data.
      window.dispatchEvent(
        new CustomEvent('elecdraw-text-edit', { detail: { id, text: draft } }),
      );
    }
  };

  const fontSize = d.fontSize ?? 14;

  if (editing) {
    return (
      <textarea
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setDraft(d.text);
            setEditing(false);
          } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            commit();
          }
        }}
        style={{
          fontSize,
          fontFamily: 'Segoe UI, sans-serif',
          padding: 4,
          minWidth: 80,
          minHeight: 24,
          border: '1px solid #0ea5e9',
          borderRadius: 2,
          resize: 'both',
          background: 'white',
        }}
      />
    );
  }

  return (
    <div
      onDoubleClick={() => setEditing(true)}
      style={{
        fontSize,
        fontFamily: 'Segoe UI, sans-serif',
        color: '#0f172a',
        padding: 4,
        whiteSpace: 'pre',
        cursor: 'text',
        border: selected ? '2px dashed #0ea5e9' : '1px dashed transparent',
        borderRadius: 2,
        minWidth: 20,
        minHeight: 18,
        background: selected ? 'rgba(255,255,255,0.5)' : 'transparent',
      }}
      title="Double-click to edit"
    >
      {d.text || '(empty)'}
    </div>
  );
}

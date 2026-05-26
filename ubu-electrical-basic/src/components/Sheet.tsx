import { NodeProps } from '@xyflow/react';
import {
  MM, PAPER_DIMS, MARGIN, tbOriginMM, TitleBlock, PaperSize, paperPx,
  GRID_DIVISIONS, GRID_LETTERS, TB_HEIGHT_MM,
} from '../sheet';

export interface SheetData extends Record<string, unknown> {
  isSheet: true;
  titleBlock: TitleBlock;
  paperSize: PaperSize;
}

const FRAME_STROKE = '#cbd5e1';
const TB_STROKE = '#0f172a';
const LABEL_FILL = '#64748b';
const VALUE_FILL = '#0f172a';

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const mm = (v: number) => v * MM;

/** Compute proportional cell widths summing exactly to total. */
function proportionalWidths(ratios: number[], total: number): number[] {
  const sum = ratios.reduce((a, b) => a + b, 0);
  const widths = ratios.map((r) => (r / sum) * total);
  // Adjust last cell so sum is exact (avoid float drift).
  const accSoFar = widths.slice(0, -1).reduce((a, b) => a + b, 0);
  widths[widths.length - 1] = total - accSoFar;
  return widths;
}

export function sheetInnerSvg(tb: TitleBlock, size: PaperSize): string {
  const dim = PAPER_DIMS[size];
  const paperW = mm(dim.wMM);
  const paperH = mm(dim.hMM);
  const innerX = mm(MARGIN.left);
  const innerY = mm(MARGIN.top);
  const innerW = mm(dim.wMM - MARGIN.left - MARGIN.right);
  const innerH = mm(dim.hMM - MARGIN.top - MARGIN.bottom);

  const grid = GRID_DIVISIONS[size];
  const colStep = innerW / grid.cols;
  const rowStep = innerH / grid.rows;

  const parts: string[] = [];

  // 1) Paper background + faint paper edge
  parts.push(`<rect x="0" y="0" width="${paperW}" height="${paperH}" fill="white" stroke="${FRAME_STROKE}" stroke-width="0.6"/>`);

  // 2) Inner drawing frame
  parts.push(`<rect x="${innerX}" y="${innerY}" width="${innerW}" height="${innerH}" fill="none" stroke="${TB_STROKE}" stroke-width="1.4"/>`);

  // 3) Grid reference letters (columns) along top and bottom edges
  for (let i = 0; i < grid.cols; i++) {
    const colCentre = innerX + colStep * (i + 0.5);
    const letter = GRID_LETTERS[i] ?? '?';
    // Top
    parts.push(`<text x="${colCentre}" y="${innerY + 9}" font-size="9" font-weight="600" fill="${TB_STROKE}" text-anchor="middle">${letter}</text>`);
    // Bottom (above title block band)
    const bottomY = mm(dim.hMM - MARGIN.bottom - TB_HEIGHT_MM) - 3;
    parts.push(`<text x="${colCentre}" y="${bottomY}" font-size="9" font-weight="600" fill="${TB_STROKE}" text-anchor="middle">${letter}</text>`);
    // Tick marks dividing columns
    if (i > 0) {
      const tickX = innerX + colStep * i;
      parts.push(`<line x1="${tickX}" y1="${innerY}" x2="${tickX}" y2="${innerY + 14}" stroke="${TB_STROKE}" stroke-width="0.5"/>`);
      parts.push(`<line x1="${tickX}" y1="${mm(dim.hMM - MARGIN.bottom - TB_HEIGHT_MM) - 14}" x2="${tickX}" y2="${mm(dim.hMM - MARGIN.bottom - TB_HEIGHT_MM)}" stroke="${TB_STROKE}" stroke-width="0.5"/>`);
    }
  }

  // 4) Grid reference numbers (rows) along left and right edges — only above the title block
  const usableInnerH = innerH - mm(TB_HEIGHT_MM); // height of pure drawing area
  const usableRows = grid.rows; // keep number consistent; rows may visually compress a bit due to TB
  const usableRowStep = usableInnerH / usableRows;
  for (let i = 0; i < usableRows; i++) {
    const rowCentre = innerY + usableRowStep * (i + 0.5);
    const num = String(i + 1);
    // Left
    parts.push(`<text x="${innerX + 8}" y="${rowCentre + 3}" font-size="9" font-weight="600" fill="${TB_STROKE}" text-anchor="middle">${num}</text>`);
    // Right
    parts.push(`<text x="${innerX + innerW - 8}" y="${rowCentre + 3}" font-size="9" font-weight="600" fill="${TB_STROKE}" text-anchor="middle">${num}</text>`);
    if (i > 0) {
      const tickY = innerY + usableRowStep * i;
      parts.push(`<line x1="${innerX}" y1="${tickY}" x2="${innerX + 14}" y2="${tickY}" stroke="${TB_STROKE}" stroke-width="0.5"/>`);
      parts.push(`<line x1="${innerX + innerW - 14}" y1="${tickY}" x2="${innerX + innerW}" y2="${tickY}" stroke="${TB_STROKE}" stroke-width="0.5"/>`);
    }
  }
  // Suppress unused warning
  void rowStep;

  // 5) FULL-WIDTH TITLE BLOCK at the bottom of the inner frame
  //
  //    Layout — 8 columns, mixed cell modes:
  //      Col 0: "Drawn" placeholder (full-height gray cell)
  //      Cols 1, 2, 7: 2-row split — each row is its own header+value sub-cell
  //      Cols 3, 4, 5: merged single cell — header strip at top, multi-line value below
  //      Col 6:        2-row split — row 1 = Date, row 2 = File header + fileName
  //
  //    +-------+--------+--------+--------+----------+---------+--------+------+
  //    |       | Date   | Name   |Signat. |Designed b| Title   | Date   | Page |
  //    |       | dd     | drawnBy|        |          |         | date   | page |
  //    | Drawn |--------|--------| (sig)  | design   | TITLE   |--------|------|
  //    |       |        |        |        | project  |         | File   |      |
  //    |       |        |        |        |          |         | fName  |      |
  //    +-------+--------+--------+--------+----------+---------+--------+------+
  const tbo = tbOriginMM(size);
  parts.push(`<rect x="${mm(tbo.x)}" y="${mm(tbo.y)}" width="${mm(tbo.w)}" height="${mm(tbo.h)}" fill="white" stroke="${TB_STROKE}" stroke-width="1.4"/>`);

  // Column ratios — Title widest; right-side Date wider than before so fileName fits.
  const colRatios = [24, 55, 75, 60, 95, 150, 85, 40]; // sum = 584
  const colWidths = proportionalWidths(colRatios, tbo.w);
  const colXs: number[] = [];
  {
    let c = tbo.x;
    for (const w of colWidths) { colXs.push(c); c += w; }
  }

  // Sub-cell heights (used by split-row columns).
  const subHeaderH = 4;                       // mm — small header strip per sub-cell
  const subRowH = tbo.h / 2;                  // 2 equal sub-rows
  const subValueH = subRowH - subHeaderH;

  // Merged-cell heights (header at top, value below for full height).
  const mergedHeaderH = 5;                    // mm
  const mergedValueH = tbo.h - mergedHeaderH;

  interface Line { text: string; size: number; weight: string }
  interface SubCell { header: string; value: string; valueSize: number; valueWeight: string }
  type ColSpec =
    | { mode: 'drawn' }
    | { mode: 'merged'; header: string; lines: Line[] }
    | { mode: 'split'; rows: [SubCell, SubCell] };

  const cols: ColSpec[] = [
    { mode: 'drawn' },
    { mode: 'split', rows: [
      { header: 'Date', value: tb.drawnDate || '', valueSize: 10, valueWeight: '500' },
      { header: '',     value: '',                 valueSize: 10, valueWeight: '500' },
    ] },
    { mode: 'split', rows: [
      { header: 'Name', value: tb.drawnBy || '', valueSize: 10, valueWeight: '500' },
      { header: '',     value: '',               valueSize: 10, valueWeight: '500' },
    ] },
    { mode: 'merged', header: 'Signature', lines: [
      { text: tb.signature || '', size: 10, weight: '500' },
    ] },
    { mode: 'merged', header: 'Designed by', lines: [
      { text: tb.designedBy || '', size: 10, weight: '500' },
      { text: tb.project || '',    size: 8,  weight: '500' },
    ] },
    { mode: 'merged', header: 'Title', lines: [
      { text: tb.title || '', size: 13, weight: '600' },
    ] },
    { mode: 'split', rows: [
      { header: 'Date', value: tb.date || '',     valueSize: 10, valueWeight: '500' },
      { header: 'File', value: tb.fileName || '', valueSize: 9,  valueWeight: '500' },
    ] },
    { mode: 'split', rows: [
      { header: 'Page', value: tb.page || '', valueSize: 10, valueWeight: '500' },
      { header: '',     value: '',            valueSize: 10, valueWeight: '500' },
    ] },
  ];

  for (let i = 0; i < cols.length; i++) {
    const x = colXs[i];
    const w = colWidths[i];
    const spec = cols[i];

    if (spec.mode === 'drawn') {
      parts.push(`<rect x="${mm(x)}" y="${mm(tbo.y)}" width="${mm(w)}" height="${mm(tbo.h)}" fill="#f1f5f9" stroke="${TB_STROKE}" stroke-width="0.5"/>`);
      parts.push(`<text x="${mm(x) + mm(w) / 2}" y="${mm(tbo.y) + mm(tbo.h) / 2 + 3.5}" font-size="9" font-weight="600" fill="${LABEL_FILL}" text-anchor="middle">Drawn</text>`);
      continue;
    }

    if (spec.mode === 'merged') {
      // Header strip (top)
      parts.push(`<rect x="${mm(x)}" y="${mm(tbo.y)}" width="${mm(w)}" height="${mm(mergedHeaderH)}" fill="#f8fafc" stroke="${TB_STROKE}" stroke-width="0.5"/>`);
      parts.push(`<text x="${mm(x) + 4}" y="${mm(tbo.y) + mm(mergedHeaderH) - 2}" font-size="7" fill="${LABEL_FILL}">${escapeXml(spec.header)}</text>`);
      // Value cell (full height below header)
      const valueY = tbo.y + mergedHeaderH;
      parts.push(`<rect x="${mm(x)}" y="${mm(valueY)}" width="${mm(w)}" height="${mm(mergedValueH)}" fill="white" stroke="${TB_STROKE}" stroke-width="0.5"/>`);
      const lines = spec.lines.filter((l) => l.text);
      if (lines.length > 0) {
        const slot = mm(mergedValueH) / (lines.length + 1);
        const cx = mm(x) + mm(w) / 2;
        lines.forEach((line, idx) => {
          const yPos = mm(valueY) + slot * (idx + 1) + line.size * 0.35;
          parts.push(`<text x="${cx}" y="${yPos}" font-size="${line.size}" font-weight="${line.weight}" fill="${VALUE_FILL}" text-anchor="middle">${escapeXml(line.text)}</text>`);
        });
      }
      continue;
    }

    // 'split' — two sub-cells stacked. Each = small header strip + value strip.
    for (let r = 0; r < 2; r++) {
      const rowY = tbo.y + subRowH * r;
      const sub = spec.rows[r];
      // Sub-row header strip
      parts.push(`<rect x="${mm(x)}" y="${mm(rowY)}" width="${mm(w)}" height="${mm(subHeaderH)}" fill="#f8fafc" stroke="${TB_STROKE}" stroke-width="0.5"/>`);
      if (sub.header) {
        parts.push(`<text x="${mm(x) + 4}" y="${mm(rowY) + mm(subHeaderH) - 1.5}" font-size="6.5" fill="${LABEL_FILL}">${escapeXml(sub.header)}</text>`);
      }
      // Sub-row value cell
      const valueY = rowY + subHeaderH;
      parts.push(`<rect x="${mm(x)}" y="${mm(valueY)}" width="${mm(w)}" height="${mm(subValueH)}" fill="white" stroke="${TB_STROKE}" stroke-width="0.5"/>`);
      if (sub.value) {
        const cx = mm(x) + mm(w) / 2;
        const cy = mm(valueY) + mm(subValueH) / 2 + sub.valueSize * 0.35;
        parts.push(`<text x="${cx}" y="${cy}" font-size="${sub.valueSize}" font-weight="${sub.valueWeight}" fill="${VALUE_FILL}" text-anchor="middle">${escapeXml(sub.value)}</text>`);
      }
    }
  }

  // Institution banner — thin strip just ABOVE the title block.
  // Slightly taller than before to accommodate Thai accents/vowel marks; text baseline
  // sits near the bottom of the strip so the full character height is visible.
  const bannerH = 6;
  const bannerY = tbo.y - bannerH;
  parts.push(`<rect x="${mm(tbo.x)}" y="${mm(bannerY)}" width="${mm(tbo.w)}" height="${mm(bannerH)}" fill="#f8fafc" stroke="${TB_STROKE}" stroke-width="0.5"/>`);
  parts.push(`<text x="${mm(tbo.x) + mm(tbo.w) / 2}" y="${mm(bannerY) + mm(bannerH) - 3}" font-size="8" font-weight="600" fill="${VALUE_FILL}" text-anchor="middle">${escapeXml(tb.institution)}</text>`);

  return parts.join('\n');
}

export function SheetNode({ data }: NodeProps) {
  const d = data as SheetData;
  const { w, h } = paperPx(d.paperSize);
  return (
    <div style={{ pointerEvents: 'none' }}>
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        style={{ display: 'block', fontFamily: 'Segoe UI, sans-serif' }}
        dangerouslySetInnerHTML={{ __html: sheetInnerSvg(d.titleBlock, d.paperSize) }}
      />
    </div>
  );
}

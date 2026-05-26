// Sheet geometry — ISO 5457 margins. 1 mm = 3 px on the canvas.
export const MM = 3;

export type PaperSize = 'A3' | 'A2' | 'A1';

export const PAPER_DIMS: Record<PaperSize, { wMM: number; hMM: number; label: string }> = {
  A3: { wMM: 420, hMM: 297, label: 'A3 landscape (420×297 mm)' },
  A2: { wMM: 594, hMM: 420, label: 'A2 landscape (594×420 mm)' },
  A1: { wMM: 841, hMM: 594, label: 'A1 landscape (841×594 mm)' },
};

// Inner drawing frame margins (mm): wider on the left for binding (ISO 5457).
export const MARGIN = { left: 20, top: 10, right: 10, bottom: 10 } as const;

// Title block now spans the FULL inner-frame width along the bottom (CADe SIMU style).
export const TB_HEIGHT_MM = 38;

export const paperPx = (size: PaperSize) => ({
  w: PAPER_DIMS[size].wMM * MM,
  h: PAPER_DIMS[size].hMM * MM,
});

/** Title block origin (in mm), positioned at the bottom of the inner drawing frame, full width. */
export const tbOriginMM = (size: PaperSize) => {
  const dim = PAPER_DIMS[size];
  return {
    x: MARGIN.left,
    y: dim.hMM - MARGIN.bottom - TB_HEIGHT_MM,
    w: dim.wMM - MARGIN.left - MARGIN.right,
    h: TB_HEIGHT_MM,
  };
};

/** Grid reference: how many columns × rows to label on the frame, by paper size. */
export const GRID_DIVISIONS: Record<PaperSize, { cols: number; rows: number }> = {
  A3: { cols: 8, rows: 6 },
  A2: { cols: 12, rows: 8 },
  A1: { cols: 16, rows: 12 },
};

// Letters used for column references (uppercase per CADe SIMU convention; skip I and O for clarity).
export const GRID_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export interface TitleBlock {
  institution: string;
  project: string;
  title: string;
  drawnBy: string;
  drawnDate: string;
  designedBy: string;
  signature: string;
  date: string; // approval / revision date
  page: string;
  fileName: string;
}

export const DEFAULT_TITLE_BLOCK: TitleBlock = {
  institution: 'คณะวิศวกรรมศาสตร์ มหาวิทยาลัยอุบลราชธานี / Faculty of Engineering, Ubon Ratchathani University',
  project: '1306 211 Electrical Engineering Workshop',
  title: '',
  drawnBy: '',
  drawnDate: new Date().toISOString().slice(0, 10),
  designedBy: '',
  signature: '',
  date: new Date().toISOString().slice(0, 10),
  page: '1/1',
  fileName: '',
};

export const SHEET_NODE_ID = '__sheet__';

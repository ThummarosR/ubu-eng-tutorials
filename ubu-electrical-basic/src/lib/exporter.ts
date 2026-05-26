import { Edge, Node } from '@xyflow/react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  IECNodeData,
  DESCRIPTORS,
  Rotation,
} from '../components/nodes/iec';
import { TextNodeData } from '../components/nodes/text';
import { sheetInnerSvg } from '../components/Sheet';
import { paperPx, PaperSize, TitleBlock } from '../sheet';

const isIEC = (n: Node): n is Node<IECNodeData> => n.type === 'iec';
const isText = (n: Node): n is Node<TextNodeData> => n.type === 'text';

const STROKE = '#0f172a';
const SW = 1.6;

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function rotatePoint(x: number, y: number, w: number, h: number, rot: Rotation) {
  switch (rot) {
    case 90:
      return { x: h - y, y: x };
    case 180:
      return { x: w - x, y: h - y };
    case 270:
      return { x: y, y: w - x };
    default:
      return { x, y };
  }
}

interface TerminalPoint {
  x: number;
  y: number;
}

function terminalsWorld(node: Node<IECNodeData>): Record<string, TerminalPoint> {
  const desc = DESCRIPTORS[node.data.kind];
  if (!desc) return {};
  const rot = (node.data.rotation ?? 0) as Rotation;
  const out: Record<string, TerminalPoint> = {};
  for (const h of desc.handles) {
    const p = rotatePoint(h.x, h.y, desc.w, desc.h, rot);
    out[h.id] = { x: node.position.x + p.x, y: node.position.y + p.y };
  }
  return out;
}

function symbolSvgString(node: Node<IECNodeData>): string {
  const desc = DESCRIPTORS[node.data.kind];
  if (!desc) return '';
  const rot = (node.data.rotation ?? 0) as Rotation;
  const inner = renderToStaticMarkup(
    desc.draw({
      closed: node.data.closed,
      lit: node.data.lit,
      color: node.data.color,
      label: node.data.label,
      delaying: node.data.delaying,
      value: node.data.value,
    }),
  );
  const rotAttr = rot ? ` transform="rotate(${rot}, ${desc.w / 2}, ${desc.h / 2})"` : '';
  return `<g${rotAttr}>${inner}</g>`;
}

export function diagramToSvg(
  allNodes: Node[],
  edges: Edge[],
  titleBlock: TitleBlock,
  paperSize: PaperSize,
): string {
  const { w: paperW, h: paperH } = paperPx(paperSize);
  const iecNodes = allNodes.filter(isIEC);
  const textNodes = allNodes.filter(isText);

  const termCache = new Map<string, Record<string, TerminalPoint>>();
  const getTerms = (n: Node<IECNodeData>) => {
    let t = termCache.get(n.id);
    if (!t) {
      t = terminalsWorld(n);
      termCache.set(n.id, t);
    }
    return t;
  };

  const wirePaths: string[] = [];
  for (const e of edges) {
    const src = iecNodes.find((n) => n.id === e.source);
    const tgt = iecNodes.find((n) => n.id === e.target);
    if (!src || !tgt) continue;
    const srcT = getTerms(src);
    const tgtT = getTerms(tgt);
    const sP: TerminalPoint = (e.sourceHandle ? srcT[e.sourceHandle] : undefined) ?? Object.values(srcT)[0];
    const tP: TerminalPoint = (e.targetHandle ? tgtT[e.targetHandle] : undefined) ?? Object.values(tgtT)[0];
    if (!sP || !tP) continue;
    const midX = (sP.x + tP.x) / 2;
    // Honour the per-edge stroke colour + width (set by examples or by the
    // Wire properties panel). Falls back to the default if neither is set.
    const style = (e.style ?? {}) as { stroke?: string; strokeWidth?: number };
    const stroke = style.stroke ?? STROKE;
    const strokeWidth = style.strokeWidth ?? SW;
    wirePaths.push(
      `<polyline points="${sP.x},${sP.y} ${midX},${sP.y} ${midX},${tP.y} ${tP.x},${tP.y}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"/>`,
    );
  }

  const symbolGroups: string[] = [];
  const labelTexts: string[] = [];
  for (const n of iecNodes) {
    const desc = DESCRIPTORS[n.data.kind];
    if (!desc) continue;
    const ox = n.position.x;
    const oy = n.position.y;
    symbolGroups.push(
      `<g transform="translate(${ox}, ${oy})" fill="none" stroke="${STROKE}" stroke-width="${SW}">${symbolSvgString(n)}</g>`,
    );
    // Only render the VALUE here (e.g. "2 A", "230 V"). The reference designator
    // (label) is drawn INSIDE the symbol SVG by each symbol function, so emitting
    // a "F2 = 2 A" text below would just duplicate the label.
    // Offset the value slightly to the RIGHT of the symbol's bottom-centre so it
    // doesn't sit on top of any wire leaving the bottom terminal.
    if (n.data.value) {
      const vx = ox + desc.w / 2 + 6;
      const vy = oy + desc.h + 12;
      labelTexts.push(
        `<text x="${vx}" y="${vy}" font-size="11" fill="#334155" text-anchor="start" font-family="Segoe UI, sans-serif">${escapeXml(n.data.value)}</text>`,
      );
    }
  }

  // Text annotations: render each line of the textarea as its own <text>.
  for (const n of textNodes) {
    const fs = n.data.fontSize ?? 14;
    const lines = (n.data.text ?? '').split('\n');
    lines.forEach((line, i) => {
      labelTexts.push(
        `<text x="${n.position.x + 4}" y="${n.position.y + fs * (i + 1)}" font-size="${fs}" fill="#0f172a" font-family="Segoe UI, sans-serif">${escapeXml(line)}</text>`,
      );
    });
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${paperW}" height="${paperH}" viewBox="0 0 ${paperW} ${paperH}" font-family="Segoe UI, sans-serif">
${sheetInnerSvg(titleBlock, paperSize)}
${wirePaths.join('\n')}
${symbolGroups.join('\n')}
${labelTexts.join('\n')}
</svg>`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function svgStringToPngBlob(svg: string, scale = 2): Promise<Blob> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svg, 'image/svg+xml');
  const root = doc.documentElement;
  const w = parseInt(root.getAttribute('width') || '800', 10);
  const h = parseInt(root.getAttribute('height') || '600', 10);

  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (e) => reject(e);
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Block-diagram reduction engine (v0.3.0 MVP — iterative series/parallel/feedback).
//
// Input:  React Flow nodes + edges from the canvas, where iec nodes have
//         kinds: block_g | block_k | block_p | block_i | block_d | summer |
//         pickoff | bd_input | bd_output.
//
// Output: { tf: SymExpr | null, steps: Step[], errors: string[] }
//   tf    — the reduced transfer function (symbolic if any block lacks a TF)
//   steps — ordered list of reduction moves, each with a Thai-flavoured
//           description + before/after expression for the walkthrough UI
//   errors — diagnostics if the diagram is malformed
//
// Algorithm covers the textbook canonical form (input → summer → forward chain
// with pickoff → feedback chain → summer). Multi-loop / non-reducible
// topologies → fall through with a "needs Mason" error.

import type { Edge, Node } from '@xyflow/react';
import type { IECNodeData, ComponentKind } from '../../components/nodes/iec';
import { tryParseRat } from './sympoly';
import {
  SymExpr, sym, lit, series, feedback, formatSym, isNumeric, toRat,
} from './symexpr';
import type { Rat } from '../analyze/poly';

const BLOCK_KINDS = new Set<ComponentKind>([
  'block_g', 'block_h', 'block_k', 'block_p', 'block_i', 'block_d',
]);

export interface Step {
  /** Short Thai label, e.g. "ขั้นที่ 1 — ต่ออนุกรม G1 · G2". */
  title: string;
  /** Optional extra description lines. */
  detail?: string[];
  /** Expression after this step, for the panel readout. */
  expr: SymExpr;
}

export interface Reduction {
  tf: SymExpr | null;
  numericTF: Rat | null;
  steps: Step[];
  errors: string[];
  warnings: string[];
}

/** Convert one block node into its SymExpr. Falls back to a symbolic name when
 *  the TF string is empty / unparseable. */
function blockExpr(n: Node<IECNodeData>): SymExpr {
  const label = n.data.label || (
    n.data.kind === 'block_k' ? 'K' :
    n.data.kind === 'block_p' ? 'P' :
    n.data.kind === 'block_i' ? 'I' :
    n.data.kind === 'block_d' ? 'D' :
    n.data.kind === 'block_h' ? 'H' : 'G'
  );
  const value = (n.data.value ?? '').trim();
  if (!value) return sym(`${label}(s)`);
  const r = tryParseRat(value);
  if (r) return lit(r, value);
  return sym(value); // user typed something like "K_p" — keep as symbol
}

export function reduce(nodes: Node[], edges: Edge[]): Reduction {
  const steps: Step[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  // Index iec nodes by id for quick lookup.
  const iec = new Map<string, Node<IECNodeData>>();
  for (const n of nodes) {
    if (n.type === 'iec') iec.set(n.id, n as Node<IECNodeData>);
  }

  const kindOf = (id: string): ComponentKind | undefined => iec.get(id)?.data.kind;

  // Outgoing / incoming edge maps (only iec→iec edges count).
  const outEdges = new Map<string, Edge[]>();
  const inEdges = new Map<string, Edge[]>();
  for (const e of edges) {
    if (!iec.has(e.source) || !iec.has(e.target)) continue;
    if (!outEdges.has(e.source)) outEdges.set(e.source, []);
    if (!inEdges.has(e.target)) inEdges.set(e.target, []);
    outEdges.get(e.source)!.push(e);
    inEdges.get(e.target)!.push(e);
  }

  // Locate input + output markers.
  const inputs = [...iec.values()].filter((n) => n.data.kind === 'bd_input');
  const outputs = [...iec.values()].filter((n) => n.data.kind === 'bd_output');
  if (inputs.length === 0) errors.push('ต้องมี R(s) input marker บน canvas');
  if (outputs.length === 0) errors.push('ต้องมี Y(s) output marker บน canvas');
  if (inputs.length > 1) warnings.push('มี input หลายตัว — ใช้ตัวแรก');
  if (outputs.length > 1) warnings.push('มี output หลายตัว — ใช้ตัวแรก');
  if (inputs.length === 0 || outputs.length === 0) {
    return { tf: null, numericTF: null, steps, errors, warnings };
  }

  // Walk: start at bd_input, follow forward edges. Series-collapse blocks.
  // Stop when we hit a summer (handle feedback), a pickoff (branch point), or
  // the output. For MVP we only handle the canonical single-loop form:
  //
  //    R --[+/-]-- summer --> [forward chain G] --> pickoff --> [tail] --> Y
  //                  ^                                 |
  //                  |                                 v
  //                  +----- [feedback chain H] <-------+

  type Trace = { expr: SymExpr; endsAt: string };

  /** Walk forward from a starting node id, collapsing each pure series link
   *  (1-out, 1-in). Stop when we reach a node with ≠1 outgoing edge OR the
   *  next node has ≠1 incoming edge OR we hit a non-block node. */
  const traceForward = (startId: string): Trace => {
    let cur = startId;
    let acc: SymExpr | null = null;
    const visited = new Set<string>([cur]);
    while (true) {
      const outs = outEdges.get(cur) ?? [];
      if (outs.length !== 1) return { expr: acc ?? lit({ n: [1], d: [1] }), endsAt: cur };
      const next = outs[0].target;
      if (visited.has(next)) {
        warnings.push('ตรวจพบ cycle ที่ไม่ใช่ feedback canonical — MVP ยังจัดการไม่ได้');
        return { expr: acc ?? lit({ n: [1], d: [1] }), endsAt: cur };
      }
      const nextKind = kindOf(next);
      if (!nextKind) return { expr: acc ?? lit({ n: [1], d: [1] }), endsAt: cur };
      // Only collapse if `next` is itself a single-in block. Otherwise stop.
      const nIn = inEdges.get(next)?.length ?? 0;
      if (nIn !== 1) return { expr: acc ?? lit({ n: [1], d: [1] }), endsAt: cur };
      if (BLOCK_KINDS.has(nextKind)) {
        const be = blockExpr(iec.get(next)!);
        acc = acc ? series(acc, be) : be;
        cur = next;
        visited.add(next);
        continue;
      }
      // summer / pickoff / output — stop, let outer logic handle.
      return { expr: acc ?? lit({ n: [1], d: [1] }), endsAt: cur };
    }
  };

  const input = inputs[0];
  const output = outputs[0];

  // From input, the first non-input downstream node should be a block or summer.
  const firstOut = (outEdges.get(input.id) ?? [])[0];
  if (!firstOut) {
    errors.push('R(s) ยังไม่ได้ต่อกับอะไร');
    return { tf: null, numericTF: null, steps, errors, warnings };
  }

  let cursor = firstOut.target;
  let acc: SymExpr | null = null;

  // === Pre-summer series (rare but allowed): blocks between R and the summer.
  if (kindOf(cursor) && BLOCK_KINDS.has(kindOf(cursor)!)) {
    const t = traceForward(cursor);
    // Need to include the block at `cursor` itself.
    const startExpr = blockExpr(iec.get(cursor)!);
    const combined = t.expr.kind === 'rat' && (t.expr.r.n.length === 1 && t.expr.r.n[0] === 1 && t.expr.r.d.length === 1 && t.expr.r.d[0] === 1)
      ? startExpr  // traceForward couldn't extend
      : series(startExpr, t.expr);
    acc = combined;
    cursor = t.endsAt;
    // Move past the last collapsed block — t.endsAt is the LAST block we ate.
    const tailEdge = (outEdges.get(cursor) ?? [])[0];
    if (tailEdge) cursor = tailEdge.target;
  }

  // === Summer (start of feedback loop, if any)
  if (kindOf(cursor) === 'summer') {
    const summer = iec.get(cursor)!;
    const summerIns = inEdges.get(summer.id) ?? [];
    if (summerIns.length < 2) {
      warnings.push(`summer "${summer.id}" มี input < 2 — ข้าม feedback`);
    } else {
      // Forward output of the summer.
      const summerOuts = outEdges.get(summer.id) ?? [];
      if (summerOuts.length !== 1) {
        errors.push('summer ต้องมี output 1 ทาง');
        return { tf: null, numericTF: null, steps, errors, warnings };
      }
      const forwardStart = summerOuts[0].target;

      // Trace forward chain G from after the summer.
      let G: SymExpr | null = null;
      let pickoffId: string | null = null;
      if (kindOf(forwardStart) && BLOCK_KINDS.has(kindOf(forwardStart)!)) {
        const gStart = blockExpr(iec.get(forwardStart)!);
        const gExt = traceForward(forwardStart);
        const gExtIsId = gExt.expr.kind === 'rat' && gExt.expr.r.n.length === 1 && gExt.expr.r.n[0] === 1 && gExt.expr.r.d.length === 1 && gExt.expr.r.d[0] === 1;
        G = gExtIsId ? gStart : series(gStart, gExt.expr);
        const tailEdge = (outEdges.get(gExt.endsAt) ?? [])[0];
        if (tailEdge && kindOf(tailEdge.target) === 'pickoff') {
          pickoffId = tailEdge.target;
        }
      } else if (kindOf(forwardStart) === 'pickoff') {
        G = lit({ n: [1], d: [1] }); // unity forward path
        pickoffId = forwardStart;
      } else {
        errors.push('หลัง summer คาดว่าจะเจอ block หรือ pickoff');
        return { tf: null, numericTF: null, steps, errors, warnings };
      }

      steps.push({
        title: 'ขั้นที่ 1 — รวม forward path เป็น G(s)',
        detail: [`G(s) = ${formatSym(G)}`],
        expr: G,
      });

      // === Feedback (if pickoff exists)
      if (pickoffId) {
        const pickoffOuts = outEdges.get(pickoffId) ?? [];
        // One output continues to Y, others feed back.
        let toOutput: Edge | null = null;
        const feedbackEdges: Edge[] = [];
        for (const e of pickoffOuts) {
          // The output edge eventually leads to bd_output; feedback edges lead
          // back to summer (possibly through H blocks).
          if (leadsTo(e.target, output.id, outEdges, kindOf)) toOutput = e;
          else feedbackEdges.push(e);
        }
        if (feedbackEdges.length > 0) {
          // Trace each feedback path back to the summer.
          // For canonical SISO we expect exactly 1 feedback path.
          const fbStart = feedbackEdges[0].target;
          let H: SymExpr = lit({ n: [1], d: [1] });
          if (kindOf(fbStart) && BLOCK_KINDS.has(kindOf(fbStart)!)) {
            const hStart = blockExpr(iec.get(fbStart)!);
            const hExt = traceForward(fbStart);
            const hExtIsId = hExt.expr.kind === 'rat' && hExt.expr.r.n.length === 1 && hExt.expr.r.n[0] === 1 && hExt.expr.r.d.length === 1 && hExt.expr.r.d[0] === 1;
            H = hExtIsId ? hStart : series(hStart, hExt.expr);
          }

          // Determine feedback sign from the summer's signs[] for whichever
          // input the feedback wire lands on. handle id is in feedbackEdges
          // returning to summer — find the corresponding edge in summerIns.
          const fbReturn = findFeedbackReturn(fbStart, summer.id, outEdges, kindOf);
          const sign = summerSignForHandle(summer, fbReturn);

          steps.push({
            title: 'ขั้นที่ 2 — รวม feedback path เป็น H(s)',
            detail: [`H(s) = ${formatSym(H)}`],
            expr: H,
          });

          const T = feedback(G, H, sign === '+');
          steps.push({
            title: 'ขั้นที่ 3 — สูตร feedback',
            detail: [
              sign === '-'
                ? `T(s) = G / (1 + G·H)   (negative feedback)`
                : `T(s) = G / (1 − G·H)   (positive feedback)`,
              `T(s) = ${formatSym(T)}`,
            ],
            expr: T,
          });
          acc = acc ? series(acc, T) : T;
        } else {
          // Pickoff with no feedback — just continue through forward path.
          acc = acc ? series(acc, G) : G;
        }
        // Continue from after the pickoff toward output.
        if (toOutput) {
          cursor = toOutput.target;
        }
      } else {
        acc = acc ? series(acc, G) : G;
      }
    }
  } else if (kindOf(cursor) && BLOCK_KINDS.has(kindOf(cursor)!)) {
    // No summer — straight forward chain from input → blocks → output.
    const gStart = blockExpr(iec.get(cursor)!);
    const gExt = traceForward(cursor);
    const gExtIsId = gExt.expr.kind === 'rat' && gExt.expr.r.n.length === 1 && gExt.expr.r.n[0] === 1 && gExt.expr.r.d.length === 1 && gExt.expr.r.d[0] === 1;
    acc = gExtIsId ? gStart : series(gStart, gExt.expr);
    steps.push({
      title: 'forward chain',
      detail: [`T(s) = ${formatSym(acc)}`],
      expr: acc,
    });
  } else if (kindOf(cursor) === 'bd_output') {
    // Direct R → Y, identity TF.
    acc = lit({ n: [1], d: [1] });
  }

  if (!acc) {
    errors.push('ลด block diagram ไม่สำเร็จ');
    return { tf: null, numericTF: null, steps, errors, warnings };
  }

  const numericTF = isNumeric(acc) ? toRat(acc) : null;
  return { tf: acc, numericTF, steps, errors, warnings };
}

// ─── Helpers ────────────────────────────────────────────────────────────

function leadsTo(
  startId: string,
  targetId: string,
  outEdges: Map<string, Edge[]>,
  kindOf: (id: string) => ComponentKind | undefined,
): boolean {
  const seen = new Set<string>();
  const stack = [startId];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === targetId) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    // Don't go through summers / pickoffs in reverse — only forward direction.
    if (kindOf(cur) === 'summer') continue; // summer would loop us back
    for (const e of outEdges.get(cur) ?? []) stack.push(e.target);
  }
  return false;
}

function findFeedbackReturn(
  startId: string,
  summerId: string,
  outEdges: Map<string, Edge[]>,
  kindOf: (id: string) => ComponentKind | undefined,
): string | null {
  // Walk forward through feedback chain until we hit the summer; return the
  // handle id we land on.
  const seen = new Set<string>();
  let cur = startId;
  while (!seen.has(cur)) {
    seen.add(cur);
    for (const e of outEdges.get(cur) ?? []) {
      if (e.target === summerId) return e.targetHandle ?? null;
      const k = kindOf(e.target);
      if (k && BLOCK_KINDS.has(k)) {
        cur = e.target;
        break;
      }
    }
  }
  return null;
}

function summerSignForHandle(summer: Node<IECNodeData>, handleId: string | null): '+' | '-' {
  // signs[] is indexed by handle index. Handle ids are in0, in1, in2, in3 —
  // use the trailing digit to index.
  if (!handleId) return '-'; // default to negative feedback (textbook default)
  const m = /^in(\d+)$/.exec(handleId);
  if (!m) return '-';
  const idx = parseInt(m[1], 10);
  return summer.data.signs?.[idx] ?? (idx === 0 ? '+' : '-');
}

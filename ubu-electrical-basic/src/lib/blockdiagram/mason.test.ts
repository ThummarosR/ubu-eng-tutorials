import { describe, it, expect } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import type { IECNodeData, ComponentKind } from '../../components/nodes/iec';
import { reduceMason } from './mason';
import { isNumeric, toRat, formatSym } from './symexpr';

// ─── Builder helpers ────────────────────────────────────────────────────
let _id = 0;
const nextId = () => `n${++_id}`;
const reset = () => { _id = 0; };

function node(kind: ComponentKind, extra: Partial<IECNodeData> = {}): Node<IECNodeData> {
  return {
    id: nextId(),
    type: 'iec',
    position: { x: 0, y: 0 },
    data: { kind, ...extra },
  };
}

function edge(
  source: string, sourceHandle: string,
  target: string, targetHandle: string,
): Edge {
  return {
    id: `e${source}->${target}`,
    source, target, sourceHandle, targetHandle,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe('reduceMason — error cases', () => {
  it('reports missing R(s) input', () => {
    reset();
    const out = node('bd_output');
    const r = reduceMason([out], []);
    expect(r.errors.some((e) => e.includes('R(s)'))).toBe(true);
    expect(r.tf).toBeNull();
  });

  it('reports missing Y(s) output', () => {
    reset();
    const inp = node('bd_input');
    const r = reduceMason([inp], []);
    expect(r.errors.some((e) => e.includes('Y(s)'))).toBe(true);
    expect(r.tf).toBeNull();
  });

  it('reports disconnected diagram (no forward path)', () => {
    reset();
    const inp = node('bd_input');
    const out = node('bd_output');
    // No edges — input and output isolated.
    const r = reduceMason([inp, out], []);
    expect(r.errors.some((e) => e.includes('forward path'))).toBe(true);
  });
});

describe('reduceMason — trivial diagrams', () => {
  it('R → Y direct: T = 1', () => {
    reset();
    const inp = node('bd_input');
    const out = node('bd_output');
    const r = reduceMason([inp, out], [edge(inp.id, 'out', out.id, 'in')]);
    expect(r.tf).not.toBeNull();
    expect(isNumeric(r.tf!)).toBe(true);
    const t = toRat(r.tf!);
    expect(t.n).toEqual([1]);
    expect(t.d).toEqual([1]);
  });

  it('R → G → Y: T = G', () => {
    reset();
    const inp = node('bd_input');
    const g = node('block_g', { label: 'G', value: '1/(s+1)' });
    const out = node('bd_output');
    const r = reduceMason([inp, g, out], [
      edge(inp.id, 'out', g.id, 'in'),
      edge(g.id, 'out', out.id, 'in'),
    ]);
    expect(r.tf).not.toBeNull();
    expect(isNumeric(r.tf!)).toBe(true);
    const t = toRat(r.tf!);
    expect(t.n).toEqual([1]);
    expect(t.d).toEqual([1, 1]); // 1 + s
  });

  it('R → G1 → G2 → Y (series): T = G1·G2', () => {
    reset();
    const inp = node('bd_input');
    const g1 = node('block_g', { label: 'G1', value: '1/(s+1)' });
    const g2 = node('block_g', { label: 'G2', value: '2' });
    const out = node('bd_output');
    const r = reduceMason([inp, g1, g2, out], [
      edge(inp.id, 'out', g1.id, 'in'),
      edge(g1.id, 'out', g2.id, 'in'),
      edge(g2.id, 'out', out.id, 'in'),
    ]);
    const t = toRat(r.tf!);
    expect(t.n).toEqual([2]);
    expect(t.d).toEqual([1, 1]);
  });

  it('Symbolic R → G → Y stays symbolic', () => {
    reset();
    const inp = node('bd_input');
    const g = node('block_g', { label: 'G', value: '' });  // no TF set
    const out = node('bd_output');
    const r = reduceMason([inp, g, out], [
      edge(inp.id, 'out', g.id, 'in'),
      edge(g.id, 'out', out.id, 'in'),
    ]);
    expect(r.tf).not.toBeNull();
    expect(isNumeric(r.tf!)).toBe(false);
    expect(formatSym(r.tf!)).toContain('G(s)');
  });
});

describe('reduceMason — canonical feedback loop', () => {
  it('R → Σ(+/−) → G → ● → Y, H feedback: T = G/(1+GH)', () => {
    reset();
    const inp = node('bd_input');
    const sum = node('summer', { signs: ['+', '-'], arity: 2 });
    const g = node('block_g', { label: 'G', value: '1/(s+1)' });
    const pk = node('pickoff', { arity: 2 });
    const h = node('block_h', { label: 'H', value: '1' });
    const out = node('bd_output');

    const edges = [
      edge(inp.id, 'out', sum.id, 'in0'),     // R → summer (+)
      edge(sum.id, 'out', g.id, 'in'),         // summer → G
      edge(g.id, 'out', pk.id, 'in'),          // G → pickoff
      edge(pk.id, 'out0', out.id, 'in'),       // pickoff → Y
      edge(pk.id, 'out1', h.id, 'in'),         // pickoff → H
      edge(h.id, 'out', sum.id, 'in1'),        // H → summer (−)
    ];

    const r = reduceMason([inp, sum, g, pk, h, out], edges);
    expect(r.errors).toEqual([]);
    expect(r.paths).toHaveLength(1);
    expect(r.loops).toHaveLength(1);

    // Forward path: R → Σ(+) → G → ● → Y, gain = G = 1/(s+1)
    const pGain = toRat(r.paths[0].gain);
    expect(pGain.n).toEqual([1]);
    expect(pGain.d).toEqual([1, 1]);

    // Loop gain: Σ(−) · G · 1 · H = −G·H = −1·1/(s+1) = −1/(s+1)
    expect(isNumeric(r.loops[0].gain)).toBe(true);
    const lGain = toRat(r.loops[0].gain);
    expect(lGain.n).toEqual([-1]);
    expect(lGain.d).toEqual([1, 1]);

    // T(s) = G/(1+GH) = [1/(s+1)] / [1 + 1/(s+1)] = 1/(s+2)
    expect(isNumeric(r.tf!)).toBe(true);
    const t = toRat(r.tf!);
    expect(t.n).toEqual([1]);
    expect(t.d).toEqual([2, 1]);
  });

  it('positive feedback (Σ has both + signs) gives T = G/(1-G·H)', () => {
    reset();
    const inp = node('bd_input');
    const sum = node('summer', { signs: ['+', '+'], arity: 2 });
    const g = node('block_g', { label: 'G', value: '2' });
    const pk = node('pickoff', { arity: 2 });
    const h = node('block_h', { label: 'H', value: '0.25' });
    const out = node('bd_output');

    const edges = [
      edge(inp.id, 'out', sum.id, 'in0'),
      edge(sum.id, 'out', g.id, 'in'),
      edge(g.id, 'out', pk.id, 'in'),
      edge(pk.id, 'out0', out.id, 'in'),
      edge(pk.id, 'out1', h.id, 'in'),
      edge(h.id, 'out', sum.id, 'in1'),
    ];

    const r = reduceMason([inp, sum, g, pk, h, out], edges);
    // Loop gain at the +-sign return = +1·G·H = +2·0.25 = +0.5
    expect(toRat(r.loops[0].gain).n[0]).toBeCloseTo(0.5);
    // T = 2 / (1 - 0.5) = 4
    const t = toRat(r.tf!);
    expect(t.n[0]).toBeCloseTo(4);
    expect(t.d[0]).toBeCloseTo(1);
  });

  it('symbolic feedback: T = G(s)/(1+G(s)·H(s))', () => {
    reset();
    const inp = node('bd_input');
    const sum = node('summer', { signs: ['+', '-'], arity: 2 });
    const g = node('block_g', { label: 'G' }); // no TF
    const pk = node('pickoff', { arity: 2 });
    const h = node('block_h', { label: 'H' }); // no TF
    const out = node('bd_output');

    const edges = [
      edge(inp.id, 'out', sum.id, 'in0'),
      edge(sum.id, 'out', g.id, 'in'),
      edge(g.id, 'out', pk.id, 'in'),
      edge(pk.id, 'out0', out.id, 'in'),
      edge(pk.id, 'out1', h.id, 'in'),
      edge(h.id, 'out', sum.id, 'in1'),
    ];

    const r = reduceMason([inp, sum, g, pk, h, out], edges);
    expect(r.tf).not.toBeNull();
    expect(isNumeric(r.tf!)).toBe(false);
    const s = formatSym(r.tf!);
    expect(s).toContain('G(s)');
    expect(s).toContain('H(s)');
    expect(s).toContain('/');
  });
});

describe('reduceMason — multi-loop topologies', () => {
  it('two nested feedback loops (touching, sharing G2)', () => {
    reset();
    // R → Σ1(+/−) → G1 → Σ2(+/−) → G2 → ●2 → Y
    //                ↑               ↑      |
    //                |               └──H2──┘
    //                └─────── H1 ───────────┘ (from ●2 back to Σ1−)
    //
    // Loops:
    //   L1 = Σ1(−) · G1 · Σ2(+) · G2 · H1 = -G1·G2·H1  (outer)
    //   L2 = Σ2(−) · G2 · H2 = -G2·H2                   (inner)
    // Both loops share G2 → they TOUCH → Δ = 1 - L1 - L2 = 1 + G1·G2·H1 + G2·H2
    const inp = node('bd_input');
    const sum1 = node('summer', { signs: ['+', '-'], arity: 2 });
    const g1 = node('block_g', { label: 'G1', value: '1' });
    const sum2 = node('summer', { signs: ['+', '-'], arity: 2 });
    const g2 = node('block_g', { label: 'G2', value: '1' });
    const pk2 = node('pickoff', { arity: 2 });
    const h2 = node('block_h', { label: 'H2', value: '1' });
    const h1 = node('block_h', { label: 'H1', value: '1' });
    const out = node('bd_output');

    const edges = [
      edge(inp.id, 'out', sum1.id, 'in0'),
      edge(sum1.id, 'out', g1.id, 'in'),
      edge(g1.id, 'out', sum2.id, 'in0'),
      edge(sum2.id, 'out', g2.id, 'in'),
      edge(g2.id, 'out', pk2.id, 'in'),
      edge(pk2.id, 'out0', out.id, 'in'),
      edge(pk2.id, 'out1', h2.id, 'in'),
      edge(h2.id, 'out', sum2.id, 'in1'),
      // For the outer feedback we need ANOTHER pickoff on the output of pk2 to
      // route to H1. Re-use pk2 only has 2 outputs; we need 3. Bump arity to 3
      // and add the H1 path.
    ];
    pk2.data.arity = 3;
    edges.push(edge(pk2.id, 'out2', h1.id, 'in'));
    edges.push(edge(h1.id, 'out', sum1.id, 'in1'));

    const r = reduceMason([inp, sum1, g1, sum2, g2, pk2, h2, h1, out], edges);
    expect(r.errors).toEqual([]);
    expect(r.paths.length).toBeGreaterThanOrEqual(1);
    expect(r.loops).toHaveLength(2);

    // With all unit-value TFs:
    //   L1 = -1, L2 = -1
    //   Δ = 1 - (L1 + L2) + (touching → no L1·L2 term) = 1 - (-1 - 1) = 3
    //   P1 · Δ1 / Δ — Δ1 = 1 (both loops touch the path)
    //   T(0) = 1/3
    // (toRat normalises so leading coefficient of d is 1; for a constant
    //  T we get { n: [1/3], d: [1] } rather than { n: [1], d: [3] }.)
    const t = toRat(r.tf!);
    const dc = t.n[0] / t.d[0];
    expect(dc).toBeCloseTo(1 / 3);
  });

  it('two NON-touching loops: Δ has L1·L2 term', () => {
    reset();
    // Diagram: R → Σ1(+,−) → G1 → ●1 → Σ2(+,−) → G2 → ●2 → Y
    //                        ↑                          |
    //                        └─── H1 ←── ●1            |
    //                                                  └─── H2 ───┐
    //                                  ↑                          │
    //                                  └──── Σ2(−) ←──────────────┘
    //
    // Loops:
    //   L1 = ●1 → H1 → Σ1(−) → G1 → ●1 = -G1·H1
    //   L2 = ●2 → H2 → Σ2(−) → G2 → ●2 = -G2·H2
    // No shared nodes → NON-TOUCHING → Δ = 1 - L1 - L2 + L1·L2
    //                                    = 1 + G1·H1 + G2·H2 + G1·H1·G2·H2
    const inp = node('bd_input');
    const sum1 = node('summer', { signs: ['+', '-'], arity: 2 });
    const g1 = node('block_g', { label: 'G1', value: '1' });
    const pk1 = node('pickoff', { arity: 2 });
    const h1 = node('block_h', { label: 'H1', value: '1' });
    const sum2 = node('summer', { signs: ['+', '-'], arity: 2 });
    const g2 = node('block_g', { label: 'G2', value: '1' });
    const pk2 = node('pickoff', { arity: 2 });
    const h2 = node('block_h', { label: 'H2', value: '1' });
    const out = node('bd_output');

    const edges = [
      edge(inp.id, 'out', sum1.id, 'in0'),
      edge(sum1.id, 'out', g1.id, 'in'),
      edge(g1.id, 'out', pk1.id, 'in'),
      edge(pk1.id, 'out0', sum2.id, 'in0'),
      edge(pk1.id, 'out1', h1.id, 'in'),
      edge(h1.id, 'out', sum1.id, 'in1'),
      edge(sum2.id, 'out', g2.id, 'in'),
      edge(g2.id, 'out', pk2.id, 'in'),
      edge(pk2.id, 'out0', out.id, 'in'),
      edge(pk2.id, 'out1', h2.id, 'in'),
      edge(h2.id, 'out', sum2.id, 'in1'),
    ];

    const r = reduceMason(
      [inp, sum1, g1, pk1, h1, sum2, g2, pk2, h2, out],
      edges,
    );
    expect(r.errors).toEqual([]);
    expect(r.loops).toHaveLength(2);

    // With all unit values:
    //   L1 = L2 = -1
    //   Δ = 1 - (L1 + L2) + L1·L2 = 1 - (-2) + 1 = 4
    //   P1 = G1·G2 = 1
    //   Δ1 = 1 (both loops touch the path)
    //   T(0) = 1/4
    const t = toRat(r.tf!);
    const dc = t.n[0] / t.d[0];
    expect(dc).toBeCloseTo(1 / 4);
  });
});

describe('reduceMason — walkthrough steps', () => {
  it('produces forward-path, loops, Δ, and Mason formula steps', () => {
    reset();
    const inp = node('bd_input');
    const sum = node('summer', { signs: ['+', '-'], arity: 2 });
    const g = node('block_g', { label: 'G', value: '1' });
    const pk = node('pickoff', { arity: 2 });
    const h = node('block_h', { label: 'H', value: '1' });
    const out = node('bd_output');
    const edges = [
      edge(inp.id, 'out', sum.id, 'in0'),
      edge(sum.id, 'out', g.id, 'in'),
      edge(g.id, 'out', pk.id, 'in'),
      edge(pk.id, 'out0', out.id, 'in'),
      edge(pk.id, 'out1', h.id, 'in'),
      edge(h.id, 'out', sum.id, 'in1'),
    ];
    const r = reduceMason([inp, sum, g, pk, h, out], edges);

    const titles = r.steps.map((s) => s.title);
    expect(titles.some((t) => t.includes('Forward paths'))).toBe(true);
    expect(titles.some((t) => t.includes('Loops'))).toBe(true);
    expect(titles.some((t) => t.includes('Δ'))).toBe(true);
    expect(titles.some((t) => t.toLowerCase().includes("mason"))).toBe(true);
  });
});

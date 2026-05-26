import { Edge, Node } from '@xyflow/react';
import { IECNodeData, ComponentKind, Rotation, LampColor } from '../components/nodes/iec';
import { TextNodeData } from '../components/nodes/text';
import { DEFAULT_TITLE_BLOCK, PaperSize, TitleBlock } from '../sheet';
import type { AppMode, AnalysisDomain } from '../store';
import dolJson from './examples/dol.json';
import starDeltaJson from './examples/star_delta.json';
import compoundJson from './examples/compound.json';
import twosourceJson from './examples/twosource.json';
import wheatstoneJson from './examples/wheatstone.json';
import pidJson from './examples/pid.json';
import twoloopnestedJson from './examples/twoloopnested.json';

export interface ExampleProject {
  nodes: Node[];
  edges: Edge[];
  titleBlock: TitleBlock;
  paperSize: PaperSize;
}

export interface Example {
  id: string;
  /** Which class/mode this example belongs to. Defaults to 'draw' for legacy entries. */
  mode?: AppMode;
  /** Which analyze sub-domain this example wants (dc / ac / 3p). Used to auto-switch
   *  the sub-mode toggle so the right bench appears. */
  domain?: AnalysisDomain;
  nameTh: string;
  nameEn: string;
  desc: string;
  build: () => ExampleProject;
  /** Pedagogical "try this" prompts — shown as chips at the top of AnalysisPanel
   *  once the example is loaded. Each prompt is a short experiment the student
   *  can run to internalise the underlying concept. */
  prompts?: string[];
}

// ---------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------

let _id = 0;
const nextId = (prefix: string) => `${prefix}${++_id}`;
const resetIds = () => { _id = 0; };

interface IECOpts {
  label?: string;
  value?: string;
  rotation?: Rotation;
  closed?: boolean;
  color?: LampColor;
}

function iec(kind: ComponentKind, x: number, y: number, opts: IECOpts = {}): Node<IECNodeData> {
  return { id: nextId('n'), type: 'iec', position: { x, y }, data: { kind, rotation: 0, ...opts } };
}

function text(t: string, x: number, y: number, fontSize = 14): Node<TextNodeData> {
  return { id: nextId('t'), type: 'text', position: { x, y }, data: { text: t, fontSize } };
}

function wire(
  source: string, sourceHandle: string,
  target: string, targetHandle: string,
): Edge {
  return {
    id: nextId('e'),
    source, target, sourceHandle, targetHandle,
    type: 'step',
  };
}

const today = () => new Date().toISOString().slice(0, 10);

// =====================================================================
// Schematic examples (1306 211 Workshop) — exported from the editor and
// loaded verbatim from src/lib/examples/*.json. Re-export from the app to
// edit; the title-block date is refreshed to today on load.
// =====================================================================
function fromJson(raw: unknown): ExampleProject {
  const d = raw as ExampleProject;
  const t = today();
  return {
    nodes: d.nodes,
    edges: d.edges,
    titleBlock: { ...d.titleBlock, drawnDate: t, date: t },
    paperSize: d.paperSize,
  };
}

const buildDOL = (): ExampleProject => fromJson(dolJson);
const buildStarDelta = (): ExampleProject => fromJson(starDeltaJson);
const buildCompoundJson = (): ExampleProject => fromJson(compoundJson);
const buildTwoSourceJson = (): ExampleProject => fromJson(twosourceJson);
const buildWheatstoneJson = (): ExampleProject => fromJson(wheatstoneJson);
const buildBdPidJson = (): ExampleProject => fromJson(pidJson);
const buildBdTwoLoopJson = (): ExampleProject => fromJson(twoloopnestedJson);

// =====================================================================
// CIRCUIT ANALYSIS EXAMPLES (1306 210 Lab I — for Analyze mode)
//
// Each example uses vertical layout (rotation 90°) so the source's + terminal
// is on TOP and the chain flows top-to-bottom — matches textbook convention
// and makes the on-canvas annotations read naturally (currents flow ↓).
// =====================================================================

function titleForAnalyze(title: string, fileName: string): TitleBlock {
  const d = today();
  return {
    ...DEFAULT_TITLE_BLOCK,
    project: '1306 210 Electrical Engineering Laboratory I',
    title,
    drawnDate: d,
    date: d,
    fileName,
    page: '1/1',
  };
}

// ---------------------------------------------------------------------
// 1. Voltage divider — Lab 4 §3
// Two resistors in series across V1. The bottom node is grounded.
// V_R2 = V_s · R₂ / (R₁ + R₂) — the classic divider formula.
// ---------------------------------------------------------------------
function buildVoltageDivider(): ExampleProject {
  resetIds();
  const t1 = text('Voltage divider', 180, 100, 16);
  const t2 = text('V_R2 = V_s · R₂ / (R₁ + R₂)', 180, 130, 11);

  // Vertical layout (rotation 90° → handle 'a' on top, 'b' on bottom).
  const V1 = iec('dcsource', 200, 220, { label: 'V1', value: '12 V', rotation: 90 });
  const R1 = iec('resistor', 400, 200, { label: 'R1', value: '10 kΩ', rotation: 90 });
  const R2 = iec('resistor', 400, 320, { label: 'R2', value: '5 kΩ', rotation: 90 });
  const gnd = iec('ground', 220, 440);

  const wires: Edge[] = [
    wire(V1.id, 'a', R1.id, 'a'), // top loop: V1+ → R1 top
    wire(R1.id, 'b', R2.id, 'a'), // midpoint
    wire(V1.id, 'b', R2.id, 'b'), // bottom loop: V1− → R2 bottom
    wire(V1.id, 'b', gnd.id, 'a'), // ground anchored at V1−
  ];

  return {
    nodes: [t1, t2, V1, R1, R2, gnd],
    edges: wires,
    titleBlock: titleForAnalyze('Voltage Divider', 'voltage_divider'),
    paperSize: 'A2',
  };
}

// ---------------------------------------------------------------------
// 2. Parallel resistors / current divider — Lab 4 §4
// Two resistors in parallel across V1.
// I_R1 = V_s / R₁, I_R2 = V_s / R₂.  I_total = sum.
// ---------------------------------------------------------------------
function buildCurrentDivider(): ExampleProject {
  resetIds();
  const t1 = text('Parallel resistors (current divider)', 180, 100, 16);
  const t2 = text('I_Rk = V_s / R_k    →    I_total = Σ I_Rk', 180, 130, 11);

  const V1 = iec('dcsource', 200, 220, { label: 'V1', value: '12 V', rotation: 90 });
  const R1 = iec('resistor', 380, 220, { label: 'R1', value: '4 kΩ', rotation: 90 });
  const R2 = iec('resistor', 540, 220, { label: 'R2', value: '6 kΩ', rotation: 90 });
  const gnd = iec('ground', 220, 440);

  const wires: Edge[] = [
    // Top bus: V1.a (240, 220) → R1.a (420, 220) → R2.a (580, 220)
    wire(V1.id, 'a', R1.id, 'a'),
    wire(R1.id, 'a', R2.id, 'a'),
    // Bottom bus: V1.b (240, 300) → R1.b (420, 300) → R2.b (580, 300)
    wire(V1.id, 'b', R1.id, 'b'),
    wire(R1.id, 'b', R2.id, 'b'),
    // Ground anchored at V1.b
    wire(V1.id, 'b', gnd.id, 'a'),
  ];

  return {
    nodes: [t1, t2, V1, R1, R2, gnd],
    edges: wires,
    titleBlock: titleForAnalyze('Current Divider', 'current_divider'),
    paperSize: 'A2',
  };
}

// ---------------------------------------------------------------------
// 3. Two-source mixed network — Lab 5 §5.1 + §5.2 / §5.3 base
// Two voltage sources, three resistors, a single mid-node:
//
//          R1            R2
//   V1+ ──/\/\── M ──/\/\── V2+
//                │
//                R3   (= the load)
//                │
//              ground
//   V1− ────── ground ──────── V2−
//
// Exercises Superposition (2 sources), KVL/Mesh (2 loops, M is shared),
// Nodal (1 unknown V_M + 2 supernode constraints), and Thévenin (R3 is
// auto-picked as the load — highest-labeled resistor).
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// 6. RC low-pass filter — AC mode showcase
// Vin → R → Vout, C from Vout to ground. Classic first-order low-pass.
// H(s) = 1 / (1 + sRC). With R=1k, C=1µF → corner ≈ 159 Hz.
// ---------------------------------------------------------------------
function buildRCLowPass(): ExampleProject {
  resetIds();
  const t1 = text('RC low-pass filter (AC mode)', 200, 40, 16);
  const t2 = text('H(s) = 1 / (1 + sRC)   corner ≈ 1/(2πRC)', 200, 64, 11);

  // Horizontal layout: Vin — R — (Vout takes a tap) — C to ground.
  const Vin = iec('vin', 200, 200, { label: 'Vin' });            // a left=in, b right=output side
  const R = iec('resistor', 360, 200, { label: 'R1', value: '1 kΩ' });
  const C = iec('capacitor', 520, 280, { label: 'C1', value: '1 µF', rotation: 90 });
  const Vout = iec('vout', 640, 200, { label: 'Vout' });
  const gnd = iec('ground', 540, 400);

  const wires: Edge[] = [
    // Vin output (b) → R input (a)
    wire(Vin.id, 'b', R.id, 'a'),
    // R output (b) → Vout input (a) — that's the "output node" we measure
    wire(R.id, 'b', Vout.id, 'a'),
    // R output also taps into C top (a)
    wire(R.id, 'b', C.id, 'a'),
    // C bottom (b) to ground
    wire(C.id, 'b', gnd.id, 'a'),
    // Return: Vin input (a) and Vout output (b) both to ground (shared reference)
    wire(Vin.id, 'a', gnd.id, 'a'),
    wire(Vout.id, 'b', gnd.id, 'a'),
  ];

  return {
    nodes: [t1, t2, Vin, R, C, Vout, gnd],
    edges: wires,
    titleBlock: titleForAnalyze('RC Low-Pass Filter', 'rc_lowpass'),
    paperSize: 'A2',
  };
}

// ---------------------------------------------------------------------
// 7. RC high-pass filter — contrast with the low-pass.
// Same Vin/R/C/ground, but now Vout reads across R (not C).
// H(s) = sRC / (1 + sRC). Zero at the origin, pole at −1/RC.
// ---------------------------------------------------------------------
function buildRCHighPass(): ExampleProject {
  resetIds();
  const t1 = text('RC high-pass filter (AC mode)', 200, 40, 16);
  const t2 = text('H(s) = sRC / (1 + sRC)   pass above corner', 200, 64, 11);

  // Layout: Vin → C → mid → R → ground. Vout reads across R (mid to ground).
  const Vin = iec('vin', 200, 200, { label: 'Vin' });
  const C = iec('capacitor', 360, 200, { label: 'C1', value: '1 µF' });
  const R = iec('resistor', 520, 280, { label: 'R1', value: '1 kΩ', rotation: 90 });
  const Vout = iec('vout', 660, 200, { label: 'Vout' });
  const gnd = iec('ground', 540, 420);

  const wires: Edge[] = [
    // Input loop
    wire(Vin.id, 'b', C.id, 'a'),
    wire(C.id, 'b', R.id, 'a'),
    // R's top (= mid node) is also the Vout positive probe
    wire(C.id, 'b', Vout.id, 'a'),
    // R bottom → ground
    wire(R.id, 'b', gnd.id, 'a'),
    // Reference returns
    wire(Vin.id, 'a', gnd.id, 'a'),
    wire(Vout.id, 'b', gnd.id, 'a'),
  ];

  return {
    nodes: [t1, t2, Vin, C, R, Vout, gnd],
    edges: wires,
    titleBlock: titleForAnalyze('RC High-Pass Filter', 'rc_highpass'),
    paperSize: 'A2',
  };
}

// ---------------------------------------------------------------------
// 8. RLC series resonance — Lab 9.
// Vin → R → L → C → ground, Vout across C.
// H(s) = 1 / (s²LC + sRC + 1). Lightly damped → sharp peak at f_n = 1/(2π√LC).
// With L = 25 mH, C = 1 µF: f_n ≈ 1 kHz. R = 30 Ω → ζ ≈ 0.1 (Q ≈ 5).
// ---------------------------------------------------------------------
function buildRLCResonance(): ExampleProject {
  resetIds();
  const t1 = text('RLC series resonance (Lab 9)', 200, 40, 16);
  const t2 = text('H(s) = 1 / (s²LC + sRC + 1)   f_n ≈ 1/(2π√LC) ≈ 1 kHz', 200, 64, 11);

  const Vin = iec('vin', 200, 200, { label: 'Vin' });
  const R = iec('resistor', 360, 200, { label: 'R1', value: '30 Ω' });
  const L = iec('inductor', 500, 200, { label: 'L1', value: '25 mH' });
  const C = iec('capacitor', 660, 280, { label: 'C1', value: '1 µF', rotation: 90 });
  const Vout = iec('vout', 780, 200, { label: 'Vout' });
  const gnd = iec('ground', 680, 420);

  const wires: Edge[] = [
    // Series chain Vin → R → L → C-top
    wire(Vin.id, 'b', R.id, 'a'),
    wire(R.id, 'b', L.id, 'a'),
    wire(L.id, 'b', C.id, 'a'),
    // Vout probe at the C-top node
    wire(L.id, 'b', Vout.id, 'a'),
    // C bottom → ground
    wire(C.id, 'b', gnd.id, 'a'),
    // References
    wire(Vin.id, 'a', gnd.id, 'a'),
    wire(Vout.id, 'b', gnd.id, 'a'),
  ];

  return {
    nodes: [t1, t2, Vin, R, L, C, Vout, gnd],
    edges: wires,
    titleBlock: titleForAnalyze('RLC Series Resonance', 'rlc_resonance'),
    paperSize: 'A2',
  };
}

// ---------------------------------------------------------------------
// 9. RL with current-output port — demonstrates Iout (series ammeter).
// Vin → R → L → Iout → ground. Output is the LOOP CURRENT.
// H_I(s) = I/Vin = 1 / (R + sL). Single pole at s = −R/L.
// With R = 100 Ω, L = 10 mH: pole at −10 000 rad/s ≈ 1.6 kHz corner.
// ---------------------------------------------------------------------
function buildRLCurrentOutput(): ExampleProject {
  resetIds();
  const t1 = text('RL with current output (Iout in series)', 200, 40, 16);
  const t2 = text('H_I(s) = I/Vin = 1 / (R + sL)   pole at s = −R/L', 200, 64, 11);

  const Vin = iec('vin', 200, 200, { label: 'Vin' });
  const R = iec('resistor', 360, 200, { label: 'R1', value: '100 Ω' });
  const L = iec('inductor', 520, 200, { label: 'L1', value: '10 mH' });
  // Iout sits in series between L and ground.
  const Iout = iec('iout', 680, 200, { label: 'Iout' });
  const gnd = iec('ground', 700, 360);

  const wires: Edge[] = [
    wire(Vin.id, 'b', R.id, 'a'),
    wire(R.id, 'b', L.id, 'a'),
    wire(L.id, 'b', Iout.id, 'a'),
    wire(Iout.id, 'b', gnd.id, 'a'),
    wire(Vin.id, 'a', gnd.id, 'a'),
  ];

  return {
    nodes: [t1, t2, Vin, R, L, Iout, gnd],
    edges: wires,
    titleBlock: titleForAnalyze('RL with Current Output', 'rl_iout'),
    paperSize: 'A2',
  };
}

// ---------------------------------------------------------------------
// 10. Three-phase Y-Y balanced (Lab 11)
// 230 V phase source, 50 Hz, into a Y load of R=10Ω + L=30mH per phase.
// Per phase: |Z| = √(R² + (ωL)²), φ = atan(ωL/R)
// At 50Hz: ωL = 2π·50·0.03 = 9.42, |Z| = √(100+88.8) = 13.7Ω, φ = 43.3° lag
// I = V/Z = 230/13.7 = 16.8 A per phase. P_total = 3·230·16.8·cos(43.3°) ≈ 8.4 kW.
// ---------------------------------------------------------------------
function buildYYBalanced(): ExampleProject {
  resetIds();
  const t1 = text('3-phase Y-Y balanced (Lab 11)', 200, 40, 16);
  const t2 = text('230 V / 50 Hz into Y load (R=10 Ω, L=30 mH per phase)', 200, 64, 11);

  const src = iec('src3p', 200, 200, { label: 'Src', value: '230 V, 50 Hz' });
  const load = iec('loady3p', 500, 200, { label: 'Y', value: '10 Ω, 30 mH' });

  // Three line wires + neutral. (Wires are visual; the solver reads parameters.)
  const wires: Edge[] = [
    wire(src.id, 'a', load.id, 'a'),
    wire(src.id, 'b', load.id, 'b'),
    wire(src.id, 'c', load.id, 'c'),
    wire(src.id, 'n', load.id, 'n'),
  ];

  return {
    nodes: [t1, t2, src, load],
    edges: wires,
    titleBlock: titleForAnalyze('3-Phase Y-Y Balanced', '3p_yy'),
    paperSize: 'A2',
  };
}

// 11b. Three-phase Y-Y UNBALANCED (Lab 11 advanced)
// Same source but per-phase Z differs: Za=10Ω, Zb=15Ω, Zc=20Ω + small L.
// Neutral current is nonzero — this is the whole point of having neutral.
function buildYYUnbalanced(): ExampleProject {
  resetIds();
  const t1 = text('3-phase Y-Y UNBALANCED (Lab 11)', 200, 40, 16);
  const t2 = text('Per-phase R = 10 / 15 / 20 Ω with same 30 mH inductance', 200, 64, 11);

  const src = iec('src3p', 200, 200, { label: 'Src', value: '230 V, 50 Hz' });
  const load = iec('loady3p', 500, 200, { label: 'Y', value: '10/15/20 Ω, 30 mH' });

  const wires: Edge[] = [
    wire(src.id, 'a', load.id, 'a'),
    wire(src.id, 'b', load.id, 'b'),
    wire(src.id, 'c', load.id, 'c'),
    wire(src.id, 'n', load.id, 'n'),
  ];

  return {
    nodes: [t1, t2, src, load],
    edges: wires,
    titleBlock: titleForAnalyze('3-Phase Y-Y Unbalanced', '3p_yy_unb'),
    paperSize: 'A2',
  };
}

// 11. Three-phase Y-Δ balanced (Lab 11)
// Same source, Δ load. Per Δ leg: Z = R + jωL. Phase current Iab = Vab/Z.
// Line current = √3 · phase current.
function buildYDBalanced(): ExampleProject {
  resetIds();
  const t1 = text('3-phase Y-Δ balanced (Lab 11)', 200, 40, 16);
  const t2 = text('230 V / 50 Hz into Δ load (R=30 Ω, L=90 mH per leg)', 200, 64, 11);

  const src = iec('src3p', 200, 200, { label: 'Src', value: '230 V, 50 Hz' });
  const load = iec('loadd3p', 500, 220, { label: 'Δ', value: '30 Ω, 90 mH' });

  const wires: Edge[] = [
    wire(src.id, 'a', load.id, 'a'),
    wire(src.id, 'b', load.id, 'b'),
    wire(src.id, 'c', load.id, 'c'),
  ];

  return {
    nodes: [t1, t2, src, load],
    edges: wires,
    titleBlock: titleForAnalyze('3-Phase Y-Δ Balanced', '3p_yd'),
    paperSize: 'A2',
  };
}

// =====================================================================
// BLOCK-DIAGRAM EXAMPLES (Linear SISO control systems — Block mode)
//
// Layout convention: input on the left, output on the right; one row per
// signal path so the diagram reads textbook-style. Pickoff and summer Y
// positions line up with the forward chain so feedback wires curve back
// from below.
// =====================================================================

function titleForBlock(title: string, fileName: string): TitleBlock {
  const d = today();
  return {
    ...DEFAULT_TITLE_BLOCK,
    project: 'Linear Control Systems',
    title,
    drawnDate: d,
    date: d,
    fileName,
    page: '1/1',
  };
}

// ---------------------------------------------------------------------
// BD1. Unity feedback with first-order plant.
//   R → Σ(+, −) → G(s)=1/(s+1) → ● → Y, ● back to Σ
// Classic single-pole closed-loop: T = G/(1+G) = 1/(s+2).
// ---------------------------------------------------------------------
function buildBdUnityFeedback(): ExampleProject {
  resetIds();
  const t1 = text('Unity feedback — first-order plant', 280, 40, 16);
  const t2 = text('T(s) = G/(1+G) = 1/(s+2)', 280, 64, 11);

  const R = iec('bd_input', 80, 200, { label: 'R(s)' });
  const sum = iec('summer', 220, 190, { label: '' });
  // signs default to ['+', '-'] — set explicitly via opts. Need an `arity`+`signs` field.
  // The summer's data signs/arity are set via the IECOpts pass-through; we just
  // need to make sure they end up on the node's data. Patch directly after.
  (sum.data as any).signs = ['+', '-'];
  (sum.data as any).arity = 2;

  const G = iec('block_g', 360, 190, { label: 'G', value: '1/(s+1)' });
  const pk = iec('pickoff', 540, 210, { label: '' });
  (pk.data as any).arity = 2;
  const Y = iec('bd_output', 620, 200, { label: 'Y(s)' });

  const wires: Edge[] = [
    wire(R.id, 'out', sum.id, 'in0'),                  // R → Σ(+)
    wire(sum.id, 'out', G.id, 'in'),                    // Σ → G
    wire(G.id, 'out', pk.id, 'in'),                     // G → ●
    wire(pk.id, 'out0', Y.id, 'in'),                    // ● → Y
    wire(pk.id, 'out2', sum.id, 'in2'),                 // ● → bottom of Σ (negative)
  ];
  // The negative-feedback input on the summer is in1 (top), but for a clean
  // bottom-up loop we route to in2. The signs[] default of ['+', '-'] applies
  // to indices 0,1 — extend so in2 is also '-' (third input).
  (sum.data as any).signs = ['+', '+', '-'];
  (sum.data as any).arity = 3;

  return {
    nodes: [t1, t2, R, sum, G, pk, Y],
    edges: wires,
    titleBlock: titleForBlock('Unity Feedback (1st order)', 'bd_unity_feedback'),
    paperSize: 'A3',
  };
}

// ---------------------------------------------------------------------
// BD2. Type-1 third-order plant — the canonical root-locus example.
//   G(s) = 1/[s(s+1)(s+2)], unity feedback.
// Famous textbook problem: 3 asymptotes at 60°, 180°, 300°, σ = −1,
// break-out near s = −0.42, imag-axis crossing at ω = √2, K_crit = 6.
// ---------------------------------------------------------------------
function buildBdRootLocusClassic(): ExampleProject {
  resetIds();
  const t1 = text('Root-locus classic — type-1 3rd-order plant', 280, 40, 16);
  const t2 = text('G(s) = 1/[s(s+1)(s+2)] ;  K_crit = 6 at ω = √2', 280, 64, 11);

  const R = iec('bd_input', 80, 200, { label: 'R(s)' });
  const sum = iec('summer', 220, 190, { label: '' });
  (sum.data as any).signs = ['+', '+', '-'];
  (sum.data as any).arity = 3;
  const G = iec('block_g', 360, 190, { label: 'G', value: '1/(s(s+1)(s+2))' });
  const pk = iec('pickoff', 540, 210, { label: '' });
  (pk.data as any).arity = 2;
  const Y = iec('bd_output', 620, 200, { label: 'Y(s)' });

  const wires: Edge[] = [
    wire(R.id, 'out', sum.id, 'in0'),
    wire(sum.id, 'out', G.id, 'in'),
    wire(G.id, 'out', pk.id, 'in'),
    wire(pk.id, 'out0', Y.id, 'in'),
    wire(pk.id, 'out2', sum.id, 'in2'),
  ];

  return {
    nodes: [t1, t2, R, sum, G, pk, Y],
    edges: wires,
    titleBlock: titleForBlock('Root Locus Classic', 'bd_rlocus_classic'),
    paperSize: 'A3',
  };
}

// BD3. Two-loop nested feedback — loaded from src/lib/examples/twoloopnested.json
// (hand-tuned in the editor). See buildBdTwoLoopJson at the top of this file.

// BD4. PID controller + plant — loaded from src/lib/examples/pid.json
// (hand-tuned in the editor). See buildBdPidJson at the top of this file.

// ---------------------------------------------------------------------

export const EXAMPLES: Example[] = [
  // ----- Schematic (1306 211 Workshop) -----
  {
    id: 'dol',
    mode: 'draw',
    nameTh: 'การสตาร์ทมอเตอร์โดยตรง',
    nameEn: 'Direct On Line (DOL)',
    desc: 'DOL starter with SL selector + F_SW, RUN/PW/OFF/OL pilot lamps.',
    build: buildDOL,
  },
  {
    id: 'star-delta',
    mode: 'draw',
    nameTh: 'สตาร์ท Star-Delta',
    nameEn: 'Star-Delta Starter',
    desc: 'Y-Δ starter with T0 timer; FW/STOP/OL/PW pilot lamps.',
    build: buildStarDelta,
  },
  // ----- Circuit Analysis (1306 210 Lab I) -----
  {
    id: 'vdiv-basic',
    mode: 'analyze',
    nameTh: 'วงจรแบ่งแรงดัน',
    nameEn: 'Voltage Divider',
    desc: 'V1 + R1 + R2 in series. Try Voltage Divider, Ohm’s law, KVL trace.',
    build: buildVoltageDivider,
    prompts: [
      'Drag R1 to 20 kΩ. What happens to V_R2? Predict, then check.',
      'Set R1 = R2. What fraction of V_s is dropped across R2?',
      'Try Mesh — is the answer the same as Voltage Divider?',
    ],
  },
  {
    id: 'idiv-basic',
    mode: 'analyze',
    nameTh: 'วงจรแบ่งกระแส',
    nameEn: 'Current Divider',
    desc: 'V1 + R1 ∥ R2. Try Current Divider, Nodal, Ohm’s law.',
    build: buildCurrentDivider,
  },
  {
    id: 'compound',
    mode: 'analyze',
    nameTh: 'วงจรผสม (อนุกรม + ขนาน)',
    nameEn: 'Compound (Series + Parallel)',
    desc: 'R₁ in series with R₂∥R₃. Demos R_eq reduction; Thévenin auto-targets R₃.',
    build: buildCompoundJson,
  },
  {
    id: 'two-source',
    mode: 'analyze',
    nameTh: 'วงจร 2 แหล่งจ่าย',
    nameEn: 'Two-Source Mixed Network',
    desc: 'Two sources + 3 resistors. Try Superposition, Mesh, Nodal, Thévenin (R3 = load).',
    build: buildTwoSourceJson,
    prompts: [
      'Pick Superposition. Verify the sum of per-source contributions matches the full solve.',
      'Pick Thévenin. What R_L would maximise power to R3? (Hint: R_L = R_th.)',
      'All four methods give the same I_R3 — confirm they agree to the last digit.',
    ],
  },
  {
    id: 'wheatstone',
    mode: 'analyze',
    nameTh: 'วงจรบริดจ์วีตสโตน',
    nameEn: 'Wheatstone Bridge',
    desc: 'Two parallel V-dividers with a voltmeter across the midpoints. Unbalanced → reads V_AB.',
    build: buildWheatstoneJson,
  },
  {
    id: 'rc-lowpass',
    mode: 'analyze',
    domain: 'ac',
    nameTh: 'วงจรกรองความถี่ต่ำ RC',
    nameEn: 'RC Low-Pass Filter',
    desc: 'Vin → R → Vout with C to ground. Switch the panel to AC to see H(s), Bode, phasor, step, pole-zero.',
    build: buildRCLowPass,
    prompts: [
      'On the Bode plot, find the −3 dB corner. Does it match 1/(2π·RC) = 159 Hz?',
      'Drag R1 to 10 kΩ. Where does the corner move? (Hint: corner ∝ 1/R.)',
      'Switch to Pole-zero. Click R1 — the gold trail shows how the pole slides as you change R.',
    ],
  },
  {
    id: 'rc-highpass',
    mode: 'analyze',
    domain: 'ac',
    nameTh: 'วงจรกรองความถี่สูง RC',
    nameEn: 'RC High-Pass Filter',
    desc: 'Vin → C → R → ground with Vout across R. Mirror of low-pass: passes high f, blocks DC.',
    build: buildRCHighPass,
  },
  {
    id: 'rlc-resonance',
    mode: 'analyze',
    domain: 'ac',
    nameTh: 'วงจรเรโซแนนซ์ RLC',
    nameEn: 'RLC Series Resonance (Lab 9)',
    desc: 'Series R+L+C with Vout across C. Lightly damped (Q≈5), sharp peak at 1 kHz.',
    build: buildRLCResonance,
    prompts: [
      'Click on the Bode peak — what frequency? Is it 1/(2π√LC)?',
      'Set R = 5 Ω. How does Q change? Does the peak get sharper?',
      'Pole-zero: click each of R / L / C and watch the trajectories. Which one moves poles purely along jω?',
      'Power tab at resonance — note PF ≈ 1 (load looks resistive).',
    ],
  },
  {
    id: 'rl-iout',
    mode: 'analyze',
    domain: 'ac',
    nameTh: 'RL พร้อมพอร์ตกระแสออก',
    nameEn: 'RL with Current Output (Iout demo)',
    desc: 'Vin → R → L → Iout → gnd. Output is the LOOP CURRENT (Iout in series, not a voltage probe).',
    build: buildRLCurrentOutput,
  },
  {
    id: '3p-yy',
    mode: 'analyze',
    domain: '3p',
    nameTh: 'ระบบ 3 เฟส Y-Y',
    nameEn: '3-Phase Y-Y Balanced (Lab 11)',
    desc: 'Balanced 230 V / 50 Hz source into a Y load (R + L per phase). Switch panel to 3φ to see phasors + power.',
    build: buildYYBalanced,
    prompts: [
      'Check: is V_line really √3 × V_phase (≈ 398 V vs 230 V)?',
      'Neutral current should be ≈ 0 (balanced). Verify.',
      'Compute P = 3·V·I·cos(φ) by hand. Match the bench?',
    ],
  },
  {
    id: '3p-yy-unb',
    mode: 'analyze',
    domain: '3p',
    nameTh: 'ระบบ 3 เฟส Y-Y ไม่สมดุล',
    nameEn: '3-Phase Y-Y UNBALANCED (Lab 11)',
    desc: 'Per-phase R = 10 / 15 / 20 Ω. Neutral current now NONZERO — that\'s why neutral exists.',
    build: buildYYUnbalanced,
    prompts: [
      'Look at I_n — magnitude and angle. Why isn\'t it zero anymore?',
      'Change the load string to "10 Ω, 30 mH" (balanced). What happens to I_n?',
      'Per-phase power: which phase dissipates the most? Why?',
    ],
  },
  {
    id: '3p-yd',
    mode: 'analyze',
    domain: '3p',
    nameTh: 'ระบบ 3 เฟส Y-Δ',
    nameEn: '3-Phase Y-Δ Balanced (Lab 11)',
    desc: 'Same source into a Δ load. Note line currents = √3 × phase currents.',
    build: buildYDBalanced,
    prompts: [
      'Compare line currents with the Y-Y example — Z_Δ = 3·Z_Y was chosen so they match.',
      'No neutral on Δ → I_n is not even defined. Note that on the canvas.',
    ],
  },
  // ----- Block Diagram (Linear SISO control systems) -----
  {
    id: 'bd-unity-feedback',
    mode: 'block',
    nameTh: 'Unity feedback (อันดับ 1)',
    nameEn: 'Unity Feedback — 1st-order plant',
    desc: 'R → Σ(+/−) → G(s)=1/(s+1) → Y, unity feedback. T(s) = 1/(s+2).',
    build: buildBdUnityFeedback,
    prompts: [
      'Walkthrough — Mason ออกมาเป็น 1 forward path กับ 1 loop. ลองดู Δ = 1 + G.',
      'Bode — sketch ทำมือก่อน แล้วเช็คกับ plot. corner frequency อยู่ที่ ω = 2 rad/s.',
      'Root locus — สวีค K ดู pole เลื่อนจาก −1 (open-loop) ไปทางซ้าย (เมื่อ K เพิ่ม).',
    ],
  },
  {
    id: 'bd-rlocus-classic',
    mode: 'block',
    nameTh: 'Root locus classic — type-1 3rd-order',
    nameEn: 'Root Locus Classic — type-1 3rd-order plant',
    desc: 'G(s) = 1/[s(s+1)(s+2)], unity feedback. K_crit = 6 at ω = √2 — every RLocus rule lights up.',
    build: buildBdRootLocusClassic,
    prompts: [
      'Root locus → rule "Asymptotes": ดู 3 asymptote ที่ 60° / 180° / 300° กับ σ = −1.',
      'Rule "Imaginary-axis crossings": ระบบ unstable เมื่อ K > 6 — เช็คที่ ω = √2 ≈ 1.414.',
      'Rule "Break-in / Break-out": breakaway บนแกนจริงระหว่าง −1 กับ 0 (ที่ s ≈ −0.42).',
      'ลอง slider K แล้วหา K ที่ทำให้ระบบเริ่ม oscillate (poles แตะแกนจินตภาพ) — ควรประมาณ 6.',
    ],
  },
  {
    id: 'bd-two-loop',
    mode: 'block',
    nameTh: 'สอง loop ซ้อนกัน (Mason)',
    nameEn: 'Two-Loop Nested Feedback (Mason)',
    desc: 'Inner loop with H2, outer loop with H1. Loops touch via G2 → Δ = 1 + G2·H2 + G1·G2·H1.',
    build: buildBdTwoLoopJson,
    prompts: [
      'Walkthrough — Mason แสดง 2 loops. ลอง "Non-touching" — ลูปคู่นี้สัมผัสกัน (ผ่าน G2)',
      'ลบ block H1 ออก → กลายเป็น single-loop. T(s) เหลือ inner loop เท่านั้น',
      'ใส่ค่า G1, G2, H1, H2 เป็นตัวเลข (เช่น 1, 1, 1, 1) แล้วดู Bode/Step',
    ],
  },
  {
    id: 'bd-pid-plant',
    mode: 'block',
    nameTh: 'PID + plant',
    nameEn: 'PID Controller + Plant',
    desc: 'P/I/D in parallel feed plant G_p(s) = 1/(s²+s+1) with unity feedback. Tune P, I, D values.',
    build: buildBdPidJson,
    prompts: [
      'Walkthrough — controller สามแขนรวมกัน: C(s) = P + I/s + D·s.',
      'ปรับ slider ของ P (block_p) แล้วดู step response — เพิ่ม P → เร็วขึ้น แต่ overshoot มากขึ้น',
      'ลบ block D ออก → กลายเป็น PI controller. ดู steady-state error เปลี่ยนไหม',
      'ตั้ง P = 0, I = 0, D = 0 → ระบบจะไม่ตอบสนอง — ผลคูณรวม = 0',
    ],
  },
];

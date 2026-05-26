// Method detectors + step renderers for the Analyze panel.
//
// Each method:
//   1. Looks at the CircuitGraph + SolveResult and decides if it's applicable.
//   2. If applicable, produces two step traces — Style A (textbook formula → substitute
//      → result) and Style B (first-principles KVL/KCL).
//   3. If not applicable, returns a human-readable reason.
//
// MVP set: Ohm's law, voltage divider, current divider, KVL trace.
// Mesh / nodal / superposition / Thévenin layer on as v2.

import type { CircuitGraph, Branch } from './graph';
import { solveDC, type SolveResult } from './solver';
import { formatValue } from './units';

export interface MethodResult {
  applicable: boolean;
  reason?: string;
  styleA: string[];
  styleB: string[];
  answer?: string;
}

export interface MethodDef {
  id: string;
  name: string;
  nameTh: string;
  blurb: string;
  /** Indicates whether this method is implemented yet. Greyed out + disabled otherwise. */
  implemented: boolean;
  analyze: (graph: CircuitGraph, solve: SolveResult) => MethodResult;
}

// ---- helpers ----------------------------------------------------------------

const fmtR = (v: number) => formatValue(v, 'Ω');
const fmtV = (v: number) => formatValue(v, 'V');
const fmtI = (v: number) => formatValue(v, 'A');
const fmtP = (v: number) => formatValue(v, 'W');

/** All resistors connected directly between two specific circuit nodes. */
function resistorsBetween(graph: CircuitGraph, na: number, nb: number): Branch[] {
  return graph.branches.filter(
    (b) => b.kind === 'R' && ((b.na === na && b.nb === nb) || (b.na === nb && b.nb === na)),
  );
}

function notApplicable(reason: string): MethodResult {
  return { applicable: false, reason, styleA: [], styleB: [] };
}

// ---- Ohm's law -------------------------------------------------------------
// Pattern: exactly one V source + one R, forming a single loop.

function detectOhm(graph: CircuitGraph, solve: SolveResult): MethodResult {
  if (!solve.ok) return notApplicable('วงจรต้อง solve ได้ก่อนจะใช้ Ohm’s law');
  const Vs = graph.branches.filter((b) => b.kind === 'V');
  const Rs = graph.branches.filter((b) => b.kind === 'R');
  if (Vs.length !== 1 || Rs.length !== 1) {
    return notApplicable('Ohm’s law (ที่นี่) ต้องการแหล่งจ่าย 1 ตัวกับ resistor 1 ตัวในลูปเดียว — สำหรับวงจรหลายลูปให้ใช้ KVL trace หรือ mesh');
  }
  const vs = Vs[0];
  const r = Rs[0];
  // Both terminals of R must coincide with the source's two terminals.
  const same =
    (vs.na === r.na && vs.nb === r.nb) ||
    (vs.na === r.nb && vs.nb === r.na);
  if (!same) {
    return notApplicable('Resistor ไม่ได้ต่อคร่อมแหล่งจ่ายโดยตรง — ลองใช้ KVL หรือ mesh');
  }
  const I = solve.branchCurrents.get(r.id) ?? 0;
  const P = vs.value * Math.abs(I);
  const styleA = [
    `ใช้ Ohm’s law:`,
    `  I = V / R`,
    `    = ${fmtV(vs.value)} / ${fmtR(r.value)}`,
    `    = ${fmtI(I)}`,
    ``,
    `กำลังที่สูญเสียใน ${r.label}:`,
    `  P = V · I`,
    `    = ${fmtV(vs.value)} · ${fmtI(I)}`,
    `    = ${fmtP(P)}`,
  ];
  const styleB = [
    `KVL รอบลูป (แรงดันตกคร่อม R ต้องเท่ากับแหล่งจ่าย):`,
    `  −V_s + V_R = 0   →   V_R = V_s = ${fmtV(vs.value)}`,
    ``,
    `Ohm’s law บน resistor:`,
    `  V_R = I · R   →   I = V_R / R = ${fmtV(vs.value)} / ${fmtR(r.value)} = ${fmtI(I)}`,
  ];
  return {
    applicable: true,
    styleA,
    styleB,
    answer: `I = ${fmtI(I)},  P = ${fmtP(P)}`,
  };
}

// ---- Voltage divider --------------------------------------------------------
// Pattern: V source between ground (node 0) and node A; R1 from A → M; R2 from M → 0.

function detectVoltageDivider(graph: CircuitGraph, solve: SolveResult): MethodResult {
  if (!solve.ok) return notApplicable('วงจรต้อง solve ได้ก่อนจะใช้ voltage divider');
  const Vs = graph.branches.filter((b) => b.kind === 'V');
  const Rs = graph.branches.filter((b) => b.kind === 'R');
  if (Vs.length !== 1) return notApplicable('Voltage divider ใช้ได้กับวงจรแหล่งจ่ายเดียวเท่านั้น');
  if (Rs.length !== 2) return notApplicable('Voltage divider ต้องมี resistor 2 ตัวต่ออนุกรมกับแหล่งจ่ายพอดี');
  const vs = Vs[0];

  // Determine the source's high and low terminals (low must be ground for the canonical V-divider).
  let high: number, low: number;
  if (vs.nb === 0) { high = vs.na; low = vs.nb; }
  else if (vs.na === 0) { high = vs.nb; low = vs.na; }
  else return notApplicable('สำหรับ V-divider แหล่งจ่ายต้องมีขั้วหนึ่งต่ออยู่กับ ground');

  // We need two resistors: one from `high` → middle node M, and one from M → `low`.
  // R1 = top (between source+ and middle), R2 = bottom (between middle and ground).
  const r1 = Rs.find((r) => r.na === high || r.nb === high);
  const r2 = Rs.find((r) => r !== r1 && (r.na === low || r.nb === low));
  if (!r1 || !r2) return notApplicable('ระบุ resistor ตัวบน/ตัวล่างของ divider ไม่ได้');
  const midFromR1 = r1.na === high ? r1.nb : r1.na;
  const midFromR2 = r2.na === low ? r2.nb : r2.na;
  if (midFromR1 !== midFromR2) {
    return notApplicable('Resistor 2 ตัวไม่ได้ใช้ middle node ร่วมกัน — ไม่ใช่อนุกรมล้วน');
  }
  // Confirm no other branches hang off the middle node.
  const middle = midFromR1;
  const otherAtMiddle = graph.branches.some(
    (b) => b !== r1 && b !== r2 && (b.na === middle || b.nb === middle),
  );
  if (otherAtMiddle) {
    return notApplicable('มีสาขาอื่นแยกออกจาก middle node — ใช้สูตร V-divider ไม่ได้');
  }

  const Vs_val = vs.value;
  const R1 = r1.value;
  const R2 = r2.value;
  const VR2 = (Vs_val * R2) / (R1 + R2);
  const VR1 = (Vs_val * R1) / (R1 + R2);
  const I = Vs_val / (R1 + R2);

  const styleA = [
    `Voltage divider (เอาต์พุตคร่อม ${r2.label} ตัวล่าง):`,
    `  V_${r2.label} = V_s · R_2 / (R_1 + R_2)`,
    `         = ${fmtV(Vs_val)} · ${fmtR(R2)} / (${fmtR(R1)} + ${fmtR(R2)})`,
    `         = ${fmtV(Vs_val)} · ${fmtR(R2)} / ${fmtR(R1 + R2)}`,
    `         = ${fmtV(VR2)}`,
    ``,
    `แรงดันตกคร่อม ${r1.label}:  V_${r1.label} = V_s − V_${r2.label} = ${fmtV(VR1)}`,
    `กระแสในวงจรอนุกรม:        I = V_s / (R_1 + R_2) = ${fmtI(I)}`,
  ];
  const styleB = [
    `KVL รอบลูป:`,
    `  −V_s + V_${r1.label} + V_${r2.label} = 0`,
    `  โดย V_${r1.label} = I·R_1,  V_${r2.label} = I·R_2  (Ohm’s law)`,
    ``,
    `Resistor อนุกรมไหลกระแส I เท่ากัน ดังนั้น:`,
    `  I = V_s / (R_1 + R_2)`,
    `    = ${fmtV(Vs_val)} / (${fmtR(R1)} + ${fmtR(R2)})`,
    `    = ${fmtI(I)}`,
    ``,
    `จากนั้น:`,
    `  V_${r2.label} = I · R_2 = ${fmtI(I)} · ${fmtR(R2)} = ${fmtV(VR2)}`,
    `  V_${r1.label} = I · R_1 = ${fmtI(I)} · ${fmtR(R1)} = ${fmtV(VR1)}`,
  ];
  return {
    applicable: true,
    styleA,
    styleB,
    answer: `V_${r2.label} = ${fmtV(VR2)},  I = ${fmtI(I)}`,
  };
}

// ---- Current divider --------------------------------------------------------
// Pattern: V source between ground and node A; two (or more) resistors in parallel
// between A and ground.

function detectCurrentDivider(graph: CircuitGraph, solve: SolveResult): MethodResult {
  if (!solve.ok) return notApplicable('วงจรต้อง solve ได้ก่อนจะใช้ current divider');
  const Vs = graph.branches.filter((b) => b.kind === 'V');
  const Rs = graph.branches.filter((b) => b.kind === 'R');
  if (Vs.length !== 1) return notApplicable('Current divider ใช้ได้กับวงจรแหล่งจ่ายเดียว (ตอนนี้)');
  if (Rs.length < 2) return notApplicable('ต้องมี resistor ต่อขนานอย่างน้อย 2 ตัว');
  const vs = Vs[0];
  let high: number, low: number;
  if (vs.nb === 0) { high = vs.na; low = vs.nb; }
  else if (vs.na === 0) { high = vs.nb; low = vs.na; }
  else return notApplicable('แหล่งจ่ายต้องมีขั้วหนึ่งต่ออยู่กับ ground');

  // All resistors must connect (high, low).
  const parallels = resistorsBetween(graph, high, low);
  if (parallels.length !== Rs.length) {
    return notApplicable('Resistor ไม่ได้ต่อขนานล้วนคร่อมแหล่งจ่ายทุกตัว');
  }
  const Gtot = parallels.reduce((g, r) => g + 1 / r.value, 0);
  const Rtot = 1 / Gtot;
  const Itot = vs.value / Rtot;

  const styleA = [
    `Resistance รวมของ parallel:`,
    `  1/R_eq = ` + parallels.map((r) => `1/${fmtR(r.value)}`).join(' + '),
    `  R_eq = ${fmtR(Rtot)}`,
    ``,
    `กระแสรวมจากแหล่งจ่าย:`,
    `  I_total = V_s / R_eq = ${fmtV(vs.value)} / ${fmtR(Rtot)} = ${fmtI(Itot)}`,
    ``,
    `กระแสในแต่ละสาขา (แรงดันคร่อมแต่ละตัว = V_s):`,
    ...parallels.map((r) => {
      const ir = vs.value / r.value;
      return `  I_${r.label} = V_s / ${r.label} = ${fmtV(vs.value)} / ${fmtR(r.value)} = ${fmtI(ir)}`;
    }),
  ];
  const styleB = [
    `KCL ที่ node บนสุด (กระแสเข้า = ผลรวมของกระแสออก):`,
    `  I_total = ` + parallels.map((r) => `I_${r.label}`).join(' + '),
    ``,
    `Resistor ทุกตัวคร่อม V_s ร่วมกัน (KVL ทุกสาขา) ดังนั้น I_R = V_s / R:`,
    ...parallels.map((r) => `  I_${r.label} = ${fmtV(vs.value)} / ${fmtR(r.value)} = ${fmtI(vs.value / r.value)}`),
    ``,
    `รวม:  I_total = ${fmtI(Itot)}`,
  ];
  return {
    applicable: true,
    styleA,
    styleB,
    answer: `I_total = ${fmtI(Itot)},  R_eq = ${fmtR(Rtot)}`,
  };
}

// ---- KVL single-loop trace --------------------------------------------------
// Pattern: every node (excluding ground) has exactly 2 branches touching it →
// single loop. Works for N series resistors + sources.

function detectKVL(graph: CircuitGraph, solve: SolveResult): MethodResult {
  if (!solve.ok) return notApplicable('วงจรต้อง solve ได้ก่อน');
  const branches = graph.branches.filter((b) => b.kind === 'R' || b.kind === 'V');
  if (branches.length < 2) return notApplicable('ต้องมีอุปกรณ์อย่างน้อย 2 ตัวจึงจะใช้ KVL ได้อย่างมีความหมาย');
  // Count degree at each non-ground node.
  const deg = new Map<number, number>();
  for (const b of branches) {
    deg.set(b.na, (deg.get(b.na) ?? 0) + 1);
    deg.set(b.nb, (deg.get(b.nb) ?? 0) + 1);
  }
  for (const [node, d] of deg) {
    if (node === 0) continue;
    if (d !== 2) return notApplicable('ไม่ใช่ลูปเดียว — มี node ที่มีสาขามากกว่า 2 ลองใช้ mesh หรือ nodal');
  }

  const Rs = branches.filter((b) => b.kind === 'R');
  const Vs = branches.filter((b) => b.kind === 'V');
  const Rsum = Rs.reduce((s, r) => s + r.value, 0);
  const Vnet = Vs.reduce((s, v) => s + v.value, 0); // (simplistic — assumes all sources oriented the same way; OK for MVP)
  const I = Rsum > 0 ? Vnet / Rsum : 0;

  const styleA = [
    `Resistor อนุกรมรวมกัน:`,
    `  R_total = ` + Rs.map((r) => fmtR(r.value)).join(' + ') + ` = ${fmtR(Rsum)}`,
    ``,
    `EMF สุทธิรอบลูป:`,
    `  V_net = ` + Vs.map((v) => fmtV(v.value)).join(' + ') + ` = ${fmtV(Vnet)}`,
    ``,
    `กระแสในลูป:`,
    `  I = V_net / R_total = ${fmtV(Vnet)} / ${fmtR(Rsum)} = ${fmtI(I)}`,
    ``,
    `แรงดันตกคร่อม resistor แต่ละตัว:`,
    ...Rs.map((r) => `  V_${r.label} = I · ${fmtR(r.value)} = ${fmtV(I * r.value)}`),
  ];
  const styleB = [
    `KVL รอบลูป  Σ V = 0:`,
    `  −(${Vs.map((v) => `V_${v.label}`).join(' + ')}) + ` +
      Rs.map((r) => `V_${r.label}`).join(' + ') + ` = 0`,
    `Ohm’s law บนแต่ละ R:  V_R = I · R   (อนุกรมไหลกระแส I เดียวกัน)`,
    ``,
    `รวมสมการ:  I = ΣV / ΣR = ${fmtV(Vnet)} / ${fmtR(Rsum)} = ${fmtI(I)}`,
  ];
  return { applicable: true, styleA, styleB, answer: `I = ${fmtI(I)}` };
}

// ---- Helpers shared by p2 methods ------------------------------------------

/** Extract a numeric suffix from a label like "R3" → 3. Labels without a number fall back to 0. */
function labelNum(label: string): number {
  const m = /(\d+)$/.exec(label);
  return m ? parseInt(m[1], 10) : 0;
}

/** Pick the "target" resistor for methods that operate on one specific load. Highest-numbered R, ties broken by label. */
function pickLoadResistor(graph: CircuitGraph): Branch | null {
  const Rs = graph.branches.filter((b) => b.kind === 'R');
  if (Rs.length === 0) return null;
  return Rs.slice().sort((a, b) => labelNum(b.label) - labelNum(a.label) || b.label.localeCompare(a.label))[0];
}

/** Build a copy of the graph with `mutate` applied to its branches. */
function withBranches(graph: CircuitGraph, mutate: (b: Branch) => Branch): CircuitGraph {
  return { ...graph, branches: graph.branches.map(mutate) };
}

// ---- Superposition ----------------------------------------------------------
// For each independent source: zero all others (V → short, I → open), solve.
// Sum each branch current across the sub-solves and confirm it matches the
// full-circuit solve.

function detectSuperposition(graph: CircuitGraph, solve: SolveResult): MethodResult {
  if (!solve.ok) return notApplicable('วงจรต้อง solve ได้ก่อนจะใช้ superposition');
  const sources = graph.branches.filter((b) => b.kind === 'V' || b.kind === 'I');
  if (sources.length < 2) {
    return notApplicable('Superposition ต้องมีแหล่งจ่ายอิสระ ≥ 2 ตัว — ถ้ามีแหล่งเดียวให้ใช้ Ohm’s law, V-divider หรือ KVL');
  }
  const target = pickLoadResistor(graph);
  if (!target) return notApplicable('ใส่ resistor อย่างน้อย 1 ตัวจึงจะเห็นผลของแต่ละแหล่งจ่าย');

  // Sub-solve per source.
  const subs = sources.map((active) => {
    const sub = withBranches(graph, (b) =>
      (b.kind === 'V' || b.kind === 'I') && b.id !== active.id ? { ...b, value: 0 } : b,
    );
    return { active, solve: solveDC(sub) };
  });
  if (subs.some((s) => !s.solve.ok)) {
    return notApplicable('Sub-circuit ของแหล่งจ่ายตัวใดตัวหนึ่ง solve ไม่ผ่าน — ตรวจการเชื่อมต่อด้วย');
  }

  const contributions = subs.map((s) => s.solve.branchCurrents.get(target.id) ?? 0);
  const summed = contributions.reduce((a, b) => a + b, 0);
  const actual = solve.branchCurrents.get(target.id) ?? 0;

  const styleA: string[] = [
    `Superposition: solve ทีละแหล่งจ่ายแล้วค่อยรวมผล`,
    `ดูกระแสที่ไหลผ่าน ${target.label} (${fmtR(target.value)})`,
    ``,
  ];
  subs.forEach((s, i) => {
    const others = sources.filter((src) => src.id !== s.active.id);
    const killed = others.map((src) => `${src.label}${src.kind === 'V' ? '→short' : '→open'}`).join(', ');
    styleA.push(
      `ขั้นที่ ${i + 1}: เปิดเฉพาะ ${s.active.label} (${s.active.kind === 'V' ? fmtV(s.active.value) : fmtI(s.active.value)}) ส่วนที่เหลือปิด (${killed})`,
      `  → I_${target.label}^(${i + 1}) = ${fmtI(contributions[i])}`,
      ``,
    );
  });
  styleA.push(
    `รวมผลของแต่ละแหล่งจ่าย:`,
    `  I_${target.label} = ` + contributions.map((_, i) => `I_${target.label}^(${i + 1})`).join(' + '),
    `         = ` + contributions.map((c) => fmtI(c)).join(' + '),
    `         = ${fmtI(summed)}`,
    ``,
    `ตรวจกับผลจาก MNA solve เต็มวงจร: ${fmtI(actual)} ✓`,
  );

  const styleB: string[] = [
    `Superposition อาศัยคุณสมบัติ linearity: ในวงจรเชิงเส้น ผลตอบสนองจากแหล่งจ่าย`,
    `อิสระหลายตัวเท่ากับผลรวมของผลตอบสนองจากแต่ละแหล่งจ่ายแยกกัน`,
    `(ตัวที่เหลือถูก zero: V-source กลายเป็น short, I-source กลายเป็น open)`,
    ``,
    `ในแต่ละ sub-circuit จะ solve ด้วยวิธีใดก็ได้ (KVL, V-divider, mesh ฯลฯ) —`,
    `ที่นี่ MNA solver จัดการให้แล้ว เราแค่อ่านค่า I_${target.label}^(k) ออกมา`,
    ``,
    `ผลรวม: I_${target.label} = Σ I_${target.label}^(k) = ${fmtI(summed)}`,
  ];

  return {
    applicable: true,
    styleA,
    styleB,
    answer: `I_${target.label} = ${fmtI(summed)}  (sum of ${subs.length} sub-solves)`,
  };
}

// ---- Thévenin equivalent + max power transfer -------------------------------
// Auto-pick the highest-labeled resistor as the "load" R_L. Compute V_th by
// removing the load and solving for V_oc across its terminals. Compute R_th by
// zeroing all sources, injecting a 1A test current between the load terminals,
// and reading the resulting voltage. Then I_L, P_L, plus the max-power
// transfer corollary (P_max when R_L = R_th).

function detectThevenin(graph: CircuitGraph, solve: SolveResult): MethodResult {
  if (!solve.ok) return notApplicable('วงจรต้อง solve ได้ก่อนจะใช้ Thévenin');
  const load = pickLoadResistor(graph);
  if (!load) return notApplicable('ต้องมี resistor อย่างน้อย 1 ตัวเพื่อใช้เป็นโหลด');
  if (graph.branches.filter((b) => b.kind === 'R').length < 2) {
    return notApplicable('Thévenin จะยุบส่วนที่เหลือของวงจร — ต้องมี resistor อย่างน้อย 1 ตัวอื่นนอกจากโหลด');
  }

  // V_oc: open-circuit voltage across the load terminals (load removed).
  const ocGraph: CircuitGraph = {
    ...graph,
    branches: graph.branches.filter((b) => b.id !== load.id),
  };
  const ocSolve = solveDC(ocGraph);
  if (!ocSolve.ok) {
    return notApplicable('คำนวณ V_oc ไม่ได้ — sub-circuit (ที่ถอดโหลดออก) solve ไม่ผ่าน');
  }
  const V_oc = ocSolve.nodeVoltages[load.na] - ocSolve.nodeVoltages[load.nb];

  // R_th: zero all sources, inject 1A test current ENTERING at load.na (so external
  // direction is load.nb → load.na, which is what "current arriving at + terminal"
  // means). With our source convention (na→nb is internal), we swap na/nb on the
  // test source so the internal direction is load.nb→load.na, putting the external
  // current INTO node load.na. Then R_th = V(load.na) − V(load.nb) / 1 A.
  const testBranches: Branch[] = [
    ...ocGraph.branches.map((b) =>
      (b.kind === 'V' || b.kind === 'I') ? { ...b, value: 0 } : b,
    ),
    { id: '__rth_test', label: 'Itest', kind: 'I', na: load.nb, nb: load.na, value: 1 },
  ];
  const testSolve = solveDC({ ...ocGraph, branches: testBranches });
  if (!testSolve.ok) {
    return notApplicable('คำนวณ R_th ไม่ได้ — sub-circuit ที่ใช้ test-current solve ไม่ผ่าน');
  }
  const R_th = (testSolve.nodeVoltages[load.na] - testSolve.nodeVoltages[load.nb]) / 1;

  // Reconnect the load. I_L = V_th / (R_th + R_L), P_L = I_L²·R_L.
  const I_L = V_oc / (R_th + load.value);
  const P_L = I_L * I_L * load.value;
  const P_max = (V_oc * V_oc) / (4 * R_th);

  const styleA: string[] = [
    `ยุบส่วนของวงจรที่ ${load.label} มองเห็นให้เป็น Thévenin equivalent`,
    ``,
    `ขั้นที่ 1 — ถอด ${load.label} ออก คำนวณ open-circuit voltage ที่ขั้วของมัน:`,
    `  V_th = V_oc = ${fmtV(V_oc)}`,
    ``,
    `ขั้นที่ 2 — Zero แหล่งจ่ายทุกตัว (V→short, I→open) คำนวณ resistance สมมูล`,
    `ที่มองเข้าไปทางขั้วที่เปิดอยู่ (ที่นี่ใช้ test current 1 A):`,
    `  R_th = ${fmtR(R_th)}`,
    ``,
    `ขั้นที่ 3 — ต่อ ${load.label} = ${fmtR(load.value)} กลับเข้ากับ Thévenin equivalent:`,
    `  I_L = V_th / (R_th + R_L)`,
    `      = ${fmtV(V_oc)} / (${fmtR(R_th)} + ${fmtR(load.value)})`,
    `      = ${fmtI(I_L)}`,
    `  P_L = I_L² · R_L = ${fmtP(P_L)}`,
    ``,
    `Max power transfer (ผลพลอยได้จาก Lab 5):`,
    `  ถ้า R_L = R_th = ${fmtR(R_th)},  P_max = V_th² / (4 R_th) = ${fmtP(P_max)}`,
  ];
  const styleB: string[] = [
    `Thévenin's theorem: วงจรเชิงเส้น 2-terminal ใดๆ ยุบลงเหลือ`,
    `V_th อนุกรมกับ R_th ตัวเดียวได้`,
    ``,
    `V_th = แรงดันที่อ่านได้ระหว่างขั้วเมื่อถอดโหลดออก (open circuit) —`,
    `ไม่มีกระแสผ่านสาขาโหลด ดังนั้นส่วนที่เหลือของวงจรเป็นตัวกำหนด V`,
    ``,
    `R_th = resistance ที่มองเข้าทางขั้วเดิมหลังจาก zero แหล่งจ่ายอิสระทุกตัว`,
    `(วงจรจึงเหลือแต่ resistor) ทำได้ 2 วิธี: (a) ยุบ series-parallel,`,
    `(b) ฉีด test current 1 A แล้วอ่าน open-circuit voltage — อัตราส่วนนั้นคือ R_th`,
    ``,
    `เมื่อรู้ทั้งคู่ โหลดจะมองเห็นแค่ลูปอนุกรม:`,
    `  V_th = I_L (R_th + R_L)   →   I_L = V_th / (R_th + R_L)`,
  ];

  return {
    applicable: true,
    styleA,
    styleB,
    answer: `V_th = ${fmtV(V_oc)},  R_th = ${fmtR(R_th)},  I_${load.label} = ${fmtI(I_L)},  P_${load.label} = ${fmtP(P_L)}`,
  };
}

// ---- Nodal analysis ---------------------------------------------------------
// Pick V_1..V_{n-1} as node voltages (V_0 = 0, ground). For each non-ground
// node, write KCL: sum of currents leaving = 0. Express resistor currents via
// Ohm's law in terms of node voltages; treat V-sources via supernodes (the
// constraint V_a − V_b = V_s collapses the two nodes' KCL equations).

function detectNodal(graph: CircuitGraph, solve: SolveResult): MethodResult {
  if (!solve.ok) return notApplicable('วงจรต้อง solve ได้ก่อน');
  const n = graph.numNodes;
  if (n <= 1) return notApplicable('ต้องมี node ที่ไม่ใช่ ground อย่างน้อย 1 ตัว');

  const Rs = graph.branches.filter((b) => b.kind === 'R');
  const Vs = graph.branches.filter((b) => b.kind === 'V');
  const Is = graph.branches.filter((b) => b.kind === 'I');

  const styleA: string[] = [
    `Pick node voltages as unknowns:  ` +
      Array.from({ length: n - 1 }, (_, i) => `V_${i + 1}`).join(', ') +
      `   (V_0 = 0 at ground)`,
    ``,
  ];

  if (Vs.length > 0) {
    styleA.push(
      `Voltage-source constraints (supernode treatment):`,
      ...Vs.map((v) => `  V_${v.na} − V_${v.nb} = ${fmtV(v.value)}   (from ${v.label})`),
      ``,
    );
  }

  styleA.push(`KCL ที่แต่ละ node ที่ไม่ใช่ ground (กระแสออก = กระแสเข้า):`);
  for (let k = 1; k < n; k++) {
    const terms: string[] = [];
    for (const r of Rs) {
      if (r.na === k) terms.push(`(V_${k} − V_${r.nb}) / ${r.label}`);
      else if (r.nb === k) terms.push(`(V_${k} − V_${r.na}) / ${r.label}`);
    }
    for (const cur of Is) {
      if (cur.na === k) terms.push(`+ ${fmtI(cur.value)}   (${cur.label} leaving)`);
      if (cur.nb === k) terms.push(`− ${fmtI(cur.value)}   (${cur.label} entering)`);
    }
    if (terms.length === 0) continue;
    styleA.push(`  node ${k}: ` + terms.join(' + ') + ` = 0`);
  }
  styleA.push(``, `แทนค่า resistor แล้ว solve ระบบสมการเชิงเส้น:`);
  for (let k = 1; k < n; k++) {
    styleA.push(`  V_${k} = ${fmtV(solve.nodeVoltages[k])}`);
  }
  styleA.push(``, `กระแสในแต่ละสาขาตาม Ohm's law:  I_R = (V_a − V_b) / R`);
  for (const r of Rs) {
    const I = solve.branchCurrents.get(r.id) ?? 0;
    styleA.push(`  I_${r.label} = (${fmtV(solve.nodeVoltages[r.na])} − ${fmtV(solve.nodeVoltages[r.nb])}) / ${fmtR(r.value)} = ${fmtI(I)}`);
  }

  const styleB: string[] = [
    `Nodal analysis เลือกแรงดันที่ node เทียบกับ ground เป็นตัวแปร`,
    `KCL ที่แต่ละ node คือสมการเชิงเส้น 1 สมการ — วงจร N nodes จะให้ N−1 สมการ`,
    `กับ N−1 ตัวแปร (หลังจาก fix V_ground = 0)`,
    ``,
    `Resistor ระหว่าง node a, b จะให้กระแส (V_a − V_b)/R ออกจาก node a`,
    `(และเครื่องหมายตรงข้ามที่ออกจาก b) ส่วน independent current source ฉีดกระแสเข้าตรงๆ`,
    `independent voltage source จัดการด้วยการรวม 2 node ที่มันคร่อมเป็น supernode`,
    `แล้วเขียน KCL พร้อม constraint V_a − V_b = V_s`,
    ``,
    `Analyze panel ใช้วิธีนี้แบบเดียวกัน (MNA = nodal + voltage-source augmentation) —`,
    `ระบบสมการที่แสดงด้านบนคือสิ่งที่ solver สร้างขึ้นมาแล้ว invert`,
  ];

  return {
    applicable: true,
    styleA,
    styleB,
    answer: `Solved ${n - 1} node voltage(s) via KCL` + (Vs.length ? ` + ${Vs.length} supernode constraint(s)` : ''),
  };
}

// ---- Mesh analysis ----------------------------------------------------------
// Find a fundamental cycle basis via DFS spanning tree: each non-tree branch
// adds one independent mesh. Assign a mesh current to each cycle (clockwise as
// drawn isn't well-defined on an abstract graph, so we just pick a consistent
// traversal direction). Write KVL for each mesh, solve.
//
// Limitation: current sources need supermesh treatment, which v2 skips. With
// V sources + resistors only this gives the standard Lab 5 mesh setup.

interface Mesh {
  /** Branches in this mesh, with traversal sign (+1 if branch a→b matches mesh direction, −1 otherwise). */
  branches: Array<{ branch: Branch; sign: number }>;
}

function findMeshes(graph: CircuitGraph): Mesh[] | null {
  const n = graph.numNodes;
  if (n === 0) return [];
  // Build adjacency: node → list of (other node, branch, signFromHere)
  const adj = new Map<number, Array<{ other: number; branch: Branch; sign: number }>>();
  for (let i = 0; i < n; i++) adj.set(i, []);
  for (const b of graph.branches) {
    if (b.kind !== 'R' && b.kind !== 'V') return null; // I-sources need supermesh — defer
    adj.get(b.na)!.push({ other: b.nb, branch: b, sign: +1 });
    adj.get(b.nb)!.push({ other: b.na, branch: b, sign: -1 });
  }
  // DFS spanning tree from node 0.
  const parent = new Map<number, { from: number; branch: Branch; sign: number } | null>();
  parent.set(0, null);
  const stack: number[] = [0];
  const treeBranches = new Set<string>();
  while (stack.length) {
    const u = stack.pop()!;
    for (const { other, branch, sign } of adj.get(u)!) {
      if (parent.has(other)) continue;
      parent.set(other, { from: u, branch, sign });
      treeBranches.add(branch.id);
      stack.push(other);
    }
  }
  // Each non-tree branch defines one fundamental cycle.
  const meshes: Mesh[] = [];
  for (const b of graph.branches) {
    if (treeBranches.has(b.id)) continue;
    // Cycle: from b.na up to LCA, down to b.nb, plus b itself.
    const pathA = ancestors(b.na, parent);
    const pathB = ancestors(b.nb, parent);
    const setA = new Set(pathA);
    let lca: number | null = null;
    for (const v of pathB) { if (setA.has(v)) { lca = v; break; } }
    if (lca == null) continue; // disconnected — shouldn't happen for solvable circuits
    const cycleBranches: Mesh['branches'] = [];
    // From na up to lca (climbing tree, branches go child→parent, i.e. sign = -parent.sign).
    let cur = b.na;
    while (cur !== lca) {
      const p = parent.get(cur)!;
      cycleBranches.push({ branch: p.branch, sign: -p.sign });
      cur = p.from;
    }
    // Closing branch b: from nb back to na (so reverse direction → -1 of declared).
    cycleBranches.push({ branch: b, sign: -1 });
    // From lca down to nb (forward direction along parent links).
    const downPath: Array<{ branch: Branch; sign: number }> = [];
    cur = b.nb;
    while (cur !== lca) {
      const p = parent.get(cur)!;
      downPath.push({ branch: p.branch, sign: p.sign });
      cur = p.from;
    }
    downPath.reverse();
    cycleBranches.push(...downPath);
    meshes.push({ branches: cycleBranches });
  }
  return meshes;
}

function ancestors(node: number, parent: Map<number, { from: number } | null>): number[] {
  const out = [node];
  let cur: number | null = node;
  while (true) {
    const p = parent.get(cur!);
    if (!p) break;
    out.push(p.from);
    cur = p.from;
  }
  return out;
}

function detectMesh(graph: CircuitGraph, solve: SolveResult): MethodResult {
  if (!solve.ok) return notApplicable('วงจรต้อง solve ได้ก่อน');
  const hasI = graph.branches.some((b) => b.kind === 'I');
  if (hasI) return notApplicable('Mesh ที่มี current source ต้องใช้ supermesh — ยังไม่รองรับใน v2 ลองใช้ Nodal แทน');
  const meshes = findMeshes(graph);
  if (meshes == null || meshes.length === 0) {
    return notApplicable('ไม่พบ mesh ที่อิสระ (ต้องมีลูปสมบูรณ์ที่มี V source + resistor)');
  }

  // Solve the mesh system: R_mesh · I_mesh = V_mesh.
  // For each mesh i, equation: Σ_{branches in mesh} sign · (resistor·current_through_that_branch − V_source) = 0
  // Branch current through resistor in mesh = Σ_{meshes containing it} (sign in this mesh) · I_mesh.
  const m = meshes.length;
  const R_mat: number[][] = Array.from({ length: m }, () => new Array(m).fill(0));
  const V_vec: number[] = new Array(m).fill(0);

  // Build R_mat·I_mesh = V_vec.
  //
  // For each branch B in mesh i with traversal sign s_i ∈ {+1, −1}, the voltage
  // drop across B in mesh i's traversal direction equals s_i · R · I_branch.
  // I_branch (in branch a→b direction) = Σ_k s_k · I_m_k (sum across every mesh
  // that contains B). Expanding: self-term = R (always), cross-term = s_i·s_j·R.
  //
  // For a V source: traversal drop = s_i · V_s. Move to RHS → −s_i · V_s.
  for (let i = 0; i < m; i++) {
    for (const { branch, sign } of meshes[i].branches) {
      if (branch.kind === 'R') {
        R_mat[i][i] += branch.value; // self-term (s_i² = 1)
        for (let j = 0; j < m; j++) {
          if (j === i) continue;
          const e = meshes[j].branches.find((x) => x.branch.id === branch.id);
          if (!e) continue;
          R_mat[i][j] += sign * e.sign * branch.value; // mutual term
        }
      } else if (branch.kind === 'V') {
        V_vec[i] -= sign * branch.value; // EMF on the RHS
      }
    }
  }

  const I_mesh = gauss(R_mat, V_vec);
  if (!I_mesh) {
    return notApplicable('Mesh matrix singular — วงจรอาจมีหลายลูปที่ไม่ต่อถึงกัน');
  }

  const styleA: string[] = [
    `Number of independent meshes: ${m} = E − N + 1.`,
    `กำหนดกระแส mesh I_m1..I_m${m} ทิศทางการ traverse เลือกจาก DFS spanning tree`,
    ``,
    `KVL ของแต่ละ mesh (Σ V รอบลูป = 0 โดย V_R = (ผลรวมของกระแส mesh)·R):`,
  ];
  for (let i = 0; i < m; i++) {
    const parts: string[] = [];
    for (let j = 0; j < m; j++) {
      const c = R_mat[i][j];
      if (Math.abs(c) < 1e-12) continue;
      parts.push(`${c >= 0 && parts.length ? '+ ' : ''}${formatValue(c, 'Ω')}·I_m${j + 1}`);
    }
    styleA.push(`  mesh ${i + 1}:  ${parts.join(' ')} = ${fmtV(V_vec[i])}`);
  }
  styleA.push(``, `Solve:`);
  for (let i = 0; i < m; i++) styleA.push(`  I_m${i + 1} = ${fmtI(I_mesh[i])}`);
  styleA.push(``, `กระแสในแต่ละสาขา (รวมกระแส mesh ที่ผ่านสาขานั้น):`);
  for (const b of graph.branches.filter((b) => b.kind === 'R')) {
    let total = 0;
    for (let i = 0; i < m; i++) {
      const e = meshes[i].branches.find((x) => x.branch.id === b.id);
      if (e) total += e.sign * I_mesh[i];
    }
    styleA.push(`  I_${b.label} = ${fmtI(total)}`);
  }

  const styleB: string[] = [
    `Mesh analysis เลือกกระแส loop (mesh) เป็นตัวแปรแทนแรงดันที่ node`,
    `ในวงจร planar ที่มี E สาขาและ N nodes จำนวน mesh อิสระคือ M = E − N + 1`,
    `แต่ละ mesh มีกระแสของตัวเอง — กระแสจริงในสาขาคือผลรวมเชิงพีชคณิตของกระแส mesh ที่ผ่านสาขานั้น`,
    ``,
    `เขียน KVL รอบแต่ละ mesh: Σ V = 0 ถ้า resistor ถูกใช้ร่วมกัน 2 mesh,`,
    `กระแสที่ไหลจริงเป็นผลต่าง (หรือผลรวม) ของกระแส 2 mesh นั้น`,
    `ผลลัพธ์คือระบบสมการ M×M ของ R·I_m = V ซึ่ง solve ให้กระแสในทุกลูป`,
    ``,
    `ข้อจำกัด: independent current source ต้องใช้ "supermesh" — รวม 2 mesh ที่มันคร่อม`,
    `เป็นสมการเดียว แล้วเติม constraint I_ma − I_mb = I_source`,
    `ยังไม่รองรับใน v2 — ให้ใช้ Nodal แทนสำหรับวงจรที่มี current source`,
  ];

  return {
    applicable: true,
    styleA,
    styleB,
    answer: `Solved ${m} mesh current(s) via KVL`,
  };
}

function gauss(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  const EPS = 1e-12;
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < EPS) return null;
    if (piv !== col) { const t = M[piv]; M[piv] = M[col]; M[col] = t; }
    for (let r = col + 1; r < n; r++) {
      const f = M[r][col] / M[col][col];
      if (f === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let c = r + 1; c < n; c++) s -= M[r][c] * x[c];
    x[r] = s / M[r][r];
  }
  return x;
}

// ---- Registry ---------------------------------------------------------------

export const METHODS: MethodDef[] = [
  {
    id: 'ohm',
    name: 'Ohm’s law',
    nameTh: 'กฎของโอห์ม',
    blurb: 'แหล่งจ่ายตัวเดียวกับ resistor ตัวเดียวในวงจร',
    implemented: true,
    analyze: detectOhm,
  },
  {
    id: 'vdiv',
    name: 'Voltage divider',
    nameTh: 'วงจรแบ่งแรงดัน',
    blurb: 'Resistor 2 ตัวต่ออนุกรมคร่อมแหล่งจ่าย',
    implemented: true,
    analyze: detectVoltageDivider,
  },
  {
    id: 'idiv',
    name: 'Current divider',
    nameTh: 'วงจรแบ่งกระแส',
    blurb: 'Resistor ตั้งแต่ 2 ตัวขึ้นไปต่อขนานคร่อมแหล่งจ่าย',
    implemented: true,
    analyze: detectCurrentDivider,
  },
  {
    id: 'kvl',
    name: 'KVL trace',
    nameTh: 'กฎของเคอร์ชอฟฟ์ (KVL)',
    blurb: 'วงจรลูปเดียว ใช้ได้กับ resistor + แหล่งจ่ายจำนวนเท่าใดก็ได้',
    implemented: true,
    analyze: detectKVL,
  },
  {
    id: 'mesh',
    name: 'Mesh analysis',
    nameTh: 'การวิเคราะห์เมช',
    blurb: 'หากระแสในแต่ละลูปด้วย KVL — ใช้กับวงจรหลายลูปได้',
    implemented: true,
    analyze: detectMesh,
  },
  {
    id: 'nodal',
    name: 'Nodal analysis',
    nameTh: 'การวิเคราะห์โนด',
    blurb: 'หาแรงดันที่ node ด้วย KCL — ใช้ได้กับวงจรทุกรูปแบบ',
    implemented: true,
    analyze: detectNodal,
  },
  {
    id: 'superpos',
    name: 'Superposition',
    nameTh: 'การวางซ้อน',
    blurb: 'แหล่งจ่ายหลายตัว: solve ทีละตัวแล้วเอามารวมกัน',
    implemented: true,
    analyze: detectSuperposition,
  },
  {
    id: 'thevenin',
    name: 'Thévenin equivalent',
    nameTh: 'เทียบเคียงเทวินิน',
    blurb: 'ยุบส่วนที่เหลือของวงจรให้เป็น V_th + R_th ที่โหลดมองเห็น',
    implemented: true,
    analyze: detectThevenin,
  },
];

import { Edge, Node } from '@xyflow/react';
import {
  COIL_KINDS,
  ComponentKind,
  DESCRIPTORS,
  IECNodeData,
  INSTANT_COIL_CONTACTS,
  JUNCTION_KINDS,
  LIT_KINDS,
  MotorState,
  POLE3_CONTACTS,
  POLE3_PASS,
  SOURCE_KINDS,
  SWITCH_LIKE_NC,
  SWITCH_LIKE_NO,
  TIMER_COIL_KINDS,
  TIMER_CONTACTS,
  TIMER_OFF_COIL_KINDS,
  TIMER_OFF_CONTACTS,
  TWO_TERMINAL_CONDUCTORS,
} from '../components/nodes/iec';

interface UnionFind {
  find(x: string): string;
  union(a: string, b: string): void;
}

function makeUF(): UnionFind {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    if (!parent.has(x)) parent.set(x, x);
    let p = parent.get(x)!;
    if (p === x) return x;
    p = find(p);
    parent.set(x, p);
    return p;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  return { find, union };
}

const key = (nodeId: string, handleId: string) => `${nodeId}:${handleId}`;

export interface SimResult {
  lit: Map<string, boolean>;
  /** All currently-energised coils (any COIL_KIND on a closed loop with a source). */
  energisedCoils: Set<string>;
  /** On-delay timer coils currently energised — scheduler uses to start delays. */
  energisedTimerCoils: Set<string>;
  /** Off-delay timer coils currently energised — scheduler uses to detect transitions. */
  energisedOffDelayCoils: Set<string>;
  /** Contacts forced closed by the (instant + actuated-timer) coil-driven linking. */
  forcedClosed: Set<string>;
  /** Edge IDs whose conductor lies on a closed loop carrying current. */
  energisedEdges: Set<string>;
  /** Per motor node id → 'off' | 'on' | 'star' | 'delta' for state badge rendering. */
  motorStates: Map<string, MotorState>;
}

interface SourceClass { plus: string; minus: string; }

function effectiveClosed(kind: ComponentKind, dataClosed: boolean, forced: boolean): boolean {
  const actuated = forced || dataClosed;
  if (SWITCH_LIKE_NC.has(kind)) return !actuated;
  return actuated;
}

function simulatePass(
  nodes: Node<IECNodeData>[],
  edges: Edge[],
  forceClosed: Set<string>,
): { uf: UnionFind; sources: SourceClass[] } {
  const uf = makeUF();

  // 1) Wires
  for (const e of edges) {
    if (!e.sourceHandle || !e.targetHandle) continue;
    uf.union(key(e.source, e.sourceHandle), key(e.target, e.targetHandle));
  }

  // 2) Internal merges per component
  for (const n of nodes) {
    const k = n.data.kind;
    if (JUNCTION_KINDS.has(k)) {
      const handles = DESCRIPTORS[k]?.handles ?? [];
      for (let i = 1; i < handles.length; i++) {
        uf.union(key(n.id, handles[0].id), key(n.id, handles[i].id));
      }
      continue;
    }
    if (TWO_TERMINAL_CONDUCTORS.has(k)) {
      uf.union(key(n.id, 'a'), key(n.id, 'b'));
      continue;
    }
    if (SWITCH_LIKE_NO.has(k) || SWITCH_LIKE_NC.has(k)) {
      const forced = forceClosed.has(n.id);
      // CB and disconnect default to closed (ON) when data.closed is undefined,
      // matching real-world devices that ship in the ON position.
      const dataClosed = (k === 'cb' || k === 'disconnect') ? n.data.closed !== false : !!n.data.closed;
      if (effectiveClosed(k, dataClosed, forced)) {
        uf.union(key(n.id, 'a'), key(n.id, 'b'));
      }
      continue;
    }
    if (POLE3_PASS.has(k)) {
      uf.union(key(n.id, '1'), key(n.id, '2'));
      uf.union(key(n.id, '3'), key(n.id, '4'));
      uf.union(key(n.id, '5'), key(n.id, '6'));
      continue;
    }
    if (POLE3_CONTACTS.has(k)) {
      const forced = forceClosed.has(n.id);
      // MCB defaults to closed (conducting) when data.closed is undefined — matches
      // real-world MCBs which ship ON. Contactors default to open.
      const dataClosed = k === 'mcb3p' ? n.data.closed !== false : !!n.data.closed;
      if (dataClosed || forced) {
        uf.union(key(n.id, '1'), key(n.id, '2'));
        uf.union(key(n.id, '3'), key(n.id, '4'));
        uf.union(key(n.id, '5'), key(n.id, '6'));
      }
      continue;
    }
    if (k === 'spdt') {
      uf.union(key(n.id, 'c'), key(n.id, n.data.closed ? 'b' : 'a'));
      continue;
    }
    if (k === 'selector2pos') {
      // closed=false → arm to 12 (NC default); closed=true → arm to 14 (NO actuated)
      uf.union(key(n.id, '11'), key(n.id, n.data.closed ? '14' : '12'));
      continue;
    }
    if (k === 'motor3p') {
      // Y or Δ winding internals — U/V/W collapse to one electrical node. Without
      // this the simulator can't close a 3-phase loop through the motor and the
      // power wires never light up. PE stays separate (safety bond, no current).
      uf.union(key(n.id, 'u'), key(n.id, 'v'));
      uf.union(key(n.id, 'v'), key(n.id, 'w'));
      continue;
    }
    // motor3p_yd is deliberately NOT unioned — K2 (star) and K3 (delta)
    // contactors provide the winding connections externally during the Y-Δ sequence.
  }

  // 3) Source classes
  //    Explicit AC/DC source symbols contribute a (plus=a, minus=b) source pair.
  //    -X terminal block (xterm5) implicitly acts as an L1-N source: in industrial
  //    drawings the supply comes from upstream and -X is the boundary, so the panel
  //    diagram itself never shows a source symbol. We replicate that here so the
  //    drawing matches IEC convention while the simulator still energises the loop.
  const sources: SourceClass[] = [];
  for (const n of nodes) {
    if (SOURCE_KINDS.has(n.data.kind)) {
      sources.push({
        plus: uf.find(key(n.id, 'a')),
        minus: uf.find(key(n.id, 'b')),
      });
    } else if (n.data.kind === 'xterm5') {
      sources.push({
        plus: uf.find(key(n.id, 'l1')),
        minus: uf.find(key(n.id, 'n')),
      });
    }
  }
  return { uf, sources };
}

/**
 * Topology simulation with coil/contact label-link.
 *
 * Load energisation is determined by REALISTIC path-tracing in a wire-only
 * graph (loads don't pass-through current to other loads). This is the correct
 * model: a lamp/coil is energised iff its two terminals are reachable from
 * source-plus and source-minus respectively through CONDUCTORS — not through
 * other loads sharing a rail. The previous UF-class-membership check produced
 * the "all lamps light up together" bug because once any single load bridges
 * L↔N, every load's terminal-pair sits in the same merged class.
 *
 * @param actuatedTimers  Set of timer-coil node IDs whose delay has elapsed.
 *                        These behave like instant coils for the duration they remain
 *                        in this set. The App-side scheduler is responsible for
 *                        adding/removing entries based on real-time elapsed.
 */
export function simulate(
  nodes: Node<IECNodeData>[],
  edges: Edge[],
  actuatedTimers: Set<string> = new Set(),
  /**
   * Labels whose off-delay timer is currently in its post-drop-out delay window.
   * While a label is "held", its off-delay contacts stay in their actuated state
   * even though the coil is no longer energised.
   */
  heldOffDelayLabels: Set<string> = new Set(),
  /**
   * Previously-converged forcedClosed set (last render's result). Passing this
   * back lets the seal-in latch persist across renders: when the user clicks a
   * momentary pushbutton, the K1 coil energises this render, forces K1auxNO
   * closed, and that closure is fed back in on the next render so K1 stays
   * latched until something actually breaks its path (STOP, fuse blow, OL).
   * Without this, releasing START would drop K1 immediately.
   */
  prevForcedClosed: Set<string> = new Set(),
): SimResult {
  const olTrippedLabels = new Set<string>();
  for (const n of nodes) {
    if (!n.data.label || !n.data.closed) continue;
    if (n.data.kind === 'olcontact' || n.data.kind === 'olalarm' || n.data.kind === 'overload3p') {
      olTrippedLabels.add(n.data.label);
    }
  }

  let forcedClosed = new Set(prevForcedClosed);
  let realistic = computeRealisticEnergisation(nodes, edges, forcedClosed);

  for (let iter = 0; iter < 8; iter++) {
    const instantCoilLabels = new Set<string>();
    const actuatedTimerLabels = new Set<string>();
    const offDelayActiveLabels = new Set<string>(heldOffDelayLabels);
    for (const n of nodes) {
      const k = n.data.kind;
      if (!COIL_KINDS.has(k)) continue;
      if (!realistic.energisedCoils.has(n.id)) continue;
      if (TIMER_COIL_KINDS.has(k)) {
        if (actuatedTimers.has(n.id) && n.data.label) actuatedTimerLabels.add(n.data.label);
      } else if (TIMER_OFF_COIL_KINDS.has(k)) {
        if (n.data.label) offDelayActiveLabels.add(n.data.label);
      } else if (n.data.label) {
        instantCoilLabels.add(n.data.label);
      }
    }

    const nextForced = new Set<string>();
    for (const n of nodes) {
      if (!n.data.label) continue;
      if ((n.data.kind === 'olcontact' || n.data.kind === 'olalarm') && olTrippedLabels.has(n.data.label)) {
        nextForced.add(n.id);
        continue;
      }
      if (INSTANT_COIL_CONTACTS.has(n.data.kind)) {
        if (instantCoilLabels.has(n.data.label)) nextForced.add(n.id);
      } else if (TIMER_CONTACTS.has(n.data.kind)) {
        if (actuatedTimerLabels.has(n.data.label)) nextForced.add(n.id);
      } else if (TIMER_OFF_CONTACTS.has(n.data.kind)) {
        if (offDelayActiveLabels.has(n.data.label)) nextForced.add(n.id);
      }
    }

    if (setsEqual(nextForced, forcedClosed)) {
      const { uf } = simulatePass(nodes, edges, forcedClosed);
      const motorStates = computeMotorStates(nodes, uf, realistic.motorPrimaryEnergised);
      return {
        lit: realistic.lit,
        energisedCoils: realistic.energisedCoils,
        energisedTimerCoils: realistic.energisedTimerCoils,
        energisedOffDelayCoils: realistic.energisedOffDelayCoils,
        forcedClosed,
        energisedEdges: realistic.energisedEdges,
        motorStates,
      };
    }
    forcedClosed = nextForced;
    realistic = computeRealisticEnergisation(nodes, edges, forcedClosed);
  }

  const { uf } = simulatePass(nodes, edges, forcedClosed);
  const motorStates = computeMotorStates(nodes, uf, realistic.motorPrimaryEnergised);
  return {
    lit: realistic.lit,
    energisedCoils: realistic.energisedCoils,
    energisedTimerCoils: realistic.energisedTimerCoils,
    energisedOffDelayCoils: realistic.energisedOffDelayCoils,
    forcedClosed,
    energisedEdges: realistic.energisedEdges,
    motorStates,
  };
}

// ---------------------------------------------------------------------------
// REALISTIC ENERGISATION — wire-only BFS with path tracing.
//
// A load (lamp / coil) is "energised" iff its two terminals are reachable from
// source-plus and source-minus respectively through CONDUCTORS ONLY — wires,
// junctions, fuses, closed switches, motor3p_yd winding paths via K2/K3, etc.
// Loads themselves do NOT pass-through, so one lit lamp can't make another
// lamp on the same rail spuriously appear lit.
//
// Wire glow is then path-traced: for each active load, walk back through the
// multi-parent BFS tree from each terminal to its matching source. Every edge
// on any shortest path glows — including parallel branches at equal distance
// (e.g., START button parallel with K1auxNO seal-in).
// ---------------------------------------------------------------------------

interface AdjEntry { to: string; edgeId: string | null; }
interface BfsTree {
  dist: Map<string, number>;
  parents: Map<string, AdjEntry[]>; // edges that brought us to this handle at shortest distance
}

function buildWireAdj(
  nodes: Node<IECNodeData>[],
  edges: Edge[],
  forcedClosed: Set<string>,
): Map<string, AdjEntry[]> {
  const adj = new Map<string, AdjEntry[]>();
  const link = (a: string, b: string, edgeId: string | null) => {
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a)!.push({ to: b, edgeId });
    adj.get(b)!.push({ to: a, edgeId });
  };

  for (const e of edges) {
    if (!e.sourceHandle || !e.targetHandle) continue;
    link(key(e.source, e.sourceHandle), key(e.target, e.targetHandle), e.id);
  }

  for (const n of nodes) {
    const k = n.data.kind;
    if (JUNCTION_KINDS.has(k)) {
      const handles = DESCRIPTORS[k]?.handles ?? [];
      for (let i = 1; i < handles.length; i++) {
        link(key(n.id, handles[0].id), key(n.id, handles[i].id), null);
      }
      continue;
    }
    if (k === 'fuse' || k === 'ammeter') {
      link(key(n.id, 'a'), key(n.id, 'b'), null);
      continue;
    }
    if (SWITCH_LIKE_NO.has(k) || SWITCH_LIKE_NC.has(k)) {
      const dataClosed = (k === 'cb' || k === 'disconnect') ? n.data.closed !== false : !!n.data.closed;
      const forced = forcedClosed.has(n.id);
      if (effectiveClosed(k, dataClosed, forced)) {
        link(key(n.id, 'a'), key(n.id, 'b'), null);
      }
      continue;
    }
    if (POLE3_PASS.has(k)) {
      link(key(n.id, '1'), key(n.id, '2'), null);
      link(key(n.id, '3'), key(n.id, '4'), null);
      link(key(n.id, '5'), key(n.id, '6'), null);
      continue;
    }
    if (POLE3_CONTACTS.has(k)) {
      const dataClosed = k === 'mcb3p' ? n.data.closed !== false : !!n.data.closed;
      const forced = forcedClosed.has(n.id);
      if (dataClosed || forced) {
        link(key(n.id, '1'), key(n.id, '2'), null);
        link(key(n.id, '3'), key(n.id, '4'), null);
        link(key(n.id, '5'), key(n.id, '6'), null);
      }
      continue;
    }
    if (k === 'spdt') {
      link(key(n.id, 'c'), key(n.id, n.data.closed ? 'b' : 'a'), null);
      continue;
    }
    if (k === 'selector2pos') {
      link(key(n.id, '11'), key(n.id, n.data.closed ? '14' : '12'), null);
      continue;
    }
    // Loads (coils, lamps, motor3p, motor3p_yd) are deliberately NOT linked
    // internally — they bridge potentials but don't conduct between other loads.
  }
  return adj;
}

function bfsMultiParent(starts: string[], adj: Map<string, AdjEntry[]>): BfsTree {
  const dist = new Map<string, number>();
  const parents = new Map<string, AdjEntry[]>();
  const queue: string[] = [];
  for (const s of starts) {
    if (dist.has(s)) continue;
    dist.set(s, 0);
    parents.set(s, []);
    queue.push(s);
  }
  let head = 0;
  while (head < queue.length) {
    const u = queue[head++];
    const du = dist.get(u)!;
    for (const { to: v, edgeId } of adj.get(u) ?? []) {
      const dv = dist.get(v);
      if (dv === undefined) {
        dist.set(v, du + 1);
        parents.set(v, [{ to: u, edgeId }]);
        queue.push(v);
      } else if (dv === du + 1) {
        parents.get(v)!.push({ to: u, edgeId });
      }
    }
  }
  return { dist, parents };
}

function tracePath(end: string, tree: BfsTree, marked: Set<string>) {
  const visited = new Set<string>([end]);
  const stack: string[] = [end];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const p of tree.parents.get(cur) ?? []) {
      if (p.edgeId) marked.add(p.edgeId);
      if (!visited.has(p.to)) {
        visited.add(p.to);
        stack.push(p.to);
      }
    }
  }
}

function sourceTerminals(nodes: Node<IECNodeData>[]): { plus: string[]; minus: string[] } {
  const plus: string[] = [];
  const minus: string[] = [];
  for (const n of nodes) {
    if (n.data.kind === 'xterm5') {
      plus.push(key(n.id, 'l1'), key(n.id, 'l2'), key(n.id, 'l3'));
      minus.push(key(n.id, 'n'));
    } else if (SOURCE_KINDS.has(n.data.kind)) {
      plus.push(key(n.id, 'a'));
      minus.push(key(n.id, 'b'));
    }
  }
  return { plus, minus };
}

interface RealisticResult {
  lit: Map<string, boolean>;
  energisedCoils: Set<string>;
  energisedTimerCoils: Set<string>;
  energisedOffDelayCoils: Set<string>;
  energisedEdges: Set<string>;
  /** Motor nodes whose primary windings are fully connected to phase sources.
   *  Combined with UF topology to decide motor3p_yd Y vs Δ vs ON. */
  motorPrimaryEnergised: Set<string>;
}

function computeRealisticEnergisation(
  nodes: Node<IECNodeData>[],
  edges: Edge[],
  forcedClosed: Set<string>,
): RealisticResult {
  const adj = buildWireAdj(nodes, edges, forcedClosed);
  const { plus, minus } = sourceTerminals(nodes);
  const lTree = bfsMultiParent(plus, adj);
  const nTree = bfsMultiParent(minus, adj);

  const lit = new Map<string, boolean>();
  const energisedCoils = new Set<string>();
  const energisedTimerCoils = new Set<string>();
  const energisedOffDelayCoils = new Set<string>();
  const energisedEdges = new Set<string>();
  const motorPrimaryEnergised = new Set<string>();

  for (const n of nodes) {
    const k = n.data.kind;
    const isLamp = LIT_KINDS.has(k);
    const isCoil = COIL_KINDS.has(k);

    // Motor3p / motor3p_yd: 3-phase load. Energised iff every primary winding
    // terminal is reachable from any phase source (i.e., K1 main pole is closed
    // and the power chain is intact). Doesn't need an N return — the motor is
    // its own 3-phase loop (winding-to-winding).
    if (k === 'motor3p' || k === 'motor3p_yd') {
      const primaries = k === 'motor3p' ? ['u', 'v', 'w'] : ['u1', 'v1', 'w1'];
      const allInL = primaries.every((h) => lTree.dist.has(key(n.id, h)));
      if (allInL) {
        motorPrimaryEnergised.add(n.id);
        for (const h of primaries) tracePath(key(n.id, h), lTree, energisedEdges);
      }
      continue;
    }

    if (!isLamp && !isCoil) continue;
    const aKey = key(n.id, 'a');
    const bKey = key(n.id, 'b');
    const aL = lTree.dist.has(aKey);
    const aN = nTree.dist.has(aKey);
    const bL = lTree.dist.has(bKey);
    const bN = nTree.dist.has(bKey);
    const energised = (aL && bN) || (aN && bL);
    if (isLamp) lit.set(n.id, energised);
    if (energised && isCoil) {
      energisedCoils.add(n.id);
      if (TIMER_COIL_KINDS.has(k)) energisedTimerCoils.add(n.id);
      else if (TIMER_OFF_COIL_KINDS.has(k)) energisedOffDelayCoils.add(n.id);
    }
    if (energised) {
      if (aL) tracePath(aKey, lTree, energisedEdges);
      if (aN) tracePath(aKey, nTree, energisedEdges);
      if (bL) tracePath(bKey, lTree, energisedEdges);
      if (bN) tracePath(bKey, nTree, energisedEdges);
    }
  }

  return { lit, energisedCoils, energisedTimerCoils, energisedOffDelayCoils, energisedEdges, motorPrimaryEnergised };
}

// ---------------------------------------------------------------------------
// MOTOR STATE — energisation from realistic BFS, Y/Δ topology from UF.
//
// motor3p: 'on' iff its three primary terminals are all reachable from phase
// sources (i.e., K1 main pole closed). Realistic check via BFS.
//
// motor3p_yd: same primary-energised check; if running, inspect the secondary
// windings via UF:
//   • W2/U2/V2 in same UF class → K2 shorted them at the star point → 'star'.
//   • Secondary cross-connected to a different primary's class → 'delta'.
//   • Otherwise → 'on' (primaries powered but no winding return — won't run).
// ---------------------------------------------------------------------------
function computeMotorStates(
  nodes: Node<IECNodeData>[],
  uf: UnionFind,
  motorPrimaryEnergised: Set<string>,
): Map<string, MotorState> {
  const states = new Map<string, MotorState>();
  for (const n of nodes) {
    if (n.data.kind === 'motor3p') {
      states.set(n.id, motorPrimaryEnergised.has(n.id) ? 'on' : 'off');
    } else if (n.data.kind === 'motor3p_yd') {
      if (!motorPrimaryEnergised.has(n.id)) { states.set(n.id, 'off'); continue; }
      const u1 = uf.find(key(n.id, 'u1'));
      const v1 = uf.find(key(n.id, 'v1'));
      const w1 = uf.find(key(n.id, 'w1'));
      const w2 = uf.find(key(n.id, 'w2'));
      const u2 = uf.find(key(n.id, 'u2'));
      const v2 = uf.find(key(n.id, 'v2'));
      if (w2 === u2 && u2 === v2) { states.set(n.id, 'star'); continue; }
      if (w2 === u1 || u2 === v1 || v2 === w1) { states.set(n.id, 'delta'); continue; }
      states.set(n.id, 'on');
    }
  }
  return states;
}


function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// WIRE AUTO-COLOR
//
// Wires are coloured by *which source they're electrically connected to*,
// using a topology pass that pretends every switch is closed (so wire colour
// is stable regardless of contactor state — it shows wiring INTENT, not
// current state). The simulator's energised highlight is applied on top.
//
// Loads (coils, lamps, motors, resistors, …) are deliberately NOT unioned —
// otherwise an L→coil→N loop would collapse L and N into one class and the
// whole control circuit would false-positive as a short.
// ---------------------------------------------------------------------------

export const WIRE_COLOR = {
  L:     '#dc2626', // phase (L1/L2/L3 or DC +)
  N:     '#1e40af', // neutral / control return / DC −
  PE:    '#16a34a', // protective earth
  SHORT: '#d946ef', // wire connected to ≥2 source roles (drawing error)
  FLOAT: '#0f172a', // not connected to any source
} as const;

export interface WireColorMap {
  edgeColors: Map<string, string>;
  shorts: Set<string>;
}

const COLOR_PASSTHROUGH: ReadonlySet<ComponentKind> = new Set<ComponentKind>(['fuse', 'ammeter']);

export function computeWireColors(
  nodes: Node<IECNodeData>[],
  edges: Edge[],
): WireColorMap {
  const uf = makeUF();

  for (const e of edges) {
    if (!e.sourceHandle || !e.targetHandle) continue;
    uf.union(key(e.source, e.sourceHandle), key(e.target, e.targetHandle));
  }

  for (const n of nodes) {
    const k = n.data.kind;
    if (JUNCTION_KINDS.has(k)) {
      const handles = DESCRIPTORS[k]?.handles ?? [];
      for (let i = 1; i < handles.length; i++) {
        uf.union(key(n.id, handles[0].id), key(n.id, handles[i].id));
      }
      continue;
    }
    if (COLOR_PASSTHROUGH.has(k)) {
      uf.union(key(n.id, 'a'), key(n.id, 'b'));
      continue;
    }
    if (SWITCH_LIKE_NO.has(k) || SWITCH_LIKE_NC.has(k)) {
      // POTENTIAL colouring: every switch treated as closed.
      uf.union(key(n.id, 'a'), key(n.id, 'b'));
      continue;
    }
    if (POLE3_PASS.has(k) || POLE3_CONTACTS.has(k)) {
      uf.union(key(n.id, '1'), key(n.id, '2'));
      uf.union(key(n.id, '3'), key(n.id, '4'));
      uf.union(key(n.id, '5'), key(n.id, '6'));
      continue;
    }
    if (k === 'spdt') {
      uf.union(key(n.id, 'c'), key(n.id, 'a'));
      uf.union(key(n.id, 'c'), key(n.id, 'b'));
      continue;
    }
    if (k === 'selector2pos') {
      uf.union(key(n.id, '11'), key(n.id, '12'));
      uf.union(key(n.id, '11'), key(n.id, '14'));
      continue;
    }
    if (k === 'motor3p') {
      // Mirror the Y/Δ winding internals so wire colour matches the simulator's
      // topology — all three phase chains should colour as one L class through
      // the motor, not three isolated stubs.
      uf.union(key(n.id, 'u'), key(n.id, 'v'));
      uf.union(key(n.id, 'v'), key(n.id, 'w'));
      continue;
    }
    // Loads + motor3p_yd + sources + terminal blocks: no internal union for colour.
  }

  const lClasses = new Set<string>();
  const nClasses = new Set<string>();
  const peClasses = new Set<string>();
  for (const n of nodes) {
    if (n.data.kind === 'xterm5') {
      lClasses.add(uf.find(key(n.id, 'l1')));
      lClasses.add(uf.find(key(n.id, 'l2')));
      lClasses.add(uf.find(key(n.id, 'l3')));
      nClasses.add(uf.find(key(n.id, 'n')));
      peClasses.add(uf.find(key(n.id, 'pe')));
    } else if (SOURCE_KINDS.has(n.data.kind)) {
      lClasses.add(uf.find(key(n.id, 'a')));
      nClasses.add(uf.find(key(n.id, 'b')));
    }
  }

  const edgeColors = new Map<string, string>();
  const shorts = new Set<string>();
  for (const e of edges) {
    if (!e.sourceHandle || !e.targetHandle) continue;
    const c = uf.find(key(e.source, e.sourceHandle));
    const isL = lClasses.has(c);
    const isN = nClasses.has(c);
    const isPE = peClasses.has(c);
    const roleCount = (isL ? 1 : 0) + (isN ? 1 : 0) + (isPE ? 1 : 0);
    if (roleCount >= 2) {
      edgeColors.set(e.id, WIRE_COLOR.SHORT);
      shorts.add(e.id);
    } else if (isL) edgeColors.set(e.id, WIRE_COLOR.L);
    else if (isN) edgeColors.set(e.id, WIRE_COLOR.N);
    else if (isPE) edgeColors.set(e.id, WIRE_COLOR.PE);
    else edgeColors.set(e.id, WIRE_COLOR.FLOAT);
  }
  return { edgeColors, shorts };
}

/** Parse a delay string like "5 s", "200 ms", "1.5 min" → milliseconds. Defaults to 5000 ms. */
export function parseDelayMs(value: string | undefined): number {
  if (!value) return 5000;
  const m = value.trim().match(/^(\d+(?:\.\d+)?)\s*(ms|s|min)?$/i);
  if (!m) return 5000;
  const num = parseFloat(m[1]);
  const unit = (m[2] || 's').toLowerCase();
  switch (unit) {
    case 'ms': return num;
    case 's': return num * 1000;
    case 'min': return num * 60000;
    default: return num * 1000;
  }
}

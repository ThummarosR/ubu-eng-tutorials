import { Handle, Position, NodeProps } from '@xyflow/react';
import { CSSProperties, ReactNode } from 'react';

export type ComponentKind =
  // Basics (legacy, still available)
  | 'resistor'
  | 'capacitor'
  | 'inductor'
  | 'dcsource'
  | 'acsource'
  | 'switch'
  | 'lamp'
  | 'ground'
  | 'ammeter'
  | 'voltmeter'
  | 'diode'
  | 'led'
  | 'npn'
  | 'junction'
  | 'pot'
  // Motor-control: power side
  | 'mcb3p'
  | 'contactor3p'
  | 'overload3p'
  | 'motor3p'
  | 'motor3p_yd'
  | 'fuse'
  | 'fuse3p'
  | 'xterm5'
  // Motor-control: control side
  | 'contactor'
  | 'cb'
  | 'auxno'
  | 'auxnc'
  | 'olcontact'
  | 'olalarm'
  | 'pbno'
  | 'pbnc'
  | 'estop'
  | 'limitno'
  | 'limitnc'
  | 'footsw'
  | 'selector2pos'
  | 'disconnect'
  | 'pilotlamp'
  | 'timercoil'
  | 'timerno'
  | 'timernc'
  | 'timercoiloff'
  | 'timernooff'
  | 'timerncoff'
  | 'xformer'
  | 'terminal'
  // Legacy aliases kept for backwards compatibility with older saves
  | 'pushbutton'
  | 'spdt'
  | 'relaycoil'
  | 'relaycontact'
  // Analyze v3 — SISO TF markers (only one of each type allowed on canvas).
  | 'vin'
  | 'vout'
  | 'iin'
  | 'iout'
  // Analyze v4 — 3-phase (Lab 11). Each component is "compound" — it contains all
  // three phases internally and exposes a, b, c (+ n for Y) terminals.
  | 'src3p'
  | 'loady3p'
  | 'loadd3p'
  // Block-diagram (v0.3, linear SISO control systems). Visually rectangles with
  // a name + optional TF expression; logically a signal-flow graph from input
  // to output. Reduction lives in src/lib/blockdiagram/.
  | 'block_g'      // generic G_n(s) — symbolic or numeric TF
  | 'block_h'      // feedback H_n(s) — same as G but labelled H by default
  | 'block_k'      // pure gain K
  | 'block_p'      // proportional (alias for K, labelled P)
  | 'block_i'      // integrator K/s
  | 'block_d'      // derivative K·s
  | 'summer'       // variable 2–4 inputs (signs per input), 1 output
  | 'pickoff'      // 1 input, variable 2–3 outputs
  | 'bd_input'     // R(s) reference marker
  | 'bd_output';   // Y(s) output marker

export type Rotation = 0 | 90 | 180 | 270;
export type LampColor = 'green' | 'red' | 'amber' | 'white' | 'blue';

export interface IECNodeData extends Record<string, unknown> {
  kind: ComponentKind;
  label?: string;
  value?: string;
  rotation?: Rotation;
  closed?: boolean; // true = "energised / pressed / closed"; NC contacts interpret this as "open"
  lit?: boolean;
  color?: LampColor; // for pilotlamp
  /** Set by the simulator on a timer coil while its delay is counting down. */
  delaying?: boolean;
  /** Analyze-mode annotations — pre-formatted text like "0.80 mA →" / "4.00 V". */
  analyzeI?: string;
  analyzeV?: string;
  /** Set by the simulator on motor3p / motor3p_yd nodes for state badge rendering. */
  motorState?: MotorState;
  /** When true and `lit`, the symbol blinks instead of staying steady — used for alarm lamps. */
  blink?: boolean;
  /** Block-diagram: TF expression string ("1/(s+1)", empty = symbolic). */
  tf?: string;
  /** Block-diagram summer: array of "+" or "-" per input handle (top→bottom or left→right). */
  signs?: ('+' | '-')[];
  /** Block-diagram summer/pickoff: number of input/output handles. */
  arity?: number;
}

export type MotorState = 'off' | 'on' | 'star' | 'delta';

const STROKE = '#0f172a';
const SW = 1.6;
const LIT_FILL = '#fde047';
const LED_LIT = '#ef4444';
const LED_OFF = '#fecaca';

const LAMP_COLORS: Record<LampColor, { on: string; off: string }> = {
  green: { on: '#22c55e', off: '#bbf7d0' },
  red: { on: '#ef4444', off: '#fecaca' },
  amber: { on: '#f59e0b', off: '#fde68a' },
  white: { on: '#ffffff', off: '#475569' },
  blue: { on: '#3b82f6', off: '#bfdbfe' },
};

export interface HandleDef {
  id: string;
  x: number;
  y: number;
  side: 'L' | 'R' | 'T' | 'B';
}

export interface CompDesc {
  w: number;
  h: number;
  handles: HandleDef[];
  draw: (state: { closed?: boolean; lit?: boolean; color?: LampColor; label?: string; delaying?: boolean; value?: string; motorState?: MotorState; blink?: boolean; signs?: ('+' | '-')[]; arity?: number }) => ReactNode;
}

function rotatePoint(x: number, y: number, w: number, h: number, rot: Rotation) {
  switch (rot) {
    case 90: return { x: h - y, y: x };
    case 180: return { x: w - x, y: h - y };
    case 270: return { x: y, y: w - x };
    default: return { x, y };
  }
}

const SIDE_ROT: Record<HandleDef['side'], Record<Rotation, HandleDef['side']>> = {
  L: { 0: 'L', 90: 'T', 180: 'R', 270: 'B' },
  R: { 0: 'R', 90: 'B', 180: 'L', 270: 'T' },
  T: { 0: 'T', 90: 'R', 180: 'B', 270: 'L' },
  B: { 0: 'B', 90: 'L', 180: 'T', 270: 'R' },
};

const SIDE_POSITION: Record<HandleDef['side'], Position> = {
  L: Position.Left, R: Position.Right, T: Position.Top, B: Position.Bottom,
};

const G = ({ children }: { children: ReactNode }) => (
  <g fill="none" stroke={STROKE} strokeWidth={SW}>{children}</g>
);

// =====================================================================
// LEGACY BASIC SYMBOLS (horizontal, 80×80 square frame)
// =====================================================================

function ResistorSym() {
  return <G><line x1="0" y1="40" x2="14" y2="40"/><rect x="14" y="32" width="52" height="16" fill="white"/><line x1="66" y1="40" x2="80" y2="40"/></G>;
}
function CapacitorSym() {
  return <G><line x1="0" y1="40" x2="36" y2="40"/><line x1="36" y1="26" x2="36" y2="54"/><line x1="44" y1="26" x2="44" y2="54"/><line x1="44" y1="40" x2="80" y2="40"/></G>;
}
function InductorSym() {
  return <G><line x1="0" y1="40" x2="14" y2="40"/><rect x="14" y="32" width="52" height="16" fill="#0f172a"/><line x1="66" y1="40" x2="80" y2="40"/></G>;
}
function DCSourceSym() {
  return (
    <G>
      <line x1="0" y1="40" x2="34" y2="40"/>
      <line x1="34" y1="28" x2="34" y2="52" strokeWidth={SW * 1.4}/>
      <line x1="42" y1="34" x2="42" y2="46"/>
      <line x1="42" y1="40" x2="80" y2="40"/>
      <text x="28" y="30" fontSize="9" fill={STROKE} stroke="none">+</text>
      <text x="44" y="30" fontSize="9" fill={STROKE} stroke="none">−</text>
    </G>
  );
}
function ACSourceSym() {
  return <G><line x1="0" y1="40" x2="20" y2="40"/><circle cx="40" cy="40" r="18" fill="white"/><path d="M 28 40 Q 34 30 40 40 T 52 40"/><line x1="60" y1="40" x2="80" y2="40"/></G>;
}
function SwitchSym({ closed }: { closed?: boolean }) {
  return (
    <G>
      <line x1="0" y1="40" x2="22" y2="40"/>
      <circle cx="22" cy="40" r="2" fill={STROKE}/>
      {closed ? <line x1="22" y1="40" x2="58" y2="40"/> : <line x1="22" y1="40" x2="58" y2="26"/>}
      <circle cx="58" cy="40" r="2" fill={STROKE}/>
      <line x1="58" y1="40" x2="80" y2="40"/>
    </G>
  );
}
function LampSym({ lit }: { lit?: boolean }) {
  return (
    <G>
      <line x1="0" y1="40" x2="20" y2="40"/>
      <circle cx="40" cy="40" r="18" fill={lit ? LIT_FILL : 'white'}/>
      <line x1="28" y1="28" x2="52" y2="52"/>
      <line x1="52" y1="28" x2="28" y2="52"/>
      <line x1="60" y1="40" x2="80" y2="40"/>
    </G>
  );
}
function GroundSym() {
  return <G><line x1="20" y1="0" x2="20" y2="18"/><line x1="4" y1="18" x2="36" y2="18"/><line x1="10" y1="24" x2="30" y2="24"/><line x1="16" y1="30" x2="24" y2="30"/></G>;
}
function AmmeterSym() {
  return <G><line x1="0" y1="40" x2="20" y2="40"/><circle cx="40" cy="40" r="18" fill="white"/><text x="40" y="46" fontSize="18" fontWeight="600" textAnchor="middle" fill={STROKE} stroke="none">A</text><line x1="60" y1="40" x2="80" y2="40"/></G>;
}
function VoltmeterSym() {
  return <G><line x1="0" y1="40" x2="20" y2="40"/><circle cx="40" cy="40" r="18" fill="white"/><text x="40" y="46" fontSize="18" fontWeight="600" textAnchor="middle" fill={STROKE} stroke="none">V</text><line x1="60" y1="40" x2="80" y2="40"/></G>;
}
function DiodeSym() {
  return <G><line x1="0" y1="40" x2="30" y2="40"/><polygon points="30,28 30,52 52,40" fill={STROKE}/><line x1="52" y1="28" x2="52" y2="52" strokeWidth={SW * 1.3}/><line x1="52" y1="40" x2="80" y2="40"/></G>;
}
function LedSym({ lit }: { lit?: boolean }) {
  return (
    <G>
      <line x1="0" y1="40" x2="30" y2="40"/>
      <polygon points="30,28 30,52 52,40" fill={lit ? LED_LIT : LED_OFF}/>
      <line x1="52" y1="28" x2="52" y2="52" strokeWidth={SW * 1.3}/>
      <line x1="52" y1="40" x2="80" y2="40"/>
      <line x1="36" y1="22" x2="44" y2="14"/>
      <polygon points="44,14 40,15 43,18" fill={STROKE}/>
      <line x1="44" y1="22" x2="52" y2="14"/>
      <polygon points="52,14 48,15 51,18" fill={STROKE}/>
    </G>
  );
}
function NpnSym() {
  return (
    <G>
      <circle cx="40" cy="40" r="22" fill="white"/>
      <line x1="0" y1="40" x2="28" y2="40"/>
      <line x1="28" y1="22" x2="28" y2="58" strokeWidth={SW * 1.4}/>
      <line x1="40" y1="0" x2="40" y2="14"/>
      <line x1="40" y1="14" x2="28" y2="34"/>
      <line x1="40" y1="80" x2="40" y2="66"/>
      <line x1="40" y1="66" x2="28" y2="46"/>
      <polygon points="40,66 33,62 38,58" fill={STROKE}/>
    </G>
  );
}
function JunctionSym() {
  return <circle cx="10" cy="10" r="4" fill={STROKE}/>;
}
function PotSym() {
  return (
    <G>
      <line x1="0" y1="40" x2="14" y2="40"/>
      <rect x="14" y="32" width="52" height="16" fill="white"/>
      <line x1="66" y1="40" x2="80" y2="40"/>
      <line x1="40" y1="80" x2="40" y2="52"/>
      <polygon points="40,52 35,60 45,60" fill={STROKE}/>
    </G>
  );
}
function PushButtonSym({ closed }: { closed?: boolean }) {
  return (
    <G>
      <line x1="0" y1="40" x2="22" y2="40"/>
      <circle cx="22" cy="40" r="2" fill={STROKE}/>
      <circle cx="58" cy="40" r="2" fill={STROKE}/>
      <line x1="58" y1="40" x2="80" y2="40"/>
      {closed ? <line x1="22" y1="40" x2="58" y2="40"/> : <line x1="22" y1="32" x2="58" y2="32"/>}
      <line x1="40" y1={closed ? 40 : 32} x2="40" y2="22"/>
      <line x1="32" y1="18" x2="48" y2="18" strokeWidth={SW * 1.4}/>
    </G>
  );
}
function SpdtSym({ closed }: { closed?: boolean }) {
  return (
    <G>
      <line x1="40" y1="0" x2="40" y2="22"/>
      <circle cx="40" cy="22" r="2" fill={STROKE}/>
      {closed ? <line x1="40" y1="22" x2="58" y2="56"/> : <line x1="40" y1="22" x2="22" y2="56"/>}
      <circle cx="22" cy="58" r="2" fill={STROKE}/>
      <circle cx="58" cy="58" r="2" fill={STROKE}/>
      <line x1="22" y1="58" x2="22" y2="80"/>
      <line x1="58" y1="58" x2="58" y2="80"/>
    </G>
  );
}
function RelayCoilSym() {
  return (
    <G>
      <line x1="0" y1="40" x2="20" y2="40"/>
      <rect x="20" y="28" width="40" height="24" fill="white"/>
      <line x1="28" y1="28" x2="20" y2="52"/>
      <line x1="36" y1="28" x2="28" y2="52"/>
      <line x1="44" y1="28" x2="36" y2="52"/>
      <line x1="52" y1="28" x2="44" y2="52"/>
      <line x1="60" y1="40" x2="80" y2="40"/>
    </G>
  );
}
function RelayContactSym({ closed }: { closed?: boolean }) {
  return (
    <G>
      <line x1="0" y1="40" x2="22" y2="40"/>
      <circle cx="22" cy="40" r="2" fill={STROKE}/>
      {closed ? <line x1="22" y1="40" x2="58" y2="40"/> : <line x1="22" y1="40" x2="58" y2="26"/>}
      <circle cx="58" cy="40" r="2" fill={STROKE}/>
      <line x1="58" y1="40" x2="80" y2="40"/>
      <line x1="40" y1="46" x2="40" y2="62" strokeDasharray="2 2"/>
    </G>
  );
}

// =====================================================================
// MOTOR CONTROL SYMBOLS (vertical orientation, IEC / CADe SIMU style)
// =====================================================================

// Single fuse — 40×100. Two terminals top/bottom.
function FuseSym() {
  return (
    <G>
      <line x1="20" y1="0" x2="20" y2="30"/>
      <rect x="10" y="30" width="20" height="40" fill="white"/>
      <line x1="20" y1="70" x2="20" y2="100"/>
      <text x="24" y="8" fontSize="6" fill={STROKE} stroke="none">1</text>
      <text x="24" y="98" fontSize="6" fill={STROKE} stroke="none">2</text>
    </G>
  );
}

// 3-pole MCB / motor circuit breaker — 100×120. Three break-switches + magnetic trip arrow, ganged.
// `closed === true` (default) = breaker ON, conducting. `closed === false` = tripped/off, open.
function Mcb3pSym({ closed, label }: { closed?: boolean; label?: string }) {
  const poles = [20, 50, 80];
  const topNums = ['1', '3', '5'];
  const botNums = ['2', '4', '6'];
  // Treat undefined as closed (so legacy saves still render correctly).
  const isOpen = closed === false;
  return (
    <G>
      {poles.map((x, i) => (
        <g key={x}>
          <line x1={x} y1="0" x2={x} y2="30"/>
          <circle cx={x} cy="30" r="2" fill={STROKE}/>
          {/* Thermal break-switch arm: vertical when closed, tilted right when open */}
          {isOpen
            ? <line x1={x} y1="30" x2={x + 8} y2="60"/>
            : <line x1={x} y1="30" x2={x} y2="60"/>}
          {/* Magnetic trip indicator (rectangle) */}
          <rect x={x - 4} y="60" width="8" height="14" fill="white"/>
          {/* Connection from magnetic trip to bottom dot */}
          <line x1={x} y1="74" x2={x} y2="90"/>
          <circle cx={x} cy="90" r="2" fill={STROKE}/>
          <line x1={x} y1="90" x2={x} y2="120"/>
          <text x={x + 4} y="32" fontSize="6" fill={STROKE} stroke="none">{topNums[i]}</text>
          <text x={x + 4} y="93" fontSize="6" fill={STROKE} stroke="none">{botNums[i]}</text>
        </g>
      ))}
      {/* mechanical link */}
      <line x1="20" y1="55" x2="80" y2="55" strokeDasharray="3 2"/>
      {label && <text x="-12" y="62" fontSize="9" fontWeight="600" fill={STROKE} stroke="none">{label}</text>}
    </G>
  );
}

// 3-pole contactor main contacts — 100×120. NO contacts, ganged.
function Contactor3pSym({ closed, label }: { closed?: boolean; label?: string }) {
  const poles = [20, 50, 80];
  const topNums = ['1', '3', '5'];
  const botNums = ['2', '4', '6'];
  return (
    <G>
      {poles.map((x, i) => (
        <g key={x}>
          <line x1={x} y1="0" x2={x} y2="40"/>
          <circle cx={x} cy="40" r="2" fill={STROKE}/>
          {closed
            ? <line x1={x} y1="40" x2={x} y2="80"/>
            : <line x1={x} y1="40" x2={x + 8} y2="80"/>}
          <circle cx={x} cy="80" r="2" fill={STROKE}/>
          <line x1={x} y1="80" x2={x} y2="120"/>
          <text x={x + 4} y="42" fontSize="6" fill={STROKE} stroke="none">{topNums[i]}</text>
          <text x={x + 4} y="83" fontSize="6" fill={STROKE} stroke="none">{botNums[i]}</text>
        </g>
      ))}
      <line x1="20" y1="60" x2="80" y2="60" strokeDasharray="3 2"/>
      {label && <text x="-12" y="62" fontSize="9" fontWeight="600" fill={STROKE} stroke="none">{label}</text>}
    </G>
  );
}

// 3-pole overload heater — 100×120.
// `closed === true` here means TRIPPED (heater detected overload — the auxiliary
// contacts open). The heater itself keeps conducting (POLE3_PASS); the trip
// state propagates to label-matched olcontact / olalarm siblings.
function Overload3pSym({ closed, label }: { closed?: boolean; label?: string }) {
  const poles = [20, 50, 80];
  const topNums = ['1', '3', '5'];
  const botNums = ['2', '4', '6'];
  const trippedStroke = closed ? '#dc2626' : STROKE; // red zigzag when tripped
  return (
    <G>
      {poles.map((x, i) => (
        <g key={x}>
          <line x1={x} y1="0" x2={x} y2="35"/>
          <text x={x + 4} y="32" fontSize="6" fill={STROKE} stroke="none">{topNums[i]}</text>
          <text x={x + 4} y="93" fontSize="6" fill={STROKE} stroke="none">{botNums[i]}</text>
          <rect x={x - 8} y="35" width="16" height="50" fill="white"/>
          <g stroke={trippedStroke}>
            <line x1={x - 6} y1="40" x2={x + 6} y2="44"/>
            <line x1={x + 6} y1="44" x2={x - 6} y2="48"/>
            <line x1={x - 6} y1="48" x2={x + 6} y2="52"/>
            <line x1={x + 6} y1="52" x2={x - 6} y2="56"/>
            <line x1={x - 6} y1="56" x2={x + 6} y2="60"/>
            <line x1={x + 6} y1="60" x2={x - 6} y2="64"/>
            <line x1={x - 6} y1="64" x2={x + 6} y2="68"/>
            <line x1={x + 6} y1="68" x2={x - 6} y2="72"/>
            <line x1={x - 6} y1="72" x2={x + 6} y2="76"/>
            <line x1={x + 6} y1="76" x2={x - 6} y2="80"/>
          </g>
          <line x1={x} y1="85" x2={x} y2="120"/>
        </g>
      ))}
      <line x1="20" y1="100" x2="80" y2="100" strokeDasharray="3 2"/>
      {label && <text x="-12" y="62" fontSize="9" fontWeight="600" fill={STROKE} stroke="none">{label}</text>}
    </G>
  );
}

// ─── Block-diagram symbols (v0.3) ────────────────────────────────────
// Rectangular box with a name (G_n(s), K, P, etc.) inside, plus optional TF
// expression rendered underneath the name. Used by block_g/k/p/i/d.
function BlockBoxSym({ label, tf }: { label: string; tf?: string }) {
  const hasTf = !!tf && tf.length > 0;
  return (
    <G>
      <rect x="0" y="0" width="100%" height="100%" fill="white" stroke={STROKE} strokeWidth={SW} rx="3"/>
      <text x="50%" y={22} fontSize="14" fontWeight="700" textAnchor="middle" dominantBaseline="middle" fill={STROKE} stroke="none">
        {label}
      </text>
      {hasTf ? (
        <text x="50%" y={42} fontSize="10" textAnchor="middle" dominantBaseline="middle" fill="#475569" stroke="none">
          {tf}
        </text>
      ) : (
        <text x="50%" y={42} fontSize="9" textAnchor="middle" dominantBaseline="middle" fill="#94a3b8" stroke="none" fontStyle="italic">
          click to set TF
        </text>
      )}
    </G>
  );
}

// Summing junction: circle with Σ inside, + / − signs at each ACTIVE input
// handle. signs[i] applies to input i; only the first `arity` inputs are
// displayed so the symbol matches the topology the user set up. Default sign
// pattern for a 2-input summer is +, − (textbook negative feedback).
function SummerSym({ signs, label, arity }: { signs?: ('+' | '-')[]; label?: string; arity?: number }) {
  const N = arity ?? 2;
  const sigOf = (i: number) => signs?.[i] ?? (i === 0 ? '+' : '-');
  // Sign-marker positions matched to handle layout: in0=L, in1=T, in2=B, in3=L (lower).
  const POS: { x: number; y: number }[] = [
    { x: 8,  y: 34 },
    { x: 26, y: 14 },
    { x: 26, y: 56 },
    { x: 8,  y: 14 },
  ];
  return (
    <G>
      <circle cx="30" cy="30" r="20" fill="white" stroke={STROKE} strokeWidth={SW}/>
      <text x="30" y="30" fontSize="16" fontWeight="700" textAnchor="middle" dominantBaseline="middle" fill={STROKE} stroke="none">Σ</text>
      {POS.slice(0, N).map((p, i) => (
        <text key={i} x={p.x} y={p.y} fontSize="11" fontWeight="700"
              fill={sigOf(i) === '+' ? '#16a34a' : '#dc2626'} stroke="none">
          {sigOf(i)}
        </text>
      ))}
      {label && <text x="30" y="-4" fontSize="10" textAnchor="middle" fill={STROKE} stroke="none">{label}</text>}
    </G>
  );
}

// Pickoff: small filled dot. Signal splits with no transformation.
function PickoffSym() {
  return (
    <G>
      <circle cx="10" cy="10" r="5" fill={STROKE} stroke="none"/>
    </G>
  );
}

// Input/output marker (R(s), Y(s)): rounded rectangle, coloured fill.
function BdMarkerSym({ label, fill, stroke }: { label: string; fill: string; stroke: string }) {
  return (
    <G>
      <rect x="0" y="0" width="100%" height="100%" fill={fill} stroke={stroke} strokeWidth={1.6} rx="8"/>
      <text x="50%" y="50%" fontSize="13" fontWeight="700" textAnchor="middle" dominantBaseline="middle" fill={stroke} stroke="none">
        {label}
      </text>
    </G>
  );
}

// 3-phase motor with PE — 100×120. Four terminals at top (U1, V1, W1, PE).
function Motor3pSym({ label, motorState }: { label?: string; motorState?: MotorState }) {
  const on = motorState === 'on';
  const badge = on ? 'ON' : 'OFF';
  const badgeFill = on ? '#22c55e' : '#94a3b8';
  return (
    <G>
      <line x1="20" y1="0" x2="20" y2="22"/>
      <line x1="50" y1="0" x2="50" y2="22"/>
      <line x1="80" y1="0" x2="80" y2="22"/>
      <line x1="95" y1="0" x2="95" y2="22" stroke="#16a34a"/>
      <text x="20" y="-2" fontSize="6" textAnchor="middle" fill={STROKE} stroke="none">U1</text>
      <text x="50" y="-2" fontSize="6" textAnchor="middle" fill={STROKE} stroke="none">V1</text>
      <text x="80" y="-2" fontSize="6" textAnchor="middle" fill={STROKE} stroke="none">W1</text>
      <text x="95" y="-2" fontSize="6" textAnchor="middle" fill="#16a34a" stroke="none">PE</text>
      <circle cx="50" cy="65" r="35" fill={on ? '#ecfdf5' : 'white'}/>
      <text x="50" y="62" fontSize="20" fontWeight="700" textAnchor="middle" fill={STROKE} stroke="none">M</text>
      <text x="50" y="82" fontSize="9" textAnchor="middle" fill={STROKE} stroke="none">3 ~</text>
      <Rotor cx={50} cy={65} radius={33} state={motorState}/>
      <rect x="32" y="93" width="36" height="14" rx="3" fill={badgeFill} stroke="none"/>
      <text x="50" y="103" fontSize="9" fontWeight="700" textAnchor="middle" fill="white" stroke="none">{badge}</text>
      {label && <text x="-10" y="118" fontSize="9" fill={STROKE} stroke="none">{label}</text>}
    </G>
  );
}

// Rotating spoke inside the motor circle — speed proportional to torque/state.
// off → no spoke. on/delta → fast (1 s/rev). star → slow (2.5 s/rev) reflecting
// low-torque Y starting. SVG <animateTransform> rotates around (cx, cy).
function Rotor({ cx, cy, radius, state }: { cx: number; cy: number; radius: number; state?: MotorState }) {
  if (!state || state === 'off') return null;
  const dur = state === 'star' ? '2.5s' : '1s';
  const inner = radius - 11;
  const outer = radius;
  return (
    <line x1={cx} y1={cy - outer} x2={cx} y2={cy - inner} strokeWidth="2" stroke="#dc2626" strokeLinecap="round">
      <animateTransform
        attributeName="transform"
        type="rotate"
        from={`0 ${cx} ${cy}`}
        to={`360 ${cx} ${cy}`}
        dur={dur}
        repeatCount="indefinite"
      />
    </line>
  );
}

// 3-phase motor with both winding ends exposed (Y-Δ start) — 100×140.
// Top: U1, V1, W1, PE.  Bottom: W2, U2, V2.
function Motor3pYDSym({ label, motorState }: { label?: string; motorState?: MotorState }) {
  const badgeText: Record<MotorState, string> = { off: 'OFF', on: 'ON', star: 'Y', delta: 'Δ' };
  const badgeColor: Record<MotorState, string> = {
    off:   '#94a3b8',
    on:    '#22c55e',
    star:  '#f59e0b', // amber — low-torque starting
    delta: '#16a34a', // green — full-torque running
  };
  const s: MotorState = motorState ?? 'off';
  const fillTint: Record<MotorState, string> = {
    off: 'white', on: '#ecfdf5', star: '#fffbeb', delta: '#ecfdf5',
  };
  return (
    <G>
      <line x1="20" y1="0" x2="20" y2="35"/>
      <line x1="50" y1="0" x2="50" y2="35"/>
      <line x1="80" y1="0" x2="80" y2="35"/>
      <line x1="95" y1="0" x2="95" y2="70" stroke="#16a34a"/>
      <line x1="20" y1="105" x2="20" y2="140"/>
      <line x1="50" y1="105" x2="50" y2="140"/>
      <line x1="80" y1="105" x2="80" y2="140"/>
      <text x="20" y="-2" fontSize="6" textAnchor="middle" fill={STROKE} stroke="none">U1</text>
      <text x="50" y="-2" fontSize="6" textAnchor="middle" fill={STROKE} stroke="none">V1</text>
      <text x="80" y="-2" fontSize="6" textAnchor="middle" fill={STROKE} stroke="none">W1</text>
      <text x="95" y="-2" fontSize="6" textAnchor="middle" fill="#16a34a" stroke="none">PE</text>
      <text x="20" y="150" fontSize="6" textAnchor="middle" fill={STROKE} stroke="none">W2</text>
      <text x="50" y="150" fontSize="6" textAnchor="middle" fill={STROKE} stroke="none">U2</text>
      <text x="80" y="150" fontSize="6" textAnchor="middle" fill={STROKE} stroke="none">V2</text>
      <circle cx="50" cy="70" r="30" fill={fillTint[s]}/>
      <text x="50" y="65" fontSize="18" fontWeight="700" textAnchor="middle" fill={STROKE} stroke="none">M</text>
      <text x="50" y="80" fontSize="7" textAnchor="middle" fill={STROKE} stroke="none">3 ~</text>
      <Rotor cx={50} cy={70} radius={28} state={motorState}/>
      <rect x="34" y="92" width="32" height="12" rx="3" fill={badgeColor[s]} stroke="none"/>
      <text x="50" y="101" fontSize="9" fontWeight="700" textAnchor="middle" fill="white" stroke="none">{badgeText[s]}</text>
      {label && <text x="-12" y="76" fontSize="9" fontWeight="600" fill={STROKE} stroke="none">{label}</text>}
    </G>
  );
}

// 3-pole fuse — three separate fuses side by side. 100×80.
function Fuse3pSym({ label }: { label?: string }) {
  const poles = [20, 50, 80];
  return (
    <G>
      {poles.map((x, i) => (
        <g key={x}>
          <line x1={x} y1="0" x2={x} y2="20"/>
          <rect x={x - 8} y="20" width="16" height="40" fill="white"/>
          <line x1={x} y1="60" x2={x} y2="80"/>
          <text x={x + 12} y="26" fontSize="6" fill={STROKE} stroke="none">{i * 2 + 1}</text>
          <text x={x + 12} y="58" fontSize="6" fill={STROKE} stroke="none">{i * 2 + 2}</text>
        </g>
      ))}
      {label && <text x="-2" y="78" fontSize="9" fill={STROKE} stroke="none">{label}</text>}
    </G>
  );
}

// 5-terminal block (-X) — 160×24. Five circles with L1/L2/L3/N/PE labels.
// Each terminal carries a small "live" pulse in its source-side hue so students
// can see at a glance that mains enters the panel here. PE pulses too — it's
// bonded to earth, but in real panels there's still a continuous safety bond.
function XTerm5Sym() {
  const slots: { x: number; label: string; color?: string; pulse: string }[] = [
    { x: 20,  label: 'L1', color: '#dc2626', pulse: '#dc2626' },
    { x: 50,  label: 'L2', color: '#dc2626', pulse: '#dc2626' },
    { x: 80,  label: 'L3', color: '#dc2626', pulse: '#dc2626' },
    { x: 110, label: 'N',  color: '#1e40af', pulse: '#1e40af' },
    { x: 140, label: 'PE', color: '#16a34a', pulse: '#16a34a' },
  ];
  return (
    <G>
      <text x="-2" y="14" fontSize="9" fill={STROKE} stroke="none">-X</text>
      {slots.map(({ x, label, color, pulse }) => (
        <g key={label}>
          <text x={x} y="6" fontSize="7" textAnchor="middle" fill={color ?? STROKE} stroke="none">{label}</text>
          <circle cx={x} cy="14" r="3" fill="white" stroke={color ?? STROKE}/>
          <circle cx={x} cy="14" r="1.6" fill={pulse} stroke="none" className="ee-live-pulse"/>
          <line x1={x} y1="17" x2={x} y2="24" stroke={color ?? STROKE}/>
        </g>
      ))}
    </G>
  );
}

// Contactor coil — 60×80. Rectangle with diagonal hash (representing winding).
function ContactorCoilSym({ closed, label }: { closed?: boolean; label?: string }) {
  return (
    <G>
      <line x1="30" y1="0" x2="30" y2="20"/>
      <rect x="10" y="20" width="40" height="40" fill={closed ? '#fef3c7' : 'white'}/>
      <line x1="10" y1="20" x2="50" y2="60"/>
      <line x1="50" y1="20" x2="10" y2="60"/>
      <line x1="30" y1="60" x2="30" y2="80"/>
      {label && <text x="54" y="44" fontSize="10" fontWeight="600" fill={STROKE} stroke="none">{label}</text>}
      <text x="54" y="18" fontSize="7" fill={STROKE} stroke="none">A1</text>
      <text x="54" y="80" fontSize="7" fill={STROKE} stroke="none">A2</text>
    </G>
  );
}

// Single NO aux contact — 40×100. IEC terminal numbers 13/14.
// CADe-SIMU convention: hinge at the LOWER terminal, arm swings upward when open.
function AuxNoSym({ closed, label }: { closed?: boolean; label?: string }) {
  return (
    <G>
      <line x1="20" y1="0" x2="20" y2="30"/>
      <circle cx="20" cy="30" r="2" fill={STROKE}/>
      {closed
        ? <line x1="20" y1="70" x2="20" y2="30"/>
        : <line x1="20" y1="70" x2="32" y2="30"/>}
      <circle cx="20" cy="70" r="2" fill={STROKE}/>
      <line x1="20" y1="70" x2="20" y2="100"/>
      <text x="28" y="33" fontSize="6" fill={STROKE} stroke="none">13</text>
      <text x="28" y="76" fontSize="6" fill={STROKE} stroke="none">14</text>
      {label && <text x="-8" y="52" fontSize="9" fontWeight="600" fill={STROKE} stroke="none">{label}</text>}
    </G>
  );
}

// Single NC aux contact — 40×100. IEC terminal numbers 21/22.
// CADe-SIMU convention: hinge at the LOWER terminal.
function AuxNcSym({ closed, label }: { closed?: boolean; label?: string }) {
  return (
    <G>
      <line x1="20" y1="0" x2="20" y2="30"/>
      <circle cx="20" cy="30" r="2" fill={STROKE}/>
      {closed
        ? <line x1="20" y1="70" x2="32" y2="30"/>
        : <>
            <line x1="20" y1="70" x2="20" y2="30"/>
            <line x1="12" y1="50" x2="28" y2="50"/>
          </>
      }
      <circle cx="20" cy="70" r="2" fill={STROKE}/>
      <line x1="20" y1="70" x2="20" y2="100"/>
      <text x="28" y="33" fontSize="6" fill={STROKE} stroke="none">21</text>
      <text x="28" y="76" fontSize="6" fill={STROKE} stroke="none">22</text>
      {label && <text x="-8" y="52" fontSize="9" fontWeight="600" fill={STROKE} stroke="none">{label}</text>}
    </G>
  );
}

// Overload NC contact — 40×100. IEC terminal numbers 95/96.
// CADe-SIMU convention: hinge at the LOWER terminal.
function OlContactSym({ closed, label }: { closed?: boolean; label?: string }) {
  return (
    <G>
      <line x1="20" y1="0" x2="20" y2="30"/>
      <circle cx="20" cy="30" r="2" fill={STROKE}/>
      {closed
        ? <line x1="20" y1="70" x2="32" y2="30"/>
        : <>
            <line x1="20" y1="70" x2="20" y2="30"/>
            <line x1="12" y1="50" x2="28" y2="50"/>
          </>
      }
      <circle cx="20" cy="70" r="2" fill={STROKE}/>
      <line x1="20" y1="70" x2="20" y2="100"/>
      {/* overload trip indicator: small rectangular block beside the arm (CADe-SIMU style) */}
      <rect x="28" y="44" width="8" height="12" fill="white" strokeWidth={SW * 0.7}/>
      <text x="28" y="33" fontSize="6" fill={STROKE} stroke="none">95</text>
      <text x="28" y="76" fontSize="6" fill={STROKE} stroke="none">96</text>
      {label && <text x="-8" y="52" fontSize="9" fontWeight="600" fill={STROKE} stroke="none">{label}</text>}
    </G>
  );
}

// Single-pole circuit breaker — 40×100.
// `closed === true` (default) = ON / conducting. `closed === false` = tripped / open.
// Shaped like one pole of the MCB symbol: break-switch arm + magnetic-trip rectangle.
function CbSym({ closed, label }: { closed?: boolean; label?: string }) {
  const isOpen = closed === false;
  return (
    <G>
      <line x1="20" y1="0" x2="20" y2="25"/>
      <circle cx="20" cy="25" r="2" fill={STROKE}/>
      {isOpen
        ? <line x1="20" y1="25" x2="32" y2="55"/>
        : <line x1="20" y1="25" x2="20" y2="55"/>}
      {/* Magnetic trip indicator */}
      <rect x="16" y="55" width="8" height="14" fill="white"/>
      <line x1="20" y1="69" x2="20" y2="75"/>
      <circle cx="20" cy="75" r="2" fill={STROKE}/>
      <line x1="20" y1="75" x2="20" y2="100"/>
      <text x="28" y="8" fontSize="6" fill={STROKE} stroke="none">1</text>
      <text x="28" y="98" fontSize="6" fill={STROKE} stroke="none">2</text>
      {label && <text x="-10" y="48" fontSize="9" fontWeight="600" fill={STROKE} stroke="none">{label}</text>}
    </G>
  );
}

// Overload alarm NO contact — 40×100. IEC terminal numbers 97/98.
// Mechanically linked to the same OL relay as OlContactSym, but NO instead of NC:
// closes when overload trips. Use this to drive an alarm/indicator lamp.
function OlAlarmSym({ closed, label }: { closed?: boolean; label?: string }) {
  return (
    <G>
      <line x1="20" y1="0" x2="20" y2="30"/>
      <circle cx="20" cy="30" r="2" fill={STROKE}/>
      {closed
        ? <line x1="20" y1="70" x2="20" y2="30"/>
        : <line x1="20" y1="70" x2="32" y2="30"/>}
      <circle cx="20" cy="70" r="2" fill={STROKE}/>
      <line x1="20" y1="70" x2="20" y2="100"/>
      {/* overload trip indicator: same rectangle as OlContactSym */}
      <rect x="28" y="44" width="8" height="12" fill="white" strokeWidth={SW * 0.7}/>
      <text x="28" y="33" fontSize="6" fill={STROKE} stroke="none">97</text>
      <text x="28" y="76" fontSize="6" fill={STROKE} stroke="none">98</text>
      {label && <text x="-8" y="52" fontSize="9" fontWeight="600" fill={STROKE} stroke="none">{label}</text>}
    </G>
  );
}

// Push-button NO — 40×120. IEC 60617-7 style: small open-rectangle press surface
// on top of a thin linkage; contact below with the hinge at the LOWER terminal so
// the arm swings upward when open. Terminal numbers 13/14.
function PbNoSym({ closed, label }: { closed?: boolean; label?: string }) {
  // Cap "depresses" by 4 px when pressed.
  const capY = closed ? 6 : 2;
  return (
    <G>
      {/* Press-surface cap (open rectangle, thicker stroke) */}
      <rect x="10" y={capY} width="20" height="4" fill="white" strokeWidth={SW * 1.2}/>
      {/* Linkage shaft */}
      <line x1="20" y1={capY + 4} x2="20" y2={closed ? 50 : 42}/>
      <circle cx="20" cy="50" r="2" fill={STROKE}/>
      {closed
        ? <line x1="20" y1="90" x2="20" y2="50"/>
        : <line x1="20" y1="90" x2="32" y2="50"/>}
      <circle cx="20" cy="90" r="2" fill={STROKE}/>
      <line x1="20" y1="90" x2="20" y2="120"/>
      <text x="28" y="53" fontSize="6" fill={STROKE} stroke="none">13</text>
      <text x="28" y="96" fontSize="6" fill={STROKE} stroke="none">14</text>
      {label && <text x="-8" y="74" fontSize="9" fontWeight="600" fill={STROKE} stroke="none">{label}</text>}
    </G>
  );
}

// Push-button NC — 40×120. IEC terminal numbers 11/12. Same cap style as PbNo.
function PbNcSym({ closed, label }: { closed?: boolean; label?: string }) {
  const capY = closed ? 6 : 2;
  return (
    <G>
      <rect x="10" y={capY} width="20" height="4" fill="white" strokeWidth={SW * 1.2}/>
      <line x1="20" y1={capY + 4} x2="20" y2={closed ? 42 : 50}/>
      <circle cx="20" cy="50" r="2" fill={STROKE}/>
      {closed
        ? <line x1="20" y1="90" x2="32" y2="50"/>
        : <>
            <line x1="20" y1="90" x2="20" y2="50"/>
            <line x1="12" y1="70" x2="28" y2="70"/>
          </>
      }
      <circle cx="20" cy="90" r="2" fill={STROKE}/>
      <line x1="20" y1="90" x2="20" y2="120"/>
      <text x="28" y="53" fontSize="6" fill={STROKE} stroke="none">11</text>
      <text x="28" y="96" fontSize="6" fill={STROKE} stroke="none">12</text>
      {label && <text x="-8" y="74" fontSize="9" fontWeight="600" fill={STROKE} stroke="none">{label}</text>}
    </G>
  );
}

// Emergency-stop (mushroom) NC — 40×120. IEC terminal numbers 11/12.
// Red mushroom-head cap on top; behaves like pbnc but LATCHING (click toggles state).
function EStopSym({ closed, label }: { closed?: boolean; label?: string }) {
  // Mushroom cap is wider and taller. Drawn in red.
  return (
    <G>
      {/* Mushroom head — red filled half-ellipse */}
      <path d="M 4 8 Q 4 0 20 0 Q 36 0 36 8 Z" fill="#dc2626" stroke="#dc2626"/>
      {/* Stem */}
      <line x1="20" y1="8" x2="20" y2={closed ? 50 : 42}/>
      <circle cx="20" cy="50" r="2" fill={STROKE}/>
      {/* NC contact: arm hinged at bottom, vertical at rest (closed), tilted when pressed (open) */}
      {closed
        ? <line x1="20" y1="90" x2="32" y2="50"/>
        : <>
            <line x1="20" y1="90" x2="20" y2="50"/>
            <line x1="12" y1="70" x2="28" y2="70"/>
          </>
      }
      <circle cx="20" cy="90" r="2" fill={STROKE}/>
      <line x1="20" y1="90" x2="20" y2="120"/>
      <text x="28" y="53" fontSize="6" fill={STROKE} stroke="none">11</text>
      <text x="28" y="96" fontSize="6" fill={STROKE} stroke="none">12</text>
      {label && <text x="-8" y="74" fontSize="9" fontWeight="600" fill={STROKE} stroke="none">{label}</text>}
    </G>
  );
}

// Limit switch NO — 40×100. IEC terminal numbers 13/14.
// Mechanically actuated by a lever; lever drawn as a small angled line on top.
function LimitNoSym({ closed, label }: { closed?: boolean; label?: string }) {
  return (
    <G>
      {/* Lever — angled line + small circle (roller) */}
      <line x1="20" y1="0" x2="32" y2="-4"/>
      <circle cx="33" cy="-5" r="2" fill="white"/>
      <line x1="20" y1="0" x2="20" y2="30"/>
      <circle cx="20" cy="30" r="2" fill={STROKE}/>
      {closed
        ? <line x1="20" y1="70" x2="20" y2="30"/>
        : <line x1="20" y1="70" x2="32" y2="30"/>}
      <circle cx="20" cy="70" r="2" fill={STROKE}/>
      <line x1="20" y1="70" x2="20" y2="100"/>
      <text x="28" y="33" fontSize="6" fill={STROKE} stroke="none">13</text>
      <text x="28" y="76" fontSize="6" fill={STROKE} stroke="none">14</text>
      {label && <text x="-8" y="52" fontSize="9" fontWeight="600" fill={STROKE} stroke="none">{label}</text>}
    </G>
  );
}

// Limit switch NC — 40×100. IEC terminal numbers 11/12.
function LimitNcSym({ closed, label }: { closed?: boolean; label?: string }) {
  return (
    <G>
      <line x1="20" y1="0" x2="32" y2="-4"/>
      <circle cx="33" cy="-5" r="2" fill="white"/>
      <line x1="20" y1="0" x2="20" y2="30"/>
      <circle cx="20" cy="30" r="2" fill={STROKE}/>
      {closed
        ? <line x1="20" y1="70" x2="32" y2="30"/>
        : <>
            <line x1="20" y1="70" x2="20" y2="30"/>
            <line x1="12" y1="50" x2="28" y2="50"/>
          </>
      }
      <circle cx="20" cy="70" r="2" fill={STROKE}/>
      <line x1="20" y1="70" x2="20" y2="100"/>
      <text x="28" y="33" fontSize="6" fill={STROKE} stroke="none">11</text>
      <text x="28" y="76" fontSize="6" fill={STROKE} stroke="none">12</text>
      {label && <text x="-8" y="52" fontSize="9" fontWeight="600" fill={STROKE} stroke="none">{label}</text>}
    </G>
  );
}

// Foot switch NO — 40×120. Pedal-actuated.
function FootSwSym({ closed, label }: { closed?: boolean; label?: string }) {
  return (
    <G>
      {/* Pedal — a horizontal line raised on a small triangular hinge */}
      <line x1="2" y1="6" x2="34" y2="6" strokeWidth={SW * 1.4}/>
      <polygon points="18,6 22,6 20,14" fill={STROKE}/>
      <line x1="20" y1="14" x2="20" y2={closed ? 50 : 42}/>
      <circle cx="20" cy="50" r="2" fill={STROKE}/>
      {closed
        ? <line x1="20" y1="90" x2="20" y2="50"/>
        : <line x1="20" y1="90" x2="32" y2="50"/>}
      <circle cx="20" cy="90" r="2" fill={STROKE}/>
      <line x1="20" y1="90" x2="20" y2="120"/>
      <text x="28" y="53" fontSize="6" fill={STROKE} stroke="none">13</text>
      <text x="28" y="96" fontSize="6" fill={STROKE} stroke="none">14</text>
      {label && <text x="-8" y="74" fontSize="9" fontWeight="600" fill={STROKE} stroke="none">{label}</text>}
    </G>
  );
}

// 2-position rotary selector switch — 40×100. IEC terminals 11 (common, top),
// 12 (NC position, bottom-left, default), 14 (NO position, bottom-right).
// `closed === false` (default) = arm connects 11 to 12.  `closed === true` = arm connects 11 to 14.
function Selector2PosSym({ closed, label }: { closed?: boolean; label?: string }) {
  return (
    <G>
      {/* Top common terminal */}
      <line x1="20" y1="0" x2="20" y2="25"/>
      <circle cx="20" cy="25" r="2" fill={STROKE}/>
      {/* Rotary knob indicator — a small thicker bar above the contact suggests a turning handle */}
      <line x1="13" y1="20" x2="27" y2="20" strokeWidth={SW * 1.6}/>
      <circle cx="20" cy="20" r="1.5" fill={STROKE}/>
      {/* Selector arm — goes from top common to either 12 (left) or 14 (right) */}
      {closed
        ? <line x1="20" y1="25" x2="32" y2="75"/>
        : <line x1="20" y1="25" x2="8" y2="75"/>}
      {/* Bottom-left terminal (12) */}
      <circle cx="8" cy="75" r="2" fill={STROKE}/>
      <line x1="8" y1="75" x2="8" y2="100"/>
      {/* Bottom-right terminal (14) */}
      <circle cx="32" cy="75" r="2" fill={STROKE}/>
      <line x1="32" y1="75" x2="32" y2="100"/>
      {/* Terminal numbers */}
      <text x="24" y="10" fontSize="6" fill={STROKE} stroke="none">11</text>
      <text x="-2" y="98" fontSize="6" fill={STROKE} stroke="none">12</text>
      <text x="36" y="98" fontSize="6" fill={STROKE} stroke="none">14</text>
      {label && <text x="-12" y="55" fontSize="9" fontWeight="600" fill={STROKE} stroke="none">{label}</text>}
    </G>
  );
}

// Manual disconnect (knife switch) — 40×100. Like a switch but drawn as a swinging
// blade that disconnects manually. `closed=true` = blade down (connected).
function DisconnectSym({ closed, label }: { closed?: boolean; label?: string }) {
  const isOpen = closed === false;
  return (
    <G>
      <line x1="20" y1="0" x2="20" y2="25"/>
      <circle cx="20" cy="25" r="2.5" fill={STROKE}/>
      {/* Blade — vertical when closed, tilted ~45° when open */}
      {isOpen
        ? <line x1="20" y1="25" x2="40" y2="68" strokeWidth={SW * 1.3}/>
        : <line x1="20" y1="25" x2="20" y2="75" strokeWidth={SW * 1.3}/>}
      <circle cx="20" cy="75" r="2.5" fill={STROKE}/>
      <line x1="20" y1="75" x2="20" y2="100"/>
      <text x="28" y="8" fontSize="6" fill={STROKE} stroke="none">1</text>
      <text x="28" y="98" fontSize="6" fill={STROKE} stroke="none">2</text>
      {label && <text x="-10" y="52" fontSize="9" fontWeight="600" fill={STROKE} stroke="none">{label}</text>}
    </G>
  );
}

// Control transformer — 80×100. Two windings (primary top, secondary bottom).
function XformerSym({ label, value }: { label?: string; value?: string }) {
  return (
    <G>
      {/* Primary winding — top */}
      <line x1="20" y1="0" x2="20" y2="20"/>
      <line x1="60" y1="0" x2="60" y2="20"/>
      <circle cx="28" cy="28" r="6" fill="white"/>
      <circle cx="40" cy="28" r="6" fill="white"/>
      <circle cx="52" cy="28" r="6" fill="white"/>
      {/* Iron core */}
      <line x1="20" y1="42" x2="60" y2="42" strokeWidth={SW * 1.3}/>
      <line x1="20" y1="46" x2="60" y2="46" strokeWidth={SW * 1.3}/>
      {/* Secondary winding — bottom */}
      <circle cx="28" cy="60" r="6" fill="white"/>
      <circle cx="40" cy="60" r="6" fill="white"/>
      <circle cx="52" cy="60" r="6" fill="white"/>
      <line x1="20" y1="68" x2="20" y2="100"/>
      <line x1="60" y1="68" x2="60" y2="100"/>
      {label && <text x="0" y="56" fontSize="9" fontWeight="600" fill={STROKE} stroke="none">{label}</text>}
      {value && <text x="68" y="56" fontSize="9" fill={STROKE} stroke="none">{value}</text>}
    </G>
  );
}

// Off-delay timer coil — 60×80. Same shape as TimerCoilSym but with a small "↓"
// indicator marking off-delay (drop-out delay) vs on-delay.
function TimerCoilOffSym({ closed, label, delaying }: { closed?: boolean; label?: string; delaying?: boolean }) {
  const fill = delaying ? '#fef3c7' : closed ? '#fde047' : 'white';
  return (
    <G>
      <line x1="30" y1="0" x2="30" y2="20"/>
      <rect x="10" y="20" width="40" height="40" fill={fill}/>
      {/* Off-delay marker: filled triangle pointing DOWN (vs hourglass for on-delay) */}
      <polygon points="20,28 40,28 30,52" fill={STROKE}/>
      <line x1="30" y1="60" x2="30" y2="80"/>
      {delaying && (
        <circle cx="30" cy="40" r="14" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 3">
          <animateTransform attributeName="transform" type="rotate" from="0 30 40" to="360 30 40" dur="1.5s" repeatCount="indefinite"/>
        </circle>
      )}
      {label && <text x="54" y="44" fontSize="10" fontWeight="600" fill={STROKE} stroke="none">{label}</text>}
    </G>
  );
}

// Off-delay timer NO contact — 40×100. Closes immediately when coil energises;
// stays closed for the delay AFTER coil de-energises, then opens. Arc on the LEFT
// distinguishes off-delay from on-delay (arc on the right).
function TimerNoOffSym({ closed, label }: { closed?: boolean; label?: string }) {
  return (
    <G>
      <line x1="20" y1="0" x2="20" y2="30"/>
      <circle cx="20" cy="30" r="2" fill={STROKE}/>
      {closed
        ? <line x1="20" y1="70" x2="20" y2="30"/>
        : <line x1="20" y1="70" x2="32" y2="30"/>}
      <circle cx="20" cy="70" r="2" fill={STROKE}/>
      <line x1="20" y1="70" x2="20" y2="100"/>
      {/* Off-delay arc — drawn on the LEFT side, near the lower (moving) terminal */}
      <path d="M 8 62 A 8 8 0 0 1 8 78" />
      <text x="28" y="33" fontSize="6" fill={STROKE} stroke="none">17</text>
      <text x="28" y="76" fontSize="6" fill={STROKE} stroke="none">18</text>
      {label && <text x="-8" y="52" fontSize="9" fontWeight="600" fill={STROKE} stroke="none">{label}</text>}
    </G>
  );
}

// Off-delay timer NC contact — 40×100. Opens immediately when coil energises;
// stays open for the delay AFTER coil de-energises, then closes.
function TimerNcOffSym({ closed, label }: { closed?: boolean; label?: string }) {
  return (
    <G>
      <line x1="20" y1="0" x2="20" y2="30"/>
      <circle cx="20" cy="30" r="2" fill={STROKE}/>
      {closed
        ? <line x1="20" y1="70" x2="32" y2="30"/>
        : <>
            <line x1="20" y1="70" x2="20" y2="30"/>
            <line x1="12" y1="50" x2="28" y2="50"/>
          </>
      }
      <circle cx="20" cy="70" r="2" fill={STROKE}/>
      <line x1="20" y1="70" x2="20" y2="100"/>
      <path d="M 8 62 A 8 8 0 0 0 8 78" />
      <text x="28" y="33" fontSize="6" fill={STROKE} stroke="none">15</text>
      <text x="28" y="76" fontSize="6" fill={STROKE} stroke="none">16</text>
      {label && <text x="-8" y="52" fontSize="9" fontWeight="600" fill={STROKE} stroke="none">{label}</text>}
    </G>
  );
}

// Colored pilot lamp — 60×80. IEC terminal labels X1 (top) / X2 (bottom).
function PilotLampSym({ lit, color = 'green', label, blink }: { lit?: boolean; color?: LampColor; label?: string; blink?: boolean }) {
  const c = LAMP_COLORS[color];
  const bulbClass = lit && blink ? 'ee-blink' : undefined;
  return (
    <G>
      <line x1="30" y1="0" x2="30" y2="20"/>
      <circle cx="30" cy="40" r="18" fill={lit ? c.on : c.off} className={bulbClass}/>
      <line x1="18" y1="28" x2="42" y2="52"/>
      <line x1="42" y1="28" x2="18" y2="52"/>
      <line x1="30" y1="60" x2="30" y2="80"/>
      <text x="38" y="8" fontSize="6" fill={STROKE} stroke="none">X1</text>
      <text x="38" y="76" fontSize="6" fill={STROKE} stroke="none">X2</text>
      {label && <text x="54" y="44" fontSize="9" fontWeight="600" fill={STROKE} stroke="none">{label}</text>}
    </G>
  );
}

// Time-delay relay coil — 60×80. Rectangle with hourglass.
function TimerCoilSym({ closed, label, delaying }: { closed?: boolean; label?: string; delaying?: boolean }) {
  // While delaying, fill amber and add an animated ring; once actuated (no longer delaying but coil still
  // energised), fill yellow like other energised coils.
  const fill = delaying ? '#fef3c7' : closed ? '#fde047' : 'white';
  return (
    <G>
      <line x1="30" y1="0" x2="30" y2="20"/>
      <rect x="10" y="20" width="40" height="40" fill={fill}/>
      <line x1="20" y1="28" x2="40" y2="28"/>
      <line x1="20" y1="52" x2="40" y2="52"/>
      <line x1="20" y1="28" x2="40" y2="52"/>
      <line x1="40" y1="28" x2="20" y2="52"/>
      <line x1="30" y1="60" x2="30" y2="80"/>
      {delaying && (
        <circle cx="30" cy="40" r="14" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 3">
          <animateTransform attributeName="transform" type="rotate" from="0 30 40" to="360 30 40" dur="1.5s" repeatCount="indefinite"/>
        </circle>
      )}
      {label && <text x="54" y="44" fontSize="10" fontWeight="600" fill={STROKE} stroke="none">{label}</text>}
    </G>
  );
}

// Timer NO contact, on-delay (closes after delay). IEC terminal numbers 17/18.
// CADe-SIMU convention: hinge at the LOWER terminal.
function TimerNoSym({ closed, label }: { closed?: boolean; label?: string }) {
  return (
    <G>
      <line x1="20" y1="0" x2="20" y2="30"/>
      <circle cx="20" cy="30" r="2" fill={STROKE}/>
      {closed
        ? <line x1="20" y1="70" x2="20" y2="30"/>
        : <line x1="20" y1="70" x2="32" y2="30"/>}
      <circle cx="20" cy="70" r="2" fill={STROKE}/>
      <line x1="20" y1="70" x2="20" y2="100"/>
      {/* delay arc on the right, near the fixed (upper) contact */}
      <path d="M 32 38 A 8 8 0 0 0 32 54" />
      <text x="28" y="33" fontSize="6" fill={STROKE} stroke="none">17</text>
      <text x="28" y="76" fontSize="6" fill={STROKE} stroke="none">18</text>
      {label && <text x="-8" y="52" fontSize="9" fontWeight="600" fill={STROKE} stroke="none">{label}</text>}
    </G>
  );
}

// Timer NC contact, on-delay (opens after delay). IEC terminal numbers 15/16.
// CADe-SIMU convention: hinge at the LOWER terminal.
function TimerNcSym({ closed, label }: { closed?: boolean; label?: string }) {
  return (
    <G>
      <line x1="20" y1="0" x2="20" y2="30"/>
      <circle cx="20" cy="30" r="2" fill={STROKE}/>
      {closed
        ? <line x1="20" y1="70" x2="32" y2="30"/>
        : <>
            <line x1="20" y1="70" x2="20" y2="30"/>
            <line x1="12" y1="50" x2="28" y2="50"/>
          </>
      }
      <circle cx="20" cy="70" r="2" fill={STROKE}/>
      <line x1="20" y1="70" x2="20" y2="100"/>
      <path d="M 32 38 A 8 8 0 0 1 32 54" />
      <text x="28" y="33" fontSize="6" fill={STROKE} stroke="none">15</text>
      <text x="28" y="76" fontSize="6" fill={STROKE} stroke="none">16</text>
      {label && <text x="-8" y="52" fontSize="9" fontWeight="600" fill={STROKE} stroke="none">{label}</text>}
    </G>
  );
}

// =====================================================================
// Analyze v3 — SISO TF markers
// =====================================================================
function VinSym() {
  return (
    <G>
      <line x1="0" y1="40" x2="20" y2="40"/>
      <circle cx="40" cy="40" r="20" fill="#dbeafe" stroke="#1d4ed8" strokeWidth={1.6}/>
      <text x="40" y="34" fontSize="9" fontWeight="700" textAnchor="middle" fill="#1d4ed8" stroke="none">V</text>
      <text x="40" y="46" fontSize="8" fontWeight="600" textAnchor="middle" fill="#1d4ed8" stroke="none">IN</text>
      <line x1="60" y1="40" x2="80" y2="40"/>
      <polygon points="76,36 80,40 76,44" fill="#1d4ed8" stroke="none"/>
    </G>
  );
}
function VoutSym() {
  return (
    <G>
      <line x1="0" y1="40" x2="20" y2="40"/>
      <polygon points="4,36 0,40 4,44" fill="#b45309" stroke="none"/>
      <circle cx="40" cy="40" r="20" fill="#fef3c7" stroke="#b45309" strokeWidth={1.6}/>
      <text x="40" y="34" fontSize="9" fontWeight="700" textAnchor="middle" fill="#b45309" stroke="none">V</text>
      <text x="40" y="46" fontSize="8" fontWeight="600" textAnchor="middle" fill="#b45309" stroke="none">OUT</text>
      <line x1="60" y1="40" x2="80" y2="40"/>
    </G>
  );
}
function IinSym() {
  return (
    <G>
      <line x1="0" y1="40" x2="20" y2="40"/>
      <rect x="20" y="20" width="40" height="40" rx="3" fill="#dbeafe" stroke="#1d4ed8" strokeWidth={1.6}/>
      <text x="40" y="36" fontSize="9" fontWeight="700" textAnchor="middle" fill="#1d4ed8" stroke="none">I</text>
      <text x="40" y="48" fontSize="8" fontWeight="600" textAnchor="middle" fill="#1d4ed8" stroke="none">IN</text>
      <line x1="60" y1="40" x2="80" y2="40"/>
      <polygon points="76,36 80,40 76,44" fill="#1d4ed8" stroke="none"/>
    </G>
  );
}
function IoutSym() {
  return (
    <G>
      <line x1="0" y1="40" x2="20" y2="40"/>
      <polygon points="4,36 0,40 4,44" fill="#b45309" stroke="none"/>
      <rect x="20" y="20" width="40" height="40" rx="3" fill="#fef3c7" stroke="#b45309" strokeWidth={1.6}/>
      <text x="40" y="36" fontSize="9" fontWeight="700" textAnchor="middle" fill="#b45309" stroke="none">I</text>
      <text x="40" y="48" fontSize="8" fontWeight="600" textAnchor="middle" fill="#b45309" stroke="none">OUT</text>
      <line x1="60" y1="40" x2="80" y2="40"/>
    </G>
  );
}

// =====================================================================
// Analyze v4 — 3-phase compound symbols
// =====================================================================
function Src3PSym({ value }: { value?: string }) {
  return (
    <G>
      <rect x="0" y="0" width="80" height="120" rx="4" fill="#eff6ff" stroke="#1d4ed8" strokeWidth={1.6}/>
      <text x="40" y="22" fontSize="11" fontWeight="700" textAnchor="middle" fill="#1d4ed8" stroke="none">3φ ~</text>
      <text x="40" y="38" fontSize="8" textAnchor="middle" fill="#1e3a8a" stroke="none">SOURCE</text>
      {value && <text x="40" y="56" fontSize="7" textAnchor="middle" fill="#475569" stroke="none">{value}</text>}
      {/* Terminals labelled */}
      <text x="68" y="73" fontSize="8" fill="#1e3a8a" stroke="none">a</text>
      <text x="68" y="91" fontSize="8" fill="#1e3a8a" stroke="none">b</text>
      <text x="68" y="109" fontSize="8" fill="#1e3a8a" stroke="none">c</text>
      <line x1="78" y1="70" x2="80" y2="70" />
      <line x1="78" y1="90" x2="80" y2="90" />
      <line x1="78" y1="110" x2="80" y2="110" />
      <text x="-2" y="91" fontSize="8" textAnchor="end" fill="#1e3a8a" stroke="none">n</text>
      <line x1="0" y1="90" x2="2" y2="90" />
    </G>
  );
}
function LoadY3PSym({ value }: { value?: string }) {
  return (
    <G>
      <rect x="0" y="0" width="80" height="120" rx="4" fill="#fefce8" stroke="#b45309" strokeWidth={1.6}/>
      <text x="40" y="24" fontSize="14" fontWeight="700" textAnchor="middle" fill="#b45309" stroke="none">Y</text>
      <text x="40" y="40" fontSize="8" textAnchor="middle" fill="#92400e" stroke="none">LOAD</text>
      {value && <text x="40" y="56" fontSize="7" textAnchor="middle" fill="#475569" stroke="none">{value}</text>}
      <text x="12" y="73" fontSize="8" fill="#92400e" stroke="none">a</text>
      <text x="12" y="91" fontSize="8" fill="#92400e" stroke="none">b</text>
      <text x="12" y="109" fontSize="8" fill="#92400e" stroke="none">c</text>
      <line x1="0" y1="70" x2="2" y2="70" />
      <line x1="0" y1="90" x2="2" y2="90" />
      <line x1="0" y1="110" x2="2" y2="110" />
      <text x="82" y="91" fontSize="8" fill="#92400e" stroke="none">n</text>
      <line x1="78" y1="90" x2="80" y2="90" />
    </G>
  );
}
function LoadD3PSym({ value }: { value?: string }) {
  return (
    <G>
      <rect x="0" y="0" width="80" height="100" rx="4" fill="#fefce8" stroke="#b45309" strokeWidth={1.6}/>
      <text x="40" y="24" fontSize="14" fontWeight="700" textAnchor="middle" fill="#b45309" stroke="none">Δ</text>
      <text x="40" y="40" fontSize="8" textAnchor="middle" fill="#92400e" stroke="none">LOAD</text>
      {value && <text x="40" y="56" fontSize="7" textAnchor="middle" fill="#475569" stroke="none">{value}</text>}
      <text x="12" y="73" fontSize="8" fill="#92400e" stroke="none">a</text>
      <text x="12" y="86" fontSize="8" fill="#92400e" stroke="none">b</text>
      <text x="12" y="99" fontSize="8" fill="#92400e" stroke="none">c</text>
      <line x1="0" y1="70" x2="2" y2="70" />
      <line x1="0" y1="83" x2="2" y2="83" />
      <line x1="0" y1="96" x2="2" y2="96" />
    </G>
  );
}

// Terminal block — 30×30. Small circle inside a box.
function TerminalSym({ label }: { label?: string }) {
  return (
    <G>
      <rect x="2" y="2" width="26" height="26" fill="white"/>
      <circle cx="15" cy="15" r="5" fill="white"/>
      <line x1="15" y1="0" x2="15" y2="2"/>
      <line x1="15" y1="28" x2="15" y2="30"/>
      {label && <text x="15" y="19" fontSize="8" fontWeight="600" textAnchor="middle" fill={STROKE} stroke="none">{label}</text>}
    </G>
  );
}

// =====================================================================
// DESCRIPTORS
// =====================================================================

const horizPair: HandleDef[] = [
  { id: 'a', x: 0, y: 40, side: 'L' },
  { id: 'b', x: 80, y: 40, side: 'R' },
];

const vert2 = (w: number, h: number): HandleDef[] => [
  { id: 'a', x: w / 2, y: 0, side: 'T' },
  { id: 'b', x: w / 2, y: h, side: 'B' },
];

const vert3pole = (_w: number, h: number): HandleDef[] => [
  { id: '1', x: 20, y: 0, side: 'T' },
  { id: '3', x: 50, y: 0, side: 'T' },
  { id: '5', x: 80, y: 0, side: 'T' },
  { id: '2', x: 20, y: h, side: 'B' },
  { id: '4', x: 50, y: h, side: 'B' },
  { id: '6', x: 80, y: h, side: 'B' },
];

export const DESCRIPTORS: Record<ComponentKind, CompDesc> = {
  // Basics
  resistor: { w: 80, h: 80, handles: horizPair, draw: () => <ResistorSym/> },
  capacitor: { w: 80, h: 80, handles: horizPair, draw: () => <CapacitorSym/> },
  inductor: { w: 80, h: 80, handles: horizPair, draw: () => <InductorSym/> },
  dcsource: { w: 80, h: 80, handles: horizPair, draw: () => <DCSourceSym/> },
  acsource: { w: 80, h: 80, handles: horizPair, draw: () => <ACSourceSym/> },
  switch: { w: 80, h: 80, handles: horizPair, draw: (s) => <SwitchSym closed={s.closed}/> },
  pushbutton: { w: 80, h: 80, handles: horizPair, draw: (s) => <PushButtonSym closed={s.closed}/> },
  lamp: { w: 80, h: 80, handles: horizPair, draw: (s) => <LampSym lit={s.lit}/> },
  ammeter: { w: 80, h: 80, handles: horizPair, draw: () => <AmmeterSym/> },
  voltmeter: { w: 80, h: 80, handles: horizPair, draw: () => <VoltmeterSym/> },
  diode: { w: 80, h: 80, handles: horizPair, draw: () => <DiodeSym/> },
  led: { w: 80, h: 80, handles: horizPair, draw: (s) => <LedSym lit={s.lit}/> },
  npn: { w: 80, h: 80, handles: [
    { id: 'c', x: 40, y: 0, side: 'T' },
    { id: 'b', x: 0, y: 40, side: 'L' },
    { id: 'e', x: 40, y: 80, side: 'B' },
  ], draw: () => <NpnSym/> },
  spdt: { w: 80, h: 80, handles: [
    { id: 'c', x: 40, y: 0, side: 'T' },
    { id: 'a', x: 22, y: 80, side: 'B' },
    { id: 'b', x: 58, y: 80, side: 'B' },
  ], draw: (s) => <SpdtSym closed={s.closed}/> },
  ground: { w: 40, h: 40, handles: [{ id: 'a', x: 20, y: 0, side: 'T' }], draw: () => <GroundSym/> },
  junction: { w: 20, h: 20, handles: [
    { id: 't', x: 10, y: 0, side: 'T' },
    { id: 'r', x: 20, y: 10, side: 'R' },
    { id: 'b', x: 10, y: 20, side: 'B' },
    { id: 'l', x: 0, y: 10, side: 'L' },
  ], draw: () => <JunctionSym/> },
  pot: { w: 80, h: 80, handles: [...horizPair, { id: 'w', x: 40, y: 80, side: 'B' }], draw: () => <PotSym/> },
  relaycoil: { w: 80, h: 80, handles: horizPair, draw: () => <RelayCoilSym/> },
  relaycontact: { w: 80, h: 80, handles: horizPair, draw: (s) => <RelayContactSym closed={s.closed}/> },

  // Motor-control: power side
  fuse: { w: 40, h: 100, handles: vert2(40, 100), draw: () => <FuseSym/> },
  mcb3p: { w: 100, h: 120, handles: vert3pole(100, 120), draw: (s) => <Mcb3pSym closed={s.closed} label={s.label}/> },
  contactor3p: { w: 100, h: 120, handles: vert3pole(100, 120), draw: (s) => <Contactor3pSym closed={s.closed} label={s.label}/> },
  overload3p: { w: 100, h: 120, handles: vert3pole(100, 120), draw: (s) => <Overload3pSym closed={s.closed} label={s.label}/> },
  motor3p: { w: 100, h: 120, handles: [
    { id: 'u', x: 20, y: 0, side: 'T' },
    { id: 'v', x: 50, y: 0, side: 'T' },
    { id: 'w', x: 80, y: 0, side: 'T' },
    { id: 'pe', x: 95, y: 0, side: 'T' },
  ], draw: (s) => <Motor3pSym label={s.label} motorState={s.motorState}/> },
  motor3p_yd: { w: 100, h: 140, handles: [
    { id: 'u1', x: 20, y: 0, side: 'T' },
    { id: 'v1', x: 50, y: 0, side: 'T' },
    { id: 'w1', x: 80, y: 0, side: 'T' },
    { id: 'pe', x: 95, y: 0, side: 'T' },
    { id: 'w2', x: 20, y: 140, side: 'B' },
    { id: 'u2', x: 50, y: 140, side: 'B' },
    { id: 'v2', x: 80, y: 140, side: 'B' },
  ], draw: (s) => <Motor3pYDSym label={s.label} motorState={s.motorState}/> },
  fuse3p: { w: 100, h: 80, handles: [
    { id: '1', x: 20, y: 0, side: 'T' },
    { id: '3', x: 50, y: 0, side: 'T' },
    { id: '5', x: 80, y: 0, side: 'T' },
    { id: '2', x: 20, y: 80, side: 'B' },
    { id: '4', x: 50, y: 80, side: 'B' },
    { id: '6', x: 80, y: 80, side: 'B' },
  ], draw: (s) => <Fuse3pSym label={s.label}/> },
  xterm5: { w: 160, h: 24, handles: [
    { id: 'l1', x: 20, y: 24, side: 'B' },
    { id: 'l2', x: 50, y: 24, side: 'B' },
    { id: 'l3', x: 80, y: 24, side: 'B' },
    { id: 'n', x: 110, y: 24, side: 'B' },
    { id: 'pe', x: 140, y: 24, side: 'B' },
  ], draw: () => <XTerm5Sym /> },

  // Motor-control: control side
  contactor: { w: 60, h: 80, handles: vert2(60, 80), draw: (s) => <ContactorCoilSym closed={s.closed} label={s.label}/> },
  cb: { w: 40, h: 100, handles: vert2(40, 100), draw: (s) => <CbSym closed={s.closed} label={s.label}/> },
  auxno: { w: 40, h: 100, handles: vert2(40, 100), draw: (s) => <AuxNoSym closed={s.closed} label={s.label}/> },
  auxnc: { w: 40, h: 100, handles: vert2(40, 100), draw: (s) => <AuxNcSym closed={s.closed} label={s.label}/> },
  olcontact: { w: 40, h: 100, handles: vert2(40, 100), draw: (s) => <OlContactSym closed={s.closed} label={s.label}/> },
  olalarm: { w: 40, h: 100, handles: vert2(40, 100), draw: (s) => <OlAlarmSym closed={s.closed} label={s.label}/> },
  pbno: { w: 40, h: 120, handles: vert2(40, 120), draw: (s) => <PbNoSym closed={s.closed} label={s.label}/> },
  pbnc: { w: 40, h: 120, handles: vert2(40, 120), draw: (s) => <PbNcSym closed={s.closed} label={s.label}/> },
  estop: { w: 40, h: 120, handles: vert2(40, 120), draw: (s) => <EStopSym closed={s.closed} label={s.label}/> },
  limitno: { w: 40, h: 100, handles: vert2(40, 100), draw: (s) => <LimitNoSym closed={s.closed} label={s.label}/> },
  limitnc: { w: 40, h: 100, handles: vert2(40, 100), draw: (s) => <LimitNcSym closed={s.closed} label={s.label}/> },
  footsw: { w: 40, h: 120, handles: vert2(40, 120), draw: (s) => <FootSwSym closed={s.closed} label={s.label}/> },
  selector2pos: { w: 40, h: 100, handles: [
    { id: '11', x: 20, y: 0, side: 'T' },
    { id: '12', x: 8, y: 100, side: 'B' },
    { id: '14', x: 32, y: 100, side: 'B' },
  ], draw: (s) => <Selector2PosSym closed={s.closed} label={s.label}/> },
  disconnect: { w: 40, h: 100, handles: vert2(40, 100), draw: (s) => <DisconnectSym closed={s.closed} label={s.label}/> },
  xformer: { w: 80, h: 100, handles: [
    { id: 'p1', x: 20, y: 0, side: 'T' },
    { id: 'p2', x: 60, y: 0, side: 'T' },
    { id: 's1', x: 20, y: 100, side: 'B' },
    { id: 's2', x: 60, y: 100, side: 'B' },
  ], draw: (s) => <XformerSym label={s.label} value={s.value}/> },
  timercoiloff: { w: 60, h: 80, handles: vert2(60, 80), draw: (s) => <TimerCoilOffSym closed={s.closed} label={s.label} delaying={s.delaying}/> },
  timernooff: { w: 40, h: 100, handles: vert2(40, 100), draw: (s) => <TimerNoOffSym closed={s.closed} label={s.label}/> },
  timerncoff: { w: 40, h: 100, handles: vert2(40, 100), draw: (s) => <TimerNcOffSym closed={s.closed} label={s.label}/> },
  pilotlamp: { w: 60, h: 80, handles: vert2(60, 80), draw: (s) => <PilotLampSym lit={s.lit} color={s.color} label={s.label} blink={s.blink}/> },
  timercoil: { w: 60, h: 80, handles: vert2(60, 80), draw: (s) => <TimerCoilSym closed={s.closed} label={s.label} delaying={s.delaying}/> },
  timerno: { w: 40, h: 100, handles: vert2(40, 100), draw: (s) => <TimerNoSym closed={s.closed} label={s.label}/> },
  timernc: { w: 40, h: 100, handles: vert2(40, 100), draw: (s) => <TimerNcSym closed={s.closed} label={s.label}/> },
  terminal: { w: 30, h: 30, handles: vert2(30, 30), draw: (s) => <TerminalSym label={s.label}/> },
  vin: { w: 80, h: 80, handles: horizPair, draw: () => <VinSym/> },
  vout: { w: 80, h: 80, handles: horizPair, draw: () => <VoutSym/> },
  iin: { w: 80, h: 80, handles: horizPair, draw: () => <IinSym/> },
  iout: { w: 80, h: 80, handles: horizPair, draw: () => <IoutSym/> },
  // 3-phase compound symbols. Handle ids: a/b/c on the "right" side of the
  // source (terminals exit rightward) and on the "left" side of the loads
  // (terminals enter from the left). Neutral 'n' on the opposite side.
  src3p: {
    w: 80, h: 120,
    handles: [
      { id: 'a', x: 80, y: 70, side: 'R' },
      { id: 'b', x: 80, y: 90, side: 'R' },
      { id: 'c', x: 80, y: 110, side: 'R' },
      { id: 'n', x: 0,  y: 90, side: 'L' },
    ],
    draw: (s) => <Src3PSym value={s.value}/>,
  },
  loady3p: {
    w: 80, h: 120,
    handles: [
      { id: 'a', x: 0,  y: 70, side: 'L' },
      { id: 'b', x: 0,  y: 90, side: 'L' },
      { id: 'c', x: 0,  y: 110, side: 'L' },
      { id: 'n', x: 80, y: 90, side: 'R' },
    ],
    draw: (s) => <LoadY3PSym value={s.value}/>,
  },
  loadd3p: {
    w: 80, h: 100,
    handles: [
      { id: 'a', x: 0, y: 70, side: 'L' },
      { id: 'b', x: 0, y: 83, side: 'L' },
      { id: 'c', x: 0, y: 96, side: 'L' },
    ],
    draw: (s) => <LoadD3PSym value={s.value}/>,
  },

  // ─── Block diagram (v0.3, linear SISO control systems) ─────────────────
  // All block-diagram components are 120×60 rectangles with directional handles
  // (input on left, output on right). The label + tf live inside the box.
  block_g: {
    w: 120, h: 60,
    handles: [
      { id: 'in', x: 0, y: 30, side: 'L' },
      { id: 'out', x: 120, y: 30, side: 'R' },
    ],
    draw: (s) => <BlockBoxSym label={s.label ?? 'G(s)'} tf={s.value}/>,
  },
  block_h: {
    // Feedback block: input is on the right, output on the left so the wire
    // runs naturally back from the forward-path pickoff to the summing junction.
    w: 120, h: 60,
    handles: [
      { id: 'in', x: 120, y: 30, side: 'R' },
      { id: 'out', x: 0, y: 30, side: 'L' },
    ],
    draw: (s) => <BlockBoxSym label={s.label ?? 'H(s)'} tf={s.value}/>,
  },
  block_k: {
    w: 80, h: 60,
    handles: [
      { id: 'in', x: 0, y: 30, side: 'L' },
      { id: 'out', x: 80, y: 30, side: 'R' },
    ],
    draw: (s) => <BlockBoxSym label={s.label ?? 'K'} tf={s.value}/>,
  },
  block_p: {
    w: 80, h: 60,
    handles: [
      { id: 'in', x: 0, y: 30, side: 'L' },
      { id: 'out', x: 80, y: 30, side: 'R' },
    ],
    draw: (s) => <BlockBoxSym label={s.label ?? 'P'} tf={s.value}/>,
  },
  block_i: {
    w: 80, h: 60,
    handles: [
      { id: 'in', x: 0, y: 30, side: 'L' },
      { id: 'out', x: 80, y: 30, side: 'R' },
    ],
    draw: (s) => <BlockBoxSym label={s.label ?? 'I'} tf={s.value ?? 'K/s'}/>,
  },
  block_d: {
    w: 80, h: 60,
    handles: [
      { id: 'in', x: 0, y: 30, side: 'L' },
      { id: 'out', x: 80, y: 30, side: 'R' },
    ],
    draw: (s) => <BlockBoxSym label={s.label ?? 'D'} tf={s.value ?? 'K·s'}/>,
  },
  // Summer: variable 2–4 inputs (left side + top + bottom), 1 output (right).
  // Handle ids: in0..in{N-1}, out. Signs per input live in data.signs.
  summer: {
    w: 60, h: 60,
    handles: [
      { id: 'in0', x: 0, y: 30, side: 'L' },
      { id: 'in1', x: 30, y: 0, side: 'T' },
      { id: 'in2', x: 30, y: 60, side: 'B' },
      { id: 'in3', x: 0, y: 10, side: 'L' },
      { id: 'out', x: 60, y: 30, side: 'R' },
    ],
    draw: (s) => <SummerSym signs={s.signs} label={s.label} arity={s.arity}/>,
  },
  // Pickoff: 1 input (left), variable 2–3 outputs (right + top + bottom).
  pickoff: {
    w: 20, h: 20,
    handles: [
      { id: 'in', x: 0, y: 10, side: 'L' },
      { id: 'out0', x: 20, y: 10, side: 'R' },
      { id: 'out1', x: 10, y: 0, side: 'T' },
      { id: 'out2', x: 10, y: 20, side: 'B' },
    ],
    draw: () => <PickoffSym/>,
  },
  bd_input: {
    w: 60, h: 40,
    handles: [{ id: 'out', x: 60, y: 20, side: 'R' }],
    draw: (s) => <BdMarkerSym label={s.label ?? 'R(s)'} fill="#dbeafe" stroke="#1d4ed8"/>,
  },
  bd_output: {
    w: 60, h: 40,
    handles: [{ id: 'in', x: 0, y: 20, side: 'L' }],
    draw: (s) => <BdMarkerSym label={s.label ?? 'Y(s)'} fill="#fef3c7" stroke="#b45309"/>,
  },
};

// =====================================================================
// Catalog (palette listing, grouped by section)
// =====================================================================

export interface CatalogEntry {
  kind: ComponentKind;
  label: string;
  defaultValue?: string;
  /** Non-label/value fields applied at drop time (e.g. color for pilotlamp). */
  defaultData?: Omit<Partial<IECNodeData>, 'kind' | 'label' | 'value' | 'rotation'>;
}

export const COMPONENT_NAMES: Record<ComponentKind, string> = {
  resistor: 'Resistor', capacitor: 'Capacitor', inductor: 'Inductor',
  dcsource: 'DC Source', acsource: 'AC Source', switch: 'Switch',
  pushbutton: 'Push-button (legacy)', lamp: 'Lamp', ground: 'Ground',
  ammeter: 'Ammeter', voltmeter: 'Voltmeter', diode: 'Diode', led: 'LED',
  npn: 'NPN Transistor', junction: 'Junction', pot: 'Potentiometer',
  spdt: 'SPDT Switch', relaycoil: 'Relay coil (legacy)', relaycontact: 'Relay contact (legacy)',
  // Motor control
  mcb3p: '3-pole MCB', contactor3p: '3-pole contactor main', overload3p: 'Overload heater 3P',
  motor3p: '3-phase Motor (+PE)', motor3p_yd: '3-phase Motor Y-Δ (6T+PE)',
  fuse: 'Fuse', fuse3p: '3-pole Fuse', xterm5: 'Terminal block (-X) 5T',
  contactor: 'Contactor coil', cb: '1-pole Circuit Breaker',
  auxno: 'Aux contact NO', auxnc: 'Aux contact NC',
  olcontact: 'Overload trip NC (95/96)', olalarm: 'Overload alarm NO (97/98)',
  pbno: 'Push-button NO (START)', pbnc: 'Push-button NC (STOP)',
  estop: 'Emergency stop (mushroom)',
  limitno: 'Limit switch NO', limitnc: 'Limit switch NC',
  footsw: 'Foot switch', selector2pos: '2-pos selector (11/12/14)',
  disconnect: 'Disconnect (knife switch)',
  pilotlamp: 'Pilot lamp',
  timercoil: 'Timer coil (on-delay)', timerno: 'Timer NO (on-delay)', timernc: 'Timer NC (on-delay)',
  timercoiloff: 'Timer coil (off-delay)', timernooff: 'Timer NO (off-delay)', timerncoff: 'Timer NC (off-delay)',
  xformer: 'Control transformer',
  terminal: 'Terminal',
  vin: 'Vin (TF input)',
  vout: 'Vout (TF output)',
  iin: 'Iin (TF input)',
  iout: 'Iout (TF output)',
  src3p: '3-phase source',
  loady3p: '3-phase Y load',
  loadd3p: '3-phase Δ load',
  block_g: 'Block G(s) (forward)',
  block_h: 'Block H(s) (feedback)',
  block_k: 'Gain K',
  block_p: 'Proportional P',
  block_i: 'Integrator I (K/s)',
  block_d: 'Derivative D (K·s)',
  summer: 'Summing junction',
  pickoff: 'Pickoff point',
  bd_input: 'Reference input R(s)',
  bd_output: 'Output Y(s)',
};

export interface PaletteSection { name: string; nameTh: string; items: CatalogEntry[] }

export const PALETTE_SECTIONS: PaletteSection[] = [
  {
    name: 'Power (วงจรกำลัง)', nameTh: 'วงจรกำลัง',
    items: [
      { kind: 'xterm5', label: '-X' },
      { kind: 'fuse3p', label: 'F' },
      { kind: 'mcb3p', label: 'Q', defaultData: { closed: true } },
      { kind: 'contactor3p', label: 'K' },
      { kind: 'overload3p', label: 'F' },
      { kind: 'motor3p', label: 'M' },
      { kind: 'motor3p_yd', label: 'M' },
      { kind: 'fuse', label: 'F', defaultValue: '2 A' },
    ],
  },
  {
    name: 'Control (วงจรควบคุม)', nameTh: 'วงจรควบคุม',
    items: [
      { kind: 'contactor', label: 'K' },
      { kind: 'cb', label: 'CB', defaultData: { closed: true } },
      { kind: 'timercoil', label: 'KT', defaultValue: '5 s' },
      { kind: 'timercoiloff', label: 'KT', defaultValue: '5 s' },
      { kind: 'pbno', label: 'S' },
      { kind: 'pbnc', label: 'S' },
      { kind: 'estop', label: 'S' },
      { kind: 'limitno', label: 'S' },
      { kind: 'limitnc', label: 'S' },
      { kind: 'footsw', label: 'S' },
      { kind: 'selector2pos', label: 'SL' },
      { kind: 'auxno', label: 'K' },
      { kind: 'auxnc', label: 'K' },
      { kind: 'olcontact', label: 'F' },
      { kind: 'olalarm', label: 'F' },
      { kind: 'timerno', label: 'KT' },
      { kind: 'timernc', label: 'KT' },
      { kind: 'timernooff', label: 'KT' },
      { kind: 'timerncoff', label: 'KT' },
      { kind: 'disconnect', label: 'Q', defaultData: { closed: true } },
      { kind: 'xformer', label: 'T1', defaultValue: '230/24 V' },
      { kind: 'pilotlamp', label: 'H', defaultData: { color: 'green' } },
      { kind: 'terminal', label: 'X' },
    ],
  },
  {
    name: 'Basics (พื้นฐาน)', nameTh: 'พื้นฐาน',
    items: [
      { kind: 'dcsource', label: 'V', defaultValue: '24 V' },
      { kind: 'acsource', label: 'V', defaultValue: '230 V' },
      { kind: 'resistor', label: 'R', defaultValue: '1 kΩ' },
      { kind: 'pot', label: 'RV', defaultValue: '10 kΩ' },
      { kind: 'capacitor', label: 'C', defaultValue: '10 µF' },
      { kind: 'inductor', label: 'L', defaultValue: '1 mH' },
      { kind: 'diode', label: 'D' },
      { kind: 'led', label: 'D' },
      { kind: 'npn', label: 'Q' },
      { kind: 'lamp', label: 'H' },
      { kind: 'ammeter', label: 'A' },
      { kind: 'voltmeter', label: 'V' },
      { kind: 'switch', label: 'SW' },
      { kind: 'spdt', label: 'SW' },
      { kind: 'pushbutton', label: 'PB' },
      { kind: 'ground', label: '' },
      { kind: 'junction', label: '' },
      { kind: 'relaycoil', label: 'K' },
      { kind: 'relaycontact', label: 'K' },
    ],
  },
];

// Curated palette for "Analyze" mode — passive components + sources + meters + ground.
// Same component kinds, smaller list to keep first-year students focused on Circuits I content.
export const ANALYZE_PALETTE_SECTIONS: PaletteSection[] = [
  {
    name: 'Sources', nameTh: 'แหล่งจ่าย',
    items: [
      { kind: 'dcsource', label: 'V', defaultValue: '12 V' },
      { kind: 'acsource', label: 'V', defaultValue: '5 V' },
    ],
  },
  {
    name: 'Passive', nameTh: 'พาสซีฟ',
    items: [
      { kind: 'resistor', label: 'R', defaultValue: '1 kΩ' },
      { kind: 'capacitor', label: 'C', defaultValue: '10 µF' },
      { kind: 'inductor', label: 'L', defaultValue: '10 mH' },
    ],
  },
  {
    name: 'Connection', nameTh: 'การเชื่อมต่อ',
    items: [
      { kind: 'ground', label: '' },
      { kind: 'junction', label: '' },
      { kind: 'switch', label: 'SW' },
    ],
  },
  {
    name: 'Meters', nameTh: 'มิเตอร์',
    items: [
      { kind: 'voltmeter', label: 'V' },
      { kind: 'ammeter', label: 'A' },
    ],
  },
  {
    name: 'TF ports (AC)', nameTh: 'พอร์ต TF',
    items: [
      { kind: 'vin', label: 'Vin' },
      { kind: 'vout', label: 'Vout' },
      { kind: 'iin', label: 'Iin' },
      { kind: 'iout', label: 'Iout' },
    ],
  },
  {
    name: '3-phase (Lab 11)', nameTh: '3 เฟส',
    items: [
      { kind: 'src3p', label: 'Src', defaultValue: '230 V, 50 Hz' },
      { kind: 'loady3p', label: 'Y', defaultValue: '10 Ω, 30 mH' },
      { kind: 'loadd3p', label: 'Δ', defaultValue: '30 Ω, 90 mH' },
    ],
  },
];

// Block-diagram palette — v0.3 control-systems mode.
export const BLOCK_PALETTE_SECTIONS: PaletteSection[] = [
  {
    name: 'Blocks', nameTh: 'บล็อก',
    items: [
      { kind: 'block_g', label: 'G', defaultValue: '' },
      { kind: 'block_h', label: 'H', defaultValue: '' },
      { kind: 'block_k', label: 'K', defaultValue: '1' },
      { kind: 'block_p', label: 'P', defaultValue: '1' },
      { kind: 'block_i', label: 'I', defaultValue: '1/s' },
      { kind: 'block_d', label: 'D', defaultValue: 's' },
    ],
  },
  {
    name: 'Junctions', nameTh: 'จุดเชื่อม',
    items: [
      { kind: 'summer', label: '', defaultData: { signs: ['+', '-'] as ('+' | '-')[], arity: 2 } as any },
      { kind: 'pickoff', label: '', defaultData: { arity: 2 } as any },
    ],
  },
  {
    name: 'Ports', nameTh: 'พอร์ต',
    items: [
      { kind: 'bd_input', label: 'R' },
      { kind: 'bd_output', label: 'Y' },
    ],
  },
];

// Flat catalog (used by store for label numbering).
export const COMPONENT_CATALOG: CatalogEntry[] = [
  ...PALETTE_SECTIONS.flatMap((s) => s.items),
  ...BLOCK_PALETTE_SECTIONS.flatMap((s) => s.items),
];

// =====================================================================
// Topology classification (used by simulator)
// =====================================================================

// Two-terminal passives that conduct always.
export const TWO_TERMINAL_CONDUCTORS: ReadonlySet<ComponentKind> = new Set([
  'resistor', 'capacitor', 'inductor', 'lamp', 'ammeter', 'pot',
  'diode', 'led', 'relaycoil', 'contactor', 'timercoil', 'pilotlamp', 'fuse',
]);

// 3-pole fuse: always passes each pole through (1↔2, 3↔4, 5↔6).
// Reuse POLE3_PASS by adding fuse3p there.

// Switch-like NO (data.closed=true means conducting). 2-terminal.
export const SWITCH_LIKE_NO: ReadonlySet<ComponentKind> = new Set([
  'switch', 'pushbutton', 'pbno', 'auxno', 'relaycontact', 'timerno', 'olalarm', 'cb',
  'limitno', 'footsw', 'disconnect', 'timernooff',
]);

// Switch-like NC (data.closed=true means OPEN; default = conducting).
export const SWITCH_LIKE_NC: ReadonlySet<ComponentKind> = new Set([
  'pbnc', 'auxnc', 'olcontact', 'timernc',
  'estop', 'limitnc', 'timerncoff',
]);

// 3-pole pass-through (each pole closed in lockstep with data.closed).
// MCB is here too — closed=true (default) conducts, click to "trip" → closed=false → all 3 poles open.
export const POLE3_CONTACTS: ReadonlySet<ComponentKind> = new Set(['contactor3p', 'mcb3p']);

// 3-pole always-conducting. Overload heater stays here — physically the heater keeps
// conducting even when "tripped"; only the auxiliary contacts switch (handled via OL-trip
// label propagation in simulate.ts).
export const POLE3_PASS: ReadonlySet<ComponentKind> = new Set(['overload3p', 'fuse3p']);

// Switches that are interactive (clicks toggle).
export const SWITCH_BEHAVIOR: Partial<Record<ComponentKind, 'toggle' | 'momentary' | 'spdt'>> = {
  switch: 'toggle', relaycontact: 'toggle', pushbutton: 'momentary', spdt: 'toggle',
  pbno: 'momentary', pbnc: 'momentary', auxno: 'toggle', auxnc: 'toggle',
  olcontact: 'toggle', olalarm: 'toggle', timerno: 'toggle', timernc: 'toggle',
  contactor3p: 'toggle', mcb3p: 'toggle', overload3p: 'toggle', cb: 'toggle',
  estop: 'toggle', limitno: 'toggle', limitnc: 'toggle', footsw: 'momentary',
  disconnect: 'toggle', timernooff: 'toggle', timerncoff: 'toggle', selector2pos: 'spdt',
};

// Source kinds.
export const SOURCE_KINDS: ReadonlySet<ComponentKind> = new Set(['dcsource', 'acsource']);

// Kinds that light up.
export const LIT_KINDS: ReadonlySet<ComponentKind> = new Set(['lamp', 'led', 'pilotlamp']);

// Kinds whose all terminals are electrically shorted (junctions, single terminal block dots).
// Note: xterm5 is NOT in here — each of its 5 terminals is electrically separate.
export const JUNCTION_KINDS: ReadonlySet<ComponentKind> = new Set(['junction', 'terminal']);

// Passive analyze-mode components — their symbol doesn't render its label inside
// the SVG (unlike motor-control symbols), so IECNode renders it as an HTML badge
// above the symbol. Without this, "R1" / "V1" / etc. only show in the property
// panel, not on the canvas.
export const LABEL_EXTERNAL_KINDS: ReadonlySet<ComponentKind> = new Set([
  'resistor', 'capacitor', 'inductor', 'dcsource', 'acsource',
  'voltmeter', 'ammeter',
]);

// Block-diagram blocks render their TF expression INSIDE the SVG (BlockBoxSym)
// — so IECNode should NOT also draw the value as an external HTML div, else
// the TF appears twice.
export const VALUE_INTERNAL_KINDS: ReadonlySet<ComponentKind> = new Set([
  'block_g', 'block_h', 'block_k', 'block_p', 'block_i', 'block_d',
]);

// "Coil" kinds whose energised state should close all contacts (or 3P main) sharing their label.
export const COIL_KINDS: ReadonlySet<ComponentKind> = new Set(['relaycoil', 'contactor', 'timercoil', 'timercoiloff']);

// Subset of COIL_KINDS that drive their contacts only after an on-delay.
export const TIMER_COIL_KINDS: ReadonlySet<ComponentKind> = new Set(['timercoil']);

// Off-delay timer coils — contacts close IMMEDIATELY when coil energises, then stay
// closed for the delay AFTER coil de-energises before opening.
export const TIMER_OFF_COIL_KINDS: ReadonlySet<ComponentKind> = new Set(['timercoiloff']);

// Instant-acting contacts: follow non-timer coil energisation immediately.
export const INSTANT_COIL_CONTACTS: ReadonlySet<ComponentKind> = new Set([
  'relaycontact', 'auxno', 'auxnc', 'contactor3p',
]);

// On-delay timer contacts.
export const TIMER_CONTACTS: ReadonlySet<ComponentKind> = new Set(['timerno', 'timernc']);

// Off-delay timer contacts — driven by off-delay coil; held closed during energisation
// AND during the post-drop-out delay window.
export const TIMER_OFF_CONTACTS: ReadonlySet<ComponentKind> = new Set(['timernooff', 'timerncoff']);

// All coil-driven contacts (union of the four above).
export const COIL_DRIVEN_CONTACTS: ReadonlySet<ComponentKind> = new Set([
  ...INSTANT_COIL_CONTACTS, ...TIMER_CONTACTS, ...TIMER_OFF_CONTACTS,
]);

// =====================================================================
// Node component
// =====================================================================

const FRAME_STYLE: CSSProperties = { position: 'relative' };

export function IECNode({ data, selected }: NodeProps) {
  const d = data as IECNodeData;
  const desc = DESCRIPTORS[d.kind];
  if (!desc) return null;
  const rot = (d.rotation ?? 0) as Rotation;
  const { w, h } = desc;

  return (
    <div className="component-frame" style={{ ...FRAME_STYLE, width: w, height: h }}>
      {desc.handles.map((hd) => {
        const p = rotatePoint(hd.x, hd.y, w, h, rot);
        const side = SIDE_ROT[hd.side][rot];
        return (
          <Handle
            key={hd.id}
            id={hd.id}
            type="source"
            position={SIDE_POSITION[side]}
            style={{ left: p.x, top: p.y, transform: 'translate(-50%, -50%)' }}
          />
        );
      })}
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        style={{
          display: 'block',
          transform: rot ? `rotate(${rot}deg)` : undefined,
          transformOrigin: 'center',
          overflow: 'visible',
        }}
      >
        {desc.draw({ closed: d.closed, lit: d.lit, color: d.color, label: d.label, delaying: d.delaying, value: d.value, motorState: d.motorState, blink: d.blink, signs: d.signs, arity: d.arity })}
      </svg>
      {/* Label + value + analyze-annotations placement follows the component's
       *  long axis. Horizontal body (rot 0/180): label above, value below.
       *  Vertical body (rot 90/270): label left, value right — keeps text
       *  off the wires and reads at a glance for both orientations. */}
      {(() => {
        const isVertical = rot === 90 || rot === 270;
        const hasLabel = !!d.label && LABEL_EXTERNAL_KINDS.has(d.kind);
        // Label/value sit just outside the symbol BODY (not the bounding box,
        // which has terminal wires extending well past the body). Same
        // SIDE_INSET on every edge keeps the layout consistent for the long
        // axis of the component, regardless of which body it actually has.
        const SIDE_INSET = 16;
        const labelStyle: React.CSSProperties = isVertical
          ? {
              position: 'absolute',
              top: h / 2,
              left: SIDE_INSET,
              transform: 'translate(-100%, -50%)',
            }
          : {
              position: 'absolute',
              top: SIDE_INSET,
              left: w / 2,
              transform: 'translate(-50%, -100%)',
            };
        const valueStyle: React.CSSProperties = isVertical
          ? {
              position: 'absolute',
              top: h / 2,
              left: w - SIDE_INSET,
              transform: 'translateY(-50%)',
            }
          : {
              position: 'absolute',
              top: h - SIDE_INSET,
              left: w / 2,
              transform: 'translateX(-50%)',
            };
        // Analyze annotations track the value's side. Vertical → right column,
        // stacked just past the value. Horizontal → centre, just below the bbox
        // (kept outside the body so the white-bg pill stays readable).
        const annoStyle: React.CSSProperties = isVertical
          ? {
              position: 'absolute',
              top: h / 2 + (d.value ? 12 : 0),
              left: w - SIDE_INSET,
              transform: 'translateY(-50%)',
            }
          : {
              position: 'absolute',
              top: h + 2,
              left: w / 2,
              transform: 'translateX(-50%)',
            };
        return (
          <>
            {hasLabel && (
              <div
                style={{
                  ...labelStyle,
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#0f172a',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                }}
              >
                {d.label}
              </div>
            )}
            {d.value && !VALUE_INTERNAL_KINDS.has(d.kind) && (
              <div
                style={{
                  ...valueStyle,
                  fontSize: 11,
                  color: '#334155',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                }}
              >
                {d.value}
              </div>
            )}
            {(d.analyzeI || d.analyzeV) && (
              <div
                style={{
                  ...annoStyle,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isVertical ? 'flex-start' : 'center',
                  gap: 1,
                  fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
                  fontSize: 12,
                  fontWeight: 700,
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  background: 'rgba(255,255,255,0.92)',
                  padding: '1px 5px',
                  borderRadius: 3,
                  boxShadow: '0 1px 2px rgba(12, 30, 92, 0.08)',
                }}
              >
                {d.analyzeI && <span style={{ color: '#059669' }}>I = {d.analyzeI}</span>}
                {d.analyzeV && <span style={{ color: '#1e40af' }}>V = {d.analyzeV}</span>}
              </div>
            )}
          </>
        );
      })()}
      {selected && (
        <div
          style={{
            position: 'absolute',
            inset: -4,
            border: '2px dashed #0ea5e9',
            borderRadius: 4,
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}

// Palette preview icon (no rotation).
export function PaletteIcon({ kind }: { kind: ComponentKind }) {
  const desc = DESCRIPTORS[kind];
  if (!desc) return null;
  return (
    <svg width={desc.w} height={desc.h} viewBox={`0 0 ${desc.w} ${desc.h}`} style={{ overflow: 'visible' }}>
      {desc.draw({})}
    </svg>
  );
}

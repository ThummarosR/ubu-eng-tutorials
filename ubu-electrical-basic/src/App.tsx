import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type NodeTypes,
  type NodeMouseHandler,
  type ReactFlowInstance,
} from '@xyflow/react';
import { Palette } from './components/Palette';
import { Toolbar } from './components/Toolbar';
import {
  IECNode,
  IECNodeData,
  ComponentKind,
  Rotation,
  SWITCH_BEHAVIOR,
  COMPONENT_CATALOG,
  TIMER_OFF_COIL_KINDS,
  COIL_KINDS,
} from './components/nodes/iec';
import { TextNode, TextNodeData } from './components/nodes/text';
import { SheetNode, SheetData } from './components/Sheet';
import { TitleBlockDialog } from './components/TitleBlockDialog';
import { PropertiesPanel } from './components/PropertiesPanel';
import { EdgePropertiesPanel } from './components/EdgePropertiesPanel';
import { AnalysisPanel } from './components/AnalysisPanel';
import { BlockDiagramPanel } from './components/BlockDiagramPanel';
import { useStore, type AppMode } from './store';
import { diagramToSvg, downloadBlob, svgStringToPngBlob } from './lib/exporter';
import { simulate, parseDelayMs, computeWireColors, WIRE_COLOR } from './lib/simulate';
import { Example } from './lib/examples';
import { SHEET_NODE_ID, TitleBlock, type PaperSize } from './sheet';
import { buildGraph } from './lib/analyze/graph';
import { solveDC } from './lib/analyze/solver';
import { formatValue } from './lib/analyze/units';
import { buildTF, snapshotAt } from './lib/analyze/laplace';

const nodeTypes: NodeTypes = { iec: IECNode, sheet: SheetNode, text: TextNode };
const SNAP: [number, number] = [10, 10];
const DRAG_MIME = 'application/x-elecdraw-kind';
const HISTORY_LIMIT = 50;

const isIECNode = (n: Node): n is Node<IECNodeData> => n.type === 'iec';
const isTextNode = (n: Node): n is Node<TextNodeData> => n.type === 'text';

interface HistoryEntry {
  nodes: Node[];
  edges: Edge[];
}

function Editor() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [past, setPast] = useState<HistoryEntry[]>([]);
  const [future, setFuture] = useState<HistoryEntry[]>([]);
  const [tbOpen, setTbOpen] = useState(false);
  const idRef = useRef(1);
  const flowRef = useRef<ReactFlowInstance | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);
  const nextLabel = useStore((s) => s.nextLabel);
  const resetCounters = useStore((s) => s.reset);
  const titleBlock = useStore((s) => s.titleBlock);
  const setTitleBlock = useStore((s) => s.setTitleBlock);
  const paperSize = useStore((s) => s.paperSize);
  const setPaperSize = useStore((s) => s.setPaperSize);
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const simView = useStore((s) => s.simView);
  const showCanvasAnalysis = useStore((s) => s.showCanvasAnalysis);
  const analysisDomain = useStore((s) => s.analysisDomain);
  const acFrequency = useStore((s) => s.acFrequency);
  const setAcHighlightId = useStore((s) => s.setAcHighlightId);
  const setExamplePrompts = useStore((s) => s.setExamplePrompts);
  const setAnalysisDomain = useStore((s) => s.setAnalysisDomain);

  const pushHistory = useCallback(() => {
    setPast((p) => [...p, { nodes: nodesRef.current, edges: edgesRef.current }].slice(-HISTORY_LIMIT));
    setFuture([]);
  }, []);

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const prev = p[p.length - 1];
      setFuture((f) => [{ nodes: nodesRef.current, edges: edgesRef.current }, ...f].slice(0, HISTORY_LIMIT));
      setNodes(prev.nodes);
      setEdges(prev.edges);
      return p.slice(0, -1);
    });
  }, []);

  // Per-mode canvas state. Each mode (draw / analyze / block) keeps its own
  // nodes + edges + history + sheet metadata so switching modes never bleeds a
  // diagram into a context it doesn't belong to. The cache is in-memory only
  // (resets on full app reload).
  interface ModeSnapshot {
    nodes: Node[];
    edges: Edge[];
    past: HistoryEntry[];
    future: HistoryEntry[];
    titleBlock: TitleBlock;
    paperSize: PaperSize;
    examplePrompts: string[];
    nextId: number;
  }
  const modeStatesRef = useRef<Partial<Record<AppMode, ModeSnapshot>>>({});
  const prevModeRef = useRef<AppMode>(mode);
  // Set by onLoadExample to skip the auto-swap (the example load already wrote
  // the destination state directly).
  const skipNextSwapRef = useRef(false);
  const examplePromptsCurrent = useStore((s) => s.examplePrompts);

  const snapshotState = useCallback((): ModeSnapshot => ({
    nodes: nodesRef.current,
    edges: edgesRef.current,
    past,
    future,
    titleBlock,
    paperSize,
    examplePrompts: examplePromptsCurrent,
    nextId: idRef.current,
  }), [past, future, titleBlock, paperSize, examplePromptsCurrent]);

  const applyState = useCallback((s: ModeSnapshot | null) => {
    if (s) {
      setNodes(s.nodes);
      setEdges(s.edges);
      setPast(s.past);
      setFuture(s.future);
      setTitleBlock(s.titleBlock);
      setPaperSize(s.paperSize);
      setExamplePrompts(s.examplePrompts);
      idRef.current = s.nextId;
    } else {
      // Blank slate for a mode the user has never entered.
      setNodes([]);
      setEdges([]);
      setPast([]);
      setFuture([]);
      setExamplePrompts([]);
      idRef.current = 1;
      // Keep title block and paper size — they're document-wide settings, not
      // mode-specific.
    }
  }, [setTitleBlock, setPaperSize, setExamplePrompts]);

  useEffect(() => {
    if (prevModeRef.current === mode) return;
    const prev = prevModeRef.current;
    prevModeRef.current = mode;
    if (skipNextSwapRef.current) {
      skipNextSwapRef.current = false;
      return;
    }
    // Save the diagram we're leaving + restore (or blank) the one we're entering.
    modeStatesRef.current[prev] = snapshotState();
    applyState(modeStatesRef.current[mode] ?? null);
  }, [mode, snapshotState, applyState]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setPast((p) => [...p, { nodes: nodesRef.current, edges: edgesRef.current }].slice(-HISTORY_LIMIT));
      setNodes(next.nodes);
      setEdges(next.edges);
      return f.slice(1);
    });
  }, []);

  // Topology simulation runs only over IEC nodes.
  const iecNodes = useMemo(() => nodes.filter(isIECNode), [nodes]);
  // Timer scheduler state. actuatedTimers: node IDs whose delay has elapsed; the simulator
  // treats their contacts as forced. delayingTimers: node IDs currently counting down.
  const [actuatedTimers, setActuatedTimers] = useState<Set<string>>(new Set());
  const [delayingTimers, setDelayingTimers] = useState<Set<string>>(new Set());
  const timerHandlesRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Off-delay timer scheduler state. heldOffDelayLabels: labels whose coil de-energised
  // but their contacts are still held in their actuated state for the delay window.
  const [heldOffDelayLabels, setHeldOffDelayLabels] = useState<Set<string>>(new Set());
  const offDelayHandlesRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const prevEnergisedOffDelayLabelsRef = useRef<Set<string>>(new Set());
  // Seal-in latch persistence: previous render's forcedClosed feeds the next
  // simulate() so a coil that latched via its own aux NO contact stays latched
  // after the user releases the START pushbutton.
  const prevForcedClosedRef = useRef<Set<string>>(new Set());

  const simResult = useMemo(
    () => simulate(iecNodes, edges, actuatedTimers, heldOffDelayLabels, prevForcedClosedRef.current),
    [iecNodes, edges, actuatedTimers, heldOffDelayLabels],
  );

  useEffect(() => {
    prevForcedClosedRef.current = simResult.forcedClosed;
  }, [simResult.forcedClosed]);

  // Schedule / cancel timers as energisedTimerCoils changes.
  useEffect(() => {
    const energised = simResult.energisedTimerCoils;

    // (1) Cancel any pending timeouts for coils that are no longer energised.
    for (const [id, handle] of timerHandlesRef.current) {
      if (!energised.has(id)) {
        clearTimeout(handle);
        timerHandlesRef.current.delete(id);
      }
    }

    // (2) For any newly-energised timer with no pending handle and not yet actuated,
    //     start the delay.
    for (const id of energised) {
      if (timerHandlesRef.current.has(id) || actuatedTimers.has(id)) continue;
      const node = iecNodes.find((n) => n.id === id);
      const ms = parseDelayMs(node?.data.value);
      const handle = setTimeout(() => {
        timerHandlesRef.current.delete(id);
        setDelayingTimers((s) => {
          if (!s.has(id)) return s;
          const n = new Set(s); n.delete(id); return n;
        });
        setActuatedTimers((s) => {
          if (s.has(id)) return s;
          const n = new Set(s); n.add(id); return n;
        });
      }, ms);
      timerHandlesRef.current.set(id, handle);
      setDelayingTimers((s) => {
        if (s.has(id)) return s;
        const n = new Set(s); n.add(id); return n;
      });
    }

    // (3) Prune delaying/actuated entries for coils that dropped out.
    setDelayingTimers((s) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of s) {
        if (energised.has(id) && timerHandlesRef.current.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : s;
    });
    setActuatedTimers((s) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of s) {
        if (energised.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : s;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simResult.energisedTimerCoils, iecNodes]);

  // Clean up any pending timeouts when the editor unmounts.
  useEffect(() => {
    return () => {
      for (const h of timerHandlesRef.current.values()) clearTimeout(h);
      timerHandlesRef.current.clear();
      for (const h of offDelayHandlesRef.current.values()) clearTimeout(h);
      offDelayHandlesRef.current.clear();
    };
  }, []);

  // Off-delay timer scheduler. Detect coils that transitioned from energised → de-energised
  // and start a hold-timer; coils that re-energise within the window have their hold cancelled.
  useEffect(() => {
    const currentLabels = new Set<string>();
    for (const n of iecNodes) {
      if (TIMER_OFF_COIL_KINDS.has(n.data.kind) && simResult.energisedOffDelayCoils.has(n.id) && n.data.label) {
        currentLabels.add(n.data.label);
      }
    }

    // Cancel hold for labels that re-energised within their drop-out window.
    for (const lbl of currentLabels) {
      const h = offDelayHandlesRef.current.get(lbl);
      if (h) {
        clearTimeout(h);
        offDelayHandlesRef.current.delete(lbl);
      }
    }
    setHeldOffDelayLabels((s) => {
      const next = new Set<string>();
      for (const lbl of s) if (!currentLabels.has(lbl)) next.add(lbl);
      return next.size === s.size ? s : next;
    });

    // Labels that WERE energised previously but are NOT now → start the drop-out hold.
    const prev = prevEnergisedOffDelayLabelsRef.current;
    for (const prevLabel of prev) {
      if (currentLabels.has(prevLabel)) continue;
      if (offDelayHandlesRef.current.has(prevLabel)) continue;
      const coil = iecNodes.find(
        (n) => TIMER_OFF_COIL_KINDS.has(n.data.kind) && n.data.label === prevLabel,
      );
      const ms = parseDelayMs(coil?.data.value);
      setHeldOffDelayLabels((s) => {
        if (s.has(prevLabel)) return s;
        const n = new Set(s); n.add(prevLabel); return n;
      });
      const handle = setTimeout(() => {
        offDelayHandlesRef.current.delete(prevLabel);
        setHeldOffDelayLabels((s) => {
          if (!s.has(prevLabel)) return s;
          const n = new Set(s); n.delete(prevLabel); return n;
        });
      }, ms);
      offDelayHandlesRef.current.set(prevLabel, handle);
    }

    prevEnergisedOffDelayLabelsRef.current = currentLabels;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simResult.energisedOffDelayCoils, iecNodes]);

  // DC analyze graph + solve — only computed in analyze mode so draw mode stays cheap.
  const analyzeGraph = useMemo(
    () => (mode === 'analyze' ? buildGraph(nodes, edges) : null),
    [mode, nodes, edges],
  );
  const analyzeSolve = useMemo(
    () => (analyzeGraph ? solveDC(analyzeGraph) : null),
    [analyzeGraph],
  );
  // AC mode: derive the polynomial TF + take a numeric snapshot at the current frequency.
  const acTF = useMemo(
    () => (mode === 'analyze' && analysisDomain === 'ac' ? buildTF(nodes, edges) : null),
    [mode, analysisDomain, nodes, edges],
  );
  const acSnapshot = useMemo(
    () => (acTF && acTF.ok ? snapshotAt(acTF, 2 * Math.PI * acFrequency) : null),
    [acTF, acFrequency],
  );

  // Decorate IEC nodes with simulated `lit` + relay-driven `closed` for display.
  // Timer coils get a `delaying` flag so the symbol can render a "counting down" hint.
  // In analyze mode, also stamp computed I / V annotations on each component.
  const decoratedNodes: Node[] = useMemo(
    () =>
      nodes.map((n) => {
        if (!isIECNode(n)) return n;
        const lit = simResult.lit.get(n.id) ?? false;
        const forced = simResult.forcedClosed.has(n.id);
        // Coils show energised (amber fill) when the simulator marks their node
        // energised. Other components use the forced/data.closed signal.
        const isEnergisedCoil = COIL_KINDS.has(n.data.kind) && simResult.energisedCoils.has(n.id);
        const closedDisplay = forced || !!n.data.closed || isEnergisedCoil;
        const delaying = delayingTimers.has(n.id);
        const motorState = simResult.motorStates.get(n.id);
        // Alarm convention: any pilot lamp labelled "OL" blinks while lit. Steady-on
        // for all other indicators (run / power / stop status) per CADe SIMU + IEC.
        const blink = n.data.kind === 'pilotlamp' && (n.data.label ?? '').toUpperCase().startsWith('OL');

        let analyzeI: string | undefined;
        let analyzeV: string | undefined;
        // AC mode + ready snapshot → show magnitude ∠ phase.
        if (mode === 'analyze' && showCanvasAnalysis && analysisDomain === 'ac' && acTF?.ok && acSnapshot) {
          const k = n.data.kind;
          const terminalToNode = acTF.terminalToNode!;
          const cplxStr = (re: number, im: number, unit: string): string => {
            const mag = Math.sqrt(re * re + im * im);
            const ang = (Math.atan2(im, re) * 180) / Math.PI;
            return `${formatValue(mag, unit)} ∠${ang.toFixed(1)}°`;
          };
          if (k === 'resistor' || k === 'capacitor' || k === 'inductor') {
            const cplx = acSnapshot.branchI.get(n.id);
            if (cplx) {
              analyzeI = cplxStr(cplx.re, cplx.im, 'A');
              const na = terminalToNode.get(`${n.id}:a`);
              const nb = terminalToNode.get(`${n.id}:b`);
              if (na != null && nb != null) {
                const dre = acSnapshot.nodeV[na].re - acSnapshot.nodeV[nb].re;
                const dim = acSnapshot.nodeV[na].im - acSnapshot.nodeV[nb].im;
                analyzeV = cplxStr(dre, dim, 'V');
              }
            }
          }
          if (k === 'voltmeter' || k === 'vout') {
            const na = terminalToNode.get(`${n.id}:a`);
            const nb = terminalToNode.get(`${n.id}:b`);
            if (na != null && nb != null) {
              const dre = acSnapshot.nodeV[na].re - acSnapshot.nodeV[nb].re;
              const dim = acSnapshot.nodeV[na].im - acSnapshot.nodeV[nb].im;
              analyzeV = cplxStr(dre, dim, 'V');
            }
          }
          if (k === 'junction' || k === 'ground' || k === 'vin') {
            const handles = ['t', 'r', 'b', 'l', 'a'];
            for (const h of handles) {
              const idx = terminalToNode.get(`${n.id}:${h}`);
              if (idx != null) {
                const v = acSnapshot.nodeV[idx];
                analyzeV = cplxStr(v.re, v.im, 'V');
                break;
              }
            }
          }
        }
        // DC mode (existing): show real V / I values.
        else if (mode === 'analyze' && showCanvasAnalysis && analyzeGraph && analyzeSolve?.ok) {
          const k = n.data.kind;
          // Branch current annotation — for resistor / source / voltmeter / ammeter.
          if (k === 'resistor' || k === 'dcsource' || k === 'acsource') {
            const I = analyzeSolve.branchCurrents.get(n.id);
            if (I != null && Math.abs(I) > 1e-12) {
              // Arrow follows component rotation so it points along the real
              // current path. rot 0/90/180/270 → →/↓/←/↑ (for I>0).
              const arrows = ['→', '↓', '←', '↑'];
              const rotIdx = (((n.data.rotation ?? 0) / 90) | 0) % 4;
              const arrow = arrows[(rotIdx + (I > 0 ? 0 : 2)) % 4];
              analyzeI = `${formatValue(Math.abs(I), 'A')} ${arrow}`;
              if (k === 'resistor') {
                const na = analyzeGraph.terminalToNode.get(`${n.id}:a`);
                const nb = analyzeGraph.terminalToNode.get(`${n.id}:b`);
                if (na != null && nb != null) {
                  const vr = Math.abs(analyzeSolve.nodeVoltages[na] - analyzeSolve.nodeVoltages[nb]);
                  analyzeV = formatValue(vr, 'V');
                }
              }
            }
          }
          // Voltmeter — display V across its two terminals (open-circuit in our model).
          if (k === 'voltmeter') {
            const na = analyzeGraph.terminalToNode.get(`${n.id}:a`);
            const nb = analyzeGraph.terminalToNode.get(`${n.id}:b`);
            if (na != null && nb != null) {
              analyzeV = formatValue(analyzeSolve.nodeVoltages[na] - analyzeSolve.nodeVoltages[nb], 'V');
            }
          }
          // Junction — display node voltage at its electrical node (any handle works; they're unioned).
          if (k === 'junction' || k === 'ground') {
            const handles = ['t', 'r', 'b', 'l', 'a'];
            for (const h of handles) {
              const idx = analyzeGraph.terminalToNode.get(`${n.id}:${h}`);
              if (idx != null) {
                analyzeV = formatValue(analyzeSolve.nodeVoltages[idx], 'V');
                break;
              }
            }
          }
        }

        const sameLit = (n.data.lit ?? false) === lit;
        const sameClosed = (n.data.closed ?? false) === closedDisplay;
        const sameDelay = (n.data.delaying ?? false) === delaying;
        const sameI = (n.data.analyzeI ?? undefined) === analyzeI;
        const sameV = (n.data.analyzeV ?? undefined) === analyzeV;
        const sameMotor = (n.data.motorState ?? undefined) === motorState;
        const sameBlink = (n.data.blink ?? false) === blink;
        if (sameLit && sameClosed && sameDelay && sameI && sameV && sameMotor && sameBlink) return n;
        return { ...n, data: { ...n.data, lit, closed: closedDisplay, delaying, analyzeI, analyzeV, motorState, blink } };
      }),
    [nodes, simResult, delayingTimers, mode, analyzeGraph, analyzeSolve, showCanvasAnalysis, analysisDomain, acTF, acSnapshot],
  );

  const sheetNode: Node<SheetData> = useMemo(
    () => ({
      id: SHEET_NODE_ID,
      type: 'sheet',
      position: { x: 0, y: 0 },
      data: { isSheet: true, titleBlock, paperSize },
      draggable: false,
      selectable: false,
      deletable: false,
      zIndex: -1,
    }),
    [titleBlock, paperSize],
  );

  const allNodes: Node[] = useMemo(() => [sheetNode, ...decoratedNodes], [sheetNode, decoratedNodes]);

  // Auto-colour every wire from its topology (which source it's connected to).
  // In analyze mode there's no source convention to derive from, so we leave the
  // stored colour alone.
  const wireColors = useMemo(
    () => (mode === 'draw' ? computeWireColors(iecNodes, edges) : null),
    [mode, iecNodes, edges],
  );

  // Edges decorated for display only — base colour comes from auto-colour above,
  // energised conductors get a glow drop-shadow in the matching hue. The stored
  // `edges` state is untouched so save/load is unaffected.
  const decoratedEdges: Edge[] = useMemo(() => {
    const energised = simResult.energisedEdges;
    const glowOn = simView === 'energise';
    return edges.map((e) => {
      const baseColor = wireColors?.edgeColors.get(e.id) ?? (e.style as { stroke?: string } | undefined)?.stroke ?? WIRE_COLOR.FLOAT;
      const isEnergised = glowOn && energised.has(e.id);
      const style: React.CSSProperties = {
        ...(e.style ?? {}),
        stroke: baseColor,
        strokeWidth: 1.6,
      };
      if (isEnergised) {
        style.filter = `drop-shadow(0 0 4px ${baseColor}) drop-shadow(0 0 2px ${baseColor})`;
        style.strokeWidth = 2.0;
      }
      const isShort = wireColors?.shorts.has(e.id) ?? false;
      const decorated: Edge = { ...e, style };
      if (isShort) {
        decorated.label = '⚠ short';
        decorated.labelStyle = { fill: WIRE_COLOR.SHORT, fontWeight: 600, fontSize: 11 };
        decorated.labelBgStyle = { fill: '#fdf4ff', stroke: WIRE_COLOR.SHORT, strokeWidth: 1 };
        decorated.labelBgPadding = [4, 2];
        decorated.labelBgBorderRadius = 4;
      }
      return decorated;
    });
  }, [edges, wireColors, simResult.energisedEdges, simView]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const userChanges = changes.filter((c) => !('id' in c) || c.id !== SHEET_NODE_ID);
      const hasRemove = userChanges.some((c) => c.type === 'remove');
      if (hasRemove) pushHistory();
      setNodes((ns) => applyNodeChanges(userChanges, ns));
    },
    [pushHistory],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const hasRemove = changes.some((c) => c.type === 'remove');
      if (hasRemove) pushHistory();
      setEdges((es) => applyEdgeChanges(changes, es));
    },
    [pushHistory],
  );

  const onConnect = useCallback(
    (params: Connection) => {
      pushHistory();
      setEdges((es) => addEdge({ ...params, type: 'step', style: { stroke: '#0f172a', strokeWidth: 1.6 } }, es));
    },
    [pushHistory],
  );

  const onNodeDragStop = useCallback(() => {
    pushHistory();
  }, [pushHistory]);

  // Click on empty canvas → clear node + edge selection so the floating
  // properties panels close. (React Flow does its own visual deselect, but
  // the panels read `selected` from our state, so we mirror it here.)
  const onPaneClick = useCallback(() => {
    setNodes((ns) => ns.some((n) => n.selected) ? ns.map((n) => n.selected ? { ...n, selected: false } : n) : ns);
    setEdges((es) => es.some((e) => e.selected) ? es.map((e) => e.selected ? { ...e, selected: false } : e) : es);
  }, []);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      // The Sheet (paper background) is itself a node — clicking on the
      // paper visually feels like "clicking empty space", so treat it as
      // a pane click and clear selection.
      if (node.id === SHEET_NODE_ID) {
        onPaneClick();
        return;
      }
      if (!isIECNode(node)) return;
      if (!SWITCH_BEHAVIOR[node.data.kind]) return;
      pushHistory();
      setNodes((ns) =>
        ns.map((n) =>
          n.id === node.id && isIECNode(n)
            ? { ...n, data: { ...n.data, closed: !n.data.closed } }
            : n,
        ),
      );
    },
    [pushHistory, onPaneClick],
  );

  // R / Shift+R rotates selected IEC nodes.
  // Ctrl+D duplicates selected.
  // Ctrl+Z / Ctrl+Y (or Ctrl+Shift+Z) undo/redo.
  // Ctrl+T adds a text annotation at the canvas centre.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField = target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);

      if (inField) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        redo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelected();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't') {
        e.preventDefault();
        addTextAtCenter();
        return;
      }
      if (e.key === 'r' || e.key === 'R') {
        const step = e.shiftKey ? 270 : 90;
        setNodes((ns) => {
          const anySelected = ns.some((n) => n.selected && isIECNode(n));
          if (!anySelected) return ns;
          pushHistory();
          return ns.map((n) => {
            if (!n.selected || !isIECNode(n)) return n;
            const cur = (n.data.rotation ?? 0) as Rotation;
            const nextRot = ((cur + step) % 360) as Rotation;
            return { ...n, data: { ...n.data, rotation: nextRot } };
          });
        });
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undo, redo, pushHistory]);

  // Custom event from TextNode when its content is edited.
  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<{ id: string; text: string }>).detail;
      if (!detail) return;
      pushHistory();
      setNodes((ns) =>
        ns.map((n) =>
          n.id === detail.id && isTextNode(n) ? { ...n, data: { ...n.data, text: detail.text } } : n,
        ),
      );
    };
    window.addEventListener('elecdraw-text-edit', handler);
    return () => window.removeEventListener('elecdraw-text-edit', handler);
  }, [pushHistory]);

  const duplicateSelected = useCallback(() => {
    const selected = nodesRef.current.filter((n) => n.selected && n.id !== SHEET_NODE_ID);
    if (selected.length === 0) return;
    pushHistory();
    const newNodes: Node[] = selected.map((n) => {
      const id = `n${idRef.current++}`;
      return {
        ...n,
        id,
        selected: true,
        position: { x: n.position.x + 30, y: n.position.y + 30 },
        data: { ...n.data },
      };
    });
    setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), ...newNodes] as Node[]);
  }, [pushHistory]);

  const addTextAtCenter = useCallback(() => {
    const inst = flowRef.current;
    if (!inst) return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const center = inst.screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
    pushHistory();
    const id = `t${idRef.current++}`;
    setNodes((ns) => [
      ...ns,
      {
        id,
        type: 'text',
        position: { x: Math.round(center.x / SNAP[0]) * SNAP[0], y: Math.round(center.y / SNAP[1]) * SNAP[1] },
        data: { text: 'Double-click to edit' },
      },
    ]);
  }, [pushHistory]);

  const onPaletteDragStart = (e: React.DragEvent, kind: ComponentKind) => {
    e.dataTransfer.setData(DRAG_MIME, kind);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const kind = e.dataTransfer.getData(DRAG_MIME) as ComponentKind;
      if (!kind || !flowRef.current) return;
      const pos = flowRef.current.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const snapped = { x: Math.round(pos.x / SNAP[0]) * SNAP[0], y: Math.round(pos.y / SNAP[1]) * SNAP[1] };
      const { label, value } = nextLabel(kind);
      const entry = COMPONENT_CATALOG.find((c) => c.kind === kind);
      const id = `n${idRef.current++}`;
      pushHistory();
      // SISO enforcement: only ONE of each marker kind on canvas at any time.
      const isMarker = kind === 'vin' || kind === 'vout' || kind === 'iin' || kind === 'iout';
      setNodes((ns) => {
        const filtered = isMarker ? ns.filter((n) => !(isIECNode(n) && n.data.kind === kind)) : ns;
        return [
          ...filtered,
          {
            id,
            type: 'iec',
            position: snapped,
            data: { kind, label, value, rotation: 0, ...(entry?.defaultData ?? {}) },
          },
        ];
      });
      // Drop edges that referenced the now-removed marker (if any).
      if (isMarker) {
        setEdges((es) => es.filter((e2) => {
          const src = nodesRef.current.find((n) => n.id === e2.source);
          const tgt = nodesRef.current.find((n) => n.id === e2.target);
          const refsRemovedMarker = (n: Node | undefined) =>
            n != null && isIECNode(n) && n.data.kind === kind;
          return !refsRemovedMarker(src) && !refsRemovedMarker(tgt);
        }));
      }
    },
    [nextLabel, pushHistory],
  );

  // Selected single IEC node for the properties panel.
  const selectedSingle = useMemo(() => {
    const sel = nodes.filter((n) => n.selected && isIECNode(n));
    return sel.length === 1 ? (sel[0] as Node<IECNodeData>) : null;
  }, [nodes]);

  // Wire the AC pole-zero highlight to whichever passive (R / L / C) is currently selected.
  useEffect(() => {
    if (mode !== 'analyze' || analysisDomain !== 'ac') {
      setAcHighlightId(null);
      return;
    }
    if (selectedSingle && (selectedSingle.data.kind === 'resistor' || selectedSingle.data.kind === 'capacitor' || selectedSingle.data.kind === 'inductor')) {
      setAcHighlightId(selectedSingle.id);
    } else {
      setAcHighlightId(null);
    }
  }, [selectedSingle, mode, analysisDomain, setAcHighlightId]);

  // Selected single edge — surfaces the EdgePropertiesPanel.
  // Suppressed when a node is also selected (node panel wins).
  const selectedEdge = useMemo(() => {
    if (selectedSingle) return null;
    const sel = edges.filter((e) => e.selected);
    return sel.length === 1 ? sel[0] : null;
  }, [edges, selectedSingle]);

  const onEdgeDelete = useCallback(() => {
    if (!selectedEdge) return;
    pushHistory();
    setEdges((es) => es.filter((e) => e.id !== selectedEdge.id));
  }, [selectedEdge, pushHistory]);

  const onPropertyChange = useCallback(
    (patch: Partial<IECNodeData>) => {
      if (!selectedSingle) return;
      pushHistory();
      setNodes((ns) =>
        ns.map((n) =>
          n.id === selectedSingle.id && isIECNode(n) ? { ...n, data: { ...n.data, ...patch } } : n,
        ),
      );
    },
    [selectedSingle, pushHistory],
  );

  const onPropertyDelete = useCallback(() => {
    if (!selectedSingle) return;
    pushHistory();
    setNodes((ns) => ns.filter((n) => n.id !== selectedSingle.id));
    setEdges((es) => es.filter((e) => e.source !== selectedSingle.id && e.target !== selectedSingle.id));
  }, [selectedSingle, pushHistory]);

  const onExportSvg = () => {
    const svg = diagramToSvg(decoratedNodes, edges, titleBlock, paperSize);
    downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), 'diagram.svg');
  };

  const onExportPng = async () => {
    const svg = diagramToSvg(decoratedNodes, edges, titleBlock, paperSize);
    const png = await svgStringToPngBlob(svg, 2);
    downloadBlob(png, 'diagram.png');
  };

  const onSave = () => {
    // Wire stroke is auto-derived from topology — strip it from saves so the
    // JSON only stores topology + state, not stale display colour.
    const cleanEdges = edges.map((e) => {
      if (!e.style) return e;
      const { stroke: _stroke, strokeWidth: _w, ...rest } = e.style as Record<string, unknown>;
      return Object.keys(rest).length === 0 ? { ...e, style: undefined } : { ...e, style: rest };
    });
    const project = { version: 1, nodes, edges: cleanEdges, titleBlock, paperSize };
    downloadBlob(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }), 'diagram.elecdraw.json');
  };

  const onLoad = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) throw new Error('Invalid project file');
        pushHistory();
        setNodes(data.nodes);
        setEdges(data.edges);
        if (data.titleBlock) setTitleBlock(data.titleBlock);
        if (data.paperSize === 'A3' || data.paperSize === 'A2' || data.paperSize === 'A1') {
          setPaperSize(data.paperSize);
        }
        const maxId = data.nodes.reduce((m: number, n: Node) => {
          const num = parseInt(n.id.replace(/^[nt]/, ''), 10);
          return Number.isFinite(num) ? Math.max(m, num) : m;
        }, 0);
        idRef.current = maxId + 1;
      } catch (err) {
        alert('Could not open project: ' + (err as Error).message);
      }
    };
    input.click();
  };

  const onClear = () => {
    if (nodes.length === 0 && edges.length === 0) return;
    if (!confirm('Clear the current diagram?')) return;
    pushHistory();
    setNodes([]);
    setEdges([]);
    resetCounters();
    idRef.current = 1;
    setExamplePrompts([]);
  };

  const onLoadExample = (ex: Example) => {
    if (nodes.length > 0 || edges.length > 0) {
      if (!confirm(`Replace the current diagram with example "${ex.nameEn}"?`)) return;
    }
    pushHistory();
    // Cross-mode example load: save the current diagram under the current
    // mode (so it survives the switch) and tell the swap-effect to skip
    // restoring, because we're about to populate the destination state
    // directly from the example.
    if (ex.mode && ex.mode !== mode) {
      modeStatesRef.current[mode] = snapshotState();
      skipNextSwapRef.current = true;
    }
    const proj = ex.build();
    setNodes(proj.nodes);
    setEdges(proj.edges);
    setTitleBlock(proj.titleBlock);
    setPaperSize(proj.paperSize);
    setPast([]);
    setFuture([]);
    // Switch mode to match the example's class so the right palette + panel show up.
    if (ex.mode && ex.mode !== mode) setMode(ex.mode);
    // Switch sub-domain (dc / ac / 3p) too so the matching bench surfaces immediately.
    if (ex.domain) setAnalysisDomain(ex.domain);
    // Install pedagogical prompts (cleared if the example has none).
    setExamplePrompts(ex.prompts ?? []);
    const maxId = proj.nodes.reduce((m: number, n: Node) => {
      const num = parseInt(n.id.replace(/^[nte]/, ''), 10);
      return Number.isFinite(num) ? Math.max(m, num) : m;
    }, 0);
    idRef.current = maxId + 1;
    setTimeout(() => flowRef.current?.fitView({ padding: 0.15, duration: 300 }), 50);
  };

  return (
    <div className="h-full flex flex-col">
      <Toolbar
        onExportPng={onExportPng}
        onExportSvg={onExportSvg}
        onSave={onSave}
        onLoad={onLoad}
        onClear={onClear}
        onEditTitleBlock={() => setTbOpen(true)}
        onAddText={addTextAtCenter}
        onUndo={undo}
        onRedo={redo}
        onLoadExample={onLoadExample}
        canUndo={past.length > 0}
        canRedo={future.length > 0}
        paperSize={paperSize}
        onPaperSizeChange={(s) => {
          setPaperSize(s);
          setTimeout(() => flowRef.current?.fitView({ padding: 0.1, duration: 250 }), 0);
        }}
      />
      <div className="flex-1 flex min-h-0">
        <Palette onDragStart={onPaletteDragStart} />
        <div ref={wrapperRef} className="flex-1 relative bg-canvas" onDragOver={onDragOver} onDrop={onDrop}>
          <ReactFlow
            nodes={allNodes}
            edges={decoratedEdges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onNodeDragStop={onNodeDragStop}
            onPaneClick={onPaneClick}
            onInit={(inst) => {
              flowRef.current = inst;
              inst.fitView({ padding: 0.1, duration: 0 });
            }}
            snapToGrid
            snapGrid={SNAP}
            connectionMode={ConnectionMode.Loose}
            defaultEdgeOptions={{ type: 'step', style: { stroke: '#0f172a', strokeWidth: 1.6 } }}
            fitView={false}
            deleteKeyCode={['Backspace', 'Delete']}
            multiSelectionKeyCode={['Shift']}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={15} size={1} color="#cbd5e1" />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable nodeStrokeColor="#0f172a" nodeColor="#e2e8f0" />
          </ReactFlow>
          <PropertiesPanel
            node={selectedSingle}
            onChange={onPropertyChange}
            onDelete={onPropertyDelete}
          />
          <EdgePropertiesPanel
            edge={selectedEdge}
            onDelete={onEdgeDelete}
          />
          <div className="absolute bottom-2 left-2 text-[11px] text-slate-500 bg-white/80 px-2 py-1 rounded border border-slate-200 pointer-events-none">
            R = rotate · Ctrl+D = duplicate · Ctrl+Z/Y = undo/redo · Ctrl+T = text · click switches to toggle · Shift+click / Shift+drag = multi-select · drag a selected node = move group
          </div>
        </div>
        {mode === 'analyze' && analyzeGraph && analyzeSolve && (
          <AnalysisPanel graph={analyzeGraph} solve={analyzeSolve} nodes={nodes} edges={edges} />
        )}
        {mode === 'block' && (
          <BlockDiagramPanel nodes={nodes} edges={edges} />
        )}
      </div>
      <TitleBlockDialog
        open={tbOpen}
        value={titleBlock}
        onClose={() => setTbOpen(false)}
        onSave={(tb: TitleBlock) => setTitleBlock(tb)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <Editor />
    </ReactFlowProvider>
  );
}

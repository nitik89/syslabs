"use client";

import "@xyflow/react/dist/style.css";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type OnConnectEnd,
  type EdgeChange,
  type NodeChange,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import { cn } from "@/lib/utils";
import { Activity, Boxes, ChevronsRight, FileText, Gauge, Network, Maximize2, MousePointerClick, Minimize2, Play, Redo2, Shapes, SlidersHorizontal, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { NODE_KINDS, NO_TRAFFIC_KINDS, isKindAllowed, lockConfig, lockGraph, nodeMonthlyCost, nodeSpec, simulateTimeline, type NodeConfig, type NodeKind, type SimResult, type Timeline, type TrafficProfile } from "@/lib/sim";
import type { DesignDoc, DesignRequirements } from "@/lib/storage";
import { checkpoint, emptyHistory, redo as redoHistory, undo as undoHistory, type History } from "@/lib/history";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FlowEdgeComponent } from "./flow-edge";
import { NodeInspector } from "./inspector";
import { TrafficControls, TrafficPanel } from "./traffic-panel";
import { MetricsPanel } from "./metrics-panel";
import { connectionProblem, docToFlow, edgeId, flowToDoc, makeNode, type FlowEdge, type SysNode } from "./model";
import { DRAG_MIME, Palette } from "./palette";
import { RenameNodeContext, SysNodeComponent } from "./sys-node";
import { RequirementsEditor } from "./requirements-editor";
import { ResizeHandle, usePanelWidth } from "./resize-handle";
import { RunConsole, fmtLatency, type ConsoleTab } from "./run-console";
import { ArchScene, type ArchNode } from "@/components/landing/arch-scene";
import { useTheme } from "@/components/shell/use-theme";

const nodeTypes = { sys: SysNodeComponent };
const edgeTypes = { flow: FlowEdgeComponent };
const defaultEdgeOptions = { type: "flow" as const, markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 } };

/** Nudge a new node down (then right) until it no longer overlaps an existing node. */
function freeSpot(start: { x: number; y: number }, nodes: SysNode[]): { x: number; y: number } {
  const W = 210;
  const H = 100;
  const overlaps = (p: { x: number; y: number }) => nodes.some((n) => Math.abs(n.position.x - p.x) < W && Math.abs(n.position.y - p.y) < H);
  for (let col = 0; col < 6; col++) {
    for (let row = 0; row < 6; row++) {
      const p = { x: start.x + col * W, y: start.y + row * H };
      if (!overlaps(p)) return p;
    }
  }
  return start;
}

type Tab = "inspect" | "requirements" | "results";

/** Phones and small tablets show one pane at a time. */
type MobilePane = "problem" | "design" | "results";
const isNarrow = () => typeof window !== "undefined" && window.matchMedia("(max-width: 1023.98px)").matches;

type Snapshot = { nodes: SysNode[]; edges: FlowEdge[]; traffic: TrafficProfile };

function isTextEntry(t: EventTarget | null): boolean {
  return t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
}

export interface DesignerContext {
  getDoc: () => DesignDoc;
  loadDoc: (doc: DesignDoc) => void;
  result: SimResult | null;
  stale: boolean;
  /** Run the 60-second simulation now; returns the peak (steady-state) result. */
  run: () => SimResult | null;
  timeline: Timeline | null;
  /** Current replay second. */
  t: number;
  /** Open a tab of the run console. */
  showConsoleTab: (id: string) => void;
  /** Monthly cost of the design as drawn (no run needed). */
  monthlyCost: number;
}

/** Renders a caller-supplied render prop as its own component (keeps handlers out of the parent's render). */
function Slot({ render, ctx }: { render: (ctx: DesignerContext) => ReactNode; ctx: DesignerContext }) {
  return <>{render(ctx)}</>;
}

export interface DesignerProps {
  initial: DesignDoc;
  /** Restrict the palette (challenges). */
  allowedKinds?: NodeKind[];
  /** Traffic is fixed (challenges). */
  trafficLocked?: boolean;
  /**
   * Graded problems: every component keeps the catalog's capacity, latency and cost. Only the choice of
   * component, replicas, cache size and indexes are yours. Applied on load too, so edited saves can't sneak in.
   */
  specsLocked?: boolean;
  /** Toolbar actions rendered next to Run (Save / Load / Reset …). */
  actions?: (ctx: DesignerContext) => ReactNode;
  /** Extra content above metrics in the Results tab (challenge scoring). */
  resultsExtra?: (ctx: DesignerContext) => ReactNode;
  /** The problem's own requirements, shown in the Requirements tab (build problems). */
  brief?: DesignRequirements;
  /** Workspace layout (problem pages): a bar across the top. When set, Run lives there instead of the canvas toolbar. */
  header?: (ctx: DesignerContext) => ReactNode;
  /** A panel left of the palette (problem description). */
  leftPanel?: ReactNode;
  /** Shown over the canvas (e.g. the on-call page, or a getting-started guide). */
  canvasOverlay?: (ctx: DesignerContext) => ReactNode;
  /** Run-console content before the first run. */
  consoleIdle?: ReactNode;
  /** Test results for the current run, at the top of the console's Run tab. */
  consoleStatus?: (ctx: DesignerContext) => ReactNode;
  /** Pass/fail summary in the console's tab bar. */
  consoleBadge?: (ctx: DesignerContext) => ReactNode;
  /** Extra run-console tabs (e.g. Submission). */
  consoleTabs?: ConsoleTab[];
  /** Run once as soon as the canvas mounts (on-call: see the system as it is right now). */
  autoRun?: boolean;
  /** Target line on the latency chart. */
  latencyTarget?: { ms: number; label: string };
  /** Called (debounced) whenever the design changes, for draft autosave. */
  onDocChange?: (doc: DesignDoc) => void;
  onRun?: (result: SimResult, doc: DesignDoc) => void;
}

export function Designer(props: DesignerProps) {
  return (
    <ReactFlowProvider>
      <DesignerInner {...props} />
    </ReactFlowProvider>
  );
}

const NO_REQUIREMENTS: DesignRequirements = { functional: [], nonFunctional: [] };

function DesignerInner({
  initial,
  allowedKinds,
  trafficLocked,
  specsLocked,
  actions,
  resultsExtra,
  brief,
  header,
  leftPanel,
  canvasOverlay,
  consoleIdle,
  consoleStatus,
  consoleTabs,
  consoleBadge,
  latencyTarget,
  autoRun,
  onDocChange,
  onRun,
}: DesignerProps) {
  const [initialFlow] = useState(() => docToFlow(specsLocked ? { ...initial, graph: lockGraph(initial.graph) } : initial));
  const [nodes, setNodes, onNodesChangeBase] = useNodesState<SysNode>(initialFlow.nodes);
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState<FlowEdge>(initialFlow.edges);
  const [traffic, setTraffic] = useState<TrafficProfile>(initial.traffic);
  // Problem pages: the brief's traffic. Edits there are a what-if; Submit always grades against the brief.
  const [briefTraffic] = useState<TrafficProfile | undefined>(() => (trafficLocked ? { ...initial.traffic } : undefined));
  const [trafficOpen, setTrafficOpen] = useState(false);
  const whatIf = briefTraffic !== undefined && JSON.stringify(briefTraffic) !== JSON.stringify(traffic);
  const [requirements, setRequirements] = useState<DesignRequirements>(initial.requirements ?? NO_REQUIREMENTS);
  const [result, setResult] = useState<SimResult | null>(null);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [consoleTab, setConsoleTab] = useState("run");
  // Problem pages: the console is a slim bar until the first run (the problem panel already lists the tests).
  const [consoleCollapsed, setConsoleCollapsed] = useState(Boolean(header));
  const [stale, setStale] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("inspect");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  // Canvas space: either side panel can be hidden, or the whole designer can go full screen.
  const [showPalette, setShowPalette] = useState(true);
  const paletteRef = useRef<HTMLElement>(null);
  const paletteWidth = usePanelWidth({ min: 180, max: 420 });
  // Problem workspace: the side panel is a drawer over the canvas, open while a component is selected (or pinned open).
  const workspace = Boolean(header);
  const [showPanel, setShowPanel] = useState(!workspace);
  const panelSqueezes = !workspace && showPanel;
  const [inspectOpen, setInspectOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<MobilePane>(leftPanel ? "problem" : "design");
  // Small screens: the components list slides over the canvas instead of sitting beside it.
  const [mobilePalette, setMobilePalette] = useState(false);
  // Escape closes the components drawer.
  useEffect(() => {
    if (!mobilePalette) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobilePalette(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobilePalette]);
  // Small screens start with the side panel closed so the canvas gets the room.
  useEffect(() => {
    // Tablets (below 1280px): start with the components column collapsed so the canvas isn't squeezed;
    // the toolbar's Components button brings it back.
    if (window.matchMedia("(max-width: 1279.98px)").matches) void Promise.resolve().then(() => setShowPalette(false));
    if (!isNarrow()) return;
    void Promise.resolve().then(() => setShowPanel(false));
  }, []);
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen?.();
  }, []);
  const rf = useReactFlow<SysNode, FlowEdge>();
  const { theme } = useTheme();
  // Re-fit when a drawer opens or closes, so the design uses the space it gains (skip the first render).
  const drawersReady = useRef(false);
  useEffect(() => {
    if (!drawersReady.current) {
      drawersReady.current = true;
      return;
    }
    const id = requestAnimationFrame(() => void rf.fitView({ padding: 0.08, maxZoom: 1, duration: 250 }));
    return () => cancelAnimationFrame(id);
  }, [showPalette, panelSqueezes, consoleCollapsed, rf]);

  const allowed = useMemo(() => new Set<NodeKind>(allowedKinds ?? NODE_KINDS), [allowedKinds]);
  const markDirty = useCallback(() => setStale(true), []);

  /* ------------------------------ undo / redo ----------------------------- */

  const live = useRef<Snapshot>({ nodes, edges, traffic });
  useEffect(() => {
    live.current = { nodes, edges, traffic };
  }, [nodes, edges, traffic]);
  const history = useRef<History<Snapshot>>(emptyHistory());
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const snapshot = (): Snapshot => ({
    nodes: live.current.nodes.map((n) => ({ ...n, selected: false, dragging: false })),
    edges: live.current.edges.map((e) => ({ ...e, selected: false })),
    traffic: live.current.traffic,
  });
  const syncHistoryFlags = () => {
    setCanUndo(history.current.past.length > 0);
    setCanRedo(history.current.future.length > 0);
  };
  /** Call BEFORE a change. Same-key changes in quick succession become one undo step. */
  const record = useCallback((key: string | null = null) => {
    history.current = checkpoint(history.current, snapshot(), key, Date.now());
    syncHistoryFlags();
  }, []);

  /* --------------------------- change handlers --------------------------- */

  const onNodesChange = useCallback(
    (changes: NodeChange<SysNode>[]) => {
      if (changes.some((c) => c.type === "remove")) record("remove");
      else if (changes.some((c) => c.type === "position" && c.position)) record("move");
      onNodesChangeBase(changes);
      if (changes.some((c) => c.type === "add" || c.type === "remove" || c.type === "replace")) markDirty();
      if (changes.some((c) => c.type === "remove" && c.id === selectedId)) setSelectedId(null);
    },
    [onNodesChangeBase, markDirty, selectedId, record],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<FlowEdge>[]) => {
      if (changes.some((c) => c.type === "remove")) record("remove");
      onEdgesChangeBase(changes);
      if (changes.some((c) => c.type === "add" || c.type === "remove" || c.type === "replace")) markDirty();
    },
    [onEdgesChangeBase, markDirty, record],
  );

  const onSelectionChange = useCallback(({ nodes: sel }: OnSelectionChangeParams<SysNode, FlowEdge>) => {
    setSelectedId(sel.length === 1 ? sel[0].id : null);
    if (sel.length === 1) setTab("inspect");
  }, []);

  const isValidConnection = useCallback(
    (c: Connection | FlowEdge) => connectionProblem(c.source, c.target, nodes, edges) === null,
    [nodes, edges],
  );

  const connect = useCallback(
    (source: string, target: string) => {
      const problem = connectionProblem(source, target, nodes, edges);
      if (problem) {
        toast.error(problem);
        return;
      }
      record();
      setEdges((es) => [...es, { id: edgeId(source, target), source, target, type: "flow" }]);
      markDirty();
    },
    [nodes, edges, setEdges, markDirty, record],
  );

  const onConnect = useCallback((c: Connection) => connect(c.source, c.target), [connect]);

  /**
   * Hand-drawn connections: React Flow only connects when you release exactly on a handle. If you release
   * anywhere else on a node, connect to that node instead (in the direction the drag started).
   */
  const onConnectEnd = useCallback<OnConnectEnd>(
    (event, state) => {
      if (state.isValid || !state.fromNode || !state.fromHandle) return;
      const point = "changedTouches" in event ? event.changedTouches[0] : event;
      if (!point) return;
      const el = document.elementFromPoint(point.clientX, point.clientY);
      const targetId = el?.closest(".react-flow__node")?.getAttribute("data-id") ?? state.toNode?.id;
      if (!targetId || targetId === state.fromNode.id) return;
      if (state.fromHandle.type === "source") connect(state.fromNode.id, targetId);
      else connect(targetId, state.fromNode.id);
    },
    [connect],
  );

  const selectOnly = useCallback(
    (id: string | null) => {
      setNodes((ns) => ns.map((n) => (n.selected === (n.id === id) ? n : { ...n, selected: n.id === id })));
      setSelectedId(id);
    },
    [setNodes],
  );

  const addNode = useCallback(
    (kind: NodeKind, position: { x: number; y: number }) => {
      if (!isKindAllowed(kind, allowed)) return;
      const node = makeNode(kind, position, nodes);
      record();
      setNodes((ns) => [...ns.map((n) => (n.selected ? { ...n, selected: false } : n)), { ...node, selected: true }]);
      setSelectedId(node.id);
      setTab("inspect");
      markDirty();
    },
    [allowed, nodes, setNodes, markDirty, record],
  );

  const addAtCenter = useCallback(
    (kind: NodeKind) => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      const center = rect
        ? rf.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
        : { x: 0, y: 0 };
      addNode(kind, freeSpot({ x: center.x - 94, y: center.y - 30 }, nodes));
    },
    [rf, nodes, addNode],
  );

  const onDragOver = useCallback((e: DragEvent) => {
    if (e.dataTransfer.types.includes(DRAG_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    }
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      const kind = e.dataTransfer.getData(DRAG_MIME) as NodeKind;
      if (!kind || !(NODE_KINDS as readonly string[]).includes(kind)) return;
      e.preventDefault();
      const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      addNode(kind, { x: p.x - 94, y: p.y - 30 });
    },
    [rf, addNode],
  );

  const updateNode = useCallback(
    (id: string, patch: { label?: string; config?: Partial<NodeConfig> }) => {
      record(patch.config ? `cfg:${id}:${Object.keys(patch.config).join(",")}` : `label:${id}`);
      setNodes((ns) =>
        ns.map((n) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  ...(patch.label !== undefined ? { label: patch.label } : {}),
                  config: specsLocked
                    ? lockConfig({ kind: n.data.kind, config: { ...n.data.config, ...patch.config } })
                    : { ...n.data.config, ...patch.config },
                },
              }
            : n,
        ),
      );
      if (patch.config) markDirty();
    },
    [setNodes, markDirty, record, specsLocked],
  );

  const deleteNode = useCallback(
    (id: string) => {
      record();
      setNodes((ns) => ns.filter((n) => n.id !== id));
      setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
      setSelectedId(null);
      markDirty();
    },
    [setNodes, setEdges, markDirty, record],
  );

  const removeEdge = useCallback(
    (id: string) => {
      record();
      setEdges((es) => es.filter((e) => e.id !== id));
      markDirty();
    },
    [setEdges, markDirty, record],
  );

  const changeTraffic = useCallback(
    (t: TrafficProfile) => {
      record("traffic");
      setTraffic(t);
      markDirty();
    },
    [markDirty, record],
  );

  /* ------------------------------ doc + run ------------------------------ */

  const getDoc = useCallback(() => flowToDoc(nodes, edges, traffic, requirements), [nodes, edges, traffic, requirements]);

  const loadDoc = useCallback(
    (doc: DesignDoc) => {
      record(); // Reset and Load are undoable.
      const f = docToFlow(specsLocked ? { ...doc, graph: lockGraph(doc.graph) } : doc);
      setNodes(f.nodes);
      setEdges(f.edges);
      setTraffic(doc.traffic);
      setRequirements(doc.requirements ?? NO_REQUIREMENTS);
      setResult(null);
      setStale(false);
      setSelectedId(null);
      setTab("inspect");
      requestAnimationFrame(() => void rf.fitView({ padding: 0.08, maxZoom: 1, duration: 250 }));
    },
    [setNodes, setEdges, rf, record, specsLocked],
  );

  const restore = useCallback(
    (direction: "undo" | "redo") => {
      const step = (direction === "undo" ? undoHistory : redoHistory)(history.current, snapshot());
      if (!step) return;
      history.current = step.history;
      syncHistoryFlags();
      setNodes(step.state.nodes);
      setEdges(step.state.edges);
      setTraffic(step.state.traffic);
      setSelectedId(null);
      markDirty();
    },
    [setNodes, setEdges, markDirty],
  );

  const run = useCallback((): SimResult | null => {
    const doc = flowToDoc(nodes, edges, traffic);
    try {
      const tl = simulateTimeline(doc.graph, doc.traffic);
      const r = tl.ticks[tl.ticks.length - 1].result;
      setTimeline(tl);
      setResult(r);
      setT(0);
      setPlaying(true);
      setConsoleCollapsed(false);
      setConsoleTab("run");
      setStale(false);
      if (!header) {
        setShowPanel(true);
        setTab("results");
      }
      onRun?.(r, doc);
      return r;
    } catch (err) {
      toast.error(`Simulation failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }, [nodes, edges, traffic, onRun, header]);

  const autoRan = useRef(false);
  useEffect(() => {
    if (!autoRun || autoRan.current) return;
    // Mark it done only once it actually runs (dev double-mount cancels the first frame).
    const id = requestAnimationFrame(() => {
      autoRan.current = true;
      void run();
      // Problem pages: the canvas shows the live system; the console stays a slim bar until you press Run.
      if (header) setConsoleCollapsed(true);
    });
    return () => cancelAnimationFrame(id);
  }, [autoRun, run, header]);

  // Replay: one simulated second every 90 ms.
  useEffect(() => {
    if (!playing || !timeline) return;
    const id = setInterval(() => {
      setT((x) => {
        if (x >= timeline.seconds - 1) {
          setPlaying(false);
          return x;
        }
        return x + 1;
      });
    }, 90);
    return () => clearInterval(id);
  }, [playing, timeline]);
  const togglePlay = useCallback(() => {
    if (!timeline) return;
    if (playing) setPlaying(false);
    else {
      if (t >= timeline.seconds - 1) setT(0);
      setPlaying(true);
    }
  }, [playing, timeline, t]);

  // Ctrl/Cmd + Enter runs the simulation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't fire behind an open dialog or sheet (e.g. while naming a design).
      const inOverlay = e.target instanceof Element && e.target.closest('[role="dialog"], [role="alertdialog"]');
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "Enter" && !inOverlay) {
        e.preventDefault();
        run();
        return;
      }
      // Leave native undo to text fields and dialogs.
      if (!mod || inOverlay || isTextEntry(e.target)) return;
      const k = e.key?.toLowerCase() ?? "";
      if (k === "z" || k === "y") {
        e.preventDefault();
        restore(k === "y" || e.shiftKey ? "redo" : "undo");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run, restore]);

  // Debounced autosave hook for drafts.
  useEffect(() => {
    if (!onDocChange) return;
    const t = setTimeout(() => onDocChange(flowToDoc(nodes, edges, traffic, requirements)), 400);
    return () => clearTimeout(t);
  }, [nodes, edges, traffic, requirements, onDocChange]);

  const focusNode = useCallback(
    (id: string) => {
      selectOnly(id);
      setTab("inspect");
      setInspectOpen(true);
      void rf.fitView({ nodes: [{ id }], duration: 300, maxZoom: 1.2, padding: 0.6 });
    },
    [selectOnly, rf],
  );

  /* ------------------------------ rendering ------------------------------ */

  const showResults = result !== null && !stale;
  // The canvas follows the replay: node load and link flow at the current second.
  const shown = showResults ? (timeline?.ticks[Math.min(t, timeline.ticks.length - 1)]?.result ?? result) : null;
  const displayNodes = useMemo(
    () => (shown ? nodes.map((n) => ({ ...n, data: { ...n.data, result: shown.nodes[n.id] } })) : nodes),
    [nodes, shown],
  );
  const displayEdges = useMemo(() => {
    const delivery = new Set(
      nodes.filter((n) => NO_TRAFFIC_KINDS.has(nodeSpec({ kind: n.data.kind, config: n.data.config }).behavior)).map((n) => n.id),
    );
    return edges.map((e) => {
      if (delivery.has(e.source) || delivery.has(e.target)) return { ...e, data: { deploy: true } };
      return shown ? { ...e, data: { rps: shown.edgeFlows[e.id] ?? 0, targetStatus: shown.nodes[e.target]?.status } } : e;
    });
  }, [nodes, edges, shown]);

  // The 3D view follows the canvas: where each component sits, and how they're linked.
  const archNodes = useMemo<ArchNode[]>(
    () => nodes.map((n) => ({ id: n.id, kind: n.data.kind, label: n.data.label.trim() || n.id, x: n.position.x, y: n.position.y })),
    [nodes],
  );
  const archEdges = useMemo(() => edges.map((e) => ({ id: e.id, source: e.source, target: e.target })), [edges]);

  const renameNode = useCallback((id: string, label: string) => updateNode(id, { label }), [updateNode]);

  const selected = nodes.find((n) => n.id === selectedId) ?? null;
  // Workspace: the drawer opens on double-click (or from the console), not on every click or drag.
  const panelOpen = showPanel || (workspace && inspectOpen && selected !== null);
  const nodeCosts = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, nodeMonthlyCost({ kind: n.data.kind, config: n.data.config })])), [nodes]);
  const nodeLabels = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n.data.label.trim() || n.id])), [nodes]);
  const monthlyCost = nodes.reduce((sum, n) => sum + nodeMonthlyCost({ kind: n.data.kind, config: n.data.config }), 0);
  const showConsoleTab = useCallback((id: string) => {
    setConsoleTab(id);
    setConsoleCollapsed(false);
    setMobilePane("results");
  }, []);
  const ctx: DesignerContext = { getDoc, loadDoc, result, stale, run, timeline, t, showConsoleTab, monthlyCost };

  // Pager: what an on-call engineer would see at this second.
  const tick = showResults && timeline ? timeline.ticks[Math.min(t, timeline.ticks.length - 1)] : null;
  const hottest = tick
    ? Object.entries(tick.utilization)
        .filter(([id]) => (tick.result.nodes[id]?.load ?? 0) > 0)
        .sort((a, b) => b[1] - a[1])[0]
    : undefined;
  const hottestName = hottest ? (nodes.find((n) => n.id === hottest[0])?.data.label.trim() || hottest[0]) : "";
  const tickErr = tick && tick.offeredRps > 0 ? tick.errorRps / tick.offeredRps : 0;
  const paging = tick !== null && (tickErr > 0.01 || tick.p99 >= 1000 || (hottest?.[1] ?? 0) > 1);


  const paletteList = (
    <Palette
      allowed={allowedKinds}
      onAdd={(kind) => {
        addAtCenter(kind);
        if (isNarrow()) {
          setMobilePalette(false);
          toast.success("Added to the canvas", { duration: 1500 });
        }
      }}
      onClose={() => (workspace || isNarrow() ? setMobilePalette(false) : setShowPalette(false))}
    />
  );
  // Lab: a resizable column beside the canvas (on phones it slides over the canvas instead).
  const paletteColumn = (
    <aside
      ref={paletteRef}
      className={cn(
        "relative shrink-0 bg-sidebar lg:h-auto lg:w-[var(--palette-w)] lg:border-r lg:border-border lg:bg-sidebar/60 lg:overflow-visible",
        !showPalette && "lg:hidden",
        mobilePalette && mobilePane === "design"
          ? "max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:z-30 max-lg:w-[min(86vw,340px)] max-lg:overflow-hidden max-lg:border-r max-lg:border-border max-lg:shadow-[24px_0_48px_-24px_var(--shadow)]"
          : "max-lg:hidden",
      )}
      style={{ ["--palette-w" as string]: `${paletteWidth.width ?? 284}px` }}
    >
      <div className="h-full overflow-hidden">{paletteList}</div>
      <ResizeHandle
        label="Resize components panel"
        getWidth={() => paletteRef.current?.offsetWidth ?? 240}
        onResize={paletteWidth.setWidth}
        onReset={paletteWidth.reset}
      />
    </aside>
  );
  // Problem pages: a drawer over the canvas, opened from "Add component". It stays open while you add
  // several on larger screens; on phones it closes after each add.
  const paletteDrawer = (
    <aside
      aria-label="Components"
      hidden={!mobilePalette}
      className={cn(
        "absolute inset-y-0 left-0 z-30 w-[min(86vw,320px)] overflow-hidden border-r border-border bg-sidebar shadow-[24px_0_48px_-24px_var(--shadow)]",
        mobilePane !== "design" && "max-lg:hidden",
      )}
    >
      {paletteList}
    </aside>
  );

  return (
    <div ref={rootRef} className={cn("flex min-h-0 flex-1 flex-col bg-background", fullscreen && "h-screen")}>
      {header && <Slot render={header} ctx={ctx} />}
      <MobilePaneSwitcher
        pane={mobilePane}
        onChange={(p) => {
          setMobilePane(p);
          setMobilePalette(false);
          if (p === "results") setConsoleCollapsed(false);
        }}
        hasProblem={Boolean(leftPanel)}
        resultBadge={result !== null && !stale}
      />
      <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
      {leftPanel && (
        <div className={cn("lg:contents", mobilePane === "problem" ? "max-lg:absolute max-lg:inset-0 max-lg:z-30 max-lg:flex max-lg:flex-col max-lg:bg-background" : "max-lg:hidden")}>
          {leftPanel}
        </div>
      )}
      {/* Lab: the palette is a resizable column. Problem pages: a drawer over the canvas (see below). */}
      {!workspace && paletteColumn}

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      {workspace && paletteDrawer}
      <TrafficPanel open={trafficOpen} onClose={() => setTrafficOpen(false)} traffic={traffic} onChange={changeTraffic} base={briefTraffic} />
      {/* Canvas */}
      <div ref={wrapperRef} data-tour="canvas" className="relative min-h-0 flex-1 lg:min-h-[380px]" onDragOver={onDragOver} onDrop={onDrop}>
        <RenameNodeContext.Provider value={renameNode}>
        <ReactFlow<SysNode, FlowEdge>
          nodes={displayNodes}
          edges={displayEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectEnd={onConnectEnd}
          connectionRadius={40}
          onSelectionChange={onSelectionChange}
          // Double-click a connection to delete it (undoable).
          onEdgeDoubleClick={(_, e) => {
            removeEdge(e.id);
            toast("Connection removed", { action: { label: "Undo", onClick: () => restore("undo") }, duration: 4000 });
          }}
          zoomOnDoubleClick={false}
          onNodeDoubleClick={(_, n) => {
            selectOnly(n.id);
            setTab("inspect");
            if (workspace) setInspectOpen(true);
            else setShowPanel(true);
          }}
          isValidConnection={isValidConnection}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          deleteKeyCode={["Backspace", "Delete"]}
          colorMode={theme}
          fitView
          fitViewOptions={{ padding: 0.06, maxZoom: 1 }}
          minZoom={0.25}
          maxZoom={2}
          ariaLabelConfig={{ "node.a11yDescription.default": "Press Enter or Space to select. Use arrow keys to move. Press Delete to remove." }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1.3} color="color-mix(in oklch, var(--ink) 11%, transparent)" />
          <Controls showInteractive={false} position="bottom-left" />
          {/* Only worth the space once a design outgrows the screen. */}
          {nodes.length > 8 && (
            <MiniMap
              pannable
              zoomable
              position="bottom-right"
              className="!hidden md:!block"
              style={{ width: 168, height: 104 }}
              nodeBorderRadius={8}
              nodeColor="color-mix(in oklch, var(--brand-blue) 45%, var(--card))"
              maskColor="color-mix(in oklch, var(--shade) 45%, transparent)"
            />
          )}
          <Panel position="top-left" className={cn(
              "!m-3 max-w-[calc(100%-1.5rem)] transition-[margin]",
              workspace && mobilePalette && "lg:!ml-[332px]",
              trafficOpen && "sm:max-w-[calc(100%-370px)]",
            )}>
            <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-border bg-popover/90 p-1.5 shadow-[0_12px_32px_-12px_var(--shadow)] backdrop-blur-md">
              <Button
                size="sm"
                variant={workspace && mobilePalette ? "secondary" : "default"}
                className={cn(!workspace && "lg:hidden")}
                onClick={() => setMobilePalette((o) => !o)}
                aria-expanded={mobilePalette}
                aria-label={mobilePalette ? "Close components" : "Add components"}
                data-tour="add-component"
              >
                <Shapes /> {mobilePalette ? "Done" : <>Add<span className="max-sm:hidden"> component</span></>}
              </Button>
              <span className={cn("mx-1 h-5 w-px bg-border", !workspace && "lg:hidden")} aria-hidden="true" />
              {!workspace && !showPalette && (
                <>
                  <Button variant="ghost" size="sm" className="max-lg:hidden" onClick={() => setShowPalette(true)} aria-label="Show components panel" title="Show components panel">
                    <Shapes /> Components
                  </Button>
                  <span className="mx-1 h-5 w-px bg-border max-lg:hidden" aria-hidden="true" />
                </>
              )}
              {!header && (
                <>
                  <Button size="sm" onClick={run} title="Run simulation (⌘↵)">
                    <Play /> Run<span className="max-sm:hidden"> simulation</span>
                  </Button>
                  <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
                </>
              )}
              <Button variant="ghost" size="icon-sm" onClick={() => restore("undo")} disabled={!canUndo} aria-label="Undo" title="Undo (⌘Z)">
                <Undo2 />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => restore("redo")} disabled={!canRedo} aria-label="Redo" title="Redo (⇧⌘Z)">
                <Redo2 />
              </Button>
              {actions && (
                <>
                  <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
                  <Slot render={actions} ctx={ctx} />
                </>
              )}
              <span className="mx-1 h-5 w-px bg-border max-lg:hidden" aria-hidden="true" />
              <Button
                variant="ghost"
                size="icon-sm"
                className="max-lg:hidden"
                onClick={toggleFullscreen}
                aria-label={fullscreen ? "Exit full screen" : "Full screen"}
                title={fullscreen ? "Exit full screen (Esc)" : "Full screen"}
              >
                {fullscreen ? <Minimize2 /> : <Maximize2 />}
              </Button>
              <Button
                variant={trafficOpen ? "secondary" : "ghost"}
                size="sm"
                onClick={() => {
                  setTrafficOpen((o) => !o);
                  setInspectOpen(false);
                  if (workspace) setShowPanel(false);
                }}
                aria-expanded={trafficOpen}
                aria-label="Traffic"
                data-tour="traffic"
                title={whatIf ? "Traffic: what-if load (Submit uses the brief)" : "Traffic: reads, writes and more"}
                className="relative"
              >
                <Activity /> <span className="max-sm:hidden">Traffic</span>
                {whatIf && <span className="absolute right-1 top-1 size-1.5 rounded-full bg-status-warn" aria-hidden="true" />}
              </Button>
              {!panelOpen && (
                <Button variant="ghost" size="sm" onClick={() => setShowPanel(true)} aria-label="Show side panel" title="Show traffic and results panel">
                  <SlidersHorizontal /> <span className="max-sm:hidden">Details</span>
                </Button>
              )}
            </div>
          </Panel>
          {tick && (
            <Panel position="bottom-center" className="!mb-3">
              <div
                role="status"
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 font-mono text-[11.5px] backdrop-blur-md",
                  paging ? "border-status-crit/40 bg-status-crit/15 text-status-crit" : "border-status-ok/30 bg-status-ok/10 text-status-ok",
                )}
              >
                <span className={cn("size-1.5 rounded-full bg-current", playing && "animate-pulse")} aria-hidden="true" />
                {paging ? "PAGER" : "LIVE SIM"} · p99 {fmtLatency(tick.p99)}
                {hottest && ` · ${hottestName} ${Math.round(hottest[1] * 100)}% busy`}
              </div>
            </Panel>
          )}
        </ReactFlow>
        </RenameNodeContext.Provider>

        {nodes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
            <div className="flex max-w-xs flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-background/70 px-6 py-8 text-center backdrop-blur">
              <Boxes className="size-6 text-brand-cyan" aria-hidden="true" />
              <p className="text-sm font-medium">Empty canvas</p>
              <p className="text-xs text-muted-foreground">
                Start with a Client, then add the components it talks to. Drag from a node&apos;s right handle to another node&apos;s left handle to connect them.
              </p>
            </div>
          </div>
        )}
        {canvasOverlay && <Slot render={canvasOverlay} ctx={ctx} />}
      </div>
      <RunConsole
        timeline={timeline}
        t={t}
        onSeek={(x) => {
          setPlaying(false);
          setT(x);
        }}
        playing={playing}
        onTogglePlay={togglePlay}
        stale={stale}
        status={consoleStatus && result ? <Slot render={consoleStatus} ctx={ctx} /> : undefined}
        tabs={[
          {
            id: "3d",
            label: "3D",
            content: (
              <div className="flex h-full min-h-[240px] flex-col gap-2">
                <p className="text-[11.5px] text-muted-foreground">
                  {shown
                    ? "Tower height is how busy each component is; colour is its health. Red requests are dropped. Scrub the timeline to replay."
                    : "Your design in 3D. Press Run to see load, health and dropped requests."}
                </p>
                <ArchScene
                  nodes={archNodes}
                  edges={archEdges}
                  state={shown ? { nodes: shown.nodes, edgeFlows: shown.edgeFlows } : null}
                  className="min-h-[220px] flex-1 overflow-hidden rounded-xl border border-border bg-black/25 light:bg-secondary/60"
                />
              </div>
            ),
          },
          ...(consoleTabs ?? []),
        ]}
        badge={consoleBadge && result && !stale ? <Slot render={consoleBadge} ctx={ctx} /> : undefined}
        labels={nodeLabels}
        costs={nodeCosts}
        idle={consoleIdle}
        tab={consoleTab}
        onTabChange={setConsoleTab}
        collapsed={consoleCollapsed}
        onToggleCollapsed={() => setConsoleCollapsed((c) => !c)}
        monthlyCost={monthlyCost}
        latencyTarget={latencyTarget}
        onFocusNode={(id) => {
          if (isNarrow()) setMobilePane("design");
          focusNode(id);
        }}
        className={mobilePane === "results" ? "max-lg:absolute max-lg:inset-0 max-lg:z-30 max-lg:!h-auto max-lg:!max-h-none max-lg:border-t-0 max-lg:bg-background" : "max-lg:hidden"}
      />
      </div>

      {/* Inspector / results */}
      <aside
        hidden={!panelOpen}
        className={cn(
          "shrink-0 overflow-y-auto border-t border-border",
          // Small screens: a bottom sheet over the canvas.
          "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-50 max-lg:max-h-[70dvh] max-lg:rounded-t-2xl max-lg:bg-sidebar max-lg:shadow-[0_-24px_48px_-12px_var(--shadow)]",
          workspace
            ? "bg-sidebar/95 backdrop-blur-md lg:absolute lg:inset-y-0 lg:right-0 lg:z-20 lg:w-[310px] lg:border-l lg:border-t-0 lg:shadow-[-24px_0_48px_-24px_var(--shadow)]"
            : "bg-sidebar/60 lg:w-[300px] lg:border-l lg:border-t-0",
        )}
      >
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="gap-0">
          <div className="sticky top-0 z-10 flex items-center gap-1.5 border-b border-border bg-sidebar/95 p-2 backdrop-blur">
            <TabsList className="flex-1">
              <TabsTrigger value="inspect">{selected ? "Component" : "Traffic"}</TabsTrigger>
              <TabsTrigger value="requirements" title="Functional and non-functional requirements">
                Reqs
                {requirements.functional.length + requirements.nonFunctional.length > 0 && (
                  <span className="ml-1 font-mono text-[10px] text-muted-foreground">{requirements.functional.length + requirements.nonFunctional.length}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="results">
                Results
                {result && stale && <span className="ml-1 size-1.5 rounded-full bg-status-warn" aria-label="(outdated)" />}
              </TabsTrigger>
            </TabsList>
            <Button variant="ghost" size="icon-sm" onClick={() => {
                setShowPanel(false);
                setInspectOpen(false);
              }} aria-label="Hide side panel" title="Hide traffic and results panel">
              <ChevronsRight />
            </Button>
          </div>
          <TabsContent value="inspect" className="p-4">
            {selected ? (
              <NodeInspector
                key={selected.id}
                node={selected}
                nodes={nodes}
                edges={edges}
                traffic={traffic}
                onChangeLabel={(label) => updateNode(selected.id, { label })}
                onChangeConfig={(config) => updateNode(selected.id, { config })}
                onDelete={() => deleteNode(selected.id)}
                onConnect={(target) => connect(selected.id, target)}
                onRemoveEdge={removeEdge}
                onSelect={focusNode}
                specsLocked={specsLocked}
              />
            ) : (
              <div className="space-y-5">
                <TrafficControls traffic={traffic} onChange={changeTraffic} base={briefTraffic} />
                <p className="flex gap-2.5 rounded-xl border border-dashed border-border p-3 text-[11.5px] leading-relaxed text-muted-foreground">
                  <MousePointerClick className="mt-0.5 size-4 shrink-0 text-brand-blue" aria-hidden="true" />
                  <span>Select a component to tune its capacity, replicas and cost, or connect it by keyboard. Double-click a name to rename it.</span>
                </p>
              </div>
            )}
          </TabsContent>
          <TabsContent value="requirements" className="p-4">
            <RequirementsEditor value={requirements} onChange={setRequirements} brief={brief} />
          </TabsContent>
          <TabsContent value="results" className="space-y-4 p-4">
            {resultsExtra && <Slot render={resultsExtra} ctx={ctx} />}
            <MetricsPanel result={result} stale={stale} nodes={nodes} edges={edges} onFocusNode={focusNode} />
          </TabsContent>
        </Tabs>
      </aside>
      </div>
    </div>
  );
}

function MobilePaneSwitcher({
  pane,
  onChange,
  hasProblem,
  resultBadge,
}: {
  pane: MobilePane;
  onChange: (p: MobilePane) => void;
  hasProblem: boolean;
  resultBadge: boolean;
}) {
  const items: { id: MobilePane; label: string; icon: typeof FileText }[] = [
    ...(hasProblem ? [{ id: "problem" as const, label: "Problem", icon: FileText }] : []),
    { id: "design", label: "Design", icon: Network },
    { id: "results", label: "Results", icon: Gauge },
  ];
  return (
    <div role="tablist" aria-label="Workspace view" className="flex shrink-0 gap-1 border-b border-border bg-sidebar/80 p-1.5 lg:hidden">
      {items.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={pane === id}
          onClick={() => onChange(id)}
          className={cn(
            "relative flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
            pane === id ? "bg-brand-blue/15 text-foreground ring-1 ring-inset ring-brand-blue/30" : "text-muted-foreground hover:bg-white/[0.04]",
          )}
        >
          <Icon className={cn("size-4", pane === id && "text-brand-blue")} aria-hidden="true" />
          {label}
          {id === "results" && resultBadge && <span className="absolute right-3 top-2 size-1.5 rounded-full bg-status-ok" aria-label="(new run)" />}
        </button>
      ))}
    </div>
  );
}

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
  type EdgeChange,
  type NodeChange,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import { Boxes, Play } from "lucide-react";
import { toast } from "sonner";
import { NODE_KINDS, simulate, type NodeConfig, type NodeKind, type SimResult, type TrafficProfile } from "@/lib/sim";
import type { DesignDoc } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FlowEdgeComponent } from "./flow-edge";
import { NodeInspector, TrafficEditor } from "./inspector";
import { MetricsPanel } from "./metrics-panel";
import { connectionProblem, docToFlow, edgeId, flowToDoc, makeNode, type FlowEdge, type SysNode } from "./model";
import { DRAG_MIME, Palette } from "./palette";
import { SysNodeComponent } from "./sys-node";

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

export interface DesignerContext {
  getDoc: () => DesignDoc;
  loadDoc: (doc: DesignDoc) => void;
  result: SimResult | null;
  stale: boolean;
}

export interface DesignerProps {
  initial: DesignDoc;
  /** Restrict the palette (challenges). */
  allowedKinds?: NodeKind[];
  /** Traffic is fixed (challenges). */
  trafficLocked?: boolean;
  /** Toolbar actions rendered next to Run (Save / Load / Reset …). */
  actions?: (ctx: DesignerContext) => ReactNode;
  /** Extra content above metrics in the Results tab (challenge scoring). */
  resultsExtra?: (ctx: DesignerContext) => ReactNode;
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

function DesignerInner({ initial, allowedKinds, trafficLocked, actions, resultsExtra, onDocChange, onRun }: DesignerProps) {
  const [initialFlow] = useState(() => docToFlow(initial));
  const [nodes, setNodes, onNodesChangeBase] = useNodesState<SysNode>(initialFlow.nodes);
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState<FlowEdge>(initialFlow.edges);
  const [traffic, setTraffic] = useState<TrafficProfile>(initial.traffic);
  const [result, setResult] = useState<SimResult | null>(null);
  const [stale, setStale] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"inspect" | "results">("inspect");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rf = useReactFlow<SysNode, FlowEdge>();

  const allowed = useMemo(() => new Set<NodeKind>(allowedKinds ?? NODE_KINDS), [allowedKinds]);
  const markDirty = useCallback(() => setStale(true), []);

  /* --------------------------- change handlers --------------------------- */

  const onNodesChange = useCallback(
    (changes: NodeChange<SysNode>[]) => {
      onNodesChangeBase(changes);
      if (changes.some((c) => c.type === "add" || c.type === "remove" || c.type === "replace")) markDirty();
      if (changes.some((c) => c.type === "remove" && c.id === selectedId)) setSelectedId(null);
    },
    [onNodesChangeBase, markDirty, selectedId],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<FlowEdge>[]) => {
      onEdgesChangeBase(changes);
      if (changes.some((c) => c.type === "add" || c.type === "remove" || c.type === "replace")) markDirty();
    },
    [onEdgesChangeBase, markDirty],
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
      setEdges((es) => [...es, { id: edgeId(source, target), source, target, type: "flow" }]);
      markDirty();
    },
    [nodes, edges, setEdges, markDirty],
  );

  const onConnect = useCallback((c: Connection) => connect(c.source, c.target), [connect]);

  const selectOnly = useCallback(
    (id: string | null) => {
      setNodes((ns) => ns.map((n) => (n.selected === (n.id === id) ? n : { ...n, selected: n.id === id })));
      setSelectedId(id);
    },
    [setNodes],
  );

  const addNode = useCallback(
    (kind: NodeKind, position: { x: number; y: number }) => {
      if (!allowed.has(kind)) return;
      const node = makeNode(kind, position, nodes);
      setNodes((ns) => [...ns.map((n) => (n.selected ? { ...n, selected: false } : n)), { ...node, selected: true }]);
      setSelectedId(node.id);
      setTab("inspect");
      markDirty();
    },
    [allowed, nodes, setNodes, markDirty],
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
      setNodes((ns) =>
        ns.map((n) =>
          n.id === id
            ? { ...n, data: { ...n.data, ...(patch.label !== undefined ? { label: patch.label } : {}), config: { ...n.data.config, ...patch.config } } }
            : n,
        ),
      );
      if (patch.config) markDirty();
    },
    [setNodes, markDirty],
  );

  const deleteNode = useCallback(
    (id: string) => {
      setNodes((ns) => ns.filter((n) => n.id !== id));
      setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
      setSelectedId(null);
      markDirty();
    },
    [setNodes, setEdges, markDirty],
  );

  const removeEdge = useCallback(
    (id: string) => {
      setEdges((es) => es.filter((e) => e.id !== id));
      markDirty();
    },
    [setEdges, markDirty],
  );

  const changeTraffic = useCallback(
    (t: TrafficProfile) => {
      setTraffic(t);
      markDirty();
    },
    [markDirty],
  );

  /* ------------------------------ doc + run ------------------------------ */

  const getDoc = useCallback(() => flowToDoc(nodes, edges, traffic), [nodes, edges, traffic]);

  const loadDoc = useCallback(
    (doc: DesignDoc) => {
      const f = docToFlow(doc);
      setNodes(f.nodes);
      setEdges(f.edges);
      setTraffic(doc.traffic);
      setResult(null);
      setStale(false);
      setSelectedId(null);
      setTab("inspect");
      requestAnimationFrame(() => void rf.fitView({ padding: 0.2, duration: 250 }));
    },
    [setNodes, setEdges, rf],
  );

  const run = useCallback(() => {
    const doc = flowToDoc(nodes, edges, traffic);
    try {
      const r = simulate(doc.graph, doc.traffic);
      setResult(r);
      setStale(false);
      setTab("results");
      onRun?.(r, doc);
    } catch (err) {
      toast.error(`Simulation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [nodes, edges, traffic, onRun]);

  // Ctrl/Cmd + Enter runs the simulation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run]);

  // Debounced autosave hook for drafts.
  useEffect(() => {
    if (!onDocChange) return;
    const t = setTimeout(() => onDocChange(flowToDoc(nodes, edges, traffic)), 400);
    return () => clearTimeout(t);
  }, [nodes, edges, traffic, onDocChange]);

  const focusNode = useCallback(
    (id: string) => {
      selectOnly(id);
      setTab("inspect");
      void rf.fitView({ nodes: [{ id }], duration: 300, maxZoom: 1.2, padding: 0.6 });
    },
    [selectOnly, rf],
  );

  /* ------------------------------ rendering ------------------------------ */

  const showResults = result !== null && !stale;
  const displayNodes = useMemo(
    () => (showResults ? nodes.map((n) => ({ ...n, data: { ...n.data, result: result.nodes[n.id] } })) : nodes),
    [nodes, result, showResults],
  );
  const displayEdges = useMemo(
    () =>
      showResults
        ? edges.map((e) => ({ ...e, data: { rps: result.edgeFlows[e.id] ?? 0, targetStatus: result.nodes[e.target]?.status } }))
        : edges,
    [edges, result, showResults],
  );

  const selected = nodes.find((n) => n.id === selectedId) ?? null;
  const ctx: DesignerContext = { getDoc, loadDoc, result, stale };

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      {/* Palette */}
      <aside className="max-h-60 shrink-0 overflow-y-auto border-b border-border bg-sidebar/60 p-3 lg:max-h-none lg:w-60 lg:border-b-0 lg:border-r">
        <Palette allowed={allowedKinds} onAdd={addAtCenter} />
      </aside>

      {/* Canvas */}
      <div ref={wrapperRef} className="relative h-[62vh] min-h-[420px] flex-1 lg:h-auto" onDragOver={onDragOver} onDrop={onDrop}>
        <ReactFlow<SysNode, FlowEdge>
          nodes={displayNodes}
          edges={displayEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onSelectionChange={onSelectionChange}
          isValidConnection={isValidConnection}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          deleteKeyCode={["Backspace", "Delete"]}
          colorMode="dark"
          fitView
          fitViewOptions={{ padding: 0.2, maxZoom: 1.1 }}
          minZoom={0.25}
          maxZoom={2}
          ariaLabelConfig={{ "node.a11yDescription.default": "Press Enter or Space to select. Use arrow keys to move. Press Delete to remove." }}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="oklch(1 0 0 / 10%)" />
          <Controls showInteractive={false} position="bottom-left" />
          <MiniMap pannable zoomable position="bottom-right" className="!hidden md:!block" nodeColor="oklch(0.5 0.12 265)" maskColor="oklch(0 0 0 / 55%)" />
          <Panel position="top-left" className="!m-3">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background/85 p-1.5 backdrop-blur">
              <Button size="sm" onClick={run} className="bg-gradient-to-r from-brand-blue to-brand-violet text-white hover:opacity-90">
                <Play /> Run simulation
                <kbd className="ml-1 hidden rounded bg-white/15 px-1 font-mono text-[10px] sm:inline">⌘↵</kbd>
              </Button>
              {actions?.(ctx)}
            </div>
          </Panel>
        </ReactFlow>

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
      </div>

      {/* Inspector / results */}
      <aside className="shrink-0 overflow-y-auto border-t border-border bg-sidebar/60 lg:w-80 lg:border-l lg:border-t-0">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "inspect" | "results")} className="gap-0">
          <div className="sticky top-0 z-10 border-b border-border bg-sidebar/95 p-2 backdrop-blur">
            <TabsList className="w-full">
              <TabsTrigger value="inspect">{selected ? "Component" : "Traffic"}</TabsTrigger>
              <TabsTrigger value="results">
                Results
                {result && stale && <span className="ml-1 size-1.5 rounded-full bg-status-warn" aria-label="(outdated)" />}
              </TabsTrigger>
            </TabsList>
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
              />
            ) : (
              <div className="space-y-5">
                <TrafficEditor traffic={traffic} onChange={changeTraffic} locked={trafficLocked} />
                <p className="rounded-lg border border-border bg-secondary/40 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
                  Select a component to edit its capacity, latency, replicas and cost, or to connect it by keyboard.
                </p>
              </div>
            )}
          </TabsContent>
          <TabsContent value="results" className="space-y-4 p-4">
            {resultsExtra?.(ctx)}
            <MetricsPanel result={result} stale={stale} nodes={nodes} onFocusNode={focusNode} />
          </TabsContent>
        </Tabs>
      </aside>
    </div>
  );
}

import type { Edge, Node } from "@xyflow/react";
import { CATALOG, connectionRule, defaultConfig, nodeSpec, type NodeConfig, type NodeKind, type NodeResult, type SimGraph } from "@/lib/sim";
import type { DesignDoc } from "@/lib/storage";

export type SysNodeData = {
  kind: NodeKind;
  label: string;
  config: NodeConfig;
  /** Present only while showing fresh simulation results. */
  result?: NodeResult;
};
export type SysNode = Node<SysNodeData, "sys">;

export type FlowEdgeData = {
  /** RPS on this edge from the latest fresh simulation; undefined when no fresh results. */
  rps?: number;
  /** Status of the target node, used to tint the flow. */
  targetStatus?: NodeResult["status"];
  /** A delivery link (repo → CI → registry → servers): drawn dashed, carries no traffic. */
  deploy?: boolean;
};
export type FlowEdge = Edge<FlowEdgeData, "flow">;

export function docToFlow(doc: DesignDoc): { nodes: SysNode[]; edges: FlowEdge[] } {
  const nodes: SysNode[] = doc.graph.nodes.map((n, i) => {
    const p = doc.positions[n.id];
    return {
      id: n.id,
      type: "sys",
      position: p ? { x: p.x, y: p.y } : { x: 80 + (i % 4) * 240, y: 80 + Math.floor(i / 4) * 140 },
      data: { kind: n.kind, label: n.label ?? CATALOG[n.kind].label, config: { ...n.config } },
    };
  });
  const edges: FlowEdge[] = doc.graph.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, type: "flow" }));
  return { nodes, edges };
}

/** Display name, falling back to the component type when the user cleared the label. */
export function nodeName(n: SysNode): string {
  return n.data.label.trim() || CATALOG[n.data.kind].label;
}

export function flowToGraph(nodes: SysNode[], edges: FlowEdge[]): SimGraph {
  return {
    nodes: nodes.map((n) => ({ id: n.id, kind: n.data.kind, label: n.data.label, config: n.data.config })),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
  };
}

export function flowToDoc(nodes: SysNode[], edges: FlowEdge[], traffic: DesignDoc["traffic"], requirements?: DesignDoc["requirements"]): DesignDoc {
  const positions: DesignDoc["positions"] = {};
  for (const n of nodes) {
    positions[n.id] = { x: Math.round(n.position.x), y: Math.round(n.position.y) };
  }
  const hasReqs = requirements && (requirements.functional.length > 0 || requirements.nonFunctional.length > 0);
  return {
    graph: flowToGraph(nodes, edges),
    positions,
    traffic: { ...traffic },
    ...(hasReqs ? { requirements: { functional: [...requirements.functional], nonFunctional: [...requirements.nonFunctional] } } : {}),
  };
}

/** Readable, collision-free id like "appServer-3". */
export function nextNodeId(kind: NodeKind, existing: Iterable<string>): string {
  const used = new Set(existing);
  let i = 1;
  while (used.has(`${kind}-${i}`)) i++;
  return `${kind}-${i}`;
}

export function nextLabel(kind: NodeKind, nodes: SysNode[]): string {
  const base = CATALOG[kind].label;
  const count = nodes.filter((n) => n.data.kind === kind).length;
  return count === 0 ? base : `${base} ${count + 1}`;
}

export function makeNode(kind: NodeKind, position: { x: number; y: number }, nodes: SysNode[]): SysNode {
  return {
    id: nextNodeId(kind, nodes.map((n) => n.id)),
    type: "sys",
    position,
    data: { kind, label: nextLabel(kind, nodes), config: defaultConfig(kind) },
  };
}

export function edgeId(source: string, target: string): string {
  return `e:${source}->${target}`;
}

/** Why a connection is not allowed, or null if it is fine. */
export function connectionProblem(
  source: string,
  target: string,
  nodes: SysNode[],
  edges: FlowEdge[],
): string | null {
  if (source === target) return "A component can't connect to itself.";
  const t = nodes.find((n) => n.id === target);
  if (!t) return "Target not found.";
  if (t.data.kind === "client") return "Clients only send traffic; they can't receive it.";
  const src = nodes.find((n) => n.id === source);
  if (src) {
    const why = connectionRule(nodeSpec(src.data).behavior, nodeSpec(t.data).behavior);
    if (why) return why;
  }
  if (edges.some((e) => e.source === source && e.target === target)) return "These are already connected.";
  return null;
}

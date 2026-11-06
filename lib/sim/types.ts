/**
 * Core types for the SysLab simulator.
 * This module (and everything in /lib/sim) is pure TypeScript: no React, no randomness, no I/O.
 */

export const NODE_KINDS = [
  "client",
  "cdn",
  "loadBalancer",
  "apiGateway",
  "appServer",
  "cache",
  "sqlDb",
  "nosqlDb",
  "queue",
  "objectStorage",
  "search",
  "monitoring",
] as const;

export type NodeKind = (typeof NODE_KINDS)[number];

export type TrafficClass = "read" | "write" | "static";
export const TRAFFIC_CLASSES: readonly TrafficClass[] = ["read", "write", "static"];

export interface NodeConfig {
  /** Requests per second a single replica can handle. */
  capacity: number;
  /** Base latency added by this node, in ms, when lightly loaded. */
  latencyMs: number;
  /** Number of identical replicas. For SQL DBs these are read replicas (writes hit the primary only). */
  replicas: number;
  /** Monthly cost of ONE replica, in USD. */
  costPerReplica: number;
  /** Cache only: memory size in GB. Bigger caches hold more of the working set. */
  cacheSizeGb?: number;
}

export interface SimNode {
  id: string;
  kind: NodeKind;
  label?: string;
  config: NodeConfig;
}

export interface SimEdge {
  id: string;
  source: string;
  target: string;
}

export interface SimGraph {
  nodes: SimNode[];
  edges: SimEdge[];
}

export interface TrafficProfile {
  /** Total requests per second produced by all clients combined. */
  rps: number;
  /** Fraction (0..1) of non-static traffic that is reads. The rest is writes. */
  readRatio: number;
  /** Fraction (0..1) of reads that target a small set of hot keys. Drives cache hit ratio. */
  hotKeyFraction: number;
  /** Fraction (0..1) of all traffic that is static assets (images, JS, CSS). Absorbed by CDNs. */
  staticFraction: number;
}

export type NodeStatus = "idle" | "ok" | "warn" | "crit";
export type Health = "idle" | "healthy" | "degraded" | "critical";

export interface NodeResult {
  id: string;
  kind: NodeKind;
  /** Total offered load in RPS (sync + async). */
  load: number;
  loadByClass: Record<TrafficClass, number>;
  /** Total capacity (capacity × replicas). null for unlimited nodes (client, monitoring). */
  capacity: number | null;
  /** Combined utilization (can exceed 1 when overloaded). */
  utilization: number;
  /** Effective latency at this node including queueing, in ms. */
  latencyMs: number;
  /** RPS dropped at this node (overload, failure or no route). */
  droppedRps: number;
  status: NodeStatus;
  /** Cache only. */
  hitRatio?: number;
  /** Queue only: async writes that could not be delivered downstream, per second. */
  backlogRps?: number;
}

export type BottleneckSeverity = "warn" | "crit";

export interface Bottleneck {
  nodeId: string;
  severity: BottleneckSeverity;
  reason: string;
}

export interface SpofResult {
  nodeId: string;
  /** Fraction of offered traffic lost if this node fails. */
  trafficLost: number;
  reason: string;
}

export interface GraphIssue {
  nodeId?: string;
  edgeId?: string;
  message: string;
}

export interface SimResult {
  /** Always true: every number here is simulated, not measured. */
  simulated: true;
  offeredRps: number;
  servedRps: number;
  errorRps: number;
  errorRate: number;
  /** Request-weighted average latency over successfully served synchronous requests. null if nothing served. */
  avgLatencyMs: number | null;
  /** Load on SQL + NoSQL databases (sync + async). */
  dbLoadRps: number;
  /** Overall cache hit ratio across all caches. null if no cache received reads. */
  cacheHitRatio: number | null;
  /** Writes buffered by queues that could not be delivered, per second. */
  backlogRps: number;
  monthlyCost: number;
  nodes: Record<string, NodeResult>;
  /** RPS carried by each user-defined edge. */
  edgeFlows: Record<string, number>;
  bottlenecks: Bottleneck[];
  spofs: SpofResult[];
  issues: GraphIssue[];
  health: Health;
}

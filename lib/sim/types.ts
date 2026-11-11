/**
 * Core types for the SysLab simulator.
 * This module (and everything in /lib/sim) is pure TypeScript: no React, no randomness, no I/O.
 */

/** Generic building blocks. Each one is a distinct simulator behavior. */
export const BASE_KINDS = [
  "client",
  "dns",
  "cdn",
  "loadBalancer",
  "apiGateway",
  "rateLimiter",
  "appGateway",
  "websocketGateway",
  "appServer",
  "serverless",
  "cache",
  "sqlDb",
  "nosqlDb",
  "timeseriesDb",
  "queue",
  "worker",
  "objectStorage",
  "search",
  "redisLock",
  "zookeeper",
  "monitoring",
  "codeRepo",
  "ciPipeline",
  "containerRegistry",
  "llm",
  "fineTune",
] as const;

/**
 * Named, real-world services. Each one runs as a base behavior (see CATALOG[kind].behavior)
 * with its own capacity, latency, price and redundancy.
 */
export const SERVICE_KINDS = [
  // Entry
  "route53",
  "cloudflare",
  "cloudfront",
  "awsAlb",
  "nginx",
  "haproxy",
  "awsApiGateway",
  "kong",
  "awsWaf",
  "envoyGateway",
  // Compute
  "docker",
  "kubernetes",
  "ec2",
  "fargate",
  "lambda",
  "cloudRun",
  "vercel",
  "cloudflareWorkers",
  "vercelSandbox",
  "e2b",
  "celery",
  // Messaging
  "sqs",
  "sns",
  "kafka",
  "rabbitmq",
  "kinesis",
  "pubsub",
  "nats",
  "redisPubsub",
  "redisStreams",
  // Data
  "postgres",
  "mysql",
  "aurora",
  "cloudSql",
  "supabase",
  "neon",
  "planetscale",
  "mongodb",
  "cassandra",
  "dynamodb",
  "mongodbAtlas",
  "firestore",
  "elasticache",
  "memcached",
  "upstash",
  "s3",
  "gcs",
  "elasticsearch",
  "opensearch",
  "algolia",
  "influxdb",
  "timestream",
  // AI
  "openai",
  "claude",
  "gemini",
  "groq",
  "codex",
  "vercelAiGateway",
  "embeddings",
  "vllm",
  "huggingface",
  "huggingfaceHub",
  "openaiFineTune",
  "agentService",
  "mcpServer",
  "playwright",
  "pinecone",
  "pgvector",
  "weaviate",
  // Realtime
  "socketio",
  "sse",
  "pusher",
  // Coordination
  "etcd",
  // Delivery
  "github",
  "gitlab",
  "bitbucket",
  "githubActions",
  "jenkins",
  "dockerBuild",
  "argocd",
  "dockerHub",
  "ecr",
  // Operations
  "prometheus",
  "datadog",
  "sentry",
  "cloudwatch",
] as const;

/** A user-defined component: the user names it and picks which base behavior it simulates as. */
export const CUSTOM_KIND = "custom" as const;

export const NODE_KINDS = [...BASE_KINDS, ...SERVICE_KINDS, CUSTOM_KIND] as const;

export type BaseKind = (typeof BASE_KINDS)[number];

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
  /** Custom components only: the base behavior to simulate as. */
  behavior?: BaseKind;
  /**
   * Databases and search only. "standard" (the default when unset) is the baseline. "none" means reads are
   * full table scans; "heavy" (many or covering indexes) speeds reads up but makes every write maintain them.
   */
  indexes?: IndexLevel;
  /** Databases only: columns that have an index (the inspector keeps `indexes` in step with this list). */
  indexedColumns?: string[];
  /** Databases only: connections each instance accepts at once. A small pool caps throughput. Unset = 100. */
  maxConnections?: number;
  /** Cache only: which items are thrown out when the cache is full. Unset = "lru". */
  eviction?: EvictionPolicy;
  /** Cache only: seconds an item stays before it's refetched. Unset = 3600. */
  ttlSeconds?: number;
  /** Cache only: how writes reach the cache. Unset = "cache-aside". */
  writePolicy?: WritePolicy;
  /** Load balancer only: how requests are spread across servers. Unset = "round-robin". */
  lbAlgorithm?: LbAlgorithm;
  /** Load balancer only: stop sending traffic to servers that are down. Unset = on. */
  healthChecks?: boolean;
  /** App servers, serverless, workers, WebSocket gateways: scale out up to this many replicas under load. Unset = off. */
  autoscaleMax?: number;
  /** CDN only: seconds files stay at the edge before being refetched from your servers. Unset = forever (versioned files). */
  cdnTtlSeconds?: number;
  /** NoSQL only: "strong" reads always see the latest write but cost about twice as much. Unset = "eventual". */
  consistency?: "eventual" | "strong";
  /** Machine size per replica (scale up): multiplies capacity and price. Unset = "medium" (the catalog numbers). */
  instanceSize?: InstanceSize;
  /** App servers and serverless: give up on a request after this many ms (it fails fast instead of hanging). Unset = no limit. */
  timeoutMs?: number;
  /**
   * App servers and serverless: which kinds of request this service takes, e.g. ["write"] for a post
   * service that only handles POST/PUT/DELETE. Load balancers and gateways route each kind only to
   * services that take it. Unset (or empty) = everything.
   */
  handles?: TrafficClass[];
}

export type IndexLevel = "none" | "standard" | "heavy";
export type EvictionPolicy = "lru" | "lfu" | "fifo" | "random";
export type WritePolicy = "cache-aside" | "write-through" | "write-back";
export type LbAlgorithm = "round-robin" | "least-connections" | "ip-hash" | "random";
export type InstanceSize = "small" | "medium" | "large" | "xlarge";

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
  /**
   * Fraction (0..1) of writes that race for the same resource (the same seat, the last item in stock,
   * a username). Optional; defaults to 0. Without a lock service these writes are unsafe.
   */
  contendedWriteFraction?: number;
  /**
   * Fraction (0..1) of dynamic requests that call an AI model (chat, summarize, generate code...). Optional; defaults to 0.
   * App servers, functions and workers connected to an LLM make one model call for each of these.
   */
  aiFraction?: number;
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
  /** Autoscaled nodes: replicas running at this load (between the minimum and autoscaleMax). */
  replicasUsed?: number;
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

export interface IdleExplanation {
  nodeId: string;
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
  /** Contended writes that reached storage without taking a lock (double bookings, oversells), per second. */
  unsafeWriteRps: number;
  /** Calls per second made to LLM components. */
  aiCallRps: number;
  monthlyCost: number;
  nodes: Record<string, NodeResult>;
  /** RPS carried by each user-defined edge. */
  edgeFlows: Record<string, number>;
  bottlenecks: Bottleneck[];
  spofs: SpofResult[];
  issues: GraphIssue[];
  /** Components that are wired in but receive no traffic, each with the likely reason. */
  idle: IdleExplanation[];
  health: Health;
}

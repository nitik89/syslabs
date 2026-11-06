import type { NodeConfig, NodeKind } from "./types";

export interface ComponentSpec {
  kind: NodeKind;
  label: string;
  short: string;
  description: string;
  /** How the simulator treats this component, in plain words. */
  simBehavior: string;
  defaults: NodeConfig;
  /** Managed/global services that are redundant by nature are never flagged as SPOFs. */
  inherentlyRedundant: boolean;
  /** Whether capacity limits apply. */
  unlimited: boolean;
}

export const CATALOG: Record<NodeKind, ComponentSpec> = {
  client: {
    kind: "client",
    label: "Client",
    short: "Users / browsers",
    description: "Source of all traffic. Total RPS comes from the traffic profile and is split evenly across clients.",
    simBehavior: "Emits read, write and static requests. Adds network latency.",
    defaults: { capacity: 0, latencyMs: 20, replicas: 1, costPerReplica: 0 },
    inherentlyRedundant: true,
    unlimited: true,
  },
  cdn: {
    kind: "cdn",
    label: "CDN",
    short: "Edge cache for static assets",
    description: "Global edge network that serves static assets close to users.",
    simBehavior: "Absorbs all static traffic. Forwards dynamic traffic only if it has a downstream node.",
    defaults: { capacity: 50000, latencyMs: 5, replicas: 1, costPerReplica: 200 },
    inherentlyRedundant: true,
    unlimited: false,
  },
  loadBalancer: {
    kind: "loadBalancer",
    label: "Load Balancer",
    short: "Spreads traffic across servers",
    description: "Distributes requests round-robin across healthy downstream nodes and routes around failures.",
    simBehavior: "Splits each traffic class evenly across downstream nodes that accept it.",
    defaults: { capacity: 20000, latencyMs: 1, replicas: 1, costPerReplica: 25 },
    inherentlyRedundant: false,
    unlimited: false,
  },
  apiGateway: {
    kind: "apiGateway",
    label: "API Gateway",
    short: "Auth, routing, rate limits",
    description: "Single entry point for APIs that handles auth, routing and rate limiting.",
    simBehavior: "Pass-through router like a load balancer, with slightly more latency.",
    defaults: { capacity: 10000, latencyMs: 3, replicas: 1, costPerReplica: 50 },
    inherentlyRedundant: false,
    unlimited: false,
  },
  appServer: {
    kind: "appServer",
    label: "App Server",
    short: "Stateless business logic",
    description: "Runs your application code. Stateless, so it scales horizontally with replicas.",
    simBehavior:
      "Reads go to caches first, then databases. Writes go to queues first, then databases. With no downstream it serves requests itself.",
    defaults: { capacity: 1500, latencyMs: 15, replicas: 1, costPerReplica: 70 },
    inherentlyRedundant: false,
    unlimited: false,
  },
  cache: {
    kind: "cache",
    label: "Redis Cache",
    short: "In-memory key-value cache",
    description: "In-memory store that answers hot reads in about a millisecond.",
    simBehavior:
      "Serves a share of reads as hits (from hot-key fraction and cache size). Misses go to the database behind it.",
    defaults: { capacity: 50000, latencyMs: 1, replicas: 1, costPerReplica: 60, cacheSizeGb: 8 },
    inherentlyRedundant: false,
    unlimited: false,
  },
  sqlDb: {
    kind: "sqlDb",
    label: "SQL Database",
    short: "Relational, strongly consistent",
    description: "Relational database such as PostgreSQL or MySQL. Strong consistency, harder to scale writes.",
    simBehavior: "Replicas are read replicas: they add read capacity, but every write goes to the single primary.",
    defaults: { capacity: 1000, latencyMs: 8, replicas: 1, costPerReplica: 200 },
    inherentlyRedundant: false,
    unlimited: false,
  },
  nosqlDb: {
    kind: "nosqlDb",
    label: "NoSQL Database",
    short: "Partitioned key-value / document",
    description: "Horizontally partitioned store (DynamoDB or Cassandra style). Scales reads and writes.",
    simBehavior: "Replicas (shards) add both read and write capacity.",
    defaults: { capacity: 5000, latencyMs: 5, replicas: 1, costPerReplica: 180 },
    inherentlyRedundant: false,
    unlimited: false,
  },
  queue: {
    kind: "queue",
    label: "Message Queue",
    short: "Async write buffer",
    description: "Durable queue (Kafka or SQS style) that decouples producers from consumers.",
    simBehavior:
      "Acknowledges writes right away, so clients only see queue latency, then delivers them in the background. If the consumer can't keep up, a backlog builds instead of errors.",
    defaults: { capacity: 20000, latencyMs: 3, replicas: 1, costPerReplica: 40 },
    inherentlyRedundant: false,
    unlimited: false,
  },
  objectStorage: {
    kind: "objectStorage",
    label: "Object Storage",
    short: "Blobs and files",
    description: "Managed blob store (S3 style) for images, videos and files. Very durable, higher latency.",
    simBehavior: "Serves static and blob reads and writes. A managed service, so never flagged as a single point of failure.",
    defaults: { capacity: 10000, latencyMs: 30, replicas: 1, costPerReplica: 25 },
    inherentlyRedundant: true,
    unlimited: false,
  },
  search: {
    kind: "search",
    label: "Search Engine",
    short: "Full-text index",
    description: "Inverted-index search cluster (Elasticsearch style) for text queries.",
    simBehavior: "Serves reads and accepts index writes.",
    defaults: { capacity: 2000, latencyMs: 20, replicas: 1, costPerReplica: 150 },
    inherentlyRedundant: false,
    unlimited: false,
  },
  monitoring: {
    kind: "monitoring",
    label: "Monitoring",
    short: "Metrics, logs, alerts",
    description: "Collects metrics and alerts you when something breaks. Carries no user traffic.",
    simBehavior: "Takes no traffic. Counts toward architecture quality in challenges.",
    defaults: { capacity: 0, latencyMs: 0, replicas: 1, costPerReplica: 30 },
    inherentlyRedundant: true,
    unlimited: true,
  },
};

export function defaultConfig(kind: NodeKind): NodeConfig {
  return { ...CATALOG[kind].defaults };
}

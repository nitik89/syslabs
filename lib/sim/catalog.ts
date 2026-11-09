import type { BaseKind, NodeConfig, NodeKind } from "./types";

export type Vendor = "AWS" | "GCP" | "Open source" | "SaaS";

export interface ComponentSpec {
  kind: NodeKind;
  /** The generic behavior the simulator runs this component as. Base kinds behave as themselves. */
  behavior: BaseKind;
  /** Set for named real-world services. */
  vendor?: Vendor;
  /** Palette section override, for services that behave like a generic block but belong elsewhere (e.g. vector DBs under AI). */
  group?: string;
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
  /** What a bundled component does in one box (shown as feature chips). */
  includes?: string[];
}

type BaseSpec = Omit<ComponentSpec, "behavior" | "vendor">;

const BASE: Record<BaseKind, BaseSpec> = {
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
  dns: {
    kind: "dns",
    label: "DNS",
    short: "Domain lookup, geo routing",
    description: "Managed DNS (Route 53 style) that resolves your domain and can spread users across load balancers or regions.",
    simBehavior: "Pass-through entry point like a load balancer. Managed and global, so never a single point of failure.",
    defaults: { capacity: 0, latencyMs: 2, replicas: 1, costPerReplica: 10 },
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
  rateLimiter: {
    kind: "rateLimiter",
    label: "Rate Limiter",
    short: "Caps requests per second",
    description: "Token-bucket limiter in front of a service. Rejects excess requests cheaply with HTTP 429 instead of letting them overload what is behind it.",
    simBehavior: "Pass-through router. Its capacity is the allowed rate: anything above it is rejected here, protecting downstream components.",
    defaults: { capacity: 10000, latencyMs: 1, replicas: 1, costPerReplica: 30 },
    inherentlyRedundant: false,
    unlimited: false,
  },
  appGateway: {
    kind: "appGateway",
    label: "Application Gateway",
    short: "WAF, rate limits, auth, L7 LB",
    description:
      "One front door that does the whole edge job: terminates TLS, filters attacks (WAF), rate-limits clients, checks auth tokens, then load-balances and routes requests by path to your services.",
    simBehavior:
      "Pass-through router that spreads traffic across downstream nodes like a load balancer. Its capacity is the allowed rate, so anything above it is rejected here instead of overloading what is behind it. Counts as a load balancer, API gateway and rate limiter for objectives.",
    defaults: { capacity: 25000, latencyMs: 4, replicas: 1, costPerReplica: 90 },
    inherentlyRedundant: false,
    unlimited: false,
    includes: ["TLS termination", "WAF", "Rate limiting", "Auth (JWT / OAuth)", "L7 load balancing", "Path routing"],
  },
  websocketGateway: {
    kind: "websocketGateway",
    label: "WebSocket Gateway",
    short: "Real-time connections",
    description: "Holds long-lived WebSocket connections for chat, live scores and notifications, and forwards messages to backend services.",
    simBehavior: "Pass-through router like a load balancer. Each replica holds a fixed number of connections' worth of traffic.",
    defaults: { capacity: 8000, latencyMs: 2, replicas: 1, costPerReplica: 80 },
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
  serverless: {
    kind: "serverless",
    label: "Serverless Function",
    short: "Auto-scaling functions",
    description: "Functions as a service (Lambda style). Scales out on its own and has no servers to patch, but cold starts add latency and it costs more at steady high load.",
    simBehavior: "Behaves like an app server. Managed, so never a single point of failure. Higher latency and price than an app server.",
    defaults: { capacity: 3000, latencyMs: 25, replicas: 1, costPerReplica: 150 },
    inherentlyRedundant: true,
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
  timeseriesDb: {
    kind: "timeseriesDb",
    label: "Time-Series DB",
    short: "Metrics and sensor data",
    description: "Append-optimized database (InfluxDB / TimescaleDB style) for timestamped data. Huge write throughput, simple range queries.",
    simBehavior: "A database that scales reads and writes with replicas, with high per-replica capacity.",
    defaults: { capacity: 15000, latencyMs: 6, replicas: 1, costPerReplica: 220 },
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
  worker: {
    kind: "worker",
    label: "Background Worker",
    short: "Queue consumer",
    description: "Pool of workers that pull jobs off a queue and do the slow part: writing to the database, sending email, resizing images.",
    simBehavior:
      "Handles writes only. Sends them on to databases or storage. Its capacity limits how fast a queue drains.",
    defaults: { capacity: 2000, latencyMs: 10, replicas: 1, costPerReplica: 60 },
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
  redisLock: {
    kind: "redisLock",
    label: "Redis Lock",
    short: "Fast lease-based lock",
    description:
      "Distributed lock on Redis (SET NX PX / Redlock). Very fast and cheap. Locks are leases that expire, so pair them with fencing tokens for strict correctness.",
    simBehavior:
      "App servers connected to it take a lock for every contended write. Adds its latency to those writes. Fails closed: if the lock is down, contended writes fail. One replica is a single point of failure.",
    defaults: { capacity: 20000, latencyMs: 2, replicas: 1, costPerReplica: 60 },
    inherentlyRedundant: false,
    unlimited: false,
  },
  zookeeper: {
    kind: "zookeeper",
    label: "ZooKeeper",
    short: "Consensus, locks, leader election",
    description:
      "Coordination service (ZooKeeper / etcd style) built on consensus. Strongly consistent locks, leader election and config. Needs a majority quorum, so run 3 or 5 nodes.",
    simBehavior:
      "App servers connected to it take a lock for every contended write. Slower than Redis but safe. Fails closed. An ensemble under 3 nodes cannot survive a failure and is flagged as a single point of failure.",
    defaults: { capacity: 8000, latencyMs: 6, replicas: 3, costPerReplica: 90 },
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
  llm: {
    kind: "llm",
    label: "LLM API",
    short: "Large language model",
    description: "A hosted language model behind an API. Slow (hundreds of ms per call), rate-limited, and priced per token.",
    simBehavior:
      "Called on the side by app servers, functions and workers connected to it, for the share of requests set by \"AI request share\". Adds its latency to those requests. Capacity is the rate limit: calls above it fail.",
    defaults: { capacity: 500, latencyMs: 800, replicas: 1, costPerReplica: 400 },
    inherentlyRedundant: true,
    unlimited: false,
  },
  fineTune: {
    kind: "fineTune",
    label: "Fine-tuning Job",
    short: "Train a model on your data",
    description:
      "Takes a base model plus your examples (support chats, code, labeled data) and trains a specialized version. Runs offline on GPUs, then publishes the new weights.",
    simBehavior:
      "Carries no user traffic. Connect your dataset store into it and connect it to a model registry or the model server that will serve the result. Checked under Delivery pipeline.",
    defaults: { capacity: 0, latencyMs: 0, replicas: 1, costPerReplica: 300 },
    inherentlyRedundant: true,
    unlimited: true,
  },
  codeRepo: {
    kind: "codeRepo",
    label: "Code Repository",
    short: "Where the code lives",
    description: "Git repository holding your application code. Pushing to it starts the delivery pipeline.",
    simBehavior: "Carries no user traffic. Connect it to a CI pipeline to build what you push. Checked under Delivery pipeline.",
    defaults: { capacity: 0, latencyMs: 0, replicas: 1, costPerReplica: 20 },
    inherentlyRedundant: true,
    unlimited: true,
  },
  ciPipeline: {
    kind: "ciPipeline",
    label: "CI/CD Pipeline",
    short: "Build, test, deploy",
    description: "Runs on every push: compiles the code, runs tests, builds a container image and deploys it.",
    simBehavior: "Carries no user traffic. Connect a repo into it, and connect it to a registry or straight to the servers it deploys.",
    defaults: { capacity: 0, latencyMs: 0, replicas: 1, costPerReplica: 15 },
    inherentlyRedundant: true,
    unlimited: true,
  },
  containerRegistry: {
    kind: "containerRegistry",
    label: "Container Registry",
    short: "Stores built images",
    description: "Stores versioned container images produced by CI, so every server runs exactly the same build.",
    simBehavior: "Carries no user traffic. Connect it to the app servers, workers or functions that pull its images.",
    defaults: { capacity: 0, latencyMs: 0, replicas: 1, costPerReplica: 10 },
    inherentlyRedundant: true,
    unlimited: true,
  },
};

type ServiceKind = Exclude<NodeKind, BaseKind | "custom">;
type ServiceRow = [
  behavior: BaseKind,
  vendor: Vendor,
  label: string,
  short: string,
  description: string,
  defaults: [capacity: number, latencyMs: number, replicas: number, costPerReplica: number, cacheSizeGb?: number],
  managed: boolean,
  group?: string,
];

/** Named services. Managed ones are never flagged as single points of failure. */
const SERVICES: Record<ServiceKind, ServiceRow> = {
  // Entry
  route53: ["dns", "AWS", "AWS Route 53", "Managed DNS + health checks", "AWS DNS with latency-based and failover routing between load balancers or regions.", [0, 2, 1, 10], true],
  cloudflare: ["cdn", "SaaS", "Cloudflare", "CDN, WAF, DDoS shield", "Global edge network: caches static content, absorbs DDoS attacks and filters bad traffic before it reaches you.", [80000, 4, 1, 200], true],
  cloudfront: ["cdn", "AWS", "AWS CloudFront", "AWS edge CDN", "AWS's CDN. Usually fronts S3 buckets and load balancers.", [60000, 5, 1, 220], true],
  awsAlb: ["loadBalancer", "AWS", "AWS ALB", "Managed L7 load balancer", "Application Load Balancer: spans availability zones, health-checks targets and routes by path or host.", [25000, 2, 1, 30], true],
  haproxy: ["loadBalancer", "Open source", "HAProxy", "High-performance L4/L7 LB", "Battle-tested open-source load balancer and proxy.", [40000, 1, 1, 20], false],
  nginx: ["loadBalancer", "Open source", "NGINX", "Reverse proxy / LB", "Self-hosted reverse proxy and load balancer. Fast and cheap, but you run (and replicate) it yourself.", [30000, 1, 1, 20], false],
  awsApiGateway: ["apiGateway", "AWS", "AWS API Gateway", "Managed API front door", "Managed gateway with auth, throttling and request routing to Lambda or HTTP backends. Adds a few ms per call.", [10000, 5, 1, 100], true],
  kong: ["apiGateway", "Open source", "Kong Gateway", "Self-hosted API gateway", "NGINX-based API gateway with plugins for auth, rate limits and logging. You run the replicas.", [12000, 3, 1, 60], false],
  envoyGateway: ["appGateway", "Open source", "Envoy Gateway", "Envoy-based edge gateway", "Kubernetes Gateway API on Envoy proxy: TLS, rate limits, JWT auth, retries and weighted routing. You run the replicas.", [30000, 3, 1, 70], false],
  awsWaf: ["rateLimiter", "AWS", "AWS WAF", "Firewall + rate rules", "Web application firewall with rate-based rules. Blocks abusive clients at the edge.", [25000, 1, 1, 40], true],
  // Compute
  docker: ["appServer", "Open source", "Docker Container", "Containerized service", "Your service packaged as a container image. Each replica is one running container on a host you manage.", [1200, 15, 1, 40], false],
  kubernetes: ["appServer", "Open source", "Kubernetes Deployment", "Orchestrated pods", "A Deployment of pods. Kubernetes restarts failed pods and spreads replicas across nodes. Replicas are pods.", [1500, 16, 3, 75], false],
  ec2: ["appServer", "AWS", "AWS EC2", "Virtual machines", "Plain virtual machines running your app. Full control, but you patch and scale them.", [2000, 15, 1, 90], false],
  fargate: ["appServer", "AWS", "AWS ECS Fargate", "Serverless containers", "Runs containers without managing servers. Each replica is a task.", [1500, 18, 2, 95], false],
  lambda: ["serverless", "AWS", "AWS Lambda", "Functions, pay per request", "Event-driven functions that scale automatically. Cold starts add latency, and it gets pricey at steady high load.", [5000, 30, 1, 160], true],
  cloudRun: ["serverless", "GCP", "Google Cloud Run", "Containers that scale to zero", "Runs stateless containers on demand and scales them with traffic.", [4000, 25, 1, 140], true],
  vercel: ["serverless", "SaaS", "Vercel Functions", "Git-push deploys, serverless", "Hosts Next.js and other frontends with serverless and edge functions. Every git push gets a preview deployment.", [4000, 20, 1, 120], true],
  cloudflareWorkers: ["serverless", "SaaS", "Cloudflare Workers", "Code at the edge", "V8 isolates running in 300+ cities. Near-zero cold starts, but limited CPU time per request.", [6000, 8, 1, 100], true],
  vercelSandbox: ["serverless", "SaaS", "Vercel Sandbox", "Run untrusted code safely", "Ephemeral Firecracker microVMs for running user or AI-generated code in isolation. Each run gets a fresh, locked-down machine.", [500, 150, 1, 200], true],
  e2b: ["serverless", "SaaS", "E2B Sandbox", "Code-execution sandboxes", "Isolated cloud sandboxes that boot in about 150 ms, built for AI agents and online judges that execute untrusted code.", [400, 180, 1, 180], true],
  celery: ["worker", "Open source", "Celery Workers", "Python task workers", "Distributed task workers that pull jobs from RabbitMQ, Redis or SQS.", [1500, 12, 1, 50], false],
  // Messaging
  sqs: ["queue", "AWS", "AWS SQS", "Managed queue, at-least-once", "Fully managed queue. Effectively unlimited throughput and no brokers to run. Standard queues may deliver twice or out of order, while FIFO queues don't.", [30000, 10, 1, 40], true],
  sns: ["queue", "AWS", "AWS SNS", "Pub/sub fan-out", "Managed pub/sub: one publish fans out to many subscribers (SQS queues, Lambdas, email, push).", [50000, 15, 1, 30], true],
  kafka: ["queue", "Open source", "Apache Kafka", "Partitioned event log", "Distributed, replayable log. Huge throughput, ordering per partition, consumers can rewind. You run the brokers (3+ for durability).", [100000, 5, 3, 150], false],
  rabbitmq: ["queue", "Open source", "RabbitMQ", "Broker with routing + acks", "Message broker with exchanges, routing keys and per-message acks. Lowest latency, but less throughput than Kafka.", [20000, 2, 1, 80], false],
  kinesis: ["queue", "AWS", "AWS Kinesis", "Managed data streams", "AWS's managed Kafka-like stream for clickstreams, logs and telemetry.", [50000, 20, 1, 150], true],
  pubsub: ["queue", "GCP", "Google Pub/Sub", "Managed global pub/sub", "Google's managed messaging with at-least-once delivery and global topics.", [50000, 15, 1, 60], true],
  nats: ["queue", "Open source", "NATS", "Lightweight messaging", "Very fast pub/sub and request-reply. JetStream adds persistence.", [80000, 1, 3, 60], false],
  redisPubsub: ["queue", "Open source", "Redis Pub/Sub", "Fire-and-forget fan-out", "In-memory publish/subscribe channels. Sub-millisecond and very high throughput, but no persistence: subscribers that are offline miss messages. Great for chat presence, live updates and cache invalidation.", [100000, 1, 1, 60], false],
  redisStreams: ["queue", "Open source", "Redis Streams", "Lightweight durable log", "Append-only log in Redis with consumer groups and acks, like a small Kafka. Messages survive until trimmed, so slow consumers can catch up.", [60000, 2, 1, 70], false],
  // Data
  postgres: ["sqlDb", "Open source", "PostgreSQL", "Relational, feature-rich", "Self-hosted Postgres. Replicas are streaming read replicas, and writes go to one primary.", [1200, 8, 1, 200], false],
  mysql: ["sqlDb", "Open source", "MySQL", "Relational, widely used", "Self-hosted MySQL with read replicas. Writes go to one primary.", [1100, 8, 1, 180], false],
  aurora: ["sqlDb", "AWS", "AWS Aurora", "Managed, multi-AZ SQL", "AWS's Postgres/MySQL-compatible database with storage replicated across 3 zones and automatic failover. Writes still go to one primary.", [1500, 7, 1, 350], true],
  cloudSql: ["sqlDb", "GCP", "Google Cloud SQL", "Managed Postgres / MySQL", "Google-managed relational database with high-availability failover.", [1300, 8, 1, 280], true],
  supabase: ["sqlDb", "SaaS", "Supabase", "Postgres + auth + APIs", "Hosted Postgres with auto-generated APIs, auth and realtime subscriptions.", [1000, 10, 1, 150], true],
  neon: ["sqlDb", "SaaS", "Neon", "Serverless Postgres", "Postgres with separated storage and compute that scales to zero and branches like Git.", [1000, 12, 1, 120], true],
  planetscale: ["sqlDb", "SaaS", "PlanetScale", "Sharded MySQL (Vitess)", "MySQL on Vitess with non-blocking schema changes. Sharding lifts the single-primary write limit (modeled here as a bigger primary).", [4000, 8, 1, 300], true],
  mongodb: ["nosqlDb", "Open source", "MongoDB", "Document database", "JSON-like documents. Sharding spreads reads and writes across replica sets.", [5000, 6, 1, 170], false],
  cassandra: ["nosqlDb", "Open source", "Apache Cassandra", "Wide-column, write-optimized", "Masterless, partitioned store built for heavy writes across data centers. Typically run with 3+ nodes.", [8000, 5, 3, 200], false],
  dynamodb: ["nosqlDb", "AWS", "AWS DynamoDB", "Managed key-value, any scale", "Serverless key-value / document store with single-digit ms latency. Partitions and replicates itself across zones.", [10000, 4, 1, 250], true],
  mongodbAtlas: ["nosqlDb", "SaaS", "MongoDB Atlas", "Managed MongoDB", "MongoDB as a service with automatic sharding, backups and multi-region clusters.", [6000, 6, 1, 220], true],
  firestore: ["nosqlDb", "GCP", "Google Firestore", "Serverless document DB", "Serverless document database with realtime listeners and offline sync for mobile apps.", [8000, 8, 1, 200], true],
  elasticache: ["cache", "AWS", "AWS ElastiCache", "Managed Redis / Memcached", "Managed in-memory cache. Replicas give failover.", [50000, 1, 1, 90, 16], false],
  memcached: ["cache", "Open source", "Memcached", "Simple, fast cache", "Multithreaded in-memory cache. No persistence or replication, just raw speed.", [60000, 1, 1, 50, 8], false],
  upstash: ["cache", "SaaS", "Upstash Redis", "Serverless Redis", "Pay-per-request Redis over HTTP, popular with serverless and edge functions.", [20000, 3, 1, 40, 8], true],
  s3: ["objectStorage", "AWS", "AWS S3", "Object storage", "Eleven nines of durability for images, videos, backups and data lakes. Higher latency than a database.", [10000, 30, 1, 25], true],
  gcs: ["objectStorage", "GCP", "Google Cloud Storage", "Object storage", "Google's durable blob store.", [10000, 30, 1, 25], true],
  elasticsearch: ["search", "Open source", "Elasticsearch", "Full-text search", "Self-hosted search and analytics engine on Lucene inverted indexes.", [2000, 20, 1, 150], false],
  opensearch: ["search", "AWS", "AWS OpenSearch", "Managed search", "AWS-managed Elasticsearch fork. Replicas are data nodes.", [2500, 20, 1, 200], false],
  algolia: ["search", "SaaS", "Algolia", "Hosted instant search", "Search-as-a-service with typo tolerance and millisecond responses.", [5000, 10, 1, 250], true],
  influxdb: ["timeseriesDb", "Open source", "InfluxDB", "Time-series database", "Purpose-built store for metrics and sensor data with fast range queries.", [15000, 6, 1, 200], false],
  timestream: ["timeseriesDb", "AWS", "AWS Timestream", "Managed time-series", "Serverless time-series database that tiers old data to cheaper storage.", [20000, 8, 1, 260], true],
  // AI
  openai: ["llm", "SaaS", "OpenAI GPT", "GPT models via API", "OpenAI's chat and reasoning models. Rate-limited by tokens and requests per minute, and priced per token.", [500, 900, 1, 500], true],
  claude: ["llm", "SaaS", "Anthropic Claude", "Claude models via API", "Anthropic's Claude models for chat, coding, agents and long documents.", [500, 800, 1, 500], true],
  gemini: ["llm", "GCP", "Google Gemini", "Gemini models via API", "Google's multimodal models through Gemini API or Vertex AI.", [600, 700, 1, 450], true],
  groq: ["llm", "SaaS", "Groq", "Ultra-fast LLM inference", "Runs open models (Llama, Qwen, GPT-OSS) on custom LPU chips. Much lower latency than GPU-hosted APIs, which suits voice and realtime agents.", [1000, 150, 1, 300], true],
  codex: ["llm", "SaaS", "OpenAI Codex", "Coding agent", "OpenAI's software-engineering agent: reads repos, writes code and runs tests. Each task takes seconds to minutes.", [100, 3000, 1, 600], true],
  vercelAiGateway: ["llm", "SaaS", "Vercel AI Gateway", "AI SDK + one API, many models", "Used with the Vercel AI SDK: one endpoint that routes to OpenAI, Anthropic, Google and others with fallbacks and spend tracking.", [2000, 820, 1, 450], true],
  embeddings: ["llm", "SaaS", "Embeddings API", "Text → vectors", "Turns text into vectors for semantic search and RAG. Much faster and cheaper than chat models.", [3000, 60, 1, 100], true],
  vllm: ["llm", "Open source", "vLLM on GPUs", "Self-hosted open models", "Serve open-weight models (Llama, Mistral, Qwen) on your own GPUs. Each replica is a GPU node: limited throughput, high fixed cost, no rate limits but yours.", [40, 500, 1, 1800], false],
  huggingface: ["llm", "SaaS", "Hugging Face Inference", "Hosted open models", "Inference Endpoints serving any model from the Hugging Face Hub (Llama, Mistral, your own fine-tunes) on dedicated GPUs.", [200, 400, 1, 600], true],
  huggingfaceHub: ["containerRegistry", "SaaS", "Hugging Face Hub", "Models + datasets registry", "Versioned home for model weights and datasets. Fine-tuning jobs push new versions here and model servers pull them.", [0, 0, 1, 20], true, "AI"],
  openaiFineTune: ["fineTune", "SaaS", "OpenAI Fine-tuning", "Fine-tune GPT models", "Upload JSONL examples and OpenAI trains a private variant of a GPT model that you call like any other model.", [0, 0, 1, 250], true],
  agentService: ["appServer", "Open source", "AI Agent Service", "Agent loop: plan, call tools", "Your agent code (Claude Agent SDK, OpenAI Agents SDK, LangGraph, Vercel AI SDK). Calls models and tools in a loop, so each replica handles few concurrent tasks.", [200, 50, 1, 120], false, "AI"],
  mcpServer: ["appServer", "Open source", "MCP Server", "Tools for AI agents", "Model Context Protocol server exposing tools and data (DB queries, tickets, files) to agents in a standard way.", [1000, 20, 1, 50], false, "AI"],
  playwright: ["appServer", "Open source", "Playwright Browser", "Headless browser automation", "Headless Chromium driven by Playwright: agents browsing the web, scraping, or end-to-end tests. Slow and memory-hungry per session.", [20, 2500, 1, 150], false, "AI"],
  pinecone: ["search", "SaaS", "Pinecone", "Managed vector database", "Serverless vector index for similarity search over embeddings (RAG, recommendations).", [5000, 25, 1, 250], true, "AI"],
  pgvector: ["search", "Open source", "Postgres + pgvector", "Vectors inside Postgres", "Vector similarity search as a Postgres extension. Keeps embeddings next to your relational data.", [1500, 15, 1, 200], false, "AI"],
  weaviate: ["search", "Open source", "Weaviate", "Open-source vector DB", "Vector database with hybrid (keyword + vector) search and built-in vectorizers.", [3000, 20, 1, 220], false, "AI"],
  // Realtime
  socketio: ["websocketGateway", "Open source", "Socket.IO", "WebSocket server + rooms", "Realtime bidirectional events with rooms, acks and automatic reconnection. Scale out with a Redis adapter.", [6000, 3, 1, 60], false],
  sse: ["websocketGateway", "Open source", "SSE (Server-Sent Events)", "One-way server → browser stream", "Plain HTTP response that stays open while the server pushes events: live feeds, notifications, and streaming LLM tokens token-by-token. Simpler than WebSockets (auto-reconnect, works through proxies) but one-directional.", [10000, 2, 1, 40], false],
  pusher: ["websocketGateway", "SaaS", "Pusher Channels", "Hosted realtime pub/sub", "Managed WebSocket channels: publish from your server and clients receive instantly.", [10000, 30, 1, 100], true],
  // Coordination
  etcd: ["zookeeper", "Open source", "etcd", "Raft key-value store", "Consistent key-value store (Kubernetes' brain) with leases and watches for locks and leader election. Needs a quorum: run 3 or 5.", [10000, 4, 3, 80], false],
  // Delivery
  github: ["codeRepo", "SaaS", "GitHub", "Git hosting + pull requests", "Hosts your Git repository. Every push or merged pull request can trigger GitHub Actions to build and deploy.", [0, 0, 1, 20], true],
  gitlab: ["codeRepo", "SaaS", "GitLab", "Git hosting + built-in CI", "Git hosting with merge requests and an integrated CI/CD system.", [0, 0, 1, 20], true],
  bitbucket: ["codeRepo", "SaaS", "Bitbucket", "Git hosting (Atlassian)", "Git hosting that integrates with Jira and Bitbucket Pipelines.", [0, 0, 1, 15], true],
  githubActions: ["ciPipeline", "SaaS", "GitHub Actions", "CI/CD workflows", "Workflows triggered by pushes and pull requests: compile, test, build a Docker image, push it, deploy.", [0, 0, 1, 15], true],
  jenkins: ["ciPipeline", "Open source", "Jenkins", "Self-hosted CI server", "Classic self-hosted automation server with pipelines defined in a Jenkinsfile.", [0, 0, 1, 40], true],
  dockerBuild: ["ciPipeline", "Open source", "Docker Build", "Compile + package an image", "Builds your code inside a container from a Dockerfile: install dependencies, compile, run tests, then package the result into a small runtime image (multi-stage build).", [0, 0, 1, 10], true],
  argocd: ["ciPipeline", "Open source", "Argo CD", "GitOps deploys to Kubernetes", "Watches Git for the desired state and syncs it to Kubernetes clusters. Deploys are pull-based and auditable.", [0, 0, 1, 20], true],
  dockerHub: ["containerRegistry", "SaaS", "Docker Hub", "Public/private image registry", "The default registry for Docker images.", [0, 0, 1, 10], true],
  ecr: ["containerRegistry", "AWS", "AWS ECR", "AWS image registry", "Elastic Container Registry: private images for ECS, EKS and Lambda, with vulnerability scanning.", [0, 0, 1, 10], true],
  // Operations
  prometheus: ["monitoring", "Open source", "Prometheus + Grafana", "Metrics and dashboards", "Self-hosted metrics scraping, alerting and dashboards.", [0, 0, 1, 40], true],
  datadog: ["monitoring", "SaaS", "Datadog", "Metrics, logs, traces", "Hosted observability: metrics, logs, APM traces and alerting in one place.", [0, 0, 1, 150], true],
  sentry: ["monitoring", "SaaS", "Sentry", "Errors + performance", "Captures exceptions and slow transactions with stack traces and releases.", [0, 0, 1, 30], true],
  cloudwatch: ["monitoring", "AWS", "AWS CloudWatch", "AWS metrics + alarms", "AWS's built-in metrics, logs and alarms.", [0, 0, 1, 50], true],
};

function serviceSpec(kind: ServiceKind, row: ServiceRow): ComponentSpec {
  const [behavior, vendor, label, short, description, d, managed, group] = row;
  const base = BASE[behavior];
  const [capacity, latencyMs, replicas, costPerReplica, cacheSizeGb] = d;
  return {
    kind,
    behavior,
    vendor,
    ...(group ? { group } : {}),
    label,
    short,
    description,
    simBehavior: `Simulated as a ${base.label}. ${base.simBehavior}${managed && !base.inherentlyRedundant ? " Managed and multi-zone, so never a single point of failure." : ""}`,
    defaults: {
      capacity,
      latencyMs,
      replicas,
      costPerReplica,
      ...(behavior === "cache" ? { cacheSizeGb: cacheSizeGb ?? base.defaults.cacheSizeGb } : {}),
    },
    inherentlyRedundant: managed || base.inherentlyRedundant,
    unlimited: base.unlimited,
    ...(base.includes ? { includes: base.includes } : {}),
  };
}

export const CATALOG = {
  ...Object.fromEntries(Object.entries(BASE).map(([k, spec]) => [k, { ...spec, behavior: k as BaseKind }])),
  ...Object.fromEntries(Object.entries(SERVICES).map(([k, row]) => [k, serviceSpec(k as ServiceKind, row)])),
  custom: {
    kind: "custom",
    behavior: "appServer",
    label: "Custom Component",
    short: "Your own service",
    description: "Anything that isn't in the palette. Name it, choose which building block it behaves like, then set its capacity, latency and cost.",
    simBehavior: "Simulated as whichever building block you pick under \"Behaves like\".",
    defaults: { capacity: 1500, latencyMs: 15, replicas: 1, costPerReplica: 70, behavior: "appServer" },
    inherentlyRedundant: false,
    unlimited: false,
  },
} as Record<NodeKind, ComponentSpec>;

/** Building blocks a custom component can behave like (everything except the traffic source). */
export const CUSTOM_BEHAVIORS = (Object.keys(BASE) as BaseKind[]).filter((k) => k !== "client");

/** The spec a specific node runs with. Same as CATALOG[kind], except custom nodes take the behavior they picked. */
export function nodeSpec(n: { kind: NodeKind; config: NodeConfig }): ComponentSpec {
  const spec = CATALOG[n.kind];
  if (n.kind !== "custom") return spec;
  const behavior = n.config.behavior && n.config.behavior in BASE && n.config.behavior !== "client" ? n.config.behavior : "appServer";
  const base = BASE[behavior];
  return { ...spec, behavior, unlimited: base.unlimited, simBehavior: `Simulated as a ${base.label}. ${base.simBehavior}` };
}

/** Like isKindAllowed, but custom nodes are judged by the behavior they picked. */
export function isNodeAllowed(n: { kind: NodeKind; config: NodeConfig }, allowed: ReadonlySet<NodeKind>): boolean {
  return n.kind === "custom" ? allowed.has(nodeSpec(n).behavior) : isKindAllowed(n.kind, allowed);
}

/** Bundled components that also count as the building blocks they contain (for objectives). */
export const BUNDLES: Partial<Record<BaseKind, readonly BaseKind[]>> = {
  appGateway: ["loadBalancer", "apiGateway", "rateLimiter"],
};

/** True if a component with this behavior satisfies a request for any of `wanted`. */
export function behaviorSatisfies(behavior: BaseKind, wanted: ReadonlySet<BaseKind>): boolean {
  return wanted.has(behavior) || (BUNDLES[behavior]?.some((b) => wanted.has(b)) ?? false);
}

/** The generic behavior a component runs as. */
export function behaviorOf(kind: NodeKind): BaseKind {
  return CATALOG[kind].behavior;
}

/** True if `kind` is allowed by a list of allowed kinds, either directly or through its base behavior. Custom is always offered. */
export function isKindAllowed(kind: NodeKind, allowed: ReadonlySet<NodeKind>): boolean {
  return kind === "custom" || allowed.has(kind) || allowed.has(behaviorOf(kind));
}

export function defaultConfig(kind: NodeKind): NodeConfig {
  return { ...CATALOG[kind].defaults };
}

# How the simulator works

The simulator lives in `lib/sim`. It is pure TypeScript: no React, no randomness, no I/O. The same design and traffic always give the same result, so it runs identically in the browser and on the server (for verified scores). It is a **teaching model** with realistic orders of magnitude, not a benchmark.

- [Traffic](#traffic)
- [Components and routing](#components-and-routing)
- [Capacity, utilisation and queueing](#capacity-utilisation-and-queueing)
- [Caches](#caches)
- [Databases](#databases)
- [Queues, locks and AI calls](#queues-locks-and-ai-calls)
- [Component settings](#component-settings)
- [Failures and single points of failure](#failures-and-single-points-of-failure)
- [Cost](#cost)
- [The 60-second run](#the-60-second-run)
- [Scoring, tests and hidden tests](#scoring-tests-and-hidden-tests)
- [Graded problems vs the Lab](#graded-problems-vs-the-lab)
- [Server verification](#server-verification)

## Traffic

A traffic profile (`TrafficProfile`) describes the load:

| Field | Meaning |
| --- | --- |
| `rps` | Total requests per second from all clients |
| `staticFraction` | Share that are static files (images, scripts). CDNs absorb these |
| `readRatio` | Of the remaining (dynamic) requests, the share that are reads; the rest are writes |
| `hotKeyFraction` | Share of reads aimed at a few popular items. Drives cache hit ratios |
| `contendedWriteFraction` | Share of writes racing for the same item (a seat, the last unit). Unsafe without a lock |
| `aiFraction` | Share of dynamic requests that call an AI model |

Traffic is split into three classes (**read**, **write**, **static**) and spread evenly across Client nodes.

## Components and routing

Every component runs as one of 26 **building blocks** (`BASE_KINDS` in `lib/sim/types.ts`). Real services such as AWS ALB, Redis or PostgreSQL map to a building block with their own capacity, latency and price (`lib/sim/catalog.ts`).

Each component forwards traffic to the components it's connected to:

- **Front doors** (DNS, load balancers, gateways, rate limiters) spread each class evenly over the next components that accept it. Static traffic prefers a connected CDN.
- **App servers** send **reads** to a cache first, then stores (databases, object storage, search), then other compute. **Writes** go to a write-back cache (if any), then a queue, then databases, then other stores. Static files go to object storage or a CDN. With nothing downstream, the app server answers by itself.
- **Caches** answer hits and send misses on (cache-aside).
- **Queues** acknowledge writes at once and deliver them asynchronously to workers.
- **Stores** (databases, object storage, search) are terminal.

If a preferred tier is down, traffic falls back to the next tier (cache down → database). If nothing can take it, it fails.

## Capacity, utilisation and queueing

Each component has a **capacity per replica** (requests per second) and **replicas**. Utilisation is load ÷ capacity, summed over traffic classes:

```
utilisation = Σ_class load_class / capacity_class
capacity    = capacity per replica × machine size × replicas
```

SQL databases are special: **writes only go to the primary**, so write capacity doesn't grow with read replicas.

Latency rises as a component gets busy:

```
latency = base latency × queueing factor
queueing factor = 1                     (up to 50% busy)
                = 1 + 4 × ((u − 0.5) / 0.5)²   (rising to 5× at 100%)
```

Above 100%, a component serves `1 / utilisation` of its traffic and **drops the rest**: those requests become errors.

## Caches

```
hit ratio = (hot × 0.95 + (1 − hot) × 0.3) × (1 − e^(−GB / 6)) × policy factor     (capped at 98%)
```

- **Hot keys** make caching effective; uniformly random reads mostly miss.
- **Size** helps with diminishing returns (it saturates around 30 GB).
- **Policies** (eviction, TTL, write policy) adjust it; see [Component settings](#component-settings).

Only misses continue to the database: `database reads = reads × (1 − hit ratio)`.

Cache **price** grows with the square root of size: doubling the memory costs about 41% more (8 GB → 32 GB doubles the price).

## Databases

- **Indexes** (`none`, `standard`, `heavy`) multiply read capacity, write capacity and latency. No index means every read is a full scan; heavy indexing speeds reads up and slows every write.
- **Connection pool:** one instance can run at most `max connections × 1000 ÷ latency (ms)` queries a second. With the default 100 connections this is far above any instance's capacity; a tiny pool becomes the bottleneck.
- **NoSQL strong consistency** halves read capacity and adds 25% latency.

## Queues, locks and AI calls

- **Queues** decouple time: the user gets an answer immediately; workers process at their own pace. If nothing consumes the queue, the excess shows up as **backlog**, not errors.
- **Contended writes** from app servers must take a lock first (Redis lock or ZooKeeper). Without one, they count as **unsafe writes** (double bookings). With every lock service down, they fail closed.
- **AI requests**: app servers, serverless functions and workers connected to an LLM make one model call per AI request.

## Component settings

Every setting defaults to a **neutral** value, so designs that don't touch them behave exactly as before. Each is covered by tests in `lib/sim/policies.test.ts`.

| Component | Setting | Effect in the simulation |
| --- | --- | --- |
| Cache | **Eviction**: LRU (default) / LFU / FIFO / random | Hit-ratio factor 1 / 1 + 0.06 × hot / 0.92 / 0.88 |
| Cache | **TTL** (default 1 h) | ≥ 10 min: ×1 · ≥ 1 min: ×0.95 · ≥ 10 s: ×0.85 · shorter: ×0.7 |
| Cache | **Write policy**: cache-aside (default) / write-through / write-back | Write-through and write-back: hit ratio ×1.03. **Write-back** also takes writes first and flushes only 30% of them to the database (batched), at the risk of losing recent writes |
| Database | **Max connections** (default 100) | Caps each instance at `connections × 1000 ÷ latency` queries/s |
| Database | **Indexed columns** | Sets the index level: none (0), standard (1–3), heavy (4+) |
| NoSQL | **Consistency**: eventual (default) / strong | Strong: read capacity ×0.5, latency ×1.25 |
| Load balancer | **Algorithm**: round robin (default) / least connections / IP hash / random | IP hash sends one server 50% more than its share; random 20% more; the others split evenly |
| Load balancer | **Health checks** (default on) | Off: a server that's down keeps getting its share of traffic, and those requests fail |
| App server, serverless, worker, WebSocket gateway | **Autoscaling** (max replicas) | Adds replicas until each runs at about 70%, up to the maximum. Cost counts the replicas running at peak |
| App server, serverless, worker, WebSocket gateway, database, cache | **Machine size**: small / medium (default) / large / x-large | Capacity ×0.5 / 1 / 2 / 4, price ×0.5 / 1 / 2.2 / 4.8 |
| App server, serverless | **Request timeout** (default none) | Requests that would take longer fail fast; latency is capped at the timeout |
| CDN | **Edge TTL** (default: versioned files, forever) | Share served at the edge: 1 day 99% · 1 h 95% · 5 min 88% · 1 min 80% · shorter 60%. Misses go to the origin |

## Failures and single points of failure

To find **single points of failure**, the simulator fails each component in turn (all its replicas) and re-runs the traffic. A component is a SPOF if losing it breaks a large share of requests. Components with two or more replicas (three for ZooKeeper), and managed multi-zone services, survive a single failure.

## Cost

```
monthly cost = Σ price per replica × machine size price × replicas
```

Caches are priced by size (above); autoscaled components count the replicas running at peak. The header shows cost per hour (monthly ÷ 730).

## The 60-second run

**Run** simulates 60 seconds (`lib/sim/timeline.ts`): traffic ramps up to the peak, then holds with small dips. Each second is a steady-state simulation. Latency percentiles (p50, p95, p99) are derived from each second's average latency and how close components are to saturation; requests past the timeout count as errors. Logs record the moments components cross warning and critical levels.

## Scoring, tests and hidden tests

Each problem defines **objectives** (for example *error rate ≤ 1%*, *average latency ≤ 60 ms*, *no single points of failure*, *cost ≤ $1,200/month*). Objectives are grouped into the test cases you see (peak traffic, lose any one component, concurrent writes, requirements check, budget).

The **score** (0–100) is a weighted mix of four categories (weights set per problem):

| Category | How it's scored |
| --- | --- |
| Performance | 60% error rate (0% → full, ≥ 5% → zero) and 40% latency (≤ target → full, ≥ 3× target → zero) |
| Reliability | Minus 35 per single point of failure, plus other resilience checks |
| Cost | Full within budget, falling linearly to zero at 2× the budget |
| Architecture | Uses the building blocks the requirements call for |

**Submit** also runs two **hidden tests** (`lib/challenges/hidden.ts`):

| Test | Traffic change | Passes if |
| --- | --- | --- |
| Viral spike | rps × 1.3 | errors ≤ 5% |
| Cache restart | hot-key share × 0.6 | errors ≤ 20% |

A problem is **solved** when every objective and both hidden tests pass. XP = best score + 50 on the first pass.

Every problem's reference solution is checked in the test suite to pass every objective and both hidden tests within budget, and every starting design must fail.

## Graded problems vs the Lab

In graded problems (challenges, build problems, mock interviews), **capacity, latency and price per replica are locked** to the catalog's numbers (`lockGraph` in `lib/sim/catalog.ts`). You scale with replicas, machine size, settings and architecture. Grading re-applies the lock, so edited saves can't change a score. In the **Lab**, everything is editable.

## Server verification

Signed-in submissions go to `POST /api/grade` (`lib/grading/grade.ts`), which validates the design, applies the lock, re-runs the simulation and hidden tests, and records the result in `verified_scores` (writable only by the server). The leaderboard and public profiles count only these verified results.

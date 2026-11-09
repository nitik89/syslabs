/** Revision cards, each tied to a lesson. Answers are short on purpose: recall first, then read the lesson. */
export interface Flashcard {
  id: string;
  lesson: string;
  front: string;
  back: string;
}

export const FLASHCARDS: Flashcard[] = [
  // Request path & estimation
  { id: "path-stateless", lesson: "request-path", front: "Why should app servers be stateless?", back: "So any server can handle any request: you can add, remove or lose servers freely behind a load balancer." },
  { id: "path-db-first", lesson: "request-path", front: "Which tier usually runs out of capacity first in a simple web app?", back: "The database. App servers scale horizontally; the database holds state and is much harder to scale." },
  { id: "path-spof", lesson: "request-path", front: "What is a single point of failure?", back: "A component whose failure takes down (a large share of) the system, because nothing else can take over its traffic." },
  { id: "est-rps", lesson: "estimation", front: "Average RPS from requests per day?", back: "Requests per day ÷ 86,400 (seconds in a day). 10M/day ≈ 115 req/s." },
  { id: "est-peak", lesson: "estimation", front: "Peak vs average traffic?", back: "Design for the peak, typically 2–10× the average." },
  { id: "est-replicas", lesson: "estimation", front: "How many replicas for a given peak?", back: "Peak RPS ÷ (capacity per replica × 0.8), keeping about 20% headroom." },
  { id: "est-little", lesson: "estimation", front: "Little's law?", back: "Concurrent requests = arrival rate × time in system. 2,000 rps × 0.05 s = 100 in flight." },
  // Caching
  { id: "cache-aside", lesson: "caching", front: "How does cache-aside work?", back: "Read the cache; on a miss, read the database, then write the result into the cache." },
  { id: "cache-hit", lesson: "caching", front: "Database load with a cache in front?", back: "Reads × (1 − hit ratio). A 90% hit ratio cuts read load on the database by 10×." },
  { id: "cache-hot", lesson: "caching", front: "When is a cache nearly useless?", back: "When reads are spread evenly over many keys (no hot keys): most lookups miss." },
  { id: "cache-stampede", lesson: "caching", front: "What is a cache stampede?", back: "Many requests miss the same expired key at once and all hit the database. Fix with request coalescing, locks or staggered TTLs." },
  { id: "cache-invalidate", lesson: "caching", front: "What happens if writes don't touch the cache?", back: "Readers see stale data until the entry expires. Update or delete the cached key on write." },
  // Data
  { id: "idx-scan", lesson: "indexes", front: "What does a missing index cost?", back: "A full table scan per query: cost grows with table size. An index makes it roughly logarithmic." },
  { id: "idx-writes", lesson: "indexes", front: "Downside of many indexes?", back: "Every write must update every index, so inserts and updates get slower." },
  { id: "idx-replicas", lesson: "indexes", front: "Do read replicas fix a slow query?", back: "No. They copy the slow query to more machines. Fix the query or add an index." },
  { id: "rep-writes", lesson: "replication-sharding", front: "Do read replicas help a write-heavy database?", back: "No. Every write still goes to the single primary." },
  { id: "rep-shard", lesson: "replication-sharding", front: "Replication vs sharding?", back: "Replication copies all data (more reads, failover). Sharding splits data so each node takes a share of reads and writes." },
  { id: "rep-key", lesson: "replication-sharding", front: "What makes a good shard key?", back: "One that spreads load evenly and keeps data that's queried together on the same shard." },
  // Traffic & async
  { id: "cdn-what", lesson: "cdn-edge", front: "What belongs on a CDN?", back: "Anything that's the same for everyone: images, JS, CSS, video segments, public pages." },
  { id: "cdn-version", lesson: "cdn-edge", front: "How do you cache static files forever and still deploy?", back: "Version the file names (app.3f2a.js). New deploys reference new names." },
  { id: "q-why", lesson: "queues", front: "Why put a queue between the API and slow work?", back: "The API returns immediately; workers process at their own pace, and bursts become a short backlog instead of errors." },
  { id: "q-backlog", lesson: "queues", front: "When does a queue's backlog grow forever?", back: "When consumers process slower than producers enqueue, on average." },
  { id: "q-idempotent", lesson: "queues", front: "Why must queue consumers be idempotent?", back: "Most queues deliver at least once, so a message can be processed twice." },
  { id: "gw-what", lesson: "gateways-rate-limits", front: "What does an API gateway do?", back: "Single front door: TLS termination, auth, rate limits and routing to services." },
  { id: "gw-429", lesson: "gateways-rate-limits", front: "What should an over-quota request get?", back: "A cheap HTTP 429 (Too Many Requests), rejected at the edge before it costs you anything." },
  { id: "gw-algos", lesson: "gateways-rate-limits", front: "Two common rate-limiting algorithms?", back: "Token bucket and sliding window. Counters live in a fast shared store like Redis." },
  // Coordination
  { id: "lock-race", lesson: "locks", front: "What's the classic double-booking race?", back: "Two servers both check 'seat free', then both write the booking." },
  { id: "lock-lease", lesson: "locks", front: "Why do distributed locks need a timeout (lease)?", back: "So a crashed holder doesn't block everyone forever." },
  { id: "lock-alt", lesson: "locks", front: "Alternatives to a distributed lock?", back: "Database constraints, conditional writes (compare-and-set), or a single writer per key." },
  { id: "q-majority", lesson: "quorum", front: "Majority of an n-node cluster?", back: "⌊n/2⌋ + 1. Three nodes need two, five need three." },
  { id: "q-two", lesson: "quorum", front: "Why is a 2-node ZooKeeper ensemble a bad idea?", back: "Losing one node leaves 1 of 2: no majority, so the whole ensemble stops." },
  { id: "q-odd", lesson: "quorum", front: "Why run 3 or 5 coordination nodes, not 4?", back: "4 nodes tolerate one failure, the same as 3, at higher cost." },
  // Products & advanced
  { id: "req-fr-nfr", lesson: "requirements", front: "Functional vs non-functional requirements?", back: "Functional: what the system does. Non-functional: how well (scale, latency, availability, cost)." },
  { id: "req-trace", lesson: "requirements", front: "How do you know a component belongs in the design?", back: "You can name the requirement it serves. If you can't, remove it." },
  { id: "fan-write", lesson: "fan-out", front: "Fan-out on write: pro and con?", back: "Cheap reads (feeds precomputed), expensive writes, especially for accounts with millions of followers." },
  { id: "fan-hybrid", lesson: "fan-out", front: "How do real feeds handle celebrities?", back: "Hybrid: push for normal accounts, pull for the few huge ones at read time." },
  { id: "idem-key", lesson: "idempotency", front: "How do idempotency keys prevent double charges?", back: "The server stores the result under the client's key; a retry with the same key returns the stored result." },
  { id: "idem-intent", lesson: "idempotency", front: "What should you record before calling a payment provider?", back: "The payment intent, so you can reconcile if the call times out or the process crashes." },
  // More foundations
  { id: "cons-ryw", lesson: "consistency", front: "What is a read-your-writes violation?", back: "A user writes, then reads from a replica that hasn't caught up and doesn't see their own change." },
  { id: "cons-cap", lesson: "consistency", front: "CAP during a network partition?", back: "Choose availability (serve possibly stale data) or consistency (refuse some requests). You can't have both." },
  { id: "cons-when", lesson: "consistency", front: "Which data needs strong consistency?", back: "Money, inventory, permissions. Feeds, counters and recommendations can be eventual." },
  { id: "ch-why", lesson: "consistent-hashing", front: "Why not shard with hash(key) mod N?", back: "Changing N remaps almost every key. Consistent hashing moves only a small slice." },
  { id: "ch-vnodes", lesson: "consistent-hashing", front: "What are virtual nodes for?", back: "Many ring positions per server even out load across uneven key distributions." },
  { id: "hot-reads", lesson: "hot-keys", front: "How do you handle a hot read key?", back: "Cache it close to the app, with several cache replicas." },
  { id: "hot-writes", lesson: "hot-keys", front: "How do you handle a hot write key (like a like counter)?", back: "Split it into N sub-keys and sum on read, or buffer writes through a queue and batch them." },
  { id: "api-cursor", lesson: "api-design", front: "Cursor vs offset pagination?", back: "Cursors stay fast on large tables and don't skip or repeat rows when data changes; offsets get slower the deeper you page." },
  { id: "api-get", lesson: "api-design", front: "Can a GET request change state?", back: "No. GETs must be safe: crawlers, prefetchers and retries call them freely." },
  { id: "rt-ws-sse", lesson: "realtime", front: "WebSockets vs Server-Sent Events?", back: "WebSockets are two-way; SSE is one-way server → client over plain HTTP, simpler and proxy-friendly." },
  { id: "rt-pubsub", lesson: "realtime", front: "Why do real-time gateways need pub/sub?", back: "A message must reach every gateway holding a subscriber's connection, not just the one that received it." },
  { id: "ps-queue-topic", lesson: "pubsub", front: "Queue vs topic?", back: "A queue gives each message to one consumer; a topic gives every subscriber its own copy." },
  { id: "ps-facts", lesson: "pubsub", front: "What should an event name describe?", back: "A fact that happened ('order placed'), not a command ('send email')." },
  { id: "saga-comp", lesson: "sagas-outbox", front: "How does a saga undo a failed step?", back: "By running compensating actions in reverse order (refund, release stock), not a database rollback." },
  { id: "saga-outbox", lesson: "sagas-outbox", front: "What problem does the outbox pattern solve?", back: "The dual write: committing to the database and publishing a message as two steps, where one can succeed without the other." },
  { id: "mr-rto-rpo", lesson: "multi-region", front: "RTO vs RPO?", back: "RTO: how long you can be down. RPO: how much recent data you can afford to lose." },
  { id: "mr-active", lesson: "multi-region", front: "Active-passive vs active-active?", back: "Active-passive: one region serves, simple, slower failover. Active-active: all serve, resilient, but write conflicts are possible." },
  { id: "obs-three", lesson: "observability", front: "Metrics vs logs vs traces?", back: "Metrics: that something is wrong. Logs: what happened. Traces: where in the request path it happened." },
  { id: "obs-p99", lesson: "observability", front: "Why alert on p99 rather than average latency?", back: "Averages hide the slowest requests; p99 shows what your unluckiest users feel." },
  { id: "sec-authn-authz", lesson: "security", front: "Authentication vs authorisation?", back: "Authentication: who you are. Authorisation: whether you may do this action." },
  { id: "sec-least", lesson: "security", front: "What is least privilege?", back: "Every service and person gets only the access they need, so a breach can do less damage." },
];

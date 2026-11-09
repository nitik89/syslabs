/**
 * Design foundations: short concept lessons. Each one teaches one idea and links to the problem that practises it.
 */
export interface Lesson {
  id: string;
  title: string;
  /** Roadmap stage id this lesson belongs to. */
  stage: string;
  minutes: number;
  summary: string;
  points: string[];
  ruleOfThumb: string;
  /** Problem id to practise on. */
  practice: string;
}

export const LESSONS: Lesson[] = [
  {
    id: "request-path",
    title: "How a request travels",
    stage: "foundations",
    minutes: 4,
    summary: "Every request crosses DNS, a load balancer, an app server and a database. Each hop adds latency and is a place to fail.",
    points: [
      "DNS turns a name into an address; it is cached, so it rarely shows up in latency.",
      "The load balancer spreads requests across identical app servers and stops sending to unhealthy ones.",
      "App servers should be stateless: any server can handle any request, so you can add or lose one freely.",
      "The database holds the state. It is usually the first thing to run out of capacity.",
      "Latency adds up along the path; a slow hop in the middle slows every request that uses it.",
    ],
    ruleOfThumb: "Draw the path first. Then ask, hop by hop: how many requests per second, and what happens if this one dies?",
    practice: "single-point-of-failure",
  },
  {
    id: "estimation",
    title: "Back-of-envelope estimation",
    stage: "foundations",
    minutes: 5,
    summary: "Turn product numbers (users, actions per day) into requests per second, storage and the number of servers you need.",
    points: [
      "Average RPS = requests per day ÷ 86,400. 10 million a day is about 115 per second.",
      "Design for the peak, usually 2 to 10 times the average.",
      "Split reads from writes: they scale differently and often hit different components.",
      "Replicas needed = peak RPS ÷ (capacity per replica × 0.8), keeping 20% headroom.",
      "Round aggressively. The goal is the right order of magnitude, not three significant figures.",
    ],
    ruleOfThumb: "If two designs differ by less than 2× in your estimate, the estimate can't choose between them. Look at failure modes instead.",
    practice: "url-shortener",
  },
  {
    id: "caching",
    title: "Caching, hit ratio and hot keys",
    stage: "foundations",
    minutes: 5,
    summary: "A cache answers repeated reads from memory so they never reach the database. How much it helps depends on how concentrated reads are.",
    points: [
      "Cache-aside: the app reads the cache first, and on a miss reads the database and fills the cache.",
      "Hit ratio is everything: database load = reads × (1 − hit ratio).",
      "Hot keys (a few items read constantly) make caches shine; uniformly random reads make them nearly useless.",
      "Bigger caches hold more of the working set, with diminishing returns.",
      "Writes must update or invalidate the cached copy, or readers see stale data.",
    ],
    ruleOfThumb: "Before adding a cache, ask: do many reads share a few keys? If not, add read capacity instead.",
    practice: "overloaded-database",
  },
  {
    id: "indexes",
    title: "Indexes: faster reads, slower writes",
    stage: "data",
    minutes: 4,
    summary: "An index lets the database jump to matching rows instead of scanning the table. Every index also has to be updated on every write.",
    points: [
      "Without an index, a lookup reads every row: cost grows with table size.",
      "With one, the lookup is roughly logarithmic: millions of rows cost about the same as thousands.",
      "Each extra index slows inserts and updates, because each one must be maintained.",
      "Adding read replicas copies a slow query; it doesn't make it fast.",
    ],
    ruleOfThumb: "Index the columns in your WHERE and JOIN clauses for hot queries, and nothing else.",
    practice: "missing-index",
  },
  {
    id: "replication-sharding",
    title: "Replication vs sharding",
    stage: "data",
    minutes: 5,
    summary: "Replicas copy all the data to serve more reads. Shards split the data so each node takes a share of the writes.",
    points: [
      "Read replicas help read-heavy systems. Every write still goes to the single primary.",
      "When writes are the bottleneck, replicas don't help; you need to shard, queue, or use a write-optimised store.",
      "Sharding needs a good key: one that spreads load evenly and keeps related data together.",
      "Replication also gives failover: if the primary dies, a replica can take over.",
    ],
    ruleOfThumb: "Read-heavy: replicate and cache. Write-heavy: shard, buffer through a queue, or pick a database built for writes.",
    practice: "write-storm",
  },
  {
    id: "cdn-edge",
    title: "CDNs and the edge",
    stage: "traffic",
    minutes: 3,
    summary: "A CDN serves static files (images, scripts, styles) from servers near the user, so that traffic never reaches your app.",
    points: [
      "Static assets are often most of the requests on a page, and all of them are cacheable.",
      "Serving them from the edge cuts latency for users and load on your servers.",
      "Version file names (app.3f2a.js) so you can cache them forever and still deploy changes.",
    ],
    ruleOfThumb: "If a response is the same for everyone, it belongs on a CDN.",
    practice: "image-heavy-homepage",
  },
  {
    id: "queues",
    title: "Queues, workers and backpressure",
    stage: "traffic",
    minutes: 5,
    summary: "A queue lets the request path accept work instantly and hand the slow part to background workers.",
    points: [
      "Producers enqueue and return; consumers (workers) process at their own pace.",
      "Queues absorb spikes: a burst becomes a short backlog instead of errors.",
      "If consumers are slower than producers on average, the backlog grows forever. Size workers for the peak.",
      "Work may be delivered twice, so make handlers idempotent.",
    ],
    ruleOfThumb: "Anything the user doesn't need to wait for (emails, thumbnails, fan-out) goes on a queue.",
    practice: "inbox-never-drains",
  },
  {
    id: "gateways-rate-limits",
    title: "Gateways and rate limiting",
    stage: "traffic",
    minutes: 4,
    summary: "A gateway is the single front door: it terminates TLS, checks auth, applies rate limits and routes to services.",
    points: [
      "Rate limits protect everyone from one noisy client: excess requests get a cheap HTTP 429.",
      "Token bucket and sliding window are the common algorithms; counters live in a fast shared store.",
      "The front door carries all traffic, so it must be redundant and sized for the peak.",
    ],
    ruleOfThumb: "Reject early and cheaply: the closer to the edge a bad request dies, the less it costs.",
    practice: "api-rate-limiter",
  },
  {
    id: "locks",
    title: "Race conditions and distributed locks",
    stage: "coordination",
    minutes: 5,
    summary: "When two servers check-then-write the same thing at once, both can win. A lock makes the check and the write one step.",
    points: [
      "The classic race: both see 'seat free', both book it.",
      "A distributed lock (Redis, ZooKeeper, etcd) lets one request hold the resource at a time.",
      "Locks need timeouts (leases) so a crashed holder doesn't block everyone forever.",
      "Alternatives: database constraints, conditional writes (compare-and-set), or a single writer per key.",
    ],
    ruleOfThumb: "Nothing erroring doesn't mean nothing is wrong. Look for check-then-act on shared state.",
    practice: "double-booked-seats",
  },
  {
    id: "quorum",
    title: "Consensus and quorums",
    stage: "coordination",
    minutes: 4,
    summary: "Coordination services agree by majority vote. That is what makes them safe, and why their size matters.",
    points: [
      "A majority of n nodes is ⌊n/2⌋ + 1. With 3 nodes, 2 must agree.",
      "3 nodes survive 1 failure; 5 survive 2. 2 nodes survive none: losing one loses the majority.",
      "Even sizes add cost without adding fault tolerance.",
    ],
    ruleOfThumb: "Run coordination clusters with 3 or 5 nodes, never 2 or 4.",
    practice: "lost-quorum",
  },
  {
    id: "requirements",
    title: "Functional vs non-functional requirements",
    stage: "products",
    minutes: 4,
    summary: "Functional requirements say what the system does. Non-functional ones say how well: scale, latency, availability, cost.",
    points: [
      "Functional: 'users can post a photo', 'users see a feed'. These decide your components and APIs.",
      "Non-functional: '10k req/s', 'p99 under 200 ms', 'no single point of failure', 'under $3k a month'. These decide sizes and redundancy.",
      "Ask for both before drawing anything, then estimate the numbers.",
      "Every design choice should trace back to at least one requirement.",
    ],
    ruleOfThumb: "If you can't name the requirement a component serves, delete it.",
    practice: "shopping-app",
  },
  {
    id: "fan-out",
    title: "Fan-out on write vs on read",
    stage: "advanced",
    minutes: 5,
    summary: "A feed can be built when a post is written (push to every follower) or when it's read (pull from everyone you follow).",
    points: [
      "Fan-out on write makes reads cheap but writes expensive, especially for celebrities with millions of followers.",
      "Fan-out on read keeps writes cheap but makes every feed load gather from many sources.",
      "Real systems mix them: push for normal accounts, pull for the few huge ones.",
    ],
    ruleOfThumb: "Optimise for the operation that happens most, then patch the outliers.",
    practice: "social-feed",
  },
  {
    id: "idempotency",
    title: "Idempotency and payments",
    stage: "advanced",
    minutes: 4,
    summary: "Networks retry. An idempotent operation gives the same result however many times it runs, so retries can't double-charge.",
    points: [
      "Clients send an idempotency key with each payment; the server stores the result under that key.",
      "A retry with the same key returns the stored result instead of charging again.",
      "Record the intent before calling the payment provider, and reconcile afterwards.",
    ],
    ruleOfThumb: "Any operation that moves money or sends a message must be safe to retry.",
    practice: "payments",
  },
];

export const getLesson = (id: string) => LESSONS.find((l) => l.id === id);

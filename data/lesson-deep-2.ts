import type { LessonDeep } from "./lesson-deep";

/** In-depth content for the product, coordination and advanced lessons. */
export const DEEP_2: Record<string, LessonDeep> = {
  requirements: {
    sections: [
      {
        heading: "Two kinds of requirement",
        body: [
          "Functional requirements are features: 'users can post a photo', 'users see a feed of people they follow'. They decide which components and APIs exist.",
          "Non-functional requirements are qualities with numbers: peak requests per second, read/write mix, p99 latency, availability (99.9% is about 43 minutes of downtime a month), durability, consistency needs and budget. They decide how big, how redundant and how clever each component must be.",
        ],
      },
      {
        heading: "Turning them into design decisions",
        body: [
          "'p99 under 200 ms for the feed' pushes you towards precomputed feeds and caching. '99.99% available' means no single points of failure and probably multiple zones. 'Never double-charge' means idempotency and strong consistency on payments. 'Under $2,000 a month' rules out over-provisioning.",
          "Scope ruthlessly. In an interview, pick 3–4 core features and say what you are not designing (admin tools, analytics) so the time goes to the hard parts.",
        ],
      },
    ],
    example: {
      title: "Requirements for a URL shortener",
      steps: [
        "Functional: create a short link; redirect to the long URL; optional custom alias and expiry.",
        "Scale: 100 million new links a month (≈ 40/s), 100:1 read/write → about 4,000 redirects/s, peaks of 12,000/s.",
        "Latency: redirects under 50 ms at p99. Availability: 99.99%, because a broken redirect breaks other people's pages.",
        "Design consequences: cache hot links, replicate reads, generate ids without coordination, and keep writes simple.",
      ],
    },
    tradeoffs: [
      { option: "Strong consistency", pros: "Everyone sees the latest data", cons: "Higher latency; less available during partitions" },
      { option: "Higher availability target", pros: "Fewer outages", cons: "Every extra nine costs more redundancy and complexity" },
      { option: "Tighter latency target", pros: "Snappier product", cons: "More caching, precomputation and cost" },
    ],
    mistakes: [
      "Vague non-functional requirements like 'fast' and 'scalable' that can't drive any decision.",
      "Designing every feature you can think of instead of the core 3–4.",
      "Forgetting cost: a design that meets every number at 10× the budget isn't a solution.",
    ],
    interview: [
      "Spend the first few minutes on requirements and write the numbers down.",
      "Confirm read/write ratio and peak load; they shape everything after.",
      "Point back to a requirement whenever you add a component.",
    ],
  },

  "fan-out": {
    sections: [
      {
        heading: "Push: fan-out on write",
        body: [
          "When someone posts, a background job inserts the post id into every follower's precomputed feed (often a capped list in Redis). Reading a feed is then one fast lookup.",
          "The cost lands on writes: a post by someone with 1,000 followers is 1,000 inserts. For an account with 50 million followers it's 50 million inserts per post, which is slow and wasteful when most followers never open the app that day.",
        ],
      },
      {
        heading: "Pull: fan-out on read",
        body: [
          "When someone opens their feed, the service fetches recent posts from everyone they follow and merges them. Writes are cheap (one insert), but each read touches many authors and must sort and merge, so reads are slower and repeated for every refresh.",
          "The hybrid most large feeds use: push for normal accounts, pull for celebrities. At read time, merge the precomputed feed with the latest posts from the few big accounts you follow.",
        ],
      },
    ],
    example: {
      title: "Sizing a push feed",
      steps: [
        "100 million daily users; 10 million posts a day; the average account has 200 followers.",
        "Push: 10M × 200 = 2 billion feed inserts a day ≈ 23,000 inserts/s on average.",
        "A celebrity with 30M followers posting 5 times a day adds 150 million inserts on their own: switch them to pull.",
        "Reads: 100M users × 10 feed opens ≈ 11,600 reads/s, each a single cache lookup with push.",
      ],
    },
    tradeoffs: [
      { option: "Push (on write)", pros: "Very fast reads", cons: "Heavy writes; celebrity posts explode; storage per follower" },
      { option: "Pull (on read)", pros: "Cheap writes; always fresh", cons: "Slow, expensive reads for people who follow many accounts" },
      { option: "Hybrid", pros: "Fast reads without celebrity blow-ups", cons: "Two code paths to build and keep consistent" },
    ],
    mistakes: [
      "Pure push with no special case for very large accounts.",
      "Pure pull for a read-heavy product, recomputing the same feed on every refresh.",
      "Doing the fan-out inside the post request instead of in background workers.",
    ],
    interview: [
      "Compare the read and write rates first, then choose which side to make cheap.",
      "Bring up the celebrity problem yourself and propose the hybrid.",
      "Put fan-out on a queue so posting stays fast.",
    ],
  },

  idempotency: {
    sections: [
      {
        heading: "Why retries are unavoidable",
        body: [
          "A timeout doesn't tell the client whether the request failed or only the response was lost. Clients, load balancers and SDKs all retry. Without protection, 'charge $50' retried after a lost response charges $100.",
          "Some operations are naturally idempotent: setting a value (PUT, 'set status = shipped') or deleting by id. Adding or appending (POST, 'add $50') is not.",
        ],
      },
      {
        heading: "Idempotency keys",
        body: [
          "The client generates a unique key per logical operation (a UUID) and sends it with every attempt. The server stores key → result. If the key is new, it does the work and saves the result in the same transaction; if the key was seen, it returns the saved result without doing anything.",
          "Keys need a lifetime (often 24 hours) and must be scoped to the caller. Concurrent retries with the same key should wait for or join the first attempt rather than run in parallel.",
          "The same idea makes queue consumers safe: record processed message ids and skip duplicates.",
        ],
      },
    ],
    example: {
      title: "A lost payment response",
      steps: [
        "Client sends POST /charges with Idempotency-Key: abc, amount $50.",
        "Server charges the card, stores abc → charge #81, then the response is lost to a network blip.",
        "Client times out and retries with the same key abc.",
        "Server finds abc, returns charge #81 again, and does not contact the card network. The customer is charged once.",
      ],
    },
    tradeoffs: [
      { option: "Idempotency keys", pros: "Safe retries for any operation", cons: "Key storage and expiry to manage" },
      { option: "Natural idempotency (PUT, set)", pros: "Nothing to store", cons: "Not every operation can be phrased that way" },
      { option: "Exactly-once infrastructure", pros: "Sounds ideal", cons: "Rarely truly end-to-end; you still need idempotent effects" },
    ],
    mistakes: [
      "Generating the key on the server, so each retry gets a new one.",
      "Saving the key and doing the work in separate steps, so a crash between them breaks the guarantee.",
      "Assuming the message queue's 'exactly once' covers your side effects.",
    ],
    interview: [
      "Any time money moves or a message is sent, say how retries are made safe.",
      "Describe where keys are stored, how long they live, and what a duplicate returns.",
      "Link it to at-least-once queues: consumers need the same treatment.",
    ],
  },

  consistency: {
    sections: [
      {
        heading: "Strong versus eventual",
        body: [
          "Strong consistency: once a write is confirmed, every read sees it. Usually means reading from the primary or waiting for a quorum, which costs latency.",
          "Eventual consistency: replicas converge, but a read may briefly return an older value. Cheaper and more available, and fine for counts, feeds and recommendations.",
          "Useful middle grounds: read-your-own-writes (a user always sees their own changes, e.g. route their reads to the primary briefly) and monotonic reads (a user never sees time go backwards).",
        ],
      },
      {
        heading: "CAP in one paragraph",
        body: [
          "During a network partition you must choose: refuse some requests to stay consistent (CP), or keep answering with possibly stale data (AP). When there's no partition you still trade latency against consistency (the 'PACELC' refinement). Choose per feature, not per company.",
        ],
      },
    ],
    example: {
      title: "Choosing per feature in a shop",
      steps: [
        "Product page view counts: eventual. Off by a few for a second is fine.",
        "Product reviews: eventual, with read-your-own-writes so a reviewer sees their own review.",
        "Inventory at checkout: strong. Read and decrement on the primary with a conditional write.",
        "Payment status: strong, plus idempotency for retries.",
      ],
    },
    tradeoffs: [
      { option: "Strong", pros: "Simple to reason about; no anomalies", cons: "Slower; less available during partitions" },
      { option: "Eventual", pros: "Fast, available, scales reads", cons: "Stale reads; the app must tolerate them" },
      { option: "Read-your-own-writes", pros: "Users never miss their own changes", cons: "Routing logic; some load back on the primary" },
    ],
    mistakes: [
      "Using eventual consistency for balances or stock levels.",
      "Requiring strong consistency everywhere and paying the latency for features that don't need it.",
      "Forgetting that caches are an eventually consistent copy too.",
    ],
    interview: [
      "Go feature by feature: what can be stale, and for how long?",
      "Mention replication lag and how a user sees their own writes.",
      "Bring up CAP only to justify a concrete choice.",
    ],
  },

  "consistent-hashing": {
    sections: [
      {
        heading: "The problem with mod N",
        body: [
          "Sharding with shard = hash(key) mod N works until N changes. Going from 4 to 5 shards changes the result for about 80% of keys, so almost all data moves at once: a huge migration, or a cache that suddenly misses everything.",
        ],
      },
      {
        heading: "The ring",
        body: [
          "Hash both nodes and keys onto the same circle of values. Each key belongs to the first node clockwise from it. Adding a node takes over only the keys between it and its predecessor, about 1/N of the data; removing a node hands its keys to the next one.",
          "Virtual nodes: each physical node is placed at many points (say 100–200) on the ring. That evens out the share each node gets and spreads a departing node's load across many others instead of one neighbour.",
          "Used by DynamoDB-style databases, Cassandra, memcached client libraries and many load balancers.",
        ],
      },
    ],
    example: {
      title: "Adding a cache node",
      steps: [
        "A cache cluster has 4 nodes and 10 million keys.",
        "With mod N, going to 5 nodes remaps about 8 million keys: the hit ratio collapses and the database is flooded.",
        "With consistent hashing, about 2 million keys (1/5) move to the new node; the other 8 million stay where they are.",
        "The hit ratio dips slightly and recovers as the new node fills.",
      ],
    },
    tradeoffs: [
      { option: "hash mod N", pros: "Trivial, perfectly even", cons: "Changing N reshuffles almost everything" },
      { option: "Consistent hashing", pros: "Only ~1/N of keys move", cons: "Needs virtual nodes for balance" },
      { option: "Lookup directory", pros: "Full control over placement", cons: "Extra service to run and keep available" },
    ],
    mistakes: [
      "Using mod N for a cache or database that scales up and down.",
      "No virtual nodes, so shares are uneven and one neighbour takes all of a failed node's load.",
      "Thinking consistent hashing fixes hot keys: it spreads keys, not traffic to one key.",
    ],
    interview: [
      "Explain why mod N breaks when nodes change, then draw the ring.",
      "Mention virtual nodes for balance.",
      "Say what happens on node failure: its keys move to the next node.",
    ],
  },

  "hot-keys": {
    sections: [
      {
        heading: "Even data, uneven traffic",
        body: [
          "Hashing spreads keys evenly, but it can't spread traffic to a single key. A celebrity's profile, a viral link or a live match score can get most of the reads, and every one of them lands on the one shard that owns that key.",
          "Signs: one shard at 100%+ while the others idle, rising latency for unrelated keys on that shard, and cache hit ratios that look fine on average.",
        ],
      },
      {
        heading: "Fixes for reads and for writes",
        body: [
          "Hot reads: cache the key (including a small in-process cache on app servers for a second or two), and replicate it to several nodes so reads spread out.",
          "Hot writes: split the key into sub-keys (likes:post42#1 … #8), write to a random one, and sum them on read; or batch increments in memory and flush once a second.",
          "Detect hot keys by sampling traffic, so you can treat them specially before they melt a shard.",
        ],
      },
    ],
    example: {
      title: "A live scoreboard",
      steps: [
        "2 million viewers poll the same match key once per second: 2 million reads/s on one shard that handles 50,000.",
        "Cache it at the edge or in app memory with a 1-second TTL: the shard sees about one read per second per app server.",
        "Score updates are a few writes per minute: no write fix needed.",
        "A 'like' counter on the same match gets 50,000 writes/s: split it across 16 sub-keys and sum them on read.",
      ],
    },
    tradeoffs: [
      { option: "Cache the hot key", pros: "Removes most read load", cons: "Slightly stale values" },
      { option: "Split the key", pros: "Spreads writes across shards", cons: "Reads must merge the parts" },
      { option: "Batch writes", pros: "Fewer, larger writes", cons: "Loses a little on crash; delay before visible" },
    ],
    mistakes: [
      "Adding more shards: the hot key still lives on one of them.",
      "Watching only average load, which hides one overloaded shard.",
      "Putting celebrity and normal accounts through the same path with no special handling.",
    ],
    interview: [
      "Ask 'is any single key hot?' whenever you shard.",
      "Separate the read fix (cache, replicate) from the write fix (split, batch).",
      "Mention detection: you need to know a key is hot to treat it specially.",
    ],
  },

  "api-design": {
    sections: [
      {
        heading: "Predictable resources",
        body: [
          "Use nouns and standard verbs: GET /v1/orders/123, POST /v1/orders, PATCH /v1/orders/123. Return consistent status codes (201 created, 400 bad input, 404 not found, 409 conflict, 429 slow down) and one error shape everywhere.",
          "Version from day one (/v1 in the path or a header) so you can change things without breaking old clients.",
        ],
      },
      {
        heading: "Pagination, retries and limits",
        body: [
          "Cursor pagination (?cursor=abc&limit=50, returning next_cursor) stays correct while rows are inserted, and is fast because it seeks to a position. Offset pagination (?page=200) gets slower with depth and skips or repeats items when data changes.",
          "Make writes safe to retry with idempotency keys, and say which endpoints are rate-limited and how (429 with Retry-After).",
          "Keep responses lean and allow field selection or expansion where clients need different shapes, instead of many near-duplicate endpoints.",
        ],
      },
    ],
    example: {
      title: "An orders API",
      steps: [
        "GET /v1/orders?limit=50 → 50 orders and next_cursor = 'o_9f2'.",
        "GET /v1/orders?cursor=o_9f2&limit=50 → the next 50, unaffected by orders created meanwhile.",
        "POST /v1/orders with Idempotency-Key: k1 → 201 and the order. A retry with k1 returns the same order, not a second one.",
        "A client that sends 200 req/s gets 429 with Retry-After: 2.",
      ],
    },
    tradeoffs: [
      { option: "REST", pros: "Simple, cacheable, universal", cons: "Over- or under-fetching for complex screens" },
      { option: "GraphQL", pros: "Clients ask for exactly what they need", cons: "Harder caching and rate limiting; costly queries" },
      { option: "gRPC", pros: "Fast, typed, streaming between services", cons: "Less friendly for browsers and public APIs" },
    ],
    mistakes: [
      "Offset pagination on large, changing tables.",
      "Non-idempotent POSTs with no key, so mobile retries create duplicates.",
      "Breaking changes without a version, breaking every existing client.",
    ],
    interview: [
      "Write 3–5 core endpoints with request and response shapes early.",
      "Show cursor pagination for any list.",
      "Mention idempotency keys on writes and rate limits on the public API.",
    ],
  },

  realtime: {
    sections: [
      {
        heading: "Holding connections",
        body: [
          "WebSockets (or server-sent events) keep a connection open so the server can push messages instantly. A tuned gateway holds tens of thousands to hundreds of thousands of idle connections; 10 million online users need on the order of 100–200 gateway instances.",
          "Gateways should do little else: authenticate on connect, keep heartbeats, forward messages. Keep the business logic in separate services so gateways can be scaled and restarted independently.",
        ],
      },
      {
        heading: "Routing messages to the right gateway",
        body: [
          "A user is connected to one particular gateway. When a message for them arrives, something must know where they are. Common pattern: every gateway subscribes to pub/sub channels for the rooms or users it holds; the chat service publishes to the channel and only the relevant gateways receive it.",
          "Messages are also saved to a database so offline users get them on reconnect, and clients resume from the last message id they saw.",
        ],
      },
    ],
    example: {
      title: "A group message",
      steps: [
        "Alice sends 'hi' to room 42 over her WebSocket to gateway 1.",
        "Gateway 1 forwards it to the chat service, which saves it (id 9001) and publishes to channel room:42.",
        "Gateways 1 and 7 hold members of room 42; both receive the publish and push it down their sockets.",
        "Bob was offline; when he reconnects he asks for messages after his last id and gets 9001.",
      ],
    },
    tradeoffs: [
      { option: "WebSockets", pros: "Two-way, low latency", cons: "Stateful connections to scale and rebalance" },
      { option: "Server-sent events", pros: "Simple, works over HTTP", cons: "Server-to-client only" },
      { option: "Polling", pros: "Stateless and simple", cons: "Wasteful and slower; heavy at scale" },
    ],
    mistakes: [
      "Putting business logic in the connection gateways.",
      "No persistence, so offline users lose messages.",
      "Broadcasting every message to every gateway instead of only those with subscribers.",
    ],
    interview: [
      "Separate the connection layer, the messaging layer and storage.",
      "Estimate concurrent connections and gateways needed.",
      "Explain how a message finds the recipient's gateway, and what happens when they're offline.",
    ],
  },

  pubsub: {
    sections: [
      {
        heading: "Events, not calls",
        body: [
          "Instead of the order service calling email, inventory and analytics one by one (and waiting for all of them), it publishes one event: OrderPlaced. Each interested service subscribes and reacts on its own schedule.",
          "The publisher doesn't know who listens. Adding fraud checks next month means adding a subscriber, with no change to the order service. A slow or broken consumer doesn't slow checkout.",
        ],
      },
      {
        heading: "Designing good events",
        body: [
          "Publish facts in the past tense (OrderPlaced, PaymentFailed) with the data consumers need and an event id for de-duplication.",
          "Delivery is usually at least once and ordered only per key, so consumers must be idempotent and must not assume a global order.",
          "Version event schemas and only add fields, so old consumers keep working.",
        ],
      },
    ],
    example: {
      title: "Checkout with events",
      steps: [
        "Before: checkout called 4 services in sequence, 600 ms total, and failed if any was down.",
        "After: checkout writes the order, publishes OrderPlaced and returns in 40 ms.",
        "Email, inventory, analytics and loyalty consume it independently; loyalty was down for 10 minutes and caught up afterwards.",
      ],
    },
    tradeoffs: [
      { option: "Direct calls", pros: "Simple; immediate result", cons: "Coupled, slow, failures cascade" },
      { option: "Pub/sub events", pros: "Decoupled, fast, easy to extend", cons: "Eventual; harder to trace end to end" },
      { option: "Commands on a queue", pros: "One worker does a known job", cons: "Producer still knows who must act" },
    ],
    mistakes: [
      "Publishing commands ('SendEmail') that couple the publisher to a consumer.",
      "Consumers that assume exactly-once or perfect ordering.",
      "Publishing after the database commit as a separate step, losing events on crash (see the outbox lesson).",
    ],
    interview: [
      "Identify side effects that don't need to finish before responding, and move them to events.",
      "Say how consumers handle duplicates and ordering.",
      "Mention tracing (a correlation id on the event) for debugging.",
    ],
  },

  "sagas-outbox": {
    sections: [
      {
        heading: "Sagas",
        body: [
          "When an operation spans services (order, payment, inventory, shipping), there is no single database transaction. A saga runs a sequence of local transactions, each in one service. If a step fails, it runs compensating actions for the steps already done: refund the payment, cancel the order.",
          "Orchestration: a coordinator tells each service what to do next and tracks state; easy to follow. Choreography: each service reacts to the previous service's event; looser coupling but harder to see the whole flow.",
          "Compensations are business actions, not rollbacks: a refund is a new transaction, and the customer may see both the charge and the refund.",
        ],
      },
      {
        heading: "The outbox",
        body: [
          "Writing to the database and then publishing to a queue as two steps fails when the process crashes in between: the order exists but the event is never sent (or the reverse).",
          "Outbox: in the same database transaction as the business change, insert the event into an outbox table. A relay process reads the outbox and publishes, marking rows as sent. Both happen or neither does; the relay may publish twice, so consumers de-duplicate by event id.",
        ],
      },
    ],
    example: {
      title: "An order that runs out of stock",
      steps: [
        "Create order (pending) → charge card ($80, succeeded) → reserve stock (fails: sold out).",
        "Compensations run in reverse: refund the $80, then mark the order cancelled.",
        "Each step and compensation writes its event to its service's outbox in the same transaction as its data.",
        "Relays publish the events; the customer gets an 'order cancelled, refunded' email.",
      ],
    },
    tradeoffs: [
      { option: "Orchestrated saga", pros: "Flow is explicit and observable", cons: "Coordinator is extra logic to run" },
      { option: "Choreographed saga", pros: "Loosely coupled services", cons: "Flow is implicit; harder to debug" },
      { option: "Two-phase commit", pros: "Atomic across resources", cons: "Blocking, slow, poorly supported across services" },
    ],
    mistakes: [
      "Writing to the database and the queue as separate steps.",
      "No compensation for a step, leaving money taken for orders that will never ship.",
      "Compensations that aren't idempotent, so a retried refund pays out twice.",
    ],
    interview: [
      "When a flow spans services, say 'saga' and list each step's compensation.",
      "Bring up the dual-write problem and the outbox.",
      "Choose orchestration or choreography and justify it.",
    ],
  },

  "multi-region": {
    sections: [
      {
        heading: "Active-passive and active-active",
        body: [
          "Active-passive: one region serves traffic, another holds replicated data and idle or minimal capacity. Failover promotes the standby. Simpler, but failover takes minutes and the standby costs money doing nothing.",
          "Active-active: every region serves traffic for nearby users. Lower latency and instant failover, but concurrent writes in two regions can conflict, so you need either a home region per user or record, or conflict resolution.",
        ],
      },
      {
        heading: "RTO and RPO",
        body: [
          "RTO (recovery time objective) is how long you can be down: it decides how automated failover must be. RPO (recovery point objective) is how much recent data you can lose: with asynchronous replication it's roughly the replication lag, seconds of writes.",
          "Synchronous cross-region replication gives RPO = 0 but adds the inter-region round trip (often 70–150 ms) to every write.",
        ],
      },
    ],
    example: {
      title: "EU region outage",
      steps: [
        "EU and US regions are active-active; each user's data lives in their home region and replicates asynchronously.",
        "The EU region goes down. Health checks fail and geo DNS sends EU users to the US within a minute or two (RTO ≈ 2 minutes).",
        "The last ~2 seconds of EU writes hadn't replicated: that is the RPO.",
        "EU users see higher latency (~100 ms) until the EU region recovers and catches up.",
      ],
    },
    tradeoffs: [
      { option: "Single region, multi-zone", pros: "Simple; survives data-centre failures", cons: "A regional outage takes you down; far users are slow" },
      { option: "Active-passive", pros: "Survives a region; simpler data model", cons: "Idle cost; failover delay" },
      { option: "Active-active", pros: "Lowest latency; instant failover", cons: "Write conflicts; most complex" },
    ],
    mistakes: [
      "Going multi-region before you've made a single region highly available.",
      "Never testing failover, then finding it doesn't work during the outage.",
      "Ignoring data residency rules (EU data staying in the EU).",
    ],
    interview: [
      "Ask for RTO and RPO before choosing a topology.",
      "Explain how users are routed and what happens to in-flight writes in a failover.",
      "Say how write conflicts are avoided (home region) or resolved.",
    ],
  },

  observability: {
    sections: [
      {
        heading: "Three signals",
        body: [
          "Metrics are cheap numbers over time: request rate, error rate, latency percentiles, saturation (CPU, queue depth). They power dashboards and alerts.",
          "Logs are detailed records of events, ideally structured (JSON with request id, user id, error). They tell you what exactly happened to a request.",
          "Traces follow one request across services as a tree of timed spans, so you can see which hop was slow or failed. A trace id passed in headers ties logs and spans together.",
        ],
      },
      {
        heading: "Alerting that helps",
        body: [
          "Alert on symptoms users feel, defined as SLOs: 'p99 latency under 300 ms' or 'error rate under 0.1% over 30 days'. When you are burning the error budget too fast, page someone.",
          "The four golden signals are latency, traffic, errors and saturation. Everything else belongs on dashboards, not pagers.",
        ],
      },
    ],
    example: {
      title: "A checkout slowdown",
      steps: [
        "Metrics: checkout error rate jumps from 0.1% to 4% and p99 from 300 ms to 2.4 s. The SLO alert pages on-call.",
        "Traces: slow requests spend 2.1 s in the call to the payments service.",
        "Logs (filtered by trace id): 'connection pool exhausted' in payments since the 14:05 deploy.",
        "Fix: roll back the deploy. Follow-up: alert on payment pool saturation.",
      ],
    },
    tradeoffs: [
      { option: "Metrics", pros: "Cheap, fast, great for alerts", cons: "No per-request detail" },
      { option: "Logs", pros: "Full detail", cons: "Expensive at volume; hard to correlate without ids" },
      { option: "Traces", pros: "Pinpoint slow hops across services", cons: "Usually sampled; needs instrumentation" },
    ],
    mistakes: [
      "Paging on CPU spikes that users never notice, until people ignore pages.",
      "Logs without a request or trace id, so one request's story can't be followed.",
      "Watching averages, which hide the slow tail that p99 shows.",
    ],
    interview: [
      "Name the SLOs and what you alert on.",
      "Say how you'd find the cause: metrics → traces → logs.",
      "Mention p99, not averages.",
    ],
  },

  security: {
    sections: [
      {
        heading: "Who are you, and may you do this?",
        body: [
          "Authentication proves identity: passwords with a slow hash (bcrypt, argon2), OAuth sign-in, or signed tokens (JWTs) that the gateway can verify without a database call. Short-lived access tokens plus refresh tokens limit the damage of a leak.",
          "Authorisation checks permission on every action, on the server: 'can user 7 read order 123?' Never trust ids or roles sent by the client. Missing object-level checks (IDOR) are one of the most common real-world bugs.",
        ],
      },
      {
        heading: "Defence in depth",
        body: [
          "Encrypt in transit (TLS everywhere, including between services) and at rest (database and backups). Keep secrets in a secrets manager, not in code.",
          "At the edge: a WAF and rate limits stop floods, credential stuffing and scraping. In the app: validate input, use parameterised queries (no SQL injection), and escape output (no XSS).",
          "Least privilege: each service and person gets only the access it needs, so one compromised component can't read everything.",
        ],
      },
    ],
    example: {
      title: "Reading someone else's order",
      steps: [
        "GET /v1/orders/124 is sent by user 7, but order 124 belongs to user 9.",
        "The gateway validates the token: user 7 is authenticated.",
        "The order service checks ownership: order 124's owner is 9, not 7 → 404 (not 403, to avoid confirming it exists).",
        "Without that check, any logged-in user could read every order by counting ids.",
      ],
    },
    tradeoffs: [
      { option: "Session cookies", pros: "Easy to revoke; small", cons: "Server-side session store needed" },
      { option: "JWT access tokens", pros: "Verified without a lookup; scales", cons: "Hard to revoke before expiry; keep them short-lived" },
      { option: "mTLS between services", pros: "Strong service identity", cons: "Certificate management overhead" },
    ],
    mistakes: [
      "Checking that a user is logged in but not that they own the resource.",
      "Long-lived tokens that can't be revoked.",
      "Secrets in source code or logs.",
    ],
    interview: [
      "Separate authentication (gateway) from authorisation (service, per object).",
      "Mention TLS in transit, encryption at rest and a secrets manager.",
      "Add rate limits against credential stuffing on login.",
    ],
  },
};

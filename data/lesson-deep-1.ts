import type { LessonDeep } from "./lesson-deep";

/** In-depth content for the foundations, scaling and traffic lessons. */
export const DEEP_1: Record<string, LessonDeep> = {
  "request-path": {
    sections: [
      {
        heading: "What each hop actually does",
        body: [
          "DNS maps a name to an IP address. Browsers, operating systems and resolvers cache the answer for its TTL (often 60–300 s), so most requests skip DNS entirely. A short TTL lets you move traffic quickly during an incident; a long one means fewer lookups.",
          "The load balancer accepts the TCP/TLS connection and forwards each request to a healthy backend. It runs health checks (for example, GET /health every 5 s) and stops routing to a server after a few failures. Layer 4 balancers forward connections; layer 7 balancers read HTTP and can route by path or header.",
          "App servers run your code. Keeping them stateless (sessions in a cookie, cache or database, never in server memory) is what lets the load balancer send any request anywhere, and lets you add, remove or replace servers freely.",
          "The database holds the state everything else depends on. It is the hardest part to scale because writes must be coordinated, which is why most of the later lessons are about protecting it.",
        ],
      },
      {
        heading: "Latency adds, availability multiplies",
        body: [
          "Each hop's latency adds to the total: 1 ms at the balancer, 15 ms in the app and 8 ms in the database is roughly 24 ms before network time. The slowest hop on the path dominates.",
          "Availability multiplies: three components that are each up 99.9% of the time give a path that is up about 99.7% (0.999³). Redundancy at each hop is how you climb back up: two independent copies at 99.9% are together up 99.9999% of the time.",
        ],
      },
    ],
    example: {
      title: "Finding the single point of failure",
      steps: [
        "Path: users → 1 load balancer → 3 app servers → 1 database.",
        "Lose one app server: the balancer's health check notices within seconds and the other two carry the traffic. Survivable if they have headroom.",
        "Lose the database: every request that needs data fails. It is a single point of failure.",
        "Lose the load balancer: nothing reaches the app. Also a single point of failure, unless it is a managed, multi-zone balancer.",
        "Fix: a standby database replica with automatic failover, and a redundant (or managed) load balancer.",
      ],
    },
    tradeoffs: [
      { option: "Layer 4 load balancer", pros: "Very fast, protocol-agnostic, cheap", cons: "Can't route by URL path, header or cookie" },
      { option: "Layer 7 load balancer", pros: "Routes by path/host, terminates TLS, retries", cons: "More CPU per request, a bit more latency" },
      { option: "Sticky sessions", pros: "Lets stateful apps work behind a balancer", cons: "Uneven load; users lose sessions when a server dies" },
    ],
    mistakes: [
      "Storing sessions in app-server memory, so losing a server logs users out and scaling out breaks logins.",
      "Scaling app servers while the single database is the real bottleneck.",
      "Forgetting the load balancer itself can be a single point of failure.",
    ],
    interview: [
      "Draw the full path before adding anything clever, and narrate requests per second at each hop.",
      "For every box, say what happens when it dies. That's how interviewers check you think about availability.",
      "Mention health checks and statelessness when you introduce the load balancer.",
    ],
  },

  estimation: {
    sections: [
      {
        heading: "The handful of numbers you need",
        body: [
          "A day has 86,400 seconds; round it to 100,000 for mental maths. So 1 million requests a day is about 10–12 per second on average, and 100 million a day is about 1,000–1,200 per second.",
          "Peak traffic is usually 2–5× the daily average (evenings, launches, matches). Size for the peak, not the average.",
          "Storage is records × size × retention. 10 million new rows a day at 1 KB each is 10 GB a day, about 3.6 TB a year before replication (usually ×3).",
          "Bandwidth is requests per second × response size. 5,000 req/s of 200 KB images is 1 GB/s, which is why images belong on a CDN.",
        ],
      },
      {
        heading: "From load to machines",
        body: [
          "Divide peak load by what one server can sustainably do, then keep headroom: running at 70–80% leaves room for spikes and for losing a server. Add at least one spare so a single failure doesn't overload the rest (N+1).",
          "Do the same for the database: reads and writes separately, because replicas add read capacity but not write capacity.",
        ],
      },
    ],
    example: {
      title: "A photo app's upload path",
      steps: [
        "5 million daily users, each uploads 2 photos a day → 10 million uploads a day.",
        "10,000,000 ÷ 86,400 ≈ 116 uploads/s on average; ×3 for peak ≈ 350 uploads/s.",
        "Each photo is about 2 MB → 700 MB/s of upload bandwidth at peak: send uploads straight to object storage, not through app servers.",
        "Storage: 10M × 2 MB = 20 TB a day, about 7 PB a year. That decides object storage over a database.",
        "Metadata: 10M rows a day × 500 bytes = 5 GB a day: easy for a regular database.",
      ],
    },
    tradeoffs: [
      { option: "Size for average load", pros: "Cheapest", cons: "Falls over every evening peak" },
      { option: "Size for peak + headroom", pros: "Survives spikes and a lost server", cons: "Idle capacity most of the day" },
      { option: "Autoscale", pros: "Pays for what you use", cons: "Needs minutes to react; still needs a floor for sudden spikes" },
    ],
    mistakes: [
      "False precision: 2,314.8 req/s instead of 'about 2,000'. The answer only needs the right order of magnitude.",
      "Estimating the average and forgetting the peak multiplier.",
      "Mixing reads and writes into one number, which hides that the write path needs a different design.",
    ],
    interview: [
      "Say your assumptions out loud ('assume 10 million daily users, 20 actions each') so the interviewer can adjust them.",
      "Use the estimate to make a decision, for example 'that's 7 PB a year, so object storage', or skip it.",
      "Round aggressively and keep going; spending 10 minutes on arithmetic is a red flag.",
    ],
  },

  caching: {
    sections: [
      {
        heading: "Cache-aside, step by step",
        body: [
          "The app asks the cache first. On a hit it returns immediately (well under a millisecond from memory). On a miss it reads the database, writes the result into the cache with a TTL, and returns it. The next reader gets a hit.",
          "Writes go to the database, then either delete the cached copy (so the next read refills it) or update it. Deleting is simpler and avoids races where an older value overwrites a newer one.",
        ],
      },
      {
        heading: "What decides the hit ratio",
        body: [
          "Hit ratio is the share of reads served from cache. It depends on skew: if 20% of the items get 80% of the reads, a cache holding that 20% hits about 80% of the time. Uniformly random reads (every item equally likely) make caching nearly useless unless the cache holds almost everything.",
          "Database load after caching is reads × (1 − hit ratio). Going from 90% to 99% hits cuts database reads by another 10×, which is why the last few percent matter.",
          "Eviction policy (usually LRU: least recently used goes first) and size decide which items survive. A cache too small for the hot set thrashes: items are evicted before they're read again.",
        ],
      },
      {
        heading: "Failure modes",
        body: [
          "Stampede: a hot key expires and thousands of requests miss at once and all hit the database. Fix with request coalescing (one request refills, others wait) or by refreshing slightly before expiry.",
          "Cold start: after a restart the cache is empty and every read misses. The database must survive that, or you warm the cache first. SysLab's hidden 'cold cache' test checks exactly this.",
        ],
      },
    ],
    example: {
      title: "Taking pressure off a product database",
      steps: [
        "5,000 reads/s, the database handles 1,000/s. It is at 500%: four in five requests fail.",
        "90% of reads hit a small set of popular products. Add a cache: 4,500 reads/s are hits.",
        "The database now sees 500 misses/s, 50% busy, with room to spare.",
        "Check the cold start: right after a restart the cache hits maybe 50%, so the database briefly sees 2,500/s. Add a read replica or warm the cache so that doesn't fail.",
      ],
    },
    tradeoffs: [
      { option: "Cache-aside", pros: "Simple; only caches what's read", cons: "First read is slow; risk of stale data until TTL or delete" },
      { option: "Write-through", pros: "Cache always fresh after writes", cons: "Every write pays for the cache too; caches unread data" },
      { option: "Short TTL", pros: "Less staleness", cons: "More misses, more database load" },
    ],
    mistakes: [
      "Adding a cache when reads aren't skewed, then wondering why the hit ratio is 20%.",
      "Caching per-user data with a shared key, leaking one user's data to another.",
      "Assuming the cache is always warm and sizing the database for the hit-ratio best case.",
    ],
    interview: [
      "Say what you cache, the key, the TTL and how it's invalidated on write.",
      "Quote the hit ratio you expect and the resulting database load.",
      "Mention stampedes and cold starts before the interviewer asks.",
    ],
  },

  indexes: {
    sections: [
      {
        heading: "How a B-tree index finds a row",
        body: [
          "Most relational indexes are B-trees: sorted, shallow trees where each node is a disk page holding hundreds of keys. A table with 100 million rows needs only 3–4 levels, so finding one row is 3–4 page reads instead of scanning millions.",
          "Because the keys are sorted, a B-tree also serves range queries (created_at between two dates) and ORDER BY without sorting. Hash indexes only do exact matches.",
          "A composite index on (user_id, created_at) serves queries that filter on user_id, or user_id and created_at, but not created_at alone: the leftmost column must be used. Put the column you filter by equality first.",
        ],
      },
      {
        heading: "The write cost",
        body: [
          "Every insert, update or delete must also update every index on the table. Five indexes can turn one write into six page writes, and slow writes and bigger storage follow.",
          "A covering index includes every column a query needs, so the database never reads the table row at all. It is the fastest read, at the cost of a bigger index.",
        ],
      },
    ],
    example: {
      title: "A slow login query",
      steps: [
        "Query: SELECT * FROM users WHERE email = ? on 5 million rows with no index.",
        "The database scans all 5 million rows: hundreds of milliseconds, and it uses CPU that other queries need.",
        "Add a unique index on email: the lookup becomes ~3 page reads, under a millisecond.",
        "Writes to users now also update the email index: a small cost, worth it for the hottest read.",
      ],
    },
    tradeoffs: [
      { option: "No index", pros: "Fastest writes, least storage", cons: "Full scans for every lookup" },
      { option: "Index the hot WHERE columns", pros: "Fast reads where it matters", cons: "Each write updates the index" },
      { option: "Index everything", pros: "Every query is fast", cons: "Slow writes, bloated storage, the planner may pick poorly" },
    ],
    mistakes: [
      "Indexing a low-selectivity column (like a boolean) that matches half the table: the database scans anyway.",
      "Getting composite index order wrong, so the index can't be used.",
      "Wrapping the column in a function (WHERE lower(email) = …) so a plain index on email doesn't apply.",
    ],
    interview: [
      "Name the queries first, then the indexes that serve them.",
      "Mention the write amplification of every extra index.",
      "If reads are still too heavy after indexing, move on to caching and replicas.",
    ],
  },

  "replication-sharding": {
    sections: [
      {
        heading: "Replication",
        body: [
          "One primary takes all writes and streams its change log to replicas, which apply the same changes. Reads can go to any replica, so read capacity grows with each copy, and a replica can be promoted if the primary dies.",
          "Replication is usually asynchronous: the primary confirms a write before replicas have it. Replicas lag by milliseconds to seconds, so a user may not immediately see their own write when reading from a replica (fix: read your own recent writes from the primary).",
          "Replication does not help writes: every replica must apply every write, so write capacity is still that of one machine.",
        ],
      },
      {
        heading: "Sharding",
        body: [
          "Sharding splits the data by a key (user id, tenant id) so each shard holds and writes only its slice. Ten shards give roughly ten times the write capacity and storage.",
          "The shard key is the big decision. A good key spreads load evenly and keeps related data together, so most queries hit one shard. Queries that span shards (global sorts, joins across users) become expensive scatter-gather operations.",
          "Range sharding (a–h, i–p…) keeps ranges together but can create hot shards; hash sharding spreads evenly but loses ordering. Use consistent hashing so adding shards moves little data.",
        ],
      },
    ],
    example: {
      title: "A write-heavy event log",
      steps: [
        "20,000 writes/s; one database primary handles about 5,000 writes/s.",
        "Adding read replicas doesn't help: each replica must still apply all 20,000 writes/s.",
        "Shard by device id across 6 shards: about 3,300 writes/s each, 66% busy.",
        "Queries are per device, so each one hits exactly one shard.",
      ],
    },
    tradeoffs: [
      { option: "Read replicas", pros: "Easy; more reads; failover target", cons: "No extra writes; replication lag" },
      { option: "Sharding", pros: "Scales writes and storage", cons: "Cross-shard queries, rebalancing, operational load" },
      { option: "Bigger machine", pros: "No code changes", cons: "Has a ceiling, and it's one box" },
    ],
    mistakes: [
      "Adding replicas to fix a write bottleneck.",
      "Sharding by a key with skew (country, or a celebrity's id), creating one hot shard.",
      "Sharding before you need to: it's hard to undo, and a single well-indexed database goes a long way.",
    ],
    interview: [
      "Separate read and write numbers before choosing.",
      "When you shard, name the shard key and the queries it serves well and badly.",
      "Mention replication lag and how you handle read-your-own-writes.",
    ],
  },

  "cdn-edge": {
    sections: [
      {
        heading: "How a CDN serves a file",
        body: [
          "A CDN runs hundreds of edge locations worldwide. DNS (or anycast routing) sends each user to a nearby edge. If the edge has the file and it's still fresh, it answers in a few milliseconds. If not, it fetches from your origin once, stores it, and serves the next users from its copy.",
          "Cache-Control headers decide freshness: 'public, max-age=31536000, immutable' for fingerprinted assets (app.3f9a.js) that never change, short TTLs for things that do. Changing the file name on each deploy avoids invalidation entirely.",
        ],
      },
      {
        heading: "What belongs on the edge",
        body: [
          "Anything identical for every user: images, video segments, scripts, styles, fonts, and even full public pages. Personalised responses (a logged-in feed) generally don't, unless you split the personal part out.",
          "Edges also absorb attacks and spikes: a DDoS or a viral launch hits the CDN's huge capacity instead of your servers. The origin only sees cache misses.",
        ],
      },
    ],
    example: {
      title: "An image-heavy homepage",
      steps: [
        "20,000 req/s, 70% of them for images and scripts.",
        "Without a CDN, the app servers serve 14,000 static requests/s plus 6,000 dynamic ones.",
        "With a CDN at a 95% hit ratio, only 700 static requests/s reach the origin.",
        "The app tier now sizes for about 6,700 req/s instead of 20,000, and users far away get images in tens of milliseconds.",
      ],
    },
    tradeoffs: [
      { option: "Long TTL + versioned names", pros: "Near-100% hit ratio, no invalidation", cons: "Needs a build step that fingerprints files" },
      { option: "Short TTL", pros: "Changes show up quickly", cons: "More misses reach the origin" },
      { option: "Purge on change", pros: "Fresh and cacheable", cons: "Purges take time to propagate and can be rate-limited" },
    ],
    mistakes: [
      "Caching a personalised page under one shared key and showing users each other's data.",
      "Serving uploads through app servers instead of straight to object storage behind the CDN.",
      "Forgetting the origin must survive a mass cache miss (a purge or a new release).",
    ],
    interview: [
      "Split traffic into static and dynamic early; put static behind a CDN.",
      "Say what TTL you'd use and how a new version reaches users.",
      "For video or images, mention object storage as the CDN's origin.",
    ],
  },

  queues: {
    sections: [
      {
        heading: "Decoupling time",
        body: [
          "A queue lets the producer (your API) hand off work and answer immediately, usually with 202 Accepted. Consumers (workers) pull messages when they're ready. The two sides no longer need the same speed.",
          "During a spike the queue absorbs the excess: it grows, then drains once traffic falls. That only works if workers' average throughput exceeds the average arrival rate; if not, the backlog grows forever and the oldest jobs wait longer and longer.",
        ],
      },
      {
        heading: "Delivery guarantees",
        body: [
          "Most queues deliver at least once: if a worker crashes before acknowledging a message, it's redelivered to another worker. So workers must be idempotent; processing the same message twice must be harmless.",
          "Messages that keep failing go to a dead-letter queue after a few attempts, so one bad message doesn't block the rest.",
          "Ordering is usually only guaranteed within a partition (Kafka) or a message group (SQS FIFO). Pick a partition key (order id) when per-entity order matters.",
        ],
      },
    ],
    example: {
      title: "Sending order emails",
      steps: [
        "Checkout used to call the email provider inline: 400 ms, and checkout failed when the provider was down.",
        "Now checkout writes the order and enqueues 'send receipt': it answers in 30 ms.",
        "Two workers each send 50 emails/s; peak arrival is 80/s, so the queue grows briefly at peak and drains afterwards.",
        "If the provider is down, messages wait and retry; checkout is unaffected.",
      ],
    },
    tradeoffs: [
      { option: "Do it inline", pros: "Simple; the user knows it's done", cons: "Slow requests; failures cascade" },
      { option: "Queue + workers", pros: "Fast responses, absorbs spikes, retries", cons: "Eventual completion; idempotency and monitoring needed" },
      { option: "Log/stream (Kafka)", pros: "Replay, many consumers, high throughput", cons: "More to operate; ordering only per partition" },
    ],
    mistakes: [
      "Workers that aren't idempotent, so a redelivery sends two emails or charges twice.",
      "No backlog alert: the queue grows silently for hours.",
      "Putting work the user needs to see right now (the order confirmation itself) behind the queue.",
    ],
    interview: [
      "Say which work is on the request path and which goes to a queue, and why.",
      "Compare arrival rate with worker throughput to show the backlog drains.",
      "Mention at-least-once delivery, idempotent consumers and a dead-letter queue.",
    ],
  },

  "gateways-rate-limits": {
    sections: [
      {
        heading: "What the gateway centralises",
        body: [
          "TLS termination, authentication (validating a token or API key), rate limiting, request routing (/orders → order service), request size limits, and logging. Doing these once at the edge means each service doesn't reimplement them.",
          "It also hides internal topology: clients see one host, and you can split or move services behind it without breaking them.",
        ],
      },
      {
        heading: "How rate limiting works",
        body: [
          "Token bucket: each client has a bucket that refills at a steady rate (say 10 tokens/s) up to a maximum (say 20). Each request spends a token; with none left, the request gets 429 Too Many Requests. It allows short bursts while capping the average.",
          "Limits are keyed by API key, user, or IP. Across many gateway instances the counters live in a shared store (often Redis) or are split per instance with some tolerance.",
          "Good 429 responses include Retry-After so well-behaved clients back off instead of hammering harder.",
        ],
      },
    ],
    example: {
      title: "A scraper at 900 req/s",
      steps: [
        "One API key sends 900 req/s; normal users send about 2 req/s each.",
        "Limit: 20 req/s per key, burst 40.",
        "The scraper gets 20 req/s through; 880 req/s are rejected at the gateway in microseconds.",
        "The order service never sees the excess, so its latency for real users is unchanged.",
      ],
    },
    tradeoffs: [
      { option: "Limit at the gateway", pros: "Cheapest place to reject; one policy", cons: "Gateway becomes critical; must be redundant" },
      { option: "Limit in each service", pros: "Fine-grained per endpoint", cons: "Duplicated logic; bad traffic already cost you" },
      { option: "Fixed window counter", pros: "Trivial to build", cons: "Allows double bursts at window edges" },
    ],
    mistakes: [
      "Rate limiting by IP only, which punishes everyone behind one corporate NAT.",
      "A single gateway instance: now the front door is a single point of failure.",
      "Returning 500 instead of 429, so clients retry immediately and make it worse.",
    ],
    interview: [
      "Put auth and rate limits at the edge and say why: reject early and cheaply.",
      "Name the algorithm (token bucket) and the key (per API key or user).",
      "Mention 429 + Retry-After and that the gateway itself runs as several replicas.",
    ],
  },

  locks: {
    sections: [
      {
        heading: "Why races happen",
        body: [
          "Check-then-act: read 'is seat 12A free?', then write 'book 12A'. Between the read and the write, another server can do the same read. Both see free, both write, and the seat is sold twice. No error is raised; the data is simply wrong.",
          "The more concurrent requests contend for the same item (a concert's front row, the last item in stock), the more often it happens.",
        ],
      },
      {
        heading: "Ways to make it atomic",
        body: [
          "Database first: a conditional write (UPDATE seats SET owner = ? WHERE id = '12A' AND owner IS NULL) or a unique constraint makes the check and the write one step. Only one update succeeds.",
          "Row locks: SELECT … FOR UPDATE inside a transaction holds the row until commit, so the second transaction waits.",
          "Distributed locks: a lock in Redis or ZooKeeper (with a TTL so a crashed holder doesn't block forever) guards work spanning several systems. Use fencing tokens so a holder whose lock expired can't still write.",
          "Optimistic concurrency: read a version number, write only if it hasn't changed, retry on conflict. Great when conflicts are rare.",
        ],
      },
    ],
    example: {
      title: "Selling the last ticket",
      steps: [
        "Two requests arrive within 2 ms for the last ticket.",
        "Without protection: both read stock = 1, both write stock = 0, and two people get one ticket.",
        "With UPDATE tickets SET stock = stock − 1 WHERE id = ? AND stock > 0: the first update affects 1 row, the second affects 0 rows and is told 'sold out'.",
      ],
    },
    tradeoffs: [
      { option: "Conditional update / constraint", pros: "Simple, fast, in the database", cons: "Only covers data in one database" },
      { option: "Pessimistic lock", pros: "Guarantees order", cons: "Waiting under contention; deadlock risk" },
      { option: "Optimistic (version check)", pros: "No waiting when conflicts are rare", cons: "Retries pile up under heavy contention" },
      { option: "Distributed lock", pros: "Coordinates across services", cons: "Extra dependency; needs TTLs and fencing" },
    ],
    mistakes: [
      "Checking in application code and writing separately, assuming nobody else is doing the same.",
      "Distributed locks with no TTL: one crash blocks the resource forever.",
      "Holding a lock across slow calls (payments, emails), so throughput collapses.",
    ],
    interview: [
      "Spot check-then-act on shared state and name the race explicitly.",
      "Prefer the simplest atomic option: a conditional write or a unique constraint.",
      "If you use a distributed lock, mention TTL and fencing tokens.",
    ],
  },

  quorum: {
    sections: [
      {
        heading: "Majorities never overlap",
        body: [
          "Consensus systems (ZooKeeper, etcd, Consul, Raft-based databases) accept a decision only when a majority of nodes agree. Any two majorities share at least one node, so two conflicting decisions can't both win.",
          "With N nodes the cluster tolerates floor((N − 1) / 2) failures: 3 nodes tolerate 1, 5 tolerate 2, 7 tolerate 3.",
        ],
      },
      {
        heading: "Why even sizes are a waste",
        body: [
          "4 nodes need 3 for a majority, so they still tolerate only 1 failure, the same as 3 nodes, while costing more and adding a node that can fail. A 2-node cluster tolerates zero failures: losing either node stops it.",
          "Bigger clusters are also slower to write, since each write waits for a majority to confirm. That's why 3 or 5 is typical; 7 is rare.",
        ],
      },
    ],
    example: {
      title: "A network split",
      steps: [
        "A 5-node cluster splits into 3 nodes and 2 nodes.",
        "The 3-node side has a majority (3 of 5): it keeps or elects a leader and keeps accepting writes.",
        "The 2-node side can't reach a majority: it refuses writes rather than risk disagreeing.",
        "When the network heals, the 2 nodes catch up from the leader. No conflicting writes ever existed.",
      ],
    },
    tradeoffs: [
      { option: "3 nodes", pros: "Survives 1 failure; fast writes", cons: "A second failure stops it" },
      { option: "5 nodes", pros: "Survives 2 failures, e.g. maintenance + a crash", cons: "Slightly slower writes, more cost" },
      { option: "Even sizes (2, 4)", pros: "None", cons: "Same tolerance as one fewer node, at more cost" },
    ],
    mistakes: [
      "Running 2 coordination nodes 'for redundancy': it tolerates no failures at all.",
      "Putting all nodes in one availability zone, so one zone outage takes out the majority.",
      "Using a consensus store as a general database for high-volume data.",
    ],
    interview: [
      "Say '3 or 5 nodes across zones' and explain the majority rule.",
      "Explain what the minority side does in a split: it stops accepting writes.",
      "Use consensus for small, critical data: leader election, locks, configuration.",
    ],
  },
};

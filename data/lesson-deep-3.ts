import type { LessonDeep } from "./lesson-deep";

/** In-depth content for the second set of lessons: storage, search, backpressure, coordination and probabilistic structures. */
export const DEEP_3: Record<string, LessonDeep> = {
  "blob-storage": {
    sections: [
      {
        heading: "Why files don't go in the database",
        body: [
          "A database row is designed for kilobytes, not megabytes. Storing images or video as blobs bloats backups, slows replication and wastes expensive database memory and IOPS on bytes nobody queries.",
          "Object storage is built for this: effectively unlimited capacity, eleven nines of durability through replication across zones, and a price around $0.02 per GB a month. You address objects by key (users/42/photos/9f2a.jpg) and keep the key in the database.",
        ],
      },
      {
        heading: "Direct uploads with signed URLs",
        body: [
          "The client asks your API for an upload URL. The API checks permissions, picks the key, records a pending row, and returns a pre-signed URL that allows exactly one PUT to that key for a few minutes. The client uploads straight to storage.",
          "Your app servers never touch the bytes, so a 2 GB video costs them one small request. Storage then emits an 'object created' event; a worker validates the file, generates thumbnails or transcodes video, and marks the row ready.",
          "For large files use multipart upload: the file is split into parts uploaded in parallel and retried individually, then stitched together.",
        ],
      },
    ],
    example: {
      title: "A photo app at 350 uploads/s",
      steps: [
        "350 uploads/s × 2 MB = 700 MB/s of incoming bytes at peak.",
        "Through app servers, that's dozens of servers just moving bytes. With signed URLs, the API handles 350 tiny requests/s.",
        "Storage grows 20 TB a day; at $0.02/GB-month that's about $400 more each month, every month, so add lifecycle rules (move old originals to cold storage).",
        "Views go through a CDN, so storage sees only cache misses.",
      ],
    },
    tradeoffs: [
      { option: "Object storage + signed URLs", pros: "Cheap, durable, scales without servers", cons: "Eventual 'ready' state; needs an upload flow" },
      { option: "Upload through the API", pros: "Simple; validate as you receive", cons: "App servers become a bandwidth bottleneck" },
      { option: "Blobs in the database", pros: "One system, transactional", cons: "Slow backups, expensive storage, replication pain" },
    ],
    mistakes: [
      "Streaming uploads through app servers and scaling them for bandwidth instead of requests.",
      "Public buckets for private files instead of signed download URLs.",
      "No lifecycle policy, so storage costs grow forever.",
    ],
    interview: [
      "Separate metadata (database) from bytes (object storage) early.",
      "Describe the signed-URL upload flow and the post-upload processing.",
      "Put a CDN in front for reads and mention cost per GB.",
    ],
  },

  "storage-engines": {
    sections: [
      {
        heading: "B-trees",
        body: [
          "Data lives in fixed-size pages (often 8–16 KB) arranged as a shallow sorted tree. A write finds its page and modifies it in place, after first recording the change in a write-ahead log so a crash can be recovered.",
          "Reads are predictable: a few page reads per lookup and efficient range scans. Writes are random I/O and can split pages, which limits sustained write throughput.",
        ],
      },
      {
        heading: "LSM trees",
        body: [
          "Writes go to an in-memory sorted table (the memtable) and an append-only log. When the memtable fills, it's flushed to disk as an immutable sorted file (an SSTable). Writes are sequential and very fast.",
          "Over time there are many SSTables, so a read may check several. Bloom filters skip files that can't contain the key, and background compaction merges files to keep the count down and drop overwritten or deleted values.",
          "Compaction costs disk bandwidth and can cause latency spikes if it falls behind; tuning it is a large part of running an LSM store.",
        ],
      },
    ],
    example: {
      title: "Choosing a store for device telemetry",
      steps: [
        "50,000 devices each send a reading every second: 50,000 writes/s, almost never updated, read mostly as recent ranges per device.",
        "A B-tree database would need heavy sharding just to absorb the random writes.",
        "An LSM store (Cassandra, ScyllaDB) keyed by (device_id, timestamp) takes sequential writes easily and serves per-device ranges well.",
        "User accounts and billing stay in PostgreSQL, where updates and complex queries matter more.",
      ],
    },
    tradeoffs: [
      { option: "B-tree (PostgreSQL, MySQL)", pros: "Fast, predictable reads; rich queries; transactions", cons: "Write throughput limited by random I/O" },
      { option: "LSM (Cassandra, RocksDB)", pros: "Very high write throughput; good compression", cons: "Reads may touch several files; compaction tuning" },
    ],
    mistakes: [
      "Choosing an LSM store for a read-heavy, update-heavy relational workload.",
      "Ignoring compaction debt until read latency spikes.",
      "Assuming 'NoSQL' means 'faster' without looking at the access pattern.",
    ],
    interview: [
      "Describe the write and read path of whichever engine you pick.",
      "Tie the choice to the workload: write-heavy append data vs read-heavy relational data.",
      "Mention Bloom filters and compaction when you talk about LSM reads.",
    ],
  },

  "search-indexes": {
    sections: [
      {
        heading: "Building the index",
        body: [
          "Each document is analysed: split into tokens, lowercased, stripped of punctuation, stemmed (shoes → shoe) and optionally filtered of stop words. Each token gets a postings list of document ids, often with positions for phrase queries.",
          "Postings are sorted and compressed, so intersecting 'red' AND 'shoe' is a fast merge of two sorted lists. Prefix queries (autocomplete) use a separate structure such as an edge n-gram index or a trie.",
        ],
      },
      {
        heading: "Ranking and keeping it fresh",
        body: [
          "Relevance usually starts from BM25: rare words matter more than common ones, and repeated matches help with diminishing returns. Business signals (popularity, recency) are blended in afterwards.",
          "The search engine is a derived copy. A change data capture stream or an event from the app updates the index within seconds; a periodic full reindex repairs drift.",
          "Indexes are sharded by document and each shard is replicated; a query fans out to one copy of every shard and merges the top results.",
        ],
      },
    ],
    example: {
      title: "Product search for 20 million items",
      steps: [
        "LIKE '%red shoe%' scans 20 million rows: seconds per query.",
        "An inverted index: postings for 'red' (400k ids) and 'shoe' (90k ids) intersect to 6k matches in milliseconds.",
        "BM25 plus a popularity boost picks the top 20.",
        "A price change publishes an event; the index updates within a few seconds.",
      ],
    },
    tradeoffs: [
      { option: "Database full-text (Postgres tsvector)", pros: "No extra system; transactional", cons: "Limited ranking and scale" },
      { option: "Search engine (Elasticsearch/OpenSearch)", pros: "Rich ranking, facets, scale", cons: "Another cluster; index lags the database" },
      { option: "Prefix index for autocomplete", pros: "Instant suggestions", cons: "Large index; needs its own popularity ranking" },
    ],
    mistakes: [
      "Using LIKE '%term%' for user search on a large table.",
      "Treating the search index as the source of truth.",
      "No reindex path, so the index silently drifts from the database.",
    ],
    interview: [
      "Explain the inverted index and how a multi-word query is answered.",
      "Say how updates flow from the database to the index and how stale it may be.",
      "For autocomplete, mention prefix structures and caching the top queries.",
    ],
  },

  backpressure: {
    sections: [
      {
        heading: "Why queues don't save you from overload",
        body: [
          "If 3,000 requests/s arrive and you can serve 1,000/s, a queue grows by 2,000 every second. After a minute, a new request waits a minute: past every client's timeout. Now you're working hard on requests nobody is waiting for. That's congestion collapse.",
          "Queues smooth short bursts. For sustained overload you must either do less work or make producers slow down.",
        ],
      },
      {
        heading: "Tools for overload",
        body: [
          "Bounded queues: when full, reject or block the producer (backpressure). Streams like Kafka let consumers fall behind safely, but the lag must be watched.",
          "Load shedding: reject early and cheaply (503 or 429) when concurrency or latency passes a limit. Prioritise: keep checkout, drop recommendations.",
          "Timeouts and deadlines: don't start work for a request whose client has already given up; pass the deadline downstream.",
          "Retry budgets with exponential backoff and jitter: a slowdown shouldn't triple the load because every client retries at once.",
        ],
      },
    ],
    example: {
      title: "A notification service on launch day",
      steps: [
        "Arrivals spike to 3× worker capacity for 20 minutes.",
        "Unbounded: the queue reaches millions, 'your code is 123456' SMS messages arrive an hour late and are useless.",
        "Bounded at 5 minutes of work, with priorities: one-time codes always go first; marketing pushes are shed or delayed.",
        "Codes stay under 10 seconds; marketing sends catch up after the spike.",
      ],
    },
    tradeoffs: [
      { option: "Unbounded queue", pros: "Never rejects", cons: "Unbounded latency; collapse under sustained load" },
      { option: "Bounded queue + backpressure", pros: "Latency stays bounded", cons: "Producers must handle 'slow down'" },
      { option: "Priority load shedding", pros: "Important work survives", cons: "Some requests fail by design" },
    ],
    mistakes: [
      "Treating a growing queue as fine because nothing is erroring.",
      "Retrying immediately without backoff, multiplying load during an incident.",
      "Shedding randomly instead of by priority.",
    ],
    interview: [
      "Compare arrival rate with service rate and say what happens when it's sustained.",
      "Name bounded queues, load shedding, timeouts and retry budgets.",
      "Say which traffic you'd shed first.",
    ],
  },

  "leader-election": {
    sections: [
      {
        heading: "Leases",
        body: [
          "A lease is a lock with an expiry, held in a consensus store (etcd, ZooKeeper, Consul). The holder must renew it before it expires. If the holder crashes or is partitioned away, the lease lapses and another node can acquire it.",
          "The lease length trades failover speed against false failovers: 10 seconds means up to 10 seconds without a leader, but a 2-second GC pause won't trigger a change.",
        ],
      },
      {
        heading: "Fencing tokens",
        body: [
          "A leader can pause (GC, VM migration) longer than its lease, wake up, and keep acting as leader while a new one already exists. Clocks and timers can't prevent that.",
          "Fix: every lease grant comes with a number that only increases (the fencing token). The leader sends it with every write, and storage rejects any write with a token lower than the highest it has seen. The stale leader's writes simply fail.",
        ],
      },
    ],
    example: {
      title: "A cron scheduler that must fire once",
      steps: [
        "Three scheduler instances; only one may trigger jobs, or invoices get sent three times.",
        "They contend for /scheduler/leader in etcd with a 10-second lease; A wins with token 7 and renews every 3 seconds.",
        "A's VM freezes for 15 seconds. The lease expires; B becomes leader with token 8.",
        "A wakes and tries to mark a job as started with token 7; the job store has seen 8 and rejects it.",
      ],
    },
    tradeoffs: [
      { option: "Short lease", pros: "Fast failover", cons: "More false failovers on pauses or slow networks" },
      { option: "Long lease", pros: "Stable leadership", cons: "Longer gap when a leader really dies" },
      { option: "No leader (idempotent work)", pros: "Nothing to elect", cons: "Only works if duplicates are harmless" },
    ],
    mistakes: [
      "Using a plain lock with no expiry: a crashed leader blocks forever.",
      "Relying on timing alone without fencing tokens.",
      "Electing a leader with a homemade protocol instead of a consensus store.",
    ],
    interview: [
      "Say where the lease lives and how long it is.",
      "Bring up the paused-leader problem and fencing tokens.",
      "Ask whether the work could be made idempotent so a leader isn't needed.",
    ],
  },

  "geo-indexing": {
    sections: [
      {
        heading: "Cells instead of coordinates",
        body: [
          "Latitude and longitude are two numbers, and a normal index can only sort by one. Geospatial indexes map the 2D world onto cells. Geohash interleaves the bits of latitude and longitude into a string: each extra character makes the cell about 32 times smaller, and nearby points share prefixes.",
          "A query takes the cell containing the user plus its 8 neighbours (a point just across a border is still close), gathers candidates, and filters by exact distance.",
        ],
      },
      {
        heading: "Uneven density and moving objects",
        body: [
          "Fixed cells are too big in Manhattan and too small in the desert. Quadtrees split a cell into four only when it holds too many points; S2 and Uber's H3 offer hierarchical cells at many resolutions.",
          "Drivers move every few seconds. Keep live positions in memory (Redis GEO, or an in-memory grid per city) and write history to a database separately. Shard by city or region, since most queries never cross one.",
        ],
      },
    ],
    example: {
      title: "Matching riders to drivers",
      steps: [
        "300,000 active drivers send a location every 4 seconds: 75,000 updates/s, kept in an in-memory geo index sharded by city.",
        "A rider requests a ride; the service reads the rider's cell and its 8 neighbours: about 40 candidate drivers.",
        "Filter by distance and status (available), rank by ETA, and offer the top driver, using a lock so two riders can't get the same one.",
      ],
    },
    tradeoffs: [
      { option: "Geohash grid", pros: "Simple; works in any key-value store", cons: "Uneven cell density; edge effects" },
      { option: "Quadtree", pros: "Adapts to density", cons: "Tree to maintain and rebalance" },
      { option: "Database geo index (PostGIS)", pros: "Rich queries, accurate", cons: "Hard to keep up with very frequent updates" },
    ],
    mistakes: [
      "Scanning every driver and computing distances.",
      "Searching only the user's own cell and missing drivers just across the border.",
      "Writing every location update to the main database.",
    ],
    interview: [
      "Explain geohash or quadtree cells and the neighbour lookup.",
      "Separate the fast-changing live location store from persistent history.",
      "Shard by region and say why queries rarely cross shards.",
    ],
  },

  "bloom-filters": {
    sections: [
      {
        heading: "How it works",
        body: [
          "A Bloom filter is an array of m bits, all 0, and k hash functions. To add an item, hash it k ways and set those k bits to 1. To check an item, hash it the same way: if any of those bits is 0, the item was definitely never added.",
          "If all k bits are 1, the item was probably added, but those bits may have been set by other items. The false-positive rate depends on bits per item and k: about 10 bits per item with 7 hashes gives roughly 1%.",
        ],
      },
      {
        heading: "Where they pay off",
        body: [
          "In front of anything expensive that usually says 'no': an LSM store checks a file's Bloom filter before reading it; a crawler checks whether a URL was seen before querying a large database; a cache can avoid caching items requested only once.",
          "Basic Bloom filters can't delete (clearing a bit might remove other items). Counting Bloom filters or rebuilding periodically handle deletions; cuckoo filters support deletes natively.",
        ],
      },
    ],
    example: {
      title: "A web crawler's seen-URL check",
      steps: [
        "10 billion URLs seen. Storing them exactly needs hundreds of GB.",
        "A Bloom filter at 10 bits per URL is about 12 GB and fits in memory across a few machines.",
        "For a new URL: if the filter says 'not seen' (99% of new URLs), crawl it with no database lookup.",
        "If it says 'maybe seen', check the database; about 1% of new URLs pay that extra lookup.",
      ],
    },
    tradeoffs: [
      { option: "Bloom filter", pros: "Tiny memory; constant-time checks", cons: "False positives; no deletes" },
      { option: "Exact set (hash set)", pros: "No false positives; deletes", cons: "Memory grows with the items themselves" },
      { option: "Cuckoo filter", pros: "Deletes supported; similar size", cons: "Can fail to insert when very full" },
    ],
    mistakes: [
      "Using a Bloom filter where a false positive is harmful (for example, 'this username is taken' with no exact check behind it).",
      "Sizing it for today's item count, so the false-positive rate climbs as it fills.",
      "Expecting to delete items from a basic filter.",
    ],
    interview: [
      "Explain the 'definitely not / probably yes' guarantee.",
      "Size it: bits per item → false-positive rate.",
      "Say what the expensive lookup behind it is, and that 'maybe' falls back to it.",
    ],
  },
};

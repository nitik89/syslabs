import type { BaseKind } from "@/lib/sim";

/**
 * Plain-language guide for every building block, shown in the component settings panel.
 * Written for someone new to system design: what it is, an everyday comparison, when to reach for it,
 * what its settings mean, and what tends to go wrong.
 */
export interface ComponentGuide {
  /** One sentence: what it does. */
  what: string;
  /** An everyday comparison. */
  analogy: string;
  /** When to add one. */
  useWhen: string[];
  /** Settings and terms, explained. */
  terms: { name: string; meaning: string }[];
  /** Common mistakes and failure modes. */
  watchOut: string[];
  /** A real-world number to keep in mind. */
  rule?: string;
}

export const COMPONENT_GUIDE: Record<BaseKind, ComponentGuide> = {
  client: {
    what: "The people (or apps) sending requests to your system. It's where the traffic starts.",
    analogy: "Customers walking into a shop.",
    useWhen: ["Every design starts here. Connect it to the first thing users hit: DNS, a CDN or a load balancer."],
    terms: [
      { name: "Requests per second (req/s)", meaning: "How many requests arrive every second. Set it in the Traffic panel." },
      { name: "Read / write share", meaning: "Reads look things up (open a page); writes change something (place an order)." },
    ],
    watchOut: ["Users don't arrive evenly: plan for the busiest minute, not the average."],
    rule: "Peak traffic is often 2–5× the daily average.",
  },
  dns: {
    what: "Turns a name like shop.com into the address of your servers.",
    analogy: "A phone book: look up a name, get a number.",
    useWhen: ["At the very front, so users can reach you by name.", "To send users to the nearest region or away from a failed one."],
    terms: [
      { name: "TTL", meaning: "How long browsers remember the answer. Short TTLs let you move traffic quickly in an emergency." },
      { name: "Health-checked routing", meaning: "Managed DNS can stop pointing at a region that's down." },
    ],
    watchOut: ["DNS answers are cached everywhere, so changes take minutes to reach everyone."],
    rule: "Lookups are usually cached, so DNS adds almost no time to most requests.",
  },
  cdn: {
    what: "A network of servers near your users that keeps copies of files (images, scripts, videos) and serves them from close by.",
    analogy: "Vending machines in every neighbourhood instead of one central warehouse.",
    useWhen: ["Lots of images, video or other files that are the same for everyone.", "Users spread across countries.", "You expect sudden spikes (a CDN absorbs them)."],
    terms: [
      { name: "Cache hit", meaning: "The edge already had the file and answered without bothering your servers." },
      { name: "Origin", meaning: "Your own storage or servers, asked only when the edge doesn't have a copy." },
    ],
    watchOut: ["Never cache personal pages under a shared address: one user could see another's data.", "A purge or new release can send a burst of misses to your origin."],
    rule: "A good CDN serves 90–99% of static files without touching your servers.",
  },
  loadBalancer: {
    what: "Spreads incoming requests across several identical servers and stops sending to any that break.",
    analogy: "A host at a restaurant seating guests at whichever table is free.",
    useWhen: ["You run more than one app server.", "You need to survive a server dying, or deploy without downtime."],
    terms: [
      { name: "Round robin", meaning: "Takes turns: server 1, 2, 3, 1, 2, 3… Simple and even when requests cost the same." },
      { name: "Least connections", meaning: "Sends each request to the least busy server. Best when some requests are slow." },
      { name: "IP hash (sticky)", meaning: "The same user always lands on the same server. Handy for sessions, but load can get uneven." },
      { name: "Health checks", meaning: "Regularly asks each server 'are you OK?' and stops sending traffic to ones that don't answer." },
    ],
    watchOut: ["A single load balancer is itself a single point of failure: use a managed one or two.", "Without health checks, users keep hitting a dead server."],
    rule: "Keep app servers stateless so the balancer can send anyone anywhere.",
  },
  apiGateway: {
    what: "The single front door for your APIs: checks who's calling, applies limits and routes each request to the right service.",
    analogy: "Reception at an office: check ID, sign in, point you to the right floor.",
    useWhen: ["Several services behind one public address.", "You need sign-in checks, rate limits or API keys in one place."],
    terms: [
      { name: "Authentication", meaning: "Proving who the caller is (a token or API key)." },
      { name: "Routing", meaning: "/orders goes to the order service, /users to the user service." },
    ],
    watchOut: ["Every request passes through it: give it enough replicas.", "It adds a few milliseconds to each call."],
  },
  rateLimiter: {
    what: "Caps how many requests each caller can make, so one noisy client can't hurt everyone else.",
    analogy: "A bouncer letting in a few people at a time.",
    useWhen: ["Public APIs.", "Login and sign-up pages (to stop password guessing).", "Protecting an expensive service."],
    terms: [
      { name: "Token bucket", meaning: "Each caller gets a bucket of tokens that refills steadily; every request spends one. Short bursts are fine, floods aren't." },
      { name: "429 Too Many Requests", meaning: "The polite 'slow down' answer, ideally with a Retry-After time." },
    ],
    watchOut: ["Limiting by IP alone punishes everyone behind one office network."],
  },
  appGateway: {
    what: "An all-in-one front door: firewall, rate limits, sign-in checks and load balancing in one component.",
    analogy: "Airport security, check-in and gate assignment at one desk.",
    useWhen: ["You want a single managed entry point instead of separate pieces."],
    terms: [{ name: "WAF", meaning: "Web application firewall: blocks known attack patterns before they reach your code." }],
    watchOut: ["Convenient, but it's one more critical box: run it redundantly."],
  },
  websocketGateway: {
    what: "Keeps long-lived connections open to users so the server can push updates instantly (chat, live scores).",
    analogy: "An open phone line instead of calling back every few seconds.",
    useWhen: ["Chat, notifications, live dashboards, multiplayer games."],
    terms: [{ name: "Connection", meaning: "One open line per user; a gateway can hold tens of thousands." }],
    watchOut: ["Connections are stateful: when a gateway restarts, its users must reconnect."],
    rule: "Plan roughly 50,000 connections per gateway instance.",
  },
  appServer: {
    what: "Runs your application code: handles each request, talks to caches and databases, and returns a response.",
    analogy: "The cooks in a kitchen.",
    useWhen: ["Almost always: this is where your business logic lives."],
    terms: [
      { name: "Replicas", meaning: "Identical copies. Three replicas handle three times the traffic and survive one dying." },
      { name: "Stateless", meaning: "Keeps nothing important in memory between requests, so any copy can serve anyone." },
      { name: "% busy", meaning: "How much of its capacity is used. Above ~70% requests start to queue and slow down." },
    ],
    watchOut: ["Adding app servers doesn't help if the database behind them is the bottleneck.", "One replica is a single point of failure."],
    rule: "Keep peak utilisation around 70–80% so a spike or a lost server doesn't tip you over.",
  },
  serverless: {
    what: "Runs your code on demand without managing servers; it scales up and down automatically.",
    analogy: "Hiring temp staff for each job instead of keeping a full team.",
    useWhen: ["Spiky or occasional workloads.", "Background jobs and small APIs."],
    terms: [{ name: "Cold start", meaning: "The first request after a quiet period waits while a new instance starts." }],
    watchOut: ["Can flood a database with connections when it scales up fast."],
  },
  cache: {
    what: "Keeps recently or frequently used data in memory so repeat requests are answered instantly, without asking the database.",
    analogy: "Keeping the most-asked-for items at the front counter instead of walking to the back store every time.",
    useWhen: ["Many reads of the same few items (popular products, profiles, feeds).", "The database is overloaded by reads.", "Responses must be very fast."],
    terms: [
      { name: "Hit ratio", meaning: "Share of reads answered from the cache. 90% means only 1 in 10 reads reaches the database." },
      { name: "Cache size", meaning: "How much it can hold. Bigger holds more popular items (higher hit ratio) but costs more." },
      { name: "Eviction policy", meaning: "What gets thrown out when it's full: least recently used (LRU), least frequently used (LFU), oldest first (FIFO) or random." },
      { name: "TTL (time to live)", meaning: "How long an item is kept before it's refreshed. Short = fresher data but more misses; long = faster but possibly stale." },
      { name: "Write policy", meaning: "Cache-aside: the app fills the cache on a miss. Write-through: every write updates the cache too. Write-back: writes go to the cache first and reach the database later." },
    ],
    watchOut: [
      "Useless when reads are spread evenly over millions of items: most lookups miss.",
      "After a restart the cache is empty (cold) and everything hits the database at once.",
      "Write-back can lose recent writes if the cache crashes before flushing.",
    ],
    rule: "Database load after a cache = reads × (1 − hit ratio).",
  },
  sqlDb: {
    what: "A relational database (PostgreSQL, MySQL): tables with rows and columns, strong consistency and transactions.",
    analogy: "A well-organised filing cabinet where every change is recorded carefully.",
    useWhen: ["Money, orders, inventory, accounts: anything that must be exactly right.", "You need joins and flexible queries."],
    terms: [
      { name: "Primary", meaning: "The one copy that accepts all writes." },
      { name: "Read replicas", meaning: "Extra copies that serve reads. They add read capacity, not write capacity." },
      { name: "Indexes", meaning: "Like a book's index: find rows without reading the whole table. Each index slows writes a little." },
      { name: "Max connections", meaning: "How many queries it can work on at once. Too few and requests wait in line even when the CPU is idle." },
    ],
    watchOut: ["Usually the first thing to run out of capacity.", "All writes go to one primary: replicas won't fix a write bottleneck (shard or queue instead).", "A missing index turns a 1 ms lookup into a full table scan."],
    rule: "A typical instance handles ~1,000 queries/s; each connection runs about 1000 ÷ latency(ms) queries/s.",
  },
  nosqlDb: {
    what: "A database built to scale out (DynamoDB, Cassandra, MongoDB): simple lookups by key, spread across many machines.",
    analogy: "Many small lockers, each opened by its own key, instead of one big cabinet.",
    useWhen: ["Huge volumes of simple reads and writes by key.", "Write-heavy data like events, sessions, messages."],
    terms: [
      { name: "Partition key", meaning: "Decides which machine stores each item. Pick one that spreads load evenly." },
      { name: "Eventual consistency", meaning: "A read right after a write may briefly return the old value." },
    ],
    watchOut: ["Complex queries and joins are hard or slow.", "A 'hot' key (one celebrity) still lands on one machine."],
  },
  timeseriesDb: {
    what: "A database tuned for timestamped measurements: metrics, sensor readings, prices over time.",
    analogy: "A logbook where every line starts with the time.",
    useWhen: ["Lots of append-only readings queried by time range."],
    terms: [{ name: "Retention", meaning: "How long old data is kept before it's rolled up or deleted." }],
    watchOut: ["Not meant for updating individual records."],
  },
  queue: {
    what: "A waiting line for work: the app drops a job in and answers the user right away; workers pick jobs up later.",
    analogy: "An order ticket rail in a kitchen: the waiter clips the ticket and goes back to customers.",
    useWhen: ["Anything the user doesn't need to wait for: emails, thumbnails, notifications.", "Absorbing spikes so the database isn't flooded."],
    terms: [
      { name: "Producer / consumer", meaning: "Producers add jobs; consumers (workers) take them off." },
      { name: "Backlog", meaning: "Jobs waiting. It's fine if it grows during a spike and shrinks after." },
      { name: "At-least-once", meaning: "A job can be delivered twice after a crash, so workers must handle duplicates." },
    ],
    watchOut: ["If workers are slower than arrivals for too long, the backlog grows forever.", "Don't put work the user is waiting to see behind a queue."],
  },
  worker: {
    what: "Background servers that take jobs from a queue and do the slow work.",
    analogy: "Kitchen staff working through the order tickets.",
    useWhen: ["Behind a queue, to process jobs at a steady pace."],
    terms: [{ name: "Throughput", meaning: "Jobs finished per second. Add workers to drain a backlog faster." }],
    watchOut: ["Make jobs safe to run twice (idempotent)."],
  },
  objectStorage: {
    what: "Cheap, practically unlimited storage for files: photos, videos, backups (S3, GCS).",
    analogy: "A self-storage warehouse: put anything in, get it back by its label.",
    useWhen: ["Any file bigger than a few kilobytes.", "As the source behind a CDN."],
    terms: [
      { name: "Object key", meaning: "The file's name/path, which you store in the database." },
      { name: "Signed URL", meaning: "A short-lived link that lets a user upload or download one file directly." },
    ],
    watchOut: ["Don't send uploads through your app servers: let users upload straight to storage."],
    rule: "About $0.02 per GB per month.",
  },
  search: {
    what: "A search engine (Elasticsearch, OpenSearch) that finds documents by the words in them, fast, and ranks the best matches.",
    analogy: "A library catalogue that lists every book containing a word.",
    useWhen: ["Search boxes, autocomplete, filtering by many fields."],
    terms: [{ name: "Inverted index", meaning: "A list of every word and the documents that contain it." }],
    watchOut: ["It's a copy of your data, a few seconds behind the database."],
  },
  redisLock: {
    what: "A lock service: makes sure only one server at a time can do something, like booking seat 12A.",
    analogy: "A single key to a meeting room: whoever holds it gets the room.",
    useWhen: ["Two people could grab the same thing at once: seats, the last item in stock, usernames."],
    terms: [
      { name: "Contended writes", meaning: "Writes racing for the same item. Without a lock, both can win." },
      { name: "Lock expiry", meaning: "Locks time out so a crashed server doesn't hold one forever." },
    ],
    watchOut: ["Holding a lock during slow work (calling a payment provider) makes everyone wait."],
  },
  zookeeper: {
    what: "A coordination service (ZooKeeper, etcd): a small cluster that agrees by majority vote, used for locks and electing a leader.",
    analogy: "A committee that only decides when most members agree.",
    useWhen: ["Leader election, distributed locks, shared configuration."],
    terms: [{ name: "Quorum", meaning: "A majority of nodes. 3 nodes survive 1 failure; 5 survive 2." }],
    watchOut: ["Always use an odd number (3 or 5): 2 or 4 nodes add cost without extra safety."],
  },
  monitoring: {
    what: "Collects metrics, logs and traces, and alerts someone when things go wrong.",
    analogy: "The dashboard and warning lights in a car.",
    useWhen: ["Always, in production."],
    terms: [{ name: "Alert", meaning: "A page to the on-call engineer when users are affected (errors, slowness)." }],
    watchOut: ["Alert on what users feel, not on every CPU blip."],
  },
  codeRepo: {
    what: "Where your source code lives (GitHub, GitLab).",
    analogy: "The recipe book.",
    useWhen: ["Delivery pipelines start here."],
    terms: [{ name: "Commit", meaning: "A saved change to the code." }],
    watchOut: ["Doesn't serve user traffic."],
  },
  ciPipeline: {
    what: "Automatically builds, tests and deploys your code when it changes.",
    analogy: "A factory line that checks every product before it ships.",
    useWhen: ["Shipping changes safely and often."],
    terms: [{ name: "Deploy", meaning: "Putting a new version in front of users." }],
    watchOut: ["Doesn't serve user traffic."],
  },
  containerRegistry: {
    what: "Stores packaged versions (images) of your app ready to deploy.",
    analogy: "A warehouse of boxed, ready-to-ship products.",
    useWhen: ["Container-based deployments."],
    terms: [{ name: "Image", meaning: "Your app and everything it needs, packaged to run anywhere." }],
    watchOut: ["Doesn't serve user traffic."],
  },
  llm: {
    what: "A large language model (Claude, GPT and others) your servers call to generate text, answer questions or write code.",
    analogy: "An expert you phone for help: brilliant, but each call takes time and costs money.",
    useWhen: ["Chat assistants, summaries, search answers, code generation."],
    terms: [
      { name: "Latency", meaning: "Model calls take hundreds of milliseconds to seconds, far slower than a database." },
      { name: "Rate limits", meaning: "Providers cap calls per minute; spread load or queue requests." },
    ],
    watchOut: ["Slow and expensive: cache repeated answers and stream responses."],
  },
  fineTune: {
    what: "Trains a model further on your own examples so it fits your task better.",
    analogy: "Training a new hire on your company's way of doing things.",
    useWhen: ["A general model isn't good enough at a narrow, repeated task."],
    terms: [{ name: "Training data", meaning: "Example inputs and ideal outputs." }],
    watchOut: ["Doesn't serve user traffic directly."],
  },
};

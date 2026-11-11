# Component reference

Every building block in SysLab, in plain words. This is the same guide shown under **In plain words** when you double-click a component on the canvas (generated from `data/component-guide.ts`).

Named real-world services (AWS ALB, Redis, PostgreSQL, Kafka, Claude…) behave like one of these building blocks, with their own capacity, latency and price. For the settings that change the simulation (cache policies, connection pools, autoscaling and more), see [simulator.md](simulator.md#component-settings).

## Contents

- [Client](#client)
- [DNS](#dns)
- [CDN](#cdn)
- [Load balancer](#load-balancer)
- [API gateway](#api-gateway)
- [Rate limiter](#rate-limiter)
- [Application gateway](#application-gateway)
- [WebSocket gateway](#websocket-gateway)
- [App server](#app-server)
- [Serverless function](#serverless-function)
- [Cache](#cache)
- [SQL database](#sql-database)
- [NoSQL database](#nosql-database)
- [Time-series database](#time-series-database)
- [Queue](#queue)
- [Worker](#worker)
- [Object storage](#object-storage)
- [Search engine](#search-engine)
- [Lock service](#lock-service)
- [Coordination service (ZooKeeper / etcd)](#coordination-service-zookeeper--etcd)
- [Monitoring](#monitoring)
- [Code repository](#code-repository)
- [CI/CD pipeline](#cicd-pipeline)
- [Container registry](#container-registry)
- [LLM (AI model)](#llm-ai-model)
- [Fine-tuning](#fine-tuning)

## Client

The people (or apps) sending requests to your system. It's where the traffic starts.

> *Like customers walking into a shop.*

**Use it when**

- Every design starts here. Connect it to the first thing users hit: DNS, a CDN or a load balancer.

**Words you'll see**

| Term | Meaning |
| --- | --- |
| Requests per second (req/s) | How many requests arrive every second. Set it in the Traffic panel. |
| Read / write share | Reads look things up (open a page); writes change something (place an order). |

**Watch out for**

- Users don't arrive evenly: plan for the busiest minute, not the average.

**Rule of thumb:** Peak traffic is often 2–5× the daily average.

## DNS

Turns a name like shop.com into the address of your servers.

> *Like a phone book: look up a name, get a number.*

**Use it when**

- At the very front, so users can reach you by name.
- To send users to the nearest region or away from a failed one.

**Words you'll see**

| Term | Meaning |
| --- | --- |
| TTL | How long browsers remember the answer. Short TTLs let you move traffic quickly in an emergency. |
| Health-checked routing | Managed DNS can stop pointing at a region that's down. |

**Watch out for**

- DNS answers are cached everywhere, so changes take minutes to reach everyone.

**Rule of thumb:** Lookups are usually cached, so DNS adds almost no time to most requests.

## CDN

A network of servers near your users that keeps copies of files (images, scripts, videos) and serves them from close by.

> *Like vending machines in every neighbourhood instead of one central warehouse.*

**Use it when**

- Lots of images, video or other files that are the same for everyone.
- Users spread across countries.
- You expect sudden spikes (a CDN absorbs them).

**Words you'll see**

| Term | Meaning |
| --- | --- |
| Cache hit | The edge already had the file and answered without bothering your servers. |
| Origin | Your own storage or servers, asked only when the edge doesn't have a copy. |

**Watch out for**

- Never cache personal pages under a shared address: one user could see another's data.
- A purge or new release can send a burst of misses to your origin.

**Rule of thumb:** A good CDN serves 90–99% of static files without touching your servers.

## Load balancer

Spreads incoming requests across several identical servers and stops sending to any that break.

> *Like a host at a restaurant seating guests at whichever table is free.*

**Use it when**

- You run more than one app server.
- You need to survive a server dying, or deploy without downtime.

**Words you'll see**

| Term | Meaning |
| --- | --- |
| Round robin | Takes turns: server 1, 2, 3, 1, 2, 3… Simple and even when requests cost the same. |
| Least connections | Sends each request to the least busy server. Best when some requests are slow. |
| IP hash (sticky) | The same user always lands on the same server. Handy for sessions, but load can get uneven. |
| Health checks | Regularly asks each server 'are you OK?' and stops sending traffic to ones that don't answer. |

**Watch out for**

- A single load balancer is itself a single point of failure: use a managed one or two.
- Without health checks, users keep hitting a dead server.

**Rule of thumb:** Keep app servers stateless so the balancer can send anyone anywhere.

## API gateway

The single front door for your APIs: checks who's calling, applies limits and routes each request to the right service.

> *Like reception at an office: check ID, sign in, point you to the right floor.*

**Use it when**

- Several services behind one public address.
- You need sign-in checks, rate limits or API keys in one place.

**Words you'll see**

| Term | Meaning |
| --- | --- |
| Authentication | Proving who the caller is (a token or API key). |
| Routing | /orders goes to the order service, /users to the user service. |

**Watch out for**

- Every request passes through it: give it enough replicas.
- It adds a few milliseconds to each call.

## Rate limiter

Caps how many requests each caller can make, so one noisy client can't hurt everyone else.

> *Like a bouncer letting in a few people at a time.*

**Use it when**

- Public APIs.
- Login and sign-up pages (to stop password guessing).
- Protecting an expensive service.

**Words you'll see**

| Term | Meaning |
| --- | --- |
| Token bucket | Each caller gets a bucket of tokens that refills steadily; every request spends one. Short bursts are fine, floods aren't. |
| 429 Too Many Requests | The polite 'slow down' answer, ideally with a Retry-After time. |

**Watch out for**

- Limiting by IP alone punishes everyone behind one office network.

## Application gateway

An all-in-one front door: firewall, rate limits, sign-in checks and load balancing in one component.

> *Like airport security, check-in and gate assignment at one desk.*

**Use it when**

- You want a single managed entry point instead of separate pieces.

**Words you'll see**

| Term | Meaning |
| --- | --- |
| WAF | Web application firewall: blocks known attack patterns before they reach your code. |

**Watch out for**

- Convenient, but it's one more critical box: run it redundantly.

## WebSocket gateway

Keeps long-lived connections open to users so the server can push updates instantly (chat, live scores).

> *Like an open phone line instead of calling back every few seconds.*

**Use it when**

- Chat, notifications, live dashboards, multiplayer games.

**Words you'll see**

| Term | Meaning |
| --- | --- |
| Connection | One open line per user; a gateway can hold tens of thousands. |

**Watch out for**

- Connections are stateful: when a gateway restarts, its users must reconnect.

**Rule of thumb:** Plan roughly 50,000 connections per gateway instance.

## App server

Runs your application code: handles each request, talks to caches and databases, and returns a response.

> *Like the cooks in a kitchen.*

**Use it when**

- Almost always: this is where your business logic lives.

**Words you'll see**

| Term | Meaning |
| --- | --- |
| Replicas | Identical copies. Three replicas handle three times the traffic and survive one dying. |
| Stateless | Keeps nothing important in memory between requests, so any copy can serve anyone. |
| % busy | How much of its capacity is used. Above ~70% requests start to queue and slow down. |

**Watch out for**

- Adding app servers doesn't help if the database behind them is the bottleneck.
- One replica is a single point of failure.

**Rule of thumb:** Keep peak utilisation around 70–80% so a spike or a lost server doesn't tip you over.

## Serverless function

Runs your code on demand without managing servers; it scales up and down automatically.

> *Like hiring temp staff for each job instead of keeping a full team.*

**Use it when**

- Spiky or occasional workloads.
- Background jobs and small APIs.

**Words you'll see**

| Term | Meaning |
| --- | --- |
| Cold start | The first request after a quiet period waits while a new instance starts. |

**Watch out for**

- Can flood a database with connections when it scales up fast.

## Cache

Keeps recently or frequently used data in memory so repeat requests are answered instantly, without asking the database.

> *Like keeping the most-asked-for items at the front counter instead of walking to the back store every time.*

**Use it when**

- Many reads of the same few items (popular products, profiles, feeds).
- The database is overloaded by reads.
- Responses must be very fast.

**Words you'll see**

| Term | Meaning |
| --- | --- |
| Hit ratio | Share of reads answered from the cache. 90% means only 1 in 10 reads reaches the database. |
| Cache size | How much it can hold. Bigger holds more popular items (higher hit ratio) but costs more. |
| Eviction policy | What gets thrown out when it's full: least recently used (LRU), least frequently used (LFU), oldest first (FIFO) or random. |
| TTL (time to live) | How long an item is kept before it's refreshed. Short = fresher data but more misses; long = faster but possibly stale. |
| Write policy | Cache-aside: the app fills the cache on a miss. Write-through: every write updates the cache too. Write-back: writes go to the cache first and reach the database later. |

**Watch out for**

- Useless when reads are spread evenly over millions of items: most lookups miss.
- After a restart the cache is empty (cold) and everything hits the database at once.
- Write-back can lose recent writes if the cache crashes before flushing.

**Rule of thumb:** Database load after a cache = reads × (1 − hit ratio).

## SQL database

A relational database (PostgreSQL, MySQL): tables with rows and columns, strong consistency and transactions.

> *Like a well-organised filing cabinet where every change is recorded carefully.*

**Use it when**

- Money, orders, inventory, accounts: anything that must be exactly right.
- You need joins and flexible queries.

**Words you'll see**

| Term | Meaning |
| --- | --- |
| Primary | The one copy that accepts all writes. |
| Read replicas | Extra copies that serve reads. They add read capacity, not write capacity. |
| Indexes | Like a book's index: find rows without reading the whole table. Each index slows writes a little. |
| Max connections | How many queries it can work on at once. Too few and requests wait in line even when the CPU is idle. |

**Watch out for**

- Usually the first thing to run out of capacity.
- All writes go to one primary: replicas won't fix a write bottleneck (shard or queue instead).
- A missing index turns a 1 ms lookup into a full table scan.

**Rule of thumb:** A typical instance handles ~1,000 queries/s; each connection runs about 1000 ÷ latency(ms) queries/s.

## NoSQL database

A database built to scale out (DynamoDB, Cassandra, MongoDB): simple lookups by key, spread across many machines.

> *Like many small lockers, each opened by its own key, instead of one big cabinet.*

**Use it when**

- Huge volumes of simple reads and writes by key.
- Write-heavy data like events, sessions, messages.

**Words you'll see**

| Term | Meaning |
| --- | --- |
| Partition key | Decides which machine stores each item. Pick one that spreads load evenly. |
| Eventual consistency | A read right after a write may briefly return the old value. |

**Watch out for**

- Complex queries and joins are hard or slow.
- A 'hot' key (one celebrity) still lands on one machine.

## Time-series database

A database tuned for timestamped measurements: metrics, sensor readings, prices over time.

> *Like a logbook where every line starts with the time.*

**Use it when**

- Lots of append-only readings queried by time range.

**Words you'll see**

| Term | Meaning |
| --- | --- |
| Retention | How long old data is kept before it's rolled up or deleted. |

**Watch out for**

- Not meant for updating individual records.

## Queue

A waiting line for work: the app drops a job in and answers the user right away; workers pick jobs up later.

> *Like an order ticket rail in a kitchen: the waiter clips the ticket and goes back to customers.*

**Use it when**

- Anything the user doesn't need to wait for: emails, thumbnails, notifications.
- Absorbing spikes so the database isn't flooded.

**Words you'll see**

| Term | Meaning |
| --- | --- |
| Producer / consumer | Producers add jobs; consumers (workers) take them off. |
| Backlog | Jobs waiting. It's fine if it grows during a spike and shrinks after. |
| At-least-once | A job can be delivered twice after a crash, so workers must handle duplicates. |

**Watch out for**

- If workers are slower than arrivals for too long, the backlog grows forever.
- Don't put work the user is waiting to see behind a queue.

## Worker

Background servers that take jobs from a queue and do the slow work.

> *Like kitchen staff working through the order tickets.*

**Use it when**

- Behind a queue, to process jobs at a steady pace.

**Words you'll see**

| Term | Meaning |
| --- | --- |
| Throughput | Jobs finished per second. Add workers to drain a backlog faster. |

**Watch out for**

- Make jobs safe to run twice (idempotent).

## Object storage

Cheap, practically unlimited storage for files: photos, videos, backups (S3, GCS).

> *Like a self-storage warehouse: put anything in, get it back by its label.*

**Use it when**

- Any file bigger than a few kilobytes.
- As the source behind a CDN.

**Words you'll see**

| Term | Meaning |
| --- | --- |
| Object key | The file's name/path, which you store in the database. |
| Signed URL | A short-lived link that lets a user upload or download one file directly. |

**Watch out for**

- Don't send uploads through your app servers: let users upload straight to storage.

**Rule of thumb:** About $0.02 per GB per month.

## Search engine

A search engine (Elasticsearch, OpenSearch) that finds documents by the words in them, fast, and ranks the best matches.

> *Like a library catalogue that lists every book containing a word.*

**Use it when**

- Search boxes, autocomplete, filtering by many fields.

**Words you'll see**

| Term | Meaning |
| --- | --- |
| Inverted index | A list of every word and the documents that contain it. |

**Watch out for**

- It's a copy of your data, a few seconds behind the database.

## Lock service

A lock service: makes sure only one server at a time can do something, like booking seat 12A.

> *Like a single key to a meeting room: whoever holds it gets the room.*

**Use it when**

- Two people could grab the same thing at once: seats, the last item in stock, usernames.

**Words you'll see**

| Term | Meaning |
| --- | --- |
| Contended writes | Writes racing for the same item. Without a lock, both can win. |
| Lock expiry | Locks time out so a crashed server doesn't hold one forever. |

**Watch out for**

- Holding a lock during slow work (calling a payment provider) makes everyone wait.

## Coordination service (ZooKeeper / etcd)

A coordination service (ZooKeeper, etcd): a small cluster that agrees by majority vote, used for locks and electing a leader.

> *Like a committee that only decides when most members agree.*

**Use it when**

- Leader election, distributed locks, shared configuration.

**Words you'll see**

| Term | Meaning |
| --- | --- |
| Quorum | A majority of nodes. 3 nodes survive 1 failure; 5 survive 2. |

**Watch out for**

- Always use an odd number (3 or 5): 2 or 4 nodes add cost without extra safety.

## Monitoring

Collects metrics, logs and traces, and alerts someone when things go wrong.

> *Like the dashboard and warning lights in a car.*

**Use it when**

- Always, in production.

**Words you'll see**

| Term | Meaning |
| --- | --- |
| Alert | A page to the on-call engineer when users are affected (errors, slowness). |

**Watch out for**

- Alert on what users feel, not on every CPU blip.

## Code repository

Where your source code lives (GitHub, GitLab).

> *Like the recipe book.*

**Use it when**

- Delivery pipelines start here.

**Words you'll see**

| Term | Meaning |
| --- | --- |
| Commit | A saved change to the code. |

**Watch out for**

- Doesn't serve user traffic.

## CI/CD pipeline

Automatically builds, tests and deploys your code when it changes.

> *Like a factory line that checks every product before it ships.*

**Use it when**

- Shipping changes safely and often.

**Words you'll see**

| Term | Meaning |
| --- | --- |
| Deploy | Putting a new version in front of users. |

**Watch out for**

- Doesn't serve user traffic.

## Container registry

Stores packaged versions (images) of your app ready to deploy.

> *Like a warehouse of boxed, ready-to-ship products.*

**Use it when**

- Container-based deployments.

**Words you'll see**

| Term | Meaning |
| --- | --- |
| Image | Your app and everything it needs, packaged to run anywhere. |

**Watch out for**

- Doesn't serve user traffic.

## LLM (AI model)

A large language model (Claude, GPT and others) your servers call to generate text, answer questions or write code.

> *Like an expert you phone for help: brilliant, but each call takes time and costs money.*

**Use it when**

- Chat assistants, summaries, search answers, code generation.

**Words you'll see**

| Term | Meaning |
| --- | --- |
| Latency | Model calls take hundreds of milliseconds to seconds, far slower than a database. |
| Rate limits | Providers cap calls per minute; spread load or queue requests. |

**Watch out for**

- Slow and expensive: cache repeated answers and stream responses.

## Fine-tuning

Trains a model further on your own examples so it fits your task better.

> *Like training a new hire on your company's way of doing things.*

**Use it when**

- A general model isn't good enough at a narrow, repeated task.

**Words you'll see**

| Term | Meaning |
| --- | --- |
| Training data | Example inputs and ideal outputs. |

**Watch out for**

- Doesn't serve user traffic directly.

# SysLab

A personal, interactive system design lab. Drag components onto a canvas, wire them up, and run a **deterministic simulator** that shows load, latency, errors, bottlenecks, single points of failure and cost. Three guided challenges score your designs from 0 to 100.

Everything runs locally in your browser. There's no backend and no account. **Every metric is simulated** by a simple, documented model, not measured on real infrastructure.

## Run it

Requires Node 22+ (developed on Node 24).

```bash
npm install
npm run dev          # http://localhost:3000
```

Other scripts:

| Command | What it does |
| --- | --- |
| `npm test` | Vitest: simulator, scoring, challenge data, storage (41 tests) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run build` / `npm start` | Production build / serve it |

## Using it

- **Lab** (`/lab`): free-form canvas. Drag a component from the palette, or focus it and press Enter to drop it at the center. Connect nodes by dragging from a node's right handle to another node's left handle, or with **Send traffic to** in the properties panel (keyboard friendly). Press **Run simulation** (or ⌘/Ctrl + Enter). Nodes turn green, amber or red, and edges animate in proportion to traffic. Your canvas autosaves as a draft; **Save** keeps named designs.
- **Challenges** (`/challenges`): fixed traffic, a limited palette, objectives, 3 progressive hints, and an explanation. Each run is scored and recorded.
- **Progress** (`/progress`): XP, current and longest streak, a 12-week activity grid, best scores, and saved designs.
- **Dashboard** (`/`): your next unpassed challenge plus a summary.

## How the simulator works (`lib/sim`)

Pure TypeScript: no React, no randomness, no I/O. The same input always gives the same output (this is tested).

- **Traffic** is split into reads, writes and static assets, from the profile (RPS, read ratio, hot-key fraction, static share), and spread evenly across Client nodes.
- **Routing:** load balancers and API gateways split each traffic type evenly across downstream nodes that accept it. App servers send reads to a **cache**, then **stores**, then other compute. Writes go to a **queue**, then **databases**, then other stores. CDNs absorb static traffic. An app server with no downstream serves requests itself. If its preferred tier is down it falls back to the next tier (cache down → DB), and if every tier is down the traffic fails.
- **Cache hit ratio** = `(hot × 0.95 + cold × 0.3) × (1 − e^(−GB/6))`, capped at 98%. A cache with no outgoing link sends misses to the databases its parent uses (cache-aside).
- **Queues** acknowledge writes immediately and deliver them asynchronously. If downstream can't keep up, the excess shows up as **backlog**, not client errors.
- **Capacity:** `capacity × replicas`. **SQL replicas are read replicas**: writes are limited to the primary.
- **Overload:** a node at utilization `u > 1` serves `1/u` of its traffic and drops the rest. Latency is multiplied by a queueing factor: flat to 50% utilization, rising to 5× at 100%.
- **Single points of failure:** each single-replica component is failed in turn (load balancers route around it). If at least 10% of traffic then has no path, it's a SPOF. CDNs, object storage, clients and monitoring are treated as inherently redundant.
- **Health:** critical if more than 5% of requests fail; degraded if more than 0.5% fail, there's backlog, or any bottleneck exists.

## Challenges (`data/challenges/*.json`)

Each file defines the scenario, objectives (`metric op value`), the starting graph, fixed traffic, allowed components, 3 hints, scoring weights, a latency target, a cost budget, and the explanation. To add one, drop in a JSON file and list it in `data/challenges/index.ts`. `challenges.test.ts` validates the shape and proves that each starting design fails and a reference solution passes.

**Score** (`lib/challenges/score.ts`) is a weighted average of four 0–100 categories, all computed from simulator output:

- **Performance:** error rate (60%) and latency against the target (40%)
- **Reliability:** penalties for SPOFs, backlog, components at 80% utilization or more, and error rate above 1%
- **Cost:** full points within budget, dropping to zero at 2× budget
- **Architecture:** penalties for design issues, unroutable traffic, missing monitoring, disallowed components, and components that receive no traffic

**Pass** means every objective is met. **XP** is 1 per best-score point plus 50 on first pass; only improvements earn more.

## Storage (`lib/storage`)

The app talks only to an async `StorageDriver` (`get`, `set`, `remove`) through a small repository (designs, drafts, progress). `getRepo()` in `lib/storage/index.ts` wires in the localStorage driver. To move to Supabase, write one driver that implements the same three methods and swap it there. Keys are namespaced `syslab:v1:*`.

## Folder structure

```
app/                 routes: / (dashboard), /challenges, /challenges/[id], /lab, /progress
components/
  shell/             sidebar, mobile nav, logo, page header
  lab/               canvas (designer), nodes, edges, palette, inspector, metrics, save/load/reset
  challenges/        challenge list, challenge page, score card
  progress/          dashboard + progress views, activity grid
  ui/                shadcn/ui (Base UI) primitives
lib/
  sim/               deterministic simulation engine + tests
  challenges/        challenge types + scoring
  storage/           storage driver + repository + tests
data/
  challenges/        challenge JSON + loader + tests
  lab-starter.ts     the Lab's starting design
```

## Unfinished and known limitations

- **No Supabase driver yet.** The interface is ready, but only localStorage is implemented, so data lives in one browser and is lost if you clear site data. There's no export or import.
- **Model simplifications:** no network partitions, regions or tail latency (only averages). Load balancers always split evenly (no weighted or least-connections routing). Writes don't invalidate the cache. Queue consumers drain at the arrival rate. Monitoring affects only the challenge score, not the simulation.
- **Saved challenge designs** open from that challenge's **Load** menu. The Progress page links to the challenge, not directly to the design.
- **Touch devices:** dragging from the palette uses HTML5 drag-and-drop, which doesn't work on touch screens. Tapping a palette item to add it at the center does. The canvas is usable on phones but cramped.
- **Canvas editing:** no undo/redo, no copy/paste, and no multi-select property editing.
- **Unknown challenge URLs** show the not-found page, but return HTTP 200 instead of 404, because the page streams (Next.js partial prerendering).
- **No browser test suite is committed.** The Lab, challenge and progress flows were checked by hand with headless Chrome during development; only unit tests run in `npm test`.
- Only the 3 required challenges ship.

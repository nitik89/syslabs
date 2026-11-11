# SysLab

**Learn system design by breaking things.** Draw how an app is built (load balancers, servers, caches, databases, queues), push realistic traffic through it, watch exactly where it fails, and fix it until every test passes, including the hidden ones.

**Live:** https://syslab-blond.vercel.app · Free · No sign-up needed (sign in to sync progress and join the leaderboard)

![The SysLab landing page: a live 3D scene of a database melting down under traffic](docs/screenshots/landing.png)

> Every number in SysLab (latency, errors, cost) comes from a documented, deterministic **model**, not from real infrastructure. It's built for learning trade-offs, not for benchmarking hardware. See [docs/simulator.md](docs/simulator.md).

---

## What's inside

| | |
| --- | --- |
| **52 problems** | 16 *challenges* (fix a broken system that's failing in production) and 36 *build* problems (design a product from scratch: shopping app, chat, food delivery, digital wallet, short-video feed…). |
| **Tests on every problem** | Visible tests on every run, plus two hidden tests on Submit: a 30% viral spike and a cache restart. |
| **30 lessons** | Design foundations with an animated diagram, a deep dive, a worked example, trade-offs, common mistakes and interview tips. |
| **8 mock interviews** | 45 minutes, timed: requirements, estimates, a design, and a twist halfway through. Scorecard against the E4/E5/E6 bar. |
| **73 flashcards** | Spaced repetition (1, 3, 7, 16, 35 days). |
| **Roadmap** | Six stages from foundations to advanced, each ending in a checkpoint problem. |
| **110+ components** | 26 building blocks and 86 real services (AWS, Redis, Kafka, PostgreSQL, Claude…), each with plain-language explanations. |
| **Guided tours** | A site tour on the first visit, a workspace tour on the first problem, and *Solve it with me*: a real problem solved live on the canvas. |
| **Community** | Accounts (Google, GitHub, email), streaks, XP, public profiles, a leaderboard of server-verified scores, and shareable designs. |
| **Light and dark themes**, phones and tablets | |

---

## A tour in pictures

### 1. Start with the problem, see it failing

Fix-it challenges open with the broken system already running. The pager alert sits above the problem; components turn amber or red under load and the console shows which tests fail and why.

![Workspace: the problem on the left, the failing system on the canvas, test results and charts in the console](docs/screenshots/workspace.png)

### 2. Add components, connect them, tune them

**Add component** opens a searchable drawer of 110+ components. Drag from a component's right dot to another's left dot to connect them. Double-click a component for its settings.

![The components drawer over the canvas](docs/screenshots/components-drawer.png)

Every component explains itself **in plain words** (what it is, an everyday comparison, when to use it, terms, what to watch out for) and has settings that really change the simulation: cache eviction, TTL and write policy; database connection pools, indexes and consistency; load-balancer algorithms and health checks; autoscaling; machine size; request timeouts; CDN TTL.

| Plain-words guide | Settings with live readouts |
| --- | --- |
| ![The plain-words guide for a cache](docs/screenshots/component-guide.png) | ![Cache policies and machine size, with the live hit ratio](docs/screenshots/component-settings.png) |

### 3. Change the traffic: from a quiet night to going viral

One click switches the load (**Quiet night, Normal day, Lunch rush, Launch day, Gone viral**). The **Traffic** panel sets reads, writes and static files per second, hot keys, contended writes and AI share. On problem pages it's a *what-if*: Submit always grades against the brief.

![The Traffic panel with reads, writes and presets](docs/screenshots/traffic-panel.png)

### 4. Run, read the results, see it in 3D

**Run** pushes 60 seconds of traffic through your design: p50/p95/p99 latency, errors, cost, cache hits, the busiest component, and what to fix next. The **3D** tab shows your own design as towers (height = load, colour = health).

![The run console in 3D](docs/screenshots/run-3d.png)

### 5. Never stuck: tours, a guided solve, articles

The workspace tour shows every gesture with a small animation and a concrete example. **Solve it with me** builds a real fix on the canvas: diagnose, add a cache, run (still failing), make it bigger, run again (green). Then you press Submit.

| Workspace tour | Guided solve |
| --- | --- |
| ![Tour step: adding a component, with an animation](docs/screenshots/workspace-tour.png) | ![Guided solve: the database back under its limit](docs/screenshots/guided-solve.png) |

Each problem's **Articles** tab links the Learn lessons it relies on.

### 6. Learn the ideas

| Lessons, grouped by stage | A lesson: diagram, deep dive, worked example |
| --- | --- |
| ![The Learn page](docs/screenshots/learn.png) | ![The caching lesson](docs/screenshots/lesson.png) |

### 7. Practise

| Challenges | Build problems |
| --- | --- |
| ![Challenge cards](docs/screenshots/challenges.png) | ![Build problem cards with categories](docs/screenshots/build.png) |

| Roadmap | Mock interviews | Flashcards |
| --- | --- | --- |
| ![Roadmap](docs/screenshots/roadmap.png) | ![Mock interviews](docs/screenshots/interviews.png) | ![Flashcards](docs/screenshots/flashcards.png) |

### 8. Light theme, phones and tablets

![Light theme: a solved Food Delivery design](docs/screenshots/light-theme.png)

| Home | Learn | Workspace |
| --- | --- | --- |
| <img src="docs/screenshots/mobile-home.png" alt="Phone: home" width="260"> | <img src="docs/screenshots/mobile-learn.png" alt="Phone: learn" width="260"> | <img src="docs/screenshots/mobile-workspace.png" alt="Phone: workspace" width="260"> |

On phones the workspace switches between **Problem / Design / Results**; tablets get an icon rail; touch screens get bigger connection handles.

### First visit

![The welcome tour](docs/screenshots/site-tour.png)

---

## Run it locally

Requires **Node 22+** (developed on Node 24).

```bash
npm install
npm run dev            # http://localhost:3000
```

Without Supabase settings the app runs in **guest mode**: everything works and saves in the browser; sign-in, sharing and the leaderboard are hidden. To enable accounts, see [docs/accounts-setup.md](docs/accounts-setup.md).

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm test` | Unit tests (Vitest): simulator, scoring, every problem's reference solution, lessons, grading, storage (288 tests) |
| `npm run e2e` | Browser tests (Playwright, your installed Chrome) against a production build (13 tests). `E2E_PORT=3000 npm run e2e` reuses a running dev server instead |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run build` / `npm start` | Production build / serve it |

---

## How it's built

| Layer | Technology |
| --- | --- |
| App | **Next.js 16** (App Router, Cache Components), **React 19**, TypeScript |
| UI | Tailwind CSS v4, shadcn/ui (Base UI), lucide icons, Recharts |
| Canvas | React Flow (`@xyflow/react`) |
| 3D | three.js, loaded only when a scene is on screen (phones and low-power devices get 2D) |
| Simulator | Pure TypeScript in `lib/sim`: deterministic, no I/O, runs in the browser and on the server |
| Accounts and data | **Supabase** (Postgres + Auth) with row-level security |
| Hosting | **Vercel** (pages at the edge, `/api/grade` as a serverless function) |

```
app/                 routes: /, /learn, /challenges, /build, /lab, /interview, /api/grade, …
components/
  lab/               canvas, component settings, traffic panel, run console
  challenges/        problem workspace, problem panel, tours, guided solve
  learn/ landing/    lesson diagrams, 3D scenes
  shell/             navigation, theme, site tour
data/                problems (JSON), lessons, diagrams, deep dives, flashcards, roadmap, component guide
lib/
  sim/               the simulator: engine, catalog of components, 60-second timeline
  challenges/        scoring, test cases, hidden tests, articles
  grading/           server-side grading for verified scores
  storage/           local and Supabase storage behind one interface
supabase/            SQL migrations and branded auth email templates
e2e/                 Playwright browser tests
docs/                guides (below) and screenshots
```

## Documentation

| Guide | For |
| --- | --- |
| [docs/user-guide.md](docs/user-guide.md) | Learners: how to use every part of SysLab, step by step |
| [docs/components.md](docs/components.md) | Every building block explained in plain words |
| [docs/simulator.md](docs/simulator.md) | How the simulation works: routing, capacity, caching, settings, scoring, hidden tests |
| [docs/architecture.md](docs/architecture.md) | Developers: code layout, data flow, storage, accounts, grading, tours, theming |
| [docs/content-authoring.md](docs/content-authoring.md) | Adding problems, lessons, diagrams and flashcards (and how they're validated) |
| [docs/deployment.md](docs/deployment.md) | Deploying to Vercel with Supabase: env vars, migrations, emails |
| [docs/testing.md](docs/testing.md) | What the tests cover and how to run them |
| [docs/accounts-setup.md](docs/accounts-setup.md) | Supabase project, sign-in providers, URL configuration, email templates |

# Architecture

How the code is organised and how the pieces talk to each other.

## Overview

```
Browser (Next.js app, React 19)
 ├── Pages (app/)               static where possible; dynamic routes read params inside <Suspense>
 ├── Workspace (components/lab, components/challenges)
 │     React Flow canvas ──► lib/sim (simulate / simulateTimeline) ──► run console, 3D view
 ├── Storage (lib/storage)      one interface: localStorage for guests, Supabase when signed in
 └── Tours (components/challenges/workspace-tour, components/shell/site-tour)

Server (Vercel)
 ├── Static pages and assets at the edge
 └── POST /api/grade            re-runs lib/sim + hidden tests, writes verified_scores

Supabase
 ├── Auth (Google, GitHub, email link, email + password)
 └── Postgres: profiles, user_data, shared_designs, verified_scores (+ row-level security, RPC functions)
```

## Folders

| Path | What's there |
| --- | --- |
| `app/` | Routes. `layout.tsx` sets fonts, the theme boot script, auth and the app shell. Dynamic pages (`/learn/[id]`, `/challenges/[id]`, `/u/[username]`, `/d/[id]`…) read their params inside `<Suspense>` (Next 16 Cache Components). `api/grade/route.ts` is the only server endpoint. |
| `components/shell/` | App shell: sidebar (full on desktop, icon rail on tablets and canvases), phone bottom tab bar, stats bar, theme toggle, command menu (⌘K), site tour. |
| `components/lab/` | The designer: canvas (`designer.tsx`), component node, palette, inspector, `component-settings.tsx`, traffic panel and scenario switch, run console, 3D tab. |
| `components/challenges/` | Problem workspace (`challenge-client.tsx`), problem panel (tabs, articles), test results, tours and the guided solve, problem lists. |
| `components/learn/`, `components/landing/` | Lesson diagrams (SVG), 3D scenes (three.js). |
| `components/interview/`, `review/`, `roadmap/`, `progress/`, `community/`, `auth/` | Mock interviews, flashcards, roadmap, dashboard and progress, leaderboard/profiles/shared designs, sign-in. |
| `data/` | Content: problems (`challenges/*.json`, `designs/*.json`), lessons, diagrams, deep dives, flashcards, interviews, roadmap, component guide. |
| `lib/sim/` | The simulator (see [simulator.md](simulator.md)). |
| `lib/challenges/` | Scoring, test cases, hidden tests, related lessons. |
| `lib/interview/` | Mock-interview scorecard. |
| `lib/grading/` | Server-side grading (pure) and the client helper that calls it. |
| `lib/storage/` | Storage drivers (local, Supabase, switching), progress/XP/streak rules, flashcard scheduling, backup import/export, guest → account migration. |
| `lib/supabase/` | Browser Supabase client and public data fetchers. |
| `supabase/` | SQL migrations and auth email templates. |

## The workspace

`Designer` (`components/lab/designer.tsx`) owns the canvas state: nodes, edges, traffic, requirements, the last result and timeline, undo history, and UI state (drawers, panels, phone pane). Problem pages wrap it in `ChallengeClient`, which supplies the header, problem panel, test status, submission and tours through props (`header`, `leftPanel`, `consoleTabs`, …).

- **Run:** `simulateTimeline(graph, traffic)` produces 60 one-second results; the canvas, console and 3D view replay them.
- **Submit:** re-simulates against the brief's traffic with locked specs, scores (`scoreChallenge`), runs hidden tests, records progress locally, and for signed-in users calls `/api/grade`.
- **Drafts** autosave after each change (debounced) and reload with the brief's traffic.
- **Tours** talk to the designer through window events: `syslab:components` opens or closes the components drawer, and `syslab:demo` sends commands (add, connect, config, select, run) used by *Solve it with me*. Commands are idempotent, so stepping back and forth is safe.

## Storage, accounts and sync

`getRepo()` returns a repository over a **switching driver**:

- **Guests:** `localStorage` keys (`progress`, `designs`, `draft:*`, `cards`, `interviews`).
- **Signed in:** the same keys as rows in Supabase `user_data` (one row per key, row-level security: owner only).
- **First sign-in on a browser:** guest data is merged into the account (best score per problem, union of designs, days and cards).

Public data goes through security-definer RPCs that return only totals: `leaderboard()` and `public_profile(username)`. Shared designs are read-only snapshots in `shared_designs`.

## Verified scores

`/api/grade` verifies the caller's access token with Supabase, grades the design with `grade()` (pure: validate shape and size → lock specs → simulate → score → hidden tests), and calls `record_verified_score` with the server's secret key. That function keeps the best score and the first pass. `verified_scores` has no insert/update policies, so browsers can read their own rows but never write. Migration `0002` switches the leaderboard and profiles to verified results.

## Theming

Colours are CSS variables in `app/globals.css`, with a dark set (default) and a light set on `:root.light`. `white`/`black` utilities map to theme-aware `--ink`/`--shade` so overlays work in both themes. A tiny boot script in `<head>` applies the saved theme before the first paint. The canvas, toasts and 3D scenes follow the theme.

## Performance

- three.js loads only when a 3D scene is near the viewport and the browser is idle; phones, low-power devices and Data Saver users get the 2D fallback without downloading it. Scenes render at 30 fps, pause off-screen and cap the pixel ratio at 1.5.
- Problem and lesson pages are prerendered; the simulator runs client-side (milliseconds per run).

# Testing

```bash
npm test            # unit tests (Vitest), ~2 s
npm run e2e         # browser tests (Playwright) against a production build
npm run typecheck
npm run lint
```

## Unit tests (Vitest)

Run from `lib/**/*.test.ts` and `data/**/*.test.ts`. Highlights:

| Area | What's checked |
| --- | --- |
| Simulator (`lib/sim`) | Routing, capacity and queueing, caches, queues, locks, AI calls, single points of failure, determinism; the 60-second timeline and percentiles; every component setting (cache policies, connection pools, write-back, load-balancer algorithms and health checks, autoscaling, CDN TTL, NoSQL consistency, machine size, timeouts) in `policies.test.ts`; locked specs and cache pricing in `specs-lock.test.ts` |
| Problems (`data/challenges`, `data/designs`) | Every problem is well-formed; every **starting design fails**; every **reference solution passes every objective and both hidden tests** within budget; behaviour tests (for example "a small cache isn't enough", "a queue in front of Postgres just builds a backlog") |
| Content (`data/`) | Every lesson has a diagram and a deep dive; diagram edges point at real nodes; the roadmap covers every problem; every problem has related lessons and every lesson its practice problem |
| Scoring and grading | Score categories, test cases, hidden tests, the mock-interview scorecard, server grading (`lib/grading`): honest designs pass, cheat numbers don't help, malformed or oversized input is rejected |
| Storage | Progress and XP rules, streaks, flashcard scheduling, backup import/export, guest → account merging |

## Browser tests (Playwright)

`e2e/smoke.spec.ts` uses your installed Google Chrome (no browser download). By default `npm run e2e` builds the app and serves it with `next start` on port 3100, so tests run against the real production bundle with no on-demand compilation. To test a running dev server instead:

```bash
E2E_PORT=3000 npm run e2e
```

Covered flows:

- Every page renders, with honest empty states
- The Lab: build, simulate, save, undo and reload
- The Lab: hand-drawn connections and palette search
- The Lab: palette categories, logos, a custom component and renaming
- The Lab: hiding side panels to widen the canvas
- The Lab: importing a design file straight from Load
- Fixing the first challenge and passing it
- Backup: export from one browser, import into another
- Build problems with requirements and a reference architecture
- Revealing a solution
- A mock interview end to end (requirements, estimates, twist, scorecard)
- The guided tour (opens on the first visit, walks every step, then stays closed)
- *Solve it with me* builds the fix and the learner submits it

Tests mark the tours as already seen (except the tour tests), so overlays don't block clicks.

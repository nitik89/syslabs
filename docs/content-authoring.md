# Adding content

Problems, lessons, diagrams and flashcards are plain data. The test suite validates all of it, so a mistake fails `npm test` rather than reaching users.

## Problems

There are two kinds, sharing one shape (`Challenge` in `lib/challenges/types.ts`):

- **Challenges** (`data/challenges/*.json`): a broken starting design to fix. Reference solutions live in `data/challenges/solutions.ts`; on-call pager text in `data/challenges/incidents.ts`.
- **Build problems** (`data/designs/*.json`, `mode: "build"`): a blank canvas (just the client) with a `category`, `requirements`, back-of-envelope `estimates` and a `reference` solution in the JSON.

Key fields:

| Field | Purpose |
| --- | --- |
| `id`, `order`, `title`, `difficulty` (`Easy`/`Medium`/`Hard`), `summary`, `scenario[]` | Identity and the story |
| `requirements.functional[]`, `requirements.nonFunctional[]` | Shown in the problem panel |
| `traffic` | The brief's load (see [simulator.md](simulator.md#traffic)) |
| `objectives[]` | `{ id, label, metric, op, value }`: for example `errorRate <= 0.01`, `avgLatencyMs <= 60`, `spofCount == 0`, `monthlyCost <= 1300`, `usesKind`… |
| `scoring` | `weights` (performance, reliability, cost, architecture), `latencyTargetMs`, `costBudget` |
| `startingDesign` | `graph` (nodes, edges) and `positions` |
| `allowedComponents` | Building blocks offered in the palette |
| `hints[]` (3), `explanation` | Progressive hints and the editorial |

To add one:

1. Write the JSON (copy a similar problem).
2. Register it: import it in `data/challenges/index.ts` or `data/designs/index.ts` (for a challenge, add its solution to `solutions.ts`).
3. Add it to a stage in `data/roadmap.ts` (a test checks every problem is on the roadmap).
4. Run `npm test`. The calibration tests require that:
   - the starting design **fails**;
   - the reference **passes every objective and both hidden tests**, within budget.

   Set the budget to about the reference's cost + 25%.
5. Optionally link a lesson to it with `practice: "<problem id>"`.

## Lessons

`data/lessons.ts` holds each lesson's `id`, `title`, `stage` (a roadmap stage id), `summary`, five `points`, a `ruleOfThumb` and the `practice` problem. Then add:

- **A diagram** in `data/lesson-diagrams.ts`: nodes (`x`, `y` on a 720-wide canvas, `label`, `sub`, `tone`, `shape`: box, db, queue, client, circle, dot), edges (`flow` = moving request dots, `bend` to curve, `dashed`, `label`), plus optional `zones` (before/after panels), `notes`, `rings` and `lines`.
- **A deep dive** in `data/lesson-deep-*.ts`: `sections` (under the hood), `example` (worked steps), `tradeoffs` (option, pros, cons), `mistakes`, `interview`.
- **Two flashcards** in `data/flashcards.ts` with `lesson: "<id>"`.

Tests check that every lesson has a diagram and a deep dive, that diagram edges point at real nodes, and that each lesson's practice problem is its first related problem.

## Component guide

`data/component-guide.ts` has the plain-language guide for each of the 26 building blocks. After editing it, regenerate [components.md](components.md):

```bash
npm run docs:components
```

## Mock interviews and the roadmap

- `data/interviews.ts`: each interview points at a build problem and defines a twist (`traffic` with a factor, `budget` with a factor, or `failure`). A test checks every reference design scores at least 75 on the design part.
- `data/roadmap.ts`: six stages with their problems in order; the last problem of each stage is its checkpoint.

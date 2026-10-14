# Personal Operating System (POS)

A local-first command centre for a student running three things at once: a technical learning
track, a semester plus competitive-exam prep, and two content properties that are meant to
become paid work.

It answers three questions at any moment:

1. **What meaningful outcome am I working toward?** — North Star goals with weighted,
   evidence-gated milestones.
2. **What is the best task for my time and energy right now?** — an adaptive task engine that
   scores every open task against your deadline, importance, available block, current energy and
   how long it has been postponed, and explains the result.
3. **What evidence proves progress?** — evidence links on milestones, topics and projects; a
   practice log; published content; a sponsorship funnel.

Progress is never inferred from elapsed time, and activity is never treated as an outcome.

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

Other commands:

```bash
npm test           # vitest, 107 tests across 7 files
npm run typecheck  # tsc -b
npm run build      # production bundle in dist/
npm run preview    # serve the production build
```

First run shows an empty state with a **Load demo workspace** action. Everything seeded is
labelled a *demo proposal* and can be removed individually or in bulk from **Settings → Data →
Clear demo data** (your own rows are kept).

---

## Architecture

```
src/
  types.ts              single source of truth for the data model
  lib/
    date.ts             local-calendar date maths (no timezone drift)
    ids.ts              stable id generation
    csv.ts              RFC-4180-ish CSV parse/serialise
    seed.ts             demo workspace, dates generated relative to today
    router.ts           hash router (8 routes)
  domain/               pure logic — no React, no store; fully unit-tested
    progress.ts         goal / milestone / topic / portfolio / exam-readiness rollups
    taskMatch.ts        adaptive task engine: rankTasks, shuffleTasks, findAnother
    metrics.ts          marketing rates, aggregation, commercial funnel
    overview.ts         area cards, north stars, upcoming items, weekly trends
  state/
    storage.ts          guarded localStorage (degrades to in-memory with a banner)
    defaults.ts         empty state, defensive migration, demo-data stripping
    store.ts            zustand store, all mutations, export/import
  components/           ui primitives, inline-SVG charts, icons, task widgets, today panel
  pages/                Overview, Goals, Technical, Academics, Marketing, Tasks, Reviews, Settings
```

**Stack:** React 19 + TypeScript, Vite, Zustand, localStorage. No backend, no UI kit, no chart
library, no AI API, no external analytics. Everything renders offline; charts and icons are
inline SVG.

**Data flow:** UI → `actions.*` → store mutation → `persist()` → localStorage. Read-only
derivations (progress, rankings, metrics) are pure functions in `src/domain`, memoised in the
pages. Nothing stores a progress number that can drift — it is always recomputed.

---

## How the numbers work

| Quantity | Formula |
| --- | --- |
| Goal progress | `Σ(weight of done milestones) ÷ Σ(weight of all milestones)` |
| Unverified milestone | credited at **0.6** if evidence is required but missing (and named in the UI) |
| Topic credit | done + (evidence **or** practice target set & met **or** confidence ≥ 3) = 1.0 · done with none of those = 0.6 · learning = 0.45 · not started / skipped = 0 |
| Track progress | `Σ(topic weight × credit) ÷ Σ(topic weight)` |
| Portfolio evidence | 1.0 only when a project is `done` **and** has a link attached |
| Technical area | `0.50·goals + 0.35·topic mastery + 0.15·portfolio` |
| Academics area | `0.50·goals + 0.50·semiconductor roadmap` |
| Marketing area | goal average (content + deal milestones carry the weight) |
| Exam readiness | `0.25·confidence + 0.20·revision + 0.20·practice volume + 0.10·practice recency + 0.25·timed assessment average − 0.20·weak-topic share` |
| Engagement rate | `(likes + comments + shares + saves) ÷ reach × 100` — `n/a` when reach is 0 |
| Task score | `deadline(0–30)·w₁ + importance(0–20)·w₂ + energyFit(0–15)·w₃ + durationFit(0–15)·w₄ + deferral(0–8)·w₅ − prerequisite(25) − recovery(50) − alreadySuggested(6)` |

Elapsed time is drawn as a thin marker on the goal progress bar. The gap between marker and fill
is schedule risk; it is never added to progress. Weights `w₁…w₅` are editable in Settings.

### Task engine behaviour

- **Energy demand tiers:** light cognitive load → tier 1, medium → its own tier, heavy → tier + 1.
  Exhausted energy admits only tier-1 work and switches the panel to recovery mode.
- **Duration fit:** a task that fits the block scores highest between 40–90% utilisation; too long
  with a minimum viable version defined scores moderately and is flagged; too long without one
  scores near zero.
- **Shuffle** re-ranks only. It sets aside already-suggested tasks while others exist, respects
  deadlines and prerequisites, skips completed/blocked tasks, and returns a written explanation.
  It never deletes a task, never changes a deadline, and never moves a fixed commitment
  (`movedFixed` is always `[]`, asserted in tests).
- **Reschedule** is a separate dialog with a visible confirmation and states plainly that the
  deadline is untouched.
- **Deferring** increments a visible counter, moves the planned date by one day, and feeds the
  deferral term of the score.

---

## Module notes

**Overview** — North Star (90-day and 6-month, pinnable), three area cards with health derived
from milestone dates versus progress, today's execution panel, upcoming 21 days, trends split
into inputs / outputs / outcomes, recent evidence feed, commercial funnel, sleep log.

**Goals** — 90-day and 6-month goals with outcome, measurement method, target date, weekly
target, leading vs lagging classification, dependencies, weighted milestones, evidence, manual
override with history. Creating a goal can generate milestones in one step.

**Technical** — three concurrent tracks (DSA, ML, GenAI) with editable curricula, per-topic
status/weight/effort/confidence/practice/prerequisites/target date, reorder + archive + delete,
currently-learning / learned / next columns, a practice log (attempted, independent, with hints,
revision needed), and a separate portfolio-evidence section per track.

**Academics & Career** — (A) college subjects with syllabus topics, revision depth, timed
assessments, recurring mistakes, and **coverage shown separately from exam readiness**;
(B) GATE subjects with topic hierarchy, deadlines, revision cycles, weak flags, PYQ log, mock
tests and a score trend; (C) a semiconductor roadmap grouped into foundations / processes /
devices / practical with tools, assignments and evidence.

**Marketing & Content** — (A) a seven-stage kanban (drag or menu) covering short-form and
portfolio ads; (B) per-account metrics with manual entry, CSV import/export, weekly trends and
labelled formulas; (C) a sponsorship CRM with stages, fees, contract and payment status, plus the
published → engagement → inquiry → outreach → paid funnel.

**Tasks & Calendar** — today panel, full list with filters/search/sort, week view showing
planned load against available minutes, and a postponed/blocked view with low-energy candidates.

**Reviews** — computed weekly numbers grouped into inputs / outputs / outcomes, repeatedly
postponed tasks, academic status, content and commercial summary, sleep pattern, and a written
review with next week's adjustments.

**Settings** — profile, theme, exam dates, task-matching weights, the full formula reference,
export/restore, demo data management, and data counts.

---

## Acceptance criteria

| # | Criterion | Status |
| --- | --- | --- |
| 1 | Creating a goal generates an editable outcome and milestones | ✅ goal form can emit milestones; every field editable afterwards |
| 2 | Completing a topic or task updates the appropriate progress | ✅ `progress.test.ts` — milestone close/reopen moves goal progress; topic status feeds track progress |
| 3 | The three technical tracks operate independently | ✅ `track independence` test |
| 4 | College, GATE and semiconductor progress are independent | ✅ separate stores, separate rollups, no shared state |
| 5 | Publishing content updates content-output metrics | ✅ `store.test.ts` — publish event recorded; `contentOutputByWeek` counts published only |
| 6 | Recording a brand deal updates the commercial funnel | ✅ `store.test.ts` + `dealFunnel` tests |
| 7 | Recommendations change when energy or available time changes | ✅ three `taskMatch` tests |
| 8 | Shuffling never alters fixed commitments or deletes tasks | ✅ deep-equality test on the task array before/after; `movedFixed` asserted empty |
| 9 | Completed tasks are excluded from active recommendations | ✅ eligibility tests |
| 10 | Data survives page refreshes | ✅ persistence test + UI test that re-hydrates from localStorage |
| 11 | Export and import preserve data relationships | ✅ round-trip test keeps goal → milestone → task ids |
| 12 | Works on mobile and desktop | ✅ responsive breakpoints at 1100px and 860px, drawer nav, tested routes |
| 13 | No key button is decorative | ✅ every button is wired; shuffle/reschedule/complete/defer all mutate state |
| 14 | Deadline status and progress are computed from actual data | ✅ no stored progress fields; `deadlineTone` and rollups are pure functions |
| 15 | Usable without AI APIs or external integrations | ✅ zero network calls in the app code |

Run `npm test` to verify 1–11 and 15; `npm run build` covers 12–14 via the compiled app.

---

## Deliberate limitations

- **No calendar or analytics integration.** Availability, sleep and metrics are manual (CSV import
  for metrics). This is intentional: no credentials, no background device data, no scraped numbers.
- **No cross-platform metric merging.** Each account is tracked on its own; rates are only computed
  when a real denominator exists, otherwise they read `n/a`.
- **No cloud sync.** Data lives in this browser's localStorage. Use **Settings → Export** to move
  between devices. If localStorage is blocked (some private modes / sandboxed iframes) the app
  still runs and shows a banner; export is then the only durable copy.
- **Bundle is a single ~510 kB chunk (143 kB gzipped).** Fine for a personal tool; split by route
  with dynamic imports if it grows.
- **Recurrence is simple** (daily / weekly with an interval). No RRULE.
- **Sleep guidance is deliberately mild.** Short sleep surfaces a suggestion to take the minimum
  viable version of the work or a recovery block. It never scores you, and every recommendation can
  be overridden.

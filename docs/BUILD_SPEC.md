# PART B — BUILD SPECIFICATION

## B1. Business context
- Freshroots: a 200-person regional FMCG company in Maharashtra and Goa, selling packaged snacks and staples through ~1,200 distributors and ~400 active SKUs.
- The CEO gave Deepa Nair (Head of Operations) ₹15 lakh and 90 days to get "something AI" running by Q1.
- We chose Demand Planning (Option A) using the 9 checks:
  - Planning errors cost ₹28–34 lakh per quarter (₹18–22L stockouts + ₹10–12L overstock write-offs, mainly perishables), i.e. ₹112–136 lakh a year.
  - Raghav Kulkarni (Senior Demand Planner) spends ~2 days a month moving SAP data into Excel; forecasts are 3–4 weeks old when procurement acts on them.
  - Raghav's written rules cover ~80–85% of decisions; 15–20% need his judgment (new launches, unusual distributor behaviour, one-off events).
  - Break-even: ₹15 lakh pays back if planning-error costs fall 11–13% in year one.
- Design principle: automate the data work and the rules; keep the buying decision human. The engine recommends; Raghav approves or overrides; procurement places the order.
- Users: Raghav (planner), procurement, Deepa (reviews kill metrics).
- The forecasting logic is a deterministic rules engine, not machine learning. ML is out of scope.

## B2. Data
Five CSV files (not Excel) in the "Deepa case" folder. The path contains a space; always quote it. Read the location from the `DATA_DIR` environment variable.

### Step 0 — Inspect before modelling (checkpoint A2.3)
Write `scripts/inspect-data.ts`. For each CSV print: column names, inferred types, row count, first 5 rows, date ranges, distinct counts of SKUs, distributors and weeks, and weeks of history per SKU. Propose a column mapping in `src/config/columnMap.ts`, and list missing fields, especially on-order quantity, lead time, unit price, case pack and perishability flag. Wait for my OK.

| File | Expected contents | Use |
|---|---|---|
| Calendar seed data | Festival names and dates | Festival factor F |
| Current inventory seed data | On-hand per SKU; maybe on-order | Inventory position |
| Distributor seed data | Distributor ID, name, region | Distributor checks (E2) |
| SKU seed data | SKU ID, name, category, perishable flag; maybe price, case pack, lead time | Thresholds, order value, rounding |
| Weekly sales seed data | Units by SKU × distributor × week | AVG4, AVG12, surge test |

### Prisma models (adjust after Step 0)
- Sku: code (PK), name, category, isPerishable, unitPrice?, casePack?, leadTimeWeeks?
- Distributor: code (PK), name, region, tier?
- WeeklySale: sku, distributor, weekStart (date), units. Unique on (sku, distributor, weekStart); index on (sku, weekStart).
- InventorySnapshot: sku, asOfDate, onHand, onOrder?. Unique on (sku, asOfDate).
- Festival: name, date, region?
- EventFlag (manual E3 flags): sku?, distributor?, startDate, endDate, note, createdBy.
- Run: runDate, status (COMPLETED | HALTED), haltReason?, configSnapshot (Json), totals (Json), createdAt.
- Recommendation: run, sku, flag (STOCKOUT_RISK | OVERSTOCK | HIGH_DEMAND | WATCH | OK | EXCEPTION), avg4, avg12, festivalFactor, demandRate, inventoryPosition, weeksOfCover, qty, orderValue?, reason (one plain-English sentence), status (PENDING | APPROVED | OVERRIDDEN | REJECTED).
- RecException: run, sku, code (E1–E7), detail.
- Decision: recommendation, action (APPROVE | OVERRIDE | REJECT), newQty?, reasonCode, note?, decidedBy, decidedAt.
- PreplacementCheck: recommendation, checkedAt, result (PROCEED | HOLD), triggers (Json), ownerDecision?, ownerNote?

Neon + Prisma: the pooled connection string is `DATABASE_URL` (app); the direct string is `DIRECT_URL` (migrations, via `directUrl` in schema.prisma).

## B3. Engine (pure TypeScript in `src/lib/engine/`, no database access inside)

### Definitions
- Week: Monday–Sunday, complete weeks only. Plan at SKU level (summed across distributors); use distributor data only for exceptions.
- AVG12 / AVG4 = mean weekly units over the last 12 / 4 complete weeks.
- F = 1.25 if a festival date falls within the next 4 weeks of the run date, else 1.00.
- D = AVG12 × F.
- IP = onHand + onOrder. If onOrder is missing, use 0, label outputs "on-order unavailable", and list it as a limitation.
- Q_std = 4 × AVG12, rounded to case pack. [Assumption: one month of demand.]
- Cover: general min 6 / max 14 weeks; perishable min 3 / max 4 weeks.

### Decision logic (first match wins)
Compute first:
1. Surge test: AVG4 > 1.2 × D. Confirmed only if true for the latest week AND the week before.
2. R = AVG4 if surge confirmed, else D.
3. WOC = IP ÷ R.

| # | Condition | Flag | Action |
|---|---|---|---|
| 0 | Any exception E1–E7 | EXCEPTION | Route to Raghav, no auto quantity |
| 1 | WOC > max | OVERSTOCK | Pause next order |
| 2 | WOC < min | STOCKOUT_RISK | Reorder now (1.5× if surge confirmed) |
| 3 | Surge confirmed, cover in range | HIGH_DEMAND | Next order 1.5× Q_std |
| 4 | Surge this week only | WATCH | No change, retest next run |
| 5 | Otherwise | OK | No change |

Quantity: Q = min(Q_std × s, max × R − IP), with s = 1.5 if surge confirmed, else 1. Round up to case pack for general SKUs, down for perishables.

### Exceptions
- E1 New SKU: fewer than 12 weeks of history.
- E2 Distributor swing: a distributor with ≥10% of the SKU's 12-week volume moves ≥50% (its AVG4 vs its own AVG12).
- E3 Market event: an active EventFlag for the SKU or distributor.
- E4 Data problem: missing weeks, negative stock, duplicates, unmatched IDs.
- E5 Lead-time conflict: lead time ≥ min cover (skip with a warning if unavailable).
- E6 Large order: order value > ₹5 lakh (skip with a warning if price unavailable).
- E7 Floor breach: capped Q still leaves cover below min.

### Safety switches
- Automatic guardrail (no human): if a run's total recommended value exceeds 1.5× the value of all SKUs ordering at Q_std, mark the run HALTED with a reason, save no recommendations, and show a "manual planning" banner.
- Pre-placement check: before procurement places an approved order, hold it if, since approval, the latest week differs from AVG4 by ≥20%, any top-10 distributor for that SKU cut ≥30%, or a new E3 flag exists. A named owner decides proceed, reduce or cancel.
- Kill metrics (reporting only, Deepa decides): override rate (warn above 30%), exception rate vs the expected 15–20%, and a note that the project is killed if quarterly losses exceed ₹34 lakh against Raghav's manual plan.

### Parameters
Every threshold lives in `src/config/engine.ts`; save a snapshot on every Run.

### Required tests (Vitest, case pack = 1) — must pass before any API work
- Ex1 general: AVG12 1,000; AVG4 1,300 (surge both weeks); onHand 4,500; onOrder 500 → STOCKOUT_RISK, Q = 6,000.
- Ex2 perishable: AVG12 500; AVG4 520; onHand 1,100; onOrder 300 → STOCKOUT_RISK, Q = 600.
- Ex3 festival: run 2026-10-12, Diwali 2026-11-08; AVG12 2,000; AVG4 2,700; IP 20,000 → OK.
- Ex4: AVG12 800; AVG4 1,000 (surge both weeks); IP 15,000 → OVERSTOCK.

## B4. Phases (run continuously; stop only at Part A checkpoints)

### Phase 1 — Project setup and GitHub
- Ask the A2.1 opening questions.
- Scaffold Next.js (App Router, TypeScript, ESLint, Tailwind), Prisma, Vitest. Add a `postinstall` script running `prisma generate`.
- Folders: `src/app`, `src/app/api`, `src/lib/engine`, `src/lib/services`, `src/lib/db.ts`, `src/lib/logger.ts`, `src/config`, `src/components`, `scripts`, `skills`, `docs`, `prisma`.
- Create `.gitignore` (node_modules, .env, .env.local, .next, coverage, .DS_Store), `.env.example` (DATABASE_URL, DIRECT_URL, DATA_DIR, APP_PASSWORD), README skeleton, CLAUDE.md, HANDOFF.md, docs/BUILD_SPEC.md.
- git init; first commit on `main`; create `dev`. Create the GitHub repo with gh or GitHub MCP if available, otherwise ask me to create it. Add remote; push both branches. Set branch protection on `main` if the tool allows; otherwise note it in Waiting on me.

### Phase 2 — Data and database (Neon)
- Run Step 0 → checkpoint A2.3.
- Create the Neon project and database via Neon MCP or CLI if available; otherwise give me the dashboard steps. I put DATABASE_URL and DIRECT_URL into `.env.local` myself (checkpoint A2.2).
- Write schema.prisma from the confirmed mapping; run `npx prisma migrate dev --name init`.
- Write `scripts/ingest.ts`: read CSVs from DATA_DIR, trim strings, parse dates to week-start Monday, upsert idempotently, write `data-quality.md` with counts, rejects and missing fields. Run it.
- Write and run `scripts/check-data.ts` printing row counts and sample rows per table.

### Phase 3 — Engine and API
- Implement the engine exactly per B3; tests must pass first.
- Service layer: load from DB → run engine → persist Run, Recommendations, Exceptions in one transaction.
- Route handlers:
  - POST /api/runs {runDate}; GET /api/runs; GET /api/runs/[id]
  - GET /api/recommendations?runId&flag&status&perishable
  - POST /api/recommendations/[id]/decision {action, newQty?, reasonCode, note?}
  - POST /api/recommendations/[id]/preplacement-check
  - GET /api/exceptions?runId
  - POST /api/flags; GET /api/metrics; GET /api/health
- Validate with zod; return consistent `{ error: { code, message } }` with correct status codes; structured logging.
- Smoke-test every endpoint yourself with curl against the local dev server; record results in HANDOFF.md.

### Phase 4 — Frontend
- Simple password gate: middleware checks a signed cookie set by /login against APP_PASSWORD (checkpoint A2.2 for the value). Not real auth; README says so.
- Pages:
  - `/`: latest run summary — counts by flag, guardrail status, exception rate vs 15–20%, override rate vs 30%, a "Run engine" button.
  - `/runs/[id]`: recommendations table with filters (flag, status, perishable), each row's reason sentence, approve / override / reject with a reason code.
  - `/exceptions`: exceptions by code.
  - `/skus/[code]`: weekly sales chart, AVG4/AVG12, cover over time.
- Plain, readable Tailwind UI; loading and error states everywhere. Run the build to confirm it compiles.

### Phase 5 — Deploy to Vercel
- Link and deploy via Vercel MCP or CLI if available; otherwise give me the import steps.
- Env vars in Vercel: DATABASE_URL, DIRECT_URL, APP_PASSWORD (checkpoint A2.2; I add values myself unless the tool sets them from my local `.env.local` without printing them).
- Migrations: run `npx prisma migrate deploy` locally against Neon, not in the Vercel build.
- `dev` → preview deployments; `main` → production (merging to `main` is checkpoint A2.5).
- Smoke test the preview: login, run engine, approve one recommendation.

### Phase 6 — CI, logging, polish
- `.github/workflows/ci.yml` on push and PR: npm ci, lint, test, build. Make failing CI block merges to `main` if the tool allows.
- JSON logs with levels; log every run, decision and guardrail halt.
- No error-tracking service unless I ask.

### Phase 7 — Skills, rubrics, documentation
- `skills/`: data_ingestion.md, engine_rules_change.md (how to change a threshold safely, including re-running tests), schema_evolution.md, api_extension.md, deployment.md — each with purpose, steps, and 2–3 example prompts.
- `skills/code_quality_rubric.md`, `skills/data_modeling_rubric.md`, and `skills/case_alignment_rubric.md` (checks the app still matches the case: buying decision stays human, exceptions route to Raghav, the guardrail works, kill metrics are visible).
- README: overview, setup, how a planner uses it on Monday morning, assumptions Raghav must confirm (Q_std, festival window, persistence, E2/E6/guardrail thresholds, which festivals the brief's "October, November, March" refer to, Ganesh Chaturthi), known limitations (weekly data means one run per week; on-order data may be missing).
- Final HANDOFF.md update marking the build complete, with a checklist.

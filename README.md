# Freshroots Demand Planning

Rules-based demand planning for Freshroots (MESA Case 01: Deepa's 90-Day Mandate). A deterministic engine recommends reorder quantities; Raghav approves or overrides; procurement places the order. **The engine recommends, a person decides.** No machine learning.

Stack: Next.js 16 (App Router) + TypeScript, Prisma 7, Postgres on Neon, Vercel, npm. GitHub: `main` = production, `dev` = development.

> **Security note:** the login is a single shared password (`APP_PASSWORD`) checked against a signed cookie. It is **not real authentication**: no user accounts, no audit of who logged in. Decisions record a free-text "deciding as" name. Fine for a pilot; replace before wider use.

## Setup
1. `npm ci` (this also runs `prisma generate`).
2. Copy `.env.example` to `.env.local` and fill in:
   - `DATABASE_URL`: Neon **pooled** connection string (app).
   - `DIRECT_URL`: Neon **direct** connection string (migrations).
   - `DATA_DIR`: folder holding the five CSVs, e.g. `D:\Mesa\Deepa Case`.
   - `APP_PASSWORD`: the shared login password.
3. `npx prisma migrate deploy` (or `migrate dev` while developing).
4. `npx tsx scripts/ingest.ts`, then `npx tsx scripts/check-data.ts`.
5. `npm test`, `npm run dev`, open http://localhost:3000.

Other docs: `docs/BUILD_SPEC.md` (full spec), `HANDOFF.md` (build progress), `skills/` (how to change things safely), `data-quality.md` (written by ingest, not committed).

## How a planner uses it on Monday morning
1. Update the CSVs (last week's sales, current inventory) and run the ingest script. (This is the manual step that replaces the two days a month of SAP-to-Excel work; automating the SAP export is future work.)
2. Log in. On **Dashboard**, check the run date is this Monday and click **Run engine**.
3. Read the banners first. If the guardrail halted the run, you will see a **Manual planning** banner and no recommendations: plan by hand.
4. On the run page, work through **Stockout risk** and **High demand** rows. Each row has a one-sentence reason. **Approve** it, **Override** with your own quantity, or **Reject**, always with a reason code.
5. Open **Exceptions**. These SKUs have no automatic quantity: use your judgment. Add a **market-event flag** there when you know about a promotion or local event, so affected SKUs route to you next run.
6. Before procurement places an approved order, click **Pre-placement check**. If it says **HOLD**, a named owner decides: proceed, reduce or cancel.
7. Deepa reviews the override rate, exception rate and kill rule on the Dashboard.

## How the engine decides (short version)
Weekly data, Monday–Sunday, complete weeks only, planned per SKU.
- AVG12 / AVG4 = average weekly units over the last 12 / 4 weeks. Festival factor F = 1.25 if a festival month overlaps the next 4 weeks. Demand D = AVG12 × F.
- Surge: AVG4 > 1.2 × D. **Confirmed** only if the latest two weeks are each above 1.2 × D. Rate R = AVG4 if confirmed, else D.
- Weeks of cover = (on hand + on order) ÷ R. Limits: general 6–14 weeks, perishable 3–4 weeks.
- First match wins: exception → overstock → stockout risk → high demand → watch → OK.
- Order quantity = min(4 × AVG12 × (1.5 if surging), max cover × R − inventory), rounded to case pack (up for general, down for perishable).
- Every threshold is in `src/config/engine.ts`, and each run stores a snapshot of them.

## Assumptions Raghav must confirm
| # | Assumption | Where |
|---|---|---|
| 1 | **Q_std = 4 × AVG12** (one month of demand). The CSV also has `Standard_Reorder_Qty`; it is shown for reference but does not drive the order. Which should win? | `stdOrderWeeks` |
| 2 | **Festival window** = festival month overlapping the next 4 weeks, uplift 1.25 for everything. Should it differ by category or run longer? | `festivalLookaheadDays`, `festivalFactor` |
| 3 | **Festival months** come from `calendar.csv` flags: March, October, November (both years). This presumably means Holi (March) and Dussehra/Diwali (Oct–Nov). **Ganesh Chaturthi** (Aug/Sep, big in Maharashtra) is *not* flagged. Should it be? | `calendar.csv` |
| 4 | **Persistence:** a surge counts as confirmed only when the latest two weeks are each > 1.2 × D (on top of AVG4 > 1.2 × D). | `engine/index.ts` |
| 5 | **E2** distributor swing (≥10% of volume moving ≥50%) and **E6** large order (> ₹5 lakh): thresholds as specified, but they need data we do not have (see limitations). | `distributorShareMin`, `distributorSwingMin`, `largeOrderValue` |
| 6 | **Guardrail** halts when total recommended > 1.5 × total at Q_std. Without prices it compares units. As specified it is almost inert: no SKU orders more than 1.5 × Q_std, so it can only trip through case-pack rounding. Deepa and Raghav should choose a tighter rule. | `guardrailMultiplier` |
| 7 | **Cover limits** (general 6–14, perishable 3–4 weeks) and the 1.5× surge order multiplier. | `cover`, `surgeOrderMultiplier` |
| 8 | **Perishability:** `High` in the SKU file = perishable, `Low` = general. | `ingest.ts` |
| 9 | **Case pack = 1** because the data has none. | `Sku.casePack` |

## Known limitations
- **One run per week.** Data is weekly, so running more often gives the same answer.
- **On-order is missing.** Inventory position = on-hand only; outputs say "on-order unavailable". Real stockout risk is lower for SKUs with open orders, so expect false STOCKOUT_RISK flags.
- **No unit prices:** order value is empty, E6 never fires, the guardrail compares units.
- **No lead times:** E5 never fires.
- **No distributor-level sales:** E2 and the top-10 distributor pre-placement check cannot run (they show a skipped warning). Each SKU has one primary distributor only.
- **Calendar has months, not dates**, so the festival uplift is coarse.
- **Exception rate is 0% on the seed data** against an expected 15–20%: the data has no new SKUs, gaps or flags. It will rise as flags and the missing fields are added.
- **Shared password, free-text user names**; no real authentication or per-user audit.
- **`main` branch protection** is not enabled (needs GitHub Pro or a public repo).
- Seed data is small: 15 SKUs, 4 distributors, 16 weeks (2026-W27 to W42), one inventory snapshot (2026-10-19).

## Project layout
`src/lib/engine` pure rules engine and tests · `src/lib/services` database logic · `src/app/api` route handlers · `src/app` pages · `src/config` thresholds and CSV mapping · `scripts` inspect/ingest/check · `prisma` schema and migrations · `skills` playbooks and rubrics.

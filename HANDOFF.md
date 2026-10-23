# HANDOFF

**Last updated:** 2026-10-22

## Current position
BUILD COMPLETE and MERGED to main (PR #1, 2026-10-22). Production deployment Ready; health ok; gate and login verified. Only the real-password production login test + test-row cleanup remain (user).

## Done
- UI redesign on dev (ui-ux-pro-max guidance: Swiss/minimal, Fira Sans + Fira Code, blue primary, status colours only for flags): dashboard KPI cards (need action, units in stock, exception rate, override rate), flag bar + filter links, Needs-your-attention table with stock and cover bars; run table with flag filter chips (?flag= deep link), urgency sort, stock and sales columns, reason under SKU, cover bar vs target band, skeleton loaders, focus rings. Verified in browser (desktop, phone width, no sideways scroll); tsc, lint, 15 tests, build clean. PR #2 carries it; production unchanged until merged.
- PR #1 merged to main by the user (auto-mode blocked my merge). Production https://freshroots-demand-planning-8j9myo1hk-milindmali1810s-projects.vercel.app Ready (48s build): /api/health ok, /api/runs 401, wrong password 401, / -> 307 /login. Team URL (public, app password gate only): https://freshroots-demand-planning-beta.vercel.app (health 200, /api/runs 401, / -> /login). Other aliases and per-deployment URLs are behind Vercel Authentication (team-only); no Vercel setting change needed.
- Preview smoke test by user on Vercel: login ok, Run #3 (15 rows, same as local), SKU001 approved. Test rows deleted afterwards (DB: 0 runs; 15 SKUs, 240 sales, 15 inventory intact).
- APP_PASSWORD added in Vercel (Production+Preview, Secret). Preview https://freshroots-demand-planning-7dwd5bafk-milindmali1810s-projects.vercel.app: /api/health ok, POST /api/login wrong pw -> 401 WRONG_PASSWORD (proves var is set), / -> 307 /login, /api/runs -> 401.
- Vercel env DATABASE_URL and DIRECT_URL added by user (dashboard; CLI in user PowerShell lacks vercel on PATH). Preview https://freshroots-demand-planning-4erhhedgq-milindmali1810s-projects.vercel.app: /api/health 200 ok, /api/runs 401 without login. Previews are behind Vercel Authentication: use `vercel curl <url>` (CLI generated a protection bypass token).
- Phase 6: .github/workflows/ci.yml (lint, test, build) — first run on dev green. JSON logs for runs, decisions, guardrail halts.
- Phase 7: skills/ (5 playbooks + 3 rubrics) and full README written.
- Phase 5 (partial): Vercel project freshroots-demand-planning created and linked to GitHub (milindmali1810s-projects). First preview was Blocked: commit author email not linked to a GitHub account; repo git email switched to GitHub noreply.
- Phase 4: proxy.ts signed-cookie gate (APP_PASSWORD), /login, / (dashboard), /runs/[id], /exceptions (+ add E3 flag form), /skus/[code] (SVG charts), GET /api/skus/[code]. Browser-tested with a throwaway process-only password: login, run engine, approve SKU001, pre-placement PROCEED, SKU page. `npm run build`, eslint, tsc, 15 tests all clean. Test rows deleted afterwards (DB has 0 runs).
- Phase 3: engine (src/lib/engine) + 15 Vitest tests passing (4 required examples + rules); service layer (src/lib/services); all 10 API routes; zod validation + { error: { code, message } } + JSON logs.
- API smoke test (curl, local dev :3100) all passed: health 200; POST/GET runs 201/200, bad date/json 400, bad id 400, missing 404; recommendations filters 200, bad flag 400; exceptions 200; decision approve/override 201, no-qty approve 422, missing newQty 400, missing reason 400, repeat 409, unknown 404; preplacement 409 if pending, 201 PROCEED, HOLD after a new event flag; flags 201/400/404; metrics 200. Smoke rows deleted afterwards.
- First real run (2026-10-19, units basis): 5 STOCKOUT_RISK, 8 OK, 2 OVERSTOCK, 0 exceptions (rate 0% vs expected 15-20%: data has no E1/E3/E4 triggers; E2/E5/E6 cannot run).
- Phase 2: Neon migration init applied; ingest loaded 4 distributors, 15 SKUs, 240 sales rows (W27–W42), 15 inventory rows, 6 festival months; 0 rejects (data-quality.md).
- Env checked: node v24.21.0, npm 11.19.0, git 2.55.0, gh 2.63.2, vercel 63.1.2; Neon MCP available.
- Phase 1 complete: scaffold (Next.js 16, Tailwind 4, Prisma 7.10.1, Vitest 5, zod, tsx, csv-parse), folders, .env.example, README skeleton, logger, handoff files.
- Git: `main` + `dev` pushed to private repo github.com/milindmali1810/freshroots-demand-planning. Local git identity set (repo-only).
- Wrote scripts/inspect-data.ts and ran it; proposed src/config/columnMap.ts.

## In progress
Nothing running. No dev server should be left on :3100.

## Next 3 actions
1. User logs in on production, runs engine, approves one row; then delete test rows.
2. Raghav/Deepa review the assumptions table in README (esp. guardrail and Ganesh Chaturthi).
3. Merge dev → main only with explicit user OK (checkpoint A2.5).

## Decisions made
- UI is light-theme only (globals.css); client components fetch the API with loading/error states; Suspense wrappers required by cacheComponents.
- route() wrapper rethrows Next control-flow errors (digest).
- Engine surge-confirmed = AVG4 > 1.2D AND latest week AND previous week each > 1.2D (assumption for Raghav).
- Next 16: no `export const dynamic` in route handlers (cacheComponents on); params are Promises.
- Prisma 7: `directUrl` no longer in schema.prisma; migrations use DIRECT_URL via prisma.config.ts, app uses DATABASE_URL via a driver adapter.
- Next.js 16: check node_modules/next/dist/docs before writing (middleware may be renamed proxy).
- @types/node pinned ^24 (vitest peer requirement).
- Data reality (differs from spec): 15 SKUs, 4 distributors, 16 weeks (2026-W27..W42), one inventory snapshot 2026-10-19 at one location, sales have NO distributor column, calendar is monthly (Is_Festival_Month), no on-order / price / lead time / case pack.
- Column mapping APPROVED 2026-10-22 (src/config/columnMap.ts) with 6 answers: no E2/top-10 check; F=1.25 if next 4 weeks overlap festival month; Q_std=4xAVG12 (Standard_Reorder_Qty reference only); onOrder=0 labelled, casePack=1, E5/E6 skipped; guardrail compares units; High=perishable, ISO week→Monday.
- Neon project: freshroots-demand-planning, id wandering-unit-24906110, region aws-ap-southeast-1 (org-raspy-mud-08470220). Schema written (prisma/schema.prisma), db.ts uses @prisma/adapter-pg.

## Waiting on me
- Branch protection on `main` needs GitHub Pro or public repo.
- OK to merge dev -> main. Set APP_PASSWORD in local .env.local. Reset the Neon password (exposed in chat) and update Vercel + .env.local.
- Reset Neon neondb_owner password (it was pasted in chat), then update .env.local.
- APP_PASSWORD must be set in .env.local (and Vercel) or login returns 503 NOT_CONFIGURED.

## Env vars (names only)
- DATABASE_URL: set (.env.local)
- DIRECT_URL: set (.env.local)
- DATA_DIR: set (.env.local)
- APP_PASSWORD: not set

## Verify state
- `git log -5 --oneline`
- `npm test`
- `npx prisma migrate status`

## Known issues
- Branch protection not set (see Waiting).
- Guardrail as specified is almost inert: max order per SKU is 1.5 x Q_std, so total can only exceed 1.5x baseline via case-pack rounding. Raise with Raghav/Deepa (compare against something tighter?).
- Exception rate is 0% on the seed data vs expected 15-20%.

## Build checklist
- [x] Phase 1 setup + GitHub  - [x] Phase 2 data + Neon  - [x] Phase 3 engine + API  - [x] Phase 4 frontend
- [x] Phase 5 Vercel preview (production pending merge)  - [x] Phase 6 CI  - [x] Phase 7 skills, rubrics, README

# HANDOFF

**Last updated:** 2026-10-22

## Current position
Phase 3 complete (engine, tests, service layer, API smoke-tested). Phase 4 (frontend) next.

## Done
- Phase 3: engine (src/lib/engine) + 15 Vitest tests passing (4 required examples + rules); service layer (src/lib/services); all 10 API routes; zod validation + { error: { code, message } } + JSON logs.
- API smoke test (curl, local dev :3100) all passed: health 200; POST/GET runs 201/200, bad date/json 400, bad id 400, missing 404; recommendations filters 200, bad flag 400; exceptions 200; decision approve/override 201, no-qty approve 422, missing newQty 400, missing reason 400, repeat 409, unknown 404; preplacement 409 if pending, 201 PROCEED, HOLD after a new event flag; flags 201/400/404; metrics 200. Smoke rows deleted afterwards.
- First real run (2026-10-19, units basis): 5 STOCKOUT_RISK, 8 OK, 2 OVERSTOCK, 0 exceptions (rate 0% vs expected 15-20%: data has no E1/E3/E4 triggers; E2/E5/E6 cannot run).
- Phase 2: Neon migration init applied; ingest loaded 4 distributors, 15 SKUs, 240 sales rows (W27–W42), 15 inventory rows, 6 festival months; 0 rejects (data-quality.md).
- Env checked: node v24.21.0, npm 11.19.0, git 2.55.0, gh 2.63.2, vercel 63.1.2; Neon MCP available.
- Phase 1 complete: scaffold (Next.js 16, Tailwind 4, Prisma 7.10.1, Vitest 5, zod, tsx, csv-parse), folders, .env.example, README skeleton, logger, handoff files.
- Git: `main` + `dev` pushed to private repo github.com/milindmali1810/freshroots-demand-planning. Local git identity set (repo-only).
- Wrote scripts/inspect-data.ts and ran it; proposed src/config/columnMap.ts.

## In progress
Starting Phase 4. A dev server may be running on :3100 (`npx next dev -p 3100`).

## Next 3 actions
1. Phase 4: proxy.ts password gate (Next 16 uses proxy.ts, not middleware), /login, pages /, /runs/[id], /exceptions, /skus/[code].
2. User must set APP_PASSWORD in .env.local before login works.
3. Phase 5 Vercel deploy; Phase 6 CI; Phase 7 skills + README.

## Decisions made
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
- Reset Neon neondb_owner password (it was pasted in chat), then update .env.local.
- APP_PASSWORD needed before Phase 4 login.

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

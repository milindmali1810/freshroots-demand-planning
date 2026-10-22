# HANDOFF

**Last updated:** 2026-10-22

## Current position
Phase 3 — Engine (Phase 2 complete: migration `init` applied, data ingested).

## Done
- Phase 2: Neon migration init applied; ingest loaded 4 distributors, 15 SKUs, 240 sales rows (W27–W42), 15 inventory rows, 6 festival months; 0 rejects (data-quality.md).
- Env checked: node v24.21.0, npm 11.19.0, git 2.55.0, gh 2.63.2, vercel 63.1.2; Neon MCP available.
- Phase 1 complete: scaffold (Next.js 16, Tailwind 4, Prisma 7.10.1, Vitest 5, zod, tsx, csv-parse), folders, .env.example, README skeleton, logger, handoff files.
- Git: `main` + `dev` pushed to private repo github.com/milindmali1810/freshroots-demand-planning. Local git identity set (repo-only).
- Wrote scripts/inspect-data.ts and ran it; proposed src/config/columnMap.ts.

## In progress
Presenting the mapping. Files touched: scripts/inspect-data.ts, src/config/columnMap.ts.

## Next 3 actions
1. Finish engine in src/lib/engine + 4 Vitest tests (src/lib/engine/engine.test.ts).
2. Service layer (load DB → engine → persist Run in one transaction) and API routes with zod.
3. Smoke-test every endpoint with curl; record results here.

## Decisions made
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
- No tests yet. Branch protection not set (see Waiting).

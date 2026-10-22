# HANDOFF

**Last updated:** 2026-10-22

## Current position
Phase 1 — Project setup. Task: local scaffold done; GitHub repo + push next.

## Done
- Inspected environment: node v24.21.0, npm 11.19.0, git 2.55.0, gh 2.63.2, vercel 63.1.2. neonctl not installed (Neon MCP available).
- Created HANDOFF.md, CLAUDE.md, docs/BUILD_SPEC.md in project root `D:\Mesa\freshroots-demand-planning`.
- Scaffolded Next.js 16 (App Router, TS, ESLint, Tailwind 4), Prisma 7.10.1, Vitest 5, zod, tsx, dotenv, csv-parse.
- Folders, .gitignore, .env.example, README skeleton, vitest config, logger, prisma.config.ts, postinstall `prisma generate`.

## In progress
git commit on `main`, create `dev`, create GitHub repo. Files touched: whole scaffold.

## Next 3 actions
1. Create GitHub repo freshroots-demand-planning (gh), push `main` and `dev`.
2. Write scripts/inspect-data.ts and src/config/columnMap.ts; show mapping (checkpoint A2.3).
3. Create Neon project; user puts DATABASE_URL/DIRECT_URL in .env.local.

## Decisions made
- Project root `D:\Mesa\freshroots-demand-planning`; data folder `D:\Mesa\Deepa Case`; repo `freshroots-demand-planning`.
- Prisma 7 (latest): `directUrl` no longer exists in schema.prisma. Migrations use DIRECT_URL via prisma.config.ts; app uses pooled DATABASE_URL via a driver adapter.
- Next.js 16: AGENTS.md says docs are in node_modules/next/dist/docs (middleware may be renamed proxy; check in Phase 4).
- @types/node pinned ^24 (vitest peer requirement).

## Waiting on me
- Nothing yet.

## Env vars (names only)
- DATABASE_URL: not set
- DIRECT_URL: not set
- DATA_DIR: not set (will be `D:\Mesa\Deepa Case`)
- APP_PASSWORD: not set

## Verify state
- `git log -5 --oneline`
- `npm test`
- `npx prisma migrate status`

## Known issues
- None yet.

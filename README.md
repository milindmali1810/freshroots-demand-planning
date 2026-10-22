# Freshroots Demand Planning

Rules-based demand planning for Freshroots (MESA Case 01: Deepa's 90-Day Mandate). A deterministic engine recommends reorder quantities; Raghav approves or overrides; procurement places the order. No machine learning.

Stack: Next.js (App Router) + TypeScript, Prisma, Postgres on Neon, Vercel.

## Setup
1. `npm ci`
2. Copy `.env.example` to `.env.local` and fill in `DATABASE_URL`, `DIRECT_URL`, `DATA_DIR`, `APP_PASSWORD`.
3. `npm test`, `npm run dev`

Full spec: `docs/BUILD_SPEC.md`. Progress: `HANDOFF.md`.

_Remaining sections (Monday-morning workflow, assumptions to confirm, limitations) are filled in Phase 7._

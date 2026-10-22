# Skill: evolve the database schema

**Purpose:** add or change tables/columns without losing data. Prisma 7: connection URLs live in `prisma.config.ts` (migrations use `DIRECT_URL`); the app connects with `DATABASE_URL` through the `pg` adapter.

**Steps**
1. Edit `prisma/schema.prisma`. Prefer additive, nullable changes (new optional column) over renames or drops.
2. `npx prisma validate`, then `npx prisma migrate dev --name <what_changed>`. Read the generated SQL in `prisma/migrations/`.
3. Dropping or renaming a column or table that holds data is irreversible: stop and get explicit approval first. Back up by creating a Neon branch or snapshot.
4. `npx prisma generate` (also runs on `npm install`). Fix type errors from `npx tsc --noEmit`.
5. Update `scripts/ingest.ts`, `src/config/columnMap.ts` and the API/service code that touches the changed fields. Update tests.
6. Apply to production with `npx prisma migrate deploy` run locally against the Neon production database, not in the Vercel build.

**Common upcoming changes:** `WeeklySale.distributorCode` (enables E2 and the top-10 distributor check), `InventorySnapshot.onOrder` (already nullable), `Sku.unitPrice`, `casePack`, `leadTimeWeeks` (already nullable).

**Example prompts**
- "The sales file now has a Distributor_ID. Add it to WeeklySale, update ingest and turn on E2 in the engine."
- "Add unit price and case pack from the new SKU file and show which recommendations change."
- "Add a Planner table so decisions record a real user instead of free text."

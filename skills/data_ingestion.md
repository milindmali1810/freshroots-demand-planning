# Skill: data ingestion

**Purpose:** load or reload the five CSVs (`sku_master`, `distributor_master`, `weekly_sales`, `current_inventory`, `calendar`) into Neon safely.

**Steps**
1. Put the new CSVs in the folder `DATA_DIR` points to (`.env.local`). Keep the same file names and headers.
2. Inspect first: `npx tsx scripts/inspect-data.ts`. Check row counts, week range, blank cells, unmatched SKU or distributor IDs.
3. If headers changed, update `src/config/columnMap.ts` and the matching code in `scripts/ingest.ts`. Get Raghav's OK on any new mapping.
4. Ingest: `npx tsx scripts/ingest.ts`. It is idempotent (upserts), so rerunning is safe. Read `data-quality.md` for rejects and missing fields.
5. Verify: `npx tsx scripts/check-data.ts`.
6. Run the engine from the app and confirm the latest week shown on a SKU page matches the new file.

**Watch for:** weeks must be ISO weeks like `2026-W42`; the engine only uses complete Monday–Sunday weeks before the run date; a missing week makes that SKU an E4 exception.

**Example prompts**
- "New weekly_sales.csv is in the data folder. Inspect it, then ingest and tell me what changed in data-quality.md."
- "The inventory file now has an On_Order column. Update the mapping, schema and ingest, then show me the diff before migrating."
- "Why did SKU009 become an E4 exception after the last load?"

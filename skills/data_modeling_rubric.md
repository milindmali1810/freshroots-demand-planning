# Rubric: data modelling

- **(must)** Every table has a stable key; natural keys (`Sku.code`, `Distributor.code`) are used where the source provides them.
- **(must)** Uniqueness matches the business grain: `WeeklySale (sku, weekStart)`, `InventorySnapshot (sku, asOfDate)`, `Festival (startDate, endDate)`. Re-ingesting never creates duplicates.
- Dates are stored as dates (week starts on a Monday, UTC), not strings; money as `Decimal`, quantities as integers.
- Missing source data is `null`, never a fake zero; the code labels what is unavailable (on-order, price, lead time, case pack).
- Relationships have foreign keys and sensible indexes (`WeeklySale (sku, weekStart)`, `Recommendation (run, flag)`).
- A Run is reproducible: it stores the config snapshot and totals; recommendations and exceptions point to the run.
- Decisions are append-only history (`Decision`); the recommendation's `status` is the current state only.
- Migrations are additive where possible; anything that drops data was approved explicitly.
- `data-quality.md` lists rejected rows and missing fields after every ingest.

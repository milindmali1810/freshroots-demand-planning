import { config } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

config({ path: ".env.local" });

type Row = Record<string, string>;

const DATA_DIR = process.env.DATA_DIR;
if (!DATA_DIR) throw new Error("DATA_DIR is not set");

function read(name: string): Row[] {
  return parse(fs.readFileSync(path.join(DATA_DIR!, `${name}.csv`), "utf8"), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });
}

const utcDate = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

// "2026-W42" (ISO week) -> Monday of that week
function isoWeekToMonday(week: string): Date | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(week);
  if (!m) return null;
  const year = Number(m[1]);
  const w = Number(m[2]);
  const jan4 = utcDate(year, 1, 4);
  const jan4Dow = (jan4.getUTCDay() + 6) % 7; // Mon=0
  const week1Monday = new Date(jan4.getTime() - jan4Dow * 86400000);
  return new Date(week1Monday.getTime() + (w - 1) * 7 * 86400000);
}

async function main() {
  const { db } = await import("../src/lib/db");
  const rejects: string[] = [];
  const counts: Record<string, number> = {};

  const dists = read("distributor_master");
  for (const r of dists) {
    await db.distributor.upsert({
      where: { code: r.Distributor_ID },
      create: { code: r.Distributor_ID, name: r.Distributor_Name, region: r.Region, status: r.Status },
      update: { name: r.Distributor_Name, region: r.Region, status: r.Status },
    });
  }
  counts.Distributor = dists.length;

  const distCodes = new Set(dists.map((d) => d.Distributor_ID));
  const skus = read("sku_master");
  for (const r of skus) {
    const isPerishable = r.Perishability.toLowerCase() === "high";
    const primary = distCodes.has(r.Distributor_ID) ? r.Distributor_ID : null;
    if (!primary) rejects.push(`sku_master ${r.SKU_ID}: unknown Distributor_ID "${r.Distributor_ID}" (stored as null)`);
    const data = {
      name: r.SKU_Name,
      category: r.Category,
      isPerishable,
      standardReorderQty: Number(r.Standard_Reorder_Qty),
      unitOfMeasure: r.Unit_of_Measure,
      primaryDistributorCode: primary,
    };
    await db.sku.upsert({ where: { code: r.SKU_ID }, create: { code: r.SKU_ID, ...data }, update: data });
  }
  counts.Sku = skus.length;
  const skuCodes = new Set(skus.map((s) => s.SKU_ID));

  let salesOk = 0;
  for (const r of read("weekly_sales")) {
    const weekStart = isoWeekToMonday(r.Week);
    const units = Number(r.Units_Sold);
    if (!skuCodes.has(r.SKU_ID) || !weekStart || !Number.isInteger(units) || units < 0) {
      rejects.push(`weekly_sales ${JSON.stringify(r)}: rejected (unknown SKU, bad week, or bad units)`);
      continue;
    }
    await db.weeklySale.upsert({
      where: { skuCode_weekStart: { skuCode: r.SKU_ID, weekStart } },
      create: { skuCode: r.SKU_ID, weekStart, units },
      update: { units },
    });
    salesOk++;
  }
  counts.WeeklySale = salesOk;

  let invOk = 0;
  for (const r of read("current_inventory")) {
    const asOfDate = new Date(`${r.As_Of_Date}T00:00:00Z`);
    const onHand = Number(r.Units_On_Hand);
    if (!skuCodes.has(r.SKU_ID) || Number.isNaN(asOfDate.getTime()) || !Number.isInteger(onHand)) {
      rejects.push(`current_inventory ${JSON.stringify(r)}: rejected`);
      continue;
    }
    await db.inventorySnapshot.upsert({
      where: { skuCode_asOfDate: { skuCode: r.SKU_ID, asOfDate } },
      create: { skuCode: r.SKU_ID, asOfDate, location: r.Location, onHand },
      update: { location: r.Location, onHand },
    });
    invOk++;
  }
  counts.InventorySnapshot = invOk;

  let fest = 0;
  for (const r of read("calendar")) {
    if (r.Is_Festival_Month.toUpperCase() !== "TRUE") continue;
    const y = Number(r.Year);
    const mo = Number(r.Month);
    const startDate = utcDate(y, mo, 1);
    const endDate = utcDate(y, mo + 1, 0);
    await db.festival.upsert({
      where: { startDate_endDate: { startDate, endDate } },
      create: { name: `Festival month ${r.Year_Month}`, startDate, endDate },
      update: { name: `Festival month ${r.Year_Month}` },
    });
    fest++;
  }
  counts.Festival = fest;

  const md = [
    "# Data quality report",
    "",
    `Generated ${new Date().toISOString()} from \`${DATA_DIR}\``,
    "",
    "## Rows loaded",
    ...Object.entries(counts).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Rejects",
    ...(rejects.length ? rejects.map((r) => `- ${r}`) : ["- none"]),
    "",
    "## Missing fields (not in source files)",
    "- on-order quantity (treated as 0, labelled \"on-order unavailable\")",
    "- unit price (order value empty; E6 skipped; guardrail compares units)",
    "- case pack (treated as 1)",
    "- lead time (E5 skipped)",
    "- distributor on weekly sales (E2 and top-10 distributor pre-placement check cannot run)",
    "- exact festival dates (calendar gives festival months only)",
    "",
  ].join("\n");
  fs.writeFileSync("data-quality.md", md);
  console.log(JSON.stringify({ counts, rejects: rejects.length }));
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

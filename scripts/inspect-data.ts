import "dotenv/config";
import { config } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

config({ path: ".env.local" });

const DATA_DIR = process.env.DATA_DIR ?? "D:\\Mesa\\Deepa Case";
const FILES = ["calendar", "current_inventory", "distributor_master", "sku_master", "weekly_sales"];

type Row = Record<string, string>;

function inferType(values: string[]): string {
  const v = values.filter((x) => x !== "");
  if (v.length === 0) return "empty";
  if (v.every((x) => /^-?\d+$/.test(x))) return "integer";
  if (v.every((x) => /^-?\d+(\.\d+)?$/.test(x))) return "number";
  if (v.every((x) => /^\d{4}-\d{2}-\d{2}$/.test(x))) return "date";
  if (v.every((x) => /^\d{4}-W\d{2}$/.test(x))) return "iso-week";
  if (v.every((x) => /^\d{4}-\d{2}$/.test(x))) return "year-month";
  if (v.every((x) => /^(TRUE|FALSE)$/i.test(x))) return "boolean";
  return "string";
}

function distinct(rows: Row[], col: string) {
  return new Set(rows.map((r) => r[col])).size;
}

const data: Record<string, Row[]> = {};
for (const name of FILES) {
  const file = path.join(DATA_DIR, `${name}.csv`);
  const rows: Row[] = parse(fs.readFileSync(file, "utf8"), { columns: true, skip_empty_lines: true, trim: true, bom: true });
  data[name] = rows;
  console.log(`\n=== ${name}.csv — ${rows.length} rows`);
  const cols = Object.keys(rows[0] ?? {});
  for (const c of cols) {
    const vals = rows.map((r) => r[c]);
    const types = inferType(vals);
    const numeric = types === "integer" || types === "number";
    const sorted = [...new Set(vals)].sort(numeric ? (a, b) => Number(a) - Number(b) : undefined);
    const range = ["date", "iso-week", "year-month", "integer", "number"].includes(types) ? ` range ${sorted[0]} .. ${sorted[sorted.length - 1]}` : "";
    console.log(`  ${c}: ${types}, ${sorted.length} distinct, ${vals.filter((v) => v === "").length} blank${range}`);
  }
  console.log("  first 5:");
  console.table(rows.slice(0, 5));
}

const sales = data.weekly_sales;
const skus = data.sku_master;
const inv = data.current_inventory;
const dists = data.distributor_master;

console.log("\n=== Cross-checks");
console.log(`distinct SKUs: sales=${distinct(sales, "SKU_ID")} master=${skus.length} inventory=${distinct(inv, "SKU_ID")}`);
console.log(`distinct weeks in sales: ${distinct(sales, "Week")}; distributors in master: ${dists.length}`);

const skuSet = new Set(skus.map((s) => s.SKU_ID));
const notInMaster = [...new Set(sales.map((s) => s.SKU_ID))].filter((s) => !skuSet.has(s));
const noSales = [...skuSet].filter((s) => !sales.some((r) => r.SKU_ID === s));
const noInv = [...skuSet].filter((s) => !inv.some((r) => r.SKU_ID === s));
console.log(`sales SKUs not in master: ${notInMaster.join(",") || "none"}; master SKUs without sales: ${noSales.join(",") || "none"}; without inventory: ${noInv.join(",") || "none"}`);

const dupKeys = sales.length - new Set(sales.map((s) => `${s.SKU_ID}|${s.Week}`)).size;
console.log(`duplicate (SKU, week) rows in sales: ${dupKeys}`);
console.log(`negative units: sales=${sales.filter((s) => Number(s.Units_Sold) < 0).length} inventory=${inv.filter((s) => Number(s.Units_On_Hand) < 0).length}`);
console.log(`inventory rows per SKU > 1: ${skus.filter((s) => inv.filter((r) => r.SKU_ID === s.SKU_ID).length > 1).map((s) => s.SKU_ID).join(",") || "none"}; locations: ${[...new Set(inv.map((r) => r.Location))].join("; ")}`);
console.log(`distributor ids in sku_master not in distributor_master: ${[...new Set(skus.map((s) => s.Distributor_ID))].filter((d) => !dists.some((x) => x.Distributor_ID === d)).join(",") || "none"}`);

console.log("\n=== Weeks of history per SKU");
const weeks = new Map<string, string[]>();
for (const r of sales) weeks.set(r.SKU_ID, [...(weeks.get(r.SKU_ID) ?? []), r.Week]);
const perSku = [...weeks.entries()].sort().map(([sku, w]) => {
  const s = [...w].sort();
  return { sku, weeks: w.length, first: s[0], last: s[s.length - 1] };
});
console.table(perSku);

console.log("\n=== Missing fields vs. spec");
const has = (file: string, col: string) => Object.keys(data[file][0] ?? {}).includes(col);
const missing = [
  ["on-order quantity", false],
  ["lead time", false],
  ["unit price", false],
  ["case pack", false],
  ["perishability flag", has("sku_master", "Perishability")],
  ["distributor dimension in weekly sales", has("weekly_sales", "Distributor_ID")],
  ["festival names/dates in calendar", has("calendar", "Festival_Name") || has("calendar", "Date")],
] as const;
for (const [what, present] of missing) console.log(`  ${present ? "present " : "MISSING "} ${what}`);

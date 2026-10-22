import { engineConfig } from "@/config/engine";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { runEngine, type SkuInput, type WeekSale } from "@/lib/engine";
import { ApiError } from "@/lib/api";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const asDate = (s: string) => new Date(`${s}T00:00:00Z`);
// Postgres double precision accepts Infinity but JSON does not; cap it.
const finite = (n: number) => (Number.isFinite(n) ? n : 9999);

export async function loadInputs(runDate: string): Promise<SkuInput[]> {
  const day = asDate(runDate);
  const [skus, sales, snapshots, flags] = await Promise.all([
    db.sku.findMany({ orderBy: { code: "asc" } }),
    db.weeklySale.findMany({ where: { weekStart: { lt: day } }, orderBy: { weekStart: "asc" } }),
    db.inventorySnapshot.findMany({ where: { asOfDate: { lte: day } }, orderBy: { asOfDate: "desc" } }),
    db.eventFlag.findMany({ where: { startDate: { lte: day }, endDate: { gte: day } } }),
  ]);

  const salesBySku = new Map<string, WeekSale[]>();
  for (const s of sales) {
    const list = salesBySku.get(s.skuCode) ?? [];
    list.push({ weekStart: iso(s.weekStart), units: s.units });
    salesBySku.set(s.skuCode, list);
  }
  const latestSnap = new Map<string, (typeof snapshots)[number]>();
  for (const s of snapshots) if (!latestSnap.has(s.skuCode)) latestSnap.set(s.skuCode, s);

  return skus.map((sku) => {
    const snap = latestSnap.get(sku.code);
    const dataIssues: string[] = [];
    if (!snap) dataIssues.push("no inventory snapshot on or before the run date");
    return {
      code: sku.code,
      isPerishable: sku.isPerishable,
      casePack: sku.casePack,
      unitPrice: sku.unitPrice == null ? null : Number(sku.unitPrice),
      leadTimeWeeks: sku.leadTimeWeeks,
      sales: salesBySku.get(sku.code) ?? [],
      onHand: snap?.onHand ?? 0,
      onOrder: snap?.onOrder ?? null,
      activeEventFlag: flags.some((f) => f.skuCode === sku.code || (f.distributorCode != null && f.distributorCode === sku.primaryDistributorCode)),
      dataIssues,
    };
  });
}

export async function createRun(runDate: string) {
  const festivals = (await db.festival.findMany()).map((f) => ({ start: iso(f.startDate), end: iso(f.endDate) }));
  const inputs = await loadInputs(runDate);
  const result = runEngine(inputs, { runDate, festivals });

  const run = await db.$transaction(async (tx) => {
    const created = await tx.run.create({
      data: {
        runDate: asDate(runDate),
        status: result.status,
        haltReason: result.haltReason,
        configSnapshot: engineConfig as object,
        totals: result.totals,
      },
    });
    if (result.status === "COMPLETED") {
      await tx.recommendation.createMany({
        data: result.results.map((r) => ({
          runId: created.id,
          skuCode: r.skuCode,
          flag: r.flag,
          avg4: r.avg4,
          avg12: r.avg12,
          festivalFactor: r.festivalFactor,
          demandRate: r.demandRate,
          inventoryPosition: r.inventoryPosition,
          weeksOfCover: finite(r.weeksOfCover),
          qty: r.qty,
          orderValue: r.orderValue,
          reason: r.reason,
        })),
      });
      const exceptions = result.results.flatMap((r) => r.exceptions.map((e) => ({ runId: created.id, skuCode: r.skuCode, code: e.code, detail: e.detail })));
      if (exceptions.length) await tx.recException.createMany({ data: exceptions });
    }
    return created;
  });

  if (result.status === "HALTED") logger.warn("run halted by guardrail", { runId: run.id, reason: result.haltReason });
  logger.info("run created", { runId: run.id, runDate, status: result.status, byFlag: result.totals.byFlag });
  return { run, warnings: [...new Set(result.results.flatMap((r) => r.warnings))] };
}

export async function getRunOrThrow(id: number) {
  const run = await db.run.findUnique({ where: { id } });
  if (!run) throw new ApiError(404, "NOT_FOUND", `Run ${id} not found.`);
  return run;
}

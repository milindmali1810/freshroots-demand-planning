import { db } from "@/lib/db";
import { ApiError, route } from "@/lib/api";

export const GET = route("GET /api/skus/[code]", async (_req, ctx) => {
  const { code } = await ctx.params;
  const sku = await db.sku.findUnique({ where: { code }, include: { primaryDistributor: { select: { name: true, region: true } } } });
  if (!sku) throw new ApiError(404, "NOT_FOUND", `SKU ${code} not found.`);
  const [sales, inventory, history] = await Promise.all([
    db.weeklySale.findMany({ where: { skuCode: code }, orderBy: { weekStart: "asc" } }),
    db.inventorySnapshot.findFirst({ where: { skuCode: code }, orderBy: { asOfDate: "desc" } }),
    db.recommendation.findMany({ where: { skuCode: code, run: { status: "COMPLETED" } }, include: { run: { select: { runDate: true } } }, orderBy: { runId: "asc" } }),
  ]);
  return Response.json({
    sku,
    sales: sales.map((s) => ({ weekStart: s.weekStart.toISOString().slice(0, 10), units: s.units })),
    inventory,
    history: history.map((h) => ({ runId: h.runId, runDate: h.run.runDate.toISOString().slice(0, 10), flag: h.flag, avg4: h.avg4, avg12: h.avg12, weeksOfCover: h.weeksOfCover, qty: h.qty })),
  });
});

import { db } from "@/lib/db";
import { route } from "@/lib/api";

// Chart data for the dashboard: total units sold per week, and current stock by category.
export const GET = route("GET /api/overview", async () => {
  const [weekly, snapshots, skus] = await Promise.all([
    db.weeklySale.groupBy({ by: ["weekStart"], _sum: { units: true }, orderBy: { weekStart: "asc" } }),
    db.inventorySnapshot.findMany({ orderBy: { asOfDate: "desc" } }),
    db.sku.findMany({ select: { code: true, category: true } }),
  ]);

  const latest = new Map<string, number>();
  for (const s of snapshots) if (!latest.has(s.skuCode)) latest.set(s.skuCode, s.onHand);

  const byCategory = new Map<string, number>();
  for (const sku of skus) byCategory.set(sku.category, (byCategory.get(sku.category) ?? 0) + (latest.get(sku.code) ?? 0));

  return Response.json({
    weekly: weekly.map((w) => ({ weekStart: w.weekStart.toISOString().slice(0, 10), units: w._sum.units ?? 0 })),
    stockByCategory: [...byCategory.entries()].map(([category, units]) => ({ category, units })).sort((a, b) => b.units - a.units),
  });
});

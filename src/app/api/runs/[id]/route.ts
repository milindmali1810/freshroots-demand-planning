import { db } from "@/lib/db";
import { parseId, route } from "@/lib/api";
import { getRunOrThrow } from "@/lib/services/runs";

export const GET = route("GET /api/runs/[id]", async (_req, ctx) => {
  const id = parseId((await ctx.params).id);
  const run = await getRunOrThrow(id);
  const [recommendations, exceptions] = await Promise.all([
    db.recommendation.findMany({ where: { runId: id }, include: { sku: { select: { name: true, category: true, isPerishable: true } } }, orderBy: { skuCode: "asc" } }),
    db.recException.findMany({ where: { runId: id }, orderBy: [{ code: "asc" }, { skuCode: "asc" }] }),
  ]);
  return Response.json({ run, recommendations, exceptions });
});

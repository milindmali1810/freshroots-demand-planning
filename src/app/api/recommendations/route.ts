import { z } from "zod";
import { db } from "@/lib/db";
import { route } from "@/lib/api";

const query = z.object({
  runId: z.coerce.number().int().positive().optional(),
  flag: z.enum(["STOCKOUT_RISK", "OVERSTOCK", "HIGH_DEMAND", "WATCH", "OK", "EXCEPTION"]).optional(),
  status: z.enum(["PENDING", "APPROVED", "OVERRIDDEN", "REJECTED"]).optional(),
  perishable: z.enum(["true", "false"]).optional(),
});

export const GET = route("GET /api/recommendations", async (req) => {
  const q = query.parse(Object.fromEntries(new URL(req.url).searchParams));
  const runId = q.runId ?? (await db.run.findFirst({ where: { status: "COMPLETED" }, orderBy: { id: "desc" } }))?.id;
  if (runId == null) return Response.json({ recommendations: [] });
  const recommendations = await db.recommendation.findMany({
    where: {
      runId,
      flag: q.flag,
      status: q.status,
      sku: q.perishable ? { isPerishable: q.perishable === "true" } : undefined,
    },
    include: { sku: { select: { name: true, category: true, isPerishable: true } } },
    orderBy: { skuCode: "asc" },
  });
  return Response.json({ runId, recommendations });
});

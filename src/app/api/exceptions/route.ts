import { z } from "zod";
import { db } from "@/lib/db";
import { route } from "@/lib/api";

const query = z.object({ runId: z.coerce.number().int().positive().optional() });

export const GET = route("GET /api/exceptions", async (req) => {
  const q = query.parse(Object.fromEntries(new URL(req.url).searchParams));
  const runId = q.runId ?? (await db.run.findFirst({ where: { status: "COMPLETED" }, orderBy: { id: "desc" } }))?.id;
  if (runId == null) return Response.json({ exceptions: [] });
  const exceptions = await db.recException.findMany({
    where: { runId },
    include: { sku: { select: { name: true } } },
    orderBy: [{ code: "asc" }, { skuCode: "asc" }],
  });
  return Response.json({ runId, exceptions });
});

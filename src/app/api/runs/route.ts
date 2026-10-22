import { z } from "zod";
import { db } from "@/lib/db";
import { parseBody, route } from "@/lib/api";
import { createRun } from "@/lib/services/runs";

const body = z.object({ runDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "runDate must be YYYY-MM-DD").refine((d) => !Number.isNaN(Date.parse(d)), "invalid date") });

export const POST = route("POST /api/runs", async (req) => {
  const { runDate } = await parseBody(req, body);
  const { run, warnings } = await createRun(runDate);
  return Response.json({ run, warnings }, { status: 201 });
});

export const GET = route("GET /api/runs", async () => {
  const runs = await db.run.findMany({ orderBy: { id: "desc" }, take: 50 });
  return Response.json({ runs });
});

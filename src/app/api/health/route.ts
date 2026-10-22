import { db } from "@/lib/db";
import { route } from "@/lib/api";

export const GET = route("GET /api/health", async () => {
  await db.$queryRaw`SELECT 1`;
  return Response.json({ status: "ok", time: new Date().toISOString() });
});

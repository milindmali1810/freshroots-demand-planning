import { route } from "@/lib/api";
import { getMetrics } from "@/lib/services/metrics";

export const GET = route("GET /api/metrics", async () => Response.json(await getMetrics()));

import { z } from "zod";
import { parseBody, parseId, route } from "@/lib/api";
import { decide } from "@/lib/services/decisions";

const body = z.object({
  action: z.enum(["APPROVE", "OVERRIDE", "REJECT"]),
  newQty: z.number().int().nonnegative().optional(),
  reasonCode: z.string().trim().min(1, "reasonCode is required"),
  note: z.string().trim().max(1000).optional(),
  decidedBy: z.string().trim().min(1).max(100).default("planner"),
});

export const POST = route("POST /api/recommendations/[id]/decision", async (req, ctx) => {
  const id = parseId((await ctx.params).id);
  const input = await parseBody(req, body);
  const decision = await decide(id, input);
  return Response.json({ decision }, { status: 201 });
});

import { z } from "zod";
import { ApiError, parseId, route } from "@/lib/api";
import { runPreplacementCheck } from "@/lib/services/decisions";

// Optional body: the named owner's decision on a HOLD.
const body = z.object({ ownerDecision: z.enum(["PROCEED", "REDUCE", "CANCEL"]).optional(), ownerNote: z.string().trim().max(1000).optional() });

export const POST = route("POST /api/recommendations/[id]/preplacement-check", async (req, ctx) => {
  const id = parseId((await ctx.params).id);
  const text = await req.text();
  let owner: z.infer<typeof body> = {};
  if (text.trim()) {
    try {
      owner = body.parse(JSON.parse(text));
    } catch (e) {
      if (e instanceof SyntaxError) throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON.");
      throw e;
    }
  }
  const check = await runPreplacementCheck(id, owner);
  return Response.json({ check }, { status: 201 });
});

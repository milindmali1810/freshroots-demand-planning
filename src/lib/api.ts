import { ZodError, type ZodType } from "zod";
import { logger } from "@/lib/logger";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

/** Wraps a route handler: consistent { error: { code, message } } bodies and structured logs. */
export function route(name: string, handler: Handler): Handler {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (e) {
      // Next.js control-flow errors (e.g. the dynamic-rendering bail-out) carry a digest: let them through.
      if (typeof e === "object" && e !== null && "digest" in e) throw e;
      if (e instanceof ApiError) return errorResponse(e.status, e.code, e.message);
      if (e instanceof ZodError) {
        return errorResponse(400, "VALIDATION_ERROR", e.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "));
      }
      logger.error("unhandled api error", { route: name, error: e instanceof Error ? e.message : String(e) });
      return errorResponse(500, "INTERNAL_ERROR", "Something went wrong.");
    }
  };
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
  return schema.parse(json);
}

export function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "INVALID_ID", "id must be a positive integer.");
  return id;
}

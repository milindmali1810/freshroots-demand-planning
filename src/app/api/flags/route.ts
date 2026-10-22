import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, parseBody, route } from "@/lib/api";
import { logger } from "@/lib/logger";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");
const body = z
  .object({
    skuCode: z.string().trim().min(1).optional(),
    distributorCode: z.string().trim().min(1).optional(),
    startDate: date,
    endDate: date,
    note: z.string().trim().min(1, "note is required").max(1000),
    createdBy: z.string().trim().min(1).max(100).default("planner"),
  })
  .refine((b) => b.skuCode || b.distributorCode, { message: "skuCode or distributorCode is required" })
  .refine((b) => b.startDate <= b.endDate, { message: "startDate must not be after endDate" });

export const POST = route("POST /api/flags", async (req) => {
  const b = await parseBody(req, body);
  if (b.skuCode && !(await db.sku.findUnique({ where: { code: b.skuCode } }))) throw new ApiError(404, "NOT_FOUND", `SKU ${b.skuCode} not found.`);
  if (b.distributorCode && !(await db.distributor.findUnique({ where: { code: b.distributorCode } }))) {
    throw new ApiError(404, "NOT_FOUND", `Distributor ${b.distributorCode} not found.`);
  }
  const flag = await db.eventFlag.create({
    data: { skuCode: b.skuCode, distributorCode: b.distributorCode, startDate: new Date(`${b.startDate}T00:00:00Z`), endDate: new Date(`${b.endDate}T00:00:00Z`), note: b.note, createdBy: b.createdBy },
  });
  logger.info("event flag created", { flagId: flag.id, sku: b.skuCode, distributor: b.distributorCode });
  return Response.json({ flag }, { status: 201 });
});

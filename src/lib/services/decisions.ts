import { engineConfig } from "@/config/engine";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { preplacementCheck } from "@/lib/engine";
import { ApiError } from "@/lib/api";
import type { DecisionAction, RecStatus } from "@/generated/prisma/client";

const STATUS: Record<DecisionAction, RecStatus> = { APPROVE: "APPROVED", OVERRIDE: "OVERRIDDEN", REJECT: "REJECTED" };

export interface DecisionInput {
  action: DecisionAction;
  newQty?: number;
  reasonCode: string;
  note?: string;
  decidedBy: string;
}

async function getRec(id: number) {
  const rec = await db.recommendation.findUnique({ where: { id }, include: { sku: true } });
  if (!rec) throw new ApiError(404, "NOT_FOUND", `Recommendation ${id} not found.`);
  return rec;
}

export async function decide(id: number, input: DecisionInput) {
  const rec = await getRec(id);
  if (rec.status !== "PENDING") throw new ApiError(409, "ALREADY_DECIDED", `Recommendation ${id} is already ${rec.status}.`);
  if (input.action === "APPROVE" && rec.qty == null) {
    throw new ApiError(422, "NO_QUANTITY", "This recommendation has no quantity to approve. Override with a quantity, or reject it.");
  }
  if (input.action === "OVERRIDE" && input.newQty == null) throw new ApiError(400, "NEW_QTY_REQUIRED", "newQty is required when overriding.");

  const decision = await db.$transaction(async (tx) => {
    const d = await tx.decision.create({
      data: {
        recommendationId: id,
        action: input.action,
        newQty: input.action === "OVERRIDE" ? input.newQty : null,
        reasonCode: input.reasonCode,
        note: input.note,
        decidedBy: input.decidedBy,
      },
    });
    await tx.recommendation.update({ where: { id }, data: { status: STATUS[input.action] } });
    return d;
  });
  logger.info("decision recorded", { recommendationId: id, sku: rec.skuCode, action: input.action, reasonCode: input.reasonCode, decidedBy: input.decidedBy });
  return decision;
}

export async function runPreplacementCheck(id: number, owner?: { ownerDecision?: string; ownerNote?: string }) {
  const rec = await getRec(id);
  if (rec.status !== "APPROVED" && rec.status !== "OVERRIDDEN") {
    throw new ApiError(409, "NOT_APPROVED", "Pre-placement check applies only to approved or overridden recommendations.");
  }
  const approval = await db.decision.findFirst({ where: { recommendationId: id }, orderBy: { decidedAt: "desc" } });
  const since = approval?.decidedAt ?? new Date(0);

  const latest = await db.weeklySale.findFirst({ where: { skuCode: rec.skuCode }, orderBy: { weekStart: "desc" } });
  const newFlag = await db.eventFlag.findFirst({
    where: {
      createdAt: { gt: since },
      OR: [{ skuCode: rec.skuCode }, ...(rec.sku.primaryDistributorCode ? [{ distributorCode: rec.sku.primaryDistributorCode }] : [])],
    },
  });

  const check = preplacementCheck({ avg4AtApproval: rec.avg4, latestWeekUnits: latest?.units ?? 0, newEventFlag: !!newFlag }, engineConfig);
  const row = await db.preplacementCheck.create({
    data: {
      recommendationId: id,
      result: check.result,
      triggers: { triggers: check.triggers, warnings: check.warnings },
      ownerDecision: owner?.ownerDecision,
      ownerNote: owner?.ownerNote,
    },
  });
  logger.info("pre-placement check", { recommendationId: id, sku: rec.skuCode, result: check.result, triggers: check.triggers.map((t) => t.code) });
  return { ...row, ...check };
}

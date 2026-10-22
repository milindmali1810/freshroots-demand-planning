import { engineConfig } from "@/config/engine";
import { db } from "@/lib/db";

export async function getMetrics() {
  const latest = await db.run.findFirst({ orderBy: { id: "desc" } });
  const [decisions, overrides] = await Promise.all([db.decision.count(), db.decision.count({ where: { action: "OVERRIDE" } })]);
  const overrideRate = decisions ? overrides / decisions : 0;
  const totals = (latest?.totals ?? null) as { exceptionRate?: number; byFlag?: Record<string, number> } | null;
  const exceptionRate = totals?.exceptionRate ?? null;
  const { overrideRateWarn, expectedExceptionRate, quarterlyLossKillLakh } = engineConfig.kill;
  return {
    latestRun: latest && { id: latest.id, runDate: latest.runDate.toISOString().slice(0, 10), status: latest.status, haltReason: latest.haltReason, byFlag: totals?.byFlag ?? {} },
    overrideRate: { value: overrideRate, decisions, overrides, warnAbove: overrideRateWarn, warning: overrideRate > overrideRateWarn },
    exceptionRate: {
      value: exceptionRate,
      expected: expectedExceptionRate,
      outsideExpected: exceptionRate != null && (exceptionRate < expectedExceptionRate.min || exceptionRate > expectedExceptionRate.max),
    },
    killRule: `Project is killed if quarterly losses exceed ₹${quarterlyLossKillLakh} lakh against Raghav's manual plan. Reporting only; Deepa decides.`,
  };
}

// Pure rules engine. No database or network access. See docs/BUILD_SPEC.md B3.
import { engineConfig, type EngineConfig } from "@/config/engine";
import { addDays, lastCompleteWeekStart, toMs } from "./dates";
import type {
  DateWindow,
  EngineException,
  Flag,
  PreplacementInput,
  PreplacementResult,
  RunContext,
  RunResult,
  SkuInput,
  SkuResult,
  WeekSale,
} from "./types";

export * from "./types";

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const fmt = (n: number) => (Number.isFinite(n) ? (Math.round(n * 10) / 10).toString() : "unlimited");

export function festivalFactor(runDate: string, festivals: DateWindow[], cfg: EngineConfig = engineConfig): number {
  const from = toMs(runDate);
  const to = toMs(addDays(runDate, cfg.festivalLookaheadDays)); // exclusive
  const hit = festivals.some((f) => toMs(f.end) >= from && toMs(f.start) < to);
  return hit ? cfg.festivalFactor : 1;
}

function roundToCase(q: number, casePack: number, perishable: boolean): number {
  const x = Math.max(0, q);
  return (perishable ? Math.floor(x / casePack) : Math.ceil(x / casePack)) * casePack;
}

/** Complete weeks only, oldest to newest, last write wins on duplicates. */
function completeWeeks(sales: WeekSale[], runDate: string) {
  const last = lastCompleteWeekStart(runDate);
  const byWeek = new Map<string, number>();
  let duplicates = 0;
  let negatives = 0;
  for (const s of sales) {
    if (toMs(s.weekStart) > toMs(last)) continue;
    if (byWeek.has(s.weekStart)) duplicates++;
    if (s.units < 0) negatives++;
    byWeek.set(s.weekStart, s.units);
  }
  const weeks = [...byWeek.entries()].sort(([a], [b]) => toMs(a) - toMs(b)).map(([weekStart, units]) => ({ weekStart, units }));
  return { weeks, last, duplicates, negatives };
}

export function planSku(input: SkuInput, ctx: RunContext, cfg: EngineConfig = engineConfig): SkuResult {
  const casePack = input.casePack && input.casePack > 0 ? input.casePack : 1;
  const bounds = input.isPerishable ? cfg.cover.perishable : cfg.cover.general;
  const { weeks, last, duplicates, negatives } = completeWeeks(input.sales, ctx.runDate);
  const units = weeks.map((w) => w.units);
  const avg12 = mean(units.slice(-cfg.weeksLong));
  const avg4 = mean(units.slice(-cfg.weeksShort));
  const F = festivalFactor(ctx.runDate, ctx.festivals, cfg);
  const D = avg12 * F;
  const surgeLimit = cfg.surgeThreshold * D;
  const surgeTest = avg4 > surgeLimit;
  const lastTwo = units.slice(-2);
  const surgeConfirmed = surgeTest && lastTwo.length === 2 && lastTwo.every((u) => u > surgeLimit);
  const R = surgeConfirmed ? avg4 : D;
  const onOrderUnavailable = input.onOrder == null;
  const IP = input.onHand + (input.onOrder ?? 0);
  const woc = R > 0 ? IP / R : Infinity;
  const qStd = roundToCase(cfg.stdOrderWeeks * avg12, casePack, input.isPerishable);
  const s = surgeConfirmed ? cfg.surgeOrderMultiplier : 1;
  const warnings: string[] = [];
  if (onOrderUnavailable) warnings.push("on-order unavailable (treated as 0)");

  // Provisional flag, ignoring exceptions
  let flag: Flag;
  if (woc > bounds.max) flag = "OVERSTOCK";
  else if (woc < bounds.min) flag = "STOCKOUT_RISK";
  else if (surgeConfirmed) flag = "HIGH_DEMAND";
  else if (surgeTest) flag = "WATCH";
  else flag = "OK";

  const orders = flag === "STOCKOUT_RISK" || flag === "HIGH_DEMAND";
  const capQty = bounds.max * R - IP;
  const qty = orders ? roundToCase(Math.min(qStd * s, capQty), casePack, input.isPerishable) : null;
  const orderValue = qty != null && input.unitPrice != null ? qty * input.unitPrice : null;

  // Exceptions
  const ex: EngineException[] = [];
  if (weeks.length < cfg.minHistoryWeeks) {
    ex.push({ code: "E1", detail: `New SKU: only ${weeks.length} weeks of history (need ${cfg.minHistoryWeeks}).` });
  }
  if (input.distributorSales?.length) {
    const total12 = input.distributorSales.reduce((a, d) => a + d.sales.slice(-cfg.weeksLong).reduce((x, w) => x + w.units, 0), 0);
    for (const d of input.distributorSales) {
      const u = d.sales.map((w) => w.units);
      const share = total12 > 0 ? u.slice(-cfg.weeksLong).reduce((a, b) => a + b, 0) / total12 : 0;
      const dAvg12 = mean(u.slice(-cfg.weeksLong));
      const dAvg4 = mean(u.slice(-cfg.weeksShort));
      if (share >= cfg.distributorShareMin && dAvg12 > 0 && Math.abs(dAvg4 - dAvg12) / dAvg12 >= cfg.distributorSwingMin) {
        ex.push({ code: "E2", detail: `Distributor ${d.code} (${Math.round(share * 100)}% of volume) moved ${Math.round(((dAvg4 - dAvg12) / dAvg12) * 100)}% (AVG4 ${fmt(dAvg4)} vs AVG12 ${fmt(dAvg12)}).` });
      }
    }
  } else {
    warnings.push("E2 skipped: no distributor-level sales");
  }
  if (input.activeEventFlag) ex.push({ code: "E3", detail: "Active market-event flag for this SKU or its distributor." });

  const problems: string[] = [...(input.dataIssues ?? [])];
  if (duplicates > 0) problems.push(`${duplicates} duplicate week row(s)`);
  if (negatives > 0) problems.push(`${negatives} negative sales value(s)`);
  if (input.onHand < 0) problems.push("negative stock");
  if (weeks.length > 0) {
    const first = toMs(weeks[0].weekStart);
    const expected = Math.round((toMs(last) - first) / (7 * 86_400_000)) + 1;
    const missing = expected - weeks.length;
    if (missing > 0) problems.push(`${missing} missing week(s) between ${weeks[0].weekStart} and ${last}`);
  } else {
    problems.push("no sales history");
  }
  if (problems.length) ex.push({ code: "E4", detail: `Data problem: ${problems.join("; ")}.` });

  if (input.leadTimeWeeks == null) warnings.push("E5 skipped: lead time unavailable");
  else if (input.leadTimeWeeks >= bounds.min) {
    ex.push({ code: "E5", detail: `Lead time ${input.leadTimeWeeks}w is at or above minimum cover ${bounds.min}w.` });
  }

  if (qty != null && input.unitPrice == null) warnings.push("E6 skipped: unit price unavailable");
  else if (orderValue != null && orderValue > cfg.largeOrderValue) {
    ex.push({ code: "E6", detail: `Order value ₹${Math.round(orderValue).toLocaleString("en-IN")} exceeds ₹${cfg.largeOrderValue.toLocaleString("en-IN")}.` });
  }

  if (qty != null && R > 0 && (IP + qty) / R < bounds.min) {
    ex.push({ code: "E7", detail: `Capped order of ${qty} still leaves ${fmt((IP + qty) / R)} weeks of cover, below the minimum ${bounds.min}.` });
  }

  const common = { skuCode: input.code, avg4, avg12, festivalFactor: F, demandRate: R, inventoryPosition: IP, weeksOfCover: woc, qStd, surgeTest, surgeConfirmed, warnings, onOrderUnavailable };
  const suffix = onOrderUnavailable ? " (on-order unavailable)" : "";

  if (ex.length) {
    return { ...common, flag: "EXCEPTION", qty: null, orderValue: null, exceptions: ex, reason: `Needs Raghav's judgment: ${ex.map((e) => e.code).join(", ")} — ${ex[0].detail}${suffix}` };
  }

  const cover = `${fmt(woc)} weeks of cover (limits ${bounds.min}–${bounds.max})`;
  const reasons: Record<Flag, string> = {
    OVERSTOCK: `Overstock: ${cover}; pause the next order${suffix}.`,
    STOCKOUT_RISK: `Stockout risk: ${cover}; reorder ${qty} units now${surgeConfirmed ? " (1.5x because demand is surging)" : ""}${suffix}.`,
    HIGH_DEMAND: `High demand: sales surged two weeks running, ${cover}; next order ${qty} units (1.5x standard)${suffix}.`,
    WATCH: `Watch: sales jumped this week only, ${cover}; no change, retest next run${suffix}.`,
    OK: `OK: ${cover}; no change${suffix}.`,
    EXCEPTION: "",
  };
  return { ...common, flag, qty, orderValue, exceptions: [], reason: reasons[flag] };
}

export function runEngine(inputs: SkuInput[], ctx: RunContext, cfg: EngineConfig = engineConfig): RunResult {
  const results = inputs.map((i) => planSku(i, ctx, cfg));
  const byFlag: Record<Flag, number> = { STOCKOUT_RISK: 0, OVERSTOCK: 0, HIGH_DEMAND: 0, WATCH: 0, OK: 0, EXCEPTION: 0 };
  for (const r of results) byFlag[r.flag]++;

  const useValue = inputs.length > 0 && inputs.every((i) => i.unitPrice != null);
  const weight = (code: string) => (useValue ? inputs.find((i) => i.code === code)!.unitPrice! : 1);
  const baselineTotal = results.reduce((a, r) => a + r.qStd * weight(r.skuCode), 0);
  const recommendedTotal = results.reduce((a, r) => a + (r.qty ?? 0) * weight(r.skuCode), 0);
  const basis = useValue ? "value" : "units";
  const totals = {
    skuCount: results.length,
    byFlag,
    exceptionRate: results.length ? byFlag.EXCEPTION / results.length : 0,
    recommendedTotal,
    baselineTotal,
    basis,
  } as const;

  if (recommendedTotal > cfg.guardrailMultiplier * baselineTotal) {
    return {
      status: "HALTED",
      haltReason: `Guardrail: recommended ${basis} ${Math.round(recommendedTotal)} exceeds ${cfg.guardrailMultiplier}x the all-SKUs-at-standard-order total (${Math.round(baselineTotal)}). Use manual planning.`,
      results: [],
      totals,
    };
  }
  return { status: "COMPLETED", results, totals };
}

export function preplacementCheck(input: PreplacementInput, cfg: EngineConfig = engineConfig): PreplacementResult {
  const triggers: { code: string; detail: string }[] = [];
  const warnings: string[] = [];
  const dev = input.avg4AtApproval > 0 ? Math.abs(input.latestWeekUnits - input.avg4AtApproval) / input.avg4AtApproval : 0;
  if (dev >= cfg.preplacement.latestWeekDeviation) {
    triggers.push({ code: "LATEST_WEEK", detail: `Latest week ${input.latestWeekUnits} differs from AVG4 ${fmt(input.avg4AtApproval)} by ${Math.round(dev * 100)}%.` });
  }
  if (input.topDistributorCuts == null) warnings.push("Top-10 distributor check skipped: no distributor-level sales");
  else {
    for (const d of input.topDistributorCuts) {
      if (d.cut >= cfg.preplacement.distributorCut) triggers.push({ code: "DISTRIBUTOR_CUT", detail: `Distributor ${d.code} cut ${Math.round(d.cut * 100)}%.` });
    }
  }
  if (input.newEventFlag) triggers.push({ code: "NEW_EVENT_FLAG", detail: "A new market-event flag was added since approval." });
  return { result: triggers.length ? "HOLD" : "PROCEED", triggers, warnings };
}

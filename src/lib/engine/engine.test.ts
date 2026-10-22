import { describe, expect, it } from "vitest";
import { addDays, lastCompleteWeekStart } from "./dates";
import { planSku, preplacementCheck, runEngine, type SkuInput, type WeekSale } from "./index";

// 12 complete weeks ending the week before runDate: 8 older weeks at `base`, then 4 recent at `recent`.
function series(runDate: string, base: number, recent: number): WeekSale[] {
  const last = lastCompleteWeekStart(runDate);
  return Array.from({ length: 12 }, (_, i) => ({
    weekStart: addDays(last, -7 * (11 - i)),
    units: i < 8 ? base : recent,
  }));
}

const RUN = "2026-10-12";
const noFestival = { runDate: RUN, festivals: [] };

function sku(over: Partial<SkuInput> & Pick<SkuInput, "sales">): SkuInput {
  return { code: "T", isPerishable: false, casePack: 1, onHand: 0, onOrder: 0, ...over };
}

describe("required examples (case pack = 1)", () => {
  it("Ex1 general: surge both weeks, low cover -> STOCKOUT_RISK, Q = 6,000", () => {
    // AVG12 1000, AVG4 1300
    const r = planSku(sku({ sales: series(RUN, 850, 1300), onHand: 4500, onOrder: 500 }), noFestival);
    expect(r.avg12).toBe(1000);
    expect(r.avg4).toBe(1300);
    expect(r.surgeConfirmed).toBe(true);
    expect(r.flag).toBe("STOCKOUT_RISK");
    expect(r.qty).toBe(6000);
  });

  it("Ex2 perishable -> STOCKOUT_RISK, Q = 600", () => {
    // AVG12 500, AVG4 520
    const r = planSku(sku({ isPerishable: true, sales: series(RUN, 490, 520), onHand: 1100, onOrder: 300 }), noFestival);
    expect(r.avg12).toBe(500);
    expect(r.avg4).toBe(520);
    expect(r.flag).toBe("STOCKOUT_RISK");
    expect(r.qty).toBe(600);
  });

  it("Ex3 festival: Diwali inside next 4 weeks lifts D, so surge is not triggered -> OK", () => {
    // AVG12 2000, AVG4 2700, IP 20,000
    const ctx = { runDate: RUN, festivals: [{ start: "2026-11-08", end: "2026-11-08" }] };
    const r = planSku(sku({ sales: series(RUN, 1650, 2700), onHand: 20000 }), ctx);
    expect(r.avg12).toBe(2000);
    expect(r.avg4).toBe(2700);
    expect(r.festivalFactor).toBe(1.25);
    expect(r.surgeTest).toBe(false);
    expect(r.flag).toBe("OK");
  });

  it("Ex4: surge both weeks but cover above max -> OVERSTOCK", () => {
    // AVG12 800, AVG4 1000, IP 15,000
    const r = planSku(sku({ sales: series(RUN, 700, 1000), onHand: 15000 }), noFestival);
    expect(r.avg12).toBe(800);
    expect(r.avg4).toBe(1000);
    expect(r.surgeConfirmed).toBe(true);
    expect(r.flag).toBe("OVERSTOCK");
  });
});

describe("rules beyond the required examples", () => {
  it("festival is ignored when it is more than 4 weeks away", () => {
    const ctx = { runDate: RUN, festivals: [{ start: "2026-12-01", end: "2026-12-01" }] };
    expect(planSku(sku({ sales: series(RUN, 1650, 2700), onHand: 20000 }), ctx).festivalFactor).toBe(1);
  });

  it("surge in the latest week only -> WATCH", () => {
    const sales = series(RUN, 1000, 1000);
    sales[11].units = 3000; // AVG4 = 1500 > 1.2 x AVG12(1167)? ensure only last week is high
    sales[10].units = 1000;
    const r = planSku(sku({ sales, onHand: 8000 }), noFestival);
    expect(r.surgeTest).toBe(true);
    expect(r.surgeConfirmed).toBe(false);
    expect(r.flag).toBe("WATCH");
  });

  it("E1: fewer than 12 weeks of history -> EXCEPTION, no quantity", () => {
    const r = planSku(sku({ sales: series(RUN, 500, 500).slice(-6), onHand: 100 }), noFestival);
    expect(r.flag).toBe("EXCEPTION");
    expect(r.qty).toBeNull();
    expect(r.exceptions.map((e) => e.code)).toContain("E1");
  });

  it("E3: active event flag -> EXCEPTION", () => {
    const r = planSku(sku({ sales: series(RUN, 500, 500), onHand: 3000, activeEventFlag: true }), noFestival);
    expect(r.flag).toBe("EXCEPTION");
    expect(r.exceptions.map((e) => e.code)).toContain("E3");
  });

  it("E4: missing week and negative stock -> EXCEPTION", () => {
    const sales = series(RUN, 500, 500);
    sales.splice(5, 1);
    const r = planSku(sku({ sales, onHand: -5 }), noFestival);
    expect(r.exceptions.map((e) => e.code)).toContain("E4");
  });

  it("E5 and E6 only fire when lead time / price exist", () => {
    const base = sku({ sales: series(RUN, 850, 1300), onHand: 4500, onOrder: 500 });
    expect(planSku(base, noFestival).warnings.join()).toMatch(/E5 skipped/);
    expect(planSku({ ...base, leadTimeWeeks: 6 }, noFestival).exceptions.map((e) => e.code)).toContain("E5");
    expect(planSku({ ...base, unitPrice: 100 }, noFestival).exceptions.map((e) => e.code)).toContain("E6"); // 6000 x 100 = 6 lakh
  });

  it("rounds up to case pack for general SKUs and down for perishables", () => {
    const g = planSku(sku({ casePack: 24, sales: series(RUN, 850, 1300), onHand: 4500, onOrder: 500 }), noFestival);
    expect(g.qty! % 24).toBe(0);
    expect(g.qty).toBe(6024); // Q_std 4000 -> 4008 (case pack), x1.5 = 6012 -> 6024
    const p = planSku(sku({ isPerishable: true, casePack: 7, sales: series(RUN, 490, 520), onHand: 1100, onOrder: 300 }), noFestival);
    expect(p.qty).toBe(595); // 600 rounded down to a multiple of 7
  });

  it("labels on-order unavailable", () => {
    const r = planSku(sku({ sales: series(RUN, 700, 1000), onHand: 15000, onOrder: null }), noFestival);
    expect(r.onOrderUnavailable).toBe(true);
    expect(r.reason).toMatch(/on-order unavailable/);
  });
});

describe("safety switches", () => {
  it("guardrail: a normal run completes (surge orders are exactly 1.5x Q_std at most)", () => {
    const hot = Array.from({ length: 3 }, (_, i) => sku({ code: `H${i}`, sales: series(RUN, 850, 1300), onHand: 4500, onOrder: 500 }));
    const res = runEngine(hot, noFestival);
    expect(res.status).toBe("COMPLETED");
    expect(res.totals.recommendedTotal).toBe(18000);
    expect(res.totals.baselineTotal).toBe(12000);
  });

  it("guardrail halts the run and keeps no recommendations when total exceeds 1.5x the baseline", () => {
    // case pack 4000: Q_std = 4000, but the 1.5x order of 6000 rounds up to 8000 > 6000
    const res = runEngine([sku({ code: "BIG", casePack: 4000, sales: series(RUN, 850, 1300), onHand: 4500, onOrder: 500 })], noFestival);
    expect(res.status).toBe("HALTED");
    expect(res.haltReason).toMatch(/manual planning/i);
    expect(res.results).toHaveLength(0);
  });

  it("pre-placement check holds on a big latest-week swing, a distributor cut, or a new flag", () => {
    const ok = preplacementCheck({ avg4AtApproval: 1000, latestWeekUnits: 1100, newEventFlag: false });
    expect(ok.result).toBe("PROCEED");
    expect(ok.warnings.length).toBe(1);
    expect(preplacementCheck({ avg4AtApproval: 1000, latestWeekUnits: 780, newEventFlag: false }).result).toBe("HOLD");
    expect(preplacementCheck({ avg4AtApproval: 1000, latestWeekUnits: 1000, topDistributorCuts: [{ code: "D1", cut: 0.3 }], newEventFlag: false }).result).toBe("HOLD");
    expect(preplacementCheck({ avg4AtApproval: 1000, latestWeekUnits: 1000, newEventFlag: true }).result).toBe("HOLD");
  });
});

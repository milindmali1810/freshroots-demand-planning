// Every engine threshold lives here. A snapshot is saved on each Run (Run.configSnapshot).
// To change one safely, see skills/engine_rules_change.md.

export const engineConfig = {
  weeksShort: 4, // AVG4
  weeksLong: 12, // AVG12
  festivalFactor: 1.25,
  festivalLookaheadDays: 28, // "next 4 weeks"
  surgeThreshold: 1.2, // AVG4 > 1.2 x D
  surgeOrderMultiplier: 1.5,
  stdOrderWeeks: 4, // Q_std = 4 x AVG12 (assumption: one month of demand)
  cover: {
    general: { min: 6, max: 14 },
    perishable: { min: 3, max: 4 },
  },
  minHistoryWeeks: 12, // E1
  distributorShareMin: 0.1, // E2: share of SKU 12-week volume
  distributorSwingMin: 0.5, // E2: AVG4 vs own AVG12
  largeOrderValue: 500_000, // E6, rupees (5 lakh)
  guardrailMultiplier: 1.5, // halt if total recommended > 1.5 x total at Q_std
  preplacement: {
    latestWeekDeviation: 0.2,
    distributorCut: 0.3,
    topDistributors: 10,
  },
  kill: {
    overrideRateWarn: 0.3,
    expectedExceptionRate: { min: 0.15, max: 0.2 },
    quarterlyLossKillLakh: 34,
  },
} as const;

export type EngineConfig = typeof engineConfig;

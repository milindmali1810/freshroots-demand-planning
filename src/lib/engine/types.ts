export type Flag = "STOCKOUT_RISK" | "OVERSTOCK" | "HIGH_DEMAND" | "WATCH" | "OK" | "EXCEPTION";
export type ExceptionCode = "E1" | "E2" | "E3" | "E4" | "E5" | "E6" | "E7";

export interface WeekSale {
  weekStart: string; // Monday, YYYY-MM-DD
  units: number;
}

export interface DistributorSales {
  code: string;
  sales: WeekSale[];
}

export interface DateWindow {
  start: string;
  end: string;
}

export interface SkuInput {
  code: string;
  isPerishable: boolean;
  casePack?: number | null; // null = 1
  unitPrice?: number | null;
  leadTimeWeeks?: number | null;
  sales: WeekSale[]; // SKU-level weekly units (may include incomplete or bad rows; engine filters)
  onHand: number;
  onOrder?: number | null; // null/undefined = unavailable, treated as 0
  activeEventFlag?: boolean; // E3
  distributorSales?: DistributorSales[]; // optional; E2 is skipped when absent
  dataIssues?: string[]; // E4 reasons found while loading (e.g. unmatched IDs)
}

export interface RunContext {
  runDate: string; // YYYY-MM-DD
  festivals: DateWindow[];
}

export interface EngineException {
  code: ExceptionCode;
  detail: string;
}

export interface SkuResult {
  skuCode: string;
  flag: Flag;
  avg4: number;
  avg12: number;
  festivalFactor: number;
  demandRate: number; // R
  inventoryPosition: number;
  weeksOfCover: number;
  qStd: number;
  qty: number | null; // null = no auto quantity
  orderValue: number | null;
  surgeTest: boolean; // AVG4 > 1.2 x D
  surgeConfirmed: boolean;
  exceptions: EngineException[];
  warnings: string[];
  onOrderUnavailable: boolean;
  reason: string;
}

export interface RunResult {
  status: "COMPLETED" | "HALTED";
  haltReason?: string;
  results: SkuResult[];
  totals: {
    skuCount: number;
    byFlag: Record<Flag, number>;
    exceptionRate: number;
    recommendedTotal: number;
    baselineTotal: number;
    basis: "value" | "units";
  };
}

export interface PreplacementInput {
  avg4AtApproval: number;
  latestWeekUnits: number;
  topDistributorCuts?: { code: string; cut: number }[]; // fraction cut since approval; undefined = unavailable
  newEventFlag: boolean;
}

export interface PreplacementResult {
  result: "PROCEED" | "HOLD";
  triggers: { code: string; detail: string }[];
  warnings: string[];
}

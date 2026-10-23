import type { ReactNode } from "react";
import { engineConfig } from "@/config/engine";

// Most urgent first: the order planners should work through.
export const FLAG_ORDER = ["EXCEPTION", "STOCKOUT_RISK", "HIGH_DEMAND", "WATCH", "OVERSTOCK", "OK"] as const;

export const FLAG_LABEL: Record<string, string> = {
  EXCEPTION: "Exception",
  STOCKOUT_RISK: "Stockout risk",
  HIGH_DEMAND: "High demand",
  WATCH: "Watch",
  OVERSTOCK: "Overstock",
  OK: "OK",
};

// Badge colours (text on tint, all above 4.5:1), the dot colour, and the row accent.
export const FLAG_STYLE: Record<string, { badge: string; dot: string; accent: string; bar: string }> = {
  EXCEPTION: { badge: "bg-purple-100 text-purple-900", dot: "bg-purple-600", accent: "border-l-purple-600", bar: "bg-purple-600" },
  STOCKOUT_RISK: { badge: "bg-red-100 text-red-900", dot: "bg-red-600", accent: "border-l-red-600", bar: "bg-red-600" },
  HIGH_DEMAND: { badge: "bg-blue-100 text-blue-900", dot: "bg-blue-600", accent: "border-l-blue-600", bar: "bg-blue-600" },
  WATCH: { badge: "bg-yellow-100 text-yellow-900", dot: "bg-yellow-500", accent: "border-l-yellow-500", bar: "bg-yellow-500" },
  OVERSTOCK: { badge: "bg-amber-100 text-amber-900", dot: "bg-amber-500", accent: "border-l-amber-500", bar: "bg-amber-500" },
  OK: { badge: "bg-emerald-100 text-emerald-900", dot: "bg-emerald-600", accent: "border-l-slate-200", bar: "bg-emerald-600" },
};

export function FlagBadge({ flag }: { flag: string }) {
  const s = FLAG_STYLE[flag];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${s?.badge ?? "bg-slate-100 text-slate-800"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s?.dot ?? "bg-slate-500"}`} aria-hidden="true" />
      {FLAG_LABEL[flag] ?? flag}
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} aria-hidden="true" />;
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-4 py-2">
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-900">
      <p>{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 rounded-md border border-red-400 px-3 py-1 text-sm font-medium transition-colors hover:bg-red-100">
          Try again
        </button>
      )}
    </div>
  );
}

export function Card({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Banner({ tone, children }: { tone: "red" | "amber" | "green" | "blue"; children: ReactNode }) {
  const t = {
    red: "border-red-300 bg-red-50 text-red-900",
    amber: "border-amber-300 bg-amber-50 text-amber-900",
    green: "border-emerald-300 bg-emerald-50 text-emerald-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
  }[tone];
  return <div className={`rounded-lg border p-3 text-sm ${t}`}>{children}</div>;
}

export function Stat({ label, value, note, tone }: { label: string; value: ReactNode; note?: ReactNode; tone?: "red" | "amber" | "green" }) {
  const color = tone === "red" ? "text-red-700" : tone === "amber" ? "text-amber-700" : tone === "green" ? "text-emerald-700" : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</p>
      <p className={`mt-1 font-mono text-3xl font-medium ${color}`}>{value}</p>
      {note && <p className="mt-1 text-sm text-slate-600">{note}</p>}
    </div>
  );
}

/** Weeks of cover against the target band for this SKU. The number sits beside the bar, so colour is never the only signal. */
export function CoverBar({ weeks, perishable }: { weeks: number; perishable: boolean }) {
  const { min, max } = perishable ? engineConfig.cover.perishable : engineConfig.cover.general;
  const span = max * 1.6;
  const pctOf = (w: number) => `${Math.min(100, (w / span) * 100)}%`;
  const status = weeks < min ? "below" : weeks > max ? "above" : "within";
  const fill = status === "below" ? "bg-red-600" : status === "above" ? "bg-amber-500" : "bg-emerald-600";
  const text = weeks >= 9999 ? "no demand" : `${weeks.toFixed(1)} wks`;
  return (
    <div className="flex items-center justify-end gap-2" title={`${text}. Target ${min} to ${max} weeks (${status} target).`}>
      <div className="relative h-2 w-20 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <div className="absolute inset-y-0 bg-emerald-100" style={{ left: pctOf(min), width: `calc(${pctOf(max)} - ${pctOf(min)})` }} />
        <div className={`absolute inset-y-0 left-0 rounded-full ${fill}`} style={{ width: pctOf(Math.min(weeks, span)) }} />
      </div>
      <span className="w-16 whitespace-nowrap text-right font-mono text-[13px]">{text}</span>
    </div>
  );
}

export const pct = (x: number | null | undefined) => (x == null ? "n/a" : `${Math.round(x * 1000) / 10}%`);

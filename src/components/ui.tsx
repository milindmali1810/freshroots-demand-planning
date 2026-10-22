import type { ReactNode } from "react";

const FLAG_STYLE: Record<string, string> = {
  STOCKOUT_RISK: "bg-red-100 text-red-800",
  OVERSTOCK: "bg-amber-100 text-amber-800",
  HIGH_DEMAND: "bg-blue-100 text-blue-800",
  WATCH: "bg-yellow-100 text-yellow-800",
  OK: "bg-green-100 text-green-800",
  EXCEPTION: "bg-purple-100 text-purple-800",
};

export function FlagBadge({ flag }: { flag: string }) {
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${FLAG_STYLE[flag] ?? "bg-gray-100 text-gray-800"}`}>{flag.replace("_", " ")}</span>;
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <p role="status" className="py-8 text-center text-gray-500">
      {label}
    </p>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded border border-red-300 bg-red-50 p-4 text-red-800">
      <p>{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 rounded border border-red-400 px-3 py-1 text-sm hover:bg-red-100">
          Try again
        </button>
      )}
    </div>
  );
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded border border-gray-200 bg-white p-4 shadow-sm">
      {title && <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h2>}
      {children}
    </section>
  );
}

export function Banner({ tone, children }: { tone: "red" | "amber" | "green"; children: ReactNode }) {
  const t = { red: "border-red-300 bg-red-50 text-red-900", amber: "border-amber-300 bg-amber-50 text-amber-900", green: "border-green-300 bg-green-50 text-green-900" }[tone];
  return <div className={`rounded border p-3 text-sm ${t}`}>{children}</div>;
}

export const pct = (x: number | null | undefined) => (x == null ? "n/a" : `${Math.round(x * 1000) / 10}%`);

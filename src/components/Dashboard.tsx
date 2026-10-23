"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch, useApi } from "@/lib/useApi";
import { Banner, Card, CoverBar, ErrorBox, FLAG_LABEL, FLAG_ORDER, FLAG_STYLE, FlagBadge, Loading, Skeleton, Stat, pct } from "@/components/ui";

interface Metrics {
  latestRun: { id: number; runDate: string; status: string; haltReason: string | null; byFlag: Record<string, number> } | null;
  overrideRate: { value: number; decisions: number; overrides: number; warnAbove: number; warning: boolean };
  exceptionRate: { value: number | null; expected: { min: number; max: number }; outsideExpected: boolean };
  killRule: string;
}
interface RunRow {
  id: number;
  runDate: string;
  status: string;
}
interface Rec {
  id: number;
  skuCode: string;
  flag: string;
  weeksOfCover: number;
  inventoryPosition: number;
  qty: number | null;
  status: string;
  sku: { name: string; isPerishable: boolean };
}

function mondayOfToday() {
  const d = new Date();
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const prettyDate = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function Dashboard() {
  const router = useRouter();
  const metrics = useApi<Metrics>("/api/metrics");
  const runs = useApi<{ runs: RunRow[] }>("/api/runs");
  const latestId = metrics.data?.latestRun?.status === "COMPLETED" ? metrics.data.latestRun.id : null;
  const detail = useApi<{ recommendations: Rec[] }>(latestId ? `/api/runs/${latestId}` : null);
  const [runDate, setRunDate] = useState(mondayOfToday());
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  async function runEngine() {
    setRunning(true);
    setRunError(null);
    try {
      const { run } = await apiFetch<{ run: { id: number } }>("/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runDate }),
      });
      router.push(`/runs/${run.id}`);
    } catch (e) {
      setRunError((e as Error).message);
      setRunning(false);
    }
  }

  if (metrics.loading || runs.loading) return <Loading />;
  if (metrics.error) return <ErrorBox message={metrics.error} onRetry={metrics.reload} />;
  if (runs.error) return <ErrorBox message={runs.error} onRetry={runs.reload} />;
  const m = metrics.data!;
  const latest = m.latestRun;
  const recs = detail.data?.recommendations ?? [];
  const totalStock = recs.reduce((a, r) => a + r.inventoryPosition, 0);
  const attention = recs
    .filter((r) => r.flag !== "OK")
    .sort((a, b) => FLAG_ORDER.indexOf(a.flag as (typeof FLAG_ORDER)[number]) - FLAG_ORDER.indexOf(b.flag as (typeof FLAG_ORDER)[number]) || a.weeksOfCover - b.weeksOfCover);
  const total = latest ? Object.values(latest.byFlag).reduce((a, b) => a + b, 0) : 0;
  const needAction = latest ? (latest.byFlag.STOCKOUT_RISK ?? 0) + (latest.byFlag.HIGH_DEMAND ?? 0) + (latest.byFlag.EXCEPTION ?? 0) : 0;
  const input = "rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Weekly plan</h1>
          <p className="text-sm text-slate-600">The engine recommends. You approve or override. Procurement places the order.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
          <label className="text-xs font-medium text-slate-600">
            Run date (a Monday)
            <input type="date" value={runDate} onChange={(e) => setRunDate(e.target.value)} className={`mt-1 block ${input}`} />
          </label>
          <button onClick={runEngine} disabled={running || !runDate} className="rounded-md bg-blue-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-900 disabled:opacity-50">
            {running ? "Running…" : "Run engine"}
          </button>
        </div>
      </div>
      {runError && <ErrorBox message={runError} />}

      {latest?.status === "HALTED" && (
        <Banner tone="red">
          <strong>Manual planning.</strong> The guardrail halted run #{latest.id}: {latest.haltReason} No recommendations were saved.
        </Banner>
      )}

      {!latest ? (
        <Card>
          <p className="py-6 text-center text-slate-600">No runs yet. Pick a run date and click “Run engine”.</p>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Need action" value={needAction} note="Stockout risk, high demand or exception" tone={needAction > 0 ? "red" : "green"} />
            <Stat label="Units in stock" value={detail.loading && latestId ? "…" : totalStock.toLocaleString("en-IN")} note={`On hand across ${total} SKUs (on-order not in data)`} />
            <Stat
              label="Exception rate"
              value={pct(m.exceptionRate.value)}
              note={`Expected ${pct(m.exceptionRate.expected.min)} to ${pct(m.exceptionRate.expected.max)}${m.exceptionRate.outsideExpected ? ". Outside range." : ""}`}
              tone={m.exceptionRate.outsideExpected ? "amber" : undefined}
            />
            <Stat
              label="Override rate"
              value={pct(m.overrideRate.value)}
              note={`${m.overrideRate.overrides} of ${m.overrideRate.decisions} decisions. Warn above ${pct(m.overrideRate.warnAbove)}`}
              tone={m.overrideRate.warning ? "red" : undefined}
            />
          </div>

          <Card
            title={`Run #${latest.id} · week of ${prettyDate(latest.runDate)}`}
            action={
              <Link href={`/runs/${latest.id}`} className="text-sm font-medium text-blue-800 hover:underline">
                Open full table →
              </Link>
            }
          >
            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${latest.status === "HALTED" ? "bg-red-100 text-red-900" : "bg-emerald-100 text-emerald-900"}`}>
                Guardrail: {latest.status === "HALTED" ? "halted, manual planning" : "passed"}
              </span>
            </div>
            {total > 0 && (
              <div className="mb-3 flex h-2.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                {FLAG_ORDER.map((f) => ((latest.byFlag[f] ?? 0) > 0 ? <div key={f} className={FLAG_STYLE[f].bar} style={{ width: `${((latest.byFlag[f] ?? 0) / total) * 100}%` }} /> : null))}
              </div>
            )}
            <ul className="flex flex-wrap gap-2">
              {FLAG_ORDER.map((f) => (
                <li key={f}>
                  <Link href={`/runs/${latest.id}?flag=${f}`} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 transition-colors hover:border-slate-300 hover:bg-slate-50">
                    <span className="font-mono text-lg font-medium">{latest.byFlag[f] ?? 0}</span>
                    <span className="text-sm text-slate-700">{FLAG_LABEL[f]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          {latestId && (
            <Card title="Needs your attention" action={attention.length > 8 ? <Link href={`/runs/${latestId}`} className="text-sm font-medium text-blue-800 hover:underline">View all {attention.length} →</Link> : undefined}>
              {detail.error ? (
                <ErrorBox message={detail.error} onRetry={detail.reload} />
              ) : detail.loading ? (
                <div className="space-y-2" role="status" aria-label="Loading SKUs">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10" />
                  ))}
                </div>
              ) : attention.length === 0 ? (
                <p className="py-4 text-center text-slate-600">Nothing needs attention this week.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-slate-600">
                      <tr className="border-b border-slate-200">
                        <th className="py-2 pr-3 font-semibold">SKU</th>
                        <th className="py-2 pr-3 font-semibold">Flag</th>
                        <th className="py-2 pr-3 text-right font-semibold">Stock (units)</th>
                        <th className="py-2 pr-3 text-right font-semibold">Cover</th>
                        <th className="py-2 text-right font-semibold">Suggested qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attention.slice(0, 8).map((r) => (
                        <tr key={r.id} className={`border-b border-slate-100 border-l-4 ${FLAG_STYLE[r.flag]?.accent ?? ""}`}>
                          <td className="py-2 pl-3 pr-3">
                            <Link href={`/skus/${r.skuCode}`} className="font-semibold text-blue-800 hover:underline">
                              {r.skuCode}
                            </Link>
                            <div className="text-xs text-slate-600">{r.sku.name}</div>
                          </td>
                          <td className="py-2 pr-3">
                            <FlagBadge flag={r.flag} />
                          </td>
                          <td className="py-2 pr-3 text-right font-mono text-[13px]">{r.inventoryPosition.toLocaleString("en-IN")}</td>
                          <td className="py-2 pr-3">
                            <CoverBar weeks={r.weeksOfCover} perishable={r.sku.isPerishable} />
                          </td>
                          <td className="py-2 text-right font-mono text-[13px]">{r.qty ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </>
      )}

      <Banner tone="amber">{m.killRule}</Banner>

      {runs.data!.runs.length > 0 && (
        <Card title="Recent runs">
          <ul className="divide-y divide-slate-100 text-sm">
            {runs.data!.runs.slice(0, 6).map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2">
                <Link href={`/runs/${r.id}`} className="font-medium text-blue-800 hover:underline">
                  Run #{r.id} · week of {prettyDate(r.runDate)}
                </Link>
                <span className={r.status === "HALTED" ? "font-medium text-red-700" : "text-slate-600"}>{r.status === "HALTED" ? "Halted" : "Completed"}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

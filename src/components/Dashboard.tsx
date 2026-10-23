"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { engineConfig } from "@/config/engine";
import { apiFetch, useApi } from "@/lib/useApi";
import { Banner, ErrorBox, FLAG_ORDER, FLAG_STYLE, FlagBadge, Loading, Skeleton, pct } from "@/components/ui";
import { AreaChart, ColBars, CountUp, Donut, HBars, Icon, MeterRow, NeonCard, Ring, Sparkline, fmt } from "@/components/neon";

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
  avg4: number;
  avg12: number;
  qty: number | null;
  status: string;
  sku: { name: string; category: string; isPerishable: boolean };
}
interface Overview {
  weekly: { weekStart: string; units: number }[];
  stockByCategory: { category: string; units: number }[];
}

function mondayOfToday() {
  const d = new Date();
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const prettyDate = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const bounds = (r: Rec) => (r.sku.isPerishable ? engineConfig.cover.perishable : engineConfig.cover.general);
const short = (name: string) => name.replace(/^Freshroots\s+/, "");
const rank = (f: string) => FLAG_ORDER.indexOf(f as (typeof FLAG_ORDER)[number]);

function Kpi({ label, children, note, spark, d, tone }: { label: string; children: React.ReactNode; note?: React.ReactNode; spark?: number[]; d: number; tone?: string }) {
  return (
    <NeonCard d={d} className="flex flex-col justify-between gap-1">
      <h2 className="neon-label">{label}</h2>
      <p className={`font-mono text-3xl font-medium ${tone ?? "neon-text"}`}>{children}</p>
      {note && <p className="text-xs text-slate-600">{note}</p>}
      {spark && <Sparkline points={spark} />}
    </NeonCard>
  );
}

export function Dashboard() {
  const router = useRouter();
  const metrics = useApi<Metrics>("/api/metrics");
  const runs = useApi<{ runs: RunRow[] }>("/api/runs");
  const latestId = metrics.data?.latestRun?.status === "COMPLETED" ? metrics.data.latestRun.id : null;
  const detail = useApi<{ recommendations: Rec[] }>(latestId ? `/api/runs/${latestId}` : null);
  const overview = useApi<Overview>("/api/overview");
  const detailLoading = latestId != null && detail.loading;
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
  const weekly = overview.data?.weekly ?? [];

  // ---- Numbers, all from the data (nothing invented) ----
  const lastWeek = weekly[weekly.length - 1]?.units ?? 0;
  const prior4 = weekly.slice(-5, -1);
  const prior4Avg = prior4.length ? prior4.reduce((a, w) => a + w.units, 0) / prior4.length : 0;
  const salesDelta = prior4Avg ? (lastWeek / prior4Avg - 1) * 100 : 0;
  const totalStock = recs.reduce((a, r) => a + r.inventoryPosition, 0);
  const weeklyRate = recs.reduce((a, r) => a + r.avg4, 0);
  const coverWeeks = weeklyRate ? totalStock / weeklyRate : 0;
  const total = recs.length;
  const needAction = latest ? (latest.byFlag.STOCKOUT_RISK ?? 0) + (latest.byFlag.HIGH_DEMAND ?? 0) + (latest.byFlag.EXCEPTION ?? 0) : 0;

  const aboveMin = recs.filter((r) => r.weeksOfCover >= bounds(r).min).length;
  const belowMax = recs.filter((r) => r.weeksOfCover <= bounds(r).max).length;
  const inBand = recs.filter((r) => r.weeksOfCover >= bounds(r).min && r.weeksOfCover <= bounds(r).max).length;
  const health = total ? (inBand / total) * 100 : 0;
  const orderable = recs.filter((r) => r.qty != null);
  const decided = orderable.filter((r) => r.status !== "PENDING").length;
  const decidedPct = orderable.length ? (decided / orderable.length) * 100 : 0;
  const exceptions = latest?.byFlag.EXCEPTION ?? 0;
  const pctOf = (n: number) => (total ? (n / total) * 100 : 0);
  const verdict = health >= 90 ? "Excellent" : health >= 70 ? "Good" : "Needs attention";

  const movers = recs
    .map((r) => ({ r, delta: r.avg12 > 0 ? r.avg4 / r.avg12 - 1 : 0 }))
    .filter((x) => Math.abs(x.delta) >= 0.05)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 4);
  const actions = [...orderable.filter((r) => (r.qty ?? 0) > 0)]
    .sort((a, b) => rank(a.flag) - rank(b.flag) || a.weeksOfCover - b.weeksOfCover)
    .slice(0, 5);
  const topSellers = [...recs].sort((a, b) => b.avg4 - a.avg4).slice(0, 5);
  const suggested = [...orderable].filter((r) => (r.qty ?? 0) > 0).sort((a, b) => (b.qty ?? 0) - (a.qty ?? 0)).slice(0, 6);
  const suggestedTotal = orderable.reduce((a, r) => a + (r.qty ?? 0), 0);
  const attention = recs.filter((r) => r.flag !== "OK").sort((a, b) => rank(a.flag) - rank(b.flag) || a.weeksOfCover - b.weeksOfCover);
  const stockParts = (overview.data?.stockByCategory ?? []).map((c) => ({ label: c.category, value: c.units }));
  const waiting = (
    <div className="space-y-2" role="status" aria-label="Loading">
      <Skeleton className="h-6" />
      <Skeleton className="h-6" />
      <Skeleton className="h-6" />
    </div>
  );
  const field = "rounded-md border border-slate-300 bg-black/40 px-2.5 py-1.5 text-sm";

  return (
    <div className="space-y-4">
      <div className="fade-up flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="neon-label flex items-center gap-2">
            <span className="live-dot h-2 w-2 rounded-full bg-lime-400" aria-hidden="true" />
            {latest ? `Run #${latest.id} · week of ${prettyDate(latest.runDate)}` : "No run yet"}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Weekly <span className="neon-text">plan</span>
          </h1>
          <p className="text-sm text-slate-600">The engine recommends. You approve or override. Procurement places the order.</p>
        </div>
        <div className="neon-card flex flex-wrap items-end gap-2 p-2">
          <label className="text-xs font-medium text-slate-600">
            Run date (a Monday)
            <input type="date" value={runDate} onChange={(e) => setRunDate(e.target.value)} className={`mt-1 block ${field}`} />
          </label>
          <button onClick={runEngine} disabled={running || !runDate} className="neon-btn flex items-center gap-1.5 rounded-md px-4 py-2 text-sm disabled:opacity-50">
            <Icon name="zap" className="h-4 w-4" />
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
        <NeonCard>
          <p className="py-8 text-center text-slate-600">No runs yet. Pick a run date and click “Run engine”.</p>
        </NeonCard>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Kpi
              label="Units sold, last week"
              d={0}
              spark={weekly.map((w) => w.units)}
              note={
                prior4.length ? (
                  <span className={salesDelta >= 0 ? "text-lime-300" : "text-red-400"}>
                    {salesDelta >= 0 ? "▲" : "▼"} {Math.abs(salesDelta).toFixed(1)}% <span className="text-slate-600">vs prior 4 weeks</span>
                  </span>
                ) : undefined
              }
            >
              {overview.loading ? "…" : <CountUp value={lastWeek} />}
            </Kpi>
            <Kpi label="Units in stock" d={70} note={recs.length ? `About ${coverWeeks.toFixed(1)} weeks of cover. On hand only.` : "On hand across SKUs"}>
              {detailLoading ? "…" : <CountUp value={totalStock} />}
            </Kpi>
            <Kpi label="Need action" d={140} tone={needAction > 0 ? "text-red-400" : "neon-text"} note={`Stockout risk, high demand or exception${total ? `, of ${total} SKUs` : ""}`}>
              <CountUp value={needAction} />
            </Kpi>
            <Kpi
              label="Exception rate"
              d={210}
              tone={m.exceptionRate.outsideExpected ? "text-amber-400" : "neon-text"}
              note={`Expected ${pct(m.exceptionRate.expected.min)} to ${pct(m.exceptionRate.expected.max)}${m.exceptionRate.outsideExpected ? ". Outside range." : ""}`}
            >
              <CountUp value={(m.exceptionRate.value ?? 0) * 100} decimals={1} suffix="%" />
            </Kpi>
            <Kpi
              label="Override rate"
              d={280}
              tone={m.overrideRate.warning ? "text-red-400" : "neon-text"}
              note={`${m.overrideRate.overrides} of ${m.overrideRate.decisions} decisions. Warn above ${pct(m.overrideRate.warnAbove)}`}
            >
              <CountUp value={m.overrideRate.value * 100} decimals={1} suffix="%" />
            </Kpi>
          </div>

          {/* Insights, health, actions */}
          <div className="grid gap-3 lg:grid-cols-3">
            <NeonCard title="Demand movers" d={120}>
              {detailLoading ? (
                waiting
              ) : movers.length === 0 ? (
                <p className="py-4 text-sm text-slate-600">No SKU is moving more than 5% away from its 12-week average.</p>
              ) : (
                <ul className="space-y-3">
                  {movers.map(({ r, delta }) => (
                    <li key={r.id} className="flex items-start gap-3">
                      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${delta > 0 ? "border-lime-400/40 bg-lime-400/10 text-lime-300" : "border-red-400/40 bg-red-400/10 text-red-400"}`}>
                        <Icon name={delta > 0 ? "up" : "down"} />
                      </span>
                      <div className="min-w-0 text-sm">
                        <Link href={`/skus/${r.skuCode}`} className="font-semibold text-lime-300 hover:underline">
                          {short(r.sku.name)}
                        </Link>
                        <p className="text-slate-600">
                          Selling {Math.abs(delta * 100).toFixed(0)}% {delta > 0 ? "above" : "below"} its 12-week average ({fmt(r.avg4)} vs {fmt(r.avg12)} a week)
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </NeonCard>

            <NeonCard title="Plan health" d={190}>
              {detailLoading ? (
                waiting
              ) : (
                <div className="space-y-4">
                  <Ring value={health} size={150}>
                    <span className="neon-text font-mono text-4xl font-medium">
                      <CountUp value={health} />
                    </span>
                    <span className="font-mono text-[11px] text-slate-600">/ 100</span>
                    <span className={`mt-0.5 text-xs font-semibold ${health >= 70 ? "text-lime-300" : "text-amber-400"}`}>{verdict}</span>
                  </Ring>
                  <p className="text-center text-xs text-slate-600">Share of SKUs whose stock cover is inside the target range.</p>
                  <ul className="space-y-2">
                    <MeterRow label="Above minimum cover" value={pctOf(aboveMin)} />
                    <MeterRow label="Below maximum cover" value={pctOf(belowMax)} />
                    <MeterRow label="No exceptions" value={total ? 100 - (exceptions / total) * 100 : 0} />
                    <MeterRow label="Orders decided" value={decidedPct} />
                    <MeterRow label="Guardrail passed" value={latest.status === "COMPLETED" ? 100 : 0} />
                  </ul>
                </div>
              )}
            </NeonCard>

            <NeonCard
              title="What the engine recommends"
              d={260}
              action={
                <Link href={`/runs/${latest.id}`} className="text-xs font-medium text-lime-300 hover:underline">
                  Open table →
                </Link>
              }
            >
              {detailLoading ? (
                waiting
              ) : actions.length === 0 ? (
                <p className="py-4 text-sm text-slate-600">No orders recommended this week.</p>
              ) : (
                <ul className="space-y-3">
                  {actions.map((r) => (
                    <li key={r.id} className="flex items-start gap-3 text-sm">
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${r.status !== "PENDING" ? "border-lime-400 bg-lime-400/20 text-lime-300" : "border-slate-400 text-slate-500"}`} title={r.status === "PENDING" ? "Waiting for a decision" : "Decided"}>
                        {r.status !== "PENDING" ? <Icon name="check" className="h-3 w-3" /> : null}
                      </span>
                      <span className="text-slate-800">
                        {r.flag === "HIGH_DEMAND" ? "Raise next order" : "Reorder"} <b className="font-mono text-lime-300">{fmt(r.qty ?? 0)}</b> units of {short(r.sku.name)}
                        <span className="block text-xs text-slate-600">
                          {fmt(r.inventoryPosition)} in stock, {r.weeksOfCover.toFixed(1)} weeks of cover
                        </span>
                      </span>
                    </li>
                  ))}
                  {(latest.byFlag.OVERSTOCK ?? 0) > 0 && (
                    <li className="flex items-start gap-3 text-sm">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-amber-400/60 text-amber-400">
                        <Icon name="pause" className="h-3 w-3" />
                      </span>
                      <span className="text-slate-800">
                        Pause the next order for <b className="font-mono text-amber-400">{latest.byFlag.OVERSTOCK}</b> overstocked SKUs
                      </span>
                    </li>
                  )}
                </ul>
              )}
            </NeonCard>
          </div>

          {/* Trend and stock mix */}
          <div className="grid gap-3 lg:grid-cols-3">
            <NeonCard title="Units sold per week" d={140} className="lg:col-span-2">
              {overview.error ? <ErrorBox message={overview.error} onRetry={overview.reload} /> : overview.loading ? <Skeleton className="h-56" /> : <AreaChart points={weekly.map((w) => ({ label: w.weekStart, value: w.units }))} />}
            </NeonCard>
            <NeonCard title="Stock by category" d={210}>
              {overview.loading ? (
                <Skeleton className="h-40" />
              ) : (
                <Donut
                  parts={stockParts}
                  center={
                    <>
                      <span className="font-mono text-[11px] text-slate-600">Units</span>
                      <span className="neon-text font-mono text-xl font-medium">{fmt(stockParts.reduce((a, p) => a + p.value, 0))}</span>
                    </>
                  }
                />
              )}
            </NeonCard>
          </div>

          {/* Leaders, suggested orders, decisions */}
          <div className="grid gap-3 lg:grid-cols-3">
            <NeonCard title="Top sellers, units a week" d={160}>
              {detailLoading ? waiting : <HBars rows={topSellers.map((r) => ({ label: short(r.sku.name), sub: `${r.skuCode} ${r.sku.name}`, value: Math.round(r.avg4) }))} />}
            </NeonCard>
            <NeonCard title="Suggested orders" d={230}>
              {detailLoading ? (
                waiting
              ) : (
                <>
                  <p className="neon-text font-mono text-3xl font-medium">
                    <CountUp value={suggestedTotal} /> <span className="text-sm font-normal text-slate-600">units in total</span>
                  </p>
                  <p className="mb-3 text-xs text-slate-600">Largest recommended orders this week</p>
                  {suggested.length ? <ColBars cols={suggested.map((r) => ({ label: r.skuCode, value: r.qty ?? 0 }))} /> : <p className="py-6 text-sm text-slate-600">No orders recommended.</p>}
                </>
              )}
            </NeonCard>
            <NeonCard title="Decisions made" d={300}>
              {detailLoading ? (
                waiting
              ) : (
                <div className="space-y-3">
                  <Ring value={decidedPct} size={130} stroke={11}>
                    <span className="neon-text font-mono text-3xl font-medium">
                      <CountUp value={decidedPct} suffix="%" />
                    </span>
                    <span className="text-xs font-semibold text-lime-300">{decidedPct >= 100 ? "All decided" : "In progress"}</span>
                  </Ring>
                  <p className="text-center text-sm text-slate-600">
                    {decided} of {orderable.length} recommended orders approved, overridden or rejected
                  </p>
                </div>
              )}
            </NeonCard>
          </div>

          {/* Attention table */}
          <NeonCard
            title="Needs your attention"
            d={200}
            action={
              <Link href={`/runs/${latest.id}`} className="text-xs font-medium text-lime-300 hover:underline">
                View all {total} SKUs →
              </Link>
            }
          >
            {detail.error ? (
              <ErrorBox message={detail.error} onRetry={detail.reload} />
            ) : detailLoading ? (
              <div className="space-y-2" role="status" aria-label="Loading SKUs">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : attention.length === 0 ? (
              <p className="py-4 text-center text-slate-600">Nothing needs attention this week.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-600">
                    <tr className="border-b border-slate-200">
                      <th className="py-2 pr-3 font-semibold">SKU</th>
                      <th className="py-2 pr-3 font-semibold">Status</th>
                      <th className="py-2 pr-3 text-right font-semibold">Stock</th>
                      <th className="py-2 pr-3 text-right font-semibold">Sales/wk (4w)</th>
                      <th className="py-2 pr-3 text-right font-semibold">Cover</th>
                      <th className="py-2 pr-3 text-right font-semibold">Suggested qty</th>
                      <th className="py-2 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attention.slice(0, 8).map((r) => (
                      <tr key={r.id} className={`row-hover border-b border-slate-100 border-l-4 ${FLAG_STYLE[r.flag]?.accent ?? ""}`}>
                        <td className="py-2 pl-3 pr-3">
                          <Link href={`/skus/${r.skuCode}`} className="font-semibold text-lime-300 hover:underline">
                            {r.skuCode}
                          </Link>
                          <div className="text-xs text-slate-600">{short(r.sku.name)}</div>
                        </td>
                        <td className="py-2 pr-3">
                          <FlagBadge flag={r.flag} />
                        </td>
                        <td className="py-2 pr-3 text-right font-mono text-[13px]">{fmt(r.inventoryPosition)}</td>
                        <td className="py-2 pr-3 text-right font-mono text-[13px]">{fmt(r.avg4)}</td>
                        <td className="py-2 pr-3 text-right font-mono text-[13px]">{r.weeksOfCover >= 9999 ? "n/a" : `${r.weeksOfCover.toFixed(1)} wks`}</td>
                        <td className="py-2 pr-3 text-right font-mono text-[13px]">{r.qty ?? "—"}</td>
                        <td className="py-2 text-right">
                          <Link href={`/runs/${latest.id}?flag=${r.flag}`} className="rounded-md border border-lime-400/50 px-2.5 py-1 text-xs font-semibold text-lime-300 transition-colors hover:bg-lime-400/10">
                            Review
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </NeonCard>
        </>
      )}

      <Banner tone="amber">{m.killRule}</Banner>

      {runs.data!.runs.length > 0 && (
        <NeonCard title="Recent runs" d={260}>
          <ul className="divide-y divide-slate-100 text-sm">
            {runs.data!.runs.slice(0, 6).map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2">
                <Link href={`/runs/${r.id}`} className="font-medium text-lime-300 hover:underline">
                  Run #{r.id} · week of {prettyDate(r.runDate)}
                </Link>
                <span className={r.status === "HALTED" ? "font-medium text-red-400" : "text-slate-600"}>{r.status === "HALTED" ? "Halted" : "Completed"}</span>
              </li>
            ))}
          </ul>
        </NeonCard>
      )}
    </div>
  );
}

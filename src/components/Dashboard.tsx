"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch, useApi } from "@/lib/useApi";
import { Banner, Card, ErrorBox, FlagBadge, Loading, pct } from "@/components/ui";

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
  createdAt: string;
}

function mondayOfToday() {
  const d = new Date();
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function Dashboard() {
  const router = useRouter();
  const metrics = useApi<Metrics>("/api/metrics");
  const runs = useApi<{ runs: RunRow[] }>("/api/runs");
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Weekly plan</h1>
          <p className="text-sm text-gray-600">The engine recommends. You approve or override. Procurement places the order.</p>
        </div>
        <div className="flex items-end gap-2">
          <label className="text-sm">
            Run date (a Monday)
            <input type="date" value={runDate} onChange={(e) => setRunDate(e.target.value)} className="mt-1 block rounded border border-gray-300 px-2 py-1" />
          </label>
          <button onClick={runEngine} disabled={running || !runDate} className="rounded bg-green-700 px-4 py-2 font-medium text-white hover:bg-green-800 disabled:opacity-50">
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
        <Card>No runs yet. Pick a run date and click “Run engine”.</Card>
      ) : (
        <>
          <Card title={`Latest run #${latest.id} — ${latest.runDate} — ${latest.status}`}>
            <div className="flex flex-wrap gap-4">
              {["STOCKOUT_RISK", "HIGH_DEMAND", "WATCH", "OK", "OVERSTOCK", "EXCEPTION"].map((f) => (
                <div key={f} className="text-center">
                  <div className="text-2xl font-bold">{latest.byFlag[f] ?? 0}</div>
                  <FlagBadge flag={f} />
                </div>
              ))}
            </div>
            <Link href={`/runs/${latest.id}`} className="mt-3 inline-block text-sm text-green-800 underline">
              Open recommendations
            </Link>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card title="Guardrail">
              <p className={latest.status === "HALTED" ? "font-semibold text-red-700" : "text-green-700"}>{latest.status === "HALTED" ? "HALTED — manual planning" : "Passed"}</p>
            </Card>
            <Card title="Exception rate">
              <p className="text-2xl font-bold">{pct(m.exceptionRate.value)}</p>
              <p className="text-sm text-gray-600">Expected {pct(m.exceptionRate.expected.min)}–{pct(m.exceptionRate.expected.max)}</p>
              {m.exceptionRate.outsideExpected && <p className="mt-1 text-sm text-amber-700">Outside the expected range.</p>}
            </Card>
            <Card title="Override rate">
              <p className={`text-2xl font-bold ${m.overrideRate.warning ? "text-red-700" : ""}`}>{pct(m.overrideRate.value)}</p>
              <p className="text-sm text-gray-600">
                {m.overrideRate.overrides} of {m.overrideRate.decisions} decisions. Warn above {pct(m.overrideRate.warnAbove)}.
              </p>
              {m.overrideRate.warning && <p className="mt-1 text-sm text-red-700">Above the warning line.</p>}
            </Card>
          </div>
        </>
      )}

      <Banner tone="amber">{m.killRule}</Banner>

      {runs.data!.runs.length > 0 && (
        <Card title="Recent runs">
          <ul className="divide-y divide-gray-100 text-sm">
            {runs.data!.runs.slice(0, 10).map((r) => (
              <li key={r.id} className="flex justify-between py-1">
                <Link href={`/runs/${r.id}`} className="text-green-800 underline">
                  Run #{r.id} — {r.runDate.slice(0, 10)}
                </Link>
                <span className={r.status === "HALTED" ? "text-red-700" : "text-gray-600"}>{r.status}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

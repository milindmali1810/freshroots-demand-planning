"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { apiFetch, useApi } from "@/lib/useApi";
import { Banner, CoverBar, ErrorBox, FLAG_LABEL, FLAG_ORDER, FLAG_STYLE, FlagBadge, Loading } from "@/components/ui";

interface Rec {
  id: number;
  skuCode: string;
  flag: string;
  weeksOfCover: number;
  inventoryPosition: number;
  avg4: number;
  avg12: number;
  qty: number | null;
  reason: string;
  status: string;
  sku: { name: string; category: string; isPerishable: boolean };
}
interface RunData {
  run: { id: number; runDate: string; status: string; haltReason: string | null };
  recommendations: Rec[];
}
interface Check {
  result: "PROCEED" | "HOLD";
  triggers: { code: string; detail: string }[];
  warnings: string[];
}

const REASON_CODES = ["AGREE_WITH_ENGINE", "KNOWN_PROMOTION", "LOCAL_EVENT", "SUPPLIER_CONSTRAINT", "STOCK_COUNT_DIFFERS", "DATA_ISSUE", "OTHER"];
const STATUSES = ["PENDING", "APPROVED", "OVERRIDDEN", "REJECTED"];
const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-800",
  APPROVED: "bg-emerald-100 text-emerald-900",
  OVERRIDDEN: "bg-blue-100 text-blue-900",
  REJECTED: "bg-slate-200 text-slate-700",
};
const flagRank = (f: string) => FLAG_ORDER.indexOf(f as (typeof FLAG_ORDER)[number]);
const prettyDate = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function RunView({ id }: { id: string }) {
  const { data, error, loading, reload } = useApi<RunData>(`/api/runs/${id}`);
  const params = useSearchParams();
  const initialFlag = params.get("flag") ?? "";
  const [flag, setFlag] = useState(FLAG_ORDER.includes(initialFlag as (typeof FLAG_ORDER)[number]) ? initialFlag : "");
  const [status, setStatus] = useState("");
  const [perishable, setPerishable] = useState("");
  const [decidedBy, setDecidedBy] = useState("planner");
  const [active, setActive] = useState<{ id: number; action: "APPROVE" | "OVERRIDE" | "REJECT" } | null>(null);
  const [reasonCode, setReasonCode] = useState(REASON_CODES[0]);
  const [newQty, setNewQty] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<number, Check | string>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem("fr_decided_by");
      if (saved) setDecidedBy(saved);
    } catch {}
  }, []);

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox message={error} onRetry={reload} />;
  const { run, recommendations } = data!;

  const counts: Record<string, number> = {};
  for (const r of recommendations) counts[r.flag] = (counts[r.flag] ?? 0) + 1;
  // Most urgent first, then least cover first within a flag.
  const rows = recommendations
    .filter((r) => (!flag || r.flag === flag) && (!status || r.status === status) && (!perishable || String(r.sku.isPerishable) === perishable))
    .sort((a, b) => flagRank(a.flag) - flagRank(b.flag) || a.weeksOfCover - b.weeksOfCover);

  function open(rec: Rec, action: "APPROVE" | "OVERRIDE" | "REJECT") {
    setActive({ id: rec.id, action });
    setReasonCode(action === "APPROVE" ? "AGREE_WITH_ENGINE" : "OTHER");
    setNewQty(rec.qty != null ? String(rec.qty) : "");
    setNote("");
    setFormError(null);
  }

  async function submit() {
    if (!active) return;
    setBusy(true);
    setFormError(null);
    try {
      localStorage.setItem("fr_decided_by", decidedBy);
    } catch {}
    try {
      await apiFetch(`/api/recommendations/${active.id}/decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: active.action,
          reasonCode,
          decidedBy: decidedBy || "planner",
          ...(active.action === "OVERRIDE" ? { newQty: Number(newQty) } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      });
      setActive(null);
      reload();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function precheck(recId: number) {
    setChecks((c) => ({ ...c, [recId]: "Checking…" }));
    try {
      const { check } = await apiFetch<{ check: Check }>(`/api/recommendations/${recId}/preplacement-check`, { method: "POST" });
      setChecks((c) => ({ ...c, [recId]: check }));
    } catch (e) {
      setChecks((c) => ({ ...c, [recId]: `Error: ${(e as Error).message}` }));
    }
  }

  const field = "rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm";
  const chip = (value: string, label: string, count: number) => {
    const on = flag === value;
    return (
      <button
        key={value || "all"}
        onClick={() => setFlag(on ? "" : value)}
        aria-pressed={on}
        className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${on ? "border-blue-800 bg-blue-800 text-white" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"}`}
      >
        {value && <span className={`h-2 w-2 rounded-full ${FLAG_STYLE[value].dot}`} aria-hidden="true" />}
        {label}
        <span className={`font-mono text-xs ${on ? "text-blue-100" : "text-slate-600"}`}>{count}</span>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/" className="text-sm font-medium text-blue-800 hover:underline">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-bold">
            Run #{run.id} <span className="font-medium text-slate-600">· week of {prettyDate(run.runDate)}</span>
          </h1>
        </div>
        <label className="text-sm font-medium text-slate-700">
          Deciding as
          <input value={decidedBy} onChange={(e) => setDecidedBy(e.target.value)} className={`ml-2 w-36 ${field}`} />
        </label>
      </div>

      {run.status === "HALTED" && (
        <Banner tone="red">
          <strong>Manual planning.</strong> {run.haltReason} No recommendations were saved for this run.
        </Banner>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {chip("", "All", recommendations.length)}
        {FLAG_ORDER.filter((f) => counts[f]).map((f) => chip(f, FLAG_LABEL[f], counts[f]))}
        <div className="ml-auto flex flex-wrap gap-2">
          <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className={field}>
            <option value="">Any status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
          <select aria-label="Filter by perishability" value={perishable} onChange={(e) => setPerishable(e.target.value)} className={field}>
            <option value="">All SKUs</option>
            <option value="true">Perishable only</option>
            <option value="false">Non-perishable only</option>
          </select>
        </div>
      </div>

      {error && <ErrorBox message={error} onRetry={reload} />}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="p-3 font-semibold">SKU and reason</th>
              <th className="p-3 font-semibold">Flag</th>
              <th className="p-3 text-right font-semibold" title="On hand plus on order. On-order is not in the data, so this is on-hand stock.">
                Stock (units)
              </th>
              <th className="p-3 text-right font-semibold" title="Average units sold per week: last 4 weeks / last 12 weeks">
                Sales/wk (4w / 12w)
              </th>
              <th className="p-3 text-right font-semibold">Cover</th>
              <th className="p-3 text-right font-semibold">Qty</th>
              <th className="p-3 font-semibold">Status</th>
              <th className="p-3 font-semibold">Decision</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-600">
                  {recommendations.length === 0 ? "No recommendations were saved for this run." : "No recommendations match these filters."}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <Fragment key={r.id}>
                <tr className={`border-t border-slate-100 border-l-4 align-top transition-colors hover:bg-slate-50/70 ${FLAG_STYLE[r.flag]?.accent ?? ""}`}>
                  <td className="max-w-sm p-3">
                    <Link href={`/skus/${r.skuCode}`} className="font-semibold text-blue-800 hover:underline">
                      {r.skuCode}
                    </Link>{" "}
                    <span className="text-slate-800">{r.sku.name}</span>
                    {r.sku.isPerishable && <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700">perishable</span>}
                    <p className="mt-1 text-[13px] leading-snug text-slate-600">{r.reason}</p>
                  </td>
                  <td className="p-3">
                    <FlagBadge flag={r.flag} />
                  </td>
                  <td className="p-3 text-right font-mono text-[13px]">{r.inventoryPosition.toLocaleString("en-IN")}</td>
                  <td className="whitespace-nowrap p-3 text-right font-mono text-[13px]">
                    {Math.round(r.avg4)} / {Math.round(r.avg12)}
                  </td>
                  <td className="p-3">
                    <CoverBar weeks={r.weeksOfCover} perishable={r.sku.isPerishable} />
                  </td>
                  <td className="p-3 text-right font-mono text-[13px] font-medium">{r.qty ?? "—"}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[r.status] ?? STATUS_STYLE.PENDING}`}>{r.status.charAt(0) + r.status.slice(1).toLowerCase()}</span>
                  </td>
                  <td className="whitespace-nowrap p-3">
                    {r.status === "PENDING" ? (
                      <div className="flex gap-1.5">
                        <button disabled={r.qty == null} title={r.qty == null ? "No quantity to approve" : ""} onClick={() => open(r, "APPROVE")} className="rounded-md bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-800 disabled:opacity-40">
                          Approve
                        </button>
                        <button onClick={() => open(r, "OVERRIDE")} className="rounded-md border border-blue-800 px-2.5 py-1.5 text-xs font-semibold text-blue-900 transition-colors hover:bg-blue-50">
                          Override
                        </button>
                        <button onClick={() => open(r, "REJECT")} className="rounded-md border border-slate-400 px-2.5 py-1.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-100">
                          Reject
                        </button>
                      </div>
                    ) : r.status === "APPROVED" || r.status === "OVERRIDDEN" ? (
                      <button onClick={() => precheck(r.id)} className="rounded-md border border-slate-400 px-2.5 py-1.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-100">
                        Pre-placement check
                      </button>
                    ) : null}
                  </td>
                </tr>
                {active?.id === r.id && (
                  <tr className="bg-blue-50/60">
                    <td colSpan={8} className="space-y-2 p-3">
                      <div className="flex flex-wrap items-end gap-3">
                        <strong className="text-sm">
                          {active.action.charAt(0) + active.action.slice(1).toLowerCase()} {r.skuCode}
                        </strong>
                        <label className="text-xs font-medium text-slate-700">
                          Reason
                          <select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} className={`ml-2 ${field}`}>
                            {REASON_CODES.map((c) => (
                              <option key={c}>{c}</option>
                            ))}
                          </select>
                        </label>
                        {active.action === "OVERRIDE" && (
                          <label className="text-xs font-medium text-slate-700">
                            New quantity
                            <input type="number" min={0} value={newQty} onChange={(e) => setNewQty(e.target.value)} className={`ml-2 w-28 ${field}`} />
                          </label>
                        )}
                        <label className="text-xs font-medium text-slate-700">
                          Note
                          <input value={note} onChange={(e) => setNote(e.target.value)} className={`ml-2 w-64 ${field}`} />
                        </label>
                        <button onClick={submit} disabled={busy || (active.action === "OVERRIDE" && newQty === "")} className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-50">
                          {busy ? "Saving…" : "Confirm"}
                        </button>
                        <button onClick={() => setActive(null)} className="text-sm text-slate-700 underline">
                          Cancel
                        </button>
                      </div>
                      {formError && <ErrorBox message={formError} />}
                    </td>
                  </tr>
                )}
                {checks[r.id] != null && (
                  <tr className="bg-slate-50">
                    <td colSpan={8} className="p-3 text-sm">
                      <CheckResult value={checks[r.id]} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CheckResult({ value }: { value: Check | string }) {
  if (typeof value === "string") return <span>{value}</span>;
  return (
    <Banner tone={value.result === "HOLD" ? "red" : "green"}>
      <strong>Pre-placement check: {value.result}.</strong> {value.result === "HOLD" ? "A named owner must decide: proceed, reduce or cancel." : "Nothing has changed enough to hold this order."}
      {value.triggers.map((t) => (
        <div key={t.code + t.detail}>• {t.detail}</div>
      ))}
      {value.warnings.map((w) => (
        <div key={w} className="text-xs opacity-80">
          Note: {w}
        </div>
      ))}
    </Banner>
  );
}

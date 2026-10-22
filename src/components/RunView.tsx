"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch, useApi } from "@/lib/useApi";
import { Banner, Card, ErrorBox, FlagBadge, Loading } from "@/components/ui";

interface Rec {
  id: number;
  skuCode: string;
  flag: string;
  weeksOfCover: number;
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
const FLAGS = ["STOCKOUT_RISK", "HIGH_DEMAND", "WATCH", "OK", "OVERSTOCK", "EXCEPTION"];
const STATUSES = ["PENDING", "APPROVED", "OVERRIDDEN", "REJECTED"];

export function RunView({ id }: { id: string }) {
  const { data, error, loading, reload } = useApi<RunData>(`/api/runs/${id}`);
  const [flag, setFlag] = useState("");
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

  const rows = recommendations.filter((r) => (!flag || r.flag === flag) && (!status || r.status === status) && (!perishable || String(r.sku.isPerishable) === perishable));

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

  const select = "rounded border border-gray-300 px-2 py-1 text-sm";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/" className="text-sm text-green-800 underline">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-bold">
            Run #{run.id} — {run.runDate.slice(0, 10)}
          </h1>
        </div>
        <label className="text-sm">
          Deciding as
          <input value={decidedBy} onChange={(e) => setDecidedBy(e.target.value)} className="ml-2 rounded border border-gray-300 px-2 py-1" />
        </label>
      </div>

      {run.status === "HALTED" && (
        <Banner tone="red">
          <strong>Manual planning.</strong> {run.haltReason} No recommendations were saved for this run.
        </Banner>
      )}

      <Card>
        <div className="flex flex-wrap gap-3">
          <select aria-label="Filter by flag" value={flag} onChange={(e) => setFlag(e.target.value)} className={select}>
            <option value="">All flags</option>
            {FLAGS.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
          <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className={select}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select aria-label="Filter by perishability" value={perishable} onChange={(e) => setPerishable(e.target.value)} className={select}>
            <option value="">Perishable and not</option>
            <option value="true">Perishable only</option>
            <option value="false">Non-perishable only</option>
          </select>
          <span className="self-center text-sm text-gray-500">{rows.length} shown</span>
        </div>
      </Card>

      {error && <ErrorBox message={error} onRetry={reload} />}

      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-100 text-xs uppercase text-gray-600">
            <tr>
              <th className="p-2">SKU</th>
              <th className="p-2">Flag</th>
              <th className="p-2 text-right">Cover (wks)</th>
              <th className="p-2 text-right">Qty</th>
              <th className="p-2">Why</th>
              <th className="p-2">Status</th>
              <th className="p-2">Decision</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-gray-500">
                  {recommendations.length === 0 ? "No recommendations were saved for this run." : "No recommendations match these filters."}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <RowFragment key={r.id}>
                <tr className="border-t border-gray-100 align-top">
                  <td className="p-2">
                    <Link href={`/skus/${r.skuCode}`} className="font-medium text-green-800 underline">
                      {r.skuCode}
                    </Link>
                    <div className="text-xs text-gray-500">
                      {r.sku.name}
                      {r.sku.isPerishable ? " · perishable" : ""}
                    </div>
                  </td>
                  <td className="p-2">
                    <FlagBadge flag={r.flag} />
                  </td>
                  <td className="p-2 text-right">{r.weeksOfCover >= 9999 ? "∞" : r.weeksOfCover.toFixed(1)}</td>
                  <td className="p-2 text-right">{r.qty ?? "—"}</td>
                  <td className="max-w-md p-2">{r.reason}</td>
                  <td className="p-2">{r.status}</td>
                  <td className="space-x-1 p-2 whitespace-nowrap">
                    {r.status === "PENDING" ? (
                      <>
                        <button disabled={r.qty == null} title={r.qty == null ? "No quantity to approve" : ""} onClick={() => open(r, "APPROVE")} className="rounded bg-green-700 px-2 py-1 text-xs text-white disabled:opacity-40">
                          Approve
                        </button>
                        <button onClick={() => open(r, "OVERRIDE")} className="rounded bg-blue-700 px-2 py-1 text-xs text-white">
                          Override
                        </button>
                        <button onClick={() => open(r, "REJECT")} className="rounded bg-gray-600 px-2 py-1 text-xs text-white">
                          Reject
                        </button>
                      </>
                    ) : r.status === "APPROVED" || r.status === "OVERRIDDEN" ? (
                      <button onClick={() => precheck(r.id)} className="rounded border border-gray-400 px-2 py-1 text-xs">
                        Pre-placement check
                      </button>
                    ) : null}
                  </td>
                </tr>
                {active?.id === r.id && (
                  <tr className="bg-gray-50">
                    <td colSpan={7} className="space-y-2 p-3">
                      <div className="flex flex-wrap items-end gap-3">
                        <strong className="text-sm">{active.action} {r.skuCode}</strong>
                        <label className="text-sm">
                          Reason
                          <select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} className={`ml-2 ${select}`}>
                            {REASON_CODES.map((c) => (
                              <option key={c}>{c}</option>
                            ))}
                          </select>
                        </label>
                        {active.action === "OVERRIDE" && (
                          <label className="text-sm">
                            New quantity
                            <input type="number" min={0} value={newQty} onChange={(e) => setNewQty(e.target.value)} className={`ml-2 w-28 ${select}`} />
                          </label>
                        )}
                        <label className="text-sm">
                          Note
                          <input value={note} onChange={(e) => setNote(e.target.value)} className={`ml-2 w-64 ${select}`} />
                        </label>
                        <button onClick={submit} disabled={busy || (active.action === "OVERRIDE" && newQty === "")} className="rounded bg-gray-900 px-3 py-1 text-sm text-white disabled:opacity-50">
                          {busy ? "Saving…" : "Confirm"}
                        </button>
                        <button onClick={() => setActive(null)} className="text-sm underline">
                          Cancel
                        </button>
                      </div>
                      {formError && <ErrorBox message={formError} />}
                    </td>
                  </tr>
                )}
                {checks[r.id] != null && (
                  <tr className="bg-gray-50">
                    <td colSpan={7} className="p-3 text-sm">
                      <CheckResult value={checks[r.id]} />
                    </td>
                  </tr>
                )}
              </RowFragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RowFragment({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function CheckResult({ value }: { value: Check | string }) {
  if (typeof value === "string") return <span>{value}</span>;
  return (
    <div>
      <Banner tone={value.result === "HOLD" ? "red" : "green"}>
        <strong>Pre-placement check: {value.result}.</strong>{" "}
        {value.result === "HOLD" ? "A named owner must decide: proceed, reduce or cancel." : "Nothing has changed enough to hold this order."}
        {value.triggers.map((t) => (
          <div key={t.code + t.detail}>• {t.detail}</div>
        ))}
        {value.warnings.map((w) => (
          <div key={w} className="text-xs opacity-80">
            Note: {w}
          </div>
        ))}
      </Banner>
    </div>
  );
}

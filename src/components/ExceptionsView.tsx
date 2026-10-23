"use client";
import Link from "next/link";
import { useState } from "react";
import { apiFetch, useApi } from "@/lib/useApi";
import { Banner, Card, ErrorBox, Loading } from "@/components/ui";

interface Ex {
  id: number;
  skuCode: string;
  code: string;
  detail: string;
  sku: { name: string };
}

const TITLES: Record<string, string> = {
  E1: "E1 — New SKU",
  E2: "E2 — Distributor swing",
  E3: "E3 — Market event",
  E4: "E4 — Data problem",
  E5: "E5 — Lead-time conflict",
  E6: "E6 — Large order",
  E7: "E7 — Floor breach",
};

export function ExceptionsView() {
  const { data, error, loading, reload } = useApi<{ runId?: number; exceptions: Ex[] }>("/api/exceptions");
  const [form, setForm] = useState({ skuCode: "", distributorCode: "", startDate: "", endDate: "", note: "", createdBy: "planner" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function addFlag(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await apiFetch("/api/flags", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(form.skuCode.trim() ? { skuCode: form.skuCode.trim() } : {}),
          ...(form.distributorCode.trim() ? { distributorCode: form.distributorCode.trim() } : {}),
          startDate: form.startDate,
          endDate: form.endDate,
          note: form.note,
          createdBy: form.createdBy || "planner",
        }),
      });
      setMsg({ ok: true, text: "Flag saved. It routes matching SKUs to Raghav (E3) on the next run." });
      setForm({ ...form, skuCode: "", distributorCode: "", note: "" });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  const input = "mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm";
  const grouped = new Map<string, Ex[]>();
  for (const x of data?.exceptions ?? []) grouped.set(x.code, [...(grouped.get(x.code) ?? []), x]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Exceptions for Raghav</h1>
      <p className="text-sm text-slate-600">These SKUs need judgment. The engine gives no automatic quantity for them.</p>

      {loading && !data ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <>
          {data!.exceptions.length === 0 ? (
            <Card>
              No exceptions in the latest run{data!.runId ? ` (#${data!.runId})` : ""}. Checks E2 (distributor swing), E5 (lead time) and E6 (order value) cannot run because the source data has no distributor-level sales, lead times or prices.
            </Card>
          ) : (
            [...grouped.entries()].sort().map(([code, items]) => (
              <Card key={code} title={`${TITLES[code] ?? code} (${items.length})`}>
                <ul className="divide-y divide-gray-100 text-sm">
                  {items.map((x) => (
                    <li key={x.id} className="py-2">
                      <Link href={`/skus/${x.skuCode}`} className="font-medium text-blue-400 underline">
                        {x.skuCode}
                      </Link>{" "}
                      <span className="text-slate-600">{x.sku.name}</span>
                      <div>{x.detail}</div>
                    </li>
                  ))}
                </ul>
              </Card>
            ))
          )}
        </>
      )}

      <Card title="Add a market-event flag (E3)">
        <form onSubmit={addFlag} className="grid gap-3 md:grid-cols-3">
          <label className="text-sm">
            SKU code
            <input value={form.skuCode} onChange={(e) => setForm({ ...form, skuCode: e.target.value })} placeholder="e.g. SKU001" className={input} />
          </label>
          <label className="text-sm">
            or Distributor code
            <input value={form.distributorCode} onChange={(e) => setForm({ ...form, distributorCode: e.target.value })} placeholder="e.g. DIST001" className={input} />
          </label>
          <label className="text-sm">
            Created by
            <input value={form.createdBy} onChange={(e) => setForm({ ...form, createdBy: e.target.value })} className={input} />
          </label>
          <label className="text-sm">
            Start date
            <input type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={input} />
          </label>
          <label className="text-sm">
            End date
            <input type="date" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={input} />
          </label>
          <label className="text-sm">
            Note
            <input required value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className={input} />
          </label>
          <div className="md:col-span-3">
            <button disabled={saving} className="rounded bg-blue-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {saving ? "Saving…" : "Save flag"}
            </button>
          </div>
        </form>
        {msg && <div className="mt-3">{msg.ok ? <Banner tone="green">{msg.text}</Banner> : <ErrorBox message={msg.text} />}</div>}
      </Card>
    </div>
  );
}

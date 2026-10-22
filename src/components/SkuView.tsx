"use client";
import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { Card, ErrorBox, FlagBadge, Loading } from "@/components/ui";

interface SkuData {
  sku: { code: string; name: string; category: string; isPerishable: boolean; standardReorderQty: number | null; primaryDistributor: { name: string; region: string } | null };
  sales: { weekStart: string; units: number }[];
  inventory: { onHand: number; asOfDate: string; location: string | null } | null;
  history: { runId: number; runDate: string; flag: string; avg4: number; avg12: number; weeksOfCover: number; qty: number | null }[];
}

function LineChart({ points, reference, referenceLabel, yLabel }: { points: { label: string; value: number }[]; reference?: number; referenceLabel?: string; yLabel: string }) {
  const W = 640;
  const H = 220;
  const pad = { l: 44, r: 12, t: 12, b: 28 };
  const values = points.map((p) => p.value).concat(reference != null ? [reference] : []);
  const max = Math.max(...values, 1) * 1.1;
  const min = Math.min(0, ...values);
  const x = (i: number) => pad.l + (points.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (points.length - 1));
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const ticks = [min, (min + max) / 2, max];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={yLabel} className="w-full">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#e5e7eb" />
          <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#6b7280">
            {Math.round(t * 10) / 10}
          </text>
        </g>
      ))}
      {reference != null && (
        <g>
          <line x1={pad.l} x2={W - pad.r} y1={y(reference)} y2={y(reference)} stroke="#d97706" strokeDasharray="5 4" />
          <text x={W - pad.r} y={y(reference) - 4} textAnchor="end" fontSize="10" fill="#b45309">
            {referenceLabel}
          </text>
        </g>
      )}
      <path d={path} fill="none" stroke="#15803d" strokeWidth="2" />
      {points.map((p, i) => (
        <circle key={p.label} cx={x(i)} cy={y(p.value)} r="3" fill="#15803d">
          <title>{`${p.label}: ${Math.round(p.value * 10) / 10}`}</title>
        </circle>
      ))}
      {points.map((p, i) => (i % Math.ceil(points.length / 8) === 0 ? (
        <text key={p.label} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#6b7280">
          {p.label.slice(5)}
        </text>
      ) : null))}
    </svg>
  );
}

export function SkuView({ code }: { code: string }) {
  const { data, error, loading, reload } = useApi<SkuData>(`/api/skus/${encodeURIComponent(code)}`);
  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox message={error} onRetry={reload} />;
  const { sku, sales, inventory, history } = data!;
  const last12 = sales.slice(-12);
  const last4 = sales.slice(-4);
  const mean = (xs: { units: number }[]) => (xs.length ? xs.reduce((a, b) => a + b.units, 0) / xs.length : 0);
  const avg12 = mean(last12);
  const avg4 = mean(last4);

  return (
    <div className="space-y-4">
      <Link href="/" className="text-sm text-green-800 underline">
        ← Dashboard
      </Link>
      <div>
        <h1 className="text-2xl font-bold">
          {sku.code} — {sku.name}
        </h1>
        <p className="text-sm text-gray-600">
          {sku.category} · {sku.isPerishable ? "perishable" : "non-perishable"}
          {sku.primaryDistributor ? ` · ${sku.primaryDistributor.name} (${sku.primaryDistributor.region})` : ""}
          {sku.standardReorderQty != null ? ` · file standard reorder qty ${sku.standardReorderQty}` : ""}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="AVG12">
          <p className="text-2xl font-bold">{Math.round(avg12 * 10) / 10}</p>
          <p className="text-sm text-gray-600">units per week, last 12 weeks</p>
        </Card>
        <Card title="AVG4">
          <p className="text-2xl font-bold">{Math.round(avg4 * 10) / 10}</p>
          <p className="text-sm text-gray-600">units per week, last 4 weeks</p>
        </Card>
        <Card title="On hand">
          <p className="text-2xl font-bold">{inventory?.onHand ?? "n/a"}</p>
          <p className="text-sm text-gray-600">{inventory ? `as of ${inventory.asOfDate.slice(0, 10)}${inventory.location ? `, ${inventory.location}` : ""} (on-order unavailable)` : "no snapshot"}</p>
        </Card>
      </div>

      <Card title="Weekly sales (units)">
        {sales.length === 0 ? <p className="text-gray-500">No sales history.</p> : <LineChart points={sales.map((s) => ({ label: s.weekStart, value: s.units }))} reference={avg12} referenceLabel="AVG12" yLabel="Weekly sales" />}
      </Card>

      <Card title="Weeks of cover at each run">
        {history.length === 0 ? (
          <p className="text-gray-500">No runs yet.</p>
        ) : (
          <>
            <LineChart points={history.map((h) => ({ label: h.runDate, value: Math.min(h.weeksOfCover, 100) }))} yLabel="Weeks of cover" />
            <table className="mt-2 w-full text-left text-sm">
              <thead className="text-xs uppercase text-gray-500">
                <tr>
                  <th className="py-1">Run</th>
                  <th>Date</th>
                  <th>Flag</th>
                  <th className="text-right">Cover</th>
                  <th className="text-right">Qty</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.runId} className="border-t border-gray-100">
                    <td className="py-1">
                      <Link href={`/runs/${h.runId}`} className="text-green-800 underline">
                        #{h.runId}
                      </Link>
                    </td>
                    <td>{h.runDate}</td>
                    <td>
                      <FlagBadge flag={h.flag} />
                    </td>
                    <td className="text-right">{h.weeksOfCover.toFixed(1)}</td>
                    <td className="text-right">{h.qty ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Card>
    </div>
  );
}

"use client";
import { useEffect, useId, useState, type CSSProperties, type ReactNode } from "react";

// Everything here is plain SVG and CSS. Motion lives in globals.css and switches off for reduced motion.

export const NEON = ["#a3e635", "#4ade80", "#22d3ee", "#facc15", "#94a3b8"];
export const fmt = (n: number, d = 0) => n.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

function useReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return ready;
}

/** Counts up from 0 to the target; jumps straight there for reduced motion. */
export function CountUp({ value, decimals = 0, suffix = "", ms = 1100 }: { value: number; decimals?: number; suffix?: string; ms?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = reduce ? 1 : Math.min(1, (now - t0) / ms);
      setV(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return (
    <>
      {fmt(v, decimals)}
      {suffix}
    </>
  );
}

export function NeonCard({ title, action, children, className = "", d = 0 }: { title?: string; action?: ReactNode; children: ReactNode; className?: string; d?: number }) {
  return (
    <section className={`neon-card fade-up p-4 ${className}`} style={delay(d)}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="neon-label">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Sparkline({ points, height = 34 }: { points: number[]; height?: number }) {
  const id = useId().replace(/:/g, "");
  if (points.length < 2) return null;
  const W = 120;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const xy = points.map((p, i) => [(i / (points.length - 1)) * W, 3 + (1 - (p - min) / span) * (height - 6)] as const);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="h-8 w-full" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a3e635" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#a3e635" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${W},${height} L0,${height} Z`} fill={`url(#${id})`} className="fade-in-slow" />
      <path d={line} fill="none" stroke="#a3e635" strokeWidth="1.6" strokeLinejoin="round" pathLength={1} className="draw-line glow-line" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** A ring gauge that fills from 0 to `value` (0 to 100). */
export function Ring({ value, size = 150, stroke = 12, children, tone = "#a3e635" }: { value: number; size?: number; stroke?: number; children?: ReactNode; tone?: string }) {
  const ready = useReady();
  const r = (size - stroke) / 2 - 4;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }} role="img" aria-label={`${Math.round(clamped)} out of 100`}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1a2a12" strokeWidth={stroke} />
        {/* tick marks like a dial */}
        <circle cx={size / 2} cy={size / 2} r={r + stroke / 2 + 2} fill="none" stroke="#2f4a21" strokeWidth="2" strokeDasharray="1 5" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={ready ? c * (1 - clamped / 100) : c}
          className="ring-fill glow-soft"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

export function AreaChart({ points, height = 230 }: { points: { label: string; value: number }[]; height?: number }) {
  const id = useId().replace(/:/g, "");
  if (points.length < 2) return <p className="py-8 text-center text-slate-600">Not enough weeks to draw a trend.</p>;
  const W = 720;
  const H = height;
  const pad = { l: 46, r: 18, t: 18, b: 28 };
  const max = Math.max(...points.map((p) => p.value)) * 1.15;
  const x = (i: number) => pad.l + (i / (points.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  const ticks = [0, 0.33, 0.66, 1].map((t) => t * max);
  const label = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
  const step = Math.ceil(points.length / 7);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Weekly units sold. Latest week ${fmt(last.value)}.`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a3e635" stopOpacity="0.38" />
          <stop offset="100%" stopColor="#a3e635" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#1f3315" strokeDasharray="3 5" />
          <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#8e9a86" fontFamily="var(--font-fira-code)">
            {fmt(t)}
          </text>
        </g>
      ))}
      <path d={`${line} L${x(points.length - 1)},${H - pad.b} L${x(0)},${H - pad.b} Z`} fill={`url(#${id})`} className="fade-in-slow" />
      <path d={line} fill="none" stroke="#a3e635" strokeWidth="2.4" strokeLinejoin="round" pathLength={1} className="draw-line glow-line" />
      {points.map((p, i) => (
        <circle key={p.label} cx={x(i)} cy={y(p.value)} r="3" fill="#050a04" stroke="#a3e635" strokeWidth="1.6" className="fade-in-slow">
          <title>{`${label(p.label)}: ${fmt(p.value)} units`}</title>
        </circle>
      ))}
      <g className="fade-in-slow">
        <rect x={x(points.length - 1) - 38} y={y(last.value) - 30} width="62" height="20" rx="5" fill="#a3e635" />
        <text x={x(points.length - 1) - 7} y={y(last.value) - 16} textAnchor="middle" fontSize="11" fontWeight="600" fill="#0a1204" fontFamily="var(--font-fira-code)">
          {fmt(last.value)}
        </text>
      </g>
      {points.map((p, i) =>
        i % step === 0 || i === points.length - 1 ? (
          <text key={p.label} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#8e9a86" fontFamily="var(--font-fira-code)">
            {label(p.label)}
          </text>
        ) : null,
      )}
    </svg>
  );
}

export function Donut({ parts, center }: { parts: { label: string; value: number }[]; center: ReactNode }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  const r = 58;
  const pctOf = (v: number) => (total ? (v / total) * 100 : 0);
  const starts = parts.map((_, i) => parts.slice(0, i).reduce((a, p) => a + pctOf(p.value), 0));
  return (
    <div className="flex flex-wrap items-center justify-center gap-5">
      <div className="relative h-40 w-40 shrink-0 spin-in" role="img" aria-label={`Stock by category: ${parts.map((p) => `${p.label} ${total ? Math.round((p.value / total) * 100) : 0}%`).join(", ")}`}>
        <svg viewBox="0 0 160 160" className="-rotate-90" aria-hidden="true">
          <circle cx="80" cy="80" r={r} fill="none" stroke="#1a2a12" strokeWidth="20" />
          {parts.map((p, i) => {
            const seg = Math.max(pctOf(p.value) - 1.2, 0);
            return <circle key={p.label} cx="80" cy="80" r={r} fill="none" stroke={NEON[i % NEON.length]} strokeWidth="20" pathLength={100} strokeDasharray={`${seg} ${100 - seg}`} strokeDashoffset={-starts[i]} className="glow-soft" />;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{center}</div>
      </div>
      <ul className="min-w-[140px] space-y-1.5 text-sm">
        {parts.map((p, i) => (
          <li key={p.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: NEON[i % NEON.length], boxShadow: `0 0 8px ${NEON[i % NEON.length]}` }} aria-hidden="true" />
            <span className="text-slate-800">{p.label}</span>
            <span className="ml-auto font-mono text-[13px] text-slate-600">{total ? Math.round((p.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Ranked horizontal bars with the value at the end of each row. */
export function HBars({ rows, unit = "" }: { rows: { label: string; sub?: string; value: number }[]; unit?: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ol className="space-y-3">
      {rows.map((r, i) => (
        <li key={r.label} className="flex items-center gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-lime-400/40 bg-lime-400/10 font-mono text-xs text-lime-300">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate text-slate-800" title={r.sub ?? r.label}>
                {r.label}
              </span>
              <span className="font-mono text-[13px] text-lime-300">
                {fmt(r.value)}
                {unit}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="grow-x h-full rounded-full bg-gradient-to-r from-lime-600 to-lime-300 glow-soft" style={{ width: `${(r.value / max) * 100}%`, ...delay(150 + i * 90) }} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function ColBars({ cols }: { cols: { label: string; value: number }[] }) {
  const max = Math.max(...cols.map((c) => c.value), 1);
  return (
    <div className="flex h-36 items-end gap-2" role="img" aria-label={`Suggested order quantities: ${cols.map((c) => `${c.label} ${c.value}`).join(", ")}`}>
      {cols.map((c, i) => (
        <div key={c.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${c.label}: ${fmt(c.value)} units`}>
          <span className="font-mono text-[11px] text-slate-600">{fmt(c.value)}</span>
          <div className="grow-y w-full rounded-t-md bg-gradient-to-t from-lime-700 to-lime-300 glow-soft" style={{ height: `${Math.max((c.value / max) * 78, 4)}%`, ...delay(120 + i * 80) }} />
          <span className="w-full truncate text-center font-mono text-[10px] text-slate-500">{c.label}</span>
        </div>
      ))}
    </div>
  );
}

export function MeterRow({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <li className="flex items-center gap-3 text-sm">
      <span className="w-40 shrink-0 text-slate-700">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className="grow-x h-full rounded-full bg-gradient-to-r from-lime-600 to-lime-300 glow-soft" style={{ width: `${v}%` }} />
      </div>
      <span className="w-12 text-right font-mono text-[13px] text-lime-300">{Math.round(v)}%</span>
    </li>
  );
}

export function Icon({ name, className = "h-4 w-4" }: { name: "up" | "down" | "check" | "circle" | "box" | "pause" | "zap"; className?: string }) {
  const p = {
    up: "M3 17l6-6 4 4 8-8M14 7h7v7",
    down: "M3 7l6 6 4-4 8 8M14 17h7v-7",
    check: "M5 13l4 4L19 7",
    circle: "M12 21a9 9 0 100-18 9 9 0 000 18z",
    box: "M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v8",
    pause: "M10 5v14M15 5v14",
    zap: "M13 2L4 14h7l-1 8 9-12h-7l1-8z",
  }[name];
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={p} />
    </svg>
  );
}

import Link from "next/link";
import { RANGES, type RangeKey } from "@/lib/stats";

export const RANGE_LABELS: Record<RangeKey, string> = { "7": "Last 7 days", "30": "Last 30 days", all: "All time" };

export function RangeTabs({ basePath, range }: { basePath: string; range: RangeKey }) {
  return (
    <nav className="mt-4 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm sm:inline-flex" aria-label="Date range">
      {(Object.keys(RANGES) as RangeKey[]).map((key) => (
        <Link
          key={key}
          href={`${basePath}?days=${key}`}
          aria-current={key === range ? "page" : undefined}
          className={`rounded-md px-3 py-1.5 ${key === range ? "bg-white font-semibold shadow" : "text-slate-600 hover:text-slate-900"}`}
        >
          {RANGE_LABELS[key]}
        </Link>
      ))}
    </nav>
  );
}

export function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold text-slate-900">{value}</dd>
      {sub && <dd className="text-sm text-slate-600">{sub}</dd>}
    </div>
  );
}

export function Panel({ title, className = "", children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** Single-series ranked bars: one hue, value labelled directly, so no legend needed. */
export function BarList({ rows }: { rows: { key: string; label: string; sub?: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(0,1.5fr)_1fr_2.5rem] items-center gap-3 text-sm" title={`${r.label}${r.sub ? ` · ${r.sub}` : ""}: ${r.value}`}>
          <span className="truncate">
            {r.label}
            {r.sub && <span className="text-slate-500"> · {r.sub}</span>}
          </span>
          <span className="h-3 rounded-r bg-slate-100" aria-hidden>
            <span className="block h-3 rounded-r bg-emerald-600" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="tabular text-right font-medium text-slate-800">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

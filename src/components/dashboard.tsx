import Link from "next/link";
import { RANGES, type RangeKey } from "@/lib/stats";

export const RANGE_LABELS: Record<RangeKey, string> = { "7": "Last 7 days", "30": "Last 30 days", all: "All time" };

export function RangeTabs({ basePath, range }: { basePath: string; range: RangeKey }) {
  return (
    <nav className="mt-5 flex gap-1 rounded-lg border border-line bg-surface p-1 text-sm sm:inline-flex" aria-label="Date range">
      {(Object.keys(RANGES) as RangeKey[]).map((key) => (
        <Link
          key={key}
          href={`${basePath}?days=${key}`}
          aria-current={key === range ? "page" : undefined}
          className={`rounded-md px-3 py-1.5 transition-colors ${key === range ? "bg-surface-3 font-medium text-ink" : "text-ink-3 hover:text-ink"}`}
        >
          {RANGE_LABELS[key]}
        </Link>
      ))}
    </nav>
  );
}

export function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <dt className="text-xs uppercase tracking-wide text-ink-3">{label}</dt>
      <dd className={`mt-1 font-semibold tracking-tight text-ink ${/^[\d,.%$]+$/.test(value) ? "tabular text-3xl" : "truncate text-xl"}`} title={value}>
        {value}
      </dd>
      {sub && <dd className="text-sm text-ink-2">{sub}</dd>}
    </div>
  );
}

export function Panel({ title, className = "", children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`rounded-xl border border-line bg-surface p-5 ${className}`}>
      <h2 className="mb-4 text-sm font-semibold tracking-tight text-ink">{title}</h2>
      {children}
    </section>
  );
}

/** Single-series ranked bars: one hue, value labelled directly, so no legend needed. */
export function BarList({ rows }: { rows: { key: string; label: string; sub?: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(0,1.5fr)_1fr_2.5rem] items-center gap-3 text-sm" title={`${r.label}${r.sub ? ` · ${r.sub}` : ""}: ${r.value}`}>
          <span className="truncate text-ink">
            {r.label}
            {r.sub && <span className="text-ink-3"> · {r.sub}</span>}
          </span>
          <span className="h-2 rounded-r-[4px] bg-surface-2" aria-hidden>
            <span className="block h-2 rounded-r-[4px] bg-accent" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="tabular text-right font-medium text-ink">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

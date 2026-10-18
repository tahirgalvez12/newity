import Link from "next/link";
import { Suspense } from "react";
import type { Borrower } from "@/lib/matching";
import { getRecommendationStats, parseRange, RANGES, type RangeKey } from "@/lib/stats";
import { describeBorrower } from "@/lib/summary";

const RANGE_LABELS: Record<RangeKey, string> = { "7": "Last 7 days", "30": "Last 30 days", all: "All time" };

export default function ManagerPage({ searchParams }: PageProps<"/manager">) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="text-2xl font-semibold">What reps are recommending</h1>
      <p className="mt-1 text-sm text-slate-600">Counts every time a rep clicks Recommend on a program for a borrower.</p>
      <Suspense fallback={<p className="mt-6 text-slate-500">Loading…</p>}>
        <Stats searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Stats({ searchParams }: { searchParams: PageProps<"/manager">["searchParams"] }) {
  const range = parseRange((await searchParams).days);
  const stats = await getRecommendationStats(range);

  return (
    <>
      <nav className="mt-4 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm sm:inline-flex" aria-label="Date range">
        {(Object.keys(RANGES) as RangeKey[]).map((key) => (
          <Link
            key={key}
            href={`/manager?days=${key}`}
            aria-current={key === range ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 ${key === range ? "bg-white font-semibold shadow" : "text-slate-600 hover:text-slate-900"}`}
          >
            {RANGE_LABELS[key]}
          </Link>
        ))}
      </nav>

      {stats.total === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
          No recommendations logged {range === "all" ? "yet" : `in the ${RANGE_LABELS[range].toLowerCase()}`}. They appear here as soon as a rep
          clicks <strong>Recommend</strong> in the matcher.
        </div>
      ) : (
        <>
          <dl className="tabular mt-6 grid gap-3 sm:grid-cols-3">
            <Tile label="Recommendations" value={String(stats.total)} />
            <Tile label="Reps recommending" value={String(stats.byRep.length)} />
            <Tile
              label="Top program"
              value={stats.byProgram[0] ? `${stats.byProgram[0].lenderName}` : "—"}
              sub={stats.byProgram[0]?.programType}
            />
          </dl>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Panel title="Top programs">
              <BarList rows={stats.byProgram.map((r) => ({ key: String(r.programId), label: r.lenderName, sub: r.programType, value: r.count }))} />
            </Panel>
            <div className="space-y-6">
              <Panel title="By program type">
                <BarList rows={stats.byProgramType.map((r) => ({ key: r.programType, label: r.programType, value: r.count }))} />
              </Panel>
              <Panel title="By rep">
                <BarList rows={stats.byRep.map((r) => ({ key: r.repName, label: r.repName, value: r.count }))} />
              </Panel>
            </div>
          </div>

          <Panel title="Latest recommendations" className="mt-6">
            <div className="overflow-x-auto">
              <table className="tabular w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2 pr-4 font-medium">When</th>
                    <th className="py-2 pr-4 font-medium">Rep</th>
                    <th className="py-2 pr-4 font-medium">Program</th>
                    <th className="py-2 font-medium">Borrower</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.recent.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2 pr-4 whitespace-nowrap text-slate-600">
                        {r.createdAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </td>
                      <td className="py-2 pr-4">{r.repName}</td>
                      <td className="py-2 pr-4">
                        {r.lenderName} <span className="text-slate-500">· {r.programType}</span>
                      </td>
                      <td className="py-2 text-slate-600">{describeBorrower(r.borrower as Borrower) || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold text-slate-900">{value}</dd>
      {sub && <dd className="text-sm text-slate-600">{sub}</dd>}
    </div>
  );
}

function Panel({ title, className = "", children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** Single-series ranked bars: one hue, value labelled directly, so no legend needed. */
function BarList({ rows }: { rows: { key: string; label: string; sub?: string; value: number }[] }) {
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

import { Suspense } from "react";
import { BarList, Panel, RANGE_LABELS, RangeTabs, Tile } from "@/components/dashboard";
import { requireManager } from "@/lib/auth/session";
import type { Borrower } from "@/lib/matching";
import { getRecommendationStats, parseRange } from "@/lib/stats";
import { describeBorrower } from "@/lib/summary";

export default function ManagerPage({ searchParams }: PageProps<"/manager">) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Everything, including the heading, renders inside the role check so nothing
          manager-only ends up in the prerendered shell a rep could receive. */}
      <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
        <Stats searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Stats({ searchParams }: { searchParams: PageProps<"/manager">["searchParams"] }) {
  await requireManager();
  const range = parseRange((await searchParams).days);
  const stats = await getRecommendationStats(range);

  return (
    <>
      <h1 className="text-2xl font-semibold">What reps are recommending</h1>
      <p className="mt-1 text-sm text-slate-600">Counts every time someone clicks Recommend on a program for a borrower.</p>
      <RangeTabs basePath="/manager" range={range} />

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
                <BarList rows={stats.byRep.map((r) => ({ key: r.userId, label: r.name, sub: r.banned ? "deactivated" : undefined, value: r.count }))} />
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

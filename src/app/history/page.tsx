import Link from "next/link";
import { Suspense } from "react";
import { RangeTabs, RANGE_LABELS } from "@/components/dashboard";
import { requireUser } from "@/lib/auth/session";
import { formatRate } from "@/lib/format";
import type { Borrower } from "@/lib/matching";
import { getUserHistory, parseRange } from "@/lib/stats";
import { describeBorrower } from "@/lib/summary";
import { writeMatcherState } from "@/lib/url-state";

export default function HistoryPage({ searchParams }: PageProps<"/history">) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="text-2xl font-semibold">My recommendations</h1>
      <p className="mt-1 text-sm text-slate-600">Programs you recommended. Open one to pick up a follow-up call where you left off.</p>
      <Suspense fallback={<p className="mt-6 text-slate-500">Loading…</p>}>
        <History searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function History({ searchParams }: { searchParams: PageProps<"/history">["searchParams"] }) {
  const user = await requireUser();
  const range = parseRange((await searchParams).days);
  const { total, rows } = await getUserHistory(user.id, range);

  return (
    <>
      <RangeTabs basePath="/history" range={range} />
      {rows.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
          Nothing {range === "all" ? "yet" : `in the ${RANGE_LABELS[range].toLowerCase()}`}. Click <strong>Recommend</strong> on a program in the{" "}
          <Link href="/" className="text-emerald-700 underline">
            matcher
          </Link>{" "}
          and it shows up here.
        </div>
      ) : (
        <section className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
          <p className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
            {total} recommendation{total === 1 ? "" : "s"}
            {total > rows.length ? ` · showing latest ${rows.length}` : ""}
          </p>
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => {
              const borrower = r.borrower as Borrower;
              const href = `/?${writeMatcherState({ borrower, sort: "rate", compareIds: [r.programId] })}`;
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <div className="font-medium text-slate-900">
                      {r.lenderName} <span className="font-normal text-slate-600">· {r.programType}</span>
                      <span className="tabular ml-2 font-normal text-slate-500">{formatRate(r.interestRateMin, r.interestRateMax)}</span>
                    </div>
                    <div className="text-slate-600">{describeBorrower(borrower) || "No borrower details"}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <time className="tabular whitespace-nowrap text-slate-500" dateTime={r.createdAt.toISOString()}>
                      {r.createdAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </time>
                    <Link href={href} className="rounded-lg border border-slate-300 px-3 py-1 hover:bg-slate-50">
                      Open in matcher
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}

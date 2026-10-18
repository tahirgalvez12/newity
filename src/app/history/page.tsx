import Link from "next/link";
import { Suspense } from "react";
import { RangeTabs, RANGE_LABELS } from "@/components/dashboard";
import { requireUser } from "@/lib/auth/session";
import { formatRate } from "@/lib/format";
import type { Borrower } from "@/lib/matching";
import { getUserHistory, parseRange } from "@/lib/stats";
import { describeBorrower } from "@/lib/summary";
import { writeMatcherState } from "@/lib/url-state";
import { btn, card, pageSubtitle, pageTitle } from "@/components/ui";

export default function HistoryPage({ searchParams }: PageProps<"/history">) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className={pageTitle}>My recommendations</h1>
      <p className={pageSubtitle}>Programs you recommended. Open one to pick up a follow-up call where you left off.</p>
      <Suspense fallback={<p className="mt-6 text-ink-3">Loading…</p>}>
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
        <div className="mt-6 rounded-xl border border-dashed border-line-strong p-10 text-center text-ink-2">
          Nothing {range === "all" ? "yet" : `in the ${RANGE_LABELS[range].toLowerCase()}`}. Click <strong>Recommend</strong> on a program in the{" "}
          <Link href="/" className="text-accent underline">
            matcher
          </Link>{" "}
          and it shows up here.
        </div>
      ) : (
        <section className={`${card} mt-6 overflow-hidden`}>
          <p className="border-b border-line bg-surface-2/50 px-5 py-3 text-sm text-ink-2">
            {total} recommendation{total === 1 ? "" : "s"}
            {total > rows.length ? ` · showing latest ${rows.length}` : ""}
          </p>
          <ul className="divide-y divide-line">
            {rows.map((r) => {
              const borrower = r.borrower as Borrower;
              const href = `/?${writeMatcherState({ borrower, sort: "rate", compareIds: [r.programId] })}`;
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-sm transition-colors hover:bg-surface-2/40">
                  <div>
                    <div className="font-medium text-ink">
                      {r.lenderName} <span className="font-normal text-ink-2">· {r.programType}</span>
                      <span className="tabular ml-2 font-normal text-accent">{formatRate(r.interestRateMin, r.interestRateMax)}</span>
                    </div>
                    <div className="text-ink-2">{describeBorrower(borrower) || "No borrower details"}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <time className="tabular whitespace-nowrap text-ink-3" dateTime={r.createdAt.toISOString()}>
                      {r.createdAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </time>
                    <Link href={href} className={btn.secondary}>
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

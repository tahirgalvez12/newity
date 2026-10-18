"use client";

import { formatMoneyShort, formatRate, formatTerm, formatYears } from "@/lib/format";
import { daysSince, STALE_AFTER_DAYS, type MatchResult } from "@/lib/matching";
import type { ProgramView, RecommendState } from "./types";
import { badge, btn } from "./ui";

interface Props {
  result: MatchResult<ProgramView>;
  now: Date;
  compared: boolean;
  compareDisabled: boolean;
  onToggleCompare: () => void;
  recommendState: RecommendState | undefined;
  onRecommend: () => void;
}

export function ProgramCard({ result, now, compared, compareDisabled, onToggleCompare, recommendState, onRecommend }: Props) {
  const p = result.program;
  const age = daysSince(p.lastUpdated, now);
  const stale = age > STALE_AFTER_DAYS;
  const notes = [
    ...result.warnings.map((text) => ({ kind: "warn" as const, text })),
    ...(p.programType === "504 Loan" ? [{ kind: "info" as const, text: "504 loans fund real estate or major equipment, not working capital" }] : []),
    ...(p.specialRequirements ? [{ kind: "info" as const, text: `Ask about: ${p.specialRequirements}` }] : []),
  ];

  return (
    <article
      className={`rounded-xl border bg-surface p-5 transition-colors ${
        compared ? "border-accent-line ring-1 ring-accent-line" : "border-line hover:border-line-strong"
      }`}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold tracking-tight text-ink">{p.lenderName}</h3>
          <p className="mt-0.5 text-sm text-ink-2">{p.programType}</p>
        </div>
        <span title={`Rates last updated ${p.lastUpdated}`} className={stale ? badge.warn : badge.neutral}>
          {stale ? `⚠ Rates ${age} days old` : `Rates updated ${age === 0 ? "today" : `${age}d ago`}`}
        </span>
      </header>

      <dl className="tabular mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
        <Stat label="Rate" value={formatRate(p.interestRateMin, p.interestRateMax)} strong />
        <Stat label="Max term" value={formatTerm(p.maxTermMonths)} />
        <Stat label="Turnaround" value={`${p.turnaroundDays} days`} />
        <Stat label="Loan range" value={`${formatMoneyShort(p.minLoanAmount)}–${formatMoneyShort(p.maxLoanAmount)}`} />
      </dl>

      <ul aria-label="Requirements" className="mt-3 flex flex-wrap gap-1.5 text-xs text-ink-2">
        <Chip>{p.minCreditScore}+ credit</Chip>
        <Chip>Min {formatYears(p.minYearsInBusiness)} in business</Chip>
        <Chip>{p.eligibleBusinessTypes === "All" ? "All industries" : p.eligibleBusinessTypes}</Chip>
        <Chip>Collateral: {p.requiresCollateral}</Chip>
        <Chip>SBA guarantee {p.sbaGuaranteePct}%</Chip>
        <Chip>Max debt ratio: {p.maxExistingDebtRatio != null ? `${Math.round(p.maxExistingDebtRatio * 100)}%` : "not specified"}</Chip>
      </ul>

      {notes.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-sm">
          {notes.map((n) => (
            <li
              key={n.text}
              className={`flex gap-2 rounded-md border px-2.5 py-1.5 ${
                n.kind === "warn" ? "border-warn-line bg-warn-soft text-warn" : "border-transparent bg-info-soft text-info"
              }`}
            >
              <span aria-hidden>{n.kind === "warn" ? "⚠" : "ⓘ"}</span>
              <span className={n.kind === "warn" ? "" : "text-ink-2"}>{n.text}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
        {recommendState === "error" && <span className="mr-auto text-sm text-danger">Couldn&apos;t save. Try again.</span>}
        <label
          className={`${btn.secondary} cursor-pointer select-none ${compareDisabled && !compared ? "pointer-events-none opacity-50" : ""} ${
            compared ? "border-accent-line bg-accent-soft text-accent hover:bg-accent-soft" : ""
          }`}
          title={compareDisabled && !compared ? "You can compare up to 4 programs" : undefined}
        >
          <input
            type="checkbox"
            className="accent-accent"
            aria-label={`Compare ${p.lenderName} ${p.programType}`}
            checked={compared}
            disabled={compareDisabled && !compared}
            onChange={onToggleCompare}
          />
          Compare
        </label>
        <button
          type="button"
          onClick={onRecommend}
          disabled={recommendState === "saving" || recommendState === "done"}
          className={
            recommendState === "done"
              ? `${btn.secondary} border-accent-line bg-accent-soft text-accent disabled:opacity-100`
              : `${btn.primary} py-1.5`
          }
        >
          {recommendState === "done" ? "✓ Recommended" : recommendState === "saving" ? "Saving…" : "Recommend"}
        </button>
      </div>
    </article>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="bg-surface-2/60 px-3 py-2.5">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-ink-3">{label}</dt>
      <dd className={strong ? "mt-0.5 text-lg font-semibold text-accent" : "mt-0.5 text-base font-medium text-ink"}>{value}</dd>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <li className="rounded-full border border-line px-2 py-0.5">{children}</li>;
}

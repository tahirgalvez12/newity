"use client";

import { formatMoneyShort, formatRate, formatTerm, formatYears } from "@/lib/format";
import { daysSince, STALE_AFTER_DAYS, type MatchResult } from "@/lib/matching";
import type { ProgramView, RecommendState } from "./types";

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

  return (
    <article
      className={`rounded-xl border bg-white p-4 shadow-sm transition ${compared ? "border-emerald-500 ring-2 ring-emerald-100" : "border-slate-200"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{p.lenderName}</h3>
          <p className="text-sm text-slate-600">{p.programType}</p>
        </div>
        <span
          title={`Rates last updated ${p.lastUpdated}`}
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${stale ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}
        >
          {stale ? `⚠ Rates ${age} days old` : `Rates updated ${age === 0 ? "today" : `${age}d ago`}`}
        </span>
      </div>

      <dl className="tabular mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        <Stat label="Rate" value={formatRate(p.interestRateMin, p.interestRateMax)} strong />
        <Stat label="Max term" value={formatTerm(p.maxTermMonths)} />
        <Stat label="Turnaround" value={`${p.turnaroundDays} days`} />
        <Stat label="Loan range" value={`${formatMoneyShort(p.minLoanAmount)}–${formatMoneyShort(p.maxLoanAmount)}`} />
      </dl>

      <ul className="mt-3 flex flex-wrap gap-1.5 text-xs text-slate-700">
        <Chip>{p.minCreditScore}+ credit</Chip>
        <Chip>Min {formatYears(p.minYearsInBusiness)} in business</Chip>
        <Chip>{p.eligibleBusinessTypes === "All" ? "All industries" : p.eligibleBusinessTypes}</Chip>
        <Chip>Collateral: {p.requiresCollateral}</Chip>
        <Chip>SBA guarantee {p.sbaGuaranteePct}%</Chip>
        <Chip>
          Max debt ratio: {p.maxExistingDebtRatio != null ? `${Math.round(p.maxExistingDebtRatio * 100)}%` : "not specified"}
        </Chip>
      </ul>

      {(result.warnings.length > 0 || p.specialRequirements || p.programType === "504 Loan") && (
        <ul className="mt-3 space-y-1 text-sm">
          {result.warnings.map((w) => (
            <li key={w} className="rounded-md bg-amber-50 px-2 py-1 text-amber-900">
              ⚠ {w}
            </li>
          ))}
          {p.programType === "504 Loan" && (
            <li className="rounded-md bg-sky-50 px-2 py-1 text-sky-900">ℹ 504 loans fund real estate or major equipment, not working capital</li>
          )}
          {p.specialRequirements && (
            <li className="rounded-md bg-sky-50 px-2 py-1 text-sky-900">ℹ Ask about: {p.specialRequirements}</li>
          )}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label
          className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${compareDisabled && !compared ? "cursor-not-allowed opacity-50" : "hover:bg-slate-50"} ${compared ? "border-emerald-500 bg-emerald-50 text-emerald-900" : "border-slate-300"}`}
        >
          <input
            type="checkbox"
            className="accent-emerald-600"
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
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            recommendState === "done"
              ? "bg-emerald-100 text-emerald-800"
              : "bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
          }`}
        >
          {recommendState === "done" ? "✓ Recommended" : recommendState === "saving" ? "Saving…" : "Recommend"}
        </button>
        {recommendState === "error" && <span className="text-sm text-red-700">Couldn&apos;t save. Try again.</span>}
      </div>
    </article>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={strong ? "text-lg font-semibold text-slate-900" : "text-base text-slate-800"}>{value}</dd>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <li className="rounded-full bg-slate-100 px-2 py-0.5">{children}</li>;
}

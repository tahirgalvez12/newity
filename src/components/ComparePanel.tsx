"use client";

import { useEffect } from "react";
import { formatMoneyShort, formatRate, formatTerm, formatYears } from "@/lib/format";
import { daysSince, STALE_AFTER_DAYS } from "@/lib/matching";
import { RateChangeBadge, recentChange, type RecentChange } from "./RateChange";
import type { ProgramView } from "./types";
import { btn } from "./ui";

interface Props {
  programs: ProgramView[];
  now: Date;
  onClose: () => void;
  onRemove: (id: number) => void;
}

type Row = {
  label: string;
  value: (p: ProgramView) => string;
  /** Lower-is-better or higher-is-better numeric key to highlight the best column. */
  best?: { key: (p: ProgramView) => number; dir: "min" | "max" };
  /** Previous value from a recent rate import, shown under the current one. */
  was?: (c: RecentChange) => string | undefined;
};

const ROWS: Row[] = [
  { label: "Rate", value: (p) => formatRate(p.interestRateMin, p.interestRateMax), best: { key: (p) => p.interestRateMin, dir: "min" }, was: (c) => c.rate?.from },
  { label: "Max term", value: (p) => formatTerm(p.maxTermMonths), best: { key: (p) => p.maxTermMonths, dir: "max" }, was: (c) => c.term?.from },
  { label: "Turnaround", value: (p) => `${p.turnaroundDays} days`, best: { key: (p) => p.turnaroundDays, dir: "min" } },
  { label: "Loan range", value: (p) => `${formatMoneyShort(p.minLoanAmount)}–${formatMoneyShort(p.maxLoanAmount)}` },
  { label: "Min credit score", value: (p) => String(p.minCreditScore) },
  { label: "Min time in business", value: (p) => formatYears(p.minYearsInBusiness) },
  { label: "Industries", value: (p) => (p.eligibleBusinessTypes === "All" ? "All" : p.eligibleBusinessTypes) },
  { label: "Collateral", value: (p) => p.requiresCollateral },
  { label: "SBA guarantee", value: (p) => `${p.sbaGuaranteePct}%` },
  { label: "Max debt ratio", value: (p) => (p.maxExistingDebtRatio != null ? `${Math.round(p.maxExistingDebtRatio * 100)}%` : "Not specified") },
  { label: "Special requirements", value: (p) => p.specialRequirements ?? "None" },
];

export function ComparePanel({ programs, now, onClose, onRemove }: Props) {
  const changes = new Map(programs.map((p) => [p.id, recentChange(p, now)]));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Compare programs"
        className="mt-8 w-full max-w-6xl overflow-hidden rounded-xl border border-line-strong bg-surface shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-ink">Side-by-side comparison</h2>
            <p className="text-xs text-ink-3">★ marks the best value in a row</p>
          </div>
          <button type="button" onClick={onClose} className={btn.ghost} aria-label="Close">
            ✕ <kbd className="rounded border border-line-strong px-1 text-[10px] text-ink-3">Esc</kbd>
          </button>
        </div>
        <div className="relative overflow-x-auto">
          <table className="tabular w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2/60">
                <th className="w-44 px-5 py-3" />
                {programs.map((p) => (
                  <th key={p.id} className="min-w-48 px-4 py-3 align-top">
                    <div className="font-semibold text-ink">{p.lenderName}</div>
                    <div className="font-normal text-ink-2">{p.programType}</div>
                    {changes.get(p.id) && (
                      <div className="mt-1">
                        <RateChangeBadge recent={changes.get(p.id)!} />
                      </div>
                    )}
                    <button type="button" onClick={() => onRemove(p.id)} className="mt-1 text-xs font-normal text-ink-3 underline-offset-2 hover:text-danger hover:underline">
                      Remove
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => {
                const bestValue = row.best && programs.length > 1 ? pickBest(programs, row.best) : null;
                return (
                  <tr key={row.label} className="border-b border-line hover:bg-surface-2/40">
                    <th className="px-5 py-2.5 font-medium text-ink-3">{row.label}</th>
                    {programs.map((p) => {
                      const isBest = bestValue != null && row.best!.key(p) === bestValue;
                      const change = changes.get(p.id);
                      const was = change && row.was?.(change);
                      return (
                        <td key={p.id} className={`px-4 py-2.5 ${isBest ? "bg-accent-soft font-semibold text-accent" : "text-ink"}`}>
                          {row.value(p)}
                          {isBest && <span className="ml-1 text-xs font-normal">★ best</span>}
                          {was && (
                            <div className="text-xs font-normal text-info">
                              was <s className="text-ink-2">{was}</s>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              <tr>
                <th className="px-5 py-2.5 font-medium text-ink-3">Rates updated</th>
                {programs.map((p) => {
                  const age = daysSince(p.lastUpdated, now);
                  return (
                    <td key={p.id} className={`px-4 py-2.5 ${age > STALE_AFTER_DAYS ? "text-warn" : "text-ink"}`}>
                      {age > STALE_AFTER_DAYS && "⚠ "}
                      {p.lastUpdated} ({age} days ago)
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function pickBest(programs: ProgramView[], best: NonNullable<Row["best"]>): number | null {
  const values = programs.map(best.key);
  const target = best.dir === "min" ? Math.min(...values) : Math.max(...values);
  // No highlight when everyone ties: "best" would be noise.
  return values.every((v) => v === target) ? null : target;
}

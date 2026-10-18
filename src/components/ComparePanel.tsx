"use client";

import { useEffect } from "react";
import { formatMoneyShort, formatRate, formatTerm, formatYears } from "@/lib/format";
import { daysSince, STALE_AFTER_DAYS } from "@/lib/matching";
import type { ProgramView } from "./types";

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
};

const ROWS: Row[] = [
  { label: "Rate", value: (p) => formatRate(p.interestRateMin, p.interestRateMax), best: { key: (p) => p.interestRateMin, dir: "min" } },
  { label: "Max term", value: (p) => formatTerm(p.maxTermMonths), best: { key: (p) => p.maxTermMonths, dir: "max" } },
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Compare programs"
        className="mt-8 w-full max-w-6xl rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-lg font-semibold">Side-by-side comparison</h2>
          <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
            ✕ <span className="text-xs">Esc</span>
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="tabular w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="w-44 px-4 py-3" />
                {programs.map((p) => (
                  <th key={p.id} className="min-w-48 px-4 py-3 align-top">
                    <div className="font-semibold text-slate-900">{p.lenderName}</div>
                    <div className="font-normal text-slate-600">{p.programType}</div>
                    <button type="button" onClick={() => onRemove(p.id)} className="mt-1 text-xs font-normal text-slate-500 underline hover:text-slate-800">
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
                  <tr key={row.label} className="border-b border-slate-100">
                    <th className="px-4 py-2 font-medium text-slate-600">{row.label}</th>
                    {programs.map((p) => {
                      const isBest = bestValue != null && row.best!.key(p) === bestValue;
                      return (
                        <td key={p.id} className={`px-4 py-2 ${isBest ? "bg-emerald-50 font-semibold text-emerald-900" : "text-slate-800"}`}>
                          {row.value(p)}
                          {isBest && <span className="ml-1 text-xs font-normal">★ best</span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              <tr>
                <th className="px-4 py-2 font-medium text-slate-600">Rates updated</th>
                {programs.map((p) => {
                  const age = daysSince(p.lastUpdated, now);
                  return (
                    <td key={p.id} className={`px-4 py-2 ${age > STALE_AFTER_DAYS ? "text-amber-800" : "text-slate-800"}`}>
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

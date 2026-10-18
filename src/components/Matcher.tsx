"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatMoneyFull, formatRate, parseAmount } from "@/lib/format";
import {
  ALL_BUSINESS_TYPES,
  OTHER_BUSINESS_TYPE,
  daysSince,
  hasAnyCriteria,
  matchPrograms,
  type Borrower,
  type CreditTier,
  type SortKey,
} from "@/lib/matching";
import { buildBorrowerSummary, describeBorrower } from "@/lib/summary";
import { MAX_COMPARE, readMatcherState, writeMatcherState, type MatcherState } from "@/lib/url-state";
import { ComparePanel } from "./ComparePanel";
import { ProgramCard } from "./ProgramCard";
import type { ProgramView, RecommendState } from "./types";
import { useRepName } from "./useRepName";

const TIERS: { tier: CreditTier; hint: string }[] = [
  { tier: "Excellent", hint: "720+" },
  { tier: "Good", hint: "680–719" },
  { tier: "Fair", hint: "620–679" },
];

const SORT_LABELS: Record<SortKey, string> = {
  rate: "Lowest rate",
  speed: "Fastest turnaround",
  maxLoan: "Largest max loan",
};

const EMPTY_BORROWER: Borrower = { loanAmount: null, businessType: null, yearsInBusiness: null, creditTier: null, creditScore: null };

export function Matcher({ programs }: { programs: ProgramView[] }) {
  const searchParams = useSearchParams();
  const [state, setState] = useState<MatcherState>(() => readMatcherState(new URLSearchParams(searchParams.toString())));
  const { borrower, sort, compareIds } = state;

  // Raw text the rep is typing; parsed values live in `state`.
  const [amountText, setAmountText] = useState(borrower.loanAmount != null ? formatMoneyFull(borrower.loanAmount) : "");
  const [yearsText, setYearsText] = useState(borrower.yearsInBusiness != null ? String(borrower.yearsInBusiness) : "");
  const [scoreText, setScoreText] = useState(borrower.creditScore != null ? String(borrower.creditScore) : "");

  const [compareOpen, setCompareOpen] = useState(false);
  const [recommendStates, setRecommendStates] = useState<Record<number, RecommendState>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [repName, setRepName] = useRepName();
  const [repNameMissing, setRepNameMissing] = useState(false);
  const repNameRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const now = useMemo(() => new Date(), []);

  // Keep the URL in sync so the view can be shared or survive a refresh.
  useEffect(() => {
    const qs = writeMatcherState(state).toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [state]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const updateBorrower = useCallback((patch: Partial<Borrower>) => {
    setState((s) => ({ ...s, borrower: { ...s.borrower, ...patch } }));
    // A changed borrower is a new recommendation context.
    setRecommendStates({});
  }, []);

  const businessTypes = useMemo(
    () => [...new Set(programs.map((p) => p.eligibleBusinessTypes))].filter((t) => t !== ALL_BUSINESS_TYPES).sort(),
    [programs],
  );
  const { eligible, nearMisses } = useMemo(() => matchPrograms(programs, borrower, sort), [programs, borrower, sort]);
  const programsById = useMemo(() => new Map(programs.map((p) => [p.id, p])), [programs]);
  const compared = compareIds.map((id) => programsById.get(id)).filter((p): p is ProgramView => p != null);
  const newestUpdate = useMemo(() => programs.map((p) => p.lastUpdated).sort().at(-1), [programs]);

  const amountInvalid = amountText.trim() !== "" && parseAmount(amountText) == null;
  const scoreInvalid = scoreText.trim() !== "" && borrower.creditScore == null;
  const filtering = hasAnyCriteria(borrower);

  function toggleCompare(id: number) {
    setState((s) => {
      if (s.compareIds.includes(id)) return { ...s, compareIds: s.compareIds.filter((x) => x !== id) };
      if (s.compareIds.length >= MAX_COMPARE) return s;
      return { ...s, compareIds: [...s.compareIds, id] };
    });
  }

  function resetAll() {
    setState({ borrower: EMPTY_BORROWER, sort: "rate", compareIds: [] });
    setAmountText("");
    setYearsText("");
    setScoreText("");
    setRecommendStates({});
    setCompareOpen(false);
    amountRef.current?.focus();
  }

  async function recommend(programId: number) {
    if (!repName.trim()) {
      setRepNameMissing(true);
      repNameRef.current?.focus();
      return;
    }
    setRecommendStates((s) => ({ ...s, [programId]: "saving" }));
    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programId, repName: repName.trim(), borrower }),
      });
      if (!res.ok) throw new Error(await res.text());
      setRecommendStates((s) => ({ ...s, [programId]: "done" }));
    } catch {
      setRecommendStates((s) => ({ ...s, [programId]: "error" }));
    }
  }

  async function copy(text: string, message: string) {
    setToast((await copyToClipboard(text)) ? message : "Your browser blocked copying. Try again, or use Ctrl/Cmd+C.");
  }

  function copySummary() {
    const chosen = compared.length ? compared : eligible.slice(0, 3).map((r) => r.program);
    if (!chosen.length) return;
    copy(
      buildBorrowerSummary(borrower, chosen),
      `Copied summary of ${chosen.length} program${chosen.length === 1 ? "" : "s"}. Paste it into your email.`,
    );
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 pb-28 lg:grid-cols-[320px_1fr]">
      {/* ---------- Intake ---------- */}
      <aside className="lg:sticky lg:top-4 lg:self-start">
        <form className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" onSubmit={(e) => e.preventDefault()}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Borrower</h2>
            <button type="button" onClick={resetAll} className="text-sm text-slate-500 underline hover:text-slate-800">
              New borrower
            </button>
          </div>

          <Field label="Loan amount" htmlFor="amount" error={amountInvalid ? "Try 250k, 1.5m or 250000" : undefined}>
            <input
              id="amount"
              ref={amountRef}
              autoFocus
              inputMode="decimal"
              placeholder="e.g. 250k"
              value={amountText}
              onChange={(e) => {
                setAmountText(e.target.value);
                updateBorrower({ loanAmount: parseAmount(e.target.value) });
              }}
              onBlur={() => borrower.loanAmount != null && setAmountText(formatMoneyFull(borrower.loanAmount))}
              className={inputClass(amountInvalid)}
            />
          </Field>

          <Field label="Business type" htmlFor="type">
            <select
              id="type"
              value={borrower.businessType ?? ""}
              onChange={(e) => updateBorrower({ businessType: e.target.value || null })}
              className={inputClass(false)}
            >
              <option value="">Any / not sure</option>
              {businessTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              <option value={OTHER_BUSINESS_TYPE}>Other industry</option>
            </select>
          </Field>

          <Field label="Years in business" htmlFor="years" hint="Use 0.5 for 6 months">
            <input
              id="years"
              type="number"
              min={0}
              step={0.5}
              inputMode="decimal"
              placeholder="e.g. 2"
              value={yearsText}
              onChange={(e) => {
                setYearsText(e.target.value);
                const n = e.target.value === "" ? null : Number(e.target.value);
                updateBorrower({ yearsInBusiness: n != null && Number.isFinite(n) && n >= 0 ? n : null });
              }}
              className={inputClass(false)}
            />
          </Field>

          <fieldset>
            <legend className="mb-1 text-sm font-medium text-slate-700">Credit</legend>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1" role="radiogroup" aria-label="Credit tier">
              {TIERS.map(({ tier, hint }) => {
                const active = borrower.creditTier === tier;
                return (
                  <button
                    key={tier}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => updateBorrower({ creditTier: active ? null : tier })}
                    className={`rounded-md px-2 py-1.5 text-sm ${active ? "bg-white font-semibold text-slate-900 shadow" : "text-slate-600 hover:text-slate-900"}`}
                  >
                    {tier}
                    <span className="block text-[11px] font-normal text-slate-500">{hint}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-2">
              <Field label="Exact score (optional)" htmlFor="score" error={scoreInvalid ? "Enter a score from 300 to 850" : undefined} small>
                <input
                  id="score"
                  inputMode="numeric"
                  placeholder="e.g. 702"
                  value={scoreText}
                  onChange={(e) => {
                    setScoreText(e.target.value);
                    const n = Number(e.target.value);
                    updateBorrower({ creditScore: Number.isInteger(n) && n >= 300 && n <= 850 ? n : null });
                  }}
                  className={inputClass(scoreInvalid)}
                />
              </Field>
            </div>
          </fieldset>

          <div className="border-t border-slate-100 pt-3">
            <Field label="Recommending as" htmlFor="rep" error={repNameMissing && !repName.trim() ? "Add your name to log recommendations" : undefined} small>
              <input
                id="rep"
                ref={repNameRef}
                placeholder="Your name"
                value={repName}
                onChange={(e) => {
                  setRepName(e.target.value);
                  setRepNameMissing(false);
                }}
                className={inputClass(repNameMissing && !repName.trim())}
              />
            </Field>
          </div>
        </form>
        {newestUpdate && (
          <p className="mt-3 px-1 text-xs text-slate-500">
            Lender data: {programs.length} programs · newest rate update {newestUpdate} ({daysSince(newestUpdate, now)} days ago)
          </p>
        )}
      </aside>

      {/* ---------- Results ---------- */}
      <section aria-live="polite">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">
              {filtering ? `${eligible.length} program${eligible.length === 1 ? "" : "s"} fit` : `All ${programs.length} programs`}
            </h2>
            <p className="text-sm text-slate-600">
              {filtering ? describeBorrower(borrower) : "Enter borrower details to narrow the list."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600" htmlFor="sort">
              Sort
            </label>
            <select
              id="sort"
              value={sort}
              onChange={(e) => setState((s) => ({ ...s, sort: e.target.value as SortKey }))}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              {Object.entries(SORT_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={copySummary}
              disabled={!compared.length && !eligible.length}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              Copy summary{compared.length ? ` (${compared.length})` : " (top 3)"}
            </button>
          </div>
        </div>

        {eligible.length === 0 && filtering && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
            <p className="font-semibold">No programs fit this borrower right now.</p>
            {borrower.yearsInBusiness != null && borrower.yearsInBusiness < 1 ? (
              <p className="mt-1 text-sm">
                Every program in our network requires at least 1 year in business. Note the start date and follow up at the 1-year mark.
              </p>
            ) : (
              <p className="mt-1 text-sm">Check the near-misses below: often one detail (amount, credit) changes the picture.</p>
            )}
          </div>
        )}

        <div className="space-y-3">
          {eligible.map((r) => (
            <ProgramCard
              key={r.program.id}
              result={r}
              now={now}
              compared={compareIds.includes(r.program.id)}
              compareDisabled={compareIds.length >= MAX_COMPARE}
              onToggleCompare={() => toggleCompare(r.program.id)}
              recommendState={recommendStates[r.program.id]}
              onRecommend={() => recommend(r.program.id)}
            />
          ))}
        </div>

        {filtering && nearMisses.length > 0 && (
          <details className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm" open={eligible.length === 0}>
            <summary className="cursor-pointer px-4 py-3 font-medium">
              Almost eligible ({nearMisses.length}): one requirement off
            </summary>
            <ul className="divide-y divide-slate-100 border-t border-slate-100">
              {nearMisses.map((r) => (
                <li key={r.program.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                  <div>
                    <span className="font-medium text-slate-900">{r.program.lenderName}</span>{" "}
                    <span className="text-slate-600">· {r.program.programType}</span>
                    <span className="tabular ml-2 text-slate-500">{formatRate(r.program.interestRateMin, r.program.interestRateMax)}</span>
                  </div>
                  <span className="text-red-700">✕ {r.failures[0]}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* ---------- Compare tray ---------- */}
      {compared.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
            <span className="text-sm font-medium">
              Comparing {compared.length}/{MAX_COMPARE}:
            </span>
            <ul className="flex flex-1 flex-wrap gap-2">
              {compared.map((p) => (
                <li key={p.id} className="flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-900">
                  {p.lenderName} · {p.programType}
                  <button type="button" aria-label={`Remove ${p.lenderName}`} onClick={() => toggleCompare(p.id)} className="ml-1 text-emerald-700 hover:text-emerald-950">
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => copy(window.location.href, "Link copied. It opens this exact comparison.")} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
              Copy share link
            </button>
            <button
              type="button"
              onClick={() => setCompareOpen(true)}
              disabled={compared.length < 2}
              title={compared.length < 2 ? "Select at least 2 programs" : undefined}
              className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
            >
              Compare side by side
            </button>
          </div>
        </div>
      )}

      {compareOpen && compared.length > 0 && (
        <ComparePanel programs={compared} now={now} onClose={() => setCompareOpen(false)} onRemove={toggleCompare} />
      )}

      {toast && (
        <div role="status" className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

/** Clipboard API first; falls back to the legacy copy command for browsers/iframes that block it. */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      el.remove();
    }
  }
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  small,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  small?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className={`mb-1 block font-medium text-slate-700 ${small ? "text-xs" : "text-sm"}`}>
        {label}
      </label>
      {children}
      {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function inputClass(invalid: boolean) {
  return `w-full rounded-lg border bg-white px-3 py-2 text-base outline-none focus:ring-2 ${
    invalid ? "border-red-400 focus:ring-red-100" : "border-slate-300 focus:border-emerald-500 focus:ring-emerald-100"
  }`;
}

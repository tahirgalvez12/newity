"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/client";

export function ChangePasswordForm({ minLength }: { minLength: number }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) return setStatus({ ok: false, text: "New passwords don't match." });
    if (next.length < minLength) return setStatus({ ok: false, text: `Use at least ${minLength} characters.` });
    setPending(true);
    const { error } = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
    setPending(false);
    if (error) {
      setStatus({ ok: false, text: error.status === 400 || error.status === 401 ? "Current password is incorrect." : error.message || "Couldn't change password." });
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    setStatus({ ok: true, text: "Password changed. Other devices were signed out." });
  }

  const input = "w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";
  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="font-semibold">Change password</h2>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Current password</span>
        <input type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} className={input} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">New password</span>
        <input type="password" autoComplete="new-password" required minLength={minLength} value={next} onChange={(e) => setNext(e.target.value)} className={input} />
        <span className="mt-1 block text-xs text-slate-500">At least {minLength} characters.</span>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Confirm new password</span>
        <input type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} />
      </label>
      {status && (
        <p role={status.ok ? "status" : "alert"} className={`rounded-md px-3 py-2 text-sm ${status.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-800"}`}>
          {status.text}
        </p>
      )}
      <button type="submit" disabled={pending} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">
        {pending ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}

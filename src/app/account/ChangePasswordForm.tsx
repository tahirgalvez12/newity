"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { btn, card, input as inputClass, label } from "@/components/ui";

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

  return (
    <form onSubmit={onSubmit} className={`${card} mt-6 space-y-4 p-5`}>
      <div>
        <h2 className="font-semibold tracking-tight text-ink">Change password</h2>
        <p className="text-xs text-ink-3">Signs you out on other devices.</p>
      </div>
      <label className="block text-sm">
        <span className={label}>Current password</span>
        <input type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} className={inputClass()} />
      </label>
      <label className="block text-sm">
        <span className={label}>New password</span>
        <input type="password" autoComplete="new-password" required minLength={minLength} value={next} onChange={(e) => setNext(e.target.value)} className={inputClass()} />
        <span className="mt-1 block text-xs text-ink-3">At least {minLength} characters.</span>
      </label>
      <label className="block text-sm">
        <span className={label}>Confirm new password</span>
        <input type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass()} />
      </label>
      {status && (
        <p role={status.ok ? "status" : "alert"} className={`rounded-md border px-3 py-2 text-sm ${status.ok ? "border-accent-line bg-accent-soft text-accent" : "border-danger-line bg-danger-soft text-danger"}`}>
          {status.text}
        </p>
      )}
      <button type="submit" disabled={pending} className={btn.primary}>
        {pending ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}

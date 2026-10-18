"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { badge, btn, card, input, label } from "@/components/ui";

export interface DemoLogins {
  password: string;
  accounts: { label: string; name: string; email: string }[];
}

export function LoginForm({ next, demo }: { next: string | null; demo: DemoLogins | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await signIn(email.trim(), password);
  }

  async function signIn(email: string, password: string) {
    setPending(true);
    setError(null);
    const { data, error } = await authClient.signIn.email({ email, password });
    if (error || !data) {
      setPending(false);
      setError(messageFor(error));
      return;
    }
    const role = (data.user as { role?: string }).role;
    // Full page load (see SignOutButton): start the new session with no client state carried over
    // from before sign-in, e.g. this form's "Signing in…" state when someone later signs out.
    window.location.replace(next ?? (role === "manager" ? "/manager" : "/"));
  }

  return (
    <form onSubmit={onSubmit} className={`${card} space-y-5 p-6 shadow-2xl shadow-black/40`}>
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Sign in</h1>
        <p className="mt-1 text-sm text-ink-2">Use the email your manager set up for you.</p>
      </div>
      <div>
        <label htmlFor="email" className={label}>
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          autoFocus
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={input()}
        />
      </div>
      <div>
        <label htmlFor="password" className={label}>
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={input()}
        />
      </div>
      {error && (
        <p role="alert" className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className={`${btn.primary} w-full py-2.5`}
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-xs text-ink-3">Forgot your password? Ask your sales manager to reset it.</p>
      {demo && (
        <div className="rounded-lg border border-dashed border-line-strong bg-canvas p-3 text-sm">
          <p className="flex items-center gap-2 font-medium text-ink"><span className={badge.warn}>Local demo</span> Sign in with one click</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {demo.accounts.map((a) => (
              <button
                key={a.email}
                type="button"
                disabled={pending}
                onClick={() => signIn(a.email, demo.password)}
                className="rounded-md border border-line-strong bg-surface-2 px-3 py-2 text-left transition-colors hover:border-accent-line hover:bg-accent-soft disabled:opacity-60"
              >
                <span className="block font-medium text-ink">{a.label}</span>
                <span className="block text-xs text-ink-3">{a.name}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-3">
            Or type any demo email from the README with password <code className="rounded bg-surface-2 px-1 font-mono text-ink-2">{demo.password}</code>.
          </p>
        </div>
      )}
    </form>
  );
}

function messageFor(error: { status?: number; code?: string; message?: string } | null): string {
  if (error?.status === 429) return "Too many attempts. Wait a few seconds and try again.";
  if (error?.code === "BANNED_USER" || error?.status === 403) {
    return error.message || "This account has been deactivated. Ask your manager to reactivate it.";
  }
  // Same message for unknown email and wrong password, so the form doesn't reveal who has an account.
  return "Email or password is incorrect.";
}

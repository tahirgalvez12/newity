"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/client";

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
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-slate-600">Use the email your manager set up for you.</p>
      </div>
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
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
          className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
      </div>
      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-xs text-slate-500">Forgot your password? Ask your sales manager to reset it.</p>
      {demo && (
        <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3 text-sm">
          <p className="font-medium text-amber-950">Local demo: sign in with one click</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {demo.accounts.map((a) => (
              <button
                key={a.email}
                type="button"
                disabled={pending}
                onClick={() => signIn(a.email, demo.password)}
                className="rounded-md border border-amber-300 bg-white px-2 py-1.5 text-left hover:bg-amber-100 disabled:opacity-60"
              >
                <span className="block font-medium text-slate-900">{a.label}</span>
                <span className="block text-xs text-slate-600">{a.name}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-amber-900">
            Or type any demo email from the README with password <code className="font-mono">{demo.password}</code>.
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

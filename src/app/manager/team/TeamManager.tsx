"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Role } from "@/db/schema";
import { badge, btn, card, input, label } from "@/components/ui";
import { authClient } from "@/lib/auth/client";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  banned: boolean;
  createdAt: string;
  recommendations: number;
}

type Notice = { kind: "ok" | "error"; text: string; password?: string } | null;

/** Readable temp password: no look-alike characters, easy to read out over the phone. */
function generatePassword(length = 14): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function TeamManager({
  members,
  currentUserId,
  minPasswordLength,
}: {
  members: TeamMember[];
  currentUserId: string;
  minPasswordLength: number;
}) {
  const router = useRouter();
  const [notice, setNotice] = useState<Notice>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Better Auth returns { data, error } instead of throwing; normalize to one place for messages.
  async function run(id: string, action: () => Promise<{ error: { message?: string } | null }>, ok: Notice) {
    setBusyId(id);
    setNotice(null);
    const { error } = await action();
    setBusyId(null);
    if (error) {
      setNotice({ kind: "error", text: error.message || "Something went wrong. Try again." });
      return false;
    }
    setNotice(ok);
    router.refresh();
    return true;
  }

  const active = members.filter((m) => !m.banned);
  const counts = { rep: active.filter((m) => m.role === "rep").length, manager: active.filter((m) => m.role === "manager").length };

  return (
    <div className="mt-6 space-y-4">
      <AddMemberForm minPasswordLength={minPasswordLength} run={run} />

      {notice && (
        <div
          role={notice.kind === "error" ? "alert" : "status"}
          className={`rounded-lg border px-4 py-3 text-sm ${notice.kind === "error" ? "border-danger-line bg-danger-soft text-danger" : "border-accent-line bg-accent-soft text-accent"}`}
        >
          {notice.text}
          {notice.password && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              Temporary password:
              <code className="rounded-md border border-line-strong bg-canvas px-2 py-0.5 font-mono text-base text-ink select-all">{notice.password}</code>
              <span className="text-xs text-ink-2">Share it privately. It isn&apos;t shown again; they can change it under their name → Account.</span>
            </div>
          )}
        </div>
      )}

      <section className={`${card} overflow-hidden`}>
        <p className="border-b border-line bg-surface-2/50 px-5 py-3 text-sm text-ink-2">
          {counts.rep} active rep{counts.rep === 1 ? "" : "s"} · {counts.manager} manager{counts.manager === 1 ? "" : "s"}
        </p>
        <div className="relative overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-[11px] uppercase tracking-wider text-ink-3">
              <tr>
                <th className="px-5 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Role</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Recs</th>
                <th className="px-4 py-2.5 font-medium">
                  {/* The table scroll box is `relative` so this absolutely-positioned label is clipped by it
                      instead of widening the whole page on phones. */}
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {members.map((m) => {
                const isMe = m.id === currentUserId;
                const busy = busyId === m.id;
                return (
                  <tr key={m.id} className={`transition-colors hover:bg-surface-2/40 ${m.banned ? "text-ink-3" : ""}`}>
                    <td className="px-5 py-3">
                      <div className={m.banned ? "" : "font-medium text-ink"}>
                        {m.name} {isMe && <span className="text-xs font-normal text-ink-3">(you)</span>}
                      </div>
                      <div className="text-ink-3">{m.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        aria-label={`Role for ${m.name}`}
                        value={m.role}
                        disabled={isMe || busy || m.banned}
                        title={isMe ? "Another manager has to change your role" : undefined}
                        onChange={(e) => {
                          const role = e.target.value as Role;
                          run(m.id, () => authClient.admin.setRole({ userId: m.id, role }), {
                            kind: "ok",
                            text: `${m.name} is now a ${role}.`,
                          });
                        }}
                        className="rounded-md border border-line-strong bg-surface-2 px-2 py-1 text-ink hover:border-ink-3 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="rep">Rep</option>
                        <option value="manager">Manager</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {m.banned ? (
                        <span className={badge.neutral}>Deactivated</span>
                      ) : (
                        <span className={badge.accent}>● Active</span>
                      )}
                    </td>
                    <td className="tabular px-4 py-3 text-right">{m.recommendations}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {!m.banned && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              const password = generatePassword();
                              run(m.id, () => authClient.admin.setUserPassword({ userId: m.id, newPassword: password }), {
                                kind: "ok",
                                text: `Password reset for ${m.name}.`,
                                password,
                              });
                            }}
                            className={btn.secondary}
                          >
                            Reset password
                          </button>
                        )}
                        {!isMe &&
                          (m.banned ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                run(m.id, () => authClient.admin.unbanUser({ userId: m.id }), { kind: "ok", text: `${m.name} can sign in again.` })
                              }
                              className={btn.secondary}
                            >
                              Reactivate
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                if (!window.confirm(`Deactivate ${m.name}? They'll be signed out everywhere. Their history stays.`)) return;
                                run(m.id, () => authClient.admin.banUser({ userId: m.id, banReason: "Deactivated by manager" }), {
                                  kind: "ok",
                                  text: `${m.name} was deactivated and signed out.`,
                                });
                              }}
                              className={btn.danger}
                            >
                              Deactivate
                            </button>
                          ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function AddMemberForm({
  minPasswordLength,
  run,
}: {
  minPasswordLength: number;
  run: (id: string, action: () => Promise<{ error: { message?: string } | null }>, ok: Notice) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("rep");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const password = generatePassword(Math.max(14, minPasswordLength));
    const ok = await run(
      "new",
      () => authClient.admin.createUser({ name: name.trim(), email: email.trim().toLowerCase(), password, role }),
      { kind: "ok", text: `Added ${name.trim()} (${email.trim().toLowerCase()}) as a ${role}.`, password },
    );
    if (ok) {
      setName("");
      setEmail("");
      setRole("rep");
    }
  }

  return (
    <form onSubmit={onSubmit} className={`${card} p-5`}>
      <h2 className="mb-4 font-semibold tracking-tight text-ink">Add a team member</h2>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
        <label className="text-sm">
          <span className={label}>Name</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={input()} />
        </label>
        <label className="text-sm">
          <span className={label}>Work email</span>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={input()}
          />
        </label>
        <label className="text-sm">
          <span className={label}>Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={input()}>
            <option value="rep">Rep</option>
            <option value="manager">Manager</option>
          </select>
        </label>
        <button type="submit" className={`${btn.primary} py-2.5`}>
          Add &amp; create password
        </button>
      </div>
      <p className="mt-2 text-xs text-ink-3">A temporary password is generated for you to share. They can change it after signing in.</p>
    </form>
  );
}

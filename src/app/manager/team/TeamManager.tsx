"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Role } from "@/db/schema";
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
    <div className="mt-6 space-y-6">
      <AddMemberForm minPasswordLength={minPasswordLength} run={run} />

      {notice && (
        <div
          role={notice.kind === "error" ? "alert" : "status"}
          className={`rounded-lg px-4 py-3 text-sm ${notice.kind === "error" ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-900"}`}
        >
          {notice.text}
          {notice.password && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              Temporary password:
              <code className="rounded bg-white px-2 py-0.5 font-mono text-base text-slate-900">{notice.password}</code>
              <span className="text-xs">Share it privately. It isn&apos;t shown again; they can change it under their name → Account.</span>
            </div>
          )}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <p className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
          {counts.rep} active rep{counts.rep === 1 ? "" : "s"} · {counts.manager} manager{counts.manager === 1 ? "" : "s"}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Recs</th>
                <th className="px-4 py-2 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((m) => {
                const isMe = m.id === currentUserId;
                const busy = busyId === m.id;
                return (
                  <tr key={m.id} className={m.banned ? "text-slate-400" : undefined}>
                    <td className="px-4 py-2">
                      <div className={m.banned ? "" : "font-medium text-slate-900"}>
                        {m.name} {isMe && <span className="text-xs font-normal text-slate-500">(you)</span>}
                      </div>
                      <div className="text-slate-500">{m.email}</div>
                    </td>
                    <td className="px-4 py-2">
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
                        className="rounded-md border border-slate-300 bg-white px-2 py-1 disabled:bg-slate-50"
                      >
                        <option value="rep">Rep</option>
                        <option value="manager">Manager</option>
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      {m.banned ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">Deactivated</span>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">Active</span>
                      )}
                    </td>
                    <td className="tabular px-4 py-2 text-right">{m.recommendations}</td>
                    <td className="px-4 py-2">
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
                            className="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-50 disabled:opacity-50"
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
                              className="rounded-md border border-slate-300 px-2 py-1 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
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
                              className="rounded-md border border-red-200 px-2 py-1 text-red-700 hover:bg-red-50 disabled:opacity-50"
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
    <form onSubmit={onSubmit} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 font-semibold">Add a team member</h2>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Name</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Work email</span>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="rounded-lg border border-slate-300 bg-white px-3 py-2">
            <option value="rep">Rep</option>
            <option value="manager">Manager</option>
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
          Add &amp; create password
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">A temporary password is generated for you to share. They can change it after signing in.</p>
    </form>
  );
}

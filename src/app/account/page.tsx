import { Suspense } from "react";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth";
import { requireUser } from "@/lib/auth/session";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { badge, card, pageTitle } from "@/components/ui";

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <Suspense fallback={<p className="text-ink-3">Loading…</p>}>
        <Account />
      </Suspense>
    </div>
  );
}

async function Account() {
  const user = await requireUser();
  return (
    <>
      <h1 className={pageTitle}>Account</h1>
      <dl className={`${card} mt-4 divide-y divide-line text-sm`}>
        <div className="flex justify-between gap-4 px-5 py-3">
          <dt className="text-ink-3">Name</dt>
          <dd className="text-ink">{user.name}</dd>
        </div>
        <div className="flex justify-between gap-4 px-5 py-3">
          <dt className="text-ink-3">Email</dt>
          <dd className="text-ink">{user.email}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-5 py-3">
          <dt className="text-ink-3">Role</dt>
          <dd className={user.role === "manager" ? badge.violet : badge.neutral}>{user.role === "manager" ? "Manager" : "Rep"}</dd>
        </div>
      </dl>
      <ChangePasswordForm minLength={MIN_PASSWORD_LENGTH} />
    </>
  );
}

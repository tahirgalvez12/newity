import { Suspense } from "react";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth";
import { requireUser } from "@/lib/auth/session";
import { ChangePasswordForm } from "./ChangePasswordForm";

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
        <Account />
      </Suspense>
    </div>
  );
}

async function Account() {
  const user = await requireUser();
  return (
    <>
      <h1 className="text-2xl font-semibold">Account</h1>
      <dl className="mt-4 space-y-1 text-sm">
        <div>
          <dt className="inline text-slate-500">Name: </dt>
          <dd className="inline">{user.name}</dd>
        </div>
        <div>
          <dt className="inline text-slate-500">Email: </dt>
          <dd className="inline">{user.email}</dd>
        </div>
        <div>
          <dt className="inline text-slate-500">Role: </dt>
          <dd className="inline">{user.role === "manager" ? "Manager" : "Rep"}</dd>
        </div>
      </dl>
      <ChangePasswordForm minLength={MIN_PASSWORD_LENGTH} />
    </>
  );
}

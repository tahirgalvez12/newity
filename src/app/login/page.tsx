import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/auth/routes";
import { LoginForm } from "./LoginForm";

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="mx-auto mt-16 max-w-sm px-4">
      <Suspense fallback={null}>
        <RedirectIfSignedIn searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function RedirectIfSignedIn({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const user = await getCurrentUser();
  const next = (await searchParams).next;
  const nextPath = safeNextPath(typeof next === "string" ? next : null);
  if (user) redirect(nextPath ?? homeFor(user.role));
  return <LoginForm next={nextPath} />;
}

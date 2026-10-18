import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/auth/routes";
import { LoginForm, type DemoLogins } from "./LoginForm";

/** Local testing aid: only when explicitly enabled in .env AND not a production build. */
function demoLogins(): DemoLogins | null {
  const password = process.env.DEMO_PASSWORD;
  if (process.env.NODE_ENV === "production" || process.env.SHOW_DEMO_LOGINS !== "true" || !password) return null;
  return {
    password,
    accounts: [
      { label: "Rep", name: "Alex Rivera", email: "alex@newity.test" },
      { label: "Manager", name: "Morgan Chen", email: "manager@newity.test" },
    ],
  };
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="mx-auto mt-[10vh] max-w-sm px-4">
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
  return <LoginForm next={nextPath} demo={demoLogins()} />;
}

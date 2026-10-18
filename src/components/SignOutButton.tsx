"use client";

import { authClient } from "@/lib/auth/client";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={async () => {
        await authClient.signOut();
        // Deliberately a full page load, not router.replace: Next keeps recently visited pages
        // alive in the DOM (hidden) and in the client router cache. After sign-out, none of the
        // previous user's pages or state may survive in this tab.
        window.location.replace("/login");
      }}
      className="rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    >
      Sign out
    </button>
  );
}

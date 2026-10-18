"use client";

import { authClient } from "@/lib/auth/client";
import { btn } from "./ui";

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
      className={btn.ghost}
    >
      Sign out
    </button>
  );
}

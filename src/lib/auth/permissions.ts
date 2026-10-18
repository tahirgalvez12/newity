import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/admin/access";

// Shared by server and client so both agree on what each role may do.
// Least privilege: managers run the team (add reps, change roles, deactivate, reset passwords)
// but can't impersonate anyone or hard-delete users (deactivating keeps history intact).
export const ac = createAccessControl(defaultStatements);

export const manager = ac.newRole({
  user: ["create", "list", "set-role", "ban", "set-password", "get", "update"],
  session: ["list", "revoke"],
});

export const rep = ac.newRole({
  user: [],
  session: [],
});

export const roles = { manager, rep };

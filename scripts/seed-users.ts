import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/db";
import { user, type Role } from "../src/db/schema";
import { auth } from "../src/lib/auth";

// Usage: npm run db:seed-users
// Creates the starter accounts (idempotent: existing emails are left alone). All share
// DEMO_PASSWORD from .env. These are local demo accounts only.

export const DEMO_USERS: { name: string; email: string; role: Role }[] = [
  { name: "Morgan Chen", email: "manager@newity.test", role: "manager" },
  { name: "Dana Whitfield", email: "dana.manager@newity.test", role: "manager" },
  { name: "Alex Rivera", email: "alex@newity.test", role: "rep" },
  { name: "Jordan Lee", email: "jordan@newity.test", role: "rep" },
  { name: "Sam Patel", email: "sam@newity.test", role: "rep" },
  { name: "Taylor Brooks", email: "taylor@newity.test", role: "rep" },
  { name: "Casey Nguyen", email: "casey@newity.test", role: "rep" },
  { name: "Riley Adams", email: "riley@newity.test", role: "rep" },
  { name: "Jamie Ortiz", email: "jamie@newity.test", role: "rep" },
  { name: "Chris Howard", email: "chris@newity.test", role: "rep" },
];

async function main() {
  const password = process.env.DEMO_PASSWORD;
  if (!password) throw new Error("DEMO_PASSWORD is not set. Run `npm run setup` or copy .env.example to .env.");

  let created = 0;
  for (const u of DEMO_USERS) {
    const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, u.email));
    if (existing) continue;
    // Same code path the Team page uses, so passwords are hashed and hooks run.
    await auth.api.createUser({ body: { email: u.email, name: u.name, password, role: u.role } });
    created++;
  }
  console.log(`Demo accounts ready (${created} created, ${DEMO_USERS.length - created} already existed).`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

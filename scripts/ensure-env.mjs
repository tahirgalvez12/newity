// Creates .env from .env.example on first setup, and fills in any keys that are missing or
// empty (e.g. after pulling a change that added a new variable). Never overwrites a set value.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const parse = (text) =>
  Object.fromEntries(
    text
      .split("\n")
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );

const example = parse(readFileSync(".env.example", "utf8"));
const created = !existsSync(".env");
let text = created ? "" : readFileSync(".env", "utf8");
const current = parse(text);
const added = [];

for (const [key, fallback] of Object.entries(example)) {
  if (current[key]) continue;
  const value = key === "BETTER_AUTH_SECRET" ? randomBytes(32).toString("base64") : fallback;
  text = key in current ? text.replace(new RegExp(`^${key}=.*$`, "m"), `${key}=${value}`) : `${text.trimEnd()}\n${key}=${value}\n`.trimStart();
  added.push(key);
}

writeFileSync(".env", text);
if (created) console.log("Created .env");
if (added.length) console.log(`Set in .env: ${added.join(", ")}`);

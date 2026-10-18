// Pure route policy shared by proxy.ts and tests. Keep this list short and explicit:
// everything not listed here requires a signed-in user.
const PUBLIC_PATHS = ["/login"];
const PUBLIC_PREFIXES = ["/api/auth/"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

/**
 * Where to send someone after login. Only same-site relative paths are allowed, so a crafted
 * `?next=https://evil.example` link can't bounce a rep to a phishing page.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  if (next.startsWith("/login") || next.startsWith("/api/")) return null;
  return next;
}

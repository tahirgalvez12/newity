import { describe, expect, it } from "vitest";
import { isApiPath, isPublicPath, safeNextPath } from "./routes";

describe("isPublicPath", () => {
  it("allows only the login page and Better Auth's endpoints", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/api/auth/sign-in/email")).toBe(true);
  });

  it.each(["/", "/manager", "/manager/team", "/history", "/account", "/api/recommendations", "/login/extra", "/api/authx"])(
    "requires a session for %s",
    (path) => expect(isPublicPath(path)).toBe(false),
  );
});

describe("isApiPath", () => {
  it("distinguishes API routes from pages", () => {
    expect(isApiPath("/api/recommendations")).toBe(true);
    expect(isApiPath("/apiary")).toBe(false);
  });
});

describe("safeNextPath (open-redirect guard)", () => {
  it("keeps same-site paths with query strings", () => {
    expect(safeNextPath("/?amt=150000&tier=Good")).toBe("/?amt=150000&tier=Good");
    expect(safeNextPath("/manager/team")).toBe("/manager/team");
  });

  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", null, undefined])(
    "rejects %j",
    (next) => expect(safeNextPath(next)).toBeNull(),
  );

  it("doesn't loop back to login or into API routes", () => {
    expect(safeNextPath("/login")).toBeNull();
    expect(safeNextPath("/api/recommendations")).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { homePathForRole } from "./homePath";

/**
 * Where "home" is depends on who is asking, and getting it wrong is not a
 * cosmetic miss: `/dashboard` carries `allowedRoles={["parent"]}`, so sending a
 * school owner there means `ProtectedRoute` bounces them somewhere else
 * entirely. That is exactly what the enrollment-invite claim screen did, to the
 * one person the API bends over backwards to support — a school owner who is
 * also a parent at another school.
 */
describe("homePathForRole", () => {
  it.each([
    ["parent", "/dashboard"],
    ["school_owner", "/school-owner-dashboard"],
    ["owner", "/owner-dashboard"],
  ] as const)("sends a %s to %s", (role, expected) => {
    expect(homePathForRole(role)).toBe(expected);
  });

  it("never sends a school owner to the parent-only dashboard", () => {
    expect(homePathForRole("school_owner")).not.toBe("/dashboard");
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
  ])("falls back to the parent dashboard for %s", (_label, role) => {
    // Not yet loaded, or a role this build does not know. `/dashboard` is the
    // common case and `ProtectedRoute` forwards anyone else to `/home`, which
    // resolves properly once the role is known.
    expect(homePathForRole(role)).toBe("/dashboard");
  });

  it("returns a router path, never a full URL", () => {
    for (const role of ["parent", "school_owner", "owner"] as const) {
      expect(homePathForRole(role).startsWith("/")).toBe(true);
      expect(homePathForRole(role)).not.toContain("#");
    }
  });
});

import { describe, it, expect } from "vitest";
import { resolveAuthMode } from "./platform";

describe("resolveAuthMode (M2 dual-path auth selection)", () => {
  it("always uses bearer in the native shell (cookies unreliable there)", () => {
    expect(resolveAuthMode({ native: true })).toBe("bearer");
    // even if a web build flag leaks through, native must ignore it
    expect(resolveAuthMode({ native: true, webAuthModeEnv: "cookie" })).toBe(
      "bearer",
    );
  });

  it("defaults the web origin to the proven bearer path", () => {
    expect(resolveAuthMode({ native: false })).toBe("bearer");
    expect(resolveAuthMode({ native: false, webAuthModeEnv: "" })).toBe(
      "bearer",
    );
    expect(resolveAuthMode({ native: false, webAuthModeEnv: "anything" })).toBe(
      "bearer",
    );
  });

  it("opts the web origin into cookie mode via VITE_WEB_AUTH_MODE=cookie", () => {
    expect(resolveAuthMode({ native: false, webAuthModeEnv: "cookie" })).toBe(
      "cookie",
    );
  });
});

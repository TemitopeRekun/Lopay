import { describe, it, expect } from "vitest";
import { buildCsp } from "./csp";

describe("buildCsp (SPA CSP smoke check)", () => {
  const csp = buildCsp("https://api.lopay.com");

  it("locks scripts to 'self' + Paystack — no unsafe-inline/eval", () => {
    const scriptSrc = csp
      .split(";")
      .map((d) => d.trim())
      .find((d) => d.startsWith("script-src"));
    expect(scriptSrc).toBe("script-src 'self' https://js.paystack.co");
    expect(scriptSrc).not.toContain("unsafe-inline");
    expect(scriptSrc).not.toContain("unsafe-eval");
  });

  it("derives connect-src (http + ws) from the API origin", () => {
    expect(csp).toContain("https://api.lopay.com");
    expect(csp).toContain("wss://api.lopay.com");
    expect(csp).toContain("https://api.paystack.co");
  });

  it("forbids plugins/objects and locks base-uri/form-action", () => {
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it("does not allow arbitrary third-party CDNs (no aistudiocdn/esm.sh)", () => {
    expect(csp).not.toContain("aistudiocdn");
    expect(csp).not.toContain("esm.sh");
  });
});

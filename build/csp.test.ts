import { describe, it, expect } from "vitest";
import { buildCsp } from "./csp";

describe("buildCsp (SPA CSP smoke check)", () => {
  const STORAGE = "https://project-ref.supabase.co";
  const csp = buildCsp("https://api.lopay.com", STORAGE);

  const connectSrc = (policy: string) =>
    policy
      .split(";")
      .map((d) => d.trim())
      .find((d) => d.startsWith("connect-src"))!;

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

  /**
   * Receipts are PUT straight from the browser to Supabase storage, bypassing
   * the API entirely. Dropping this origin blocks every receipt upload in the
   * built app while `vite dev` — which injects no CSP — keeps working, so the
   * break only ever appears in production.
   */
  it("allows the storage origin so receipt uploads are not blocked", () => {
    expect(connectSrc(csp)).toContain(STORAGE);
  });

  it("omits the storage origin rather than emitting a bogus host", () => {
    for (const bad of [undefined, "", "not-a-url"]) {
      const directive = connectSrc(buildCsp("https://api.lopay.com", bad));
      expect(directive).not.toContain("undefined");
      expect(directive).not.toContain("not-a-url");
      expect(directive).toContain("https://api.lopay.com");
    }
  });

  /**
   * Same failure mode as the storage origin: `getToken()` rejects with an
   * opaque `messaging/token-subscribe-failed` in the built app only, because
   * `vite dev` injects no CSP. Nobody would catch it before users do.
   */
  it("allows the FCM endpoints so web push token registration is not blocked", () => {
    expect(connectSrc(csp)).toContain(
      "https://firebaseinstallations.googleapis.com",
    );
    expect(connectSrc(csp)).toContain(
      "https://fcmregistrations.googleapis.com",
    );
  });

  it("allows the same-origin messaging service worker", () => {
    expect(csp).toContain("worker-src 'self'");
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

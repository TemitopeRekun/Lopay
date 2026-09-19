import { describe, it, expect } from "vitest";
import {
  CLAIM_ROUTE,
  CLAIM_TOKEN_PARAM,
  claimPathFor,
  readClaimToken,
} from "./claimUrl";

/**
 * Mirrors `claim-url.spec.ts` on the server.
 *
 * The literal in the first test is the contract between the two repos: the
 * server mints that string and this app has to be able to route to it. Two
 * earlier drafts could not, and nothing failed — see
 * `claimUrl.hashrouter.test.tsx`, which mounts the real router to close that
 * gap. Keep the literal here in step with the server's.
 */
describe("claimUrl", () => {
  const TOKEN = "Zm9vYmFyLXRva2VuLTEyMzQ1Njc4OTBhYmNkZWZnaGk";
  const SERVER_MINTS = `https://app.lopay.test/#/claim-invite?token=${TOKEN}`;

  it("agrees with the URL the server mints", () => {
    // Mirrored in lopay-backend/src/enrollment-invites/claim-url.spec.ts.
    expect(readClaimToken(SERVER_MINTS)).toBe(TOKEN);
    expect(SERVER_MINTS).toContain(`#${claimPathFor(TOKEN)}`);
  });

  describe("readClaimToken", () => {
    it("decodes a token carrying URL-significant characters", () => {
      expect(readClaimToken("https://app/#/claim-invite?token=a%26b%3Dc+d")).toBe(
        "a&b=c d",
      );
    });

    it("ignores other parameters in the fragment", () => {
      expect(
        readClaimToken(`https://app/#/claim-invite?ref=whatsapp&token=${TOKEN}`),
      ).toBe(TOKEN);
      expect(readClaimToken("https://app/#/claim-invite?ref=whatsapp")).toBeNull();
    });

    it.each([
      ["an empty string", ""],
      ["undefined", undefined],
      ["null", null],
      ["a bare hash", "#"],
      ["a fragment with no query", "https://app/#/claim-invite"],
      ["a URL with no fragment", "https://app/claim-invite"],
    ])("reads no token from %s", (_label, input) => {
      expect(readClaimToken(input)).toBeNull();
    });

    it("refuses a token in the REAL query string", () => {
      // That shape neither routes under HashRouter nor keeps the credential off
      // the wire. Tolerating it here would hide both faults.
      expect(readClaimToken("https://app/claim-invite?token=abc")).toBeNull();
    });
  });

  describe("claimPathFor", () => {
    it("builds the in-app route path for a held token", () => {
      expect(claimPathFor(TOKEN)).toBe(`${CLAIM_ROUTE}?${CLAIM_TOKEN_PARAM}=${TOKEN}`);
    });

    it("encodes a token containing URL-significant characters", () => {
      expect(claimPathFor("a&b=c d")).toBe("/claim-invite?token=a%26b%3Dc+d");
    });

    it("is a router path, not a URL", () => {
      // `navigate()` places it after the `#` itself, so it must not carry one.
      expect(claimPathFor(TOKEN)).not.toContain("#");
      expect(claimPathFor(TOKEN).startsWith("/")).toBe(true);
    });
  });
});

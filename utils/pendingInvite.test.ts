import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  clearPendingInvite,
  peekPendingInvite,
  pendingInvitePath,
  rememberPendingInvite,
} from "./pendingInvite";

/**
 * The token is a bearer credential held briefly across a sign-up round trip, so
 * these pin the properties that keep that acceptable: reading it is pure (the
 * caller that decides a redirect does so during render, and a render that
 * mutates storage misbehaves under StrictMode), clearing is explicit and
 * happens once the token has been used, and every access survives storage being
 * unavailable. The last is not hypothetical — `sessionStorage` throws outright
 * in some in-app browsers and when a user has blocked site data, and a parent
 * in that state must still be able to read their invite.
 */
describe("pendingInvite", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("round-trips a token", () => {
    rememberPendingInvite("token-abc");
    expect(peekPendingInvite()).toBe("token-abc");
  });

  it("peeks without consuming, so repeated renders agree", () => {
    rememberPendingInvite("token-abc");

    expect(peekPendingInvite()).toBe("token-abc");
    expect(peekPendingInvite()).toBe("token-abc");
    expect(peekPendingInvite()).toBe("token-abc");
  });

  it("stops yielding the token once it has been cleared", () => {
    rememberPendingInvite("token-abc");
    clearPendingInvite();

    expect(peekPendingInvite()).toBeNull();
  });

  it("returns null when nothing is held", () => {
    expect(peekPendingInvite()).toBeNull();
  });

  it("ignores an empty token rather than storing a blank", () => {
    rememberPendingInvite("");
    expect(peekPendingInvite()).toBeNull();
  });

  it("clears on demand", () => {
    rememberPendingInvite("token-abc");
    clearPendingInvite();
    expect(peekPendingInvite()).toBeNull();
  });

  it("uses sessionStorage, not localStorage", () => {
    // localStorage would survive the tab and a browser restart, turning a
    // transient credential into a durable one on a possibly shared phone.
    rememberPendingInvite("token-abc");
    expect(window.localStorage.getItem("lopay:pendingInviteToken")).toBeNull();
  });

  describe("when storage throws", () => {
    it("does not throw on write", () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("blocked");
      });
      expect(() => rememberPendingInvite("token-abc")).not.toThrow();
    });

    it("reads as absent rather than throwing", () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("blocked");
      });
      expect(peekPendingInvite()).toBeNull();
    });

    it("does not throw on clear", () => {
      vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
        throw new Error("blocked");
      });
      expect(() => clearPendingInvite()).not.toThrow();
    });
  });

  describe("pendingInvitePath", () => {
    it("builds the in-app route path for a held token", () => {
      // A router path, not a URL: `navigate()` places it after the `#` itself,
      // which is how the token stays inside the fragment. See utils/claimUrl.ts.
      expect(pendingInvitePath("abc123")).toBe("/claim-invite?token=abc123");
      expect(pendingInvitePath("abc123")).not.toContain("#");
    });

    it("encodes a token containing URL-significant characters", () => {
      // base64url never produces these, but the resume path must not be the
      // place a malformed token turns into a broken URL or an injected param.
      expect(pendingInvitePath("a&b=c d")).toBe(
        "/claim-invite?token=a%26b%3Dc+d",
      );
    });
  });
});

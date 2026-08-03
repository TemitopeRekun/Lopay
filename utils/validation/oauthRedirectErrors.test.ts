import { describe, it, expect } from "vitest";
import {
  mapOAuthRedirectError,
  readHashQueryParam,
} from "./oauthRedirectErrors";
import { FIELD_ERROR_CODES } from "./codes";

describe("readHashQueryParam", () => {
  // The app uses HashRouter, so Better Auth's `?error=` lands INSIDE the fragment
  // (`#/profile?error=x`) and `window.location.search` is empty. Reading the wrong
  // one is a silent no-op — precisely the failure being fixed — so this is pinned.
  it("reads a param from inside the hash fragment", () => {
    expect(readHashQueryParam("#/profile?error=account_not_linked", "error")).toBe(
      "account_not_linked",
    );
  });

  it("reads a param that is not first", () => {
    expect(
      readHashQueryParam("#/profile?state=x&error=no_code", "error"),
    ).toBe("no_code");
  });

  it("returns null when the fragment has no query", () => {
    expect(readHashQueryParam("#/profile", "error")).toBeNull();
  });

  it("returns null for an empty hash", () => {
    expect(readHashQueryParam("", "error")).toBeNull();
  });

  it("returns null when the param is absent", () => {
    expect(readHashQueryParam("#/profile?state=x", "error")).toBeNull();
  });

  it("decodes a percent-encoded value", () => {
    expect(readHashQueryParam("#/profile?error=a%20b", "error")).toBe("a b");
  });
});

describe("mapOAuthRedirectError", () => {
  it("returns null when there is no error — the success path", () => {
    expect(mapOAuthRedirectError(null)).toBeNull();
    expect(mapOAuthRedirectError(undefined)).toBeNull();
    expect(mapOAuthRedirectError("")).toBeNull();
  });

  // The refusal this whole feature exists for. It must not read as a generic
  // apology: the parent needs to be told that signing in with a password and
  // connecting from the profile is the way through.
  it("turns account_not_linked into actionable wording", () => {
    const mapped = mapOAuthRedirectError("account_not_linked");
    expect(mapped?.code).toBe(FIELD_ERROR_CODES.GOOGLE_LINK_FROM_PROFILE);
    expect(mapped?.message).toMatch(/connect Google from your profile/i);
  });

  it("maps an email mismatch, in both spellings the library uses", () => {
    expect(mapOAuthRedirectError("email_doesn_t_match")?.code).toBe(
      FIELD_ERROR_CODES.GOOGLE_EMAIL_MISMATCH,
    );
    expect(mapOAuthRedirectError("email_doesn't_match")?.code).toBe(
      FIELD_ERROR_CODES.GOOGLE_EMAIL_MISMATCH,
    );
  });

  it("maps a Google identity already attached to someone else", () => {
    expect(
      mapOAuthRedirectError("account_already_linked_to_different_user")?.code,
    ).toBe(FIELD_ERROR_CODES.GOOGLE_ALREADY_LINKED);
  });

  it("maps state failures to a retry, not a permanent error", () => {
    for (const code of ["state_mismatch", "state_not_found", "no_code"]) {
      expect(mapOAuthRedirectError(code)?.code).toBe(
        FIELD_ERROR_CODES.GOOGLE_RETRY,
      );
    }
  });

  it("distinguishes the user cancelling from a real failure", () => {
    expect(mapOAuthRedirectError("access_denied")?.code).toBe(
      FIELD_ERROR_CODES.GOOGLE_CANCELLED,
    );
  });

  it("is case-insensitive and tolerates whitespace", () => {
    expect(mapOAuthRedirectError("  ACCESS_DENIED  ")?.code).toBe(
      FIELD_ERROR_CODES.GOOGLE_CANCELLED,
    );
  });

  // Better Auth may add codes. Rendering nothing for an unknown one would recreate
  // the silent-failure bug in a new place, so unknown still produces a message.
  it("still produces a message for an unrecognised code", () => {
    const mapped = mapOAuthRedirectError("something_new_entirely");
    expect(mapped).not.toBeNull();
    expect(mapped?.message).toBeTruthy();
  });
});

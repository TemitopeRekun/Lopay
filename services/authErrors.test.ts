import { describe, it, expect } from "vitest";
import { AuthClientError, throwIfError } from "./authErrors";
import { mapServerError } from "../utils/validation/serverErrors";
import { FIELD_ERROR_CODES } from "../utils/validation/codes";

describe("AuthClientError", () => {
  it("carries the server code and status as properties", () => {
    const err = new AuthClientError(
      { code: "LINKING_FAILED", message: "nope", status: 417 },
      "fallback",
    );
    expect(err.code).toBe("LINKING_FAILED");
    expect(err.status).toBe(417);
    expect(err.message).toBe("nope");
  });

  it("falls back to the supplied message when the server sent none", () => {
    expect(new AuthClientError({ code: "X" }, "fallback").message).toBe(
      "fallback",
    );
  });

  it("tolerates a null error", () => {
    const err = new AuthClientError(null, "fallback");
    expect(err.message).toBe("fallback");
    expect(err.code).toBeUndefined();
  });

  it("is a real Error, so existing catch sites keep working", () => {
    expect(new AuthClientError({}, "x")).toBeInstanceOf(Error);
  });

  // The reason `code`/`status` are properties rather than baked into the message:
  // mapServerError reads exactly these, and a bare `new Error(message)` would push
  // every Google failure through the generic fallback.
  it("survives mapServerError with its specific message intact", () => {
    const err = new AuthClientError(
      { code: "LINKING_DIFFERENT_EMAILS_NOT_ALLOWED" },
      "fallback",
    );
    const mapped = mapServerError(err, FIELD_ERROR_CODES.GOOGLE_LINK_FAILED);
    expect(mapped.error.code).toBe(FIELD_ERROR_CODES.GOOGLE_EMAIL_MISMATCH);
    expect(mapped.error.message).toContain("different email address");
  });
});

describe("throwIfError", () => {
  it("throws when the result carries an error", () => {
    expect(() => throwIfError({ error: { code: "BOOM" } }, "fallback")).toThrow(
      AuthClientError,
    );
  });

  it("stays silent on success", () => {
    expect(() => throwIfError({ error: null }, "fallback")).not.toThrow();
    expect(() => throwIfError({}, "fallback")).not.toThrow();
    expect(() => throwIfError(undefined, "fallback")).not.toThrow();
  });

  // This is the exact live failure: Google's client id/secret are unset, the server
  // answers 500 CLIENT_ID_AND_SECRET_REQUIRED, and the old code discarded it.
  it("surfaces the unconfigured-Google failure as a usable message", () => {
    try {
      throwIfError(
        {
          error: {
            code: "CLIENT_ID_AND_SECRET_REQUIRED",
            status: 500,
            message: "Client Id and Client Secret is required for Google.",
          },
        },
        "fallback",
      );
      expect.unreachable("should have thrown");
    } catch (e) {
      const mapped = mapServerError(e, FIELD_ERROR_CODES.UNKNOWN_ERROR);
      expect(mapped.error.code).toBe(FIELD_ERROR_CODES.GOOGLE_UNAVAILABLE);
      // Tells the user the way in that still works, rather than that a button broke.
      expect(mapped.error.message).toContain("email and password");
    }
  });
});

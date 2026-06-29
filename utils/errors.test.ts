import { describe, it, expect } from "vitest";
import { getErrorMessage } from "./errors";

describe("getErrorMessage", () => {
  it("reads .message off an Error", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("returns a non-empty string as-is", () => {
    expect(getErrorMessage("nope")).toBe("nope");
  });

  it("reads a string .message off a plain object (e.g. an API body)", () => {
    expect(getErrorMessage({ message: "api said no" })).toBe("api said no");
  });

  it("falls back for null / empty / non-string-message values", () => {
    expect(getErrorMessage(null)).toBe("Something went wrong");
    expect(getErrorMessage({}, "fallback")).toBe("fallback");
    expect(getErrorMessage("", "fb")).toBe("fb");
    expect(getErrorMessage({ message: 123 }, "fb")).toBe("fb");
  });
});

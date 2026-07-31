import { describe, it, expect } from "vitest";
import { normalizePhone, isValidPhone, validatePhone } from "./phone";

describe("normalizePhone", () => {
  it("strips spaces and dashes", () => {
    expect(normalizePhone("0801 234 5678")).toBe("08012345678");
    expect(normalizePhone("0801-234-5678")).toBe("08012345678");
    expect(normalizePhone("+234 801-234 5678")).toBe("+2348012345678");
  });

  it("leaves an already-clean number untouched", () => {
    expect(normalizePhone("08012345678")).toBe("08012345678");
  });

  it("returns an empty string for blank/whitespace input", () => {
    expect(normalizePhone("")).toBe("");
    expect(normalizePhone("   ")).toBe("");
  });
});

describe("isValidPhone", () => {
  it.each([
    ["local 0-prefix", "08012345678"],
    ["local with formatting", "0801 234-5678"],
    ["country code, no plus", "2348012345678"],
    ["country code, with plus", "+2348012345678"],
    ["country code, formatted", "+234 801 234 5678"],
  ])("accepts %s", (_label, input) => {
    expect(isValidPhone(input)).toBe(true);
  });

  it.each([
    ["empty", ""],
    ["too short", "080123456"],
    ["too long", "080123456789"],
    ["missing trunk prefix", "8012345678"],
    ["letters", "0801234567a"],
    ["wrong country code", "+1801234567"],
    ["plus on a local number", "+08012345678"],
    ["internal punctuation that isn't stripped", "0801.234.5678"],
  ])("rejects %s", (_label, input) => {
    expect(isValidPhone(input)).toBe(false);
  });
});

describe("validatePhone", () => {
  it("returns null for a valid number", () => {
    expect(validatePhone("08012345678")).toBeNull();
    expect(validatePhone("+2348012345678")).toBeNull();
  });

  it("reports blank input as missing, not malformed", () => {
    expect(validatePhone("")).toBe(
      "Phone number is required for contact updates.",
    );
    expect(validatePhone("  -  ")).toBe(
      "Phone number is required for contact updates.",
    );
  });

  it("reports a malformed number with an example", () => {
    expect(validatePhone("12345")).toBe(
      "Enter a valid phone number (e.g. 08012345678).",
    );
  });
});

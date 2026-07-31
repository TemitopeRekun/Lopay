import { describe, it, expect } from "vitest";
import {
  normalizePhone,
  isValidPhone,
  validatePhone,
  canonicalizePhone,
  formatPhoneForDisplay,
} from "./phone";

describe("normalizePhone", () => {
  it("strips spaces and dashes", () => {
    expect(normalizePhone("0801 234 5678")).toBe("08012345678");
    expect(normalizePhone("0801-234-5678")).toBe("08012345678");
    expect(normalizePhone("+234 801-234 5678")).toBe("+2348012345678");
  });

  // Widened to match lopay-backend/src/common/phone.ts: the two must agree, or
  // the client accepts a number the server then rejects (or vice versa).
  it("also strips dots and parentheses", () => {
    expect(normalizePhone("0801.234.5678")).toBe("08012345678");
    expect(normalizePhone("(0801) 234-5678")).toBe("08012345678");
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
  ])("rejects %s", (_label, input) => {
    expect(isValidPhone(input)).toBe(false);
  });

  it("accepts dot- and paren-formatted numbers now that they are stripped", () => {
    expect(isValidPhone("0801.234.5678")).toBe(true);
    expect(isValidPhone("(0801)234-5678")).toBe(true);
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

  // The copy asks for the plain 11-digit number and deliberately does NOT
  // mention +234 — a +234 number is still accepted, but naming it reads as an
  // instruction to add a country code, which is not what most parents should do.
  it("reports a malformed number by asking for the 11-digit form", () => {
    expect(validatePhone("12345")).toBe(
      "Enter your 11-digit phone number, starting with 0 (e.g. 08012345678).",
    );
  });

  it("does not mention a country code in the error copy", () => {
    expect(validatePhone("12345")).not.toContain("+234");
  });
});

describe("canonicalizePhone", () => {
  it("folds every accepted spelling to one +234 form", () => {
    const spellings = [
      "08012345678",
      "0801 234-5678",
      "0801.234.5678",
      "+2348012345678",
      "2348012345678",
      "+234 801 234 5678",
    ];
    const canonical = new Set(spellings.map(canonicalizePhone));
    expect(canonical).toEqual(new Set(["+2348012345678"]));
  });

  it("returns null for an invalid number", () => {
    expect(canonicalizePhone("0801234567")).toBeNull();
    expect(canonicalizePhone("")).toBeNull();
    expect(canonicalizePhone("abc")).toBeNull();
  });

  // Must match lopay-backend/src/common/phone.ts exactly: this is the string the
  // server hashes for its uniqueness check.
  it("produces the shape the server stores", () => {
    expect(canonicalizePhone("08012345678")).toBe("+2348012345678");
  });
});

describe("formatPhoneForDisplay", () => {
  it("shows the local 11-digit form parents recognise", () => {
    expect(formatPhoneForDisplay("+2348012345678")).toBe("08012345678");
  });

  it("is the inverse of canonicalizePhone for a local number", () => {
    const canonical = canonicalizePhone("08012345678");
    expect(formatPhoneForDisplay(canonical!)).toBe("08012345678");
  });

  it("returns the input unchanged when it cannot be parsed", () => {
    expect(formatPhoneForDisplay("not-a-number")).toBe("not-a-number");
  });
});

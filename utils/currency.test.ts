import { describe, it, expect } from "vitest";
import { formatNaira } from "./currency";

describe("formatNaira", () => {
  it("formats whole naira with grouping and the ₦ symbol", () => {
    expect(formatNaira(1500)).toBe("₦1,500");
    expect(formatNaira(1_000_000)).toBe("₦1,000,000");
    expect(formatNaira(0)).toBe("₦0");
  });

  it("formats with 2 decimals when requested", () => {
    expect(formatNaira(1187.5, 2)).toBe("₦1,187.50");
  });

  it("treats non-finite input as 0", () => {
    expect(formatNaira(Number.NaN)).toBe("₦0");
    expect(formatNaira(Number.POSITIVE_INFINITY)).toBe("₦0");
  });
});

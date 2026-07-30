import { describe, it, expect, afterEach, vi } from "vitest";
import { newIdempotencyKey } from "./idempotency";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("newIdempotencyKey", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses crypto.randomUUID when it is available", () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "11111111-2222-4333-8444-555555555555",
    );
    expect(newIdempotencyKey()).toBe("11111111-2222-4333-8444-555555555555");
  });

  it("builds a v4 UUID from getRandomValues when randomUUID is missing", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) arr[i] = i;
        return arr;
      },
    });

    const key = newIdempotencyKey();
    expect(key).toMatch(UUID_V4);
    // Deterministic fill → the version/variant nibbles are set correctly.
    expect(key).toBe("00010203-0405-4607-8809-0a0b0c0d0e0f");
  });

  it("falls back to a timestamped key with no Web Crypto at all", () => {
    vi.stubGlobal("crypto", undefined);

    const a = newIdempotencyKey();
    const b = newIdempotencyKey();

    expect(a).toMatch(/^idem-/);
    expect(b).toMatch(/^idem-/);
    // Monotonic counter + random segments guarantee uniqueness across calls.
    expect(a).not.toBe(b);
  });
});

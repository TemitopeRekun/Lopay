/**
 * Generate a unique idempotency key for a payment/enrollment submission.
 *
 * The key is created once per "payment intent" (e.g. when a confirm screen
 * mounts) and reused across every retry of that same submission, so the
 * backend can dedupe duplicates (double-tap, network retry) — see
 * lopay-backend enrollment.service.ts.
 */
// Monotonic counter so the last-resort fallback can never collide with itself,
// even across multiple calls within the same millisecond.
let fallbackCounter = 0;

export const newIdempotencyKey = (): string => {
  const cryptoObj =
    typeof globalThis !== "undefined"
      ? (globalThis.crypto as Crypto | undefined)
      : undefined;

  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID();
  }

  // Strong fallback for environments with Web Crypto but no randomUUID
  // (e.g. some older mobile WebViews): build a v4 UUID from getRandomValues.
  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
      "",
    );
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // Last-resort fallback (no Web Crypto at all). Combine the timestamp, a
  // monotonic counter, and two random segments so that even rapid calls within
  // the same millisecond produce distinct keys.
  fallbackCounter = (fallbackCounter + 1) % Number.MAX_SAFE_INTEGER;
  const rand = () => Math.random().toString(36).slice(2, 12);
  return `idem-${Date.now().toString(36)}-${fallbackCounter.toString(36)}-${rand()}-${rand()}`;
};

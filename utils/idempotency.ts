/**
 * Generate a unique idempotency key for a payment/enrollment submission.
 *
 * The key is created once per "payment intent" (e.g. when a confirm screen
 * mounts) and reused across every retry of that same submission, so the
 * backend can dedupe duplicates (double-tap, network retry) — see
 * lopay-backend enrollment.service.ts.
 */
export const newIdempotencyKey = (): string => {
  const cryptoObj =
    typeof globalThis !== "undefined"
      ? (globalThis.crypto as Crypto | undefined)
      : undefined;

  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID();
  }

  // Fallback for environments without crypto.randomUUID.
  return `idem-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
};

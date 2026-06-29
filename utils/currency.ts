/**
 * Format a Naira amount for display. API responses are already in naira (the
 * backend converts kobo→naira at its boundary), so this is purely presentational.
 *
 * @example formatNaira(1500)        // "₦1,500"
 * @example formatNaira(1187.5, 2)   // "₦1,187.50"
 */
export function formatNaira(amount: number, decimals = 0): string {
  const value = Number.isFinite(amount) ? amount : 0;
  return `₦${value.toLocaleString("en-NG", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

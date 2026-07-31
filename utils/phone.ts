/**
 * Nigerian phone number handling, shared by sign-up, the profile screen and the
 * first-payment flow so all three agree on what a valid number looks like (the
 * rule used to live inline in AuthScreen only).
 *
 * Accepted shapes, ignoring spaces and dashes:
 *   08012345678 · 0801 234 5678 · +2348012345678 · 2348012345678
 */

const PHONE_PATTERN = /^(\+?234|0)\d{10}$/;

const REQUIRED_MESSAGE = "Phone number is required for contact updates.";
const INVALID_MESSAGE = "Enter a valid phone number (e.g. 08012345678).";

/**
 * Strip display formatting so a typed number can be validated and stored in one
 * consistent shape.
 *
 * @example normalizePhone("0801 234-5678") // "08012345678"
 */
export function normalizePhone(raw: string): string {
  return raw.replace(/[\s-]/g, "");
}

/**
 * @example isValidPhone("+234 801 234 5678") // true
 * @example isValidPhone("801234567")         // false
 */
export function isValidPhone(raw: string): boolean {
  return PHONE_PATTERN.test(normalizePhone(raw));
}

/**
 * Validation message for a phone input, or `null` when it is acceptable. Blank
 * input reports as missing rather than malformed, so a parent who simply hasn't
 * filled the field in yet gets the friendlier prompt.
 *
 * @example validatePhone("08012345678") // null
 * @example validatePhone("")            // "Phone number is required for contact updates."
 */
export function validatePhone(raw: string): string | null {
  if (!normalizePhone(raw)) return REQUIRED_MESSAGE;
  if (!isValidPhone(raw)) return INVALID_MESSAGE;
  return null;
}

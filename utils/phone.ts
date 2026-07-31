/**
 * Nigerian phone number handling, shared by sign-up, the profile screen and the
 * first-payment flow so all three agree on what a valid number looks like (the
 * rule used to live inline in AuthScreen only).
 *
 * Accepted shapes, ignoring spaces, dashes, dots and parentheses:
 *   08012345678 · 0801 234 5678 · +2348012345678 · 2348012345678
 *
 * Note the asymmetry between what is ACCEPTED and what the UI ASKS FOR: all four
 * spellings are valid input, but the label, placeholder and error copy all ask for
 * the plain 11-digit local number, because that is what most parents type and
 * naming `+234` reads as an instruction to add a country code.
 *
 * Mirrors `lopay-backend/src/common/phone.ts` — the two must agree, or the client
 * will accept a number the server then rejects.
 */

const PHONE_PATTERN = /^(\+?234|0)\d{10}$/;

/** Ten significant digits behind a `0` or `+234` / `234` prefix. */
const NIGERIA_LOCAL = /^0(\d{10})$/;
const NIGERIA_INTERNATIONAL = /^(?:\+?234)(\d{10})$/;

const REQUIRED_MESSAGE = "Phone number is required for contact updates.";
const INVALID_MESSAGE =
  "Enter your 11-digit phone number, starting with 0 (e.g. 08012345678).";

/**
 * Strip display formatting so a typed number can be validated and stored in one
 * consistent shape.
 *
 * @example normalizePhone("0801 234-5678") // "08012345678"
 */
export function normalizePhone(raw: string): string {
  return raw.replace(/[\s\-.()]/g, "");
}

/**
 * @example isValidPhone("+234 801 234 5678") // true
 * @example isValidPhone("801234567")         // false
 */
export function isValidPhone(raw: string): boolean {
  return PHONE_PATTERN.test(normalizePhone(raw));
}

/**
 * Reduce every accepted spelling of a number to ONE representation: `+234` plus
 * the ten significant digits. Returns `null` for an invalid number.
 *
 * This is the form the server stores and the form its uniqueness check is made
 * against, so the client uses it too — otherwise the "already registered" check
 * would depend on how the parent happened to type their number.
 *
 * @example canonicalizePhone("08012345678")    // "+2348012345678"
 * @example canonicalizePhone("+234 801 234 5678") // "+2348012345678"
 */
export function canonicalizePhone(raw: string): string | null {
  const normalized = normalizePhone(raw);
  const significant =
    NIGERIA_LOCAL.exec(normalized)?.[1] ??
    NIGERIA_INTERNATIONAL.exec(normalized)?.[1];
  return significant ? `+234${significant}` : null;
}

/**
 * Format a stored number for display, preferring the local 11-digit form parents
 * recognise over the `+234` shape the database holds.
 *
 * @example formatPhoneForDisplay("+2348012345678") // "08012345678"
 */
export function formatPhoneForDisplay(raw: string): string {
  const canonical = canonicalizePhone(raw);
  if (!canonical) return raw;
  return `0${canonical.slice(4)}`;
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

/**
 * The single vocabulary of things that can be wrong with the sign-up / sign-in
 * form, and the sentence shown for each.
 *
 * ## The pattern
 *
 * A validation failure is a `{ field, code }` pair, never a bare string. Nothing
 * in the app builds an error message by concatenation, and nothing decides *where*
 * a message goes by inspecting its text. That buys three things:
 *
 *  - **Inline placement is automatic.** `code → field` is a lookup, so an error
 *    raised by the client and an error raised by the server land under the same
 *    input with no extra wiring.
 *  - **Copy is editable in one place.** Rewording "email already used" is an edit
 *    to `FIELD_ERROR_MESSAGES`, not a hunt through screens.
 *  - **Tests assert on codes.** `expect(errors.email?.code).toBe('EMAIL_ALREADY_REGISTERED')`
 *    keeps passing when the wording changes, which is what lets the copy stay
 *    editable.
 *
 * ## Mirrors the server
 *
 * `NAME_REQUIRED`, `NAME_LENGTH`, `PHONE_INVALID` and `PHONE_ALREADY_REGISTERED`
 * are also emitted by the backend (`src/common/auth-error-codes.ts`) — the same
 * spelling on both sides, so a server rejection needs no translation. The rest are
 * client-only (things we can check before a request) or transport-level.
 */

/** Every input the auth form owns, plus `form` for errors that belong to no field. */
export type FieldName =
  | 'fullName'
  | 'email'
  | 'phoneNumber'
  | 'password'
  | 'confirmPassword'
  | 'form';

export const FIELD_ERROR_CODES = {
  // ── Name ───────────────────────────────────────────────────────────────────
  NAME_REQUIRED: 'NAME_REQUIRED',
  NAME_LENGTH: 'NAME_LENGTH',

  // ── Email ──────────────────────────────────────────────────────────────────
  EMAIL_REQUIRED: 'EMAIL_REQUIRED',
  EMAIL_INVALID: 'EMAIL_INVALID',
  EMAIL_TOO_LONG: 'EMAIL_TOO_LONG',
  /** The server told us this address already has an account. */
  EMAIL_ALREADY_REGISTERED: 'EMAIL_ALREADY_REGISTERED',

  // ── Phone ──────────────────────────────────────────────────────────────────
  PHONE_REQUIRED: 'PHONE_REQUIRED',
  PHONE_INVALID: 'PHONE_INVALID',
  /** The server told us this number already belongs to another account. */
  PHONE_ALREADY_REGISTERED: 'PHONE_ALREADY_REGISTERED',

  // ── Password ───────────────────────────────────────────────────────────────
  PASSWORD_REQUIRED: 'PASSWORD_REQUIRED',
  PASSWORD_TOO_SHORT: 'PASSWORD_TOO_SHORT',
  PASSWORD_TOO_LONG: 'PASSWORD_TOO_LONG',
  PASSWORD_NEEDS_LETTER_AND_NUMBER: 'PASSWORD_NEEDS_LETTER_AND_NUMBER',
  PASSWORD_CONTAINS_PERSONAL_INFO: 'PASSWORD_CONTAINS_PERSONAL_INFO',

  // ── Confirm password ───────────────────────────────────────────────────────
  CONFIRM_PASSWORD_REQUIRED: 'CONFIRM_PASSWORD_REQUIRED',
  PASSWORD_MISMATCH: 'PASSWORD_MISMATCH',

  // ── Whole-form / transport ─────────────────────────────────────────────────
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  /** Google sign-in is misconfigured or unavailable server-side. */
  GOOGLE_UNAVAILABLE: 'GOOGLE_UNAVAILABLE',
  /** The Google account offered belongs to a different email address. */
  GOOGLE_EMAIL_MISMATCH: 'GOOGLE_EMAIL_MISMATCH',
  /** That Google identity is already attached to another LOPAY account. */
  GOOGLE_ALREADY_LINKED: 'GOOGLE_ALREADY_LINKED',
  /** Linking failed for a reason we can't attribute to one cause. */
  GOOGLE_LINK_FAILED: 'GOOGLE_LINK_FAILED',
  /** Sign-in can't link Google to an unverified account — do it from the profile. */
  GOOGLE_LINK_FROM_PROFILE: 'GOOGLE_LINK_FROM_PROFILE',
  /** OAuth state was lost or tampered with; starting again is the only fix. */
  GOOGLE_RETRY: 'GOOGLE_RETRY',
  /** The user declined at Google's consent screen. */
  GOOGLE_CANCELLED: 'GOOGLE_CANCELLED',
  RATE_LIMITED: 'RATE_LIMITED',
  NETWORK_UNAVAILABLE: 'NETWORK_UNAVAILABLE',
  SERVER_ERROR: 'SERVER_ERROR',
  SIGNUP_FAILED: 'SIGNUP_FAILED',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type FieldErrorCode =
  (typeof FIELD_ERROR_CODES)[keyof typeof FIELD_ERROR_CODES];

/** A validation failure: which input, why, and what to show. */
export interface FieldError {
  code: FieldErrorCode;
  message: string;
}

/** Errors keyed by the input they belong under. */
export type FormErrors = Partial<Record<FieldName, FieldError>>;

/** Password bounds. The minimum matches Better Auth's server-side
 * `minPasswordLength: 8` exactly — a lower value here would produce a password
 * the server then rejects with a less helpful message. */
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;
export const MIN_NAME_LENGTH = 2;
export const MAX_NAME_LENGTH = 80;
/** Practical ceiling for an email address (RFC 5321 caps the path at 256). */
export const MAX_EMAIL_LENGTH = 254;

/**
 * The copy. Written to tell the parent what to DO, not to restate the rule —
 * "Enter your 11-digit phone number" rather than "Phone number is invalid".
 */
export const FIELD_ERROR_MESSAGES: Record<FieldErrorCode, string> = {
  NAME_REQUIRED: 'Enter your full name.',
  NAME_LENGTH: `Your name must be between ${MIN_NAME_LENGTH} and ${MAX_NAME_LENGTH} characters.`,

  EMAIL_REQUIRED: 'Enter your email address.',
  EMAIL_INVALID: 'Enter a valid email address, like name@email.com.',
  EMAIL_TOO_LONG: 'That email address is too long.',
  EMAIL_ALREADY_REGISTERED:
    'This email already has a LOPAY account. Sign in instead.',

  PHONE_REQUIRED: 'Enter your phone number.',
  // Deliberately asks for the plain 11-digit number. A +234 number is still
  // accepted — but naming it here would read as an instruction to add a country
  // code, which is not what we want most parents to type.
  PHONE_INVALID:
    'Enter your 11-digit phone number, starting with 0 (e.g. 08012345678).',
  PHONE_ALREADY_REGISTERED:
    'This phone number is already linked to another account.',

  PASSWORD_REQUIRED: 'Choose a password.',
  PASSWORD_TOO_SHORT: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
  PASSWORD_TOO_LONG: `Use ${MAX_PASSWORD_LENGTH} characters or fewer.`,
  PASSWORD_NEEDS_LETTER_AND_NUMBER:
    'Include at least one letter and one number.',
  PASSWORD_CONTAINS_PERSONAL_INFO:
    "Don't use your name or email in your password.",

  CONFIRM_PASSWORD_REQUIRED: 'Re-enter your password to confirm it.',
  PASSWORD_MISMATCH: "Both passwords must match. Check for typos.",

  INVALID_CREDENTIALS: 'That email and password combination is incorrect.',
  // Names email/password explicitly: when Google is down, the useful thing to tell
  // someone is the way in that still works, not that a button is broken.
  GOOGLE_UNAVAILABLE:
    "Google sign-in isn't available right now. Use your email and password instead.",
  GOOGLE_EMAIL_MISMATCH:
    'That Google account uses a different email address than your LOPAY account.',
  GOOGLE_ALREADY_LINKED:
    'That Google account is already connected to another LOPAY account.',
  GOOGLE_LINK_FAILED:
    "We couldn't connect your Google account. Please try again.",
  // The one message that must be actionable rather than apologetic: this is the
  // refusal a parent hits when their account predates Google sign-in, and the way
  // out is the profile screen, not another attempt at this button.
  GOOGLE_LINK_FROM_PROFILE:
    'Sign in with your email and password, then connect Google from your profile.',
  GOOGLE_RETRY: 'That Google sign-in expired. Please try again.',
  GOOGLE_CANCELLED: 'Google sign-in was cancelled.',
  RATE_LIMITED: 'Too many attempts. Wait a minute and try again.',
  NETWORK_UNAVAILABLE:
    "Can't reach LOPAY. Check your internet connection and try again.",
  SERVER_ERROR: 'Something went wrong on our end. Please try again.',
  SIGNUP_FAILED: "We couldn't create your account. Please try again.",
  UNKNOWN_ERROR: 'Something went wrong. Please try again.',
};

/** Which input each code belongs under. Drives inline placement. */
export const FIELD_ERROR_FIELDS: Record<FieldErrorCode, FieldName> = {
  NAME_REQUIRED: 'fullName',
  NAME_LENGTH: 'fullName',

  EMAIL_REQUIRED: 'email',
  EMAIL_INVALID: 'email',
  EMAIL_TOO_LONG: 'email',
  EMAIL_ALREADY_REGISTERED: 'email',

  PHONE_REQUIRED: 'phoneNumber',
  PHONE_INVALID: 'phoneNumber',
  PHONE_ALREADY_REGISTERED: 'phoneNumber',

  PASSWORD_REQUIRED: 'password',
  PASSWORD_TOO_SHORT: 'password',
  PASSWORD_TOO_LONG: 'password',
  PASSWORD_NEEDS_LETTER_AND_NUMBER: 'password',
  PASSWORD_CONTAINS_PERSONAL_INFO: 'password',

  CONFIRM_PASSWORD_REQUIRED: 'confirmPassword',
  PASSWORD_MISMATCH: 'confirmPassword',

  INVALID_CREDENTIALS: 'form',
  GOOGLE_UNAVAILABLE: 'form',
  GOOGLE_EMAIL_MISMATCH: 'form',
  GOOGLE_ALREADY_LINKED: 'form',
  GOOGLE_LINK_FAILED: 'form',
  GOOGLE_LINK_FROM_PROFILE: 'form',
  GOOGLE_RETRY: 'form',
  GOOGLE_CANCELLED: 'form',
  RATE_LIMITED: 'form',
  NETWORK_UNAVAILABLE: 'form',
  SERVER_ERROR: 'form',
  SIGNUP_FAILED: 'form',
  UNKNOWN_ERROR: 'form',
};

/**
 * Build a `FieldError` from a code. The only way errors are constructed, so the
 * message can never drift from the code it is paired with.
 */
export function fieldError(code: FieldErrorCode): FieldError {
  return { code, message: FIELD_ERROR_MESSAGES[code] };
}

/** The input a code belongs under. */
export function fieldFor(code: FieldErrorCode): FieldName {
  return FIELD_ERROR_FIELDS[code];
}

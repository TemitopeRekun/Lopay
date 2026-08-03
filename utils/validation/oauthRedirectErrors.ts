import {
  FIELD_ERROR_CODES,
  fieldError,
  type FieldError,
  type FieldErrorCode,
} from './codes';

/**
 * Failures that arrive as a REDIRECT rather than a response body.
 *
 * ## Why this is a separate map from serverErrors.ts
 *
 * A Google sign-in has two halves. The first is a request we await, and its failures
 * come back as `{ error: { code } }` — that is `serverErrors.ts`. The second half
 * happens after the browser has left the app entirely: Google redirects to the API's
 * `/api/auth/callback/google`, and if THAT fails, Better Auth answers with
 * `throw ctx.redirect(`${errorURL}?error=<code>`)`. No promise of ours is pending;
 * there is nothing to catch.
 *
 * Two consequences that made the first fix incomplete:
 *
 *  1. Without an `errorCallbackURL`, `errorURL` defaults to `${baseURL}/api/auth/error`
 *     — the API's own page. So a parent who clicks "Continue with Google" on an
 *     existing email/password account was still dropped onto a bare error page on the
 *     backend domain with no way back into the app. That is the same dead end the
 *     linking work set out to remove, surviving in the half nobody awaits.
 *  2. The codes are different. The redirect uses lower_snake spellings
 *     (`account_not_linked`) that never appear in a JSON body, so mapping the
 *     SCREAMING_CASE ones was not enough — and a SCREAMING_CASE entry for a
 *     redirect-only failure was dead code pretending to handle it.
 *
 * Both flows now pass `errorCallbackURL` back into the SPA, and this map turns the
 * `?error=` parameter into the same inline wording the awaited half produces.
 */

/** Better Auth's redirect `error` parameter values → our field error codes. */
const REDIRECT_ERROR_MAP: Record<string, FieldErrorCode> = {
  // The linking refusal this whole feature exists for: Better Auth will not attach
  // Google to an existing account whose email is unverified, and this app sends no
  // verification mail. The wording has to tell the parent what to do instead.
  account_not_linked: FIELD_ERROR_CODES.GOOGLE_LINK_FROM_PROFILE,
  email_doesn_t_match: FIELD_ERROR_CODES.GOOGLE_EMAIL_MISMATCH,
  // Spelled with an apostrophe in the library ("email_doesn't_match"); URLSearchParams
  // preserves it, so match both rather than betting on one.
  "email_doesn't_match": FIELD_ERROR_CODES.GOOGLE_EMAIL_MISMATCH,
  account_already_linked_to_different_user:
    FIELD_ERROR_CODES.GOOGLE_ALREADY_LINKED,
  unable_to_link_account: FIELD_ERROR_CODES.GOOGLE_LINK_FAILED,
  signup_disabled: FIELD_ERROR_CODES.GOOGLE_UNAVAILABLE,
  // OAuth state failures: the flow was tampered with, took too long, or the cookie
  // was dropped. All the user can usefully do is start again.
  state_mismatch: FIELD_ERROR_CODES.GOOGLE_RETRY,
  state_not_found: FIELD_ERROR_CODES.GOOGLE_RETRY,
  no_code: FIELD_ERROR_CODES.GOOGLE_RETRY,
  invalid_callback_request: FIELD_ERROR_CODES.GOOGLE_RETRY,
  // Google's own OAuth error responses.
  access_denied: FIELD_ERROR_CODES.GOOGLE_CANCELLED,
  invalid_client: FIELD_ERROR_CODES.GOOGLE_UNAVAILABLE,
  internal_server_error: FIELD_ERROR_CODES.SERVER_ERROR,
};

/**
 * Map an `?error=` redirect parameter onto an inline error.
 *
 * Returns `null` when there is no error parameter — the ordinary success path — so a
 * caller can use it as the whole "did the redirect come back bad?" check.
 */
export function mapOAuthRedirectError(
  errorParam: string | null | undefined,
): FieldError | null {
  if (!errorParam) return null;
  const normalized = errorParam.trim().toLowerCase();
  const mapped = REDIRECT_ERROR_MAP[normalized];
  // An unrecognised code still has to say something: Better Auth may add codes, and
  // silently rendering nothing would recreate the original bug in a new place.
  return fieldError(mapped ?? FIELD_ERROR_CODES.GOOGLE_LINK_FAILED);
}

/**
 * Read the `error` parameter out of a hash-routed URL.
 *
 * The app uses `HashRouter`, so the redirect target is `https://app/#/profile`, and
 * Better Auth appends its query AFTER the fragment: `https://app/#/profile?error=x`.
 * `window.location.search` is therefore EMPTY — the parameter lives inside
 * `location.hash`. Reading the wrong one is a silent no-op, which is exactly the
 * failure mode being fixed, so the parsing is explicit and tested.
 */
export function readHashQueryParam(hash: string, name: string): string | null {
  const queryStart = hash.indexOf('?');
  if (queryStart === -1) return null;
  return new URLSearchParams(hash.slice(queryStart + 1)).get(name);
}

import {
  FIELD_ERROR_CODES,
  fieldError,
  fieldFor,
  type FieldError,
  type FieldName,
  type FieldErrorCode,
} from './codes';

/**
 * Translate a rejection from the auth API into an inline, field-scoped error.
 *
 * This is the join between the two halves of the pattern. The server answers with
 * a stable `code`; this maps that code onto one of our own and therefore onto the
 * input it belongs under. So "this email is already registered" appears beneath
 * the email box — not as a red banner at the bottom of the form, and without
 * anyone pattern-matching on English.
 *
 * ## Sources of codes
 *
 * Three, all handled here so no caller has to know the difference:
 *
 *  1. **Better Auth's own** — `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`,
 *     `PASSWORD_TOO_SHORT`, `INVALID_EMAIL_OR_PASSWORD` … Defined by the library
 *     (`@better-auth/core/error/codes.ts`) and stable across versions.
 *  2. **Ours** — `PHONE_ALREADY_REGISTERED`, `NAME_REQUIRED` … thrown by
 *     `lopay-backend/src/auth/signup-guard.ts` with identical spelling on both
 *     sides, so they map to themselves.
 *  3. **Transport** — no response at all (offline), a 429, a 5xx. These have no
 *     code, so they are inferred from the status.
 *
 * Anything unrecognised falls back to a form-level message rather than being
 * shown raw: a server string rendered verbatim is how internal detail leaks into
 * the UI.
 */

/** Better Auth's codes → ours. Keys are the library's exact spellings. */
const SERVER_CODE_MAP: Record<string, FieldErrorCode> = {
  // ── Better Auth (library-defined) ──────────────────────────────────────────
  USER_ALREADY_EXISTS: FIELD_ERROR_CODES.EMAIL_ALREADY_REGISTERED,
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    FIELD_ERROR_CODES.EMAIL_ALREADY_REGISTERED,
  INVALID_EMAIL: FIELD_ERROR_CODES.EMAIL_INVALID,
  INVALID_EMAIL_OR_PASSWORD: FIELD_ERROR_CODES.INVALID_CREDENTIALS,
  INVALID_PASSWORD: FIELD_ERROR_CODES.INVALID_CREDENTIALS,
  PASSWORD_TOO_SHORT: FIELD_ERROR_CODES.PASSWORD_TOO_SHORT,
  PASSWORD_TOO_LONG: FIELD_ERROR_CODES.PASSWORD_TOO_LONG,
  // Better Auth returns this when a user row could not be written — including
  // when our phoneHash unique index rejects a concurrent duplicate that raced
  // past the guard's pre-check. Generic on purpose: we genuinely don't know which
  // field was at fault in that case.
  FAILED_TO_CREATE_USER: FIELD_ERROR_CODES.SIGNUP_FAILED,

  // ── Google sign-in / account linking (library-defined) ─────────────────────
  // Raised when the provider has no client id/secret configured — which is the
  // state the live deploy is in, and which used to surface as nothing at all
  // because the client never checked for it.
  CLIENT_ID_AND_SECRET_REQUIRED: FIELD_ERROR_CODES.GOOGLE_UNAVAILABLE,
  PROVIDER_NOT_FOUND: FIELD_ERROR_CODES.GOOGLE_UNAVAILABLE,
  ID_TOKEN_NOT_SUPPORTED: FIELD_ERROR_CODES.GOOGLE_UNAVAILABLE,
  LINKING_DIFFERENT_EMAILS_NOT_ALLOWED:
    FIELD_ERROR_CODES.GOOGLE_EMAIL_MISMATCH,
  LINKING_NOT_ALLOWED: FIELD_ERROR_CODES.GOOGLE_LINK_FAILED,
  // NOTE: "already linked to a different user" and "email doesn't match" also occur
  // AFTER the redirect to Google, where they arrive as `?error=` parameters in
  // lower_snake rather than in a response body. Those spellings live in
  // oauthRedirectErrors.ts — mapping them here as well would be dead code.
  LINKING_FAILED: FIELD_ERROR_CODES.GOOGLE_LINK_FAILED,

  // ── Ours, from signup-guard.ts (same spelling both sides) ──────────────────
  NAME_REQUIRED: FIELD_ERROR_CODES.NAME_REQUIRED,
  NAME_LENGTH: FIELD_ERROR_CODES.NAME_LENGTH,
  PHONE_INVALID: FIELD_ERROR_CODES.PHONE_INVALID,
  PHONE_ALREADY_REGISTERED: FIELD_ERROR_CODES.PHONE_ALREADY_REGISTERED,
};

/** A field-scoped error plus the field it belongs to. */
export interface MappedServerError {
  field: FieldName;
  error: FieldError;
  /** The raw code the server sent, for logging. `null` when there wasn't one. */
  serverCode: string | null;
}

/** Read a `code` from any of the shapes an auth failure arrives in. */
function extractCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const candidate = error as {
    code?: unknown;
    body?: { code?: unknown };
    response?: { data?: { code?: unknown; message?: unknown } };
  };

  // Better Auth client: `{ error: { code, message } }` — callers pass the inner
  // object. Our axios paths: `response.data.code`. A thrown APIError: `body.code`.
  if (typeof candidate.code === 'string') return candidate.code;
  if (typeof candidate.body?.code === 'string') return candidate.body.code;
  if (typeof candidate.response?.data?.code === 'string') {
    return candidate.response.data.code;
  }
  return null;
}

/** Read an HTTP status from either an axios error or a Better Auth error. */
function extractStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const candidate = error as {
    status?: unknown;
    statusCode?: unknown;
    response?: { status?: unknown };
  };
  if (typeof candidate.status === 'number') return candidate.status;
  if (typeof candidate.statusCode === 'number') return candidate.statusCode;
  if (typeof candidate.response?.status === 'number') {
    return candidate.response.status;
  }
  return null;
}

/**
 * Map an auth failure to an inline error.
 *
 * @param error the `error` object from a Better Auth client call, an axios error,
 *   or any thrown value
 * @param fallback the code to use when nothing is recognised — sign-up and
 *   sign-in want different generic wording
 */
export function mapServerError(
  error: unknown,
  fallback: FieldErrorCode = FIELD_ERROR_CODES.UNKNOWN_ERROR,
): MappedServerError {
  const serverCode = extractCode(error);

  if (serverCode) {
    const mapped = SERVER_CODE_MAP[serverCode];
    if (mapped) {
      return { field: fieldFor(mapped), error: fieldError(mapped), serverCode };
    }
  }

  // No usable code — infer from the status. Ordered most-specific first.
  const status = extractStatus(error);

  if (status === 429) {
    return {
      field: 'form',
      error: fieldError(FIELD_ERROR_CODES.RATE_LIMITED),
      serverCode,
    };
  }
  if (status !== null && status >= 500) {
    return {
      field: 'form',
      error: fieldError(FIELD_ERROR_CODES.SERVER_ERROR),
      serverCode,
    };
  }
  // No status at all and no code: the request never reached a server. Better
  // Auth's client surfaces a network failure as status 0 / no response.
  if (status === null || status === 0) {
    if (isNetworkFailure(error)) {
      return {
        field: 'form',
        error: fieldError(FIELD_ERROR_CODES.NETWORK_UNAVAILABLE),
        serverCode,
      };
    }
  }

  return { field: 'form', error: fieldError(fallback), serverCode };
}

/**
 * Distinguish "never reached the server" from "server said no".
 *
 * Worth the effort because the two need opposite advice: "check your connection"
 * versus "check what you typed". Nigerian mobile connectivity makes the former
 * common enough that guessing wrong is a real support cost.
 */
function isNetworkFailure(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return true;
  }
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { message?: unknown; code?: unknown };
  const axiosCode = typeof candidate.code === 'string' ? candidate.code : '';
  if (axiosCode === 'ERR_NETWORK' || axiosCode === 'ECONNABORTED') return true;

  const message =
    typeof candidate.message === 'string' ? candidate.message.toLowerCase() : '';
  return (
    message.includes('network') ||
    message.includes('failed to fetch') ||
    message.includes('load failed')
  );
}

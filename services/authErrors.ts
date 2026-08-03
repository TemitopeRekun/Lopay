/**
 * Turning a Better Auth client rejection into something throwable that survives
 * the trip to `mapServerError`.
 *
 * ## The bug this exists for
 *
 * The Better Auth client does not throw. Every call resolves to `{ data, error }`,
 * so a failure is only a failure if the caller looks. `loginWithGoogle` never did:
 *
 *     const loginWithGoogle = async () => {
 *       await authClient.signIn.social({ provider: "google", callbackURL });
 *     };
 *
 * On the live deploy that call returns a 500 — `GOOGLE_WEB_CLIENT_ID` and
 * `GOOGLE_WEB_CLIENT_SECRET` are unset, so Better Auth raises
 * `CLIENT_ID_AND_SECRET_REQUIRED` — and the SPA discarded it. The `catch` in
 * `AuthScreen` could never fire, because nothing was thrown. "Continue with Google"
 * silently did nothing at all: no redirect, no spinner, no message. The most
 * complete outage the auth surface can have was also its quietest.
 *
 * ## Why a typed error rather than `new Error(message)`
 *
 * `mapServerError` translates a stable server `code` into an inline, field-scoped
 * message. Wrapping a failure in a bare `Error` throws that code away and forces
 * every failure through the generic fallback — so "that Google account uses a
 * different email" would render as "something went wrong". Carrying `code` and
 * `status` as properties keeps the mapping intact, since `extractCode` and
 * `extractStatus` read exactly those two fields.
 */

/** The `{ code, message, status }` shape Better Auth's client resolves errors to. */
export interface BetterAuthClientError {
  code?: string | undefined;
  message?: string | undefined;
  status?: number | undefined;
  statusText?: string | undefined;
}

/**
 * A Better Auth failure as a throwable.
 *
 * `code` and `status` are the fields `mapServerError` reads, and they are declared
 * as public properties for that reason — not incidentally.
 */
export class AuthClientError extends Error {
  readonly code: string | undefined;
  readonly status: number | undefined;

  constructor(error: BetterAuthClientError | null | undefined, fallbackMessage: string) {
    super(error?.message || fallbackMessage);
    this.name = "AuthClientError";
    this.code = error?.code;
    this.status = error?.status;
  }
}

/**
 * Throw if a Better Auth client result carries an error.
 *
 * The one-line guard that the Google paths were missing. Written as a helper rather
 * than repeated inline so every `authClient` call in `AuthContext` fails the same
 * way — a silent path is easy to reintroduce by forgetting an `if`, and much harder
 * to reintroduce by forgetting a call that the next line depends on.
 */
export function throwIfError(
  result: { error?: BetterAuthClientError | null } | null | undefined,
  fallbackMessage: string,
): void {
  if (result?.error) {
    throw new AuthClientError(result.error, fallbackMessage);
  }
}

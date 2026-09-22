/**
 * The enrollment-invite claim link, from this side.
 *
 * Mirrors `buildClaimUrl` / `parseClaimUrlToken` in the backend's
 * `enrollment-invites/claim-url.ts`. The two are one format, and the server's
 * doc comment carries the full reasoning; the short version is that this app
 * mounts `<HashRouter>` (App.tsx), so a link has to be
 * `https://app/#/claim-invite?token=…`. Put the route in the real path and the
 * SPA fallback serves index.html, the router matches nothing, and the parent
 * gets a blank screen.
 *
 * That shape is also the private one. Everything after the `#` is fragment and
 * is never transmitted, so the token reaches no access log and no `Referer`.
 * The router parsing part of that fragment as a query string is a routing
 * detail — on the wire it is all fragment, which is why `useSearchParams` is
 * the right way to read it and why doing so costs nothing in privacy.
 */

/** Route the claim screen is mounted at. */
export const CLAIM_ROUTE = "/claim-invite";

/**
 * Query parameter the token travels in.
 *
 * Exported so the screen reads `searchParams.get(CLAIM_TOKEN_PARAM)` rather
 * than repeating a bare `"token"` that nothing ties to the server's builder.
 */
export const CLAIM_TOKEN_PARAM = "token";

/**
 * The in-app path for a held token, used to resume after sign-in.
 *
 * A router path, not a URL: `navigate()` puts it after the `#` itself.
 */
export function claimPathFor(token: string): string {
  const query = new URLSearchParams({ [CLAIM_TOKEN_PARAM]: token });
  return `${CLAIM_ROUTE}?${query.toString()}`;
}

/**
 * Read the token out of a full claim URL. Mirrors the server's parser.
 *
 * The screen itself uses `useSearchParams`, because the router has already
 * parsed the fragment by the time it renders. This exists for tests, which need
 * to assert that the URL the server mints is the URL this app can read — the
 * agreement that was broken when the link put its route in the real path.
 *
 * Returns null for a token in the REAL query string. That shape neither routes
 * nor keeps the token off the wire, so tolerating it would hide both faults.
 */
export function readClaimToken(
  claimUrl: string | undefined | null,
): string | null {
  if (!claimUrl) return null;

  const hashIndex = claimUrl.indexOf("#");
  if (hashIndex === -1) return null;

  const fragment = claimUrl.slice(hashIndex + 1);
  const queryIndex = fragment.indexOf("?");
  if (queryIndex === -1) return null;

  return new URLSearchParams(fragment.slice(queryIndex + 1)).get(
    CLAIM_TOKEN_PARAM,
  );
}

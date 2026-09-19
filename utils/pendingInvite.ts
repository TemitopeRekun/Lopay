/**
 * Carrying an enrollment-invite token across the sign-in round trip.
 *
 * ## Why this is needed at all
 *
 * A parent arrives from a WhatsApp link holding a claim token, and usually has
 * no Lopay account yet. The claim screen is public so they can read what the
 * school is asserting before committing to anything, but confirming it requires
 * an account — and `AuthScreen` redirects to a role-based home on success
 * rather than returning to wherever the user came from. Without somewhere to
 * put the token, signing up would drop it and the parent would have to go back
 * to WhatsApp and tap the link a second time.
 *
 * ## Why sessionStorage, and why that is acceptable for a credential
 *
 * The token IS a bearer credential, so this is a real trade-off rather than an
 * obvious choice. It is acceptable here because:
 *
 *   - `sessionStorage` is origin-scoped and cleared when the tab closes, so the
 *     exposure window is one browsing session on one tab;
 *   - the token is already in that tab's URL and history, so storing it adds no
 *     attacker capability that a look at the address bar would not;
 *   - it is single-use and short-lived, and is consumed the moment the claim
 *     screen reads it back.
 *
 * `localStorage` would be wrong — it survives the tab and the browser restart,
 * turning a transient credential into a durable one on a possibly shared phone.
 *
 * Every access is wrapped: storage throws outright in some in-app browsers and
 * when a user has blocked site data, and a parent with cookies disabled must
 * still be able to read their invite.
 */

import { claimPathFor } from "./claimUrl";

const PENDING_INVITE_KEY = "lopay:pendingInviteToken";

/** Remember a token so it survives a trip through sign-up. */
export function rememberPendingInvite(token: string): void {
  if (!token) return;
  try {
    window.sessionStorage.setItem(PENDING_INVITE_KEY, token);
  } catch {
    // Storage unavailable. The parent can still claim in this tab, because the
    // token remains in the URL; they would only lose it across a sign-in.
  }
}

/**
 * Read the pending token without consuming it.
 *
 * This — not a read-and-remove — is what `AuthScreen` uses, because it decides
 * its redirect during render and a render must stay pure. Under
 * `React.StrictMode` a component body runs twice in development, so a
 * consuming read would hand the token to the first (discarded) render and
 * nothing to the second, silently dropping the parent on a dashboard. Clearing
 * happens in `ClaimInviteScreen`, once the token has actually been used.
 */
export function peekPendingInvite(): string | null {
  try {
    return window.sessionStorage.getItem(PENDING_INVITE_KEY);
  } catch {
    return null;
  }
}

export function clearPendingInvite(): void {
  try {
    window.sessionStorage.removeItem(PENDING_INVITE_KEY);
  } catch {
    // Nothing to do — see the note above.
  }
}

/**
 * The route a held token should resume to.
 *
 * Delegates the format to `claimUrl.ts`, which mirrors the server's builder.
 * A router PATH, not a URL — `navigate()` places it after the `#`, which is
 * what keeps the token inside the fragment and off the wire.
 */
export function pendingInvitePath(token: string): string {
  return claimPathFor(token);
}

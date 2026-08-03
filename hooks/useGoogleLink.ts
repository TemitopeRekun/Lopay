import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authClient } from "../services/authClient";
import { useAuth } from "../context/AuthContext";
import { mapServerError } from "../utils/validation/serverErrors";
import { FIELD_ERROR_CODES } from "../utils/validation/codes";
import { logger, CLIENT_EVENTS } from "../utils/logger";
import {
  mapOAuthRedirectError,
  readHashQueryParam,
} from "../utils/validation/oauthRedirectErrors";

/** Provider id Better Auth stores for a Google account link. */
export const GOOGLE_PROVIDER_ID = "google";

/** Provider id Better Auth stores for an email/password credential. */
export const CREDENTIAL_PROVIDER_ID = "credential";

/**
 * State and actions for "is Google connected to this account, and connect it".
 *
 * Kept as a hook rather than inline in `ProfileScreen` so the decision logic —
 * which providers count as linked, what a failure renders as — is unit-testable
 * without mounting the profile page and its data providers.
 *
 * The read uses `/list-accounts`, which returns the caller's OWN account rows only,
 * so it needs no scoping of its own. `enabled` on the session means a signed-out
 * render does not fire a 401 on mount.
 */
export function useGoogleLink() {
  const { isAuthenticated, linkGoogle } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);
  // Seeded from the URL, because a link can fail AFTER the browser has left the app:
  // Google's callback redirects back to `#/profile?error=<code>` and no promise of
  // ours is pending to catch it. Reading it here is what makes that half visible
  // instead of silent. See utils/validation/oauthRedirectErrors.ts.
  const [error, setError] = useState<string | null>(
    () =>
      mapOAuthRedirectError(
        typeof window === "undefined"
          ? null
          : readHashQueryParam(window.location.hash, "error"),
      )?.message ?? null,
  );

  const accounts = useQuery({
    queryKey: ["linkedAccounts"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const { data, error: listError } = await authClient.listAccounts();
      if (listError) throw listError;
      return data ?? [];
    },
  });

  const connect = useCallback(async () => {
    setError(null);
    setIsConnecting(true);
    try {
      await linkGoogle();
      // On success the browser navigates to Google, so nothing after this runs in
      // practice. `isConnecting` is deliberately NOT reset here: leaving the button
      // disabled until the page unloads stops a second click from minting a second
      // OAuth state while the first redirect is already in flight.
    } catch (e) {
      const mapped = mapServerError(e, FIELD_ERROR_CODES.GOOGLE_LINK_FAILED);
      setError(mapped.error.message);
      setIsConnecting(false);
      logger.event(
        CLIENT_EVENTS.LOGIN_REJECTED,
        { provider: "google", reason: mapped.error.code, action: "link" },
        "warn",
      );
    }
  }, [linkGoogle]);

  const providerIds = (accounts.data ?? []).map(
    (account: { providerId?: string; provider?: string }) =>
      account.providerId ?? account.provider,
  );
  const isGoogleLinked = providerIds.includes(GOOGLE_PROVIDER_ID);

  return {
    isGoogleLinked,
    // Whether a password actually exists on this account. Found in self-review: the
    // profile section hardcoded "Email & Password — Active", which is a false
    // statement for anyone who signed up THROUGH Google and has no credential row.
    // Telling someone they have a password they have never set is worse than saying
    // nothing, especially with no reset flow shipped to correct the impression.
    isPasswordEnabled: providerIds.includes(CREDENTIAL_PROVIDER_ID),
    // A failed read must not masquerade as "checking…" forever, so the loading flag
    // is the fetch being in flight, not the absence of data.
    isLoading: accounts.isPending && isAuthenticated,
    connect,
    isConnecting,
    error,
  };
}

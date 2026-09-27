import React, { useEffect, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { Layout } from "../components/Layout";
import { Header } from "../components/Header";
import { useAuth } from "../context/AuthContext";
import { CLIENT_EVENTS, logger } from "../utils/logger";
import { peekPendingInvite, pendingInvitePath } from "../utils/pendingInvite";
import { homePathForRole } from "../utils/homePath";
import {
  mapOAuthRedirectError,
  readHashQueryParam,
} from "../utils/validation/oauthRedirectErrors";

/**
 * Where a Google sign-in lands on its way back into the app.
 *
 * ## What it is exchanging, and why there is anything to exchange
 *
 * The API is on a different SITE to this app, so the session cookie it sets is
 * third-party here and Safari, Firefox and any Chrome incognito window decline
 * to send it back. The redirect therefore carries a one-time token instead, and
 * this screen trades it for a bearer session over an ordinary CORS request that
 * needs no cookie at all. That is the whole reason this route exists: without
 * it the browser would arrive at `#/home` carrying nothing the app can read,
 * `isAuthenticated` would stay false, and `HomeRedirect` would bounce the
 * parent to `/welcome` — a sign-in that silently did not sign anyone in.
 *
 * ## Why the token is read from the hash and not `useSearchParams`
 *
 * It is, in effect — the app is hash-routed, so the router has already parsed
 * `#/auth/callback?ott=…` and `searchParams` reads from inside the FRAGMENT.
 * Nothing after the `#` is ever transmitted, so the token reaches no access
 * log, no `Referer` and no proxy. Same argument as the enrollment-invite claim
 * link; see `utils/claimUrl.ts`.
 *
 * ## Why it renders almost nothing
 *
 * Because it is a hop, not a destination. It is on screen for the length of one
 * request, and the only outcomes are "you are signed in, here is where you were
 * going" and "that did not work, here is why" — the second of which belongs on
 * the sign-in form, where the error wording and the retry both already live.
 */
const OAuthCallbackScreen: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { completeOAuthHandoff, isAuthenticated, role } = useAuth();

  const token = searchParams.get("ott");
  const next = searchParams.get("next");

  const [failed, setFailed] = useState<string | null>(() =>
    // An error can arrive here instead of a token when the API redirected
    // straight to the callback with a failure. Seeded from the URL for the same
    // reason `useGoogleLink` does it: no promise of ours is pending, so reading
    // it is the only thing that makes that half visible rather than silent.
    token
      ? null
      : (mapOAuthRedirectError(
          typeof window === "undefined"
            ? null
            : readHashQueryParam(window.location.hash, "error"),
        )?.message ?? null),
  );
  const [done, setDone] = useState(false);

  // The exchange is single-use: the server deletes the token as it verifies it.
  // Under React.StrictMode an effect runs twice in development, and the second
  // run would spend an already-spent token and report a failure over a sign-in
  // that actually succeeded. A ref, not state — it has to be set synchronously,
  // before the second invocation can read it.
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;

    completeOAuthHandoff(token)
      .then(() => {
        logger.event(CLIENT_EVENTS.LOGIN_SUCCEEDED, { provider: "google" });
        setDone(true);
      })
      .catch((error: unknown) => {
        logger.event(
          CLIENT_EVENTS.LOGIN_REJECTED,
          { provider: "google", reason: "handoff_failed" },
          "warn",
        );
        setFailed(
          error instanceof Error && error.message
            ? error.message
            : "We could not finish signing you in. Please try again.",
        );
      });
  }, [token, completeOAuthHandoff]);

  // Straight to the sign-in form, which renders the reason. Passed through the
  // hash query the same way the API's own failures arrive, so there is one
  // rendering path for both rather than two that can drift.
  if (failed) {
    return (
      <Navigate
        to={`/auth?error=${encodeURIComponent("handoff_failed")}`}
        replace
      />
    );
  }

  if (!token) return <Navigate to="/auth" replace />;

  if (done && isAuthenticated) {
    // A parent who arrived from a WhatsApp invite link signed in IN ORDER to
    // claim it, so that beats any `next`. The token is not carried through the
    // redirect — it waits in sessionStorage, which survives the round trip
    // because this is the same tab on the same origin.
    const pendingInvite = peekPendingInvite();
    if (pendingInvite) {
      return <Navigate to={pendingInvitePath(pendingInvite)} replace />;
    }
    // `homePathForRole`, never a hardcoded "/dashboard": that route is
    // parent-only, and a school owner can be a parent at another school.
    return <Navigate to={next || homePathForRole(role)} replace />;
  }

  return (
    <Layout>
      <Header title="Signing you in" />
      <main className="flex flex-1 items-center justify-center p-6">
        <p className="text-center text-sm text-text-secondary-light">
          One moment — finishing your Google sign-in…
        </p>
      </main>
    </Layout>
  );
};

export default OAuthCallbackScreen;

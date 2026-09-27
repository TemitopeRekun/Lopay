import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "./AuthContext";
import { mapServerError } from "../utils/validation/serverErrors";
import { FIELD_ERROR_CODES } from "../utils/validation/codes";
import { API_URL } from "../services/backend";

const getSession = vi.fn();
const signInSocial = vi.fn();
const linkSocial = vi.fn();
const generateOtt = vi.fn();
const verifyOtt = vi.fn();

vi.mock("../services/authClient", () => ({
  authClient: {
    getSession: (...args: unknown[]) => getSession(...args),
    // Kept on the stub deliberately, so the "does not call these" assertions
    // below are testing a real absence rather than an undefined property.
    signIn: { social: (...args: unknown[]) => signInSocial(...args) },
    linkSocial: (...args: unknown[]) => linkSocial(...args),
    oneTimeToken: {
      generate: (...args: unknown[]) => generateOtt(...args),
      verify: (...args: unknown[]) => verifyOtt(...args),
    },
    signOut: vi.fn().mockResolvedValue(undefined),
  },
}));

/**
 * Google sign-in, after it stopped depending on a cross-site cookie.
 *
 * ## What changed, and why these tests changed with it
 *
 * The flow used to begin with `authClient.signIn.social(...)` — a cross-origin
 * `fetch`. That fetch is where Better Auth sets the OAuth state cookie, and
 * because the API is on a different SITE to this app the browser filed it as a
 * third-party cookie. The callback then read it during a top-level navigation
 * where the API is first-party: a different jar. Safari refused the write,
 * Firefox partitioned it out of reach, and Chrome only appeared to work because
 * it still allows unpartitioned third-party cookies. Production had never
 * recorded a single `google` row in `Account`.
 *
 * So the earlier suite here was pinning the shape of a call that could not
 * succeed. The contract it should have been pinning — and the one below does —
 * is that the browser LEAVES, first-party, to a URL this app does not have to
 * interpret, and that the session comes back through an exchange rather than a
 * cookie.
 *
 * ## Why failures are asserted differently now
 *
 * They mostly cannot be caught here any more, and that is the point. Assigning
 * `location.href` unloads the document, so there is no pending promise for a
 * post-redirect failure to reject. Those failures come back as
 * `#/auth?error=<code>` and are rendered by `AuthScreen` — covered by
 * `AuthScreen.oauth.test.tsx` and `utils/validation/oauthRedirectErrors.test.ts`.
 * What is still catchable, and still asserted, is a failure BEFORE the browser
 * leaves: minting the link ticket, and exchanging the handoff token.
 */

/** Records navigations instead of performing them — jsdom cannot navigate. */
const navigations: string[] = [];
let originalLocation: Location;

const Probe = () => {
  const { loginWithGoogle, linkGoogle, completeOAuthHandoff } = useAuth();
  const [outcome, setOutcome] = React.useState("idle");

  const run = (fn: () => Promise<unknown>) => async () => {
    try {
      await fn();
      setOutcome("resolved");
    } catch (e) {
      const mapped = mapServerError(e, FIELD_ERROR_CODES.UNKNOWN_ERROR);
      setOutcome(`threw:${mapped.error.code}`);
    }
  };

  return (
    <>
      <button onClick={run(() => loginWithGoogle())}>sign-in</button>
      <button onClick={run(() => loginWithGoogle("/history"))}>
        sign-in-next
      </button>
      <button onClick={run(linkGoogle)}>link</button>
      <button onClick={run(() => completeOAuthHandoff("ott-1"))}>
        handoff
      </button>
      <div data-testid="outcome">{outcome}</div>
    </>
  );
};

const renderProbe = async () => {
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  await waitFor(() => expect(getSession).toHaveBeenCalled());
};

beforeEach(() => {
  vi.clearAllMocks();
  navigations.length = 0;
  localStorage.clear();
  getSession.mockResolvedValue({ data: { user: null } });

  originalLocation = window.location;
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: {
      origin: "https://app.lopay.test",
      hash: "",
      set href(url: string) {
        navigations.push(url);
      },
      get href() {
        return navigations[navigations.length - 1] ?? "";
      },
    },
  });
});

afterEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: originalLocation,
  });
});

describe("loginWithGoogle", () => {
  it("hands the whole browser to the API instead of fetching", async () => {
    // The property the entire fix rests on. A `fetch` here writes the OAuth
    // state cookie into the third-party jar; a navigation writes it first-party
    // on the API's own origin, which is the only way the callback can read it
    // back in Safari, Firefox, or a Chrome incognito window.
    await renderProbe();

    await userEvent.click(screen.getByText("sign-in"));

    await waitFor(() => expect(navigations).toHaveLength(1));
    expect(navigations[0]).toBe(
      `${API_URL}/api/v1/auth/google/start?return_to=https%3A%2F%2Fapp.lopay.test`,
    );
    expect(signInSocial).not.toHaveBeenCalled();
  });

  it("passes a resume route through as an encoded query parameter", async () => {
    await renderProbe();

    await userEvent.click(screen.getByText("sign-in-next"));

    await waitFor(() => expect(navigations).toHaveLength(1));
    expect(navigations[0]).toBe(
      `${API_URL}/api/v1/auth/google/start?next=%2Fhistory&return_to=https%3A%2F%2Fapp.lopay.test`,
    );
  });

  it("tells the API which build it is, so native returns to the app", async () => {
    // The Capacitor shells serve this same bundle from `https://localhost`
    // (Android) and `capacitor://localhost` (iOS). Without this the server
    // would always redirect to the Netlify site, walking a native user out of
    // their app and into a browser, signed in to a copy they never opened.
    // The server re-checks the value against its trustedOrigins list.
    await renderProbe();

    await userEvent.click(screen.getByText("sign-in"));

    await waitFor(() => expect(navigations).toHaveLength(1));
    expect(navigations[0]).toContain(
      `return_to=${encodeURIComponent("https://app.lopay.test")}`,
    );
  });

  it("never puts a pending invite token into the URL", async () => {
    // A parent arriving from a WhatsApp link is resumed from sessionStorage,
    // not from `next`. Passing the claim token here would march a bearer
    // credential through a top-level navigation and into the API's access log
    // — the exact leak `utils/claimUrl.ts` puts it in a fragment to avoid.
    sessionStorage.setItem("lopay:pendingInviteToken", "secret-claim-token");
    await renderProbe();

    await userEvent.click(screen.getByText("sign-in"));

    await waitFor(() => expect(navigations).toHaveLength(1));
    expect(navigations[0]).not.toContain("secret-claim-token");
    sessionStorage.clear();
  });
});

describe("completeOAuthHandoff", () => {
  it("exchanges the one-time token and hydrates the session", async () => {
    verifyOtt.mockResolvedValue({ data: { session: {} }, error: null });
    getSession
      .mockResolvedValueOnce({ data: { user: null } })
      .mockResolvedValue({
        data: { user: { id: "u1", email: "a@b.test", role: "PARENT" } },
      });
    await renderProbe();

    await userEvent.click(screen.getByText("handoff"));

    await waitFor(() =>
      expect(screen.getByTestId("outcome")).toHaveTextContent("resolved"),
    );
    expect(verifyOtt).toHaveBeenCalledWith({ token: "ott-1" });
  });

  // The Better Auth client RESOLVES on failure rather than throwing, which is
  // how the original silent-Google bug happened. The result must be checked
  // here or a spent token would read as a successful sign-in and the app would
  // render a signed-out dashboard.
  it("throws when the token is spent or expired, instead of resolving", async () => {
    verifyOtt.mockResolvedValue({
      data: null,
      error: { code: "BAD_REQUEST", status: 400, message: "Invalid token" },
    });
    await renderProbe();

    await userEvent.click(screen.getByText("handoff"));

    await waitFor(() =>
      expect(screen.getByTestId("outcome")).toHaveTextContent("threw:"),
    );
    expect(navigations).toHaveLength(0);
  });
});

describe("linkGoogle", () => {
  it("mints a ticket, then navigates — it does not call linkSocial", async () => {
    // `authClient.linkSocial` is a cross-origin fetch and would strand the state
    // cookie exactly as sign-in did. The ticket exists because a top-level
    // navigation carries no Authorization header and the API's session cookie
    // is third-party here, so the browser would otherwise arrive anonymous.
    generateOtt.mockResolvedValue({ data: { token: "ticket-1" }, error: null });
    await renderProbe();

    await userEvent.click(screen.getByText("link"));

    await waitFor(() => expect(navigations).toHaveLength(1));
    expect(navigations[0]).toBe(
      `${API_URL}/api/v1/auth/google/link/start?ticket=ticket-1&return_to=https%3A%2F%2Fapp.lopay.test`,
    );
    expect(linkSocial).not.toHaveBeenCalled();
  });

  it("URL-encodes the ticket rather than trusting its alphabet", async () => {
    generateOtt.mockResolvedValue({
      data: { token: "a/b+c=" },
      error: null,
    });
    await renderProbe();

    await userEvent.click(screen.getByText("link"));

    await waitFor(() => expect(navigations).toHaveLength(1));
    expect(navigations[0]).toContain("ticket=a%2Fb%2Bc%3D");
  });

  it("throws and does not navigate when the ticket cannot be minted", async () => {
    generateOtt.mockResolvedValue({
      data: null,
      error: { code: "UNAUTHORIZED", status: 401 },
    });
    await renderProbe();

    await userEvent.click(screen.getByText("link"));

    await waitFor(() =>
      expect(screen.getByTestId("outcome")).toHaveTextContent("threw:"),
    );
    // Navigating anyway would send the user to Google only to be refused on the
    // way back, which reads as "Google is broken" rather than "you are signed out".
    expect(navigations).toHaveLength(0);
  });

  it("throws when the mint succeeds but carries no token", async () => {
    generateOtt.mockResolvedValue({ data: {}, error: null });
    await renderProbe();

    await userEvent.click(screen.getByText("link"));

    await waitFor(() =>
      expect(screen.getByTestId("outcome")).toHaveTextContent("threw:"),
    );
    expect(navigations).toHaveLength(0);
  });
});

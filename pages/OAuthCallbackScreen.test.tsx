import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import OAuthCallbackScreen from "./OAuthCallbackScreen";
import { rememberPendingInvite } from "../utils/pendingInvite";

/**
 * The hop that turns a Google redirect back into a signed-in session.
 *
 * ## Why there is a screen here at all
 *
 * The API is on a different SITE to this app, so a session cookie it sets is
 * third-party here and Safari, Firefox and any Chrome incognito window decline
 * to send it back. The redirect therefore carries a one-time token in the
 * fragment, and this screen trades it for a bearer session over an ordinary
 * CORS request. Without that exchange the browser would arrive at `#/home`
 * carrying nothing the app can read, `isAuthenticated` would stay false, and
 * `HomeRedirect` would bounce the parent to `/welcome` — a sign-in that
 * silently signed nobody in, which is the bug in a new costume.
 *
 * ## The three things worth pinning
 *
 *  1. **It exchanges exactly once.** The server deletes the token as it
 *     verifies it, so a second attempt fails. Under StrictMode an effect runs
 *     twice in development, and a second run would spend an already-spent token
 *     and report failure over a sign-in that had actually succeeded. Every case
 *     below runs inside `React.StrictMode` deliberately.
 *  2. **A pending enrollment invite wins.** A parent who came from a WhatsApp
 *     link signed in IN ORDER to claim it.
 *  3. **A failure lands on the sign-in form**, which renders the reason —
 *     never on a blank screen and never on the API's own error page.
 */

vi.mock("../components/Layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../components/Header", () => ({
  Header: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

const completeOAuthHandoff = vi.fn();
let isAuthenticated = false;
let role: string | null = "parent";

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    completeOAuthHandoff,
    isAuthenticated,
    role,
  }),
}));

const renderAt = (entry: string) =>
  render(
    <React.StrictMode>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/auth/callback" element={<OAuthCallbackScreen />} />
          <Route path="/auth" element={<div>SIGN IN FORM</div>} />
          <Route path="/dashboard" element={<div>PARENT DASHBOARD</div>} />
          <Route
            path="/school-owner-dashboard"
            element={<div>SCHOOL DASHBOARD</div>}
          />
          <Route path="/history" element={<div>HISTORY</div>} />
          <Route path="/claim-invite" element={<div>CLAIM SCREEN</div>} />
        </Routes>
      </MemoryRouter>
    </React.StrictMode>,
  );

describe("OAuthCallbackScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    isAuthenticated = false;
    role = "parent";
    completeOAuthHandoff.mockImplementation(async () => {
      isAuthenticated = true;
      return { id: "u1" };
    });
  });

  it("exchanges the token exactly once, even under StrictMode", async () => {
    // The regression this guards: the token is single-use, so a double-invoked
    // effect would spend it twice and report a failure over a successful
    // sign-in — in development only, which is a miserable thing to track down.
    renderAt("/auth/callback?ott=handoff-1");

    await waitFor(() => expect(completeOAuthHandoff).toHaveBeenCalled());
    expect(completeOAuthHandoff).toHaveBeenCalledTimes(1);
    expect(completeOAuthHandoff).toHaveBeenCalledWith("handoff-1");
  });

  it("sends a signed-in parent to their dashboard", async () => {
    renderAt("/auth/callback?ott=handoff-1");

    expect(await screen.findByText("PARENT DASHBOARD")).toBeInTheDocument();
  });

  it("resolves home by ROLE, never a hardcoded /dashboard", async () => {
    // `/dashboard` is parent-only, and a school owner can be a parent at
    // another school — the case the invite API goes out of its way to allow.
    // Hardcoding it bounced them straight back off again.
    role = "school_owner";
    renderAt("/auth/callback?ott=handoff-1");

    expect(await screen.findByText("SCHOOL DASHBOARD")).toBeInTheDocument();
  });

  it("honours a next route when there is no invite waiting", async () => {
    renderAt("/auth/callback?ott=handoff-1&next=%2Fhistory");

    expect(await screen.findByText("HISTORY")).toBeInTheDocument();
  });

  it("puts a pending enrollment invite ahead of everything else", async () => {
    // The whole reason the parent signed in. sessionStorage survives the OAuth
    // round trip because it is the same tab on the same origin, which is why
    // the claim token never has to travel through a URL.
    rememberPendingInvite("claim-token-1");
    renderAt("/auth/callback?ott=handoff-1&next=%2Fhistory");

    expect(await screen.findByText("CLAIM SCREEN")).toBeInTheDocument();
  });

  it("returns to the sign-in form when the token will not exchange", async () => {
    // Almost always a second use of a spent token — a refresh, or a back button
    // onto the callback URL. The form renders the reason from `?error=`.
    completeOAuthHandoff.mockRejectedValue(new Error("Invalid token"));
    renderAt("/auth/callback?ott=handoff-1");

    expect(await screen.findByText("SIGN IN FORM")).toBeInTheDocument();
  });

  it("returns to the sign-in form when the redirect carried no token", async () => {
    renderAt("/auth/callback");

    expect(await screen.findByText("SIGN IN FORM")).toBeInTheDocument();
    expect(completeOAuthHandoff).not.toHaveBeenCalled();
  });

  it("shows a waiting state rather than a blank screen mid-exchange", () => {
    // It is on screen for one request, but a blank page during it reads as a
    // broken app on a slow connection.
    completeOAuthHandoff.mockReturnValue(new Promise(() => {}));
    renderAt("/auth/callback?ott=handoff-1");

    expect(screen.getByText(/finishing your Google sign-in/i)).toBeInTheDocument();
  });
});

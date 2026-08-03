import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "./AuthContext";
import { mapServerError } from "../utils/validation/serverErrors";
import { FIELD_ERROR_CODES } from "../utils/validation/codes";

const getSession = vi.fn();
const signInSocial = vi.fn();
const linkSocial = vi.fn();

vi.mock("../services/authClient", () => ({
  authClient: {
    getSession: (...args: unknown[]) => getSession(...args),
    signIn: { social: (...args: unknown[]) => signInSocial(...args) },
    linkSocial: (...args: unknown[]) => linkSocial(...args),
    signOut: vi.fn().mockResolvedValue(undefined),
  },
}));

/**
 * Renders a button per action and surfaces whatever the action threw, so the tests
 * assert on the contract the real callers depend on: that a failure REACHES them.
 */
const Probe = () => {
  const { loginWithGoogle, linkGoogle } = useAuth();
  const [outcome, setOutcome] = React.useState("idle");

  const run = (fn: () => Promise<void>) => async () => {
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
      <button onClick={run(loginWithGoogle)}>sign-in</button>
      <button onClick={run(linkGoogle)}>link</button>
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

describe("loginWithGoogle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ data: { user: null } });
    localStorage.clear();
  });

  it("redirects when the provider is configured", async () => {
    signInSocial.mockResolvedValue({ data: { url: "https://accounts.google.com/o/oauth2/v2/auth" }, error: null });
    await renderProbe();

    await userEvent.click(screen.getByText("sign-in"));

    await waitFor(() =>
      expect(screen.getByTestId("outcome")).toHaveTextContent("resolved"),
    );
    expect(signInSocial).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "google" }),
    );
  });

  // The regression. The Better Auth client RESOLVES on failure, so the original
  // `await authClient.signIn.social(...)` with no result check meant a 500 produced
  // no redirect, no error and no message — the button silently did nothing.
  it("throws when the server rejects, instead of failing silently", async () => {
    signInSocial.mockResolvedValue({
      data: null,
      error: {
        code: "CLIENT_ID_AND_SECRET_REQUIRED",
        status: 500,
        message: "Client Id and Client Secret is required for Google.",
      },
    });
    await renderProbe();

    await userEvent.click(screen.getByText("sign-in"));

    await waitFor(() =>
      expect(screen.getByTestId("outcome")).toHaveTextContent(
        `threw:${FIELD_ERROR_CODES.GOOGLE_UNAVAILABLE}`,
      ),
    );
  });

  it("preserves a rate-limit rejection as its own code", async () => {
    signInSocial.mockResolvedValue({
      data: null,
      error: { status: 429, message: "Too many requests" },
    });
    await renderProbe();

    await userEvent.click(screen.getByText("sign-in"));

    await waitFor(() =>
      expect(screen.getByTestId("outcome")).toHaveTextContent(
        `threw:${FIELD_ERROR_CODES.RATE_LIMITED}`,
      ),
    );
  });

  it("sends the user back into the app after the redirect", async () => {
    signInSocial.mockResolvedValue({ data: {}, error: null });
    await renderProbe();

    await userEvent.click(screen.getByText("sign-in"));

    await waitFor(() => expect(signInSocial).toHaveBeenCalled());
    expect(signInSocial.mock.calls[0][0].callbackURL).toContain("/#/home");
  });
});

describe("linkGoogle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ data: { user: null } });
    localStorage.clear();
  });

  // Uses /link-social rather than /sign-in/social precisely because the session is
  // the proof of ownership — which is what lets linking work with no verification
  // email, on an app that has no mail domain.
  it("calls the authenticated link endpoint, not sign-in", async () => {
    linkSocial.mockResolvedValue({ data: { url: "https://accounts.google.com" }, error: null });
    await renderProbe();

    await userEvent.click(screen.getByText("link"));

    await waitFor(() => expect(linkSocial).toHaveBeenCalled());
    expect(signInSocial).not.toHaveBeenCalled();
    expect(linkSocial).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "google" }),
    );
  });

  it("returns the user to the profile screen", async () => {
    linkSocial.mockResolvedValue({ data: {}, error: null });
    await renderProbe();

    await userEvent.click(screen.getByText("link"));

    await waitFor(() => expect(linkSocial).toHaveBeenCalled());
    expect(linkSocial.mock.calls[0][0].callbackURL).toContain("/#/profile");
  });

  it("surfaces an email mismatch with its specific wording", async () => {
    linkSocial.mockResolvedValue({
      data: null,
      error: { code: "LINKING_DIFFERENT_EMAILS_NOT_ALLOWED", status: 401 },
    });
    await renderProbe();

    await userEvent.click(screen.getByText("link"));

    await waitFor(() =>
      expect(screen.getByTestId("outcome")).toHaveTextContent(
        `threw:${FIELD_ERROR_CODES.GOOGLE_EMAIL_MISMATCH}`,
      ),
    );
  });

  // Was asserting a fiction, caught in self-review: "already linked to a different
  // user" is only ever a REDIRECT parameter, never a JSON code, so the mapping it
  // relied on was dead code. That path is covered by oauthRedirectErrors.test.ts;
  // this now pins a code the awaited half genuinely returns.
  it("surfaces a refused link", async () => {
    linkSocial.mockResolvedValue({
      data: null,
      error: { code: "LINKING_NOT_ALLOWED", status: 401 },
    });
    await renderProbe();

    await userEvent.click(screen.getByText("link"));

    await waitFor(() =>
      expect(screen.getByTestId("outcome")).toHaveTextContent(
        `threw:${FIELD_ERROR_CODES.GOOGLE_LINK_FAILED}`,
      ),
    );
  });
});

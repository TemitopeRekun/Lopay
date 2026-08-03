import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useGoogleLink } from "./useGoogleLink";
import { AuthClientError } from "../services/authErrors";

const listAccounts = vi.fn();
const linkGoogle = vi.fn();
let isAuthenticated = true;

vi.mock("../services/authClient", () => ({
  authClient: { listAccounts: (...a: unknown[]) => listAccounts(...a) },
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated, linkGoogle }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

describe("useGoogleLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAuthenticated = true;
    listAccounts.mockResolvedValue({ data: [], error: null });
    window.location.hash = "#/profile";
  });

  it("reports Google as linked when the account list contains it", async () => {
    listAccounts.mockResolvedValue({
      data: [{ providerId: "credential" }, { providerId: "google" }],
      error: null,
    });
    const { result } = renderHook(() => useGoogleLink(), { wrapper });

    await waitFor(() => expect(result.current.isGoogleLinked).toBe(true));
  });

  it("reports Google as unlinked for an email/password-only account", async () => {
    listAccounts.mockResolvedValue({
      data: [{ providerId: "credential" }],
      error: null,
    });
    const { result } = renderHook(() => useGoogleLink(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isGoogleLinked).toBe(false);
  });

  it("reports a password credential when one exists", async () => {
    listAccounts.mockResolvedValue({
      data: [{ providerId: "credential" }],
      error: null,
    });
    const { result } = renderHook(() => useGoogleLink(), { wrapper });

    await waitFor(() => expect(result.current.isPasswordEnabled).toBe(true));
  });

  // Found in self-review: the section hardcoded "Email & Password — Active", which
  // is false for an account created through Google.
  it("reports no password for a Google-only account", async () => {
    listAccounts.mockResolvedValue({
      data: [{ providerId: "google" }],
      error: null,
    });
    const { result } = renderHook(() => useGoogleLink(), { wrapper });

    await waitFor(() => expect(result.current.isGoogleLinked).toBe(true));
    expect(result.current.isPasswordEnabled).toBe(false);
  });

  // The other half of the flow: a link can fail AFTER the browser has left the app,
  // arriving back as `#/profile?error=<code>` with no promise pending to catch it.
  describe("post-redirect failures", () => {
    it("surfaces an error carried back in the URL fragment", async () => {
      window.location.hash = "#/profile?error=account_already_linked_to_different_user";
      const { result } = renderHook(() => useGoogleLink(), { wrapper });

      expect(result.current.error).toMatch(/already connected to another/i);
    });

    it("starts clean when the redirect carried no error", async () => {
      window.location.hash = "#/profile";
      const { result } = renderHook(() => useGoogleLink(), { wrapper });

      expect(result.current.error).toBeNull();
    });
  });

  it("does not query while signed out", async () => {
    isAuthenticated = false;
    const { result } = renderHook(() => useGoogleLink(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(listAccounts).not.toHaveBeenCalled();
  });

  // "Checking…" forever is worse than "not connected": it hides the Connect button
  // with no way for the user to act.
  it("stops loading when the account list fails", async () => {
    listAccounts.mockResolvedValue({ data: null, error: { code: "BOOM" } });
    const { result } = renderHook(() => useGoogleLink(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isGoogleLinked).toBe(false);
  });

  describe("connect", () => {
    it("delegates to linkGoogle", async () => {
      linkGoogle.mockResolvedValue(undefined);
      const { result } = renderHook(() => useGoogleLink(), { wrapper });

      await act(async () => {
        await result.current.connect();
      });

      expect(linkGoogle).toHaveBeenCalledTimes(1);
    });

    // On success the browser is already navigating to Google. Re-enabling the button
    // would let a second click mint a second OAuth state mid-redirect.
    it("stays disabled after a successful start", async () => {
      linkGoogle.mockResolvedValue(undefined);
      const { result } = renderHook(() => useGoogleLink(), { wrapper });

      await act(async () => {
        await result.current.connect();
      });

      expect(result.current.isConnecting).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it("surfaces a mapped message and re-enables the button on failure", async () => {
      linkGoogle.mockRejectedValue(
        new AuthClientError(
          { code: "LINKING_DIFFERENT_EMAILS_NOT_ALLOWED" },
          "fallback",
        ),
      );
      const { result } = renderHook(() => useGoogleLink(), { wrapper });

      await act(async () => {
        await result.current.connect();
      });

      expect(result.current.error).toContain("different email address");
      // Re-enabled: the failure is recoverable and the user may want to retry with a
      // different Google account.
      expect(result.current.isConnecting).toBe(false);
    });

    it("falls back to a linking message for an unrecognised failure", async () => {
      linkGoogle.mockRejectedValue(new Error("network died"));
      const { result } = renderHook(() => useGoogleLink(), { wrapper });

      await act(async () => {
        await result.current.connect();
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.isConnecting).toBe(false);
    });

    it("clears a previous error when retried", async () => {
      linkGoogle.mockRejectedValueOnce(new Error("first"));
      const { result } = renderHook(() => useGoogleLink(), { wrapper });

      await act(async () => {
        await result.current.connect();
      });
      expect(result.current.error).toBeTruthy();

      linkGoogle.mockResolvedValueOnce(undefined);
      await act(async () => {
        await result.current.connect();
      });
      expect(result.current.error).toBeNull();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HomeRedirect, SchoolSetupGate } from "./App";
import { BackendAPI } from "./services/backend";

/**
 * The first-run fee-setup gate, exercised as the real component from App.tsx
 * rather than a copy — a duplicated gate body could pass here while the routed
 * one is broken.
 */

vi.mock("./services/backend", () => ({
  BackendAPI: { school: { getMyFees: vi.fn() } },
  // Reached through RealtimeManager → useRealtime → services/reachability, which
  // builds its /health probe URL from this.
  API_URL: "http://api.test",
}));

const authState = {
  userRole: "school_owner" as string | null,
  user: { id: "u1" } as { id: string } | null,
};
vi.mock("./context/AuthContext", () => ({
  useAuth: () => authState,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const renderApp = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/school-owner-dashboard"]}>
        <Routes>
          <Route
            path="/school-owner-dashboard"
            element={
              <SchoolSetupGate>
                <div>SCHOOL DASHBOARD</div>
              </SchoolSetupGate>
            }
          />
          <Route path="/school/fees" element={<div>FEE SETUP</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("SchoolSetupGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.userRole = "school_owner";
  });

  it("sends a school owner with no published fees to setup", async () => {
    vi.mocked(BackendAPI.school.getMyFees).mockResolvedValue([]);
    renderApp();
    await waitFor(() =>
      expect(screen.getByText("FEE SETUP")).toBeInTheDocument(),
    );
    expect(screen.queryByText("SCHOOL DASHBOARD")).not.toBeInTheDocument();
  });

  it("lets a school owner through once fees are published", async () => {
    vi.mocked(BackendAPI.school.getMyFees).mockResolvedValue([
      { className: "JSS1", feeAmount: 120000 },
    ]);
    renderApp();
    await waitFor(() =>
      expect(screen.getByText("SCHOOL DASHBOARD")).toBeInTheDocument(),
    );
    expect(screen.queryByText("FEE SETUP")).not.toBeInTheDocument();
  });

  it("does not flash the dashboard before the fee check resolves", async () => {
    let resolve!: (v: unknown) => void;
    vi.mocked(BackendAPI.school.getMyFees).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }) as never,
    );

    renderApp();
    // A redirect after the dashboard painted would read as a glitch.
    expect(screen.queryByText("SCHOOL DASHBOARD")).not.toBeInTheDocument();
    expect(screen.queryByText("FEE SETUP")).not.toBeInTheDocument();

    resolve([{ className: "JSS1", feeAmount: 1 }]);
    await waitFor(() =>
      expect(screen.getByText("SCHOOL DASHBOARD")).toBeInTheDocument(),
    );
  });

  it("does not trap a platform admin previewing this view", async () => {
    authState.userRole = "owner";
    renderApp();

    // /school-payments/fees is SCHOOL_OWNER-only, so an admin 403s there and
    // could never complete setup. The gate must not apply to them at all.
    await waitFor(() =>
      expect(screen.getByText("SCHOOL DASHBOARD")).toBeInTheDocument(),
    );
    expect(BackendAPI.school.getMyFees).not.toHaveBeenCalled();
  });

  it("lets a school owner through when the fee check errors", async () => {
    vi.mocked(BackendAPI.school.getMyFees).mockRejectedValue(
      new Error("network"),
    );
    renderApp();

    // A transient failure must not lock an owner out of their own dashboard.
    await waitFor(() =>
      expect(screen.getByText("SCHOOL DASHBOARD")).toBeInTheDocument(),
    );
  });

  it("ignores the gate for a parent", async () => {
    authState.userRole = "parent";
    renderApp();
    await waitFor(() =>
      expect(screen.getByText("SCHOOL DASHBOARD")).toBeInTheDocument(),
    );
    expect(BackendAPI.school.getMyFees).not.toHaveBeenCalled();
  });
});

/**
 * Resuming an enrollment invite after a sign-in that did not go through
 * `AuthScreen`.
 *
 * The pending-invite check lived ONLY in `AuthScreen`, which is why a Google
 * sign-in stranded the invite: that path never renders AuthScreen at all. It
 * returns through `/auth/callback` and lands here, so a parent who arrived from
 * a WhatsApp link reached their dashboard with the claim token still sitting
 * untouched in sessionStorage — and the only way back was returning to WhatsApp
 * and tapping the link a second time.
 *
 * Every route that can be a post-sign-in destination has to look, which is why
 * this is pinned on the real routed component rather than on AuthScreen alone.
 */
describe("HomeRedirect — resuming an enrollment invite", () => {
  const renderHome = () =>
    render(
      <MemoryRouter initialEntries={["/home"]}>
        <Routes>
          <Route path="/home" element={<HomeRedirect />} />
          <Route path="/dashboard" element={<div>PARENT DASHBOARD</div>} />
          <Route path="/welcome" element={<div>WELCOME</div>} />
          <Route path="/claim-invite" element={<div>CLAIM SCREEN</div>} />
        </Routes>
      </MemoryRouter>,
    );

  beforeEach(() => {
    window.sessionStorage.clear();
    authState.userRole = "parent";
    authState.user = { id: "u1" };
  });

  it("sends a parent holding a pending invite to their claim screen", () => {
    window.sessionStorage.setItem("lopay:pendingInviteToken", "claim-token-1");

    renderHome();

    expect(screen.getByText("CLAIM SCREEN")).toBeInTheDocument();
  });

  it("sends a parent with no pending invite to their dashboard", () => {
    renderHome();

    expect(screen.getByText("PARENT DASHBOARD")).toBeInTheDocument();
  });

  it("does not resume an invite for someone who is not signed in", () => {
    // The claim screen is public, but arriving there from a signed-out redirect
    // would show a "Sign in to continue" button the visitor just came from.
    window.sessionStorage.setItem("lopay:pendingInviteToken", "claim-token-1");
    authState.user = null;

    renderHome();

    expect(screen.getByText("WELCOME")).toBeInTheDocument();
  });
});

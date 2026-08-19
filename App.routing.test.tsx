import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SchoolSetupGate } from "./App";
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

const authState = { userRole: "school_owner" as string | null };
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

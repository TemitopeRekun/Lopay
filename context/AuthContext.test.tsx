import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthContext";

// Better Auth client is the only network dependency AuthProvider touches on
// mount (getSession). Mock it so the auth gate can be tested deterministically.
const getSession = vi.fn();
vi.mock("../services/authClient", () => ({
  authClient: {
    getSession: (...args: unknown[]) => getSession(...args),
    signOut: vi.fn().mockResolvedValue(undefined),
  },
}));

const Probe = () => {
  const { isAuthenticated } = useAuth();
  return <div data-testid="auth">{isAuthenticated ? "yes" : "no"}</div>;
};

describe("AuthProvider auth gate (the signal route guards use)", () => {
  it("reports unauthenticated when there is no active session", async () => {
    getSession.mockResolvedValue({ data: { user: null } });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("auth")).toHaveTextContent("no"),
    );
  });

  it("reports authenticated once a session hydrates (cookie OR bearer)", async () => {
    getSession.mockResolvedValue({
      data: {
        user: {
          id: "u1",
          email: "a@b.com",
          name: "A",
          role: "PARENT",
          schoolId: null,
        },
      },
    });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("auth")).toHaveTextContent("yes"),
    );
  });
});

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import AuthScreen from "./AuthScreen";
import {
  clearPendingInvite,
  peekPendingInvite,
  rememberPendingInvite,
} from "../utils/pendingInvite";

/**
 * Resuming an enrollment-invite claim across sign-up.
 *
 * A parent arrives from a WhatsApp link with no account, is sent here to make
 * one, and has to end up back at their invite — `AuthScreen` otherwise
 * redirects to a role-based home and the token is lost, sending them back to
 * WhatsApp to tap the link again.
 *
 * The subtle half, and the reason this suite exists at all, is StrictMode. The
 * redirect is decided in the render body, so reading the token must be pure.
 * An earlier version CONSUMED it there: React double-invokes component bodies
 * in development, so the first (discarded) render took the token and the
 * second — the one React keeps — found nothing and fell through to the
 * dashboard. Every case below runs inside `React.StrictMode` deliberately, so
 * that regression cannot come back unnoticed.
 */

let isAuthenticated = true;
let userRole: string | null = "parent";
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated,
    role: userRole,
    login: vi.fn(),
    loginWithGoogle: vi.fn(),
    register: vi.fn(),
  }),
}));

const renderUnderStrictMode = () =>
  render(
    <React.StrictMode>
      <MemoryRouter initialEntries={["/auth"]}>
        <Routes>
          <Route path="/auth" element={<AuthScreen />} />
          <Route path="/claim-invite" element={<div>CLAIM SCREEN</div>} />
          <Route path="/dashboard" element={<div>PARENT DASHBOARD</div>} />
          <Route
            path="/school-owner-dashboard"
            element={<div>SCHOOL DASHBOARD</div>}
          />
        </Routes>
      </MemoryRouter>
    </React.StrictMode>,
  );

describe("AuthScreen — resuming an enrollment invite", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    isAuthenticated = true;
    userRole = "parent";
  });

  it("sends a newly signed-up parent back to their invite", () => {
    rememberPendingInvite("token-abc");

    renderUnderStrictMode();

    expect(screen.getByText("CLAIM SCREEN")).toBeInTheDocument();
  });

  it("survives StrictMode's double render", () => {
    // The regression, stated directly: a consuming read here yields the token
    // to the discarded first render and nothing to the second.
    rememberPendingInvite("token-abc");

    renderUnderStrictMode();

    expect(screen.queryByText("PARENT DASHBOARD")).not.toBeInTheDocument();
    expect(screen.getByText("CLAIM SCREEN")).toBeInTheDocument();
  });

  it("does not consume the token, leaving that to the claim screen", () => {
    rememberPendingInvite("token-abc");

    renderUnderStrictMode();

    expect(peekPendingInvite()).toBe("token-abc");
  });

  it("falls through to the role home when no invite is held", () => {
    renderUnderStrictMode();

    expect(screen.getByText("PARENT DASHBOARD")).toBeInTheDocument();
  });

  it("stops resuming once the claim screen has cleared the token", () => {
    rememberPendingInvite("token-abc");
    clearPendingInvite();

    renderUnderStrictMode();

    expect(screen.getByText("PARENT DASHBOARD")).toBeInTheDocument();
  });

  it("resumes an invite even for a school owner", () => {
    // A school owner can be a parent at another school. The server authorises
    // the claim on the phone match, not on role, and this redirect must not
    // quietly disagree with it.
    userRole = "school_owner";
    rememberPendingInvite("token-abc");

    renderUnderStrictMode();

    expect(screen.getByText("CLAIM SCREEN")).toBeInTheDocument();
  });
});

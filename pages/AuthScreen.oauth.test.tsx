import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AuthScreen from "./AuthScreen";
import { FIELD_ERROR_MESSAGES } from "../utils/validation/codes";

/**
 * The failure that used to be invisible.
 *
 * A Google sign-in fails in two halves. The first is a request, and its
 * failures were already surfaced. The second happens after the browser has
 * left this app entirely: Google redirects to the API, Better Auth decides, and
 * on refusal it answers `throw ctx.redirect(`${errorURL}?error=<code>`)`. No
 * promise of ours is pending by then, so the `catch` in `handleAuth` cannot
 * fire and never could.
 *
 * The browser simply came back to `#/auth?error=<code>` and this screen
 * rendered a blank sign-up form over the top of it. Reproduced against
 * production before the fix: the page landed on
 * `lopay.netlify.app/#/auth?error=invalid_code` with zero `role="alert"`
 * elements and no error text anywhere in the body. To the person holding the
 * phone, "Continue with Google" simply returned them to the registration form
 * and said nothing.
 *
 * The parsing half — every code, and the hash-vs-search trap that made reading
 * it a silent no-op — is swept in `utils/validation/oauthRedirectErrors.test.ts`.
 * What this suite pins is that the screen actually RENDERS it.
 */

// Layout reaches for DataProvider; it is not what this screen is being tested
// for. Same approach as the other page suites.
vi.mock("../components/Layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: false,
    role: null,
    login: vi.fn(),
    loginWithGoogle: vi.fn(),
    register: vi.fn(),
  }),
}));

let originalLocation: Location;

const renderAt = (hash: string) => {
  originalLocation = window.location;
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: { origin: "https://app.lopay.test", hash, href: "" },
  });

  return render(
    <MemoryRouter initialEntries={["/auth"]}>
      <AuthScreen />
    </MemoryRouter>,
  );
};

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  if (originalLocation) {
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
  }
});

describe("AuthScreen — surfacing an OAuth redirect failure", () => {
  it("renders the refusal a parent hits when their account predates Google", () => {
    // `account_not_linked` is the single most likely code on this screen, and
    // the one whose wording has to be actionable rather than apologetic: the
    // way out is the profile screen, not another go at the same button.
    renderAt("#/auth?error=account_not_linked");

    expect(screen.getByRole("alert")).toHaveTextContent(
      FIELD_ERROR_MESSAGES.GOOGLE_LINK_FROM_PROFILE,
    );
  });

  it("renders a dropped-state failure as something retryable", () => {
    renderAt("#/auth?error=state_mismatch");

    expect(screen.getByRole("alert")).toHaveTextContent(
      FIELD_ERROR_MESSAGES.GOOGLE_RETRY,
    );
  });

  it("names the way in that still works when Google itself is unavailable", () => {
    renderAt("#/auth?error=google_unavailable");

    expect(screen.getByRole("alert")).toHaveTextContent(
      FIELD_ERROR_MESSAGES.GOOGLE_UNAVAILABLE,
    );
  });

  it("still says something for a code it has never seen", () => {
    // Better Auth may add codes. Rendering nothing for an unknown one would
    // recreate the original bug in a new place, which is the whole point.
    renderAt("#/auth?error=some_code_from_a_future_version");

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("shows nothing at all on an ordinary visit", () => {
    renderAt("#/auth");

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("reads the fragment, not the query string", () => {
    // The app is hash-routed, so Better Auth appends its query AFTER the `#`
    // and `window.location.search` is empty. Reading the wrong one is a silent
    // no-op — exactly the failure being fixed — so the two are pinned apart.
    originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: {
        origin: "https://app.lopay.test",
        hash: "#/auth",
        search: "?error=account_not_linked",
        href: "",
      },
    });

    render(
      <MemoryRouter initialEntries={["/auth"]}>
        <AuthScreen />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("clears the banner once the parent starts typing", async () => {
    // It describes a trip that is over. Leaving it above a form they are now
    // filling in is just noise.
    renderAt("#/auth?error=account_not_linked");
    expect(screen.getByRole("alert")).toBeInTheDocument();

    await userEvent.type(screen.getByTestId("auth-email"), "a");

    expect(screen.queryByRole("alert")).toBeNull();
  });
});

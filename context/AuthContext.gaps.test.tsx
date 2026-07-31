import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthContext";

// Covers the behaviour the existing AuthContext.test.tsx leaves out: login /
// register / logout / updateUser flows plus impersonation (setActingRole /
// switchRole) and localStorage hydration. Only the auth client, the backend
// profile call and the query client are mocked — normalizeUser runs for real.
const M = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInEmail: vi.fn(),
  signInSocial: vi.fn(),
  signUpEmail: vi.fn(),
  signOut: vi.fn(),
  updateMe: vi.fn(),
  queryClear: vi.fn(),
}));

vi.mock("../services/authClient", () => ({
  authClient: {
    getSession: (...a: unknown[]) => M.getSession(...a),
    signIn: {
      email: (...a: unknown[]) => M.signInEmail(...a),
      social: (...a: unknown[]) => M.signInSocial(...a),
    },
    signUp: { email: (...a: unknown[]) => M.signUpEmail(...a) },
    signOut: (...a: unknown[]) => M.signOut(...a),
  },
}));
vi.mock("../services/backend", () => ({
  API_URL: "http://api.test",
  BackendAPI: { users: { updateMe: (...a: unknown[]) => M.updateMe(...a) } },
}));
vi.mock("../services/queryClient", () => ({
  queryClient: { clear: (...a: unknown[]) => M.queryClear(...a) },
}));

let auth: ReturnType<typeof useAuth>;
const Probe = () => {
  auth = useAuth();
  return (
    <div>
      <span data-testid="isAuth">{auth.isAuthenticated ? "yes" : "no"}</span>
      <span data-testid="role">{auth.role ?? "null"}</span>
      <span data-testid="effectiveRole">{auth.effectiveRole ?? "null"}</span>
      <span data-testid="userRole">{auth.userRole ?? "null"}</span>
      <span data-testid="isOwner">{auth.isOwnerAccount ? "yes" : "no"}</span>
      <span data-testid="actingRole">{auth.actingRole ?? "null"}</span>
      <span data-testid="activeSchoolId">{auth.activeSchoolId ?? "null"}</span>
      <span data-testid="actingUserId">{auth.actingUserId ?? "null"}</span>
      <span data-testid="userName">{auth.user?.name ?? "null"}</span>
      <span data-testid="userPhone">{auth.user?.phoneNumber ?? "null"}</span>
      <span data-testid="userSchoolId">{auth.user?.schoolId ?? "null"}</span>
      <span data-testid="token">{auth.token ?? "null"}</span>
    </div>
  );
};

const session = (user: Record<string, unknown> | null) => ({
  data: { user },
});

const OWNER_SESSION = session({
  id: "u1",
  email: "owner@lopay.com",
  name: "Olu Owner",
  role: "owner",
  schoolId: null,
});
const PARENT_SESSION = session({
  id: "p1",
  email: "parent@lopay.com",
  name: "Pat Parent",
  role: "PARENT",
  schoolId: null,
});

const renderAuth = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  M.getSession.mockReset().mockResolvedValue(session(null));
  M.signInEmail.mockReset().mockResolvedValue({ error: null });
  M.signInSocial.mockReset().mockResolvedValue(undefined);
  M.signUpEmail.mockReset().mockResolvedValue({ error: null });
  M.signOut.mockReset().mockResolvedValue(undefined);
  M.updateMe.mockReset();
  M.queryClear.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AuthProvider — session hydration on mount", () => {
  it("hydrates a saved user from localStorage when the session refresh fails", async () => {
    localStorage.setItem("accessToken", "tok");
    localStorage.setItem(
      "user",
      JSON.stringify({
        id: "u9",
        email: "z@z.com",
        fullName: "Zed Saved",
        role: "PARENT",
      }),
    );
    M.getSession.mockRejectedValue(new Error("no session"));

    renderAuth();

    await waitFor(() =>
      expect(screen.getByTestId("userName")).toHaveTextContent("Zed Saved"),
    );
    expect(screen.getByTestId("isAuth")).toHaveTextContent("yes");
  });

  it("drops a corrupt saved user and stays unauthenticated", async () => {
    localStorage.setItem("accessToken", "tok");
    localStorage.setItem("user", "not-json");
    M.getSession.mockResolvedValue(session(null));

    renderAuth();

    await waitFor(() => expect(M.getSession).toHaveBeenCalled());
    expect(screen.getByTestId("isAuth")).toHaveTextContent("no");
    expect(localStorage.getItem("user")).toBeNull();
  });
});

describe("AuthProvider — login / register / logout", () => {
  it("logs in via email and hydrates the session user", async () => {
    M.getSession
      .mockResolvedValueOnce(session(null)) // mount
      .mockResolvedValue(PARENT_SESSION); // login hydrate

    renderAuth();
    await waitFor(() =>
      expect(screen.getByTestId("isAuth")).toHaveTextContent("no"),
    );

    let returned: any;
    await act(async () => {
      returned = await auth.login("parent@lopay.com", "pw");
    });

    expect(M.signInEmail).toHaveBeenCalledWith({
      email: "parent@lopay.com",
      password: "pw",
    });
    expect(returned.name).toBe("Pat Parent");
    expect(screen.getByTestId("isAuth")).toHaveTextContent("yes");
    expect(localStorage.getItem("user")).toContain("parent@lopay.com");
  });

  it("propagates a login error from the auth client", async () => {
    M.signInEmail.mockResolvedValue({
      error: { message: "Invalid email or password" },
    });

    renderAuth();
    await waitFor(() => expect(M.getSession).toHaveBeenCalled());

    await act(async () => {
      await expect(auth.login("a@b.com", "bad")).rejects.toThrow(
        "Invalid email or password",
      );
    });
  });

  it("starts the Google redirect flow with a home callback", async () => {
    renderAuth();
    await waitFor(() => expect(M.getSession).toHaveBeenCalled());

    await act(async () => {
      await auth.loginWithGoogle();
    });

    expect(M.signInSocial).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: expect.stringContaining("/#/home"),
    });
  });

  it("registers a parent, defaulting the role server-side", async () => {
    M.getSession
      .mockResolvedValueOnce(session(null))
      .mockResolvedValue(PARENT_SESSION);

    renderAuth();
    await waitFor(() => expect(M.getSession).toHaveBeenCalled());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await auth.register({
        email: "new@lopay.com",
        password: "secret",
        fullName: "New Parent",
        phoneNumber: "0800",
        role: "PARENT",
      });
    });

    expect(ok).toBe(true);
    expect(M.signUpEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "new@lopay.com",
        password: "secret",
        name: "New Parent",
        role: "PARENT",
        phoneNumber: "0800",
      }),
    );
  });

  it("propagates a registration error", async () => {
    M.signUpEmail.mockResolvedValue({ error: { message: "Email exists" } });

    renderAuth();
    await waitFor(() => expect(M.getSession).toHaveBeenCalled());

    await act(async () => {
      await expect(
        auth.register({
          email: "dup@lopay.com",
          password: "x",
          fullName: "Dup",
          phoneNumber: "1",
          role: "PARENT",
        }),
      ).rejects.toThrow("Email exists");
    });
  });

  it("logs out: clears state, revokes the session and empties the cache", async () => {
    localStorage.setItem("accessToken", "tok");
    M.getSession.mockResolvedValue(PARENT_SESSION);

    renderAuth();
    await waitFor(() =>
      expect(screen.getByTestId("isAuth")).toHaveTextContent("yes"),
    );

    await act(async () => {
      auth.logout();
    });

    expect(screen.getByTestId("isAuth")).toHaveTextContent("no");
    expect(screen.getByTestId("token")).toHaveTextContent("null");
    expect(M.signOut).toHaveBeenCalled();
    expect(localStorage.getItem("accessToken")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
    await waitFor(() => expect(M.queryClear).toHaveBeenCalled());
  });

  it("logs out when a lopay:unauthorized event fires", async () => {
    M.getSession.mockResolvedValue(PARENT_SESSION);

    renderAuth();
    await waitFor(() =>
      expect(screen.getByTestId("isAuth")).toHaveTextContent("yes"),
    );

    await act(async () => {
      window.dispatchEvent(new Event("lopay:unauthorized"));
    });

    expect(screen.getByTestId("isAuth")).toHaveTextContent("no");
  });
});

describe("AuthProvider — updateUser", () => {
  it("updates the profile via PATCH /users/me and persists it", async () => {
    M.getSession.mockResolvedValue(PARENT_SESSION);
    M.updateMe.mockResolvedValue({
      id: "p1",
      email: "parent@lopay.com",
      fullName: "Renamed Parent",
      role: "PARENT",
      phoneNumber: "0999",
    });

    renderAuth();
    await waitFor(() =>
      expect(screen.getByTestId("isAuth")).toHaveTextContent("yes"),
    );

    await act(async () => {
      await auth.updateUser({ name: "Renamed Parent", phoneNumber: "0999" });
    });

    expect(M.updateMe).toHaveBeenCalledWith({
      fullName: "Renamed Parent",
      phoneNumber: "0999",
    });
    expect(screen.getByTestId("userName")).toHaveTextContent("Renamed Parent");
    expect(localStorage.getItem("user")).toContain("Renamed Parent");
  });

  it("keeps the phone number the session returns", async () => {
    // Better Auth exposes phoneNumber as an additionalField on the session.
    // Dropping it here made every "has this parent given us a number?" check
    // read false after a reload, so the enrollment prompt fired for everyone.
    M.getSession.mockResolvedValue(
      session({
        id: "p1",
        email: "parent@lopay.com",
        name: "Pat Parent",
        role: "PARENT",
        phoneNumber: "08012345678",
        schoolId: null,
      }),
    );

    renderAuth();

    await waitFor(() =>
      expect(screen.getByTestId("userPhone")).toHaveTextContent("08012345678"),
    );
    expect(localStorage.getItem("user")).toContain("08012345678");
  });

  it("merges the PATCH projection onto the current user instead of replacing it", async () => {
    // PATCH /users/me returns a narrow projection with no schoolId — replacing
    // wholesale would knock a school owner out of their school on a phone edit.
    M.getSession.mockResolvedValue(
      session({
        id: "s1",
        email: "bursar@school.com",
        name: "Sam Bursar",
        role: "SCHOOL_OWNER",
        schoolId: "school-7",
      }),
    );
    M.updateMe.mockResolvedValue({
      id: "s1",
      email: "bursar@school.com",
      fullName: "Sam Bursar",
      role: "SCHOOL_OWNER",
      phoneNumber: "08012345678",
    });

    renderAuth();
    await waitFor(() =>
      expect(screen.getByTestId("userSchoolId")).toHaveTextContent("school-7"),
    );

    await act(async () => {
      await auth.updateUser({ phoneNumber: "08012345678" });
    });

    expect(screen.getByTestId("userPhone")).toHaveTextContent("08012345678");
    expect(screen.getByTestId("userSchoolId")).toHaveTextContent("school-7");
  });

  it("sends only the phone number when that's all that changed", async () => {
    M.getSession.mockResolvedValue(PARENT_SESSION);
    M.updateMe.mockResolvedValue({
      id: "p1",
      email: "parent@lopay.com",
      fullName: "Pat Parent",
      role: "PARENT",
      phoneNumber: "08012345678",
    });

    renderAuth();
    await waitFor(() =>
      expect(screen.getByTestId("isAuth")).toHaveTextContent("yes"),
    );

    await act(async () => {
      await auth.updateUser({ phoneNumber: "08012345678" });
    });

    // fullName undefined → the backend DTO leaves the name untouched.
    expect(M.updateMe).toHaveBeenCalledWith({
      fullName: undefined,
      phoneNumber: "08012345678",
    });
    expect(screen.getByTestId("userName")).toHaveTextContent("Pat Parent");
  });

  it("throws when updating with no logged-in user", async () => {
    M.getSession.mockResolvedValue(session(null));

    renderAuth();
    await waitFor(() => expect(M.getSession).toHaveBeenCalled());

    await act(async () => {
      await expect(auth.updateUser({ name: "x" })).rejects.toThrow(
        "No user logged in",
      );
    });
    expect(M.updateMe).not.toHaveBeenCalled();
  });

  it("propagates a backend error from the profile update", async () => {
    M.getSession.mockResolvedValue(PARENT_SESSION);
    M.updateMe.mockRejectedValue(new Error("network down"));

    renderAuth();
    await waitFor(() =>
      expect(screen.getByTestId("isAuth")).toHaveTextContent("yes"),
    );

    await act(async () => {
      await expect(auth.updateUser({ name: "x" })).rejects.toThrow(
        "network down",
      );
    });
  });
});

describe("AuthProvider — impersonation & derived roles", () => {
  it("exposes owner-derived flags after hydration", async () => {
    M.getSession.mockResolvedValue(OWNER_SESSION);

    renderAuth();
    await waitFor(() =>
      expect(screen.getByTestId("userRole")).toHaveTextContent("owner"),
    );
    expect(screen.getByTestId("isOwner")).toHaveTextContent("yes");
    expect(screen.getByTestId("effectiveRole")).toHaveTextContent("owner");
  });

  it("setActingRole overrides the effective role with a school + user id", async () => {
    M.getSession.mockResolvedValue(OWNER_SESSION);

    renderAuth();
    await waitFor(() =>
      expect(screen.getByTestId("userRole")).toHaveTextContent("owner"),
    );

    act(() => {
      auth.setActingRole("parent" as any, "school-9", "user-2");
    });

    expect(screen.getByTestId("actingRole")).toHaveTextContent("parent");
    expect(screen.getByTestId("activeSchoolId")).toHaveTextContent("school-9");
    expect(screen.getByTestId("actingUserId")).toHaveTextContent("user-2");
    expect(screen.getByTestId("effectiveRole")).toHaveTextContent("parent");
    expect(screen.getByTestId("role")).toHaveTextContent("parent");
  });

  it("setActingRole clears school/user ids when they are omitted", async () => {
    M.getSession.mockResolvedValue(OWNER_SESSION);

    renderAuth();
    await waitFor(() =>
      expect(screen.getByTestId("userRole")).toHaveTextContent("owner"),
    );

    act(() => {
      auth.setActingRole("parent" as any);
    });

    expect(screen.getByTestId("activeSchoolId")).toHaveTextContent("null");
    expect(screen.getByTestId("actingUserId")).toHaveTextContent("null");
  });

  it("setActingRole is a no-op with no logged-in user", async () => {
    M.getSession.mockResolvedValue(session(null));

    renderAuth();
    await waitFor(() => expect(M.getSession).toHaveBeenCalled());

    act(() => {
      auth.setActingRole("parent" as any, "s", "u");
    });

    expect(screen.getByTestId("actingRole")).toHaveTextContent("null");
  });

  it("switchRole toggles an owner between owner and parent views", async () => {
    M.getSession.mockResolvedValue(OWNER_SESSION);

    renderAuth();
    await waitFor(() =>
      expect(screen.getByTestId("userRole")).toHaveTextContent("owner"),
    );

    act(() => auth.switchRole());
    expect(screen.getByTestId("actingRole")).toHaveTextContent("parent");
    expect(screen.getByTestId("effectiveRole")).toHaveTextContent("parent");

    act(() => auth.switchRole());
    expect(screen.getByTestId("actingRole")).toHaveTextContent("null");
    expect(screen.getByTestId("effectiveRole")).toHaveTextContent("owner");
  });

  it("switchRole does nothing for a non-owner user", async () => {
    M.getSession.mockResolvedValue(PARENT_SESSION);

    renderAuth();
    await waitFor(() =>
      expect(screen.getByTestId("userRole")).toHaveTextContent("parent"),
    );

    act(() => auth.switchRole());
    expect(screen.getByTestId("actingRole")).toHaveTextContent("null");
    expect(screen.getByTestId("effectiveRole")).toHaveTextContent("parent");
  });
});

describe("useAuth guard", () => {
  it("throws when used outside an AuthProvider", () => {
    const Solo = () => {
      useAuth();
      return null;
    };
    expect(() => render(<Solo />)).toThrow(
      "useAuth must be used within an AuthProvider",
    );
  });
});

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { authClient } from "../services/authClient";
import {
  User,
  UserRole,
  ApiUser,
  RegisterData,
} from "../types";
import { API_URL, BackendAPI } from "../services/backend";
import { normalizeUser } from "../services/adapters";
import { throwIfError } from "../services/authErrors";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  role: UserRole | null;
  isOwnerAccount: boolean;
  token: string | null;
  login: (email: string, password?: string) => Promise<User>;
  /** Start a Google sign-in. `next` is a bare in-app route to resume on. */
  loginWithGoogle: (next?: string) => Promise<void>;
  /** Finish one, from the one-time token the redirect carried back. */
  completeOAuthHandoff: (token: string) => Promise<User>;
  /** Attach Google to the already-signed-in account. See the implementation. */
  linkGoogle: () => Promise<void>;
  logout: () => void;
  register: (data: RegisterData) => Promise<boolean>;
  updateUser: (user: Partial<User>) => Promise<void>;

  // There is deliberately NO role-switching machinery here. Impersonation and
  // the acting-role "preview" were both removed: neither ever reached the
  // server, so the views they produced were the caller's own session data
  // wearing another label — misleading rather than useful. `role` and
  // `userRole` are the same value (the session's real role); both names are
  // kept because call sites grew up reading one or the other.
  userRole: UserRole | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("accessToken"),
  );

  // Hydrate from localStorage immediately (fast/offline), then refresh from the
  // Better Auth session in the background — this also captures a session created
  // by the Google redirect return. A failed refresh is non-destructive.
  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (token && savedUser) {
      try {
        setUser(normalizeUser(JSON.parse(savedUser)));
      } catch (e) {
        console.error("Failed to parse saved user", e);
        localStorage.removeItem("user");
      }
    }
    hydrateFromSession().catch(() => {
      /* no active session — keep any localStorage user; routes guard the rest */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Pull the current Better Auth session, normalize the user, and persist the
   * bearer token + user for the axios client. The bearer plugin returns a fresh
   * `set-auth-token` header on this call, which authClient's onSuccess stores.
   */
  const hydrateFromSession = async (): Promise<User> => {
    const { data } = await authClient.getSession();
    if (!data?.user) {
      throw new Error("No active session");
    }
    const u = data.user as {
      id: string;
      email: string;
      name?: string;
      role?: string;
      phoneNumber?: string | null;
      schoolId?: string | null;
    };
    const apiUser: ApiUser = {
      id: u.id,
      email: u.email,
      fullName: u.name,
      role: u.role,
      // `phoneNumber` is a Better Auth additionalField and comes back on the
      // session. Omitting it here blanked the number on every reload, which made
      // "has this parent given us a phone?" checks read false for everyone.
      phoneNumber: u.phoneNumber ?? undefined,
      schoolId: u.schoolId ?? undefined,
    } as ApiUser;

    const normalizedUser = normalizeUser(apiUser);
    setToken(localStorage.getItem("accessToken"));
    setUser(normalizedUser);
    localStorage.setItem("user", JSON.stringify(apiUser));
    return normalizedUser;
  };

  const login = async (email: string, password?: string) => {
    try {
      const { error } = await authClient.signIn.email({
        email,
        password: password || "",
      });
      if (error) {
        throw new Error(error.message || "Invalid email or password");
      }
      return await hydrateFromSession();
    } catch (error) {
      console.error("Login failed", error);
      throw error;
    }
  };

  /**
   * Start a Google sign-in by handing the whole browser to the API.
   *
   * ## Why this is a navigation and not a call
   *
   * It used to be `authClient.signIn.social(...)`, a cross-origin `fetch`. That
   * fetch is where Better Auth sets the OAuth state cookie — and because the
   * API is on a different SITE to this app, the browser files that cookie as
   * third-party. The callback then reads it during a top-level navigation where
   * the API is first-party, which is a different jar. Safari refuses the write,
   * Firefox partitions it out of reach, and Chrome only appeared to work
   * because it still allows unpartitioned third-party cookies. Production has
   * never recorded a single Google account as a result.
   *
   * Navigating instead of fetching makes the state cookie first-party on both
   * the write and the read, so Better Auth's CSRF check on it works exactly as
   * designed. The session comes back as a one-time token in the fragment, which
   * `/auth/callback` exchanges. See the backend's `auth/oauth-handoff.ts`.
   *
   * ## Why nothing is awaited
   *
   * There is no promise to check any more, and no error to catch: assigning
   * `location.href` unloads this document. Every failure from here on is the
   * API's to redirect, which it does into `#/auth?error=<code>` — read by
   * `AuthScreen`, worded by `utils/validation/oauthRedirectErrors.ts`. That is
   * the half that used to vanish silently.
   *
   * `next` is a bare in-app route with no query string; the server rejects
   * anything else. A pending enrollment invite is NOT passed here — it stays in
   * `sessionStorage`, which survives the round trip because this is the same
   * tab on the same origin, and putting a claim token in a query string would
   * write a bearer credential into the API's access log.
   */
  const loginWithGoogle = async (next?: string) => {
    window.location.href = `${API_URL}/api/v1/auth/google/start${googleStartQuery(next)}`;
  };

  /**
   * Finish a Google sign-in from the one-time token the redirect carried back.
   *
   * This is the moment the app stops being signed out. The verify call is an
   * ordinary CORS request with no cookie of its own; the response sets a
   * session cookie on the API's origin, which makes the `bearer` plugin emit
   * `set-auth-token`, which `authClient`'s `onSuccess` persists. Hydrating
   * afterwards is what populates `user` and flips `isAuthenticated`.
   */
  const completeOAuthHandoff = async (token: string): Promise<User> => {
    const result = await authClient.oneTimeToken.verify({ token });
    throwIfError(
      result,
      "That sign-in link has already been used or has expired. Please try again.",
    );
    return await hydrateFromSession();
  };

  /**
   * Attach Google to the account that is ALREADY signed in.
   *
   * ## What this is for, now that sign-in can link on its own
   *
   * It no longer has to exist as a workaround. `requireLocalEmailVerified` is
   * false on the server (see the backend's `auth/auth.config.ts`), so
   * "Continue with Google" attaches itself to a matching email/password account
   * rather than dead-ending — which is what it was originally written to route
   * around.
   *
   * It stays because it is the deliberate, opt-in version of the same act, and
   * the two differ in who is asking. Here the session is the proof of ownership:
   * the person connecting Google has already signed in with the password, so
   * there is no question of a stranger's Google identity landing on someone
   * else's account. It is also the only way to connect a Google account whose
   * email is DIFFERENT from the one already on file, which sign-in linking —
   * which matches on email — cannot do by construction.
   */
  const linkGoogle = async () => {
    // Same third-party-cookie problem as `loginWithGoogle`, and the same answer:
    // the flow has to BEGIN with a top-level navigation to the API so the OAuth
    // state cookie is first-party. `authClient.linkSocial` cannot do that — it
    // is a cross-origin fetch, which is precisely what strands the cookie.
    //
    // The extra difficulty here is proving who is asking. A navigation carries
    // no `Authorization` header and the API's session cookie is third-party to
    // this app, so the browser would arrive anonymous. A one-time token bridges
    // it: minted here with the bearer credential we already hold, spent by the
    // API on arrival to recover the session. It is single-use and expires in
    // three minutes, so the copy left in an access log is spent before the log
    // is written.
    const minted = await authClient.oneTimeToken.generate();
    throwIfError(
      minted,
      "Could not connect your Google account. Please try again.",
    );

    const ticket = minted.data?.token;
    if (!ticket) {
      throw new Error("Could not connect your Google account. Please try again.");
    }

    window.location.href =
      `${API_URL}/api/v1/auth/google/link/start` +
      `?ticket=${encodeURIComponent(ticket)}` +
      `&return_to=${encodeURIComponent(window.location.origin)}`;
  };

  const logout = () => {
    setToken(null);
    setUser(null);

    // Revoke the server session (best-effort), then clear local state.
    authClient.signOut().catch(() => undefined);

    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    // Also clear any query cache
    import("../services/queryClient").then(({ queryClient }) => {
      queryClient.clear();
    });
  };

  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("lopay:unauthorized", handleUnauthorized);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("lopay:unauthorized", handleUnauthorized);
      }
    };
  }, [logout]);

  const register = async (data: RegisterData) => {
    try {
      // role/phoneNumber are Better Auth additionalFields; self-registration is
      // always a PARENT (the domain Parent row is created by a server-side hook).
      const { error } = await authClient.signUp.email({
        email: data.email,
        password: data.password || "",
        name: data.fullName,
        role: "PARENT",
        phoneNumber: data.phoneNumber,
      } as any);
      if (error) {
        throw new Error(error.message || "Registration failed");
      }
      // autoSignIn is enabled server-side; hydrate the new session.
      await hydrateFromSession();
      return true;
    } catch (error) {
      console.error("Registration failed", error);
      throw error;
    }
  };

  const updateUser = async (updatedData: Partial<User>) => {
    try {
      if (!user) throw new Error("No user logged in");

      // Self-service profile update — scoped to the current session server-side
      // (PATCH /users/me), so no id is sent and role/email can't be changed here.
      const result = await BackendAPI.users.updateMe({
        fullName: updatedData.name, // FE `User.name` ↔ API `fullName`
        phoneNumber: updatedData.phoneNumber,
      });

      // PATCH /users/me returns a narrow projection (no schoolId/createdAt), so
      // merge onto the current user rather than replacing it — otherwise saving
      // a phone number would drop a school owner's schoolId from session state.
      const normalized = normalizeUser(result as unknown as ApiUser);
      const merged: User = {
        ...user,
        ...normalized,
        schoolId: normalized.schoolId ?? user.schoolId,
        createdAt: normalized.createdAt ?? user.createdAt,
      };
      setUser(merged);
      localStorage.setItem(
        "user",
        JSON.stringify({
          id: merged.id,
          email: merged.email,
          fullName: merged.name,
          role: merged.role,
          phoneNumber: merged.phoneNumber,
          schoolId: merged.schoolId,
          createdAt: merged.createdAt,
        }),
      );
    } catch (e) {
      console.error("Update user failed", e);
      throw e;
    }
  };

  const userRole = user?.role || null;
  const isOwnerAccount = userRole === "owner";

  return (
    <AuthContext.Provider
      value={{
        user,
        // `user` is the auth source of truth (set by hydrateFromSession in BOTH
        // bearer and cookie mode); the bearer token is an implementation detail
        // of one path, so don't gate auth on it.
        isAuthenticated: !!user,
        role: userRole,
        isOwnerAccount,
        token,
        login,
        loginWithGoogle,
        completeOAuthHandoff,
        linkGoogle,
        logout,
        register,
        updateUser,
        userRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/**
 * The query the API's Google start route is called with.
 *
 * `return_to` is the client telling the server which build it is, so the
 * finished sign-in comes back to the app it started from. It matters because
 * the web client is not the only one: the Capacitor shells serve this same
 * bundle from `https://localhost` (Android) and `capacitor://localhost` (iOS),
 * and a server that always redirected to the Netlify site would walk a native
 * user out of their app and leave them in a browser, signed in to a copy they
 * never opened.
 *
 * It is a claim, not an instruction — the server checks it against the same
 * `trustedOrigins` list Better Auth validates `callbackURL` against, and falls
 * back to the web app for anything else. Sending it is what makes native work;
 * validating it is what stops it being an open redirect.
 */
function googleStartQuery(next?: string): string {
  const query = new URLSearchParams();
  if (next) query.set("next", next);
  if (typeof window !== "undefined") {
    query.set("return_to", window.location.origin);
  }
  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

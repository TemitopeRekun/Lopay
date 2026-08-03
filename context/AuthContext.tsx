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
import { BackendAPI } from "../services/backend";
import { normalizeUser } from "../services/adapters";
import { throwIfError } from "../services/authErrors";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  role: UserRole | null;
  isOwnerAccount: boolean;
  token: string | null;
  login: (email: string, password?: string) => Promise<User>;
  loginWithGoogle: () => Promise<void>;
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

  const loginWithGoogle = async () => {
    // Web: redirect flow. Returns to the app; AuthProvider hydrates on mount.
    //
    // The result MUST be checked. The Better Auth client resolves failures to
    // `{ error }` instead of throwing, so the original `await` here swallowed them:
    // with Google's client id/secret unset the server answers 500, and the button
    // did nothing visible at all — no redirect, no error, no clue. See
    // services/authErrors.ts.
    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL: `${window.location.origin}/#/home`,
      // Where Google's callback sends the user when the SECOND half fails — after
      // the browser has left the app, so no promise of ours is pending and the
      // check above cannot help. Without this, `errorURL` defaults to the API's own
      // `/api/auth/error` page, and the most likely failure here (Better Auth
      // refusing to link Google to an unverified email/password account) stranded
      // the parent on the backend domain. See utils/validation/oauthRedirectErrors.ts.
      errorCallbackURL: `${window.location.origin}/#/auth`,
    });
    throwIfError(result, "Could not start Google sign-in. Please try again.");
  };

  /**
   * Attach Google to the account that is ALREADY signed in.
   *
   * This is the fix for a gap that would otherwise need email verification to close.
   * At sign-in, Better Auth refuses to link a Google identity to an existing
   * email/password account unless that account's email is verified
   * (`requireLocalEmailVerified`, default true). This app sends no email at all, so
   * every account is unverified forever and "Continue with Google" on an existing
   * account dead-ends on the backend's error page.
   *
   * `/link-social` takes a different route: the session itself is the proof of
   * ownership, so it links without consulting `emailVerified` at all. Requires no
   * mail domain, and keeps the setting that blocks the pre-hijack takeover — where
   * an attacker pre-registers a victim's address and waits for them to arrive via
   * Google — switched on.
   */
  const linkGoogle = async () => {
    const result = await authClient.linkSocial({
      provider: "google",
      callbackURL: `${window.location.origin}/#/profile`,
      // Post-redirect failures return to the profile screen rather than the API's
      // error page — see the note in loginWithGoogle.
      errorCallbackURL: `${window.location.origin}/#/profile`,
    });
    throwIfError(result, "Could not connect your Google account. Please try again.");
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

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

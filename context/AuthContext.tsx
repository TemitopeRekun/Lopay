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

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  role: UserRole | null;
  isOwnerAccount: boolean;
  token: string | null;
  login: (email: string, password?: string) => Promise<User>;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
  register: (data: RegisterData) => Promise<boolean>;
  updateUser: (user: Partial<User>) => Promise<void>;

  // Impersonation / Context Switching
  actingRole: UserRole | null;
  actingUserId: string | null;
  activeSchoolId: string | null;
  setActingRole: (role: UserRole, schoolId?: string, userId?: string) => void;
  switchRole: () => void;

  // The effective role used for UI permissions (actingRole > user.role)
  effectiveRole: UserRole | null;
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

  // Impersonation State
  const [actingRole, setActingRoleState] = useState<UserRole | null>(null);
  const [actingUserId, setActingUserId] = useState<string | null>(null);
  const [activeSchoolId, setActiveSchoolId] = useState<string | null>(null);

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
      schoolId?: string | null;
    };
    const apiUser: ApiUser = {
      id: u.id,
      email: u.email,
      fullName: u.name,
      role: u.role,
      schoolId: u.schoolId ?? undefined,
    } as ApiUser;

    const normalizedUser = normalizeUser(apiUser);
    setToken(localStorage.getItem("accessToken"));
    setUser(normalizedUser);
    setActingRoleState(null);
    setActingUserId(null);
    setActiveSchoolId(null);
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
    await authClient.signIn.social({
      provider: "google",
      callbackURL: `${window.location.origin}/#/home`,
    });
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setActingRoleState(null);
    setActingUserId(null);
    setActiveSchoolId(null);

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

      // Call backend to update user
      const result = await BackendAPI.users.update({
        ...updatedData,
        id: user.id,
      });

      const normalized = normalizeUser(result as unknown as ApiUser);
      setUser(normalized);
      localStorage.setItem("user", JSON.stringify(result));
    } catch (e) {
      console.error("Update user failed", e);
      throw e;
    }
  };

  const setActingRole = (
    role: UserRole,
    schoolId?: string,
    userId?: string,
  ) => {
    // Acting role is UI-only state (lets an admin preview a parent/school-owner
    // view). It is NOT a privilege grant: every API request still carries the
    // user's real role from the session, and the backend authorizes against that
    // real role — never this acting role — so this cannot escalate access.
    if (!user) return;

    setActingRoleState(role);
    setActiveSchoolId(schoolId || null);
    setActingUserId(userId || null);
  };

  const switchRole = () => {
    if (user?.role === "owner") {
      // Toggle between owner and parent view (or other roles)
      const currentEffectiveRole = actingRole || user.role;

      if (currentEffectiveRole === "owner") {
        setActingRoleState("parent");
        setActingUserId(null); // Be yourself as parent
        setActiveSchoolId(null);
      } else {
        setActingRoleState(null); // Revert to real role (owner)
        setActingUserId(null);
        setActiveSchoolId(null);
      }
    }
  };

  const userRole = user?.role || null;
  const isOwnerAccount = userRole === "owner";
  const effectiveRole = actingRole || userRole;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user && !!token,
        role: effectiveRole, // Expose the effective role as the primary role
        isOwnerAccount,
        token,
        login,
        loginWithGoogle,
        logout,
        register,
        updateUser,

        actingRole,
        actingUserId,
        activeSchoolId,
        setActingRole,
        switchRole,
        effectiveRole,
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

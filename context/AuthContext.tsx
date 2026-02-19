import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../services/firebase";
import {
  User,
  UserRole,
  ApiLoginResponse,
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

  // Hydrate user from localStorage on mount if token exists
  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (token && savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        // Ensure role is normalized
        setUser(normalizeUser(parsed));
      } catch (e) {
        console.error("Failed to parse saved user", e);
        localStorage.removeItem("user");
      }
    }
  }, []);

  const login = async (email: string, password?: string) => {
    try {
      const firebaseUserCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password || "",
      );
      const idToken = await firebaseUserCredential.user.getIdToken();

      const response = await BackendAPI.auth.login(idToken);

      const normalizedUser = normalizeUser(response.user as unknown as ApiUser);

      setToken(response.accessToken);
      setUser(normalizedUser);

      // Reset acting state on login
      setActingRoleState(null);
      setActingUserId(null);
      setActiveSchoolId(null);

      localStorage.setItem("accessToken", response.accessToken);
      localStorage.setItem("user", JSON.stringify(response.user));

      return normalizedUser;
    } catch (error) {
      console.error("Login failed", error);
      throw error;
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setActingRoleState(null);
    setActingUserId(null);
    setActiveSchoolId(null);

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
      await BackendAPI.auth.register(data);

      // Auto-login if password is provided
      if (data.password) {
        await login(data.email, data.password);
      }

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
    // Only allow if authenticated (and ideally if owner, but we trust the UI to check permissions)
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

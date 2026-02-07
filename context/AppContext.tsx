import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useMemo,
  useEffect,
  useCallback,
} from "react";
import {
  Child,
  Notification,
  Transaction,
  School,
  User,
  EnrolledChild,
} from "../types";
import { BackendAPI } from "../services/backend";
import { auth } from "../services/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";

interface AppContextType {
  childrenData: Child[];
  transactions: Transaction[];
  notifications: Notification[];
  schools: School[];
  allUsers: User[];

  addChild: (
    enrollmentData: {
      childName: string;
      schoolId: string;
      grade: string;
      installmentFrequency: string;
      firstPaymentPaid: number;
      termStartDate: string;
      termEndDate: string;
    },
    receiptUrl?: string,
  ) => Promise<void>;
  deleteChild: (childId: string) => void;
  submitPayment: (
    childId: string,
    amount: number,
    receiptUrl?: string,
  ) => Promise<void>;
  addSchool: (school: School) => void;
  refreshSchools: () => Promise<void>;
  updateSchool: (school: School) => Promise<void>;
  deleteSchool: (schoolId: string) => Promise<void>;
  deleteAllSchools: () => Promise<void>;
  refreshData: () => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  updateUser: (user: User) => Promise<void>;
  sendBroadcast: (title: string, message: string) => Promise<void>;
  approvePayment: (transactionId: string) => void;
  declinePayment: (transactionId: string) => Promise<void>;
  updateChildStatus: (childId: string, status: string) => Promise<void>;

  isAuthenticated: boolean;
  currentUser: User | null;
  actingUserId: string | null;
  effectiveUser: User | null;
  userRole: "parent" | "owner" | "school_owner" | "university_student";
  activeSchoolId: string | null;
  isOwnerAccount: boolean;
  isSchoolOwner: boolean;
  isUniversityStudent: boolean;
  login: (email: string, password?: string) => Promise<User>;
  signup: (
    name: string,
    email: string,
    phoneNumber: string,
    password?: string,
    role?: "parent" | "school_owner" | "university_student",
    schoolId?: string,
    bankDetails?: {
      bankName: string;
      accountName: string;
      accountNumber: string;
    },
  ) => Promise<boolean>;
  logout: () => void;
  switchRole: () => void;
  setActingRole: (
    role: "parent" | "owner" | "school_owner" | "university_student",
    schoolId?: string,
    userId?: string,
  ) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const normalizeRole = (
  role?: string,
): "parent" | "owner" | "school_owner" | "university_student" => {
  if (!role) return "parent";
  const lower = role.toLowerCase();
  // Map 'super_admin' (from SUPER_ADMIN) to 'owner'
  if (
    lower === "superadmin" ||
    lower === "admin" ||
    lower === "owner" ||
    lower === "super_admin"
  )
    return "owner";
  if (lower === "school_owner" || lower === "schooladmin")
    return "school_owner";
  if (lower === "university_student" || lower === "student")
    return "university_student";
  return "parent";
};

const normalizeChildStatus = (
  status: string | undefined,
  remainingBalance: number,
  paidAmount?: number,
): "Pending" | "Active" | "Completed" | "Defaulted" | "Failed" => {
  const upperStatus = (status || "PENDING").toUpperCase();

  // 1. Failed / Rejected (Highest Priority)
  if (
    upperStatus === "FAILED" ||
    upperStatus === "REJECTED" ||
    upperStatus === "DECLINED"
  ) {
    return "Failed";
  }

  // 2. Defaulted / Overdue
  if (
    upperStatus === "OVERDUE" ||
    upperStatus === "DEFAULTED" ||
    upperStatus === "OWING"
  ) {
    return "Defaulted";
  }

  // 3. Completed: All payments completed (Backend COMPLETED or Zero Balance)
  if (upperStatus === "COMPLETED" || upperStatus === "PAID") {
    return "Completed";
  }
  if (remainingBalance <= 0) {
    return "Completed";
  }

  // 4. Active: Approved (Partial/Active/Due Soon) OR has paid amount
  if (
    upperStatus === "ACTIVE" ||
    upperStatus === "ON TRACK" ||
    upperStatus === "PARTIAL" ||
    upperStatus === "DUE SOON" ||
    (paidAmount && paidAmount > 0)
  ) {
    return "Active";
  }

  // 5. Pending: Initialized / Not Approved (Fallback)
  return "Pending";
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [allChildren, setAllChildren] = useState<Child[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [allNotifications, setAllNotifications] = useState<Notification[]>([]);

  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const refreshUserData = async (user: User) => {
    try {
      if (user.role === "parent") {
        console.log("Fetching children for parent (User ID):", user.id);
        const children = await BackendAPI.parent.getChildren();
        console.log("Raw children response from API:", children);

        if (!Array.isArray(children)) {
          console.warn("getChildren returned non-array:", children);
          return;
        }

        // Map strictly according to API_GUIDE.md and EnrolledChild type
        const mapped: Child[] = children.map((c: EnrolledChild) => {
          console.log("Mapping child:", c);
          const childName =
            (c as any).child?.fullName || c.childName || "Unknown Child";
          const schoolName =
            (c as any).school?.name || c.schoolName || "Unknown School";

          return {
            id:
              c.id ||
              (c as any)._id ||
              (c as any).enrollmentId ||
              `fallback-${Math.random()}`, // Ensure ID exists
            parentId: user.id,
            name: childName,
            school: schoolName,
            grade: c.className,
            // Calculate financials based on real payments
            totalFee:
              c.remainingBalance +
              ((c.payments || []).reduce(
                (sum: number, p: any) => sum + (p.amount || p.amountPaid || 0),
                0,
              ) || 0),
            paidAmount:
              (c.payments || []).reduce(
                (sum: number, p: any) => sum + (p.amount || p.amountPaid || 0),
                0,
              ) || 0,
            nextInstallmentAmount:
              c.remainingBalance > 0 ? Math.ceil(c.remainingBalance / 3) : 0, // Estimate installment
            nextDueDate: "Pending",
            status: normalizeChildStatus(
              c.paymentStatus,
              c.remainingBalance,
              (c.payments || []).reduce(
                (sum: number, p: any) => sum + (p.amount || p.amountPaid || 0),
                0,
              ),
            ),
            avatarUrl: `https://ui-avatars.com/api/?name=${childName.replace(" ", "+")}&background=random`,
          };
        });
        console.log("Final mapped children:", mapped);
        setAllChildren(mapped);

        // Fetch Notifications
        try {
          const notifs = await BackendAPI.notifications.get();
          const mappedNotifs: Notification[] = (
            Array.isArray(notifs) ? notifs : []
          ).map((n: any) => ({
            id: n.id,
            userId: user.id,
            type: (n.title || "").toLowerCase().includes("payment")
              ? "payment"
              : "announcement",
            title: n.title,
            message: n.message,
            timestamp: n.createdAt || new Date().toISOString(),
            read: n.isRead || false,
            status: "info",
          }));
          setAllNotifications(mappedNotifs);
        } catch (e) {
          console.error("Failed to fetch notifications", e);
        }

        // Fetch real transaction history
        try {
          const history = await BackendAPI.parent.getHistory();
          console.log("Parent history RAW:", history);

          const mappedHistory: Transaction[] = history.map((h: any) => {
            let status = (h.status || "").toUpperCase();

            if (
              status === "CONFIRMED" ||
              status === "SUCCESS" ||
              status === "SUCCESSFUL" ||
              status === "PAID" ||
              status === "COMPLETED"
            ) {
              status = "Successful";
            } else if (
              status === "PENDING" ||
              status === "PROCESSING" ||
              status === "INITIATED" ||
              status === "CREATED"
            ) {
              status = "Pending";
            } else if (
              status === "FAILED" ||
              status === "DECLINED" ||
              status === "REJECTED" ||
              status === "CANCELLED" ||
              status === "REFUNDED"
            ) {
              status = "Failed";
            } else {
              status =
                status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
            }

            const enrollmentId = h.enrollmentId || h.studentId;
            // Try finding child by exact ID match, or loose match if IDs are mixed types
            const child = mapped.find(
              (c) => String(c.id) === String(enrollmentId),
            );

            // Fallback: If parent has only one child, and we can't match ID, assume it's that child (Use with caution, or just use generic name)
            const fallbackName =
              mapped.length === 1 ? mapped[0].name : "My Child";

            const childName =
              h.studentName || h.childName || child?.name || fallbackName;
            const schoolName =
              h.schoolName || child?.school || "Unknown School";

            return {
              id: h.id,
              userId: user.id,
              childName: childName,
              schoolName: schoolName,
              amount: h.amountPaid || h.amount,
              date:
                new Date(h.date).toLocaleDateString() +
                " " +
                new Date(h.date).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              status: status,
              receiptUrl: h.receiptUrl,
            };
          });
          setAllTransactions(mappedHistory);
        } catch (err) {
          console.error("Failed to fetch parent history", err);
          setAllTransactions([]);
        }
      } else if (user.role === "school_owner" || user.role === "owner") {
        if (user.role === "owner") {
          try {
            const users = await BackendAPI.admin.getUsers();
            const mappedUsers: User[] = users.map((u: any) => ({
              ...u,
              role: normalizeRole(u.role),
            }));
            setAllUsers(mappedUsers);
          } catch (e) {
            console.error("Failed to fetch users for admin", e);
          }
        }

        try {
          // Fetch enrolled students first to help resolve names
          const students = await BackendAPI.school.getStudents();
          console.log("School students fetched RAW:", students);

          const studentMap = new Map<string, string>();
          (Array.isArray(students) ? students : []).forEach((s: any) => {
            const id = s.id || s._id || s.enrollmentId;
            const name = s.studentName || s.childName || s.child?.fullName;
            if (id && name) {
              const idStr = String(id);
              studentMap.set(idStr, name);
              // Also map by enrollmentId if available and different
              if (s.enrollmentId && String(s.enrollmentId) !== idStr)
                studentMap.set(String(s.enrollmentId), name);
              // Also map by studentId if available and different
              if (s.studentId && String(s.studentId) !== idStr)
                studentMap.set(String(s.studentId), name);
            }
          });
          console.log("Student Map Keys:", Array.from(studentMap.keys()));

          const mappedStudents: Child[] = (
            Array.isArray(students) ? students : []
          ).map((s: any) => {
            // Calculate financial details based on API Guide structure
            // Use strict checks for remainingBalance to avoid defaulting to 0 if undefined
            let remaining =
              typeof s.remainingBalance === "number"
                ? s.remainingBalance
                : undefined;

            if (remaining === undefined) {
              if (s.totalFee !== undefined && s.paidAmount !== undefined) {
                remaining = s.totalFee - s.paidAmount;
              } else if (s.totalFee !== undefined) {
                remaining = s.totalFee;
              } else {
                // If absolutely no data, assume pending (unpaid) rather than completed
                remaining = s.totalFee || 100000; // Fallback to avoid 0
              }
            }

            const total = s.totalFee || remaining + (s.paidAmount || 0);
            const paid =
              s.paidAmount === undefined ? total - remaining : s.paidAmount;

            const status = normalizeChildStatus(
              s.paymentStatus || s.status,
              remaining,
              paid,
            );

            return {
              id: s.id || s._id || s.enrollmentId,
              parentId: s.parentId || "unknown",
              name:
                s.studentName ||
                s.childName ||
                s.child?.fullName ||
                "Unknown Student",
              schoolId: s.schoolId || user.schoolId,
              school: s.schoolName || s.school?.name || "My School",
              grade: s.className || s.grade,
              totalFee: total > 0 ? total : remaining,
              paidAmount: paid,
              nextInstallmentAmount: s.nextInstallmentAmount || 0,
              nextDueDate: s.nextDueDate || "N/A",
              status: status,
              avatarUrl:
                s.avatarUrl ||
                `https://ui-avatars.com/api/?name=${(s.studentName || s.childName || "User").replace(" ", "+")}&background=random`,
            };
          });
          setAllChildren(mappedStudents);

          // Fetch pending payments
          const pending = await BackendAPI.school.getPendingPayments();
          console.log("Pending payments RAW:", pending);
          const mappedPending: Transaction[] = (
            Array.isArray(pending) ? pending : []
          ).map((p: any) => {
            const pId = p.enrollmentId || p.studentId;
            // Try multiple property names for student name
            const rawName =
              p.studentName || p.childName || p.student_name || p.child_name;
            const mappedName =
              rawName ||
              (pId ? studentMap.get(String(pId)) : undefined) ||
              "Unknown Student";

            if (mappedName === "Unknown Student") {
              console.warn("Failed to map pending payment to student:", p);
            }
            return {
              id: p.id,
              userId: "unknown",
              childId: pId ? String(pId) : undefined,
              childName: mappedName,
              schoolName: "My School",
              amount: p.amountPaid,
              date: p.date,
              status: "Pending",
              receiptUrl: p.receiptUrl,
            };
          });

          // Fetch Notifications for School Owner
          try {
            const notifs = await BackendAPI.notifications.get();
            const mappedNotifs: Notification[] = (
              Array.isArray(notifs) ? notifs : []
            ).map((n: any) => ({
              id: n.id,
              userId: user.id,
              type: "alert",
              title: n.title,
              message: n.message,
              timestamp: n.createdAt || new Date().toISOString(),
              read: n.isRead || false,
              status: "info",
            }));
            setAllNotifications(mappedNotifs);
          } catch (e) {
            console.error("Failed to fetch school notifications", e);
          }

          // Fetch transaction history
          const history = await BackendAPI.school.getTransactions();
          console.log("History transactions RAW:", history);
          const mappedHistory: Transaction[] = (
            Array.isArray(history) ? history : []
          ).map((h: any) => {
            let status = (h.status || "").toUpperCase();

            if (
              status === "CONFIRMED" ||
              status === "SUCCESS" ||
              status === "SUCCESSFUL" ||
              status === "PAID" ||
              status === "COMPLETED"
            ) {
              status = "Successful";
            } else if (
              status === "PENDING" ||
              status === "PROCESSING" ||
              status === "INITIATED" ||
              status === "CREATED"
            ) {
              status = "Pending";
            } else if (
              status === "FAILED" ||
              status === "DECLINED" ||
              status === "REJECTED" ||
              status === "CANCELLED" ||
              status === "REFUNDED"
            ) {
              status = "Failed";
            } else {
              // Fallback for any other status, ensure Title Case
              status =
                status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
            }

            const hId = h.enrollmentId || h.studentId;
            const mappedName =
              h.studentName ||
              h.childName ||
              h.child?.fullName ||
              (hId ? studentMap.get(String(hId)) : undefined) ||
              "Unknown";

            if (mappedName === "Unknown") {
              console.warn("Failed to map history transaction to student:", h);
            }

            return {
              id: h.id,
              userId: "unknown",
              childId: hId ? String(hId) : undefined,
              childName: mappedName,
              schoolName: "My School",
              amount: h.amountPaid || h.amount,
              date: h.date,
              status: status,
              receiptUrl: h.receiptUrl,
            };
          });

          setAllTransactions([...mappedPending, ...mappedHistory]);
        } catch (err) {
          console.error("Failed to fetch school data", err);
        }
      }

      // Fetch Notifications for all roles
      try {
        const notifs = await BackendAPI.notifications.get();
        if (Array.isArray(notifs)) {
          const mappedNotifs: Notification[] = notifs.map((n: any) => {
            let type: "payment" | "announcement" | "alert" = "announcement";
            let status: "success" | "warning" | "error" | "info" = "info";

            const lowerTitle = (n.title || "").toLowerCase();
            const lowerMsg = (n.message || "").toLowerCase();

            if (
              lowerTitle.includes("payment") ||
              lowerTitle.includes("enrollment") ||
              lowerMsg.includes("paid")
            ) {
              type = "payment";
            } else if (
              lowerTitle.includes("alert") ||
              lowerTitle.includes("warning")
            ) {
              type = "alert";
            }

            if (lowerMsg.includes("pending")) status = "warning";
            else if (
              lowerMsg.includes("success") ||
              lowerMsg.includes("confirmed") ||
              lowerMsg.includes("received")
            )
              status = "success";
            else if (lowerMsg.includes("failed") || lowerMsg.includes("error"))
              status = "error";

            return {
              id: n.id,
              userId: user.id,
              type,
              title: n.title,
              message: n.message,
              timestamp:
                new Date(n.createdAt).toLocaleDateString() +
                " " +
                new Date(n.createdAt).toLocaleTimeString(),
              read: n.isRead,
              status,
            };
          });
          setAllNotifications(mappedNotifs);
        }
      } catch (err) {
        console.error("Failed to fetch notifications", err);
      }
    } catch (e) {
      console.error("Data refresh failed", e);
    }
  };

  const refreshSchools = useCallback(async () => {
    try {
      console.log("Refreshing schools...");
      const data = await BackendAPI.public.getSchools();
      if (data && Array.isArray(data)) {
        setSchools(data);
      } else {
        console.warn("getSchools returned invalid data:", data);
      }
    } catch (err) {
      console.error("Failed to refresh schools:", err);
    }
  }, []);

  useEffect(() => {
    // Fetch schools on mount and when user logs in
    refreshSchools();
  }, [currentUser]);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem("accessToken");
      if (token) {
        try {
          // Ideally we decode token to get ID, or store ID.
          // For now, let's assume we can fetch the profile or we need to store user ID.
          // Since the login response gives user ID, we should store it.
          const userId = localStorage.getItem("userId");
          if (userId) {
            const apiUser = await BackendAPI.users.get(userId);
            const user: User = {
              ...apiUser,
              name:
                apiUser.fullName || apiUser.name || apiUser.email.split("@")[0],
              // Ensure other required fields are present or defaulted
              createdAt: apiUser.createdAt || new Date().toISOString(),
              role: normalizeRole(apiUser.role),
            };
            setCurrentUser(user);
            setUserRole(user.role);
            refreshUserData(user);
          }
        } catch (e) {
          console.error("Failed to restore session", e);
          localStorage.removeItem("accessToken");
          localStorage.removeItem("userId");
        }
      }
    };
    initAuth();
  }, []);

  const [actingUserId, setActingUserId] = useState<string | null>(null);

  const effectiveUser = useMemo(() => {
    if (actingUserId)
      return allUsers.find((u) => u.id === actingUserId) || currentUser;
    return currentUser;
  }, [actingUserId, currentUser, allUsers]);

  const isAuthenticated = !!currentUser;
  const [userRole, setUserRole] = useState<
    "parent" | "owner" | "school_owner" | "university_student"
  >(() => {
    return currentUser?.role || "parent";
  });

  const [activeSchoolId, setActiveSchoolId] = useState<string | null>(() => {
    return currentUser?.schoolId || null;
  });

  const isOwnerAccount = currentUser?.role === "owner";
  const isSchoolOwner = currentUser?.role === "school_owner";
  const isUniversityStudent = currentUser?.role === "university_student";

  const childrenData = useMemo(() => {
    if (userRole === "owner" && !actingUserId) return allChildren;

    // For parents, simply return allChildren because refreshUserData already fetched only 'my' children
    // This avoids potential ID mismatches between token user and mapped parentId
    if (userRole === "parent") return allChildren;

    const targetUserId = actingUserId || currentUser?.id;
    const effectiveRole = effectiveUser?.role || userRole;

    if (effectiveRole === "school_owner") {
      // Data is already scoped by the backend API fetch
      return allChildren;
    }
    return allChildren.filter((c) => c.parentId === targetUserId);
  }, [
    allChildren,
    currentUser,
    userRole,
    schools,
    activeSchoolId,
    actingUserId,
    effectiveUser,
  ]);

  const transactions = useMemo(() => {
    // For parents, simply return allTransactions because refreshUserData already fetched only 'my' transactions
    if (userRole === "parent") return allTransactions;

    if (userRole === "owner" && !actingUserId) return allTransactions;
    const targetUserId = actingUserId || currentUser?.id;
    const effectiveRole = effectiveUser?.role || userRole;

    if (effectiveRole === "school_owner") {
      // Data is already scoped by the backend API fetch
      return allTransactions;
    }
    return allTransactions.filter((t) => t.userId === targetUserId);
  }, [
    allTransactions,
    currentUser,
    userRole,
    schools,
    activeSchoolId,
    actingUserId,
    effectiveUser,
  ]);

  const notifications = useMemo(() => {
    if (userRole === "owner" && !actingUserId) return allNotifications;
    const targetUserId = actingUserId || currentUser?.id;
    const effectiveRole = effectiveUser?.role || userRole;

    if (effectiveRole === "school_owner") {
      return allNotifications.filter(
        (n) =>
          n.userId === targetUserId ||
          !n.userId ||
          n.userId === currentUser?.id,
      );
    }
    return allNotifications.filter(
      (n) => n.userId === targetUserId || !n.userId,
    );
  }, [
    allNotifications,
    currentUser,
    userRole,
    actingUserId,
    activeSchoolId,
    effectiveUser,
  ]);

  const login = async (email: string, password?: string) => {
    try {
      if (!password) throw new Error("Password is required");

      if (!auth)
        throw new Error(
          "Authentication service is not initialized. Please check your network or configuration.",
        );

      // 1. Login with Firebase first
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const idToken = await userCredential.user.getIdToken();

      // 2. Send token to backend
      const response = await BackendAPI.auth.login(idToken);

      localStorage.setItem("accessToken", response.accessToken);
      localStorage.setItem("userId", response.user.id);

      // Fetch full profile to get name etc.
      let user: User;
      try {
        const apiUser = await BackendAPI.users.get(response.user.id);
        user = {
          ...apiUser,
          name: apiUser.fullName || apiUser.name || apiUser.email.split("@")[0],
          createdAt: apiUser.createdAt || new Date().toISOString(),
          role: normalizeRole(apiUser.role || response.user.role),
        };
      } catch (e) {
        // Fallback if get user fails
        user = {
          id: response.user.id,
          email: response.user.email,
          role: normalizeRole(response.user.role),
          name: response.user.email.split("@")[0],
          createdAt: new Date().toISOString(),
        };
      }

      setCurrentUser(user);
      setUserRole(user.role as any);
      setActiveSchoolId(user.schoolId || null);
      setActingUserId(null);
      refreshUserData(user);
      return user;
    } catch (e: any) {
      console.error("Login failed", e);
      const msg = e.response?.data?.message || e.message || "Login failed";
      throw new Error(msg);
    }
  };

  const signup = async (
    name: string,
    email: string,
    phoneNumber: string,
    password?: string,
    role: "parent" | "school_owner" | "university_student" = "parent",
    schoolId?: string,
    bankDetails?: {
      bankName: string;
      accountName: string;
      accountNumber: string;
    },
  ) => {
    try {
      if (!password) return false;

      const response = await BackendAPI.auth.register({
        email,
        password,
        confirmPassword: password,
        fullName: name,
        phoneNumber,
        role,
      });

      // Use the token and user data directly from the register response
      localStorage.setItem("accessToken", response.accessToken);
      localStorage.setItem("userId", response.user.id);

      const newUser: User = {
        id: response.user.id,
        name,
        email,
        phoneNumber,
        role,
        schoolId,
        ...bankDetails,
        createdAt: new Date().toISOString(),
      };

      setCurrentUser(newUser);
      setUserRole(role);
      setActiveSchoolId(schoolId || null);
      setActingUserId(null);
      return true;
    } catch (e: any) {
      console.error("Signup failed", e);
      const msg = e.response?.data?.message || e.message || "Signup failed";
      throw new Error(msg);
    }
  };

  const logout = () => {
    setCurrentUser(null);
    setUserRole("parent");
    setActiveSchoolId(null);
    setActingUserId(null);
    localStorage.removeItem("accessToken");
    localStorage.removeItem("userId");
    window.location.href = "#/";
  };

  const switchRole = () => {
    if (currentUser?.role === "owner") {
      const nextRole = userRole === "owner" ? "parent" : "owner";
      setUserRole(nextRole);
      if (nextRole === "owner") {
        setActingUserId(null);
        setActiveSchoolId(null);
      }
    }
  };

  const setActingRole = (
    role: "parent" | "owner" | "school_owner" | "university_student",
    schoolId?: string,
    userId?: string,
  ) => {
    if (currentUser?.role !== "owner") return;
    setUserRole(role);
    setActiveSchoolId(schoolId || null);
    setActingUserId(userId || null);
  };

  const addSchool = (school: School) => {
    setSchools((prev) => [...prev, school]);
  };

  const updateSchool = async (school: School) => {
    try {
      await BackendAPI.admin.updateSchool(school);
      await refreshSchools();
    } catch (e) {
      console.error("Update school failed", e);
      throw e;
    }
  };

  const deleteSchool = async (schoolId: string) => {
    try {
      await BackendAPI.admin.deleteSchool(schoolId);
      await refreshSchools();
    } catch (e) {
      console.error("Delete school failed", e);
      throw e;
    }
  };

  const deleteAllSchools = async () => {
    try {
      const allSchools = await BackendAPI.public.getSchools();
      await Promise.all(
        allSchools.map((s) => BackendAPI.admin.deleteSchool(s.id)),
      );
      await refreshSchools();
    } catch (e) {
      console.error("Delete all schools failed", e);
      throw e;
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      await BackendAPI.admin.deleteUser(userId);
      if (currentUser?.role === "owner") {
        const users = await BackendAPI.admin.getUsers();
        setAllUsers(
          users.map((u: any) => ({ ...u, role: normalizeRole(u.role) })),
        );
      }
    } catch (e) {
      console.error("Delete user failed", e);
      throw e;
    }
  };

  const updateUser = async (user: User) => {
    try {
      await BackendAPI.admin.updateUser(user);
      if (currentUser?.role === "owner") {
        const users = await BackendAPI.admin.getUsers();
        setAllUsers(
          users.map((u: any) => ({ ...u, role: normalizeRole(u.role) })),
        );
      }
      if (currentUser?.id === user.id) {
        setCurrentUser(user);
      }
    } catch (e) {
      console.error("Update user failed", e);
      throw e;
    }
  };

  const addChild = async (
    enrollmentData: {
      childName: string;
      schoolId: string;
      grade: string;
      installmentFrequency: string;
      firstPaymentPaid: number;
      termStartDate: string;
      termEndDate: string;
    },
    receiptUrl?: string,
  ) => {
    const effectiveParentId = actingUserId || currentUser?.id;
    if (!effectiveParentId) return;

    try {
      const payload = {
        childName: enrollmentData.childName,
        schoolId: enrollmentData.schoolId,
        className: enrollmentData.grade,
        installmentFrequency: enrollmentData.installmentFrequency.toUpperCase(),
        firstPaymentPaid: Math.round(enrollmentData.firstPaymentPaid),
        receiptUrl: receiptUrl
          ? receiptUrl.replace(/['"`]/g, "").trim()
          : undefined,
        termStartDate: enrollmentData.termStartDate,
        termEndDate: enrollmentData.termEndDate,
      };

      console.log("Enrollment Payload:", payload);
      await BackendAPI.parent.enroll(payload);

      if (currentUser) {
        await refreshUserData(currentUser);
      }
    } catch (e: any) {
      console.error(
        "Enrollment failed detailed:",
        e.response?.data || e.message,
      );
      if (e.response?.status === 403 && actingUserId) {
        console.error(
          "Action Blocked: You are currently acting as a user (Proxy Mode). The backend likely prohibits enrollment actions from an Admin account token, even when impersonating a parent.",
        );
      }
      throw e;
    }
  };

  const refreshData = async () => {
    if (currentUser) {
      await refreshUserData(currentUser);
    }
  };

  const deleteChild = async (childId: string) => {
    try {
      await BackendAPI.parent.deleteChild(childId);
      await refreshData();
    } catch (e) {
      console.error("Delete child failed", e);
    }
  };

  const sendBroadcast = async (title: string, message: string) => {
    try {
      await BackendAPI.admin.broadcast(title, message);
      await refreshData();
    } catch (e) {
      console.error("Broadcast failed", e);
    }
  };

  const approvePayment = async (transactionId: string) => {
    try {
      // 1. Optimistic / Immediate Local Update
      let approvedAmount = 0;
      let childIdToUpdate: string | undefined;

      setAllTransactions((prev) =>
        prev.map((t) => {
          if (t.id === transactionId) {
            approvedAmount = t.amount;
            childIdToUpdate = t.childId;
            return { ...t, status: "Successful" };
          }
          return t;
        }),
      );

      // 2. Update Child Data if linked
      if (childIdToUpdate && approvedAmount > 0) {
        setAllChildren((prev) =>
          prev.map((c) => {
            if (String(c.id) === String(childIdToUpdate)) {
              const newPaid = c.paidAmount + approvedAmount;
              const newRemaining = c.totalFee - newPaid;
              // Simple status logic, backend is source of truth but this gives instant feedback
              let newStatus = c.status;
              if (newRemaining <= 0) {
                newStatus = "Completed";
              } else if (
                newRemaining > 0 &&
                (c.status === "Overdue" ||
                  c.status === "Defaulted" ||
                  c.status === "Pending" ||
                  c.status === "Inactive")
              ) {
                newStatus = "Active";
              }

              return { ...c, paidAmount: newPaid, status: newStatus };
            }
            return c;
          }),
        );
      }

      await BackendAPI.school.confirmPayment(transactionId);
      if (currentUser) {
        refreshUserData(currentUser).catch((err) =>
          console.error("Background refresh failed", err),
        );
      }
    } catch (e) {
      console.error("Approve payment failed", e);
      alert("Failed to approve payment. Please try again.");
    }
  };

  const declinePayment = async (transactionId: string) => {
    try {
      await BackendAPI.school.declinePayment(transactionId);
      await refreshData();
    } catch (e) {
      console.error("Decline payment failed", e);
    }
  };

  const updateChildStatus = async (childId: string, status: string) => {
    try {
      await BackendAPI.school.updateStudentStatus(childId, status);
      setAllChildren((prev) =>
        prev.map((c) =>
          c.id === childId ? { ...c, status: status as any } : c,
        ),
      );
      alert(`Student status updated to ${status}`);
    } catch (error) {
      console.error("Failed to update status", error);
      alert("Failed to update status");
    }
  };

  const submitPayment = async (
    childId: string,
    amount: number,
    receiptUrl?: string,
  ) => {
    try {
      await BackendAPI.parent.payInstallment(childId, amount, receiptUrl);
      if (currentUser) {
        await refreshUserData(currentUser);
      }
    } catch (e) {
      console.error("Payment failed", e);
      throw e;
    }
  };

  return (
    <AppContext.Provider
      value={{
        childrenData,
        transactions,
        notifications,
        schools,
        allUsers,
        addChild,
        deleteChild,
        submitPayment,
        addSchool,
        refreshSchools,
        updateSchool,
        deleteSchool,
        deleteAllSchools,
        refreshData,
        deleteUser,
        updateUser,
        sendBroadcast,
        approvePayment,
        declinePayment,
        updateChildStatus,
        isAuthenticated,
        currentUser,
        actingUserId,
        effectiveUser,
        userRole,
        activeSchoolId,
        isOwnerAccount,
        isSchoolOwner,
        isUniversityStudent,
        login,
        signup,
        logout,
        switchRole,
        setActingRole,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};

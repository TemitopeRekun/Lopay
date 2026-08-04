import React, { useState, useEffect, lazy, Suspense } from "react";
import {
  HashRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./services/queryClient";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { DataProvider } from "./context/DataContext";
import { useMyClassFees } from "./hooks/useQueries";
import { ToastHost } from "./components/ToastHost";
import { useRealtime } from "./hooks/useRealtime";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";

// Lazy-loaded route components — each chunk is fetched only when first visited.
// The Suspense fallback (SplashScreen) shows during the brief network fetch.
const AuthScreen          = lazy(() => import("./pages/AuthScreen"));
const WelcomeScreen       = lazy(() => import("./pages/WelcomeScreen"));
const Dashboard           = lazy(() => import("./pages/Dashboard"));
const AddChildScreen      = lazy(() => import("./pages/AddChildScreen"));
const CalculatorScreen    = lazy(() => import("./pages/CalculatorScreen"));
const ConfirmPlanScreen   = lazy(() => import("./pages/ConfirmPlanScreen"));
const HistoryScreen       = lazy(() => import("./pages/HistoryScreen"));
const NotificationScreen  = lazy(() => import("./pages/NotificationScreen"));
const PaymentMethodsScreen = lazy(() => import("./pages/PaymentMethodsScreen"));
const ProfileScreen       = lazy(() => import("./pages/ProfileScreen"));
const OwnerDashboard      = lazy(() => import("./pages/OwnerDashboard"));
const SchoolOwnerDashboard = lazy(() => import("./pages/SchoolOwnerDashboard"));
const AddSchoolScreen     = lazy(() => import("./pages/admin/AddSchoolScreen"));
const BroadcastScreen     = lazy(() => import("./pages/admin/BroadcastScreen"));
const DefaultersScreen    = lazy(() => import("./pages/admin/DefaultersScreen"));
const SchoolListScreen    = lazy(() => import("./pages/admin/SchoolListScreen"));
const CalendarScreen      = lazy(() => import("./pages/CalendarScreen"));
const SettingsScreen      = lazy(() => import("./pages/SettingsScreen"));
const SupportScreen       = lazy(() => import("./pages/SupportScreen"));
const UsersListScreen     = lazy(() => import("./pages/admin/UsersListScreen"));
const TermsOfService      = lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy       = lazy(() => import("./pages/PrivacyPolicy"));
const PaymentApprovalsScreen = lazy(() => import("./pages/admin/PaymentApprovalsScreen"));
const SchoolSetupScreen   = lazy(() => import("./pages/SchoolSetupScreen"));
const AuditLogsScreen     = lazy(() => import("./pages/admin/AuditLogsScreen"));
const CollectionsBreakdownScreen = lazy(() => import("./pages/admin/CollectionsBreakdownScreen"));

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error("Unhandled application error", error, info);
  }

  handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-9999 bg-black flex flex-col items-center justify-center px-8">
          <div className="flex flex-col items-center gap-6">
            <div className="w-24 h-24 rounded-full border border-white/20 flex items-center justify-center">
              <span className="text-white text-4xl font-black">!</span>
            </div>
            <div className="text-center space-y-3">
              <h1 className="text-white text-2xl font-black tracking-tight">
                Something went wrong
              </h1>
              <p className="text-white/60 text-xs font-medium uppercase tracking-[0.2em]">
                TAP TO RELOAD THE APP
              </p>
            </div>
            <button
              onClick={this.handleReload}
              className="mt-2 px-6 py-3 rounded-full bg-white text-black text-xs font-bold uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(255,255,255,0.35)] active:scale-95 transition-transform"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const SplashScreen = () => (
  <div className="fixed inset-0 z-9999 bg-black flex flex-col items-center justify-center animate-fade-in">
    <div className="flex flex-col items-center gap-8 animate-fade-in-up">
      <div className="w-40 h-40 relative flex items-center justify-center">
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full text-white fill-current"
        >
          <path d="M50 20L10 38.5L50 57L85 40.8V65H90V38.5L50 20Z" />
          <path d="M25 47V65C25 65 35 75 50 75C65 75 75 65 75 65V47L50 58.5L25 47Z" />
          <path d="M42 34H58V39H47V43H58V48H42V34Z" fill="black" />
        </svg>
      </div>
      <div className="text-center space-y-4">
        <h1 className="text-white text-6xl font-black tracking-tighter">
          LOPAY
        </h1>
        <p className="text-white/60 text-xs font-black uppercase tracking-[0.5em] ml-2">
          Technologies
        </p>
      </div>
    </div>
    <div className="absolute bottom-16 flex flex-col items-center gap-4">
      <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full bg-white animate-loading-bar rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]"></div>
      </div>
      <p className="text-white/20 text-[8px] font-bold uppercase tracking-[0.3em]">
        SECURE SYSTEM INITIALIZATION
      </p>
    </div>
  </div>
);

const ProtectedRoute = ({
  children,
  allowedRoles,
}: {
  children?: React.ReactNode;
  allowedRoles?: string[];
}) => {
  const { user, userRole } = useAuth(); // Use AuthContext
  const location = useLocation();

  // Note: user object presence implies isAuthenticated in AuthContext
  const isAuthenticated = !!user;

  if (!isAuthenticated) {
    return <Navigate to="/welcome" state={{ from: location }} replace />;
  }

  if (allowedRoles && userRole && !allowedRoles.includes(userRole)) {
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
};

/**
 * Sends a school owner to fee setup until their school has published a schedule.
 *
 * The platform issues school-owner credentials but deliberately seeds no fees:
 * the fee is snapshotted at enrolment and drives the platform fee and minimum
 * deposit, so the school sets its own. Until at least one class fee exists the
 * school cannot accept enrolments, so the dashboard would only show empty
 * states — setup is the useful first screen.
 *
 * Gates on the REAL role, never the acting one: an admin previewing this view
 * still carries SUPER_ADMIN, so the SCHOOL_OWNER-only fees endpoint 403s for
 * them. Redirecting on that error would trap the admin in a screen they cannot
 * complete, so only a successful empty response redirects.
 */
export const SchoolSetupGate = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { userRole } = useAuth();
  const isSchoolOwner = userRole === "school_owner";
  const { data: fees, isLoading, isError } = useMyClassFees(isSchoolOwner);

  if (!isSchoolOwner) return <>{children}</>;
  // Don't flash the dashboard before we know, and don't redirect on failure.
  if (isLoading) return <SplashScreen />;
  if (isError) return <>{children}</>;

  if (Array.isArray(fees) && fees.length === 0) {
    return <Navigate to="/school/fees" replace />;
  }

  return <>{children}</>;
};

const HomeRedirect = () => {
  const { user, userRole } = useAuth(); // Use AuthContext
  const isAuthenticated = !!user;

  if (!isAuthenticated) return <Navigate to="/welcome" replace />;

  switch (userRole) {
    case "owner":
      return <Navigate to="/owner-dashboard" replace />;
    case "school_owner":
      return <Navigate to="/school-owner-dashboard" replace />;
    case "parent":
      return <Navigate to="/dashboard" replace />;
    default:
      return <Navigate to="/dashboard" replace />;
  }
};

/**
 * Headless component: keeps the realtime socket connected while authenticated
 * and routes pushed events into React Query / the Zustand stores.
 */
const RealtimeManager = () => {
  useRealtime();
  return null;
};

const AppRoutes = () => {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2800);
    return () => clearTimeout(timer);
  }, []);

  if (showSplash) return <SplashScreen />;

  return (
    <Suspense fallback={<SplashScreen />}>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/home" element={<HomeRedirect />} />
        <Route path="/welcome" element={<WelcomeScreen />} />
        <Route path="/auth" element={<AuthScreen />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={["parent"]}>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/owner-dashboard"
          element={
            <ProtectedRoute allowedRoles={["owner"]}>
              <OwnerDashboard />
            </ProtectedRoute>
          }
        />

        {/*
          School owners only.

          A platform admin used to be allowed here. Every screen-scoped query is
          SCHOOL_OWNER-only, so landing an admin on it produced a dashboard
          reporting ₦0 collections, 0 registered and 0 active plans for a real
          school — with no error banner, because the queries were never enabled
          rather than failing. Fabricated zeros are worse than no screen. Admins
          read real per-school figures at /admin/breakdown.
        */}
        <Route
          path="/school-owner-dashboard"
          element={
            <ProtectedRoute allowedRoles={["school_owner"]}>
              <SchoolSetupGate>
                <SchoolOwnerDashboard />
              </SchoolSetupGate>
            </ProtectedRoute>
          }
        />

        {/*
          A school's own fee schedule — first-run setup and later revisions use
          the same screen. Deliberately NOT wrapped in SchoolSetupGate (that
          would redirect here from here), and school-owner only: the platform
          admin cannot write a school's fees.
        */}
        <Route
          path="/school/fees"
          element={
            <ProtectedRoute allowedRoles={["school_owner"]}>
              <SchoolSetupScreen />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/add-school"
          element={
            <ProtectedRoute allowedRoles={["owner"]}>
              <AddSchoolScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/schools"
          element={
            <ProtectedRoute allowedRoles={["owner"]}>
              <SchoolListScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/broadcast"
          element={
            <ProtectedRoute allowedRoles={["owner"]}>
              <BroadcastScreen />
            </ProtectedRoute>
          }
        />
        {/*
          Scoped to a single school's roster, which only a school owner can fetch.
          The admin equivalent is /admin/breakdown (tab: overdue).
        */}
        <Route
          path="/admin/defaulters"
          element={
            <ProtectedRoute allowedRoles={["school_owner"]}>
              <DefaultersScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute allowedRoles={["owner"]}>
              <UsersListScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/approvals"
          element={
            <ProtectedRoute allowedRoles={["owner", "school_owner"]}>
              <PaymentApprovalsScreen />
            </ProtectedRoute>
          }
        />
        {/*
          /admin/manage-fees is gone. It was reachable by the platform admin but
          POST /school-payments/fees is SCHOOL_OWNER-only and derives the school
          from the session, so an admin could read a school's fees there and then
          403 on save. Schools own their fees — /school/fees is the one path.
        */}
        <Route
          path="/admin/manage-fees"
          element={<Navigate to="/school/fees" replace />}
        />
        <Route
          path="/admin/audit-logs"
          element={
            <ProtectedRoute allowedRoles={["owner"]}>
              <AuditLogsScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/breakdown"
          element={
            <ProtectedRoute allowedRoles={["owner"]}>
              <CollectionsBreakdownScreen />
            </ProtectedRoute>
          }
        />

        <Route
          path="/add-child"
          element={
            <ProtectedRoute allowedRoles={["parent"]}>
              <AddChildScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/calculator"
          element={
            <ProtectedRoute allowedRoles={["parent"]}>
              <CalculatorScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/confirm-plan"
          element={
            <ProtectedRoute allowedRoles={["parent"]}>
              <ConfirmPlanScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <HistoryScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <NotificationScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/payment-methods"
          element={
            <ProtectedRoute>
              <PaymentMethodsScreen />
            </ProtectedRoute>
          }
        />
        {/*
          /manage-payment-methods is gone. It showed the platform's own bank
          details as the destination for a manual "25% activation" transfer — a
          flow the backend removed when first payments moved to the Paystack split
          — and offered an "Add Local Payment Card" button that was a window.prompt
          feeding a fake success toast. Nothing in the app linked to it.
        */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfileScreen />
            </ProtectedRoute>
          }
        />
        {/*
          Parent-only: every query this screen renders (`/transactions`,
          `/enrollments/my-children`) serves a parent's own plans and 403s for
          anyone else. It was reachable by any authenticated user via URL — only
          the parent dashboard links to it — so an admin got an empty calendar
          built from two failed requests.
        */}
        <Route
          path="/calendar"
          element={
            <ProtectedRoute allowedRoles={["parent"]}>
              <CalendarScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/support"
          element={
            <ProtectedRoute>
              <SupportScreen />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Suspense>
  );
};

const App: React.FC = () => {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    StatusBar.setStyle({ style: Style.Light }).catch(() => undefined);
    StatusBar.setBackgroundColor({ color: "#0f1115" }).catch(() => undefined);
    StatusBar.setOverlaysWebView({ overlay: false }).catch(() => undefined);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastHost>
        <AuthProvider>
          <DataProvider>
            <RealtimeManager />
            <HashRouter>
              <ErrorBoundary>
                <AppRoutes />
              </ErrorBoundary>
            </HashRouter>
          </DataProvider>
        </AuthProvider>
      </ToastHost>
    </QueryClientProvider>
  );
};

export default App;

import React, { useState, useEffect } from "react";
import {
  HashRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "./services/queryClient";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { DataProvider } from "./context/DataContext";
import { UIProvider } from "./context/UIContext";
import AuthScreen from "./pages/AuthScreen";
import WelcomeScreen from "./pages/WelcomeScreen";
import Dashboard from "./pages/Dashboard";
import AddChildScreen from "./pages/AddChildScreen";
import CalculatorScreen from "./pages/CalculatorScreen";
import ConfirmPlanScreen from "./pages/ConfirmPlanScreen";
import HistoryScreen from "./pages/HistoryScreen";
import NotificationScreen from "./pages/NotificationScreen";
import PaymentMethodsScreen from "./pages/PaymentMethodsScreen";
import ProfileScreen from "./pages/ProfileScreen";
import OwnerDashboard from "./pages/OwnerDashboard";
import SchoolOwnerDashboard from "./pages/SchoolOwnerDashboard";
import AddSchoolScreen from "./pages/admin/AddSchoolScreen";
import BroadcastScreen from "./pages/admin/BroadcastScreen";
import DefaultersScreen from "./pages/admin/DefaultersScreen";
import SchoolListScreen from "./pages/admin/SchoolListScreen";
import CalendarScreen from "./pages/CalendarScreen";
import SettingsScreen from "./pages/SettingsScreen";
import SupportScreen from "./pages/SupportScreen";
import UsersListScreen from "./pages/admin/UsersListScreen";
import ManagePaymentMethods from "./pages/ManagePaymentMethods";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import PaymentApprovalsScreen from "./pages/admin/PaymentApprovalsScreen";
import ManageFeesScreen from "./pages/admin/ManageFeesScreen";

const SplashScreen = () => (
  <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center animate-fade-in">
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

const HomeRedirect = () => {
  const { user, userRole } = useAuth(); // Use AuthContext
  const isAuthenticated = !!user;

  if (!isAuthenticated) return <Navigate to="/welcome" replace />;

  switch (userRole) {
    case "owner":
      return <Navigate to="/owner-dashboard" replace />;
    case "school_owner":
      return <Navigate to="/school-owner-dashboard" replace />;
    case "university_student":
    case "parent":
      return <Navigate to="/dashboard" replace />;
    default:
      return <Navigate to="/dashboard" replace />;
  }
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
    <>
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
            <ProtectedRoute
              allowedRoles={["parent", "university_student", "owner"]}
            >
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

        <Route
          path="/school-owner-dashboard"
          element={
            <ProtectedRoute allowedRoles={["school_owner", "owner"]}>
              <SchoolOwnerDashboard />
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
        <Route
          path="/admin/defaulters"
          element={
            <ProtectedRoute allowedRoles={["owner", "school_owner"]}>
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
        <Route
          path="/admin/manage-fees"
          element={
            <ProtectedRoute allowedRoles={["school_owner", "owner"]}>
              <ManageFeesScreen />
            </ProtectedRoute>
          }
        />

        <Route
          path="/add-child"
          element={
            <ProtectedRoute allowedRoles={["parent", "university_student"]}>
              <AddChildScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/calculator"
          element={
            <ProtectedRoute allowedRoles={["parent", "university_student"]}>
              <CalculatorScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/confirm-plan"
          element={
            <ProtectedRoute allowedRoles={["parent", "university_student"]}>
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
        <Route
          path="/manage-payment-methods"
          element={
            <ProtectedRoute>
              <ManagePaymentMethods />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfileScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/calendar"
          element={
            <ProtectedRoute>
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
    </>
  );
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <UIProvider>
        <AuthProvider>
          <DataProvider>
            {/* AppProvider removed - Context Split Complete */}
            <HashRouter>
              <AppRoutes />
            </HashRouter>
          </DataProvider>
        </AuthProvider>
      </UIProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
};

export default App;

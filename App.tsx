
import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import AuthScreen from './pages/AuthScreen';
import WelcomeScreen from './pages/WelcomeScreen';
import Dashboard from './pages/Dashboard';
import AddChildScreen from './pages/AddChildScreen';
import CalculatorScreen from './pages/CalculatorScreen';
import ConfirmPlanScreen from './pages/ConfirmPlanScreen';
import HistoryScreen from './pages/HistoryScreen';
import NotificationScreen from './pages/NotificationScreen';
import PaymentMethodsScreen from './pages/PaymentMethodsScreen';
import ProfileScreen from './pages/ProfileScreen';
import OwnerDashboard from './pages/OwnerDashboard';
import SchoolOwnerDashboard from './pages/SchoolOwnerDashboard';
import AddSchoolScreen from './pages/admin/AddSchoolScreen';
import BroadcastScreen from './pages/admin/BroadcastScreen';
import DefaultersScreen from './pages/admin/DefaultersScreen';
import SchoolListScreen from './pages/admin/SchoolListScreen';
import PaymentApprovalsScreen from './pages/admin/PaymentApprovalsScreen';
import CalendarScreen from './pages/CalendarScreen';
import SettingsScreen from './pages/SettingsScreen';
import SupportScreen from './pages/SupportScreen';
import UsersListScreen from './pages/admin/UsersListScreen';
import ManagePaymentMethods from './pages/ManagePaymentMethods';
import TermsOfService from './pages/TermsOfService';
import PrivacyPolicy from './pages/PrivacyPolicy';

const ProtectedRoute = ({ children }: React.PropsWithChildren) => {
  const { isAuthenticated } = useApp();
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

const ThemeInitializer = () => {
    useEffect(() => {
        if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, []);
    return null;
}

const AppRoutes = () => {
  return (
    <>
    <ThemeInitializer />
    <Routes>
      <Route path="/" element={<AuthScreen />} />
      <Route path="/welcome" element={<WelcomeScreen />} />
      <Route path="/terms" element={<TermsOfService />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      
      {/* Admin Routes */}
      <Route path="/owner-dashboard" element={<ProtectedRoute><OwnerDashboard /></ProtectedRoute>} />
      <Route path="/school-owner-dashboard" element={<ProtectedRoute><SchoolOwnerDashboard /></ProtectedRoute>} />
      <Route path="/admin/add-school" element={<ProtectedRoute><AddSchoolScreen /></ProtectedRoute>} />
      <Route path="/admin/schools" element={<ProtectedRoute><SchoolListScreen /></ProtectedRoute>} />
      <Route path="/admin/broadcast" element={<ProtectedRoute><BroadcastScreen /></ProtectedRoute>} />
      <Route path="/admin/defaulters" element={<ProtectedRoute><DefaultersScreen /></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute><UsersListScreen /></ProtectedRoute>} />
      <Route path="/admin/approvals" element={<ProtectedRoute><PaymentApprovalsScreen /></ProtectedRoute>} />

      <Route path="/add-child" element={<ProtectedRoute><AddChildScreen /></ProtectedRoute>} />
      <Route path="/calculator" element={<ProtectedRoute><CalculatorScreen /></ProtectedRoute>} />
      <Route path="/confirm-plan" element={<ProtectedRoute><ConfirmPlanScreen /></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute><HistoryScreen /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><NotificationScreen /></ProtectedRoute>} />
      <Route path="/payment-methods" element={<ProtectedRoute><PaymentMethodsScreen /></ProtectedRoute>} />
      <Route path="/manage-payment-methods" element={<ProtectedRoute><ManagePaymentMethods /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><ProfileScreen /></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute><CalendarScreen /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsScreen /></ProtectedRoute>} />
      <Route path="/support" element={<ProtectedRoute><SupportScreen /></ProtectedRoute>} />
    </Routes>
    </>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AppProvider>
  );
};

export default App;

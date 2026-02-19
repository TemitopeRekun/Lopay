import React from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { BottomNav } from "../components/BottomNav";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { PlanCard } from "../components/PlanCard";
import { RecentTransactionsList } from "../components/RecentTransactionsList";
import { ImpersonationBanner } from "../components/ImpersonationBanner";
import { NotificationIconButton } from "../components/NotificationIconButton";
import { useUsers } from "../hooks/useQueries";

const Dashboard: React.FC = () => {
  const {
    user: currentUser,
    userRole,
    setActingRole,
    actingUserId,
    isOwnerAccount,
    effectiveRole,
  } = useAuth();
  const {
    childrenData = [],
    transactions = [],
    notifications = [],
    schools = [],
    isLoading,
    hasError,
    refreshData,
  } = useData();
  const { data: allUsers = [] } = useUsers(isOwnerAccount);
  const navigate = useNavigate();

  const unreadNotifications = React.useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  // Safety check to prevent crashes if data is corrupted
  const validChildren = React.useMemo(() => {
    if (!Array.isArray(childrenData)) return [];
    return childrenData.filter((c) => c && typeof c === "object" && c.id);
  }, [childrenData]);

  const schoolNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    schools.forEach((s) => {
      if (s && s.id) {
        map.set(s.id, s.name);
      }
    });
    return map;
  }, [schools]);

  const isStudent = effectiveRole === "university_student";
  const entityType = isStudent ? "Institution" : "School";

  const actingAs = actingUserId
    ? allUsers.find((u) => u.id === actingUserId)
    : null;

  const activeEnrollments = React.useMemo(() => {
    return validChildren.filter((child) => {
      const remaining =
        typeof child.remainingBalance === "number" ? child.remainingBalance : 0;
      return (
        remaining > 0 &&
        child.status !== "Completed" &&
        child.status !== "Defaulted"
      );
    });
  }, [validChildren]);

  const enrollmentsWithNext = React.useMemo(() => {
    return activeEnrollments.filter((child) => {
      const amount =
        typeof child.nextInstallmentAmount === "number"
          ? child.nextInstallmentAmount
          : 0;
      return amount > 0;
    });
  }, [activeEnrollments]);

  const totalNextCollection = React.useMemo(() => {
    return enrollmentsWithNext.reduce((sum, child) => {
      const amount =
        typeof child.nextInstallmentAmount === "number"
          ? child.nextInstallmentAmount
          : 0;
      return sum + amount;
    }, 0);
  }, [enrollmentsWithNext]);

  const singleNextEnrollment =
    enrollmentsWithNext.length === 1 ? enrollmentsWithNext[0] : null;

  const earliestDueDate = React.useMemo(() => {
    if (enrollmentsWithNext.length === 0) {
      return null;
    }
    const dates = enrollmentsWithNext
      .map((child) => child.nextDueDate)
      .filter((d): d is string => !!d);
    if (dates.length === 0) {
      return null;
    }
    return dates.sort()[0];
  }, [enrollmentsWithNext]);

  const nextCollectionAmount = React.useMemo(() => {
    if (singleNextEnrollment) {
      const amount =
        typeof singleNextEnrollment.nextInstallmentAmount === "number"
          ? singleNextEnrollment.nextInstallmentAmount
          : 0;
      return amount;
    }
    return totalNextCollection;
  }, [singleNextEnrollment, totalNextCollection]);

  const handleQuickPay = (childId: string, amount: number) => {
    navigate("/payment-methods", {
      state: {
        paymentType: "installment",
        amount: amount,
        childId: childId,
        allowCustom: true,
      },
    });
  };

  const handleReturnToAdmin = () => {
    setActingRole("owner");
    navigate("/owner-dashboard");
  };

  const hasPlans = validChildren.length > 0;

  if (isLoading) {
    return (
      <Layout showBottomNav>
        {actingUserId && isOwnerAccount && (
          <ImpersonationBanner
            mode="user"
            label={actingAs?.name || "User"}
            onExit={handleReturnToAdmin}
          />
        )}
        <main className="flex flex-col items-center justify-center flex-1 p-6">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
          <p className="text-sm font-bold text-text-secondary-light">
            Loading dashboard…
          </p>
        </main>
        <BottomNav />
      </Layout>
    );
  }

  return (
    <Layout showBottomNav>
      {actingUserId && isOwnerAccount && (
        <ImpersonationBanner
          mode="user"
          label={actingAs?.name || "User"}
          onExit={handleReturnToAdmin}
        />
      )}

      <div
        className={`sticky top-0 z-10 flex items-center justify-between bg-white dark:bg-background-dark p-6 pb-2 border-b border-gray-100 dark:border-gray-800 ${actingUserId ? "top-[42px]" : ""}`}
      >
        <h1 className="text-2xl font-bold tracking-tight text-text-primary-light dark:text-text-primary-dark">
          {isStudent ? "My Tuition" : "Dashboard"}
        </h1>
        <div className="flex items-center gap-3">
          <NotificationIconButton
            unreadCount={unreadNotifications}
            onClick={() => navigate("/notifications")}
            variant="round"
          />
          <button
            onClick={() => navigate("/calendar")}
            className="size-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
          >
            <span className="material-symbols-outlined text-xl text-text-secondary-light">
              calendar_month
            </span>
          </button>
          <button
            onClick={() => navigate("/profile")}
            className="size-10 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 border-2 border-white dark:border-gray-600 shadow-sm"
          >
            <img
              src={`https://ui-avatars.com/api/?name=${actingAs?.name || currentUser?.name || "User"}&background=random`}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          </button>
        </div>
      </div>

      <main className="flex flex-col gap-6 p-6">
        {hasError && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-danger/20 bg-danger/5 px-4 py-3">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-danger">
                wifi_off
              </span>
              <div>
                <p className="text-xs font-bold text-text-primary-light dark:text-text-primary-dark">
                  Couldn&apos;t load latest data
                </p>
                <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                  Check your connection and try again.
                </p>
              </div>
            </div>
            <button
              onClick={refreshData}
              className="px-3 py-1.5 rounded-full bg-danger text-white text-[10px] font-bold uppercase tracking-[0.15em] active:scale-95 transition-transform"
            >
              Retry
            </button>
          </div>
        )}

        {!hasPlans ? (
          <div className="flex flex-col items-center justify-center py-10 text-center animate-fade-in-up">
            <div className="w-48 h-48 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mb-6 relative overflow-hidden">
              <div className="absolute inset-0 bg-primary/10 rounded-full animate-pulse"></div>
              <span className="material-symbols-outlined text-8xl text-primary opacity-80">
                {isStudent ? "school" : "family_restroom"}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark mb-2">
              Welcome,{" "}
              {(actingAs?.name || currentUser?.name || "User").split(" ")[0]}!
            </h2>
            <p className="text-text-secondary-light dark:text-text-secondary-dark max-w-xs mb-8">
              {isStudent
                ? "You haven't set up any tuition plans yet. Split your semester or session fees into installments."
                : "Your dashboard is empty. Add a child and set up a payment plan to get started."}
            </p>
            <button
              onClick={() => navigate("/add-child")}
              className="flex items-center gap-2 px-8 py-4 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/30 hover:scale-105 transition-transform"
            >
              <span className="material-symbols-outlined">add_circle</span>
              {isStudent ? "Setup Tuition Plan" : "Start a New Plan"}
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-stretch justify-start rounded-2xl bg-slate-900 text-white p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mr-10 -mt-10"></div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">
                {isStudent ? "Next Payment Due" : "Next Collection Due"}
              </p>
              <p className="text-4xl font-extrabold tracking-tight mb-2">
                ₦
                {(nextCollectionAmount || 0).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </p>
              <div className="flex flex-col gap-1 mt-2">
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-accent animate-pulse"></div>
                  <p className="text-white/70 text-xs font-bold uppercase tracking-wider">
                    Direct Settlement Active
                  </p>
                </div>
                {singleNextEnrollment && singleNextEnrollment.nextDueDate && (
                  <p className="text-white/70 text-xs font-bold uppercase tracking-wider">
                    Due {singleNextEnrollment.nextDueDate}
                  </p>
                )}
                {!singleNextEnrollment && earliestDueDate && (
                  <p className="text-white/70 text-xs font-bold uppercase tracking-wider">
                    Earliest due: {earliestDueDate}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-text-secondary-light uppercase tracking-wider">
                  {isStudent ? "Active Academic Plans" : "Plan Status"}
                </h2>
              </div>

              {validChildren.map((child) => (
                <PlanCard
                  key={child.id}
                  child={child}
                  mode="parent"
                  schoolName={
                    schoolNameById.get(child.schoolId || "") ||
                    child.school ||
                    "Unknown School"
                  }
                  entityLabel={entityType}
                  onQuickPay={(c, amount) => handleQuickPay(c.id, amount)}
                />
              ))}
            </div>

            <RecentTransactionsList
              transactions={transactions}
              emptyLabel="No transactions recorded"
              onViewAll={() => navigate("/history")}
            />
          </>
        )}
      </main>

      <div className="fixed bottom-24 right-4 z-20 flex flex-col gap-3">
        <button
          onClick={() => navigate("/support")}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white dark:bg-card-dark text-primary shadow-lg border border-gray-100 dark:border-gray-800 hover:scale-105 transition-transform"
        >
          <span className="material-symbols-outlined">help_outline</span>
        </button>
        <button
          onClick={() => navigate("/add-child")}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/40 hover:scale-110 transition-transform ring-4 ring-white dark:ring-background-dark"
        >
          <span className="material-symbols-outlined text-3xl">add</span>
        </button>
      </div>

      {isOwnerAccount && !actingUserId && (
        <button
          onClick={handleReturnToAdmin}
          className="fixed bottom-24 left-4 z-50 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-3 rounded-full shadow-xl font-bold flex items-center gap-2 hover:scale-105 transition-transform"
        >
          <span className="material-symbols-outlined text-lg">
            admin_panel_settings
          </span>
          <span className="text-xs uppercase tracking-wide">Back to Admin</span>
        </button>
      )}

      <BottomNav />
    </Layout>
  );
};

export default Dashboard;

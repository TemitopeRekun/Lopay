import React from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { BottomNav } from "../components/BottomNav";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { PlanCard } from "../components/PlanCard";
import { RecentTransactionsList } from "../components/RecentTransactionsList";
import { NotificationIconButton } from "../components/NotificationIconButton";
import { installmentCount, toPlanType } from "../utils/plan";

const Dashboard: React.FC = () => {
  const { user: currentUser } = useAuth();
  const {
    childrenData = [],
    transactions = [],
    unreadNotificationsCount,
    schools = [],
    parentDashboardSummary,
    isLoading,
    hasError,
    refreshData,
  } = useData();
  const navigate = useNavigate();

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

  const entityType = "School";

  /*
   * "Next Collection Due" is the server's number, not a local sum.
   *
   * This screen used to filter enrollments on a client-normalised status string,
   * add up their `nextInstallmentAmount`s and take the minimum `nextDueDate`.
   * That put the busiest figure in the app on an aggregate no endpoint ever
   * validated, and it counted plans whose first payment had never been
   * collected — quoting money the parent could not actually pay. The rollup is
   * `GET /enrollments/summary` now; see the backend's `enrollment-view.ts`.
   */
  const nextCollection = parentDashboardSummary?.nextCollection;
  const nextCollectionAmount = nextCollection?.amount;
  const contributingPlanCount = nextCollection?.enrollmentCount ?? 0;
  // Named only when a single plan contributes, so the card can say whose it is.
  const singleNextChildName = nextCollection?.childName ?? null;
  const nextDueDate = nextCollection?.dueDate ?? null;

  const handleQuickPay = (
    child: (typeof validChildren)[number],
    amount: number,
    context?: { isFirstPaymentRetry?: boolean },
  ) => {
    if (context?.isFirstPaymentRetry) {
      const planType = toPlanType(child.installmentFrequency);
      const numberOfPayments = installmentCount(child.installmentFrequency);

      const failedFirstPayment = (child.payments || [])
        .filter((p) => {
          const type = (p.type || p.paymentType || "").toUpperCase();
          const status = p.status ? String(p.status).toUpperCase() : "";
          return (
            type === "FIRST_PAYMENT" &&
            (status === "FAILED" || status === "REJECTED" || status === "DECLINED")
          );
        })
        .slice()
        .sort((a, b) => {
          const dateA = new Date(a.date || a.paymentDate || 0).getTime();
          const dateB = new Date(b.date || b.paymentDate || 0).getTime();
          return dateB - dateA;
        })[0];

      const failedAmount =
        failedFirstPayment?.amount ??
        failedFirstPayment?.amountPaid ??
        0;

      // Deliberately does NOT pass depositAmount / platformFeeAmount /
      // totalInitialPayment. It used to send zeros, which made ConfirmPlanScreen
      // render a ₦0 platform fee, route the whole payment "to school", and
      // understate the balance-after-payment by exactly the platform fee — and if
      // no failed row could be found, offer a ₦0 minimum that the server rejects.
      // With them absent, ConfirmPlanScreen fetches the authoritative figures from
      // the same calculator endpoint the server validates against.
      navigate("/confirm-plan", {
        state: {
          childName: child.name,
          schoolName:
            schoolNameById.get(child.schoolId || "") ||
            child.school ||
            "Unknown School",
          grade: child.grade,
          totalFee: child.totalFee || 0,
          plan: {
            type: planType,
            amount: child.totalFee || 0,
            frequencyLabel: planType,
            numberOfPayments,
          },
          feeType: "Session",
          schoolId: child.schoolId,
          // Prefill the amount they last attempted, when we know it. It is only a
          // default — the fetched minimum still bounds what can be submitted.
          suggestedFirstPayment: failedAmount > 0 ? failedAmount : undefined,
        },
      });
      return;
    }

    navigate("/payment-methods", {
      state: {
        paymentType: "installment",
        amount: amount,
        childId: child.id,
        allowCustom: true,
      },
    });
  };

  const hasPlans = validChildren.length > 0;

  if (isLoading) {
    return (
      <Layout showBottomNav>
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
      <div className="sticky top-0 z-10 flex items-center justify-between bg-white dark:bg-background-dark p-6 pb-2 border-b border-gray-100 dark:border-gray-800">
        <h1 className="text-2xl font-bold tracking-tight text-text-primary-light dark:text-text-primary-dark">
          Dashboard
        </h1>
        <div className="flex items-center gap-3">
          <NotificationIconButton
            unreadCount={unreadNotificationsCount}
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
              src={`https://ui-avatars.com/api/?name=${currentUser?.name || "User"}&background=random`}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          </button>
        </div>
      </div>

      <main className="flex flex-col gap-6 p-6">
        {hasError &&
          !isLoading &&
          childrenData.length === 0 &&
          transactions.length === 0 && (
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
                family_restroom
              </span>
            </div>
            <h2 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark mb-2">
              Welcome,{" "}
              {(currentUser?.name || "User").split(" ")[0]}!
            </h2>
            <p className="text-text-secondary-light dark:text-text-secondary-dark max-w-xs mb-8">
              Your dashboard is empty. Add a child and set up a payment plan to
              get started.
            </p>
            <button
              onClick={() => navigate("/add-child")}
              className="flex items-center gap-2 px-8 py-4 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/30 hover:scale-105 transition-transform"
            >
              <span className="material-symbols-outlined">add_circle</span>
              Start a New Plan
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-stretch justify-start rounded-2xl bg-slate-900 text-white p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mr-10 -mt-10"></div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">
                Next Collection Due
              </p>
              {/* Undefined until the endpoint answers — rendered as "—", never
                  as a ₦0.00 the parent might read as "nothing owed". */}
              <p className="text-4xl font-extrabold tracking-tight mb-2">
                {typeof nextCollectionAmount === "number"
                  ? `₦${nextCollectionAmount.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })}`
                  : "—"}
              </p>
              <div className="flex flex-col gap-1 mt-2">
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-accent animate-pulse"></div>
                  <p className="text-white/70 text-xs font-bold uppercase tracking-wider">
                    Direct Settlement Active
                  </p>
                </div>
                {nextDueDate && contributingPlanCount === 1 && (
                  <p className="text-white/70 text-xs font-bold uppercase tracking-wider">
                    {singleNextChildName
                      ? `${singleNextChildName} — due ${nextDueDate}`
                      : `Due ${nextDueDate}`}
                  </p>
                )}
                {nextDueDate && contributingPlanCount > 1 && (
                  <p className="text-white/70 text-xs font-bold uppercase tracking-wider">
                    Earliest of {contributingPlanCount} plans: {nextDueDate}
                  </p>
                )}
                {contributingPlanCount === 0 &&
                  typeof nextCollectionAmount === "number" && (
                    <p className="text-white/70 text-xs font-bold uppercase tracking-wider">
                      No installment due yet
                    </p>
                  )}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-text-secondary-light uppercase tracking-wider">
                  Plan Status
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
                  onQuickPay={(c, amount, context) =>
                    handleQuickPay(c, amount, context)
                  }
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

      <BottomNav />
    </Layout>
  );
};

export default Dashboard;

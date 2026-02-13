import React from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { BottomNav } from "../components/BottomNav";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { StatusBadge } from "../components/common/StatusBadge";

const Dashboard: React.FC = () => {
  const {
    user: currentUser,
    userRole,
    setActingRole,
    actingUserId,
    isOwnerAccount,
  } = useAuth();
  const {
    children: childrenData = [],
    transactions = [],
    notifications = [],
    users: allUsers = [],
    refreshData,
  } = useData();
  const navigate = useNavigate();

  const unreadNotifications = React.useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("All");

  // Force refresh on mount to ensure fresh data
  React.useEffect(() => {
    refreshData?.();
  }, [refreshData]);

  // Safety check to prevent crashes if data is corrupted
  const validChildren = React.useMemo(() => {
    if (!Array.isArray(childrenData)) return [];
    return childrenData.filter((c) => c && typeof c === "object" && c.id);
  }, [childrenData]);

  const filteredChildren = React.useMemo(() => {
    let result = validChildren;

    // 1. Filter by Search Query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.school?.toLowerCase().includes(query) ||
          c.grade?.toLowerCase().includes(query),
      );
    }

    // 2. Filter by Status
    if (statusFilter !== "All") {
      result = result.filter((c) => {
        if (statusFilter === "Issues") {
          return c.status === "Defaulted" || c.status === "Failed";
        }
        return c.status === statusFilter;
      });
    }

    return result;
  }, [validChildren, searchQuery, statusFilter]);

  const isStudent = userRole === "university_student";
  const entityType = isStudent ? "Institution" : "School";

  const actingAs = actingUserId
    ? allUsers.find((u) => u.id === actingUserId)
    : null;

  const totalNextDue = validChildren.reduce((acc, child) => {
    if (child.status === "Completed") return acc;
    return acc + (child.nextInstallmentAmount || 0);
  }, 0);

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

  const userTransactions = React.useMemo(() => {
    return transactions;
  }, [transactions]);

  const sortedTransactions = React.useMemo(() => {
    return [...userTransactions].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });
  }, [userTransactions]);

  return (
    <Layout showBottomNav>
      {actingUserId && isOwnerAccount && (
        <div className="bg-purple-600 text-white px-6 py-2.5 flex items-center justify-between shadow-lg sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">
              visibility
            </span>
            <p className="text-[10px] font-black uppercase tracking-widest">
              Acting as {actingAs?.name || "User"}
            </p>
          </div>
          <button
            onClick={handleReturnToAdmin}
            className="bg-white text-purple-600 px-3 py-1 rounded-full text-[9px] font-black uppercase shadow-sm active:scale-95"
          >
            Exit Proxy
          </button>
        </div>
      )}

      <div
        className={`sticky top-0 z-10 flex items-center justify-between bg-white dark:bg-background-dark p-6 pb-2 border-b border-gray-100 dark:border-gray-800 ${actingUserId ? "top-[42px]" : ""}`}
      >
        <h1 className="text-2xl font-bold tracking-tight text-text-primary-light dark:text-text-primary-dark">
          {isStudent ? "My Tuition" : "Dashboard"}
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/notifications")}
            className="size-10 rounded-2xl bg-white dark:bg-card-dark border border-gray-100 dark:border-gray-800 flex items-center justify-center text-text-primary-light dark:text-text-primary-dark shadow-sm hover:shadow-md transition-all relative"
          >
            <span className="material-symbols-outlined text-xl">
              notifications
            </span>
            <span className="absolute top-2 right-2 size-2 bg-danger rounded-full border border-white dark:border-card-dark"></span>
          </button>
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
        {/* Search Bar */}
        <div className="relative mx-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
            search
          </span>
          <input
            type="text"
            placeholder={`Search by ${isStudent ? "institution" : "child"} name...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-gray-800 rounded-xl py-3 pl-10 pr-4 text-xs font-bold text-text-primary-light dark:text-text-primary-dark outline-none focus:border-primary transition-all placeholder:font-normal placeholder:text-gray-400"
          />
        </div>

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
                {isStudent ? "Upcoming Payments" : "Upcoming Collections"}
              </p>
              <p className="text-4xl font-extrabold tracking-tight mb-2">
                ₦
                {totalNextDue.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <div className="size-2 rounded-full bg-accent animate-pulse"></div>
                <p className="text-white/70 text-[10px] font-bold uppercase tracking-wider">
                  Direct Settlement Active
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-text-secondary-light uppercase tracking-wider">
                  {isStudent ? "Active Academic Plans" : "Plan Status"}
                </h2>
              </div>

              {filteredChildren.map((child) => {
                const progress =
                  child.totalFee > 0
                    ? Math.min((child.paidAmount / child.totalFee) * 100, 100)
                    : 0;

                // Unified Status Logic (matching SchoolOwnerDashboard)
                const isCompleted = child.status === "Completed";
                const isDefaulted =
                  child.status === "Defaulted" || child.status === "Failed";
                const isActive = child.status === "Active";
                const isPending = child.status === "Pending";

                // "Activating" is synonymous with Pending/Processing in the user's view
                const isActivating = isPending;
                const isFullyInactive =
                  child.paidAmount === 0 &&
                  !isPending &&
                  !isActive &&
                  !isCompleted &&
                  !isDefaulted;

                let progressColor = "bg-secondary";

                if (isCompleted) {
                  progressColor = "bg-success";
                } else if (isDefaulted) {
                  progressColor = "bg-danger";
                } else if (isActive) {
                  progressColor = "bg-primary";
                } else if (isPending) {
                  progressColor = "bg-warning";
                } else if (isFullyInactive) {
                  progressColor = "bg-gray-300";
                }

                return (
                  <div
                    key={child.id}
                    className="flex flex-col rounded-2xl bg-white dark:bg-card-dark shadow-sm border border-gray-100 dark:border-gray-800 p-0 overflow-hidden group hover:shadow-md transition-all"
                  >
                    <div className="flex items-center justify-between p-4 pb-2">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <img
                            src={child.avatarUrl}
                            alt={child.name}
                            className="size-12 rounded-full object-cover bg-gray-100 ring-2 ring-gray-50 dark:ring-gray-800"
                          />
                          {isActivating && (
                            <div className="absolute -bottom-1 -right-1 size-5 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center shadow-sm">
                              <span className="material-symbols-outlined text-xs text-primary animate-spin">
                                sync
                              </span>
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-text-primary-light dark:text-text-primary-dark">
                            {child.name}
                          </p>
                          <p className="text-[10px] text-text-secondary-light dark:text-text-secondary-dark uppercase font-bold">
                            {child.school}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-1">
                        <span className="text-[10px] font-bold text-text-secondary-light dark:text-white bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded-md">
                          {child.grade}
                        </span>
                        <div className="flex items-center gap-2 justify-end w-full">
                          <StatusBadge
                            status={
                              isActivating
                                ? "Awaiting Approval"
                                : isFullyInactive
                                  ? "Not Active"
                                  : isCompleted
                                    ? "Completed"
                                    : child.status
                            }
                            className="ml-auto text-[10px] font-bold uppercase tracking-wider"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="px-4 py-2">
                      <div className="flex justify-between items-end mb-1.5">
                        <span className="text-[10px] text-text-secondary-light font-bold uppercase">
                          Installments Paid
                        </span>
                        <span className="text-xs font-bold dark:text-white">
                          <span
                            className={
                              isCompleted ? "text-success" : "text-primary"
                            }
                          >
                            ₦{child.paidAmount.toLocaleString()}
                          </span>{" "}
                          <span className="text-text-secondary-light font-normal text-[10px]">
                            / ₦{child.totalFee.toLocaleString()}
                          </span>
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden shadow-inner">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ease-out ${progressColor}`}
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="mt-2 p-4 bg-gray-50 dark:bg-white/5 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                      {isCompleted ? (
                        <div className="w-full flex items-center justify-center text-success font-bold gap-2 text-sm">
                          <span className="material-symbols-outlined filled text-lg">
                            verified
                          </span>
                          <span>Tuition Fully Settled</span>
                        </div>
                      ) : isPending ? (
                        <div className="w-full flex items-center justify-center text-warning font-bold gap-2 text-sm">
                          <span className="size-4 border-2 border-warning/30 border-t-warning rounded-full animate-spin"></span>
                          <span>
                            {isActivating
                              ? "Verifying Activation..."
                              : "Processing Payment..."}
                          </span>
                        </div>
                      ) : (
                        <>
                          <div>
                            <p className="text-[10px] text-text-secondary-light dark:text-text-secondary-dark uppercase font-bold">
                              {child.paidAmount === 0
                                ? "Activation Required"
                                : "Next Payment"}
                            </p>
                            <p className="font-bold text-sm text-text-primary-light dark:text-text-primary-dark">
                              ₦{child.nextInstallmentAmount.toLocaleString()}
                              <span className="text-[10px] font-normal opacity-70 ml-1">
                                {child.paidAmount === 0
                                  ? "Due Now"
                                  : `due ${child.nextDueDate}`}
                              </span>
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {child.paidAmount > 0 && (
                              <button
                                onClick={() =>
                                  navigate("/payment-methods", {
                                    state: {
                                      paymentType: "installment",
                                      amount: 0,
                                      childId: child.id,
                                      allowCustom: true,
                                      isCustomOnly: true,
                                    },
                                  })
                                }
                                className="bg-white dark:bg-card-dark border-2 border-gray-200 dark:border-gray-700 text-text-primary-light dark:text-text-primary-dark size-11 flex items-center justify-center rounded-xl text-xs font-bold active:scale-95 transition-all hover:bg-gray-100 dark:hover:bg-white/10"
                                title="Pay Custom Amount"
                              >
                                <span className="material-symbols-outlined text-xl">
                                  payments
                                </span>
                              </button>
                            )}
                            <button
                              onClick={() =>
                                handleQuickPay(
                                  child.id,
                                  child.nextInstallmentAmount,
                                )
                              }
                              className={`${child.paidAmount === 0 ? "bg-primary" : "bg-success"} text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-primary/20 active:scale-95 transition-all hover:opacity-90 flex items-center gap-2`}
                            >
                              <span className="material-symbols-outlined text-sm">
                                account_balance
                              </span>
                              Pay {entityType}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Recent Transactions Log */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold text-text-secondary-light uppercase tracking-wider flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-base filled">
                      history
                    </span>
                  </div>
                  Recent Payments Log
                </h3>
                <button
                  onClick={() => navigate("/history")}
                  className="text-[10px] font-black text-primary uppercase tracking-widest"
                >
                  View All
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {sortedTransactions.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 dark:bg-white/5 rounded-2xl border border-dashed border-gray-100 dark:border-gray-800">
                    <p className="text-[10px] text-text-secondary-light font-bold uppercase tracking-widest">
                      No transactions recorded
                    </p>
                  </div>
                ) : (
                  sortedTransactions.slice(0, 5).map((tx) => (
                    <div
                      key={tx.id}
                      className="bg-white dark:bg-card-dark p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex justify-between items-center transition-all hover:border-primary/20"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`size-10 rounded-xl flex items-center justify-center text-white ${tx.status === "Successful" ? "bg-success shadow-lg shadow-success/20" : "bg-warning shadow-lg shadow-warning/20"}`}
                        >
                          <span className="material-symbols-outlined text-xl">
                            {tx.status === "Successful" ? "check" : "sync"}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs font-black text-text-primary-light dark:text-text-primary-dark">
                            {tx.childName || tx.reference}
                          </p>
                          <p className="text-[9px] text-text-secondary-light font-bold uppercase tracking-widest">
                            {tx.date}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-text-primary-light dark:text-text-primary-dark">
                          ₦{tx.amount.toLocaleString()}
                        </p>
                        <p
                          className={`text-[8px] font-black uppercase tracking-[0.15em] ${tx.status === "Successful" ? "text-success" : "text-warning"}`}
                        >
                          {tx.status}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
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

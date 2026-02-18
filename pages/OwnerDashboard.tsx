import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { BottomNav } from "../components/BottomNav";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import {
  useAdminPendingFirstPayments,
  useAdminPendingInstallments,
  useAdminPlatformRevenue,
} from "../hooks/useQueries";
import { Transaction } from "../types";
import { NotificationIconButton } from "../components/NotificationIconButton";

const OwnerDashboard: React.FC = () => {
  const { userRole, setActingRole } = useAuth();
  const {
    transactions,
    allStudents,
    childrenData,
    schools,
    notifications,
    pendingPayments,
    isLoading,
  } = useData();
  const navigate = useNavigate();
  const [chartView, setChartView] = useState<"Weekly" | "Monthly">("Monthly");

  const isOwner = userRole === "owner";

  const { data: adminPendingFirst = [] } =
    useAdminPendingFirstPayments(isOwner);
  const { data: adminPendingInstallments = [] } =
    useAdminPendingInstallments(isOwner);
  const { data: platformRevenueData } = useAdminPlatformRevenue(isOwner);

  const unreadNotificationsCount = useMemo(() => {
    return notifications ? notifications.filter((n) => !n.read).length : 0;
  }, [notifications]);

  const hasStudentPool = allStudents && allStudents.length > 0;

  const totalPlatformFee = platformRevenueData?.totalRevenue ?? 0;
  const displayRevenue = totalPlatformFee;

  const activeStudents = useMemo(() => {
    if (hasStudentPool) {
      return allStudents.length;
    }
    const ids = new Set<string>();
    transactions.forEach((t) => {
      const key = t.childId || t.childName;
      if (key) ids.add(key);
    });
    return ids.size;
  }, [hasStudentPool, allStudents, transactions]);

  const pendingAmount = useMemo(() => {
    if (!hasStudentPool) {
      return 0;
    }
    return allStudents.reduce((acc, c) => {
      const total = Number.isFinite(c.totalFee) ? c.totalFee : 0;
      const paid = Number.isFinite(c.paidAmount) ? c.paidAmount : 0;
      return acc + (total - paid);
    }, 0);
  }, [hasStudentPool, allStudents]);

  const pendingFirstPaymentsBySchool = useMemo(() => {
    if (isOwner) {
      const map = new Map<
        string,
        { schoolId: string; schoolName: string; count: number }
      >();

      adminPendingFirst.forEach((t) => {
        const schoolName = t.schoolName || "Unknown School";
        const key = schoolName;
        const existing = map.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          map.set(key, {
            schoolId: "",
            schoolName,
            count: 1,
          });
        }
      });

      return Array.from(map.values()).filter((item) => item.count > 0);
    }

    const map = new Map<
      string,
      { schoolId: string; schoolName: string; count: number }
    >();

    childrenData.forEach((c) => {
      if (c.status !== "Pending") return;
      const school =
        (c.schoolId && schools.find((s) => s.id === c.schoolId)) || null;
      const schoolName = school?.name || c.school || "Unknown School";
      const key = school?.id || c.schoolId || schoolName;
      if (!key) return;

      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, {
          schoolId: school?.id || c.schoolId || "",
          schoolName,
          count: 1,
        });
      }
    });

    return Array.from(map.values()).filter((item) => item.count > 0);
  }, [isOwner, adminPendingFirst, childrenData, schools]);

  const pendingFirstEnrollmentsCount = useMemo(() => {
    if (isOwner) {
      return adminPendingFirst.length;
    }
    return childrenData.filter((c) => c.status === "Pending").length;
  }, [isOwner, adminPendingFirst, childrenData]);

  const pendingApprovalsCount = useMemo(() => {
    if (isOwner) {
      const firstPending = adminPendingFirst.length;
      const installmentsPending = adminPendingInstallments.length;
      return firstPending + installmentsPending;
    }

    const base =
      pendingPayments && pendingPayments.length > 0
        ? pendingPayments
        : transactions.filter((t) => t.status === "Pending");

    const installmentsPending = base.filter(
      (t) => (t.type || "").toUpperCase() !== "FIRST_PAYMENT",
    ).length;

    const firstPending = pendingFirstEnrollmentsCount;
    return installmentsPending + firstPending;
  }, [
    isOwner,
    adminPendingFirst,
    adminPendingInstallments,
    pendingPayments,
    transactions,
    pendingFirstEnrollmentsCount,
  ]);

  // Chart Data Processing (time-bucketed platform fee from transactions)
  const chartData = useMemo(() => {
    const data: { label: string; value: number }[] = [];
    const now = new Date();
    const successfulTx = transactions.filter((t) => t.status === "Successful");

    if (chartView === "Monthly") {
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      for (let i = 5; i >= 0; i--) {
        const bucket = new Date(
          now.getFullYear(),
          now.getMonth() - i,
          1,
          0,
          0,
          0,
          0,
        );
        const label = monthNames[bucket.getMonth()];

        const value = successfulTx
          .filter((t) => {
            const tDate = new Date(t.date);
            return (
              tDate.getFullYear() === bucket.getFullYear() &&
              tDate.getMonth() === bucket.getMonth()
            );
          })
          .reduce((sum, t) => {
            const explicitFee =
              typeof t.platformFeeAmount === "number" && t.platformFeeAmount > 0
                ? t.platformFeeAmount
                : undefined;

            const inferredFee =
              typeof t.platformFeePercentage === "number" &&
              t.platformFeePercentage > 0
                ? t.amount * t.platformFeePercentage
                : undefined;

            const fee = explicitFee ?? inferredFee ?? t.amount;
            return sum + fee;
          }, 0);

        data.push({ label, value });
      }
    } else {
      for (let i = 6; i >= 0; i--) {
        const endOfBucket = new Date(now);
        endOfBucket.setHours(23, 59, 59, 999);
        endOfBucket.setDate(endOfBucket.getDate() - i * 7);
        const startOfBucket = new Date(endOfBucket);
        startOfBucket.setDate(startOfBucket.getDate() - 6);

        const label = `W${i === 0 ? " (Now)" : i}`;

        const value = successfulTx
          .filter((t) => {
            const tDate = new Date(t.date);
            return tDate >= startOfBucket && tDate <= endOfBucket;
          })
          .reduce((sum, t) => {
            const explicitFee =
              typeof t.platformFeeAmount === "number" && t.platformFeeAmount > 0
                ? t.platformFeeAmount
                : undefined;

            const inferredFee =
              typeof t.platformFeePercentage === "number" &&
              t.platformFeePercentage > 0
                ? t.amount * t.platformFeePercentage
                : undefined;

            const fee = explicitFee ?? inferredFee ?? t.amount;
            return sum + fee;
          }, 0);

        data.push({ label, value });
      }
    }
    return data;
  }, [chartView, transactions]);

  const maxChartValue = Math.max(...chartData.map((d) => d.value), 1);

  if (isLoading) {
    return (
      <Layout showBottomNav>
        <main className="flex flex-col items-center justify-center flex-1 p-6">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
          <p className="text-sm font-bold text-text-secondary-light">
            Loading owner dashboard…
          </p>
        </main>
        <BottomNav />
      </Layout>
    );
  }

  const handleSwitchRole = (
    role: "parent" | "owner" | "school_owner",
    sId?: string,
  ) => {
    setActingRole(role, sId);
    if (role === "parent") navigate("/dashboard");
    if (role === "school_owner") navigate("/school-owner-dashboard");
  };

  const handleReviewFirstPayments = (schoolId: string) => {
    if (!schoolId) return;
    setActingRole("school_owner", schoolId);
    navigate("/admin/approvals", { state: { mode: "first" } });
  };

  return (
    <Layout showBottomNav>
      {/* Top Bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between bg-white dark:bg-background-dark p-6 pb-4 border-b border-gray-100 dark:border-gray-800">
        <h1 className="text-xl font-bold tracking-tight text-text-primary-light dark:text-text-primary-dark">
          Admin Overview
        </h1>
        <div className="flex items-center gap-3">
          <NotificationIconButton
            unreadCount={unreadNotificationsCount}
            onClick={() => navigate("/notifications")}
          />
          <div className="relative">
            <button
              onClick={() => navigate("/admin/approvals")}
              className="size-10 flex items-center justify-center rounded-full bg-primary/10 text-primary transition-all active:scale-95"
            >
              <span className="material-symbols-outlined filled">
                verified_user
              </span>
            </button>
            {pendingApprovalsCount > 0 && (
              <span className="absolute -top-1 -right-1 size-5 bg-danger text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-background-dark">
                {pendingApprovalsCount}
              </span>
            )}
          </div>
        </div>
      </div>

      <main className="flex flex-col gap-6 p-6 pb-32">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 bg-slate-900 text-white p-7 rounded-3xl shadow-xl relative overflow-hidden">
            <div className="absolute right-0 top-0 p-4 opacity-10">
              <span className="material-symbols-outlined text-9xl">
                account_balance_wallet
              </span>
            </div>
            <div className="relative z-10">
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-2">
                Total Platform Revenue
              </p>
              <h2 className="text-4xl font-black tracking-tighter">
                ₦{displayRevenue.toLocaleString()}
              </h2>
              <div className="mt-4 flex items-center gap-2">
                <span className="px-2 py-1 rounded bg-accent/20 text-accent text-[9px] font-black uppercase tracking-widest border border-accent/20">
                  Active Scaling
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-card-dark p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
            <p className="text-2xl font-black text-text-primary-light dark:text-text-primary-dark">
              {activeStudents}
            </p>
            <p className="text-[10px] font-bold text-text-secondary-light uppercase tracking-wider">
              Total Students
            </p>
          </div>

          <div className="bg-white dark:bg-card-dark p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
            <p className="text-2xl font-black text-primary">
              ₦{(pendingAmount / 1000000).toFixed(1)}M
            </p>
            <p className="text-[10px] font-bold text-text-secondary-light uppercase tracking-wider">
              Plan Arrears
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-card-dark p-6 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-sm font-black text-text-primary-light dark:text-text-primary-dark uppercase tracking-widest">
                Revenue Insights
              </h3>
              <p className="text-[10px] text-text-secondary-light font-bold">
                Platform collection trends
              </p>
            </div>
            <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-xl">
              <button
                onClick={() => setChartView("Weekly")}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${chartView === "Weekly" ? "bg-white dark:bg-slate-800 text-primary shadow-sm" : "text-text-secondary-light"}`}
              >
                Weekly
              </button>
              <button
                onClick={() => setChartView("Monthly")}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${chartView === "Monthly" ? "bg-white dark:bg-slate-800 text-primary shadow-sm" : "text-text-secondary-light"}`}
              >
                Monthly
              </button>
            </div>
          </div>

          <div className="flex items-end justify-between h-48 gap-3 px-1">
            {chartData.map((item, idx) => {
              const heightPercent = (item.value / maxChartValue) * 100;
              return (
                <div
                  key={idx}
                  className="flex-1 flex flex-col items-center gap-3 h-full justify-end group"
                >
                  <div className="relative w-full h-full flex items-end">
                    <div
                      className="w-full bg-primary/10 group-hover:bg-primary/20 rounded-t-xl transition-all duration-700 ease-out border-b-2 border-primary/40"
                      style={{ height: `${heightPercent}%` }}
                    >
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[8px] font-bold px-1.5 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">
                        ₦{(item.value / 1000).toFixed(0)}k
                      </div>
                    </div>
                  </div>
                  <span className="text-[9px] font-black text-text-secondary-light uppercase tracking-tighter">
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-8 pt-6 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-accent"></div>
              <span className="text-[10px] font-bold text-text-secondary-light uppercase">
                Growth: +12.4%
              </span>
            </div>
            <span className="text-[9px] font-bold text-primary underline cursor-pointer">
              View Detailed Logs
            </span>
          </div>
        </div>

        {pendingFirstPaymentsBySchool.length > 0 && (
          <div className="bg-white dark:bg-card-dark p-6 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-black text-text-primary-light dark:text-text-primary-dark uppercase tracking-widest">
                  First Payments Overview
                </h3>
                <p className="text-[10px] text-text-secondary-light font-bold">
                  Schools with pending first payments
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {pendingFirstPaymentsBySchool.map((item) => (
                <button
                  key={item.schoolId || item.schoolName}
                  onClick={() => handleReviewFirstPayments(item.schoolId)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-white/5 hover:border-primary/40 hover:bg-primary/5 transition-all"
                >
                  <div className="flex flex-col items-start">
                    <span className="text-xs font-bold text-text-primary-light dark:text-text-primary-dark">
                      {item.schoolName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-primary uppercase tracking-widest">
                      {item.count} Pending
                    </span>
                    <span className="material-symbols-outlined text-primary text-sm">
                      chevron_right
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick Operations */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate("/admin/approvals")}
            className="col-span-2 flex items-center justify-between p-5 bg-primary/5 border-2 border-primary/20 rounded-[24px] hover:bg-primary/10 transition-all relative group"
          >
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
                <span className="material-symbols-outlined text-2xl filled">
                  verified_user
                </span>
              </div>
              <div className="text-left">
                <p className="text-sm font-black text-primary uppercase tracking-widest">
                  Verify Approvals
                </p>
                <p className="text-[10px] text-primary/60 font-bold uppercase">
                  {pendingApprovalsCount} Requests Pending
                </p>
              </div>
            </div>
            <span className="material-symbols-outlined text-primary group-hover:translate-x-1 transition-transform">
              chevron_right
            </span>
          </button>

          <button
            onClick={() => navigate("/admin/add-school")}
            className="flex flex-col items-center justify-center gap-2 p-5 bg-white dark:bg-card-dark border-2 border-gray-100 dark:border-gray-800 rounded-[28px] hover:border-primary/40 transition-all group"
          >
            <div className="size-10 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center text-text-secondary-light group-hover:text-primary transition-colors">
              <span className="material-symbols-outlined">add_business</span>
            </div>
            <span className="text-[10px] font-black text-text-primary-light dark:text-text-primary-dark uppercase tracking-widest">
              New School
            </span>
          </button>

          <button
            onClick={() => navigate("/admin/users")}
            className="flex flex-col items-center justify-center gap-2 p-5 bg-white dark:bg-card-dark border-2 border-gray-100 dark:border-gray-800 rounded-[28px] hover:border-primary/40 transition-all group"
          >
            <div className="size-10 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center text-text-secondary-light group-hover:text-primary transition-colors">
              <span className="material-symbols-outlined">group</span>
            </div>
            <span className="text-[10px] font-black text-text-primary-light dark:text-text-primary-dark uppercase tracking-widest">
              Users Directory
            </span>
          </button>
        </div>

        {/* Interactive Dashboard Simulator */}
        <div className="bg-slate-100 dark:bg-white/5 rounded-[32px] p-6 border-2 border-dashed border-gray-200 dark:border-gray-800">
          <h3 className="text-[10px] font-black text-text-secondary-light uppercase tracking-[0.2em] mb-4 text-center">
            Dashboard Simulator
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => handleSwitchRole("owner")}
              className={`flex-1 flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all ${userRole === "owner" ? "bg-slate-900 text-white border-slate-900 shadow-lg" : "bg-white dark:bg-card-dark border-gray-100 dark:border-gray-800 text-text-secondary-light"}`}
            >
              <span className="material-symbols-outlined text-lg">
                admin_panel_settings
              </span>
              <span className="text-[9px] font-black uppercase">Admin</span>
            </button>
            <button
              onClick={() => handleSwitchRole("parent")}
              className={`flex-1 flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all bg-white dark:bg-card-dark border-gray-100 dark:border-gray-800 text-text-secondary-light hover:border-primary/50`}
            >
              <span className="material-symbols-outlined text-lg">
                family_restroom
              </span>
              <span className="text-[9px] font-black uppercase">Parent</span>
            </button>
            <button
              onClick={() => handleSwitchRole("school_owner")}
              className={`flex-1 flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all bg-white dark:bg-card-dark border-gray-100 dark:border-gray-800 text-text-secondary-light hover:border-secondary/50`}
            >
              <span className="material-symbols-outlined text-lg">school</span>
              <span className="text-[9px] font-black uppercase">Owner</span>
            </button>
          </div>
        </div>
      </main>

      <BottomNav />
    </Layout>
  );
};

export default OwnerDashboard;

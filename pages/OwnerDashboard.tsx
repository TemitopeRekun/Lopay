import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { BottomNav } from "../components/BottomNav";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { Transaction } from "../types";

const OwnerDashboard: React.FC = () => {
  const { userRole, setActingRole } = useAuth();
  const {
    transactions,
    allStudents: childrenData,
    schools,
    notifications,
  } = useData();
  const navigate = useNavigate();
  const [chartView, setChartView] = useState<"Weekly" | "Monthly">("Monthly");

  const unreadNotificationsCount = useMemo(() => {
    return notifications ? notifications.filter((n) => !n.read).length : 0;
  }, [notifications]);

  // Dynamic calculations for Platform Overview
  const successfulTransactions = useMemo(
    () => transactions.filter((t) => t.status === "Successful"),
    [transactions],
  );

  const totalRevenue = successfulTransactions.reduce(
    (acc, t) => acc + t.amount,
    0,
  );
  const displayRevenue = totalRevenue;

  const activeStudents = useMemo(() => {
    return childrenData.length;
  }, [childrenData]);

  const pendingAmount = childrenData.reduce(
    (acc, c) => acc + (c.totalFee - c.paidAmount),
    0,
  );

  const pendingApprovalsCount = useMemo(() => {
    return transactions.filter((t) => t.status === "Pending").length;
  }, [transactions]);

  // Chart Data Processing
  const chartData = useMemo(() => {
    const data: { label: string; value: number }[] = [];
    const now = new Date();

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
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = monthNames[d.getMonth()];

        const actual = successfulTransactions
          .filter((t) => {
            const tDate = new Date(t.date);
            return (
              tDate.getMonth() === d.getMonth() &&
              tDate.getFullYear() === d.getFullYear()
            );
          })
          .reduce((sum, t) => sum + t.amount, 0);
        data.push({ label, value: actual });
      }
    } else {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i * 7);
        const startOfWeek = new Date(d);
        startOfWeek.setDate(d.getDate() - d.getDay()); // Sunday
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        const label = `W${i === 0 ? " (Now)" : i}`;

        // Simple weekly approximation: check if transaction date is within the last 7 days from d
        // Better: check if within the specific week window
        const actual = successfulTransactions
          .filter((t) => {
            const tDate = new Date(t.date);
            // Check if tDate is in the week of 'd'
            const diffTime = Math.abs(now.getTime() - tDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            // This is a rough "last 7 weeks" bucket.
            // Let's stick to the simpler bucket logic matching the loop
            const weekStart = new Date(now);
            weekStart.setDate(weekStart.getDate() - (i + 1) * 7);
            const weekEnd = new Date(now);
            weekEnd.setDate(weekEnd.getDate() - i * 7);

            return tDate > weekStart && tDate <= weekEnd;
          })
          .reduce((sum, t) => sum + t.amount, 0);

        data.push({ label, value: actual });
      }
    }
    return data;
  }, [chartView, successfulTransactions]);

  const maxChartValue = Math.max(...chartData.map((d) => d.value), 1);

  const handleSwitchRole = (
    role: "parent" | "owner" | "school_owner",
    sId?: string,
  ) => {
    setActingRole(role, sId);
    if (role === "parent") navigate("/dashboard");
    if (role === "school_owner") navigate("/school-owner-dashboard");
  };

  return (
    <Layout showBottomNav>
      {/* Top Bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between bg-white dark:bg-background-dark p-6 pb-4 border-b border-gray-100 dark:border-gray-800">
        <h1 className="text-xl font-bold tracking-tight text-text-primary-light dark:text-text-primary-dark">
          Admin Overview
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/notifications")}
            className="size-10 rounded-full bg-white dark:bg-card-dark border border-gray-100 dark:border-gray-800 flex items-center justify-center text-text-primary-light dark:text-text-primary-dark shadow-sm hover:shadow-md transition-all relative"
          >
            <span className="material-symbols-outlined text-xl">
              notifications
            </span>
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-2 right-2 size-2 bg-danger rounded-full border border-white dark:border-card-dark"></span>
            )}
          </button>
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
                Total Platform Volume
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

        {/* Revenue Insights Chart */}
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

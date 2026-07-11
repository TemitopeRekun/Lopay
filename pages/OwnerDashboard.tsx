import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { BottomNav } from "../components/BottomNav";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import {
  useAdminPendingFirstPayments,
  useAdminOverview,
  useAdminPlatformRevenue,
  useAdminStudentsSummary,
} from "../hooks/useQueries";
import { OwnerTopBar } from "../components/owner-dashboard/OwnerTopBar";
import { OwnerMetrics } from "../components/owner-dashboard/OwnerMetrics";
import {
  RevenueChart,
  type ChartView,
} from "../components/owner-dashboard/RevenueChart";
import { PendingFirstPaymentsCard } from "../components/owner-dashboard/PendingFirstPaymentsCard";
import { QuickOperations } from "../components/owner-dashboard/QuickOperations";
import { DashboardSimulator } from "../components/owner-dashboard/DashboardSimulator";

const OwnerDashboard: React.FC = () => {
  const { userRole, setActingRole, effectiveRole } = useAuth();
  const { transactions, notifications, isLoading, hasError, refreshData } =
    useData();
  const navigate = useNavigate();
  const [chartView, setChartView] = useState<ChartView>("Monthly");

  const isOwner = userRole === "owner";

  useEffect(() => {
    if (userRole === "owner" && effectiveRole !== "owner") {
      setActingRole("owner");
    }
  }, [userRole, effectiveRole, setActingRole]);

  const {
    data: adminPendingFirstPage,
    isError: pendingFirstError,
    refetch: refetchPendingFirst,
  } = useAdminPendingFirstPayments(isOwner);
  const adminPendingFirst = adminPendingFirstPage?.items ?? [];
  const {
    data: platformRevenueData,
    isError: platformRevenueError,
    refetch: refetchPlatformRevenue,
  } = useAdminPlatformRevenue(isOwner);
  const { data: adminOverview, isError: overviewError } =
    useAdminOverview(isOwner);
  const { data: studentsSummary, isError: summaryError } =
    useAdminStudentsSummary(isOwner);

  const hasOwnerData =
    (adminOverview?.recentTransactions?.length || 0) > 0 ||
    adminPendingFirst.length > 0 ||
    typeof adminOverview?.totalRevenue === "number" ||
    typeof studentsSummary?.totalStudents === "number" ||
    typeof platformRevenueData?.totalRevenue === "number";

  const hasNetworkError =
    !isLoading &&
    (hasError ||
      pendingFirstError ||
      platformRevenueError ||
      overviewError ||
      summaryError);
  const hasEmptyOwnerData =
    !hasNetworkError &&
    !isLoading &&
    (adminOverview?.recentTransactions?.length || 0) === 0 &&
    adminPendingFirst.length === 0;

  const handleRetryAll = () => {
    refreshData();
    if (pendingFirstError) {
      refetchPendingFirst();
    }
    if (platformRevenueError) {
      refetchPlatformRevenue();
    }
  };

  const unreadNotificationsCount = useMemo(() => {
    return notifications ? notifications.filter((n) => !n.read).length : 0;
  }, [notifications]);

  const totalPlatformFee = React.useMemo(() => {
    const apiTotal =
      adminOverview?.totalRevenue ?? platformRevenueData?.totalRevenue;
    if (typeof apiTotal === "number" && apiTotal > 0) {
      return apiTotal;
    }

    const sourceTx = adminOverview?.recentTransactions || transactions || [];
    const successfulTx = sourceTx.filter((t) => t.status === "Successful");

    return successfulTx.reduce((sum, t) => {
      const explicitFee =
        typeof t.platformFeeAmount === "number" && t.platformFeeAmount > 0
          ? t.platformFeeAmount
          : undefined;

      const inferredFee =
        typeof t.platformFeePercentage === "number" &&
        t.platformFeePercentage > 0
          ? t.amount * t.platformFeePercentage
          : undefined;

      const fee = explicitFee ?? inferredFee ?? 0;
      return sum + fee;
    }, 0);
  }, [platformRevenueData, transactions]);

  const displayRevenue = totalPlatformFee;

  const activeStudents = useMemo(() => {
    if (typeof studentsSummary?.activeStudents === "number") {
      return studentsSummary.activeStudents;
    }
    const ids = new Set<string>();
    (adminOverview?.recentTransactions || transactions).forEach((t) => {
      const key = t.childId || t.childName;
      if (key) ids.add(key);
    });
    return ids.size;
  }, [studentsSummary, adminOverview?.recentTransactions, transactions]);

  const totalStudents =
    typeof studentsSummary?.totalStudents === "number"
      ? studentsSummary.totalStudents
      : activeStudents;

  const pendingAmount = useMemo(() => {
    if (typeof studentsSummary?.totalOutstandingBalance === "number") {
      return studentsSummary.totalOutstandingBalance;
    }
    return 0;
  }, [studentsSummary]);

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
    return [];
  }, [isOwner, adminPendingFirst]);

  const pendingApprovalsCount = useMemo(() => {
    if (isOwner) {
      if (typeof adminOverview?.pendingApprovals === "number") {
        return adminOverview.pendingApprovals;
      }
      return adminPendingFirst.length;
    }
    return 0;
  }, [isOwner, adminPendingFirst, adminOverview?.pendingApprovals]);

  // Chart Data Processing (time-bucketed platform fee from transactions)
  const chartData = useMemo(() => {
    if (adminOverview?.revenueSeries?.length) {
      return adminOverview.revenueSeries.map((point) => ({
        label: point.label,
        value: point.value,
      }));
    }

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
  }, [chartView, transactions, adminOverview?.revenueSeries]);

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
      <OwnerTopBar
        unreadCount={unreadNotificationsCount}
        pendingApprovalsCount={pendingApprovalsCount}
        onNotifications={() => navigate("/notifications")}
        onApprovals={() => navigate("/admin/approvals")}
      />

      <main className="flex flex-col gap-6 p-6 pb-32">
        {hasEmptyOwnerData && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-300/40 bg-amber-200/30 px-4 py-3">
            <span className="material-symbols-outlined text-amber-600">
              info
            </span>
            <div>
              <p className="text-xs font-bold text-amber-700">
                No admin data returned yet
              </p>
              <p className="text-xs text-amber-700/80">
                If this is unexpected, confirm the admin history endpoint is
                reachable and try refresh.
              </p>
            </div>
          </div>
        )}
        {hasNetworkError && !hasOwnerData && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-danger/20 bg-danger/5 px-4 py-3">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-danger">
                wifi_off
              </span>
              <div>
                <p className="text-xs font-bold text-text-primary-light dark:text-text-primary-dark">
                  Couldn&apos;t load latest admin data
                </p>
                <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                  Check your connection and try again.
                </p>
              </div>
            </div>
            <button
              onClick={handleRetryAll}
              className="px-3 py-1.5 rounded-full bg-danger text-white text-[10px] font-bold uppercase tracking-[0.15em] active:scale-95 transition-transform"
            >
              Retry
            </button>
          </div>
        )}

        <OwnerMetrics
          displayRevenue={displayRevenue}
          totalStudents={totalStudents}
          pendingAmount={pendingAmount}
        />

        <RevenueChart
          chartView={chartView}
          onChartViewChange={setChartView}
          chartData={chartData}
          maxChartValue={maxChartValue}
        />

        {pendingFirstPaymentsBySchool.length > 0 && (
          <PendingFirstPaymentsCard
            items={pendingFirstPaymentsBySchool}
            onReview={handleReviewFirstPayments}
          />
        )}

        <QuickOperations
          pendingApprovalsCount={pendingApprovalsCount}
          onApprovals={() => navigate("/admin/approvals")}
          onAddSchool={() => navigate("/admin/add-school")}
          onUsers={() => navigate("/admin/users")}
          onAuditLogs={() => navigate("/admin/audit-logs")}
        />

        <DashboardSimulator
          userRole={userRole}
          onSwitchRole={handleSwitchRole}
        />
      </main>

      <BottomNav />
    </Layout>
  );
};

export default OwnerDashboard;

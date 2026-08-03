import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { BottomNav } from "../components/BottomNav";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import {
  useAdminBreakdown,
  useAdminPendingFirstPayments,
  useAdminOverview,
  useAdminStudentsSummary,
} from "../hooks/useQueries";
import type { BreakdownTab } from "../types.admin";
import { OwnerTopBar } from "../components/owner-dashboard/OwnerTopBar";
import { OwnerMetrics } from "../components/owner-dashboard/OwnerMetrics";
import {
  RevenueChart,
  type ChartView,
} from "../components/owner-dashboard/RevenueChart";
import { PendingFirstPaymentsCard } from "../components/owner-dashboard/PendingFirstPaymentsCard";
import { QuickOperations } from "../components/owner-dashboard/QuickOperations";

const OwnerDashboard: React.FC = () => {
  const { userRole } = useAuth();
  const { unreadNotificationsCount, isLoading, hasError, refreshData } =
    useData();
  const navigate = useNavigate();
  const [chartView, setChartView] = useState<ChartView>("Monthly");

  const isOwner = userRole === "owner";

  const {
    data: adminPendingFirstPage,
    isError: pendingFirstError,
    refetch: refetchPendingFirst,
  } = useAdminPendingFirstPayments(isOwner);
  const adminPendingFirst = adminPendingFirstPage?.items ?? [];
  const {
    data: adminOverview,
    isError: overviewError,
    refetch: refetchOverview,
  } = useAdminOverview(isOwner, chartView === "Weekly" ? "weekly" : "monthly");
  const {
    data: studentsSummary,
    isError: summaryError,
    refetch: refetchSummary,
  } = useAdminStudentsSummary(isOwner);
  // Overdue has no cheap source on /overview — it is derived per enrollment
  // against each plan's schedule, so it comes from the breakdown aggregate.
  const {
    data: breakdown,
    isError: breakdownError,
    refetch: refetchBreakdown,
  } = useAdminBreakdown(isOwner);

  const hasOwnerData =
    (adminOverview?.recentTransactions?.length || 0) > 0 ||
    adminPendingFirst.length > 0 ||
    typeof adminOverview?.totalRevenue === "number" ||
    typeof studentsSummary?.totalStudents === "number";

  const hasNetworkError =
    !isLoading &&
    (hasError ||
      pendingFirstError ||
      overviewError ||
      summaryError ||
      breakdownError);
  const hasEmptyOwnerData =
    !hasNetworkError &&
    !isLoading &&
    (adminOverview?.recentTransactions?.length || 0) === 0 &&
    adminPendingFirst.length === 0;

  const handleRetryAll = () => {
    refreshData();
    if (pendingFirstError) refetchPendingFirst();
    if (overviewError) refetchOverview();
    if (summaryError) refetchSummary();
    if (breakdownError) refetchBreakdown();
  };

  /** Land the breakdown screen on the tab matching the card that was tapped. */
  const openBreakdown = (tab: BreakdownTab) =>
    navigate("/admin/breakdown", { state: { tab } });

  // Every headline figure is read straight off the admin endpoints. There is
  // deliberately no client-side fallback: a locally re-derived total diverges
  // from the ledger the moment a payment falls outside the page the client
  // happens to hold, and a plausible-but-wrong number is worse than a blank.
  const displayRevenue = adminOverview?.totalRevenue;
  const totalStudents =
    adminOverview?.totalStudents ?? studentsSummary?.totalStudents;
  const outstandingBalance =
    adminOverview?.totalOutstandingBalance ??
    studentsSummary?.totalOutstandingBalance;

  const pendingFirstPaymentsBySchool = useMemo(() => {
    if (!isOwner) return [];

    const map = new Map<
      string,
      { schoolId: string; schoolName: string; count: number }
    >();

    adminPendingFirst.forEach((t) => {
      const schoolName = t.schoolName || "Unknown School";
      // Group on the id when the API supplies one so two schools sharing a
      // name never collapse into a single row.
      const key = t.schoolId || schoolName;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, { schoolId: t.schoolId ?? "", schoolName, count: 1 });
      }
    });

    return Array.from(map.values());
  }, [isOwner, adminPendingFirst]);

  const pendingApprovalsCount = useMemo(() => {
    if (!isOwner) return 0;
    if (typeof adminOverview?.pendingApprovals === "number") {
      return adminOverview.pendingApprovals;
    }
    return adminPendingFirst.length;
  }, [isOwner, adminPendingFirst, adminOverview?.pendingApprovals]);

  const chartData = useMemo(
    () =>
      (adminOverview?.revenueSeries ?? []).map((point) => ({
        label: point.label,
        value: point.value,
      })),
    [adminOverview?.revenueSeries],
  );

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

  /**
   * Open one school's pending first payments.
   *
   * This used to call `setActingRole("school_owner", schoolId)` first. Acting role
   * is UI-only state that never reaches the server, so it achieved nothing on the
   * approvals screen (which reads the real role and showed the unfiltered
   * platform-wide queue) while flipping DataContext into school mode — firing four
   * SCHOOL_OWNER-only requests that 403 for a SUPER_ADMIN. The school travels in
   * router state and the server applies the filter.
   */
  const handleReviewFirstPayments = (schoolId: string) => {
    if (!schoolId) return;
    navigate("/admin/approvals", { state: { schoolId } });
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
          outstandingBalance={outstandingBalance}
          overdueBalance={breakdown?.totalOverdue}
          onStudentsClick={() => openBreakdown("students")}
          onOutstandingClick={() => openBreakdown("outstanding")}
          onOverdueClick={() => openBreakdown("overdue")}
        />

        <RevenueChart
          chartView={chartView}
          onChartViewChange={setChartView}
          chartData={chartData}
          maxChartValue={maxChartValue}
          onViewLogs={() => navigate("/admin/audit-logs")}
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
          onSchools={() => navigate("/admin/schools")}
          onUsers={() => navigate("/admin/users")}
          onBroadcast={() => navigate("/admin/broadcast")}
          onAuditLogs={() => navigate("/admin/audit-logs")}
        />
      </main>

      <BottomNav />
    </Layout>
  );
};

export default OwnerDashboard;

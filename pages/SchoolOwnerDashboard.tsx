import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { BottomNav } from "../components/BottomNav";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { PlanCard } from "../components/PlanCard";
import { RecentTransactionsList } from "../components/RecentTransactionsList";
import { ImpersonationBanner } from "../components/ImpersonationBanner";
import { NotificationIconButton } from "../components/NotificationIconButton";

const SchoolOwnerDashboard: React.FC = () => {
  const {
    user: currentUser,
    isOwnerAccount,
    setActingRole,
    activeSchoolId,
  } = useAuth();
  const {
    transactions,
    schoolTransactions,
    pendingPayments,
    allStudents: childrenData,
    schools,
    isLoading,
    schoolStats,
  } = useData();
  const navigate = useNavigate();
  const [reportMonth, setReportMonth] = useState(new Date().getMonth());
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const mySchool = useMemo(() => {
    const sId = activeSchoolId || currentUser?.schoolId;
    return schools.find((s) => s.id === sId);
  }, [schools, currentUser, activeSchoolId]);

  const schoolStudents = useMemo(() => {
    return childrenData;
  }, [childrenData]);

  const filteredStudents = useMemo(() => {
    let result = schoolStudents;

    // Filter by Search Query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.grade.toLowerCase().includes(query),
      );
    }

    return result;
  }, [schoolStudents, searchQuery]);

  const pendingFirstEnrollmentsCount = useMemo(
    () => schoolStudents.filter((s) => s.status === "Pending").length,
    [schoolStudents],
  );

  const pendingCount = useMemo(() => pendingPayments.length, [pendingPayments]);

  const totalRevenue = useMemo(() => {
    if (!schoolStats) {
      return 0;
    }
    return Number.isFinite(schoolStats.totalRevenue)
      ? schoolStats.totalRevenue
      : 0;
  }, [schoolStats]);

  const pendingRevenue = useMemo(() => {
    if (!schoolStats) {
      return 0;
    }
    return Number.isFinite(schoolStats.pendingRevenue)
      ? schoolStats.pendingRevenue
      : 0;
  }, [schoolStats]);

  const totalOutstanding = useMemo(() => {
    return schoolStudents.reduce((acc, c) => {
      const isDefaulted = c.status === "Defaulted" || c.status === "Failed";
      if (!isDefaulted) {
        return acc;
      }

      const total = Number.isFinite(c.totalFee) ? c.totalFee : 0;
      const paid = Number.isFinite(c.paidAmount) ? c.paidAmount : 0;
      const derivedRemaining = total - paid;
      const remainingFromChild = Number.isFinite(c.remainingBalance)
        ? c.remainingBalance
        : derivedRemaining;
      const remaining = remainingFromChild > 0 ? remainingFromChild : 0;

      return acc + remaining;
    }, 0);
  }, [schoolStudents]);

  const handleReturnToAdmin = () => {
    setActingRole("owner");
    navigate("/owner-dashboard");
  };

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const downloadReport = () => {
    if (!mySchool) return;
    setIsGenerating(true);
    setTimeout(() => {
      alert("Report generated successfully!");
      setIsGenerating(false);
    }, 1000);
  };

  if (isLoading) {
    return (
      <Layout showBottomNav>
        {activeSchoolId && isOwnerAccount && (
          <ImpersonationBanner
            mode="school"
            label={mySchool?.name || "School"}
            onExit={handleReturnToAdmin}
          />
        )}
        <main className="flex flex-col items-center justify-center flex-1 p-6">
          <div className="w-12 h-12 border-4 border-secondary/30 border-t-secondary rounded-full animate-spin mb-4" />
          <p className="text-sm font-bold text-text-secondary-light">
            Loading school dashboard…
          </p>
        </main>
        <BottomNav />
      </Layout>
    );
  }

  return (
    <Layout showBottomNav>
      {activeSchoolId && isOwnerAccount && (
        <ImpersonationBanner
          mode="school"
          label={mySchool?.name || "School"}
          onExit={handleReturnToAdmin}
        />
      )}

      <div
        className={`sticky top-0 z-10 bg-white dark:bg-background-dark p-6 pb-2 border-b border-gray-100 dark:border-gray-800 ${activeSchoolId && isOwnerAccount ? "top-[42px]" : ""}`}
      ></div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary shadow-sm">
            <span className="material-symbols-outlined text-xl filled">
              school
            </span>
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-text-primary-light dark:text-text-primary-dark">
              {mySchool?.name || "School Dashboard"}
            </h1>
            <p className="text-[9px] text-text-secondary-light font-bold uppercase tracking-widest opacity-70">
              Bursar Management Portal
            </p>
          </div>
        </div>
        <NotificationIconButton
          unreadCount={0}
          onClick={() => navigate("/notifications")}
          variant="round"
        />
      </div>

      <div className="flex flex-col gap-4 relative">
        {/* Search Bar */}
        <div className="relative mx-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
            search
          </span>
          <input
            type="text"
            placeholder="Search by student name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-gray-800 rounded-xl py-3 pl-10 pr-4 text-xs font-bold text-text-primary-light dark:text-text-primary-dark outline-none focus:border-primary transition-all placeholder:font-normal placeholder:text-gray-400"
          />
        </div>

        <div className="flex items-center justify-between px-1">
          <p className="text-[9px] font-bold text-text-secondary-light uppercase tracking-widest">
            Student Registry
          </p>
          <span className="text-[9px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
            {filteredStudents.length} Students
          </span>
        </div>
      </div>

      <main className="flex flex-col gap-6 p-6 pb-32">
        {/* Management Tools */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => navigate("/admin/manage-fees")}
            className="flex flex-col items-start justify-between p-5 bg-secondary/5 border-2 border-secondary/20 rounded-[28px] hover:bg-secondary/10 transition-all group min-h-[140px]"
          >
            <div className="size-10 rounded-xl bg-secondary flex items-center justify-center text-white shadow-lg shadow-secondary/20 mb-3">
              <span className="material-symbols-outlined text-xl filled">
                payments
              </span>
            </div>
            <div>
              <p className="text-sm font-black text-secondary uppercase tracking-widest">
                Fee Structure
              </p>
              <p className="text-[9px] text-secondary/60 font-bold uppercase mt-1">
                Configure Prices
              </p>
            </div>
          </button>

          <button
            onClick={() => navigate("/admin/approvals")}
            className="flex flex-col items-start justify-between p-5 bg-primary/5 border-2 border-primary/20 rounded-[28px] hover:bg-primary/10 transition-all group min-h-[140px] relative"
          >
            {pendingCount > 0 && (
              <div className="absolute top-4 right-4 px-2 py-1 rounded-lg bg-primary text-white text-[9px] font-black uppercase tracking-wide shadow-lg shadow-primary/30 animate-pulse">
                {pendingCount} New
              </div>
            )}
            <div className="size-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20 mb-3">
              <span className="material-symbols-outlined text-xl filled">
                verified
              </span>
            </div>
            <div>
              <p className="text-sm font-black text-primary uppercase tracking-widest">
                Verify Payments
              </p>
              <p className="text-[9px] text-primary/60 font-bold uppercase mt-1">
                Approve Requests
              </p>
            </div>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 bg-slate-900 text-white p-6 rounded-[32px] shadow-2xl relative overflow-hidden group">
            <div className="absolute right-0 top-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
              <span className="material-symbols-outlined text-[100px] filled">
                account_balance_wallet
              </span>
            </div>
            <div className="relative z-10">
              <p className="text-white/50 text-[9px] font-bold uppercase tracking-[0.3em] mb-2">
                Platform Collections
              </p>
              <h2 className="text-3xl font-black tracking-tighter mb-4">
                ₦{totalRevenue.toLocaleString()}
              </h2>
              <div className="flex flex-wrap gap-2">
                <div className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-xl text-[9px] font-black border border-white/10 flex items-center gap-1.5">
                  <span className="size-1.5 bg-accent rounded-full animate-pulse shadow-accent/50 shadow-sm"></span>
                  REAL-TIME INFLOWS
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-xl text-[9px] font-black border border-white/10">
                  {schoolStudents.length} REGISTERED
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-[10px] font-bold text-white/70">
                <span>Pending approvals</span>
                <span>₦{pendingRevenue.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div
            className="bg-white dark:bg-card-dark p-5 rounded-[24px] border border-gray-100 dark:border-gray-800 shadow-sm cursor-pointer active:scale-95 transition-transform"
            onClick={() => navigate("/admin/defaulters")}
          >
            <p className="text-[9px] font-black text-text-secondary-light uppercase tracking-[0.2em] mb-2">
              Fee Arrears
            </p>
            <div className="flex items-baseline gap-1">
              <p className="text-xl font-black text-danger">
                ₦{totalOutstanding.toLocaleString()}
              </p>
              <span className="text-[9px] font-bold text-danger/50 uppercase">
                Pending
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-card-dark p-5 rounded-[24px] border border-gray-100 dark:border-gray-800 shadow-sm">
            <p className="text-[9px] font-black text-text-secondary-light uppercase tracking-[0.2em] mb-2">
              Active Plans
            </p>
            <div className="flex items-baseline gap-1">
              <p className="text-xl font-black text-text-primary-light dark:text-text-primary-dark">
                {schoolStudents.filter((s) => s.status === "Active").length}
              </p>
              <span className="text-[9px] font-bold text-text-secondary-light uppercase">
                Verified
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black text-text-primary-light dark:text-text-primary-dark uppercase tracking-[0.15em] flex items-center gap-2">
              <div className="size-7 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined text-base filled">
                  group
                </span>
              </div>
              School-Wide Ledger
            </h3>
          </div>

          <div className="flex flex-col gap-3">
            {filteredStudents.length === 0 ? (
              <div className="text-center py-20 px-8 bg-gray-50/50 dark:bg-white/5 rounded-[32px] border-2 border-dashed border-gray-100 dark:border-gray-800">
                <div className="size-16 bg-white dark:bg-card-dark rounded-[20px] shadow-xl flex items-center justify-center mx-auto mb-4 transform -rotate-6">
                  <span className="material-symbols-outlined text-3xl text-gray-300">
                    person_search
                  </span>
                </div>
                <h4 className="font-black text-text-primary-light dark:text-text-primary-dark mb-1 text-base">
                  No Records Found
                </h4>
                <p className="text-[10px] text-text-secondary-light max-w-[180px] mx-auto leading-relaxed">
                  No students match your search criteria.
                </p>
              </div>
            ) : (
              filteredStudents.map((child) => (
                <PlanCard
                  key={child.id}
                  child={child}
                  mode="school"
                  schoolName={mySchool?.name || child.school || "School"}
                />
              ))
            )}
          </div>
        </div>

        <RecentTransactionsList
          transactions={schoolTransactions}
          emptyLabel="No transactions recorded"
          onViewAll={() => navigate("/history")}
        />

        <div className="bg-slate-50 dark:bg-white/5 p-6 rounded-[32px] border border-gray-100 dark:border-gray-800 space-y-5">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-white dark:bg-card-dark shadow-xl flex items-center justify-center text-primary">
              <span className="material-symbols-outlined filled text-xl">
                insights
              </span>
            </div>
            <div>
              <h3 className="text-xs font-black text-text-primary-light dark:text-text-primary-dark uppercase tracking-[0.2em]">
                Exports Center
              </h3>
              <p className="text-[9px] text-text-secondary-light font-bold uppercase tracking-tight">
                Audit and transaction reports
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="relative">
              <select
                value={reportMonth}
                onChange={(e) => setReportMonth(parseInt(e.target.value))}
                className="w-full bg-white dark:bg-card-dark border border-gray-100 dark:border-gray-800 rounded-xl px-4 py-3 outline-none focus:border-primary transition-all text-[11px] font-black uppercase tracking-widest appearance-none cursor-pointer shadow-sm"
              >
                {months.map((m, i) => (
                  <option key={i} value={i}>
                    {m} {new Date().getFullYear()}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-base">
                expand_more
              </span>
            </div>
            <button
              onClick={downloadReport}
              disabled={isGenerating}
              className="w-full py-4 bg-primary text-white rounded-xl font-black text-[11px] shadow-lg shadow-primary/10 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-base">
                download
              </span>
              {isGenerating
                ? "GENERATING AUDIT..."
                : "DOWNLOAD COLLECTION LEDGER"}
            </button>
          </div>
        </div>
      </main>

      {isOwnerAccount && (
        <button
          onClick={handleReturnToAdmin}
          className="fixed bottom-24 left-6 z-50 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-4 rounded-[20px] shadow-2xl font-black flex items-center gap-3 hover:scale-105 active:scale-95 transition-all border-2 border-white/10"
        >
          <span className="material-symbols-outlined text-lg">logout</span>
          <span className="text-[10px] uppercase tracking-[0.25em]">
            Admin Hub
          </span>
        </button>
      )}

      <BottomNav />
    </Layout>
  );
};

export default SchoolOwnerDashboard;

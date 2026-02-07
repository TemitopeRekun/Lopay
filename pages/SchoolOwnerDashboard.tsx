import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { BottomNav } from "../components/BottomNav";
import { useApp } from "../context/AppContext";

const SchoolOwnerDashboard: React.FC = () => {
  const {
    transactions,
    childrenData,
    schools,
    currentUser,
    isOwnerAccount,
    setActingRole,
    activeSchoolId,
    updateChildStatus,
  } = useApp();
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

  const schoolTransactions = useMemo(() => {
    return transactions;
  }, [transactions]);

  const pendingCount = useMemo(() => {
    return transactions.filter((t) => t.status === "Pending").length;
  }, [transactions]);

  const totalRevenue = useMemo(() => {
    return schoolTransactions
      .filter((t) => t.status === "Successful")
      .reduce((acc, t) => acc + t.amount, 0);
  }, [schoolTransactions]);

  const totalOutstanding = useMemo(() => {
    return schoolStudents.reduce(
      (acc, c) => acc + (c.totalFee - c.paidAmount),
      0,
    );
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

  return (
    <Layout showBottomNav>
      {activeSchoolId && isOwnerAccount && (
        <div className="bg-secondary text-white px-6 py-2.5 flex items-center justify-between shadow-lg sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">
              visibility
            </span>
            <p className="text-[10px] font-black uppercase tracking-widest">
              Managing {mySchool?.name || "School"}
            </p>
          </div>
          <button
            onClick={handleReturnToAdmin}
            className="bg-white text-secondary px-3 py-1 rounded-full text-[9px] font-black uppercase shadow-sm active:scale-95"
          >
            Exit School
          </button>
        </div>
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
        <button
          onClick={() => navigate("/notifications")}
          className="size-10 rounded-2xl bg-white dark:bg-card-dark border border-gray-100 dark:border-gray-800 flex items-center justify-center text-text-primary-light dark:text-text-primary-dark shadow-sm hover:shadow-md transition-all relative"
        >
          <span className="material-symbols-outlined text-xl">
            notifications
          </span>
          {/* Badge if needed */}
          <span className="absolute top-2 right-2 size-2 bg-danger rounded-full border border-white dark:border-card-dark"></span>
        </button>
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
            </div>
          </div>

          <div className="bg-white dark:bg-card-dark p-5 rounded-[24px] border border-gray-100 dark:border-gray-800 shadow-sm">
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
                {schoolStudents.filter((s) => s.paidAmount > 0).length}
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
              filteredStudents.map((child) => {
                const progress = (child.paidAmount / child.totalFee) * 100;
                const isCompleted = child.status === "Completed";
                const isDefaulted =
                  child.status === "Defaulted" ||
                  child.status === "Failed";
                const isActive =
                  child.status === "Active";
                const isPending = child.status === "Pending";

                let statusColor = "text-warning";
                let bgColor = "bg-warning";

                if (isCompleted) {
                  statusColor = "text-success";
                  bgColor = "bg-success";
                } else if (isDefaulted) {
                  statusColor = "text-danger";
                  bgColor = "bg-danger";
                } else if (isActive) {
                  statusColor = "text-primary";
                  bgColor = "bg-primary";
                }

                return (
                  <div
                    key={child.id}
                    className="group bg-white dark:bg-card-dark p-5 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-sm transition-all hover:border-secondary/30 hover:shadow-xl hover:shadow-secondary/5 hover:-translate-y-0.5"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className="size-12 rounded-[18px] overflow-hidden border-2 border-gray-100 dark:border-gray-800 shadow-inner group-hover:scale-105 transition-transform">
                            <img
                              src={child.avatarUrl}
                              alt={child.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div
                            className={`absolute -bottom-1 -right-1 size-5 rounded-full border-[3px] border-white dark:border-card-dark ${bgColor} ${isPending ? "shadow-lg shadow-warning/30" : ""}`}
                          ></div>
                        </div>
                        <div>
                          <p className="font-black text-sm text-text-primary-light dark:text-text-primary-dark tracking-tight">
                            {child.name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/5 text-[8px] font-black uppercase text-text-secondary-light tracking-tighter">
                              {child.grade}
                            </span>
                            <span
                              className={`text-[9px] font-black uppercase tracking-widest ${statusColor}`}
                            >
                              {child.status}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-base text-text-primary-light dark:text-text-primary-dark">
                          ₦{child.paidAmount.toLocaleString()}
                        </p>
                        <p className="text-[9px] text-text-secondary-light font-bold uppercase tracking-widest opacity-60">
                          Settled
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden shadow-inner">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ease-out ${bgColor}`}
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between items-center text-[9px] font-black text-text-secondary-light uppercase tracking-widest">
                        <div className="flex items-center gap-1.5 text-secondary">
                          <span className="material-symbols-outlined text-[11px] filled">
                            auto_awesome
                          </span>
                          {Math.round(progress)}% Progress
                        </div>
                        <div className="text-text-primary-light dark:text-text-primary-dark bg-gray-50 dark:bg-white/5 px-1.5 py-0.5 rounded-md">
                          ₦
                          {(child.totalFee - child.paidAmount).toLocaleString()}{" "}
                          <span className="opacity-50 font-bold ml-0.5">
                            Balance
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Transactions Log */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black text-text-primary-light dark:text-text-primary-dark uppercase tracking-[0.15em] flex items-center gap-2">
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
            {schoolTransactions.length === 0 ? (
              <div className="text-center py-8 bg-gray-50/30 dark:bg-white/5 rounded-2xl border border-dashed border-gray-100 dark:border-gray-800">
                <p className="text-[10px] text-text-secondary-light font-bold uppercase tracking-widest">
                  No transactions recorded
                </p>
              </div>
            ) : (
              schoolTransactions.slice(0, 5).map((tx) => (
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
                        {tx.childName}
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

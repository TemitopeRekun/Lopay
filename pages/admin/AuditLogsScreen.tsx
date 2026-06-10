import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "../../components/Layout";
import { Header } from "../../components/Header";
import { BackendAPI, AuditLogEntry } from "../../services/backend";
import { useAuth } from "../../context/AuthContext";

const ACTION_LABELS: Record<string, string> = {
  PAYMENT_CONFIRMED: "Confirmed",
  PAYMENT_REJECTED: "Rejected",
  PAYMENT_REVERSED: "Reversed",
  FIRST_PAYMENT_CONFIRMED: "First Confirmed",
  FIRST_PAYMENT_SETTLED: "Settled",
  FIRST_PAYMENT_REJECTED: "First Rejected",
  FIRST_PAYMENT_PAID: "First Paid",
  ENROLLMENT_DEFAULTED: "Defaulted",
  PAYMENT_DISPUTED: "Disputed",
};

const ACTION_COLORS: Record<string, string> = {
  PAYMENT_CONFIRMED: "text-success bg-success/10",
  PAYMENT_REJECTED: "text-danger bg-danger/10",
  PAYMENT_REVERSED: "text-warning bg-warning/10",
  FIRST_PAYMENT_CONFIRMED: "text-success bg-success/10",
  FIRST_PAYMENT_SETTLED: "text-success bg-success/10",
  FIRST_PAYMENT_REJECTED: "text-danger bg-danger/10",
  FIRST_PAYMENT_PAID: "text-success bg-success/10",
  ENROLLMENT_DEFAULTED: "text-danger bg-danger/10",
  PAYMENT_DISPUTED: "text-warning bg-warning/10",
};

const AuditLogsScreen: React.FC = () => {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const [entityType, setEntityType] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [take, setTake] = useState(50);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: logs = [], isLoading, refetch } = useQuery<AuditLogEntry[]>({
    queryKey: ["auditLogs", { entityType, schoolId, take }],
    queryFn: () =>
      BackendAPI.admin.getAuditLogs({
        entityType: entityType || undefined,
        schoolId: schoolId || undefined,
        take,
      }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  if (userRole !== "owner") {
    return (
      <Layout>
        <Header title="Access Denied" />
        <div className="flex flex-col items-center justify-center p-10 text-center flex-1">
          <div className="size-20 bg-danger/10 text-danger rounded-full flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-4xl">lock</span>
          </div>
          <h2 className="text-xl font-bold mb-2">Restricted Area</h2>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 bg-primary text-white rounded-xl font-bold"
          >
            Go Back
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Header title="Audit Log" />
      <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4">
        {/* Filters */}
        <div className="bg-white dark:bg-card-dark rounded-2xl p-4 flex flex-col gap-3 border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary-light">Filters</p>
          <div className="flex gap-2 flex-wrap">
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="flex-1 min-w-[120px] px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-black/20 text-xs font-bold text-text-primary-light dark:text-text-primary-dark focus:outline-none"
            >
              <option value="">All Types</option>
              <option value="Payment">Payment</option>
              <option value="Enrollment">Enrollment</option>
            </select>
            <input
              type="text"
              placeholder="School ID…"
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              className="flex-1 min-w-[120px] px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-black/20 text-xs font-bold text-text-primary-light dark:text-text-primary-dark focus:outline-none"
            />
            <select
              value={take}
              onChange={(e) => setTake(Number(e.target.value))}
              className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-black/20 text-xs font-bold text-text-primary-light dark:text-text-primary-dark focus:outline-none"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-black uppercase tracking-widest"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Log entries */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20 opacity-50">
            <span className="material-symbols-outlined text-4xl animate-spin">progress_activity</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-20 px-8 bg-gray-50/50 dark:bg-white/5 rounded-[32px] border-2 border-dashed border-gray-100 dark:border-gray-800">
            <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">manage_search</span>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No audit entries found</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pb-6">
            {logs.map((entry) => {
              const isExpanded = expanded === entry.id;
              const actionLabel = ACTION_LABELS[entry.action] ?? entry.action;
              const actionColor = ACTION_COLORS[entry.action] ?? "text-gray-500 bg-gray-100";
              const dateStr = new Date(entry.createdAt).toLocaleString("en-NG", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={entry.id}
                  className="bg-white dark:bg-card-dark rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden"
                >
                  <button
                    onClick={() => setExpanded(isExpanded ? null : entry.id)}
                    className="w-full p-4 flex items-start gap-3 text-left"
                  >
                    <div className="size-9 rounded-xl bg-gray-50 dark:bg-black/20 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-lg text-text-secondary-light">history</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${actionColor}`}>
                          {actionLabel}
                        </span>
                        <span className="text-[10px] text-text-secondary-light font-bold uppercase tracking-widest truncate">
                          {entry.entityType} · {entry.entityId.slice(-8)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[10px] text-text-secondary-light">{dateStr}</span>
                        {entry.actorUserId && (
                          <span className="text-[10px] text-text-secondary-light opacity-60">
                            by {entry.actorUserId.slice(-8)}
                          </span>
                        )}
                        {entry.reason && (
                          <span className="text-[10px] text-warning font-bold italic truncate max-w-[140px]">
                            "{entry.reason}"
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-gray-300 text-lg shrink-0 mt-0.5">
                      {isExpanded ? "expand_less" : "expand_more"}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 flex flex-col gap-3 border-t border-gray-50 dark:border-gray-800">
                      {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-text-secondary-light mb-1.5">Metadata</p>
                          <pre className="text-[10px] text-text-secondary-light bg-gray-50 dark:bg-black/20 rounded-xl p-3 overflow-x-auto">
                            {JSON.stringify(entry.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                      {(entry.before || entry.after) && (
                        <div className="grid grid-cols-2 gap-3">
                          {entry.before && (
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-widest text-danger mb-1.5">Before</p>
                              <pre className="text-[10px] text-text-secondary-light bg-danger/5 rounded-xl p-3 overflow-x-auto">
                                {JSON.stringify(entry.before, null, 2)}
                              </pre>
                            </div>
                          )}
                          {entry.after && (
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-widest text-success mb-1.5">After</p>
                              <pre className="text-[10px] text-text-secondary-light bg-success/5 rounded-xl p-3 overflow-x-auto">
                                {JSON.stringify(entry.after, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AuditLogsScreen;

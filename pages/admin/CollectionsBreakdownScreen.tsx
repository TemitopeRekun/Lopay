import React, { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Layout } from "../../components/Layout";
import { Header } from "../../components/Header";
import { Pagination } from "../../components/Pagination";
import {
  useAdminBreakdown,
  useAdminSchoolBreakdown,
} from "../../hooks/useQueries";
import type {
  ApiAdminBreakdownSchool,
  BreakdownTab,
} from "../../types.admin";

const TABS: { key: BreakdownTab; label: string; blurb: string }[] = [
  {
    key: "outstanding",
    label: "Arrears",
    blurb: "All fees still uncollected, on schedule or not",
  },
  {
    key: "overdue",
    label: "Overdue",
    blurb: "Only what is past due against each plan's schedule",
  },
  {
    key: "students",
    label: "Students",
    blurb: "Every enrolled student, settled plans included",
  },
];

const naira = (value: number) => `₦${Math.round(value).toLocaleString("en-NG")}`;

/** The figure each tab ranks and totals on. */
const schoolMetric = (
  school: ApiAdminBreakdownSchool,
  tab: BreakdownTab,
): { primary: string; secondary: string } => {
  if (tab === "overdue") {
    return {
      primary: naira(school.overdue),
      secondary: `${school.overdueStudentCount} ${school.overdueStudentCount === 1 ? "student" : "students"} behind`,
    };
  }
  if (tab === "outstanding") {
    return {
      primary: naira(school.outstanding),
      secondary: `${school.studentsWithBalance} with a balance`,
    };
  }
  return {
    primary: school.totalStudents.toLocaleString("en-NG"),
    secondary: `${school.studentsWithBalance} with a balance`,
  };
};

/**
 * Admin collections breakdown: platform total → per school → per student.
 *
 * Arrears and Overdue are separate tabs rather than one number because they
 * answer different questions — see `common/arrears.ts` on the backend. The tab
 * is passed to the API rather than filtered here, since the overdue ranking is
 * derived server-side and client filtering after pagination would page over the
 * wrong set.
 */
const CollectionsBreakdownScreen: React.FC = () => {
  const location = useLocation();
  const navState = location.state as {
    tab?: BreakdownTab;
    schoolId?: string;
  } | null;

  const [tab, setTab] = useState<BreakdownTab>(navState?.tab ?? "outstanding");
  // Pre-expanded when arrived at from a specific school (e.g. the schools list).
  const [openSchoolId, setOpenSchoolId] = useState<string | null>(
    navState?.schoolId ?? null,
  );
  const [page, setPage] = useState(1);

  const {
    data: summary,
    isLoading,
    isError,
    refetch,
  } = useAdminBreakdown();

  const {
    data: studentsPage,
    isLoading: studentsLoading,
    isError: studentsError,
  } = useAdminSchoolBreakdown(openSchoolId, tab, page);

  const activeTab = TABS.find((t) => t.key === tab)!;

  // Schools with nothing to show on this tab are noise — an admin on the Overdue
  // tab does not want to scroll past every school that is up to date.
  const schools = useMemo(() => {
    const all = summary?.schools ?? [];
    const relevant =
      tab === "overdue"
        ? all.filter((s) => s.overdue > 0)
        : tab === "outstanding"
          ? all.filter((s) => s.outstanding > 0)
          : all.filter((s) => s.totalStudents > 0);

    return [...relevant].sort((a, b) => {
      if (tab === "overdue") return b.overdue - a.overdue;
      if (tab === "outstanding") return b.outstanding - a.outstanding;
      return b.totalStudents - a.totalStudents;
    });
  }, [summary?.schools, tab]);

  const headlineTotal = useMemo(() => {
    if (!summary) return "—";
    if (tab === "overdue") return naira(summary.totalOverdue);
    if (tab === "outstanding") return naira(summary.totalOutstanding);
    return summary.totalStudents.toLocaleString("en-NG");
  }, [summary, tab]);

  const headlineCaption = useMemo(() => {
    if (!summary) return "";
    if (tab === "overdue") {
      return `${summary.overdueStudents} student(s) across ${summary.overdueSchools} school(s)`;
    }
    if (tab === "outstanding") {
      return `${summary.studentsWithBalance} student(s) carrying a balance`;
    }
    return `${schools.length} school(s) with enrolled students`;
  }, [summary, tab, schools.length]);

  const handleTabChange = (next: BreakdownTab) => {
    setTab(next);
    // A school expanded on one tab may not appear on the next, and its rows are
    // a different set — collapse rather than show a stale nesting.
    setOpenSchoolId(null);
    setPage(1);
  };

  const handleSchoolToggle = (schoolId: string) => {
    setOpenSchoolId((current) => (current === schoolId ? null : schoolId));
    setPage(1);
  };

  return (
    <Layout>
      <Header title="Collections Breakdown" />

      <div className="flex flex-col flex-1 overflow-y-auto">
        <div className="px-6 pt-4">
          <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-2xl">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => handleTabChange(t.key)}
                className={`flex-1 px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  tab === t.key
                    ? "bg-white dark:bg-slate-800 text-primary shadow-sm"
                    : "text-text-secondary-light"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div className="bg-slate-900 text-white p-6 rounded-3xl">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">
              {activeTab.label} — platform total
            </p>
            <h2 className="text-3xl font-black tracking-tighter">
              {isLoading ? "…" : headlineTotal}
            </h2>
            <p className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {headlineCaption}
            </p>
            <p className="mt-3 text-[10px] text-slate-500 leading-relaxed">
              {activeTab.blurb}
            </p>
          </div>

          {isError && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-danger/20 bg-danger/5 px-4 py-3">
              <p className="text-xs font-bold text-danger">
                Couldn&apos;t load the breakdown.
              </p>
              <button
                onClick={() => refetch()}
                className="px-3 py-1.5 rounded-full bg-danger text-white text-[10px] font-bold uppercase tracking-[0.15em]"
              >
                Retry
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="flex flex-col items-center py-16 gap-3">
              <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-[10px] font-bold text-text-secondary-light uppercase tracking-widest">
                Loading breakdown…
              </p>
            </div>
          ) : schools.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 dark:bg-white/5 rounded-3xl border-2 border-dashed border-gray-100 dark:border-gray-800">
              <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">
                {tab === "overdue" ? "check_circle" : "school"}
              </span>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                {tab === "overdue"
                  ? "No school is behind schedule"
                  : tab === "outstanding"
                    ? "Nothing outstanding"
                    : "No students enrolled yet"}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {schools.map((school) => {
                const metric = schoolMetric(school, tab);
                const isOpen = openSchoolId === school.schoolId;

                return (
                  <div
                    key={school.schoolId}
                    className="bg-white dark:bg-card-dark rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden"
                  >
                    <button
                      onClick={() => handleSchoolToggle(school.schoolId)}
                      aria-expanded={isOpen}
                      className="w-full flex items-center justify-between gap-3 p-5 text-left hover:bg-primary/5 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-black text-text-primary-light dark:text-text-primary-dark truncate">
                          {school.schoolName}
                        </p>
                        <p className="text-[10px] font-bold text-text-secondary-light uppercase tracking-wider mt-0.5">
                          {metric.secondary}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-base font-black ${tab === "overdue" ? "text-danger" : tab === "outstanding" ? "text-primary" : "text-text-primary-light dark:text-text-primary-dark"}`}
                        >
                          {metric.primary}
                        </span>
                        <span
                          className={`material-symbols-outlined text-text-secondary-light transition-transform ${isOpen ? "rotate-90" : ""}`}
                        >
                          chevron_right
                        </span>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-white/5 px-4 py-3">
                        {studentsLoading ? (
                          <p className="py-6 text-center text-[10px] font-bold text-text-secondary-light uppercase tracking-widest">
                            Loading students…
                          </p>
                        ) : studentsError ? (
                          <p className="py-6 text-center text-[10px] font-bold text-danger uppercase tracking-widest">
                            Couldn&apos;t load students
                          </p>
                        ) : (studentsPage?.items.length ?? 0) === 0 ? (
                          <p className="py-6 text-center text-[10px] font-bold text-text-secondary-light uppercase tracking-widest">
                            No students on this tab
                          </p>
                        ) : (
                          <>
                            <div className="flex flex-col gap-2">
                              {studentsPage?.items.map((student) => (
                                <div
                                  key={student.childId}
                                  className="bg-white dark:bg-card-dark rounded-2xl border border-gray-100 dark:border-gray-800 p-4"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="text-xs font-black text-text-primary-light dark:text-text-primary-dark truncate">
                                        {student.studentName}
                                      </p>
                                      <p className="text-[10px] text-text-secondary-light font-bold truncate">
                                        {student.className} ·{" "}
                                        {student.parentName}
                                      </p>
                                    </div>
                                    <span
                                      className={`text-sm font-black shrink-0 ${tab === "overdue" ? "text-danger" : "text-primary"}`}
                                    >
                                      {tab === "overdue"
                                        ? naira(student.overdue)
                                        : naira(student.outstanding)}
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/5 text-text-secondary-light">
                                      {student.paymentStatus}
                                    </span>
                                    {student.overdue > 0 && (
                                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-danger/10 text-danger">
                                        {student.missedInstallments} missed ·{" "}
                                        {student.daysOverdue}d late
                                      </span>
                                    )}
                                    {student.termExpired && (
                                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-100 text-amber-700">
                                        Term ended
                                      </span>
                                    )}
                                    {student.nextDueDate &&
                                      student.overdue === 0 && (
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-text-secondary-light">
                                          Next due {student.nextDueDate}
                                        </span>
                                      )}
                                  </div>

                                  <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-gray-50 dark:border-gray-800 text-[10px] font-bold text-text-secondary-light">
                                    <span>
                                      Fee {naira(student.totalFee)} ·{" "}
                                      {student.paidInstallments} paid
                                    </span>
                                    {tab === "overdue" && (
                                      <span>
                                        Balance {naira(student.outstanding)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>

                            <div className="mt-2">
                              <Pagination
                                page={studentsPage?.page ?? 1}
                                totalPages={studentsPage?.totalPages ?? 1}
                                onPageChange={setPage}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default CollectionsBreakdownScreen;

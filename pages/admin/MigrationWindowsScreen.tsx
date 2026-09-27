import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "../../components/Layout";
import { Header } from "../../components/Header";
import { BackendAPI, type MigrationWindow } from "../../services/backend";
import { useAuth } from "../../context/AuthContext";
import { useUIStore } from "../../store/uiStore";
import { getErrorMessage } from "../../utils/errors";
import { formatDate } from "../../utils/date";
import { todayInputValue } from "../../utils/plan";

/**
 * Who can still migrate families for free, and for how much longer.
 *
 * ## Why this screen exists
 *
 * Migration is free, once, for sixty days after a school joins — that is what
 * makes the giveaway affordable, because the family's next term is a normal
 * paid enrollment. Before this screen the rule was enforced and invisible: a
 * school learned its window was closing by being refused, and the platform
 * learned when they telephoned. Neither is a position to take a commercial
 * decision from.
 *
 * ## Why the count matters as much as the date
 *
 * `migratedStudents` is what turns "they want more time" into a decision. Four
 * families is a different conversation from four hundred, and a school that has
 * migrated nothing at all in eight weeks is a support problem rather than an
 * extension request.
 */
const MigrationWindowsScreen: React.FC = () => {
  const { userRole } = useAuth();
  const navigate = useNavigate();

  const { data: windows = [], isLoading } = useQuery<MigrationWindow[]>({
    queryKey: ["adminMigrationWindows"],
    queryFn: () => BackendAPI.admin.getMigrationWindows(),
    staleTime: 30_000,
    enabled: userRole === "owner",
  });

  if (userRole !== "owner") {
    return (
      <Layout>
        <Header title="Access Denied" />
        <main className="flex flex-1 flex-col items-center justify-center p-10 text-center">
          <div className="mb-6 flex size-20 items-center justify-center rounded-full bg-danger/10 text-danger">
            <span className="material-symbols-outlined text-4xl">lock</span>
          </div>
          <p className="text-sm text-text-secondary-light">
            Only platform administrators can manage migration periods.
          </p>
          <button
            type="button"
            onClick={() => navigate("/home")}
            className="mt-6 h-12 rounded-xl bg-primary px-6 font-bold text-white"
          >
            Go back
          </button>
        </main>
      </Layout>
    );
  }

  const closingSoon = windows.filter((w) => w.isOpen && w.daysRemaining <= 14);

  return (
    <Layout>
      <Header title="Migration periods" />
      <main className="flex flex-col gap-4 p-6 pb-32">
        <section className="rounded-[28px] border border-primary/20 bg-primary/5 p-5 text-sm text-text-primary-light dark:text-text-primary-dark">
          <p>
            Schools can move families who already paid them onto Lopay for free,
            once, for their first 60 days. After that everyone enrols normally
            and the platform earns its fee.
          </p>
        </section>

        {closingSoon.length > 0 && (
          <div
            className="rounded-[28px] border border-warning/20 bg-warning/10 p-4 text-sm"
            role="status"
          >
            {/*
              One string, not spliced between JSX expressions — split across
              text nodes a screen reader announces the number and the noun
              separately, and nothing can match it as a phrase.
            */}
            {closingSoon.length === 1
              ? `1 school has 2 weeks or less left to migrate.`
              : `${closingSoon.length} schools have 2 weeks or less left to migrate.`}
          </div>
        )}

        {isLoading ? (
          <p className="py-16 text-center text-sm text-text-secondary-light">
            Loading…
          </p>
        ) : windows.length === 0 ? (
          <p className="py-16 text-center text-sm text-text-secondary-light">
            No schools yet.
          </p>
        ) : (
          windows.map((window) => (
            <WindowCard key={window.schoolId} window={window} />
          ))
        )}
      </main>
    </Layout>
  );
};

const WindowCard: React.FC<{ window: MigrationWindow }> = ({ window }) => {
  const [editing, setEditing] = useState(false);

  const tone = !window.isOpen
    ? "bg-gray-100 text-gray-500 dark:bg-gray-800"
    : window.daysRemaining <= 14
      ? "bg-warning/10 text-warning"
      : "bg-success/10 text-success";

  return (
    <article className="rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-surface-dark">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-black text-text-primary-light dark:text-text-primary-dark">
            {window.schoolName}
          </h2>
          <p className="text-xs text-text-secondary-light">
            Joined {formatDate(window.joinedAt)}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${tone}`}
        >
          {window.isOpen
            ? window.daysRemaining === 1
              ? "1 day left"
              : `${window.daysRemaining} days left`
            : "Closed"}
        </span>
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <Row
          label={window.isOpen ? "Closes" : "Closed"}
          value={formatDate(window.closesAt)}
        />
        <Row
          label="Students migrated"
          value={String(window.migratedStudents)}
        />
      </dl>

      {!editing ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-4 h-11 w-full rounded-xl border border-primary/30 text-sm font-bold text-primary"
        >
          {window.isOpen ? "Change the date" : "Reopen migration"}
        </button>
      ) : (
        <EditWindowForm window={window} onClose={() => setEditing(false)} />
      )}
    </article>
  );
};

/**
 * Setting the resulting DATE, never "extend by N days".
 *
 * A relative extension reads more safely and is not: applied to a window that
 * lapsed a fortnight ago, "+7 days" lands in the past and silently changes
 * nothing — the admin believes they granted it, the school is still blocked,
 * and the next call is an escalation about a feature that appears broken. An
 * absolute date says exactly what the school ends up with.
 */
const EditWindowForm: React.FC<{
  window: MigrationWindow;
  onClose: () => void;
}> = ({ window, onClose }) => {
  const queryClient = useQueryClient();
  const showToast = useUIStore((state) => state.showToast);
  const [closesAt, setClosesAt] = useState(window.closesAt.slice(0, 10));
  const [reason, setReason] = useState("");

  const save = useMutation({
    mutationFn: () =>
      BackendAPI.admin.setMigrationWindow(
        window.schoolId,
        // Local midday, for the same reason the invite form uses it: a bare
        // date parses as UTC midnight, which in Lagos is the previous day.
        `${closesAt}T12:00:00.000Z`,
        reason.trim(),
      ),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({
        queryKey: ["adminMigrationWindows"],
      });
      showToast(
        `${result.schoolName} can migrate until ${formatDate(result.closesAt)}.`,
        "success",
      );
      onClose();
    },
    onError: (error) => showToast(getErrorMessage(error), "error"),
  });

  const unchanged = closesAt === window.closesAt.slice(0, 10);
  const canSave = !!closesAt && !!reason.trim() && !unchanged && !save.isPending;

  return (
    <div className="mt-4 space-y-3 rounded-2xl bg-background-light p-4 dark:bg-background-dark">
      <label
        htmlFor={`closes-${window.schoolId}`}
        className="block text-xs font-medium text-text-secondary-light"
      >
        Migration closes on
      </label>
      <input
        id={`closes-${window.schoolId}`}
        type="date"
        value={closesAt}
        min={todayInputValue()}
        onChange={(e) => setClosesAt(e.target.value)}
        className="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm dark:border-gray-700 dark:bg-surface-dark"
      />
      <p className="text-[11px] text-text-secondary-light">
        Set today&apos;s date to stop this school migrating immediately.
      </p>

      <label
        htmlFor={`reason-${window.schoolId}`}
        className="block text-xs font-medium text-text-secondary-light"
      >
        Why? (kept on the record)
      </label>
      <input
        id={`reason-${window.schoolId}`}
        type="text"
        value={reason}
        maxLength={500}
        placeholder="e.g. Still migrating 120 families; agreed a further month."
        onChange={(e) => setReason(e.target.value)}
        className="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm dark:border-gray-700 dark:bg-surface-dark"
      />

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="h-11 flex-1 rounded-xl border border-gray-200 text-sm font-bold dark:border-gray-700"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!canSave}
          onClick={() => save.mutate()}
          className="h-11 flex-1 rounded-xl bg-primary text-sm font-bold text-white disabled:opacity-50"
        >
          {save.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-4">
    <span className="text-text-secondary-light">{label}</span>
    <strong>{value}</strong>
  </div>
);

export default MigrationWindowsScreen;

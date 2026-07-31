import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { useUIStore } from "../store/uiStore";
import { useMyClassFees, useSetMyClassFees } from "../hooks/useQueries";
import { getErrorMessage } from "../utils/errors";

/**
 * First screen a school owner sees after signing in with the credentials the
 * admin issued them.
 *
 * The platform deliberately does NOT seed fees during onboarding. The fee is
 * snapshotted at enrolment and drives both the platform fee and the minimum
 * deposit, so a wrong figure mis-prices every plan created against it — the
 * school knows its own fees, and the audit trail should name the school that
 * set them. Until at least one class is published the school cannot accept
 * enrolments, which is why this screen gates the dashboard.
 */

/** Common Nigerian class names, offered as quick-add — not imposed. */
const SUGGESTED_CLASSES = [
  "Creche",
  "Reception 1",
  "Reception 2",
  "Nursery 1",
  "Nursery 2",
  "Basic 1",
  "Basic 2",
  "Basic 3",
  "Basic 4",
  "Basic 5",
  "Basic 6",
  "JSS1",
  "JSS2",
  "JSS3",
  "SS1",
  "SS2",
  "SS3",
];

interface ClassRow {
  /** Stable key so editing a name doesn't remount the row and drop focus. */
  key: string;
  className: string;
  fee: string;
}

let rowSeq = 0;
const newRow = (className = "", fee = ""): ClassRow => ({
  key: `row-${(rowSeq += 1)}`,
  className,
  fee,
});

const SchoolSetupScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useUIStore();
  const { data: existingFees = [], isLoading } = useMyClassFees();
  const { mutate: publishFees, isPending: isSaving } = useSetMyClassFees();

  const [rows, setRows] = useState<ClassRow[]>([newRow()]);
  const [hydrated, setHydrated] = useState(false);

  // Seed from whatever is already published, so re-entering the screen edits
  // rather than starts over.
  if (!hydrated && !isLoading) {
    setHydrated(true);
    if (existingFees.length > 0) {
      setRows(
        existingFees.map((f) => newRow(f.className, String(f.feeAmount))),
      );
    }
  }

  const usedNames = useMemo(
    () =>
      new Set(
        rows.map((r) => r.className.trim().toLowerCase()).filter(Boolean),
      ),
    [rows],
  );

  const remainingSuggestions = SUGGESTED_CLASSES.filter(
    (c) => !usedNames.has(c.toLowerCase()),
  );

  const updateRow = (key: string, patch: Partial<ClassRow>) =>
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );

  const removeRow = (key: string) =>
    setRows((prev) => {
      const next = prev.filter((r) => r.key !== key);
      // Never leave an empty form with nothing to type into.
      return next.length > 0 ? next : [newRow()];
    });

  const addSuggested = (className: string) =>
    setRows((prev) => {
      // Fill a blank row before appending, so quick-adding doesn't leave gaps.
      const blank = prev.find((r) => !r.className.trim());
      if (blank) {
        return prev.map((r) =>
          r.key === blank.key ? { ...r, className } : r,
        );
      }
      return [...prev, newRow(className)];
    });

  /** Rows that are complete enough to publish. */
  const validRows = useMemo(
    () =>
      rows
        .map((r) => ({
          className: r.className.trim(),
          feeAmount: Number(r.fee),
        }))
        .filter(
          (r) =>
            r.className.length > 0 &&
            Number.isFinite(r.feeAmount) &&
            r.feeAmount > 0,
        ),
    [rows],
  );

  const duplicateName = useMemo(() => {
    const seen = new Set<string>();
    for (const r of validRows) {
      const key = r.className.toLowerCase();
      if (seen.has(key)) return r.className;
      seen.add(key);
    }
    return null;
  }, [validRows]);

  const partialRows = rows.filter((r) => {
    const hasName = r.className.trim().length > 0;
    const hasFee = Number(r.fee) > 0;
    return (hasName && !hasFee) || (!hasName && hasFee);
  });

  const handlePublish = () => {
    if (duplicateName) {
      showToast(`"${duplicateName}" is listed twice. Remove one.`, "warning");
      return;
    }
    if (partialRows.length > 0) {
      showToast("Give every class both a name and a fee.", "warning");
      return;
    }
    if (validRows.length === 0) {
      showToast("Add at least one class and its fee.", "warning");
      return;
    }

    publishFees(validRows, {
      onSuccess: () => {
        showToast(
          `${validRows.length} class fee(s) published. Parents can now enrol.`,
          "success",
        );
        navigate("/school-owner-dashboard", { replace: true });
      },
      onError: (error) => {
        showToast(getErrorMessage(error) || "Could not publish fees.", "error");
      },
    });
  };

  const isFirstRun = existingFees.length === 0;

  return (
    <Layout>
      <div className="flex flex-col flex-1 overflow-y-auto pb-40">
        <div className="px-6 pt-8 pb-4">
          <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2">
            {isFirstRun ? "Step 1 of 1 · Setup" : "Fee structure"}
          </p>
          <h1 className="text-2xl font-black tracking-tight text-text-primary-light dark:text-text-primary-dark">
            {isFirstRun
              ? `Welcome${user?.name ? `, ${user.name.split(" ")[0]}` : ""}`
              : "Update your fees"}
          </h1>
          <p className="text-sm text-text-secondary-light mt-2 leading-relaxed">
            {isFirstRun
              ? "Add your classes and the tuition for each. Parents can't enrol until this is published, and the amount you set here is locked into every plan they create."
              : "Raise or lower any fee here. Changes apply to new enrolments only — plans already running keep the fee they were signed at. Removing a class stops new enrolments into it; existing students are unaffected."}
          </p>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-[10px] font-bold text-text-secondary-light uppercase tracking-widest">
              Loading…
            </p>
          </div>
        ) : (
          <div className="px-6 flex flex-col gap-3">
            {rows.map((row, index) => (
              <div
                key={row.key}
                className="bg-white dark:bg-card-dark p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-start gap-3"
              >
                <div className="flex-1 flex flex-col gap-3">
                  <div>
                    <label
                      htmlFor={`class-name-${row.key}`}
                      className="text-[10px] font-black text-text-secondary-light uppercase tracking-widest block mb-1"
                    >
                      Class name
                    </label>
                    <input
                      id={`class-name-${row.key}`}
                      value={row.className}
                      onChange={(e) =>
                        updateRow(row.key, { className: e.target.value })
                      }
                      placeholder="e.g. JSS1"
                      autoFocus={index === 0 && isFirstRun}
                      className="w-full bg-transparent border-b border-gray-100 dark:border-gray-800 pb-1 outline-none focus:border-primary font-bold text-text-primary-light dark:text-text-primary-dark"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`class-fee-${row.key}`}
                      className="text-[10px] font-black text-text-secondary-light uppercase tracking-widest block mb-1"
                    >
                      Term fee
                    </label>
                    <div className="relative flex items-center">
                      <span className="text-gray-400 font-bold text-lg mr-1">
                        ₦
                      </span>
                      <input
                        id={`class-fee-${row.key}`}
                        value={row.fee}
                        inputMode="numeric"
                        onChange={(e) =>
                          updateRow(row.key, {
                            fee: e.target.value.replace(/\D/g, ""),
                          })
                        }
                        placeholder="0"
                        className="flex-1 bg-transparent border-b border-gray-100 dark:border-gray-800 pb-1 outline-none focus:border-primary font-bold text-lg text-text-primary-light dark:text-text-primary-dark"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeRow(row.key)}
                  aria-label={`Remove ${row.className || "class"}`}
                  className="size-9 flex items-center justify-center text-text-secondary-light hover:text-danger hover:bg-danger/10 rounded-xl transition-all shrink-0"
                >
                  <span className="material-symbols-outlined text-lg">
                    close
                  </span>
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => setRows((prev) => [...prev, newRow()])}
              className="flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 text-text-secondary-light hover:border-primary/50 hover:text-primary transition-all"
            >
              <span className="material-symbols-outlined">add</span>
              <span className="text-[10px] font-black uppercase tracking-widest">
                Add another class
              </span>
            </button>

            {remainingSuggestions.length > 0 && (
              <div className="mt-2">
                <p className="text-[10px] font-black text-text-secondary-light uppercase tracking-widest mb-2">
                  Quick add
                </p>
                <div className="flex flex-wrap gap-2">
                  {remainingSuggestions.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => addSuggested(c)}
                      className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-white/5 text-[10px] font-bold text-text-secondary-light hover:bg-primary/10 hover:text-primary transition-colors"
                    >
                      + {c}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-6 bg-white/95 dark:bg-background-dark/95 backdrop-blur-md border-t border-gray-100 dark:border-gray-800 z-30 pb-safe">
        {duplicateName && (
          <p className="text-[10px] font-bold text-danger uppercase tracking-wider mb-2 text-center">
            &quot;{duplicateName}&quot; is listed twice
          </p>
        )}
        <button
          onClick={handlePublish}
          disabled={isSaving || validRows.length === 0 || !!duplicateName}
          className="w-full h-14 bg-primary text-white rounded-xl font-black text-base uppercase tracking-widest shadow-xl shadow-primary/20 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <span className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Publishing…
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-xl">
                check_circle
              </span>
              {isFirstRun
                ? `Publish ${validRows.length || ""} class${validRows.length === 1 ? "" : "es"}`.trim()
                : "Save changes"}
            </>
          )}
        </button>
        {!isFirstRun && (
          <button
            onClick={() => navigate(-1)}
            className="w-full mt-2 py-2 text-[10px] font-bold text-text-secondary-light uppercase tracking-widest"
          >
            Cancel
          </button>
        )}
      </div>
    </Layout>
  );
};

export default SchoolSetupScreen;

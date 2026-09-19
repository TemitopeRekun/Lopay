import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { Header } from "../components/Header";
import { useMyClassFees } from "../hooks/useQueries";
import { useCreateEnrollmentInvite } from "../hooks/useEnrollmentInvites";
import { formatNaira } from "../utils/currency";
import { formatDate } from "../utils/date";
import {
  MONTHLY_INSTALLMENTS,
  WEEKLY_INSTALLMENTS,
  planEndFor,
  todayInputValue,
} from "../utils/plan";
import { validatePhone } from "../utils/phone";
import type { CreatedInvite } from "../services/enrollmentInvites";
import { InviteSharePanel } from "../components/invites/InviteSharePanel";

/**
 * Invite a parent who paid the school before it joined Lopay.
 *
 * Two things this screen deliberately does NOT do:
 *
 *  1. **Ask for the school fee.** It reads the published `ClassFee` for the
 *     chosen class and shows it read-only. The fee is school-owned but
 *     published once, per class; a free-text box here would let one school hold
 *     two different answers to what a class costs.
 *  2. **Claim anything happened until the server says so.** The share panel only
 *     appears once the API has returned a real invite, and every figure on it
 *     comes from that response rather than from what was typed.
 */

const CreateEnrollmentInviteScreen: React.FC = () => {
  const navigate = useNavigate();
  const { data: classFees = [], isLoading: feesLoading } = useMyClassFees();
  const createInvite = useCreateEnrollmentInvite();

  const [studentName, setStudentName] = useState("");
  const [className, setClassName] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [frequency, setFrequency] = useState<"MONTHLY" | "WEEKLY">("MONTHLY");
  const [planStart, setPlanStart] = useState(todayInputValue);
  const [created, setCreated] = useState<CreatedInvite | null>(null);

  // Derived, never typed — see `planEndFor`. Recomputed as the school changes
  // the start date or the cadence, so what they read is what the server writes.
  const planEnd = useMemo(
    () => planEndFor(planStart, frequency),
    [planStart, frequency],
  );

  const activeFees = useMemo(
    () => classFees.filter((fee) => fee.isActive !== false),
    [classFees],
  );
  const selectedFee = useMemo(
    () => activeFees.find((fee) => fee.className === className),
    [activeFees, className],
  );

  const paidValue = Number(amountPaid);
  const phoneError = parentPhone ? validatePhone(parentPhone) : null;

  const amountError = useMemo(() => {
    if (!amountPaid) return null;
    if (!Number.isFinite(paidValue) || paidValue < 0) {
      return "Enter a valid amount";
    }
    if (selectedFee && paidValue > selectedFee.feeAmount) {
      return `Cannot be more than the ${className} fee of ${formatNaira(selectedFee.feeAmount)}`;
    }
    return null;
  }, [amountPaid, paidValue, selectedFee, className]);

  const remaining = selectedFee
    ? Math.max(0, selectedFee.feeAmount - (paidValue || 0))
    : null;

  const canSubmit =
    !!studentName.trim() &&
    !!className &&
    amountPaid !== "" &&
    !amountError &&
    !!parentPhone &&
    !phoneError &&
    !!planStart &&
    !createInvite.isPending;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    try {
      // Dates are sent as instants; a bare `yyyy-mm-dd` parses as UTC midnight,
      // which in Lagos (UTC+1) is the previous day and would trip the server's
      // back-dating guard. Anchoring to local midday sidesteps that entirely.
      const result = await createInvite.mutateAsync({
        studentName: studentName.trim(),
        className,
        amountAlreadyPaid: paidValue,
        parentPhone,
        installmentFrequency: frequency,
        planStartDate: `${planStart}T12:00:00.000Z`,
      });
      setCreated(result);
    } catch {
      // The mutation's `onError` already toasted the server's message, and the
      // share panel correctly does not appear. Swallowed because `mutateAsync`
      // REJECTS, and an unhandled rejection here is not harmless: index.tsx
      // installs a global `unhandledrejection` handler that writes to
      // `localStorage["lopay:lastError"]`, so every ordinary refusal — a
      // duplicate student, an unpublished class fee, an amount over the fee —
      // was being filed as an application crash and overwriting the slot kept
      // for diagnosing real ones.
    }
  };

  if (created) {
    return (
      <Layout>
        <Header title="Invite ready to send" />
        <main className="flex flex-col gap-6 p-6 pb-32">
          <InviteSharePanel
            invite={created}
            onDone={() => navigate("/school/invites")}
            onAnother={() => {
              setCreated(null);
              setStudentName("");
              setAmountPaid("");
              setParentPhone("");
            }}
          />
        </main>
      </Layout>
    );
  }

  return (
    <Layout>
      <Header title="Invite an existing payer" />
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 p-6 gap-6 pb-32">
        <section className="rounded-[28px] bg-primary/5 border border-primary/20 p-5">
          <h2 className="text-sm font-black text-primary uppercase tracking-[0.15em]">
            Before Lopay
          </h2>
          <p className="mt-2 text-sm text-text-secondary-light">
            For a parent who has already paid you some fees. They will see what
            you record here and confirm it before their plan starts.
          </p>
        </section>

        <div className="bg-white dark:bg-surface-dark rounded-[28px] p-5 shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="studentName"
                className="text-sm font-medium text-text-secondary-light"
              >
                Student name
              </label>
              <input
                id="studentName"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="e.g. Ada Lovelace"
                maxLength={120}
                className="input-field w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-background-light dark:bg-background-dark p-4 outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="className"
                className="text-sm font-medium text-text-secondary-light"
              >
                Class
              </label>
              <select
                id="className"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                disabled={feesLoading || activeFees.length === 0}
                className="input-field w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-background-light dark:bg-background-dark p-4 outline-none focus:ring-2 focus:ring-primary appearance-none disabled:opacity-50"
              >
                <option value="">
                  {feesLoading ? "Loading classes…" : "Select a class"}
                </option>
                {activeFees.map((fee) => (
                  <option key={fee.className} value={fee.className}>
                    {fee.className} — {formatNaira(fee.feeAmount)}
                  </option>
                ))}
              </select>
              {!feesLoading && activeFees.length === 0 && (
                <p className="text-[11px] text-danger font-bold uppercase">
                  Publish your class fees first — the invite uses them.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="amountPaid"
                className="text-sm font-medium text-text-secondary-light"
              >
                Amount already paid to you
              </label>
              <input
                id="amountPaid"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder="0"
                className="input-field w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-background-light dark:bg-background-dark p-4 outline-none focus:ring-2 focus:ring-primary"
              />
              {amountError && (
                <p className="text-[11px] text-danger font-bold uppercase">
                  {amountError}
                </p>
              )}
            </div>

            {selectedFee && (
              <div className="rounded-2xl bg-background-light dark:bg-background-dark p-4 space-y-2 text-sm">
                <Row
                  label={`${className} fee`}
                  value={formatNaira(selectedFee.feeAmount)}
                />
                <Row
                  label="Already paid"
                  value={formatNaira(paidValue || 0)}
                />
                <Row
                  label="Will remain on the plan"
                  value={formatNaira(remaining ?? 0)}
                  emphasis
                />
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label
                htmlFor="parentPhone"
                className="text-sm font-medium text-text-secondary-light"
              >
                Parent&apos;s phone number
              </label>
              <input
                id="parentPhone"
                type="tel"
                inputMode="tel"
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                placeholder="08012345678"
                className="input-field w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-background-light dark:bg-background-dark p-4 outline-none focus:ring-2 focus:ring-primary"
              />
              {phoneError ? (
                <p className="text-[11px] text-danger font-bold uppercase">
                  {phoneError}
                </p>
              ) : (
                <p className="text-[11px] text-text-secondary-light">
                  Only an account using this number can claim the invite, so
                  check it carefully.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-surface-dark rounded-[28px] p-5 shadow-sm border border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-bold mb-4 text-text-primary-light dark:text-text-primary-dark">
            Their new plan
          </h2>
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="frequency"
                className="text-sm font-medium text-text-secondary-light"
              >
                How often they pay
              </label>
              <select
                id="frequency"
                value={frequency}
                onChange={(e) =>
                  setFrequency(e.target.value as "MONTHLY" | "WEEKLY")
                }
                className="input-field w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-background-light dark:bg-background-dark p-4 outline-none focus:ring-2 focus:ring-primary appearance-none"
              >
                <option value="MONTHLY">Monthly</option>
                <option value="WEEKLY">Weekly</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="planStart"
                className="text-sm font-medium text-text-secondary-light"
              >
                Plan starts
              </label>
              <input
                id="planStart"
                type="date"
                value={planStart}
                min={todayInputValue()}
                onChange={(e) => setPlanStart(e.target.value)}
                className="input-field w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-background-light dark:bg-background-dark p-4 outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-[11px] text-text-secondary-light">
                Use today or later — not the date the term began. Payments are
                counted from here, so an earlier date would show the parent as
                already behind.
              </p>
            </div>

            {/*
              Read-only on purpose. `termEndDate` is the point at which an unpaid
              plan is marked as defaulting, and the number of instalments is
              fixed, so it is derived from the start date and the cadence rather
              than chosen. Letting a school type it made the plan default early
              (before the first instalment was even due) or never at all.
            */}
            <div className="rounded-2xl bg-background-light dark:bg-background-dark p-4">
              <Row
                label="Plan runs until"
                value={formatDate(`${planEnd}T12:00:00.000Z`)}
                emphasis
              />
              <p className="mt-2 text-[11px] text-text-secondary-light">
                {frequency === "WEEKLY"
                  ? `${WEEKLY_INSTALLMENTS} weekly payments from the start date.`
                  : `${MONTHLY_INSTALLMENTS} monthly payments from the start date.`}
              </p>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="h-14 rounded-xl bg-primary text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {createInvite.isPending ? "Creating invite…" : "Create invite"}
        </button>
      </form>
    </Layout>
  );
};

const Row: React.FC<{ label: string; value: string; emphasis?: boolean }> = ({
  label,
  value,
  emphasis,
}) => (
  <div className="flex items-center justify-between">
    <span className="text-text-secondary-light">{label}</span>
    <strong className={emphasis ? "text-primary" : undefined}>{value}</strong>
  </div>
);

export default CreateEnrollmentInviteScreen;

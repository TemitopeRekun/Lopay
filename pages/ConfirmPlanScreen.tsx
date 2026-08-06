import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Layout } from "../components/Layout";
import { Header } from "../components/Header";
import { PaymentPlan } from "../types";
import { useUIStore } from "../store/uiStore";
import { useAuth } from "../context/AuthContext";
import { BackendAPI } from "../services/backend";
import { openPaystackPopup } from "../services/paystack";
import { usePaymentCalculation } from "../hooks/useQueries";
import { newIdempotencyKey } from "../utils/idempotency";
import { MONTHLY_INSTALLMENTS } from "../utils/plan";
import { isValidPhone, normalizePhone, validatePhone } from "../utils/phone";

interface LocationState {
  childName?: string;
  schoolName?: string;
  grade?: string;
  totalFee?: number;
  plan?: PaymentPlan;
  depositAmount?: number;
  feeType?: "Semester" | "Session";
  schoolId?: string;
  totalInitialPayment?: number;
  platformFeeAmount?: number;
  /**
   * Optional prefill for the amount box (used by the first-payment retry, which
   * defaults to whatever the parent last attempted). Never widens the bounds —
   * minimum/maximum still come from the calculation.
   */
  suggestedFirstPayment?: number;
}

const naira = (n: number) =>
  `₦${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ConfirmPlanScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useUIStore();
  const { user, updateUser } = useAuth();
  // One stable key per enrollment intent so retries/double-taps don't double-charge.
  const [idempotencyKey] = useState(() => newIdempotencyKey());
  const [isProcessing, setIsProcessing] = useState(false);

  // Enrollment lazily creates the domain Parent row from the user's phone, so
  // this is the point where we actually need one. Parents who signed up with
  // Google never supplied it — ask here rather than blocking the sign-in path.
  const needsPhoneNumber = !user?.phoneNumber;
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const state = location.state as LocationState;

  const {
    childName = "Student",
    schoolName = "Unknown School",
    grade = "Unknown",
    totalFee = 0,
    plan,
    depositAmount = 0,
    feeType = "Session",
    schoolId,
  } = state ?? {};

  const entityType = "School";

  // The calculator screen hands these over; a first-payment retry from the
  // dashboard cannot know them (they derive from the school's fee schedule), so
  // fetch them from the same endpoint the server validates the charge against.
  // Guessing here is what produced a ₦0 platform fee and an understated balance.
  const needsCalculation =
    state?.platformFeeAmount === undefined ||
    state?.totalInitialPayment === undefined;
  const { data: calculation, isLoading: isCalculating, isError: calculationFailed } =
    usePaymentCalculation(
      { schoolId, totalAmount: totalFee, feeType, grade },
      needsCalculation,
    );

  const platformFee = state?.platformFeeAmount ?? calculation?.platformFeeAmount ?? 0;
  const resolvedDeposit = depositAmount || calculation?.depositAmount || 0;
  const minimumPayment =
    state?.totalInitialPayment ??
    calculation?.totalInitialPayment ??
    resolvedDeposit + platformFee;
  const maximumPayment = totalFee + platformFee; // full fee upfront

  const effectivePlan =
    plan || {
      type: "Monthly",
      amount: totalFee,
      frequencyLabel: "Monthly",
      numberOfPayments: MONTHLY_INSTALLMENTS,
    };

  // Feature 2 — flexible first payment. The parent may pay anything from the
  // minimum activation amount up to the full fee. Extra reduces the balance.
  const [amountInput, setAmountInput] = useState<string>("");
  const firstPayment = Number(amountInput) || 0;

  // Seed the box once the bounds are known (immediately when the calculator screen
  // supplied them, or after the fetch resolves on a retry). Only while untouched —
  // re-seeding would fight the parent as they type.
  const hasSeededAmount = useRef(false);
  useEffect(() => {
    if (hasSeededAmount.current || minimumPayment <= 0) return;
    const suggested = state?.suggestedFirstPayment;
    const seed =
      suggested !== undefined &&
      suggested >= minimumPayment &&
      suggested <= maximumPayment
        ? suggested
        : minimumPayment;
    setAmountInput(seed.toFixed(2));
    hasSeededAmount.current = true;
  }, [minimumPayment, maximumPayment, state?.suggestedFirstPayment]);

  const { amountToSchool, remainingBalance, futureInstallmentAmount, amountError } =
    useMemo(() => {
      const toSchool = Math.max(0, firstPayment - platformFee);
      const remaining = Math.max(0, totalFee - toSchool);
      const installment =
        remaining > 0 && effectivePlan.numberOfPayments > 0
          ? remaining / effectivePlan.numberOfPayments
          : 0;
      let err: string | null = null;
      if (firstPayment < minimumPayment - 0.001) {
        err = `Minimum first payment is ${naira(minimumPayment)}`;
      } else if (firstPayment > maximumPayment + 0.001) {
        err = `Maximum first payment is ${naira(maximumPayment)}`;
      }
      return {
        amountToSchool: toSchool,
        remainingBalance: remaining,
        futureInstallmentAmount: installment,
        amountError: err,
      };
    }, [firstPayment, platformFee, totalFee, minimumPayment, maximumPayment, effectivePlan]);

  const monthsDuration = feeType === "Session" ? 7 : 3;
  const contactIncomplete = needsPhoneNumber && !isValidPhone(phoneInput);

  if (!state) return null;

  // Don't render a money breakdown against unknown figures — an amount box seeded
  // from a guessed minimum is worse than a spinner.
  if (needsCalculation && isCalculating) {
    return (
      <Layout>
        <Header title="Finalize & Activate" />
        <div className="flex flex-col items-center justify-center flex-1 p-6">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          <p className="mt-4 text-text-secondary-light text-sm">
            Loading your payment details...
          </p>
        </div>
      </Layout>
    );
  }

  if (needsCalculation && (calculationFailed || minimumPayment <= 0)) {
    return (
      <Layout>
        <Header title="Finalize & Activate" />
        <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
          <span className="material-symbols-outlined text-4xl text-danger mb-2">
            error
          </span>
          <p className="text-text-secondary-light mb-4 text-sm">
            We couldn&apos;t load this school&apos;s payment details. Please try
            again.
          </p>
          <button
            onClick={() => navigate(-1)}
            className="text-primary font-bold"
          >
            Go Back
          </button>
        </div>
      </Layout>
    );
  }

  const handlePay = async () => {
    if (!schoolId) {
      showToast("Missing school information. Please restart the process.", "error");
      return;
    }
    if (amountError) {
      showToast(amountError, "error");
      return;
    }

    // Save the contact number before taking any money — if this fails we haven't
    // charged anyone, and the Parent row created during enrollment would
    // otherwise be stuck with a blank phone.
    if (needsPhoneNumber) {
      const validationError = validatePhone(phoneInput);
      if (validationError) {
        setPhoneError(validationError);
        showToast(validationError, "error");
        return;
      }
      setIsProcessing(true);
      try {
        await updateUser({ phoneNumber: normalizePhone(phoneInput) });
      } catch {
        showToast("Couldn't save your phone number. Please try again.", "error");
        setIsProcessing(false);
        return;
      }
    } else {
      setIsProcessing(true);
    }

    const startDate = new Date();
    const endDate = new Date(startDate);
    if (effectivePlan.type === "Weekly") {
      endDate.setDate(startDate.getDate() + effectivePlan.numberOfPayments * 7);
    } else {
      endDate.setMonth(startDate.getMonth() + effectivePlan.numberOfPayments);
    }

    try {
      // 1. Initialize the split transaction on the backend. Round to whole kobo
      // so the charged amount and the displayed split agree to the kobo.
      const init = await BackendAPI.parent.initiateFirstPayment({
        childName,
        schoolId,
        className: grade,
        installmentFrequency: effectivePlan.type.toUpperCase(),
        firstPaymentPaid: Math.round(firstPayment * 100) / 100,
        termStartDate: startDate.toISOString(),
        termEndDate: endDate.toISOString(),
        idempotencyKey,
      });

      /*
       * 2. Open the Paystack popup, then hand every outcome to
       * /payment-status.
       *
       * This used to branch here: verify inline, then pick one of four toasts
       * and either redirect or sit still. That made a three-second toast the
       * entire confirmation for a payment of tens of thousands of naira, and it
       * put the "did this work?" decision in the client. The result screen owns
       * both now — it calls the server, which reconciles with Paystack and
       * returns the verdict plus the figures to render.
       *
       * `replace: true` so the device back button cannot return to a checkout
       * screen whose transaction has already been consumed.
       *
       * `retryState` carries this screen's own navigation state back, so "Try
       * again" lands on a fully-populated checkout rather than a blank one. The
       * fresh mount also mints a new idempotency key, which is what makes the
       * retry a real second charge.
       */
      const outcome = await openPaystackPopup(init.accessCode);
      const retry = { retryTo: "/confirm-plan", retryState: location.state };

      if (outcome === "cancelled") {
        navigate("/payment-status", {
          replace: true,
          state: { outcome: "cancelled", ...retry },
        });
        return;
      }

      navigate("/payment-status", {
        replace: true,
        state: {
          reference: init.reference,
          fallbackAmount: firstPayment,
          fallbackChildName: childName,
          ...retry,
        },
      });
      return;
    } catch (err: any) {
      const backendMessage = err?.response?.data?.message;
      const errorMessage = Array.isArray(backendMessage)
        ? backendMessage.join(", ")
        : backendMessage || err?.message || "Payment failed. Please try again.";
      showToast(`Payment Failed: ${errorMessage}`, "error");
      setIsProcessing(false);
    }
  };

  return (
    <Layout>
      <Header title="Finalize & Activate" />

      <div className="flex-1 p-6 overflow-y-auto pb-40">
        {/* Header Summary */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-gray-800 flex items-center gap-4">
          <div className="h-14 w-14 rounded-full overflow-hidden shadow-inner shrink-0">
            <img
              src={`https://ui-avatars.com/api/?name=${childName.replace(" ", "+")}&background=random`}
              alt="user"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="overflow-hidden">
            <h3 className="text-lg font-bold leading-tight truncate">{childName}</h3>
            <p className="text-[10px] font-bold uppercase text-text-secondary-light truncate">
              {grade} • {schoolName}
            </p>
          </div>
        </div>

        <section className="mb-8">
          <h3 className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark uppercase tracking-wider mb-4 px-1">
            First Payment
          </h3>
          <div className="bg-slate-900 text-white rounded-[32px] p-6 shadow-2xl relative overflow-hidden mb-4 border border-white/10">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mr-16 -mt-16"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-primary text-sm filled">
                  verified
                </span>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                  Pay securely with Paystack
                </p>
              </div>

              {/* Editable amount */}
              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                Amount to pay now
              </label>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-black tracking-tighter">₦</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={amountInput}
                  min={minimumPayment}
                  max={maximumPayment}
                  step="0.01"
                  onChange={(e) => setAmountInput(e.target.value)}
                  className="flex-1 bg-transparent text-4xl font-black tracking-tighter outline-none border-b border-white/20 focus:border-primary pb-1 w-full"
                />
              </div>
              {amountError ? (
                <p className="mt-2 text-[10px] font-bold text-red-400">{amountError}</p>
              ) : (
                <p className="mt-2 text-[10px] text-slate-400 font-medium">
                  Pay anywhere from {naira(minimumPayment)} (minimum) up to{" "}
                  {naira(maximumPayment)} (full fee). A small Paystack processing
                  fee is added at checkout.
                </p>
              )}

              {/* Quick presets */}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setAmountInput(minimumPayment.toFixed(2))}
                  className="flex-1 py-2 rounded-xl bg-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-colors"
                >
                  Minimum
                </button>
                <button
                  onClick={() =>
                    setAmountInput((minimumPayment + (maximumPayment - minimumPayment) / 2).toFixed(2))
                  }
                  className="flex-1 py-2 rounded-xl bg-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-colors"
                >
                  Half
                </button>
                <button
                  onClick={() => setAmountInput(maximumPayment.toFixed(2))}
                  className="flex-1 py-2 rounded-xl bg-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-colors"
                >
                  Full fee
                </button>
              </div>

              {/* Split breakdown */}
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 space-y-2 mt-4">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">
                    To {entityType.toLowerCase()}
                  </span>
                  <span className="text-xs font-bold">{naira(amountToSchool)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">
                    Platform fee
                  </span>
                  <span className="text-xs font-bold">{naira(platformFee)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-white/5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">
                    Balance after payment
                  </span>
                  <span className="text-xs font-bold">{naira(remainingBalance)}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {needsPhoneNumber && (
          <section className="mb-8">
            <h3 className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark uppercase tracking-wider mb-4 px-1">
              Contact Number
            </h3>
            <div className="bg-white dark:bg-card-dark border border-gray-100 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
              <p className="text-[10px] font-medium text-text-secondary-light mb-3 leading-snug">
                We need a phone number to reach you about this enrollment and
                your payment schedule.
              </p>
              <input
                type="tel"
                value={phoneInput}
                onChange={(e) => {
                  setPhoneInput(e.target.value);
                  setPhoneError(
                    e.target.value.trim() ? validatePhone(e.target.value) : null,
                  );
                }}
                placeholder="e.g. 08012345678"
                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/50"
              />
              {phoneError && (
                <p className="mt-2 text-[10px] font-bold text-danger">
                  {phoneError}
                </p>
              )}
            </div>
          </section>
        )}

        <section className="mb-6">
          <h3 className="text-sm font-bold text-text-secondary-light uppercase tracking-wider mb-4 px-1">
            Future Roadmap
          </h3>
          <div className="bg-white dark:bg-card-dark border border-gray-100 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-base mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">schedule</span>
              {entityType} Installment Details
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-800">
                <span className="text-sm text-text-secondary-light">
                  {remainingBalance > 0 ? "Installment Amount" : "Status"}
                </span>
                <span className="font-bold">
                  {remainingBalance > 0
                    ? `${naira(futureInstallmentAmount)} ${effectivePlan.frequencyLabel}`
                    : "Paid in full 🎉"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-text-secondary-light">Plan Duration</span>
                <span className="font-bold">{monthsDuration} Months</span>
              </div>
            </div>
            <div className="mt-4 p-3 bg-primary/5 rounded-xl flex items-start gap-2 border border-primary/10">
              <span className="material-symbols-outlined text-sm text-primary">info</span>
              <p className="text-[10px] font-bold text-primary-dark dark:text-primary leading-snug uppercase tracking-tight">
                After activation, remaining payments are made directly to the{" "}
                {entityType.toLowerCase()}'s verified bank details.
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-6 bg-white dark:bg-card-dark border-t border-gray-100 dark:border-gray-800 z-20 pb-safe">
        <button
          onClick={handlePay}
          disabled={isProcessing || !!amountError || contactIncomplete}
          className="w-full h-14 bg-primary text-white rounded-xl font-bold text-lg shadow-lg shadow-primary/25 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center transition-all hover:opacity-90 active:scale-95"
        >
          {isProcessing ? (
            <div className="flex items-center gap-2">
              <span className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              <span>Processing...</span>
            </div>
          ) : (
            `Pay ${naira(firstPayment)} with Paystack`
          )}
        </button>
        <p className="text-center text-[10px] text-text-secondary-light mt-3 font-medium uppercase tracking-tight">
          By paying, you agree to the{" "}
          <Link to="/terms" className="font-medium text-primary underline">
            Escrow Terms
          </Link>
          .
        </p>
      </div>
    </Layout>
  );
};

export default ConfirmPlanScreen;

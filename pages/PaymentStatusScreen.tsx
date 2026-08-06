import React, { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { Header } from "../components/Header";
import { useUIStore } from "../store/uiStore";
import { usePaymentOutcome } from "../hooks/useQueries";

/**
 * The post-payment screen, for BOTH payment rails.
 *
 * This replaced a three-second toast and an immediate redirect. A first payment
 * is real money — often tens of thousands of naira — and the only confirmation
 * a parent got was green text that vanished before a slow dashboard had
 * finished loading. Nothing showed the amount, nothing showed the reference,
 * and a decline said "Please try again" without ever saying why, which for a
 * blocked card is advice that produces an identical decline every time.
 *
 * Two rules hold this screen together:
 *
 *  1. **The server owns the verdict.** `state` comes from the backend, which
 *     reconciles with Paystack before answering. This component does not
 *     inspect a status string to decide whether money moved — every
 *     client-side re-derivation in this codebase has drifted from the ledger
 *     (see the header of `enrollment-view.ts`).
 *
 *  2. **`cancelled` is the one state the client owns**, because it describes
 *     something only the browser saw: the parent closed the popup before a
 *     charge existed. There is no payment row to ask about, so it is passed in
 *     via navigation state and never fetched.
 */

type OutcomeState = "succeeded" | "processing" | "failed" | "cancelled";

interface LocationState {
  reference?: string;
  paymentId?: string;
  /** Set only for `cancelled`, which has no server-side row to read. */
  outcome?: OutcomeState;
  /** Where "Try again" should go back to, with the state that screen needs. */
  retryTo?: string;
  retryState?: unknown;
  /** Shown while the first fetch is in flight, so the amount isn't blank. */
  fallbackAmount?: number;
  fallbackChildName?: string;
}

const naira = (n: number) =>
  `₦${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/** Visual treatment per verdict. Kept in one place so copy and colour agree. */
const PRESENTATION: Record<
  OutcomeState,
  { icon: string; tile: string; ring: string; title: string }
> = {
  succeeded: {
    icon: "check_circle",
    tile: "bg-success",
    ring: "ring-success/20",
    title: "Payment Successful",
  },
  processing: {
    icon: "hourglass_top",
    tile: "bg-amber-500",
    ring: "ring-amber-500/20",
    title: "Payment Processing",
  },
  failed: {
    icon: "error",
    tile: "bg-red-500",
    ring: "ring-red-500/20",
    title: "Payment Failed",
  },
  cancelled: {
    icon: "cancel",
    tile: "bg-slate-500",
    ring: "ring-slate-500/20",
    title: "Payment Cancelled",
  },
};

const PaymentStatusScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useUIStore();
  const state = (location.state ?? {}) as LocationState;

  const isCancelled = state.outcome === "cancelled";
  const locator = useMemo(
    () =>
      isCancelled
        ? {}
        : { reference: state.reference, paymentId: state.paymentId },
    [isCancelled, state.reference, state.paymentId],
  );

  const { data, isLoading, isError, refetch, isFetching } =
    usePaymentOutcome(locator);

  const hasLocator = Boolean(state.reference || state.paymentId);
  const isFirstPayment = data?.paymentType !== "INSTALLMENT";

  const goToDashboard = () => navigate("/dashboard", { replace: true });

  const retry = () => {
    if (state.retryTo) {
      navigate(state.retryTo, { replace: true, state: state.retryState });
      return;
    }
    goToDashboard();
  };

  const copyReference = async (reference: string) => {
    try {
      await navigator.clipboard.writeText(reference);
      showToast("Reference copied.", "success");
    } catch {
      showToast("Couldn't copy — please note it down.", "warning");
    }
  };

  // Arrived with nothing to look up (a direct URL, or a reload that dropped
  // router state). Say so rather than rendering a permanent spinner.
  if (!isCancelled && !hasLocator) {
    return (
      <Layout>
        <Header title="Payment" />
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
          <span className="material-symbols-outlined text-4xl text-text-secondary-light">
            receipt_long
          </span>
          <p className="text-sm font-bold">No payment to show</p>
          <p className="text-xs text-text-secondary-light max-w-xs">
            This page opens right after a payment. Your full record is always in
            your payment history.
          </p>
          <div className="flex flex-col gap-2 w-full max-w-xs pt-2">
            <button
              onClick={goToDashboard}
              className="w-full bg-primary text-white py-3 rounded-xl text-sm font-bold active:scale-95 transition-all"
            >
              Go to dashboard
            </button>
            <button
              onClick={() => navigate("/history")}
              className="w-full border border-gray-200 dark:border-gray-800 py-3 rounded-xl text-sm font-bold active:scale-95 transition-all"
            >
              View payment history
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  if (!isCancelled && isLoading) {
    return (
      <Layout>
        <Header title="Payment" />
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
          <div className="size-14 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-sm font-bold">Confirming your payment…</p>
          {typeof state.fallbackAmount === "number" && (
            <p className="text-xs text-text-secondary-light">
              {naira(state.fallbackAmount)}
              {state.fallbackChildName ? ` · ${state.fallbackChildName}` : ""}
            </p>
          )}
          <p className="text-[11px] text-text-secondary-light max-w-xs">
            Please don't close this page.
          </p>
        </div>
      </Layout>
    );
  }

  /*
   * The lookup itself failed (network, or the server errored). This is NOT a
   * failed payment and must never be shown as one: the charge has very likely
   * gone through and the webhook will settle it regardless of what this screen
   * can reach. Offer a retry of the LOOKUP, not of the payment.
   */
  if (!isCancelled && isError) {
    return (
      <Layout>
        <Header title="Payment" />
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
          <span className="material-symbols-outlined text-4xl text-amber-500">
            sync_problem
          </span>
          <p className="text-sm font-bold">
            We couldn't confirm your payment just now
          </p>
          <p className="text-xs text-text-secondary-light max-w-xs">
            This doesn't mean it failed. If your account was debited, it will be
            confirmed automatically — check your dashboard shortly.
          </p>
          <div className="flex flex-col gap-2 w-full max-w-xs pt-2">
            <button
              onClick={() => void refetch()}
              disabled={isFetching}
              className="w-full bg-primary text-white py-3 rounded-xl text-sm font-bold active:scale-95 transition-all disabled:opacity-60"
            >
              {isFetching ? "Checking…" : "Check again"}
            </button>
            <button
              onClick={goToDashboard}
              className="w-full border border-gray-200 dark:border-gray-800 py-3 rounded-xl text-sm font-bold active:scale-95 transition-all"
            >
              Go to dashboard
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const outcome: OutcomeState = isCancelled ? "cancelled" : (data?.state ?? "processing");
  const presentation = PRESENTATION[outcome];
  const amount = data?.amount ?? state.fallbackAmount ?? null;
  const childName = data?.childName ?? state.fallbackChildName ?? null;

  /** What happens next, in the parent's terms. Rail-aware. */
  const explanation = (() => {
    switch (outcome) {
      case "succeeded":
        return isFirstPayment
          ? "Your enrollment is now active."
          : "Your school has confirmed this payment.";
      case "processing":
        return isFirstPayment
          ? "Your payment is being confirmed. If your account was debited, this completes automatically — you'll be notified."
          : "Your school will review your receipt and confirm this payment. You'll be notified as soon as they do.";
      case "failed":
        return "No money has left your account. You can try again.";
      case "cancelled":
        return "You closed the payment window, so nothing was charged.";
    }
  })();

  return (
    <Layout>
      <Header title="Payment" />

      {/* pb-52 clears the pinned footer at its tallest (two stacked buttons). */}
      <div className="flex-1 overflow-y-auto p-6 pb-52">
        <div className="flex flex-col items-center text-center pt-4 pb-6">
          <div
            className={`size-20 rounded-full ${presentation.tile} ring-8 ${presentation.ring} flex items-center justify-center mb-5`}
          >
            <span className="material-symbols-outlined text-white text-4xl filled">
              {presentation.icon}
            </span>
          </div>

          <h2 className="text-xl font-black tracking-tight">
            {presentation.title}
          </h2>

          {amount !== null && (
            <p className="mt-2 text-3xl font-black tracking-tight">
              {naira(amount)}
            </p>
          )}

          {(childName || data?.schoolName) && (
            <p className="mt-2 text-xs font-bold text-text-secondary-light uppercase tracking-wider">
              {[childName, data?.className].filter(Boolean).join(" · ")}
              {data?.schoolName ? ` · ${data.schoolName}` : ""}
            </p>
          )}

          <p className="mt-4 text-sm text-text-secondary-light max-w-xs leading-relaxed">
            {explanation}
          </p>

          {/*
           * Paystack's own words for the decline. Without this the parent is
           * told only "failed", so a card that will decline identically every
           * time reads as bad luck worth retrying.
           */}
          {outcome === "failed" && data?.reason && (
            <div className="mt-4 w-full max-w-xs rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-1">
                Reason from your bank
              </p>
              <p className="text-xs font-bold text-red-600 dark:text-red-400">
                {data.reason}
              </p>
            </div>
          )}
        </div>

        {/* Plan state after this payment — the same figures the plan card shows. */}
        {outcome === "succeeded" && data && (
          <div className="rounded-2xl border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800 mb-4">
            {typeof data.remainingBalance === "number" && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs font-bold text-text-secondary-light">
                  Balance remaining
                </span>
                <span className="text-sm font-black">
                  {naira(data.remainingBalance)}
                </span>
              </div>
            )}
            {typeof data.nextInstallmentAmount === "number" &&
              data.nextInstallmentAmount > 0 && (
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-xs font-bold text-text-secondary-light">
                    Next installment
                  </span>
                  <span className="text-sm font-black">
                    {naira(data.nextInstallmentAmount)}
                    {data.nextDueDate ? (
                      <span className="ml-1 text-[10px] font-normal opacity-70">
                        due {data.nextDueDate}
                      </span>
                    ) : null}
                  </span>
                </div>
              )}
          </div>
        )}

        {/* The reference is what support asks for. Always available, always copyable. */}
        {data?.reference && (
          <button
            onClick={() => void copyReference(data.reference as string)}
            className="w-full flex items-center justify-between rounded-2xl border border-gray-100 dark:border-gray-800 px-4 py-3 text-left active:scale-[0.99] transition-all"
          >
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary-light">
                Reference
              </p>
              <p className="text-xs font-bold truncate">{data.reference}</p>
            </div>
            <span className="material-symbols-outlined text-base text-text-secondary-light shrink-0 ml-3">
              content_copy
            </span>
          </button>
        )}
      </div>

      {/*
        Actions are pinned so "Go to dashboard" is always reachable.
        `pb-safe` and `z-20` match the app's other pinned footers
        (ConfirmPlanScreen, SchoolSetupScreen, BottomNav): this ships as a
        Capacitor native app, and without the safe-area inset these buttons sit
        under the iPhone home indicator.
      */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-6 z-20 pb-safe bg-white/95 dark:bg-background-dark/95 backdrop-blur-md border-t border-gray-100 dark:border-gray-800">
        <div className="flex flex-col gap-2">
          {(outcome === "failed" || outcome === "cancelled") && (
            <button
              onClick={retry}
              className="w-full bg-primary text-white py-3.5 rounded-xl text-sm font-bold active:scale-95 transition-all"
            >
              Try again
            </button>
          )}
          <button
            onClick={goToDashboard}
            className={`w-full py-3.5 rounded-xl text-sm font-bold active:scale-95 transition-all ${
              outcome === "failed" || outcome === "cancelled"
                ? "border border-gray-200 dark:border-gray-800"
                : "bg-primary text-white"
            }`}
          >
            Go to dashboard
          </button>
          {outcome === "succeeded" && (
            <button
              onClick={() => navigate("/history")}
              className="w-full border border-gray-200 dark:border-gray-800 py-3.5 rounded-xl text-sm font-bold active:scale-95 transition-all"
            >
              View payment history
            </button>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default PaymentStatusScreen;

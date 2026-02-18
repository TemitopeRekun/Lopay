import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../../components/Layout";
import { Header } from "../../components/Header";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import {
  useAdminPendingFirstPayments,
  useAdminPendingInstallments,
  useSettleFirstPayment,
  useRejectFirstPayment,
} from "../../hooks/useQueries";

const PaymentApprovalsScreen: React.FC = () => {
  const { userRole } = useAuth();
  const {
    pendingPayments,
    transactions,
    confirmPayment,
    declinePayment,
    allStudents,
    confirmFirstPayment,
  } = useData();
  const navigate = useNavigate();
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    id: string;
    type: "approve" | "decline";
    scope: "installment" | "first";
  } | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const isOwner = userRole === "owner";
  const isSchoolOwner = userRole === "school_owner";

  const { data: adminPendingFirst = [] } =
    useAdminPendingFirstPayments(isOwner);
  const { data: adminPendingInstallments = [] } =
    useAdminPendingInstallments(isOwner);
  const settleFirstPayment = useSettleFirstPayment();
  const rejectFirstPayment = useRejectFirstPayment();

  const canApproveInstallments = isSchoolOwner;
  const canActivateFirst = isOwner;
  const viewMode: "installments" | "first" = isOwner ? "first" : "installments";

  const pendingTransactions = useMemo(() => {
    if (isOwner) {
      return adminPendingInstallments;
    }

    const base =
      pendingPayments.length > 0
        ? pendingPayments
        : transactions.filter((t) => t.status === "Pending");

    return base.filter((t) => (t.type || "").toUpperCase() !== "FIRST_PAYMENT");
  }, [isOwner, adminPendingInstallments, pendingPayments, transactions]);

  const pendingFirstEnrollments = useMemo(() => {
    if (isOwner) {
      return adminPendingFirst;
    }
    return allStudents.filter((s) => s.status === "Pending");
  }, [isOwner, adminPendingFirst, allStudents]);

  const handleApproveClick = (id: string) => {
    if (!canApproveInstallments) return;
    setConfirmAction({ id, type: "approve", scope: "installment" });
  };

  const handleDeclineClick = (id: string) => {
    if (!canApproveInstallments) return;
    setConfirmAction({ id, type: "decline", scope: "installment" });
  };

  const handleApproveFirstClick = (id: string) => {
    if (!canActivateFirst) return;
    setConfirmAction({ id, type: "approve", scope: "first" });
  };

  const handleDeclineFirstClick = (id: string) => {
    if (!canActivateFirst) return;
    setConfirmAction({ id, type: "decline", scope: "first" });
  };

  const handleCancelConfirm = () => {
    if (processingId) return;
    setConfirmAction(null);
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    const { id, type, scope } = confirmAction;
    setProcessingId(id);
    try {
      if (scope === "installment") {
        if (type === "approve") {
          await confirmPayment(id);
        } else {
          await declinePayment(id);
        }
      } else {
        if (!canActivateFirst) return;
        if (isOwner) {
          if (type === "approve") {
            await settleFirstPayment.mutateAsync(id);
          } else {
            await rejectFirstPayment.mutateAsync(id);
          }
        } else {
          if (type === "approve") {
            await confirmFirstPayment(id);
          }
        }
      }
    } finally {
      setProcessingId(null);
      setConfirmAction(null);
    }
  };

  if (!isOwner && !isSchoolOwner) {
    return (
      <Layout>
        <Header title="Access Denied" />
        <div className="flex flex-col items-center justify-center p-10 text-center flex-1">
          <div className="size-20 bg-danger/10 text-danger rounded-full flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-4xl">lock</span>
          </div>
          <h2 className="text-xl font-bold mb-2">Restricted Action</h2>
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
      <Header title="Payment Approvals" />
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="flex gap-2 mb-4">
          {isSchoolOwner && (
            <div className="flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest border bg-primary text-white border-primary text-center">
              Installments
            </div>
          )}
          {isOwner && (
            <div className="flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest border bg-secondary text-white border-secondary text-center">
              First Payments
            </div>
          )}
        </div>

        {viewMode === "installments" ? (
          pendingTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center opacity-50 pt-20">
              <p>No pending installment payments to review.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {pendingTransactions.map((t) => (
                <div
                  key={t.id}
                  className="bg-white dark:bg-card-dark rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col gap-4"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-text-primary-light dark:text-text-primary-dark">
                        {t.childName}
                      </h3>
                      <p className="text-xs text-text-secondary-light uppercase font-bold tracking-tight">
                        {t.schoolName}
                      </p>
                    </div>
                    <p className="font-bold text-lg text-primary">
                      ₦{t.amount.toLocaleString()}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <p className="text-[10px] font-bold text-text-secondary-light uppercase">
                      Submitted Receipt
                    </p>
                    <button
                      onClick={() => setSelectedReceipt(t.receiptUrl || null)}
                      className="w-full aspect-video bg-gray-100 dark:bg-white/5 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 relative group"
                    >
                      <img
                        src={t.receiptUrl}
                        alt="Receipt"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <span className="material-symbols-outlined mr-2">
                          zoom_in
                        </span>
                        <span className="text-xs font-bold uppercase">
                          View Receipt
                        </span>
                      </div>
                    </button>
                  </div>

                  {canApproveInstallments ? (
                    <div className="flex gap-3 mt-2">
                      <button
                        onClick={() => handleDeclineClick(t.id)}
                        disabled={processingId === t.id}
                        className={`flex-1 py-3 rounded-xl border border-danger/30 text-danger bg-danger/5 font-bold text-xs ${
                          processingId === t.id
                            ? "opacity-50 cursor-not-allowed"
                            : ""
                        }`}
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => handleApproveClick(t.id)}
                        disabled={processingId === t.id}
                        className={`flex-[2] py-3 rounded-xl bg-primary text-white font-bold text-xs ${
                          processingId === t.id
                            ? "opacity-50 cursor-not-allowed"
                            : ""
                        }`}
                      >
                        Approve Payment
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )
        ) : pendingFirstEnrollments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-50 pt-20">
            <p>No first payments awaiting activation.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {pendingFirstEnrollments.map((item: any) => {
              if (isOwner) {
                const t = item;
                return (
                  <div
                    key={t.id}
                    className="bg-white dark:bg-card-dark rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col gap-4"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-text-primary-light dark:text-text-primary-dark">
                          {t.childName}
                        </h3>
                        <p className="text-xs text-text-secondary-light uppercase font-bold tracking-tight">
                          {t.className} • {t.schoolName}
                        </p>
                      </div>
                      <p className="font-bold text-lg text-primary">
                        ₦{t.amount.toLocaleString()}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2">
                      <p className="text-[10px] font-bold text-text-secondary-light uppercase">
                        Submitted Receipt
                      </p>
                      {t.receiptUrl ? (
                        <button
                          onClick={() =>
                            setSelectedReceipt(t.receiptUrl || null)
                          }
                          className="w-full aspect-video bg-gray-100 dark:bg-white/5 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 relative group"
                        >
                          <img
                            src={t.receiptUrl}
                            alt="Receipt"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <span className="material-symbols-outlined mr-2">
                              zoom_in
                            </span>
                            <span className="text-xs font-bold uppercase">
                              View Receipt
                            </span>
                          </div>
                        </button>
                      ) : null}
                    </div>

                    <div className="flex gap-3 mt-2">
                      <button
                        onClick={() => handleDeclineFirstClick(t.id)}
                        disabled={processingId === t.id}
                        className={`flex-1 py-3 rounded-xl border border-danger/30 text-danger bg-danger/5 font-bold text-xs ${
                          processingId === t.id
                            ? "opacity-50 cursor-not-allowed"
                            : ""
                        }`}
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => handleApproveFirstClick(t.id)}
                        disabled={processingId === t.id}
                        className={`flex-[2] py-3 rounded-xl bg-secondary text-white font-bold text-xs ${
                          processingId === t.id
                            ? "opacity-50 cursor-not-allowed"
                            : ""
                        }`}
                      >
                        Approve & Activate
                      </button>
                    </div>
                  </div>
                );
              }

              const s = item;
              const totalFee = Number.isFinite(s.totalFee) ? s.totalFee : 0;
              const paidAmount = Number.isFinite(s.paidAmount)
                ? s.paidAmount
                : 0;
              const remaining = totalFee - paidAmount;

              return (
                <div
                  key={s.id}
                  className="bg-white dark:bg-card-dark rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col gap-4"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-text-primary-light dark:text-text-primary-dark">
                        {s.name}
                      </h3>
                      <p className="text-xs text-text-secondary-light uppercase font-bold tracking-tight">
                        {s.grade}
                      </p>
                    </div>
                    <p className="font-bold text-lg text-primary">
                      ₦{paidAmount.toLocaleString()}
                    </p>
                  </div>

                  <div className="flex justify-between items-center mt-2">
                    <div className="text-[10px] text-text-secondary-light font-bold uppercase tracking-widest">
                      Remaining Balance: ₦{remaining.toLocaleString()}
                    </div>
                    <button
                      onClick={() => handleApproveFirstClick(s.id)}
                      disabled={processingId === s.id}
                      className={`px-4 py-2 rounded-xl bg-secondary text-white text-xs font-bold ${
                        processingId === s.id
                          ? "opacity-50 cursor-not-allowed"
                          : ""
                      }`}
                    >
                      {processingId === s.id
                        ? "Activating..."
                        : "Activate Enrollment"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedReceipt && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col p-6 items-center justify-center"
          onClick={() => setSelectedReceipt(null)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-card-dark rounded-3xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedReceipt}
              alt="Receipt Full"
              className="w-full h-auto max-h-[70vh] object-contain"
            />
            <div className="p-6">
              <button
                onClick={() => setSelectedReceipt(null)}
                className="w-full py-4 bg-primary text-white rounded-xl font-bold"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmAction && (
        <div
          className="fixed inset-0 z-[95] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={handleCancelConfirm}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-card-dark rounded-3xl p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold">
              {confirmAction.type === "approve"
                ? "Approve this payment?"
                : "Decline this payment?"}
            </h2>
            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
              {confirmAction.type === "approve"
                ? "This will mark the payment as approved and update the student's status across dashboards."
                : "This will mark the payment as rejected. The payer may need to re-upload a valid receipt or try again."}
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleCancelConfirm}
                disabled={!!processingId}
                className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-text-primary-light dark:text-text-primary-dark bg-gray-50 dark:bg-white/5 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={!!processingId}
                className={`flex-1 py-3 rounded-xl font-bold text-xs ${
                  confirmAction.type === "approve"
                    ? "bg-primary text-white"
                    : "bg-danger text-white"
                } ${processingId ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                {confirmAction.type === "approve"
                  ? "Yes, approve"
                  : "Yes, decline"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default PaymentApprovalsScreen;

import React, { useState } from "react";
import { useAmendEnrollmentInvite } from "../../hooks/useEnrollmentInvites";
import { formatNaira } from "../../utils/currency";
import { getErrorMessage } from "../../utils/errors";
import type { SchoolInvite } from "../../services/enrollmentInvites";

/**
 * Correcting the already-paid figure on an invite that has already been claimed.
 *
 * ## Why this exists at all
 *
 * The amount on an invite is typed by hand from a paper record about money that
 * moved before Lopay was involved, so getting it wrong is not an edge case — it
 * is the expected failure. Before a claim the fix is to cancel and re-issue.
 * After one there is a live plan a family is paying against, so the fix has to
 * be a restatement: the server re-derives the balance from the corrected figure
 * and tells the parent what changed.
 *
 * Without this screen a wrong figure would be permanent, because
 * `LedgerService.reversePayment` deliberately handles instalments only.
 *
 * ## What it refuses to do
 *
 * It does not pretend the correction is free. The new outstanding balance is
 * shown before the school commits, and a correction the server rejects (because
 * instalments since paid would leave the plan overpaid) surfaces its reason
 * verbatim rather than being reduced to "something went wrong".
 */
export const AmendInviteForm: React.FC<{
  invite: SchoolInvite;
  onClose: () => void;
}> = ({ invite, onClose }) => {
  const amend = useAmendEnrollmentInvite();
  const [amount, setAmount] = useState(String(invite.amountAlreadyPaid));
  const [reason, setReason] = useState("");

  const value = Number(amount);
  const valid = Number.isFinite(value) && value >= 0 && value <= invite.totalFee;
  const unchanged = value === invite.amountAlreadyPaid;

  // The parent may have paid instalments since claiming, in which case the
  // server knows better than this preview does — it is a guide, not the ruling.
  const projectedBalance = valid ? invite.totalFee - value : null;

  const submit = async () => {
    if (!valid || unchanged) return;
    try {
      await amend.mutateAsync({
        id: invite.id,
        dto: { amountAlreadyPaid: value, reason: reason.trim() || undefined },
      });
      onClose();
    } catch {
      // The hook toasts, and the inline message below shows the server's reason.
    }
  };

  return (
    <div className="mt-4 space-y-3 rounded-2xl bg-background-light dark:bg-background-dark p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary-light">
        Correct the amount already paid
      </p>

      <div className="flex flex-col gap-2">
        <label
          htmlFor={`amend-amount-${invite.id}`}
          className="text-xs text-text-secondary-light"
        >
          Currently recorded: {formatNaira(invite.amountAlreadyPaid)} of{" "}
          {formatNaira(invite.totalFee)}
        </label>
        <input
          id={`amend-amount-${invite.id}`}
          type="number"
          inputMode="decimal"
          min={0}
          max={invite.totalFee}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark p-3 text-sm outline-none focus:ring-2 focus:ring-primary"
        />
        {!valid && amount !== "" && (
          <p className="text-[11px] text-danger font-bold uppercase">
            Enter an amount between ₦0 and {formatNaira(invite.totalFee)}
          </p>
        )}
      </div>

      {projectedBalance !== null && !unchanged && (
        <p className="text-xs text-text-secondary-light">
          They would owe about{" "}
          <strong className="text-primary">
            {formatNaira(projectedBalance)}
          </strong>
          , less anything they have paid since.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <label
          htmlFor={`amend-reason-${invite.id}`}
          className="text-xs text-text-secondary-light"
        >
          Why? (shown to the parent)
        </label>
        <input
          id={`amend-reason-${invite.id}`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          placeholder="e.g. found a second transfer on the bank statement"
          className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark p-3 text-sm outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {amend.isError && (
        <p className="rounded-xl bg-danger/10 border border-danger/20 p-3 text-xs text-danger">
          {getErrorMessage(amend.error)}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 h-11 rounded-xl border border-gray-200 dark:border-gray-700 font-bold text-sm"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!valid || unchanged || amend.isPending}
          onClick={() => void submit()}
          className="flex-1 h-11 rounded-xl bg-primary text-white font-bold text-sm disabled:opacity-50"
        >
          {amend.isPending ? "Saving…" : "Save correction"}
        </button>
      </div>
    </div>
  );
};

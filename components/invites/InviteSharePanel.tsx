import React, { useState } from "react";
import { formatNaira } from "../../utils/currency";
import { formatDate } from "../../utils/date";
import type { CreatedInvite } from "../../services/enrollmentInvites";

/**
 * The one and only chance to send an invite link.
 *
 * The raw claim token is returned exactly once — the server stores only its
 * SHA-256 digest, so no endpoint can ever produce it again. That constraint
 * drives the whole design of this panel: the link is shown immediately and
 * prominently, the primary action is to send it, and the copy says plainly that
 * a lost link means cancelling and re-issuing rather than implying it can be
 * looked up later.
 *
 * Delivery is the school's own, through whatever channel they already use with
 * that parent. There is no automated send and no deep link into a particular
 * app: it needs no provider, no domain verification and no deliverability
 * problem, and a school that messages parents on WhatsApp, SMS or email can use
 * the same link either way.
 *
 * The number the invite was addressed to is shown beside the copy button, not
 * because anything routes to it, but because it is the ONE field the school
 * must get right — and the consequence of getting it wrong is worse than it
 * used to be, not better. The claim is no longer gated on the number: holding
 * the link is the whole authorisation. So a mistyped digit no longer locks the
 * real parent out; it sends a child's fee details to a stranger who can then
 * open a plan in their own name. The comparison still happens and the school is
 * still told the result, but that is a warning after the fact — `release` is
 * the undo. Putting the number in front of them at the moment they copy the
 * link is the last chance to prevent it rather than correct it.
 */
export const InviteSharePanel: React.FC<{
  invite: CreatedInvite;
  onDone: () => void;
  onAnother: () => void;
}> = ({ invite, onDone, onAnother }) => {
  const [copied, setCopied] = useState<"message" | "link" | null>(null);

  /**
   * Copy something to the clipboard, remembering which button did it.
   *
   * Clipboard access is denied in some in-app browsers and over plain http. The
   * link is visible and selectable below, so this degrades rather than failing
   * — an error toast here would be noise for a recoverable case.
   */
  const copy = (what: "message" | "link", text: string) => async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 2_000);
    } catch {
      setCopied(null);
    }
  };

  return (
    <>
      <section className="rounded-[28px] bg-success/10 border border-success/20 p-5">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-success filled">
            check_circle
          </span>
          <h2 className="text-sm font-black text-success uppercase tracking-[0.15em]">
            Invite created
          </h2>
        </div>
        <p className="mt-2 text-sm text-text-primary-light dark:text-text-primary-dark">
          Send this link to {invite.invite.studentName}&apos;s parent. Nothing
          changes on their account until they open it and confirm.
        </p>
      </section>

      <div className="bg-white dark:bg-surface-dark rounded-[28px] p-5 shadow-sm border border-gray-100 dark:border-gray-800 space-y-3 text-sm">
        <SummaryRow label="Student" value={invite.invite.studentName} />
        <SummaryRow label="Class" value={invite.invite.className} />
        <SummaryRow
          label="Already paid"
          value={formatNaira(invite.invite.amountAlreadyPaid)}
        />
        <SummaryRow
          label="Remaining"
          value={formatNaira(invite.invite.remainingBalance)}
          emphasis
        />
        <SummaryRow label="Sent to" value={invite.invite.parentPhone} />
        <SummaryRow
          label="Link expires"
          value={formatDate(invite.expiresAt)}
        />
      </div>

      <div className="rounded-[28px] bg-warning/10 border border-warning/20 p-4 text-sm text-text-primary-light dark:text-text-primary-dark">
        This link is shown once. If you lose it, cancel the invite from your
        list and create a new one.
      </div>

      {/*
        The MESSAGE is the primary action, not the bare link.

        The server composes one (`EnrollmentInvitesService.buildShare`) that
        names the child, says what the link is for and says nothing has changed
        yet — and this panel used to return it and throw it away, copying only
        the URL. A naked link dropped into WhatsApp by a school is precisely the
        shape parents are taught not to tap, and this one asks them to confirm
        money. Copying the sentence costs the school nothing and is the
        difference between a claim and a suspected scam.

        The link stays available on its own, because a school that has already
        written its own greeting only wants the URL.
      */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={copy("message", invite.message)}
          className="h-14 rounded-xl bg-primary text-white font-bold flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined filled">
            {copied === "message" ? "check" : "content_copy"}
          </span>
          {copied === "message" ? "Message copied" : "Copy message"}
        </button>

        <p className="text-xs text-text-secondary-light text-center">
          Paste it into your chat with {invite.invite.parentPhone}.
        </p>

        <p
          className="rounded-2xl bg-gray-50 dark:bg-gray-800/50 p-3 text-[11px] leading-relaxed text-text-secondary-light select-all"
          data-testid="invite-share-message"
        >
          {invite.message}
        </p>

        <button
          type="button"
          onClick={copy("link", invite.claimUrl)}
          className="h-12 rounded-xl border border-gray-200 dark:border-gray-700 font-bold flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined">
            {copied === "link" ? "check" : "link"}
          </span>
          {copied === "link" ? "Link copied" : "Copy link only"}
        </button>

        <p
          className="text-[11px] break-all text-text-secondary-light select-all"
          data-testid="invite-claim-url"
        >
          {invite.claimUrl}
        </p>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onAnother}
          className="flex-1 h-12 rounded-xl border border-gray-200 dark:border-gray-700 font-bold"
        >
          Invite another
        </button>
        <button
          type="button"
          onClick={onDone}
          className="flex-1 h-12 rounded-xl bg-text-primary-light dark:bg-surface-dark text-white font-bold"
        >
          Done
        </button>
      </div>
    </>
  );
};

const SummaryRow: React.FC<{
  label: string;
  value: string;
  emphasis?: boolean;
}> = ({ label, value, emphasis }) => (
  <div className="flex items-center justify-between gap-4">
    <span className="text-text-secondary-light">{label}</span>
    <strong className={emphasis ? "text-primary" : undefined}>{value}</strong>
  </div>
);

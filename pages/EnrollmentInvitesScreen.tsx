import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { Header } from "../components/Header";
import { Pagination } from "../components/Pagination";
import {
  useEnrollmentInvites,
  useReleaseEnrollmentInvite,
  useRevokeEnrollmentInvite,
} from "../hooks/useEnrollmentInvites";
import { formatNaira } from "../utils/currency";
import { formatDate } from "../utils/date";
import { AmendInviteForm } from "../components/invites/AmendInviteForm";
import type {
  EnrollmentInviteStatus,
  SchoolInvite,
} from "../services/enrollmentInvites";

/**
 * The school owner's record of every invite they have issued.
 *
 * This screen exists because an invite is manual data entry about past cash, so
 * schools WILL get one wrong — a digit in the phone number, the wrong amount,
 * the wrong class. Without a list there is no way to see what was sent, and
 * without a cancel there is no way to correct it: the invite would simply sit
 * live for up to thirty days, claimable by whoever received it.
 *
 * It is also where a parent's dispute surfaces. The API stores the reason; if
 * nothing rendered it, the complaint would go into a column nobody reads.
 */

const FILTERS: { label: string; value: EnrollmentInviteStatus | "ALL" }[] = [
  { label: "Awaiting", value: "PENDING" },
  { label: "Disputed", value: "DISPUTED" },
  { label: "Claimed", value: "CLAIMED" },
  { label: "All", value: "ALL" },
];

const STATUS_STYLES: Record<EnrollmentInviteStatus, string> = {
  PENDING: "bg-warning/10 text-warning",
  DISPUTED: "bg-danger/10 text-danger",
  CLAIMED: "bg-success/10 text-success",
  REVOKED: "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  EXPIRED: "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
};

const STATUS_LABELS: Record<EnrollmentInviteStatus, string> = {
  PENDING: "Awaiting parent",
  DISPUTED: "Parent disputed",
  CLAIMED: "Claimed",
  REVOKED: "Cancelled",
  EXPIRED: "Expired",
};

const EnrollmentInvitesScreen: React.FC = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<EnrollmentInviteStatus | "ALL">(
    "PENDING",
  );
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useEnrollmentInvites({
    status: filter === "ALL" ? undefined : filter,
    page,
  });
  // Named `window` locally would shadow the global; this is the school's
  // migration window, and it arrives with the list rather than on its own call.
  const migrationWindow = data?.migrationWindow;
  const revoke = useRevokeEnrollmentInvite();
  const release = useReleaseEnrollmentInvite();

  const changeFilter = (next: EnrollmentInviteStatus | "ALL") => {
    setFilter(next);
    setPage(1);
  };

  return (
    <Layout>
      <Header title="Migration invites" />
      <main className="flex flex-col gap-5 p-6 pb-32">
        {/*
          The window, stated before the button rather than after a refusal.

          Migration is free and bounded per school — it is a one-time onboarding
          step, redeemed when those families enrol normally next term. A school
          that only learns this by filling in a form and being told "no" has
          been failed by the screen, so the state is shown up front and the
          button reflects it.
        */}
        {migrationWindow && !migrationWindow.isOpen && (
          <section className="rounded-[28px] bg-gray-100 dark:bg-gray-800 p-5 text-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary-light">
              Migration window closed
            </p>
            <p className="mt-2 text-text-primary-light dark:text-text-primary-dark">
              Migrating families you were already collecting from is a one-time,
              free step, and it closed on {formatDate(migrationWindow.closesAt)}. Enrol
              new students normally from here — contact Lopay if you still have
              families to migrate.
            </p>
          </section>
        )}

        {migrationWindow?.isOpen && migrationWindow.daysRemaining <= 14 && (
          <section className="rounded-[28px] bg-warning/10 border border-warning/20 p-4 text-sm text-text-primary-light dark:text-text-primary-dark">
            {/*
              One string, not a count spliced between JSX expressions. Split
              across text nodes it reads as "1", "day", "left" to a screen
              reader and cannot be matched as a phrase by anything else either.
            */}
            <strong>{`${migrationWindow.daysRemaining} day${
              migrationWindow.daysRemaining === 1 ? "" : "s"
            } left`}</strong>{" "}
            to migrate families who were already paying you. After{" "}
            {formatDate(migrationWindow.closesAt)} they will need to enrol normally.
          </section>
        )}

        <button
          type="button"
          onClick={() => navigate("/school/invites/new")}
          disabled={migrationWindow ? !migrationWindow.isOpen : false}
          className="h-14 rounded-xl bg-primary text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <span className="material-symbols-outlined filled">person_add</span>
          Invite an existing payer
        </button>

        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={filter === option.value}
              onClick={() => changeFilter(option.value)}
              className={`shrink-0 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-colors ${
                filter === option.value
                  ? "bg-primary text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-text-secondary-light"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {isLoading && (
          <p className="text-sm text-text-secondary-light">Loading invites…</p>
        )}

        {isError && (
          <div className="rounded-[28px] bg-danger/10 border border-danger/20 p-5 text-sm">
            <p className="text-text-primary-light dark:text-text-primary-dark">
              Could not load your invites.
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-3 font-bold text-danger"
            >
              Try again
            </button>
          </div>
        )}

        {!isLoading && !isError && data?.items.length === 0 && (
          <div className="rounded-[28px] border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center">
            <p className="text-sm text-text-secondary-light">
              {filter === "PENDING"
                ? "No invites are waiting on a parent."
                : "Nothing here yet."}
            </p>
          </div>
        )}

        {data?.items.map((invite) => (
          <InviteCard
            key={invite.id}
            invite={invite}
            onRevoke={(reason) =>
              revoke.mutate({ id: invite.id, reason: reason || undefined })
            }
            revoking={revoke.isPending && revoke.variables?.id === invite.id}
            onRelease={(reason) =>
              release.mutate({ id: invite.id, reason: reason || undefined })
            }
            releasing={release.isPending && release.variables?.id === invite.id}
          />
        ))}

        {data && data.totalPages > 1 && (
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            onPageChange={setPage}
          />
        )}
      </main>
    </Layout>
  );
};

const InviteCard: React.FC<{
  invite: SchoolInvite;
  onRevoke: (reason: string) => void;
  revoking: boolean;
  onRelease: (reason: string) => void;
  releasing: boolean;
}> = ({ invite, onRevoke, revoking, onRelease, releasing }) => {
  const [confirming, setConfirming] = useState(false);
  const [amending, setAmending] = useState(false);
  const [releaseConfirming, setReleaseConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [releaseReason, setReleaseReason] = useState("");

  const canRevoke =
    invite.status === "PENDING" || invite.status === "DISPUTED";
  // Once claimed there is a live plan behind the invite, so the remedy for a
  // wrong figure is a restatement rather than a cancellation. Without this the
  // amount would be permanent — the ledger's reversal path covers instalments
  // only, by design.
  const canAmend = invite.status === "CLAIMED";
  // Claiming needs only the link, so a link that reached the wrong person is a
  // foreseeable outcome — and without this it was a permanent one.
  const canRelease = invite.status === "CLAIMED";
  // A signal, not a verdict. `null` means not claimed; `false` means the person
  // who claimed signed up with a different number than the school addressed.
  const phoneMismatch = invite.claimantPhoneMatched === false;

  return (
    <article className="bg-white dark:bg-surface-dark rounded-[28px] p-5 shadow-sm border border-gray-100 dark:border-gray-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-black text-text-primary-light dark:text-text-primary-dark">
            {invite.studentName}
          </h3>
          <p className="text-xs text-text-secondary-light">
            {invite.className} · {invite.parentPhone}
          </p>
        </div>
        <span
          className={`shrink-0 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${STATUS_STYLES[invite.status]}`}
        >
          {STATUS_LABELS[invite.status]}
        </span>
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <Row label="Already paid" value={formatNaira(invite.amountAlreadyPaid)} />
        {/*
          For a claimed invite this is the balance the plan OPENED with, not what
          the family owes today — instalments paid since are on the plan, not on
          the invite. Labelled so, because "Remaining" next to a claimed student
          reads as a live figure and would be wrong the moment they pay.
        */}
        <Row
          label={invite.status === "CLAIMED" ? "Remaining at handover" : "Remaining"}
          value={formatNaira(invite.remainingBalance)}
        />
        <Row
          label={invite.status === "CLAIMED" ? "Claimed" : "Link expires"}
          value={formatDate(
            invite.status === "CLAIMED"
              ? (invite.claimedAt ?? invite.createdAt)
              : invite.expiresAt,
          )}
        />
      </dl>

      {/*
        The school's one chance to notice a link reached the wrong family.
        Claiming is authorised by holding the link alone, so this — plus the
        notification at claim time — is the whole detection story, and "Remove
        this plan" sits directly under it because noticing without being able to
        act is worse than not noticing.
      */}
      {invite.status === "CLAIMED" && (
        <div
          className={`mt-4 rounded-2xl p-4 ${
            phoneMismatch
              ? "bg-warning/10 border border-warning/30"
              : "bg-gray-50 dark:bg-gray-800/40"
          }`}
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary-light">
            Claimed by
          </p>
          <p className="mt-1 text-sm font-bold text-text-primary-light dark:text-text-primary-dark">
            {invite.claimedByName ?? "An account"}
          </p>
          {phoneMismatch && (
            <p className="mt-2 text-sm text-warning font-medium">
              They signed up with a different phone number than the{" "}
              {invite.parentPhone} you addressed this invite to. If this is not{" "}
              {invite.studentName}&apos;s parent, remove the plan below.
            </p>
          )}
        </div>
      )}

      {invite.disputeReason && (
        <div className="mt-4 rounded-2xl bg-danger/10 border border-danger/20 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-danger">
            What the parent said
          </p>
          <p className="mt-1 text-sm text-text-primary-light dark:text-text-primary-dark">
            {invite.disputeReason}
          </p>
          <p className="mt-2 text-[11px] text-text-secondary-light">
            Cancel this invite and issue a corrected one.
          </p>
        </div>
      )}

      {canRevoke && !confirming && (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-4 w-full h-11 rounded-xl border border-danger/30 text-danger font-bold text-sm"
        >
          Cancel invite
        </button>
      )}

      {canAmend && !amending && (
        <button
          type="button"
          onClick={() => setAmending(true)}
          className="mt-4 w-full h-11 rounded-xl border border-primary/30 text-primary font-bold text-sm"
        >
          Correct the amount
        </button>
      )}

      {canAmend && amending && (
        <AmendInviteForm invite={invite} onClose={() => setAmending(false)} />
      )}

      {canRelease && !releaseConfirming && (
        <button
          type="button"
          onClick={() => setReleaseConfirming(true)}
          className="mt-3 w-full h-11 rounded-xl border border-danger/30 text-danger font-bold text-sm"
        >
          Wrong parent — remove this plan
        </button>
      )}

      {canRelease && releaseConfirming && (
        <div className="mt-4 space-y-3 rounded-2xl bg-danger/5 border border-danger/20 p-4">
          {/*
            Spelled out rather than summarised. This deletes a live plan and the
            record of the prior payment on it, and it cannot be undone from the
            app — the school owner should know that before the tap, not after.
          */}
          <p className="text-sm text-text-primary-light dark:text-text-primary-dark">
            This removes {invite.studentName}&apos;s plan and the{" "}
            {formatNaira(invite.amountAlreadyPaid)} recorded against it, and
            tells whoever claimed it. You can then send a fresh invite to the
            right parent. This cannot be undone.
          </p>
          <label
            htmlFor={`release-reason-${invite.id}`}
            className="text-xs font-medium text-text-secondary-light"
          >
            Why are you removing it? (optional, shared with them)
          </label>
          <input
            id={`release-reason-${invite.id}`}
            type="text"
            value={releaseReason}
            onChange={(e) => setReleaseReason(e.target.value)}
            maxLength={500}
            placeholder="e.g. sent to the wrong number"
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-background-light dark:bg-background-dark px-4 h-11 text-sm outline-none focus:ring-2 focus:ring-danger"
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setReleaseConfirming(false)}
              className="flex-1 h-11 rounded-xl border border-gray-200 dark:border-gray-700 font-bold text-sm"
            >
              Keep it
            </button>
            <button
              type="button"
              onClick={() => onRelease(releaseReason.trim())}
              disabled={releasing}
              className="flex-1 h-11 rounded-xl bg-danger text-white font-bold text-sm disabled:opacity-50"
            >
              {releasing ? "Removing…" : "Remove plan"}
            </button>
          </div>
        </div>
      )}

      {canRevoke && confirming && (
        <div className="mt-4 space-y-3">
          <label
            htmlFor={`reason-${invite.id}`}
            className="text-xs font-medium text-text-secondary-light"
          >
            Why are you cancelling? (optional, kept on the record)
          </label>
          <input
            id={`reason-${invite.id}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            placeholder="e.g. wrong phone number"
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-background-light dark:bg-background-dark p-3 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="flex-1 h-11 rounded-xl border border-gray-200 dark:border-gray-700 font-bold text-sm"
            >
              Keep it
            </button>
            <button
              type="button"
              disabled={revoking}
              onClick={() => onRevoke(reason.trim())}
              className="flex-1 h-11 rounded-xl bg-danger text-white font-bold text-sm disabled:opacity-50"
            >
              {revoking ? "Cancelling…" : "Cancel invite"}
            </button>
          </div>
        </div>
      )}
    </article>
  );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between">
    <dt className="text-text-secondary-light">{label}</dt>
    <dd className="font-bold">{value}</dd>
  </div>
);

export default EnrollmentInvitesScreen;

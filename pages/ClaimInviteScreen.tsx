import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "../components/Layout";
import { Header } from "../components/Header";
import { useAuth } from "../context/AuthContext";
import {
  useClaimEnrollmentInvite,
  useDisputeEnrollmentInvite,
  useInvitePreview,
} from "../hooks/useEnrollmentInvites";
import { formatNaira } from "../utils/currency";
import { formatDate } from "../utils/date";
import { getErrorMessage } from "../utils/errors";
import { clearPendingInvite, rememberPendingInvite } from "../utils/pendingInvite";
import { CLAIM_TOKEN_PARAM } from "../utils/claimUrl";
import { homePathForRole } from "../utils/homePath";
import { installmentCount } from "../utils/plan";
import type { ClaimResult, InvitePreview } from "../services/enrollmentInvites";

/**
 * Where a parent reviews what their school says they have already paid, and
 * either confirms it or contests it.
 *
 * ## The one rule this screen exists to honour
 *
 * Nothing on it claims anything happened until the server says so. Every figure
 * is read from `GET /enrollment-invites/preview`; the success panel renders the
 * server's own claim response; a failure shows the server's message. There is no
 * local "confirmed" state, because the thing being confirmed is money on a real
 * fee plan, and telling a parent their plan is active when it is not is worse
 * than telling them nothing.
 *
 * ## Why it is a public route
 *
 * The parent usually has no account yet — the link arrives over WhatsApp. They
 * must be able to read what is being asserted *before* signing up, or they are
 * being asked to create an account for an unknown proposition. Confirming
 * requires only an account: holding the link is the whole authorisation, and
 * the phone number is compared and reported to the school rather than enforced
 * — see `EnrollmentInvitesService.claimantPhoneMatches` for why a gate there
 * refused more real parents than impostors.
 */
const ClaimInviteScreen: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, role: userRole } = useAuth();


  // `useSearchParams`, and that is privacy-preserving here rather than in spite
  // of itself: this app is hash-routed, so the link is
  // `https://app/#/claim-invite?token=…` and the router has already parsed that
  // out of the FRAGMENT. Nothing after the `#` is ever transmitted, so the
  // token reaches no access log and no `Referer`. See `utils/claimUrl.ts`.
  const token = searchParams.get(CLAIM_TOKEN_PARAM);
  const { data: invite, isLoading, isError, error } = useInvitePreview(token);

  const claim = useClaimEnrollmentInvite();
  const dispute = useDisputeEnrollmentInvite();

  const [claimed, setClaimed] = useState<ClaimResult | null>(null);
  const [disputing, setDisputing] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeSent, setDisputeSent] = useState(false);

  // Hold the token across a sign-up round trip: AuthScreen redirects to a
  // role-based home rather than back here, so without this the parent would
  // have to return to WhatsApp and tap the link again.
  //
  // It is held until the claim is FINISHED, not until they are merely signed
  // in. Clearing on `isAuthenticated` looked equivalent and was not: a parent
  // who signed in with Google has no phone number on their account, so the
  // very next thing they do is detour to `/profile` to add one — and the stash
  // had already been dropped on the way in, so the trip back depended entirely
  // on the browser's history. `clearPendingInvite` is called on success, on a
  // dispute, and below once the invite turns out to be unclaimable, which are
  // the three points at which it has genuinely done its job.
  useEffect(() => {
    if (token) rememberPendingInvite(token);
  }, [token]);

  // A dead invite must not sit in the stash hijacking a later, unrelated
  // sign-in on this tab. Claimed, revoked, expired or disputed — there is
  // nothing left to come back for.
  useEffect(() => {
    if (invite && !invite.canClaim) clearPendingInvite();
  }, [invite]);

  const handleClaim = async () => {
    if (!token) return;
    try {
      const result = await claim.mutateAsync(token);
      clearPendingInvite();
      setClaimed(result);
    } catch {
      // The mutation's onError already surfaced the server's message; the error
      // panel below renders it inline as well. Swallowed so an expected refusal
      // (wrong phone, already claimed) is not an unhandled rejection.
    }
  };

  const handleDispute = async () => {
    if (!token || !disputeReason.trim()) return;
    try {
      await dispute.mutateAsync({ token, reason: disputeReason.trim() });
      clearPendingInvite();
      setDisputeSent(true);
    } catch {
      // As above.
    }
  };

  if (!token) return <Message title="Nothing to review" body={NO_TOKEN} />;
  if (isLoading) return <Message title="Loading invite" body="One moment…" />;
  if (isError || !invite) {
    return <Message title="This link doesn’t work" body={getErrorMessage(error)} />;
  }

  // `homePathForRole`, not "/dashboard": that route is parent-only, and a
  // school owner can be a parent at another school — the case the API goes out
  // of its way to allow. Hardcoding it sent them to a screen they are not
  // permitted on, and `ProtectedRoute` bounced them away from the plan they had
  // just activated.
  if (claimed)
    return (
      <ClaimSucceeded
        result={claimed}
        onDone={() => navigate(homePathForRole(userRole))}
      />
    );
  if (disputeSent) return <DisputeSent studentName={invite.studentName} />;

  return (
    <Layout>
      <Header title="Confirm your payments" />
      <main className="flex flex-col gap-6 p-6 pb-32">
        <IntroCard invite={invite} />
        <FiguresCard invite={invite} />

        <div className="rounded-[28px] bg-warning/10 border border-warning/20 p-4 text-sm text-text-primary-light dark:text-text-primary-dark">
          What you have already paid is recorded as a starting credit, not as a
          missed instalment — your plan begins from{" "}
          {formatDate(invite.planStartDate)}, so you will not be marked late for
          anything before then.
        </div>

        {!invite.canClaim && <UnavailableNotice status={invite.status} />}

        {invite.canClaim && !isAuthenticated && (
          <div className="flex flex-col gap-3">
            {/*
              Deliberately does NOT tell them which number to use. It used to,
              and that was a rule the server stopped enforcing: the claim is
              authorised by the link alone. Naming a number the parent may not
              have — a second phone, their spouse's, or none at all if they sign
              in with Google — reads as a requirement they cannot meet, and the
              cost of that is a family who abandons the claim rather than a
              family who is kept out.
            */}
            <p className="text-sm text-text-secondary-light">
              Sign in — or create your Lopay account — to confirm. It only takes
              a moment, and nothing is added to your account until you do.
            </p>
            <button
              type="button"
              onClick={() => navigate("/auth")}
              className="h-14 rounded-xl bg-primary text-white font-bold"
            >
              Sign in to continue
            </button>
          </div>
        )}

        {invite.canClaim && isAuthenticated && !disputing && (
          <div className="flex flex-col gap-3">
            {claim.isError && (
              <p className="rounded-2xl bg-danger/10 border border-danger/20 p-4 text-sm text-danger">
                {getErrorMessage(claim.error)}
              </p>
            )}
            <button
              type="button"
              onClick={() => void handleClaim()}
              disabled={claim.isPending}
              className="h-14 rounded-xl bg-primary text-white font-bold disabled:opacity-50"
            >
              {claim.isPending ? "Confirming…" : "Yes, this is correct"}
            </button>
            <button
              type="button"
              onClick={() => setDisputing(true)}
              className="h-14 rounded-xl border-2 border-danger/30 text-danger font-bold"
            >
              This amount is wrong
            </button>
          </div>
        )}

        {invite.canClaim && isAuthenticated && disputing && (
          <div className="flex flex-col gap-3">
            <label
              htmlFor="disputeReason"
              className="text-sm font-medium text-text-secondary-light"
            >
              Tell your school what is wrong
            </label>
            <textarea
              id="disputeReason"
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              maxLength={500}
              rows={4}
              placeholder="e.g. I paid ₦35,000 on 3 September, not ₦25,000."
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-background-light dark:bg-background-dark p-4 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            {dispute.isError && (
              <p className="text-sm text-danger">
                {getErrorMessage(dispute.error)}
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDisputing(false)}
                className="flex-1 h-12 rounded-xl border border-gray-200 dark:border-gray-700 font-bold"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => void handleDispute()}
                disabled={!disputeReason.trim() || dispute.isPending}
                className="flex-1 h-12 rounded-xl bg-danger text-white font-bold disabled:opacity-50"
              >
                {dispute.isPending ? "Sending…" : "Send to school"}
              </button>
            </div>
          </div>
        )}
      </main>
    </Layout>
  );
};

const NO_TOKEN =
  "This page needs the link your school sent you. Open that message again, or ask them to re-send it.";

const UNAVAILABLE_COPY: Record<string, string> = {
  CLAIMED: "This invite has already been used. Your plan is on your dashboard.",
  DISPUTED:
    "You have told your school this amount is wrong. They will send a corrected invite.",
  REVOKED: "Your school cancelled this invite. Ask them for a new link.",
  EXPIRED: "This link has expired. Ask your school to send a new one.",
  PENDING: "This link is no longer valid. Ask your school to send a new one.",
};

const IntroCard: React.FC<{ invite: InvitePreview }> = ({ invite }) => (
  <section className="rounded-[28px] bg-primary/5 border border-primary/20 p-5">
    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
      {invite.schoolName ?? "Your school"}
    </p>
    <h2 className="mt-2 text-xl font-black text-text-primary-light dark:text-text-primary-dark">
      {invite.studentName}
    </h2>
    <p className="mt-1 text-sm text-text-secondary-light">{invite.className}</p>
    <p className="mt-3 text-sm text-text-primary-light dark:text-text-primary-dark">
      Your school has recorded what you have already paid. Check it below before
      confirming.
    </p>
  </section>
);

const FiguresCard: React.FC<{ invite: InvitePreview }> = ({ invite }) => {
  // `installmentCount`, never an inline 12/3. utils/plan.ts exists precisely
  // because those numbers were once inlined in two places and decide the figure
  // a parent is shown — a copy that drifts quotes them an amount they will not
  // be charged.
  const slots = installmentCount(invite.installmentFrequency);
  const perInstalment = useMemo(
    () => invite.remainingBalance / slots,
    [slots, invite.remainingBalance],
  );
  const cadence = invite.installmentFrequency === "WEEKLY" ? "weekly" : "monthly";

  return (
    <div className="bg-white dark:bg-surface-dark rounded-[28px] p-5 shadow-sm border border-gray-100 dark:border-gray-800 space-y-3 text-sm">
      <Row label="Total school fee" value={formatNaira(invite.totalFee)} />
      <Row
        label="You have already paid"
        value={formatNaira(invite.amountAlreadyPaid)}
      />
      <div className="h-px bg-gray-100 dark:bg-gray-800" />
      <Row
        label="Left to pay"
        value={formatNaira(invite.remainingBalance)}
        emphasis
      />
      {/*
        How many payments, and when the last one lands.
        This screen is the parent's one chance to refuse before a plan exists,
        so it has to state the commitment and not only the instalment size. The
        end date is the server's derived `termEndDate` — the same value that
        decides when an unpaid plan is marked as defaulting — so showing it is
        telling them the real deadline rather than an estimate.
      */}
      <Row
        label={`${slots} ${cadence} payments of about`}
        value={formatNaira(Math.round(perInstalment))}
      />
      <Row label="First payment due from" value={formatDate(invite.planStartDate)} />
      <Row label="Last payment due by" value={formatDate(invite.termEndDate)} />
    </div>
  );
};

const UnavailableNotice: React.FC<{ status: string }> = ({ status }) => (
  <div className="rounded-[28px] bg-gray-100 dark:bg-gray-800 p-5 text-sm text-text-primary-light dark:text-text-primary-dark">
    {UNAVAILABLE_COPY[status] ?? UNAVAILABLE_COPY.PENDING}
  </div>
);

const ClaimSucceeded: React.FC<{ result: ClaimResult; onDone: () => void }> = ({
  result,
  onDone,
}) => (
  <Layout>
    <Header title="You’re all set" />
    <main className="flex flex-col gap-6 p-6 pb-32">
      <section className="rounded-[28px] bg-success/10 border border-success/20 p-5">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-success filled">
            check_circle
          </span>
          <h2 className="text-sm font-black text-success uppercase tracking-[0.15em]">
            Plan active
          </h2>
        </div>
        <p className="mt-2 text-sm text-text-primary-light dark:text-text-primary-dark">
          {result.studentName}&apos;s fees at {result.schoolName} are now on
          Lopay, with {formatNaira(result.amountAlreadyPaid)} already credited.
        </p>
      </section>

      <div className="bg-white dark:bg-surface-dark rounded-[28px] p-5 shadow-sm border border-gray-100 dark:border-gray-800 space-y-3 text-sm">
        <Row label="Total fee" value={formatNaira(result.totalFee)} />
        <Row label="Credited" value={formatNaira(result.amountAlreadyPaid)} />
        <Row
          label="Left to pay"
          value={formatNaira(result.remainingBalance)}
          emphasis
        />
      </div>

      <button
        type="button"
        onClick={onDone}
        className="h-14 rounded-xl bg-primary text-white font-bold"
      >
        Go to my dashboard
      </button>
    </main>
  </Layout>
);

const DisputeSent: React.FC<{ studentName: string }> = ({ studentName }) => (
  <Layout>
    <Header title="Sent to your school" />
    <main className="flex flex-col gap-6 p-6 pb-32">
      <section className="rounded-[28px] bg-primary/5 border border-primary/20 p-5">
        <p className="text-sm text-text-primary-light dark:text-text-primary-dark">
          Your school has been told the amount recorded for {studentName} is
          wrong. They will check their records and send you a corrected invite —
          nothing has been added to your account in the meantime.
        </p>
      </section>
    </main>
  </Layout>
);

const Message: React.FC<{ title: string; body: string }> = ({ title, body }) => (
  <Layout>
    <Header title={title} />
    <main className="flex flex-1 items-center justify-center p-6">
      <p className="text-center text-sm text-text-secondary-light">{body}</p>
    </main>
  </Layout>
);

const Row: React.FC<{ label: string; value: string; emphasis?: boolean }> = ({
  label,
  value,
  emphasis,
}) => (
  <div className="flex items-center justify-between gap-4">
    <span className="text-text-secondary-light">{label}</span>
    <strong className={emphasis ? "text-primary text-base" : undefined}>
      {value}
    </strong>
  </div>
);

export default ClaimInviteScreen;

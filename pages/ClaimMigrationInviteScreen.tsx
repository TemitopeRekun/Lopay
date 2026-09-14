import React, { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Layout } from "../components/Layout";
import { Header } from "../components/Header";
import type { MigrationInvite } from "./MigrationInviteScreen";

const formatDate = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const currency = (value: number) => `₦${value.toLocaleString()}`;

const ClaimMigrationInviteScreen: React.FC = () => {
  const location = useLocation();
  const invite = (location.state as { invite?: MigrationInvite } | undefined)?.invite;
  const [isConfirmed, setIsConfirmed] = useState(false);

  const summary = useMemo(() => {
    if (!invite) return null;
    return {
      ...invite,
      planStartsOn: invite.startDate || invite.migrationDate,
    };
  }, [invite]);

  if (!summary) {
    return (
      <Layout>
        <Header title="Migration invite" />
        <main className="flex flex-1 items-center justify-center p-6 text-center text-sm text-text-secondary-light">
          This invite is missing or has expired.
        </main>
      </Layout>
    );
  }

  return (
    <Layout>
      <Header title="Claim migration invite" />
      <main className="flex flex-col gap-6 p-6 pb-32">
        <section className="rounded-[28px] bg-secondary/5 border border-secondary/20 p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">Migration review</p>
          <h2 className="mt-2 text-xl font-black text-text-primary-light">
            {summary.studentName}
          </h2>
          <p className="mt-1 text-sm text-text-secondary-light">{summary.className}</p>
        </section>

        <div className="rounded-[28px] bg-white p-5 shadow-sm border border-gray-100">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-text-secondary-light">School fee</span>
              <strong>{currency(summary.totalFee)}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary-light">Amount already paid</span>
              <strong>{currency(summary.amountAlreadyPaid)}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary-light">Migrated balance</span>
              <strong>{currency(summary.migratedBalance)}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary-light">Remaining balance</span>
              <strong>{currency(summary.remainingBalance)}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary-light">Plan starts on</span>
              <strong>{formatDate(summary.planStartsOn)}</strong>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] bg-warning/10 border border-warning/20 p-4 text-sm text-text-primary-light">
          The prior payment is recorded as a migrated balance, not a regular installment. Future payments begin from the migration date, so you are not marked overdue incorrectly.
        </div>

        {!isConfirmed ? (
          <button
            type="button"
            onClick={() => setIsConfirmed(true)}
            className="h-14 rounded-xl bg-primary text-white font-bold"
          >
            Confirm migration
          </button>
        ) : (
          <div className="space-y-3">
            <div className="rounded-[20px] bg-success/10 border border-success/20 p-4 text-sm font-medium text-success">
              Migration confirmed. The plan is now active and will start on {formatDate(summary.planStartsOn)}.
            </div>
            <div className="rounded-[20px] bg-slate-900 p-4 text-sm text-white">
              Parent continues in the normal Lopay flow for future installments, while the previous amount remains a migrated balance.
            </div>
          </div>
        )}
      </main>
    </Layout>
  );
};

export default ClaimMigrationInviteScreen;

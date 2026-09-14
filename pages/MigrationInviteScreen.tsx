import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { Header } from "../components/Header";

export type MigrationInviteStatus =
  | "pending_confirmation"
  | "disputed"
  | "active"
  | "rejected";

export interface MigrationInvite {
  id: string;
  studentName: string;
  className: string;
  totalFee: number;
  amountAlreadyPaid: number;
  migratedBalance: number;
  remainingBalance: number;
  migrationDate: string;
  startDate: string;
  installmentFrequency: "MONTHLY" | "WEEKLY";
  status: MigrationInviteStatus;
  disputeReason?: string;
  inviteCode?: string;
}

const currency = (value: number) => `₦${value.toLocaleString()}`;

const MigrationInviteScreen: React.FC = () => {
  const navigate = useNavigate();
  const [studentName, setStudentName] = useState("");
  const [className, setClassName] = useState("");
  const [totalFee, setTotalFee] = useState("");
  const [amountAlreadyPaid, setAmountAlreadyPaid] = useState("");
  const [installmentFrequency, setInstallmentFrequency] = useState<"MONTHLY" | "WEEKLY">("MONTHLY");

  const invite = useMemo(() => {
    const total = Number(totalFee) || 0;
    const paid = Number(amountAlreadyPaid) || 0;
    const remaining = Math.max(0, total - paid);
    const start = new Date();

    return {
      id: `mig-${Date.now()}`,
      studentName: studentName.trim() || "Student",
      className: className.trim() || "Class",
      totalFee: total,
      amountAlreadyPaid: paid,
      migratedBalance: paid,
      remainingBalance: remaining,
      migrationDate: start.toISOString(),
      startDate: start.toISOString(),
      installmentFrequency,
      status: "pending_confirmation" as const,
      inviteCode: `LOPAY-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    } satisfies MigrationInvite;
  }, [amountAlreadyPaid, className, installmentFrequency, studentName, totalFee]);

  const handleCreateInvite = () => {
    if (!studentName.trim() || !className.trim() || !totalFee || !amountAlreadyPaid) {
      return;
    }

    navigate("/claim-migration-invite", {
      state: {
        invite: {
          ...invite,
          amountAlreadyPaid: Number(amountAlreadyPaid),
          totalFee: Number(totalFee),
          migratedBalance: Number(amountAlreadyPaid),
          remainingBalance: Math.max(0, Number(totalFee) - Number(amountAlreadyPaid)),
        },
      },
    });
  };

  return (
    <Layout>
      <Header title="Create migration invite" />
      <main className="flex flex-col gap-6 p-6 pb-32">
        <section className="rounded-[28px] bg-primary/5 border border-primary/20 p-5">
          <h2 className="text-base font-black text-primary uppercase tracking-[0.2em]">
            Migration setup
          </h2>
          <p className="mt-2 text-sm text-text-secondary-light">
            School-created invite for a parent who already paid before joining Lopay.
          </p>
        </section>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-text-secondary-light">Student name</span>
            <input
              aria-label="Student name"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-background-light p-4 outline-none focus:ring-2 focus:ring-primary"
              placeholder="Ada Lovelace"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-text-secondary-light">Class/Grade</span>
            <input
              aria-label="Class/Grade"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-background-light p-4 outline-none focus:ring-2 focus:ring-primary"
              placeholder="JSS1"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-text-secondary-light">Total fee</span>
            <input
              aria-label="Total fee"
              type="number"
              value={totalFee}
              onChange={(e) => setTotalFee(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-background-light p-4 outline-none focus:ring-2 focus:ring-primary"
              placeholder="150000"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-text-secondary-light">Amount already paid</span>
            <input
              aria-label="Amount already paid"
              type="number"
              value={amountAlreadyPaid}
              onChange={(e) => setAmountAlreadyPaid(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-background-light p-4 outline-none focus:ring-2 focus:ring-primary"
              placeholder="45000"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-text-secondary-light">Installment frequency</span>
            <select
              value={installmentFrequency}
              onChange={(e) => setInstallmentFrequency(e.target.value as "MONTHLY" | "WEEKLY")}
              className="w-full rounded-xl border border-gray-200 bg-background-light p-4 outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="MONTHLY">Monthly</option>
              <option value="WEEKLY">Weekly</option>
            </select>
          </label>
        </div>

        <div className="rounded-[28px] bg-slate-900 p-5 text-white">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">Migration summary</p>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/70">Previously paid</span>
              <strong>{currency(Number(amountAlreadyPaid) || 0)}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/70">Migrated balance</span>
              <strong>{currency(invite.migratedBalance)}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/70">Remaining balance</span>
              <strong>{currency(invite.remainingBalance)}</strong>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCreateInvite}
          disabled={!studentName.trim() || !className.trim() || !totalFee || !amountAlreadyPaid}
          className="h-14 rounded-xl bg-primary text-white font-bold disabled:opacity-50"
        >
          Create invite
        </button>
      </main>
    </Layout>
  );
};

export default MigrationInviteScreen;

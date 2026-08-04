import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlanCard } from "./PlanCard";
import type { Child } from "../types";

/**
 * The parent's plan card, over the ledger's payment statuses.
 *
 * Every status a payment can hold in the database (PENDING / SUCCESS / FAILED /
 * REVERSED) has to say something distinct here — this is the screen a parent
 * checks when the amount they owe changes.
 */
const child = (over: Partial<Child> = {}): Child =>
  ({
    id: "e1",
    parentId: "",
    name: "Ada Lovelace",
    school: "Acme School",
    grade: "JSS1",
    totalFee: 100_000,
    paidAmount: 40_000,
    remainingBalance: 60_000,
    nextInstallmentAmount: 20_000,
    nextDueDate: "12 Jul 2026",
    status: "Active",
    avatarUrl: "",
    schoolId: "s1",
    payments: [],
    ...over,
  }) as Child;

const renderCard = (c: Child) =>
  render(<PlanCard child={c} mode="parent" schoolName="Acme School" />);

describe("PlanCard — reversed payments", () => {
  /*
   * A reversal restores the balance and reopens a completed plan, and the
   * parent is notified about it. The card used to show nothing at all: the
   * amount owed simply went back up with no explanation on the screen the
   * notification sends them to.
   */
  it("explains a reversal so the restored balance has a reason", () => {
    renderCard(child({ hasReversedPayment: true }));

    expect(screen.getByText(/withdrawn its confirmation/i)).toBeInTheDocument();
  });

  /*
   * Installments are transferred bank-to-bank straight to the school
   * (receiver: SCHOOL, platformAmount: 0), so a reversal moves no money — it
   * undoes the school's confirmation of a receipt. The notice must say so, or a
   * parent who transferred real money reads "reversed" as "refunded" and goes
   * looking for money that was never sent back.
   */
  it("does not imply the parent was refunded", () => {
    renderCard(child({ hasReversedPayment: true }));

    expect(screen.getByText(/no money has been refunded/i)).toBeInTheDocument();
  });

  it("says nothing about reversals on a plan that has none", () => {
    renderCard(child());

    expect(screen.queryByText(/withdrawn its confirmation/i)).not.toBeInTheDocument();
  });

  /*
   * A reversal is not a failed attempt — the payment succeeded and was undone —
   * so it must not turn the badge red or offer a retry as though the parent had
   * done something wrong.
   */
  it("does not report a reversal as a failed payment", () => {
    renderCard(
      child({
        hasReversedPayment: true,
        payments: [
          { id: "p1", amount: 20_000, status: "REVERSED", type: "INSTALLMENT" },
        ] as Child["payments"],
      }),
    );

    expect(screen.queryByText(/couldn’t be verified/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/was rejected/i)).not.toBeInTheDocument();
  });

  /* A genuine failure still takes precedence — it is the actionable one. */
  it("prefers the failure notice when a plan has both", () => {
    renderCard(
      child({
        hasReversedPayment: true,
        hasFailedInstallment: true,
        payments: [
          { id: "p1", amount: 20_000, status: "FAILED", type: "INSTALLMENT" },
        ] as Child["payments"],
      }),
    );

    expect(screen.getByText(/was rejected/i)).toBeInTheDocument();
    expect(screen.queryByText(/withdrawn its confirmation/i)).not.toBeInTheDocument();
  });
});

describe("PlanCard — status badge", () => {
  it("shows a pending installment as Pending, not Active", () => {
    renderCard(child({ hasPendingInstallment: true }));

    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("shows a settled plan as Completed", () => {
    renderCard(child({ status: "Completed", remainingBalance: 0 }));

    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("shows a defaulted plan as Defaulted", () => {
    renderCard(child({ status: "Defaulted" }));

    expect(screen.getByText("Defaulted")).toBeInTheDocument();
  });
});

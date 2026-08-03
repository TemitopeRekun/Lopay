import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "./Dashboard";
import type { Child } from "../types";

const navigate = vi.fn();
const childrenData: Child[] = [];

/**
 * The dashboard headline is `GET /enrollments/summary`, not a local sum.
 *
 * Mutated per test the way `childrenData` is. Setting it to null models "the
 * endpoint has not answered yet", which must render as an em dash rather than
 * ₦0.00 — a parent reading ₦0.00 concludes nothing is owed.
 */
let dashboardSummary: any = null;

const summary = (over: Record<string, any> = {}) => ({
  nextCollection: {
    amount: 0,
    dueDate: null,
    enrollmentCount: 0,
    enrollmentId: null,
    childName: null,
    ...(over.nextCollection ?? {}),
  },
  activePlans: 0,
  totalPlans: 0,
  totalOutstanding: 0,
  ...over,
});

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "Ada Parent" },
  }),
}));

vi.mock("../context/DataContext", () => ({
  useData: () => ({
    childrenData,
    transactions: [],
    unreadNotificationsCount: 0,
    schools: [{ id: "school-1", name: "Acme School" }],
    parentDashboardSummary: dashboardSummary,
    isLoading: false,
    hasError: false,
    refreshData: vi.fn(),
  }),
}));

vi.mock("../hooks/useQueries", () => ({
  useUsers: () => ({ data: [] }),
}));

vi.mock("../components/Layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../components/BottomNav", () => ({ BottomNav: () => null }));

const child = (over: Partial<Child> = {}): Child =>
  ({
    id: "enr-1",
    parentId: "",
    name: "Ada Lovelace",
    school: "Acme School",
    schoolId: "school-1",
    grade: "JSS1",
    totalFee: 100_000,
    paidAmount: 25_000,
    remainingBalance: 75_000,
    availableBalance: 75_000,
    nextInstallmentAmount: 25_000,
    nextDueDate: "2026-08-15",
    status: "Active",
    avatarUrl: "https://example.test/avatar.png",
    installmentFrequency: "MONTHLY",
    payments: [],
    ...over,
  }) as Child;

const renderScreen = () =>
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );

beforeEach(() => {
  childrenData.length = 0;
  dashboardSummary = null;
  vi.clearAllMocks();
});

describe("Dashboard — installment payment", () => {
  it("sends the parent to the installment flow for their enrollment", async () => {
    const user = userEvent.setup();
    childrenData.push(child());
    renderScreen();

    await user.click(screen.getByRole("button", { name: /Pay School/ }));

    expect(navigate).toHaveBeenCalledWith("/payment-methods", {
      state: {
        paymentType: "installment",
        amount: 25_000,
        childId: "enr-1",
        allowCustom: true,
      },
    });
  });
});

describe("Dashboard — first-payment retry", () => {
  const failedFirstPayment = child({
    paidAmount: 0,
    remainingBalance: 100_000,
    status: "Failed",
    hasFailedFirstPayment: true,
    payments: [
      {
        id: "p1",
        type: "FIRST_PAYMENT",
        status: "FAILED",
        amount: 30_000,
        date: "2026-06-01T10:00:00.000Z",
      },
    ] as never,
  });

  it("passes no fabricated money figures — the confirm screen fetches them", async () => {
    // It used to send platformFeeAmount: 0 and depositAmount: 0, which made the
    // confirm screen show a ₦0 platform fee, route the whole payment "to school",
    // and understate the balance after payment by exactly that fee.
    const user = userEvent.setup();
    childrenData.push(failedFirstPayment);
    renderScreen();

    await user.click(screen.getByRole("button", { name: /Pay School/ }));

    const [path, options] = navigate.mock.calls[0];
    expect(path).toBe("/confirm-plan");
    const state = (options as { state: Record<string, unknown> }).state;
    expect(state).not.toHaveProperty("platformFeeAmount");
    expect(state).not.toHaveProperty("depositAmount");
    expect(state).not.toHaveProperty("totalInitialPayment");
  });

  it("carries the school, fee and plan the retry needs", async () => {
    const user = userEvent.setup();
    childrenData.push(failedFirstPayment);
    renderScreen();

    await user.click(screen.getByRole("button", { name: /Pay School/ }));

    const [, options] = navigate.mock.calls[0];
    expect((options as { state: Record<string, unknown> }).state).toMatchObject({
      schoolId: "school-1",
      grade: "JSS1",
      totalFee: 100_000,
      childName: "Ada Lovelace",
      schoolName: "Acme School",
      plan: expect.objectContaining({ type: "Monthly", numberOfPayments: 3 }),
    });
  });

  it("suggests the amount last attempted", async () => {
    const user = userEvent.setup();
    childrenData.push(failedFirstPayment);
    renderScreen();

    await user.click(screen.getByRole("button", { name: /Pay School/ }));

    const [, options] = navigate.mock.calls[0];
    expect(
      (options as { state: Record<string, unknown> }).state
        .suggestedFirstPayment,
    ).toBe(30_000);
  });

  it("suggests nothing when no failed attempt can be found", async () => {
    // The old code fell back to 0 here and offered a ₦0 minimum the server rejects.
    const user = userEvent.setup();
    childrenData.push(
      child({
        paidAmount: 0,
        remainingBalance: 100_000,
        status: "Failed",
        hasFailedFirstPayment: true,
        payments: [] as never,
      }),
    );
    renderScreen();

    await user.click(screen.getByRole("button", { name: /Pay School/ }));

    const [, options] = navigate.mock.calls[0];
    expect(
      (options as { state: Record<string, unknown> }).state
        .suggestedFirstPayment,
    ).toBeUndefined();
  });

  it("uses the weekly installment count for a weekly plan", async () => {
    const user = userEvent.setup();
    childrenData.push(
      child({
        paidAmount: 0,
        remainingBalance: 100_000,
        status: "Failed",
        hasFailedFirstPayment: true,
        installmentFrequency: "WEEKLY",
        payments: [] as never,
      }),
    );
    renderScreen();

    await user.click(screen.getByRole("button", { name: /Pay School/ }));

    const [, options] = navigate.mock.calls[0];
    expect(
      (options as { state: { plan: { numberOfPayments: number } } }).state.plan,
    ).toMatchObject({ type: "Weekly", numberOfPayments: 12 });
  });
});

describe("Dashboard — next collection", () => {
  it("renders the server total verbatim, without re-deriving it", () => {
    // Two plans quoting 25,000 each. The screen must show what the server said
    // (35,000 here, deliberately NOT their sum) — the whole point is that the
    // figure comes from the ledger rather than from whatever plans this client
    // happens to be holding.
    childrenData.push(
      child({ id: "a", nextInstallmentAmount: 25_000 }),
      child({ id: "b", nextInstallmentAmount: 25_000 }),
    );
    dashboardSummary = summary({
      nextCollection: {
        amount: 35_000,
        dueDate: "2026-08-15",
        enrollmentCount: 2,
      },
    });
    renderScreen();

    expect(screen.getByText("₦35,000.00")).toBeInTheDocument();
    expect(screen.getByText(/Earliest of 2 plans: 2026-08-15/)).toBeInTheDocument();
  });

  it("names the plan when exactly one is due", () => {
    childrenData.push(child({ id: "a" }));
    dashboardSummary = summary({
      nextCollection: {
        amount: 25_000,
        dueDate: "2026-08-15",
        enrollmentCount: 1,
        enrollmentId: "a",
        childName: "Ada Lovelace",
      },
    });
    renderScreen();

    expect(screen.getByText("₦25,000.00")).toBeInTheDocument();
    expect(
      screen.getByText(/Ada Lovelace — due 2026-08-15/),
    ).toBeInTheDocument();
  });

  it("says nothing is due rather than showing a bare zero", () => {
    // A parent whose plans are all settled or still awaiting a first payment.
    childrenData.push(
      child({ id: "a", status: "Completed", remainingBalance: 0, nextInstallmentAmount: 0 }),
    );
    dashboardSummary = summary();
    renderScreen();

    expect(screen.getByText(/No installment due yet/)).toBeInTheDocument();
  });

  it('shows "—" until the summary endpoint answers', () => {
    // ₦0.00 while loading reads as "you owe nothing", which is a worse lie than
    // an obvious placeholder.
    childrenData.push(child({ id: "a" }));
    dashboardSummary = null;
    renderScreen();

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("prompts a first plan when the parent has none", () => {
    renderScreen();

    expect(
      screen.getByRole("button", { name: /Start a New Plan/ }),
    ).toBeInTheDocument();
  });
});

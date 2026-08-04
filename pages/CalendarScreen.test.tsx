import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import CalendarScreen from "./CalendarScreen";
import type { Child, Transaction } from "../types";

const transactions: Transaction[] = [];
const childrenData: Child[] = [];

vi.mock("../context/AuthContext", () => ({
  // Parent-scoped screen: the queries below are only enabled for this role.
  useAuth: () => ({ user: { id: "u1" }, userRole: "parent" }),
}));

vi.mock("../hooks/useQueries", () => ({
  // `useTransactions` returns a page envelope, not a bare array.
  useTransactions: () => ({
    data: {
      items: transactions,
      total: transactions.length,
      page: 1,
      totalPages: 1,
    },
  }),
  useChildren: () => ({ data: childrenData }),
}));

vi.mock("../components/Layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

/** Fixed "today" so the rendered month and the fixture dates always agree. */
const TODAY = new Date(2026, 5, 15, 12, 0, 0); // 15 Jun 2026, local

const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: "t1",
  userId: "",
  childName: "Ada Lovelace",
  schoolName: "Acme School",
  amount: 25_000,
  // Local noon so the calendar day never rolls over under the runner's timezone.
  date: "2026-06-10T12:00:00",
  status: "Successful",
  type: "INSTALLMENT",
  ...over,
});

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
    nextInstallmentAmount: 25_000,
    nextDueDate: "2026-06-20",
    status: "Active",
    avatarUrl: "https://example.test/avatar.png",
    payments: [],
    ...over,
  }) as Child;

const renderScreen = () =>
  render(
    <MemoryRouter>
      <CalendarScreen />
    </MemoryRouter>,
  );

/** Click a day number in the month grid. */
const selectDay = async (
  user: ReturnType<typeof userEvent.setup>,
  day: number,
) => {
  const cells = screen.getAllByText(String(day));
  await user.click(cells[0]);
};

beforeEach(() => {
  transactions.length = 0;
  childrenData.length = 0;
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(TODAY);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("CalendarScreen — transaction labels", () => {
  it("labels a settled payment as received", async () => {
    const user = userEvent.setup();
    transactions.push(tx({ status: "Successful" }));
    renderScreen();

    await selectDay(user, 10);

    expect(screen.getByText("Payment Received")).toBeInTheDocument();
    expect(screen.getByText("+₦25,000")).toBeInTheDocument();
  });

  it("does not call a pending payment received", async () => {
    // Every row used to read "Payment Received" in green with a leading "+",
    // whatever its status — so an unconfirmed transfer looked settled.
    const user = userEvent.setup();
    transactions.push(tx({ status: "Pending" }));
    renderScreen();

    await selectDay(user, 10);

    expect(screen.getByText("Payment Submitted")).toBeInTheDocument();
    expect(screen.queryByText("Payment Received")).not.toBeInTheDocument();
    expect(screen.queryByText("+₦25,000")).not.toBeInTheDocument();
  });

  it("does not call a failed payment received", async () => {
    const user = userEvent.setup();
    transactions.push(tx({ status: "Failed" }));
    renderScreen();

    await selectDay(user, 10);

    expect(screen.getByText("Payment Failed")).toBeInTheDocument();
    expect(screen.queryByText("Payment Received")).not.toBeInTheDocument();
  });

  it("names a reversed payment as reversed", async () => {
    const user = userEvent.setup();
    transactions.push(tx({ status: "Reversed" }));
    renderScreen();

    await selectDay(user, 10);

    expect(screen.getByText("Payment Reversed")).toBeInTheDocument();
  });
});

describe("CalendarScreen — due dates", () => {
  it("places a YYYY-MM-DD due date on that calendar day", async () => {
    // `new Date("2026-06-20")` is UTC midnight; reading local getters off it lands
    // on the 19th for any negative UTC offset, showing the due date a day early.
    const user = userEvent.setup();
    childrenData.push(child({ nextDueDate: "2026-06-20" }));
    renderScreen();

    await selectDay(user, 20);
    expect(screen.getByText("Payment Due")).toBeInTheDocument();

    await selectDay(user, 19);
    expect(screen.queryByText("Payment Due")).not.toBeInTheDocument();
  });

  it("ignores the 'Pending' placeholder the adapter emits for an unknown date", async () => {
    const user = userEvent.setup();
    childrenData.push(child({ nextDueDate: "Pending" }));
    renderScreen();

    await selectDay(user, 20);

    expect(screen.getByText("No events for this day")).toBeInTheDocument();
  });

  it("omits a completed enrollment's due date", async () => {
    const user = userEvent.setup();
    childrenData.push(
      child({ status: "Completed", remainingBalance: 0, nextDueDate: "2026-06-20" }),
    );
    renderScreen();

    await selectDay(user, 20);

    expect(screen.queryByText("Payment Due")).not.toBeInTheDocument();
  });
});

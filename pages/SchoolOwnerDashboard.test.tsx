/**
 * School-owner dashboard unit tests.
 *
 * The headline figures are all server-computed: the screen must render what
 * `/school-payments/stats` says and never re-derive a total from the loaded
 * page of students. These lock that in without needing a live backend (the
 * fixture-driven companion, SchoolOwnerDashboard.e2e.test.tsx, does that).
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ApiSchoolStats, Child, Transaction } from "../types";

const navigate = vi.fn();
const showToast = vi.fn();
const getTransactions = vi.fn(async (_params?: unknown) => [] as unknown[]);

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("../store/uiStore", () => ({
  useUIStore: () => ({ showToast }),
}));

vi.mock("../services/backend", () => ({
  BackendAPI: { school: { getTransactions: (p?: unknown) => getTransactions(p) } },
}));

vi.mock("../components/Layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../components/BottomNav", () => ({ BottomNav: () => null }));
vi.mock("../components/PlanCard", () => ({
  PlanCard: ({ child }: { child: Child }) => (
    <div data-testid="plan-card">
      {child.name} — {child.remainingBalance}
    </div>
  ),
}));
vi.mock("../components/RecentTransactionsList", () => ({
  RecentTransactionsList: ({ transactions }: { transactions: Transaction[] }) => (
    <div data-testid="recent">{transactions.length}</div>
  ),
}));

const authState = {
  user: { id: "o1", name: "Owner", role: "school_owner", schoolId: "s1" },
  isOwnerAccount: false,
  setActingRole: vi.fn(),
  activeSchoolId: null as string | null,
};
vi.mock("../context/AuthContext", () => ({ useAuth: () => authState }));

const dataState = {
  schoolTransactions: [] as Transaction[],
  pendingPayments: [] as Transaction[],
  allStudents: [] as Child[],
  schools: [{ id: "s1", name: "Sunrise Academy" }],
  notifications: [] as unknown[],
  isLoading: false,
  schoolStats: null as ApiSchoolStats | null,
  hasError: false,
  refreshData: vi.fn(),
};
vi.mock("../context/DataContext", () => ({ useData: () => dataState }));

import SchoolOwnerDashboard from "./SchoolOwnerDashboard";

const student = (over: Partial<Child> = {}): Child =>
  ({
    id: `e${Math.random()}`,
    name: "Ada",
    school: "Sunrise Academy",
    grade: "Grade 1",
    totalFee: 100000,
    paidAmount: 52500,
    remainingBalance: 50000,
    status: "Active",
    nextInstallmentAmount: 0,
    nextDueDate: "2026-03-01",
    ...over,
  }) as Child;

const stats = (over: Partial<ApiSchoolStats> = {}): ApiSchoolStats => ({
  totalRevenue: 1_400_000,
  pendingRevenue: 10_000,
  awaitingActivation: 50_000,
  defaultedAmount: 150_000,
  totalStudents: 55,
  activeStudents: 51,
  ...over,
});

const renderScreen = () =>
  render(
    <MemoryRouter>
      <SchoolOwnerDashboard />
    </MemoryRouter>,
  );

/** Read the ₦ figure rendered alongside a label. */
const naira = (label: RegExp): number => {
  const el = screen.getByText(label);
  const m = (el.parentElement?.textContent ?? "").match(/₦([\d,]+)/);
  return m ? Number(m[1].replace(/,/g, "")) : NaN;
};

beforeEach(() => {
  vi.clearAllMocks();
  dataState.schoolTransactions = [];
  dataState.pendingPayments = [];
  dataState.allStudents = [];
  dataState.notifications = [];
  dataState.isLoading = false;
  dataState.hasError = false;
  dataState.schoolStats = stats();
  authState.activeSchoolId = null;
  authState.isOwnerAccount = false;
  getTransactions.mockImplementation(async () => []);
});

describe("SchoolOwnerDashboard headline figures", () => {
  it("shows the school's own collections, not a platform figure", () => {
    renderScreen();
    expect(screen.getByText(/School Collections/i)).toBeTruthy();
    expect(screen.queryByText(/Platform Collections/i)).toBeNull();
    expect(naira(/School Collections/i)).toBe(1_400_000);
  });

  /*
   * The roster is paginated; counting the loaded page under-reported every
   * school with more students than one page.
   */
  it("takes the registered count from the ledger, not the loaded page", () => {
    dataState.allStudents = [student(), student()];
    renderScreen();
    const badge = screen.getByText(/REGISTERED$/);
    expect(Number(badge.textContent!.replace(/\D/g, ""))).toBe(55);
  });

  it("takes Active Plans from the ledger, not the loaded page", () => {
    dataState.allStudents = [student({ status: "Active" })];
    renderScreen();
    const card = screen.getByText(/Active Plans/i).parentElement as HTMLElement;
    expect(within(card).getByText(/^\d+$/).textContent).toBe("51");
  });

  it("takes Fee Arrears from the server's defaulted balances", () => {
    // A loaded page that would derive a different (wrong) number.
    dataState.allStudents = [
      student({ status: "Defaulted", totalFee: 100000, paidAmount: 52500 }),
    ];
    renderScreen();
    expect(naira(/Fee Arrears/i)).toBe(150_000);
  });

  it("shows only genuinely-pending money under Pending approvals", () => {
    renderScreen();
    const row = screen.getByText(/Pending approvals/i)
      .parentElement as HTMLElement;
    expect(row.textContent).toContain("10,000");
  });

  it("separates first payments awaiting platform activation", () => {
    renderScreen();
    const row = screen.getByText(/Awaiting platform activation/i)
      .parentElement as HTMLElement;
    expect(row.textContent).toContain("50,000");
  });

  it("hides the activation line when nothing is awaiting it", () => {
    dataState.schoolStats = stats({ awaitingActivation: 0 });
    renderScreen();
    expect(screen.queryByText(/Awaiting platform activation/i)).toBeNull();
  });

  it("falls back to the loaded roster when stats are unavailable", () => {
    dataState.schoolStats = null;
    dataState.allStudents = [
      student({ status: "Active" }),
      student({ status: "Defaulted" }),
    ];
    renderScreen();
    const badge = screen.getByText(/REGISTERED$/);
    expect(Number(badge.textContent!.replace(/\D/g, ""))).toBe(2);
    const card = screen.getByText(/Active Plans/i).parentElement as HTMLElement;
    expect(within(card).getByText(/^\d+$/).textContent).toBe("1");
    expect(naira(/Fee Arrears/i)).toBe(0);
  });

  it("treats a non-finite stat as zero rather than rendering NaN", () => {
    dataState.schoolStats = stats({
      totalRevenue: Number.NaN,
      defaultedAmount: Number.NaN,
    });
    renderScreen();
    expect(naira(/School Collections/i)).toBe(0);
    expect(naira(/Fee Arrears/i)).toBe(0);
    expect(screen.queryByText(/NaN/)).toBeNull();
  });
});

describe("SchoolOwnerDashboard student registry", () => {
  it("lists every loaded student", () => {
    dataState.allStudents = [
      student({ name: "Ada" }),
      student({ name: "Bode" }),
    ];
    renderScreen();
    expect(screen.getAllByTestId("plan-card")).toHaveLength(2);
  });

  it("warns when the roster holds fewer students than the ledger counts", () => {
    dataState.allStudents = [student()];
    renderScreen();
    expect(screen.getByText(/Showing 1 of 55 students/i)).toBeTruthy();
  });

  it("stays quiet when the roster is complete", () => {
    dataState.schoolStats = stats({ totalStudents: 1 });
    dataState.allStudents = [student()];
    renderScreen();
    expect(screen.queryByText(/roster didn't load fully/i)).toBeNull();
  });

  it("does not warn while the owner is searching", async () => {
    dataState.schoolStats = stats({ totalStudents: 55 });
    dataState.allStudents = Array.from({ length: 55 }, (_, i) =>
      student({ name: `Kid ${i}` }),
    );
    const { container } = renderScreen();
    const input = container.querySelector("input")!;
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.change(input, { target: { value: "Kid 1" } });
    expect(screen.queryByText(/roster didn't load fully/i)).toBeNull();
  });
});

describe("SchoolOwnerDashboard collection ledger export", () => {
  const arm = () => {
    const createObjectURL = vi.fn(() => "blob:x");
    (URL as unknown as Record<string, unknown>).createObjectURL =
      createObjectURL;
    (URL as unknown as Record<string, unknown>).revokeObjectURL = vi.fn();
    const clicks: string[] = [];
    const orig = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      clicks.push(this.download);
    };
    return { createObjectURL, clicks, restore: () => {
      HTMLAnchorElement.prototype.click = orig;
    } };
  };

  it("fetches the selected month and writes a CSV", async () => {
    getTransactions.mockImplementation(async () => [
      {
        id: "p1",
        childName: "Ada",
        className: "Grade 1",
        amount: 25000,
        status: "SUCCESS",
        paymentType: "INSTALLMENT",
        date: "2026-02-10T10:00:00.000Z",
      },
    ]);
    const { createObjectURL, clicks, restore } = arm();
    renderScreen();

    screen
      .getByRole("button", { name: /DOWNLOAD COLLECTION LEDGER/i })
      .click();

    await waitFor(() => expect(getTransactions).toHaveBeenCalled());
    await waitFor(() => expect(clicks.length).toBe(1));
    restore();

    const params = getTransactions.mock.calls[0][0] as {
      from: string;
      to: string;
      take: number;
    };
    expect(new Date(params.to).getTime()).toBeGreaterThan(
      new Date(params.from).getTime(),
    );
    expect(params.take).toBe(1000);
    expect(createObjectURL).toHaveBeenCalled();
    expect(clicks[0]).toMatch(/^sunrise-academy-collections-\d{4}-\d{2}\.csv$/);
    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining("Exported 1 payment"),
      "success",
    );
  });

  /* It used to raise "Report generated successfully" with no file behind it. */
  it("reports an empty month rather than claiming success", async () => {
    getTransactions.mockImplementation(async () => []);
    const { createObjectURL, restore } = arm();
    renderScreen();

    screen
      .getByRole("button", { name: /DOWNLOAD COLLECTION LEDGER/i })
      .click();

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining("No payments recorded"),
        "info",
      ),
    );
    restore();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("surfaces a failed fetch instead of a success toast", async () => {
    getTransactions.mockImplementation(async () => {
      throw new Error("network down");
    });
    const { restore } = arm();
    renderScreen();

    screen
      .getByRole("button", { name: /DOWNLOAD COLLECTION LEDGER/i })
      .click();

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(expect.any(String), "error"),
    );
    restore();
    expect(showToast).not.toHaveBeenCalledWith(
      expect.stringContaining("Exported"),
      "success",
    );
  });

  it("refuses to export without a resolved school", async () => {
    dataState.schools = [];
    renderScreen();

    screen
      .getByRole("button", { name: /DOWNLOAD COLLECTION LEDGER/i })
      .click();

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining("Unable to generate report"),
        "error",
      ),
    );
    expect(getTransactions).not.toHaveBeenCalled();
    dataState.schools = [{ id: "s1", name: "Sunrise Academy" }];
  });
});

describe("SchoolOwnerDashboard navigation", () => {
  it("badges the approval queue with the pending count", () => {
    dataState.pendingPayments = [
      { id: "p1" } as Transaction,
      { id: "p2" } as Transaction,
    ];
    renderScreen();
    expect(screen.getByText(/2 New/)).toBeTruthy();
  });

  it("routes the management tiles", () => {
    renderScreen();
    screen.getByText(/Fee Structure/i).closest("button")!.click();
    expect(navigate).toHaveBeenCalledWith("/school/fees");
    screen.getByText(/Verify Payments/i).closest("button")!.click();
    expect(navigate).toHaveBeenCalledWith("/admin/approvals");
    screen.getByText(/Fee Arrears/i).closest("div")!.click();
    expect(navigate).toHaveBeenCalledWith("/admin/defaulters");
  });
});

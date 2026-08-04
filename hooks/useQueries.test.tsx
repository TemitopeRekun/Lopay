import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Unit tests for the React Query data-access layer. The only external
 * dependency of useQueries.ts is the BackendAPI (services/backend.ts), so it is
 * mocked wholesale. The real adapters (services/adapters.ts) run so the tests
 * assert the *adapted* shape the UI actually consumes. Mutation tests spy on the
 * QueryClient to lock in the cache-invalidation contract each mutation promises.
 */
const api = vi.hoisted(() => ({
  parent: {
    getChildren: vi.fn(),
    getHistory: vi.fn(),
    enroll: vi.fn(),
    payInstallment: vi.fn(),
  },
  notifications: {
    get: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  },
  admin: {
    getAllTransactions: vi.fn(),
    getPendingFirstPayments: vi.fn(),
    getPendingInstallments: vi.fn(),
    getPlatformRevenue: vi.fn(),
    getStudentsSummary: vi.fn(),
    getSchoolsSummary: vi.fn(),
    getOverview: vi.fn(),
    getSchoolStudents: vi.fn(),
    getUsers: vi.fn(),
    settleFirstPayment: vi.fn(),
    rejectFirstPayment: vi.fn(),
    onboardSchool: vi.fn(),
    updateSchool: vi.fn(),
    deleteSchool: vi.fn(),
    deleteUser: vi.fn(),
    broadcast: vi.fn(),
  },
  public: {
    getSchools: vi.fn(),
    getSchoolFees: vi.fn(),
    getSchoolBankDetails: vi.fn(),
  },
  school: {
    getStats: vi.fn(),
    getPendingPayments: vi.fn(),
    getTransactions: vi.fn(),
    getStudents: vi.fn(),
    getAllStudents: vi.fn(),
    confirmPayment: vi.fn(),
    confirmFirstPayment: vi.fn(),
    declinePayment: vi.fn(),
    updateStudentStatus: vi.fn(),
  },
  users: {
    get: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("../services/backend", () => ({ BackendAPI: api }));

const logger = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
  log: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
}));
vi.mock("../utils/logger", () => ({ logger }));

import * as Q from "./useQueries";
import { useUIStore } from "../store/uiStore";

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

/** Render a query hook and wait for it to resolve successfully. */
async function renderQuery<T>(hook: () => T) {
  const { queryClient, wrapper } = setup();
  const rendered = renderHook(hook, { wrapper });
  return { ...rendered, queryClient };
}

beforeEach(() => {
  vi.resetAllMocks();
  useUIStore.setState({ toasts: [] });
});

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

describe("useChildren", () => {
  it("normalizes the returned enrollments", async () => {
    api.parent.getChildren.mockResolvedValue([
      { id: "c1", childName: "Alice", totalFee: 300, paidAmount: 100 },
    ]);
    const { result } = await renderQuery(() => Q.useChildren());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.parent.getChildren).toHaveBeenCalledTimes(1);
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].name).toBe("Alice");
  });

  it("returns [] when the API returns a non-array", async () => {
    api.parent.getChildren.mockResolvedValue({ not: "an array" });
    const { result } = await renderQuery(() => Q.useChildren());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("does not fetch when disabled", async () => {
    const { result } = await renderQuery(() => Q.useChildren(false));
    expect(result.current.fetchStatus).toBe("idle");
    expect(api.parent.getChildren).not.toHaveBeenCalled();
  });
});

describe("useNotifications", () => {
  it("normalizes the items and keeps the server's unread count", async () => {
    api.notifications.get.mockResolvedValue({
      items: [
        {
          id: "n1",
          title: "Payment confirmed",
          message: "ok",
          createdAt: "2026-01-01",
          isRead: false,
        },
      ],
      // Deliberately larger than `items` — the list is a bounded window, so the
      // badge must come from the server rather than from the rows on screen.
      unreadCount: 12,
      limit: 100,
    });
    const { result } = await renderQuery(() => Q.useNotifications("u1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.items[0].title).toBe("Payment confirmed");
    expect(result.current.data!.items[0].status).toBe("success");
    expect(result.current.data!.unreadCount).toBe(12);
  });

  it("is disabled without a userId", async () => {
    const { result } = await renderQuery(() => Q.useNotifications(undefined));
    expect(result.current.fetchStatus).toBe("idle");
    expect(api.notifications.get).not.toHaveBeenCalled();
  });
});

describe("useTransactions", () => {
  it("normalizes parent history", async () => {
    api.parent.getHistory.mockResolvedValue([
      { id: "t1", amount: 500, status: "SUCCESS" },
    ]);
    const { result } = await renderQuery(() => Q.useTransactions("u1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.items[0].amount).toBe(500);
    expect(result.current.data!.items[0].status).toBe("Successful");
  });

  /*
   * The status tabs must narrow the QUERY. Filtering the fetched page instead
   * would search one page and render it as the whole history.
   */
  it("sends the status filter and page to the server", async () => {
    api.parent.getHistory.mockResolvedValue({
      items: [],
      total: 0,
      page: 2,
      totalPages: 4,
    });
    await renderQuery(() =>
      Q.useTransactions("u1", true, { page: 2, status: "FAILED" }),
    );
    await waitFor(() =>
      expect(api.parent.getHistory).toHaveBeenCalledWith({
        page: 2,
        status: "FAILED",
      }),
    );
  });

  it("is disabled without a userId", async () => {
    const { result } = await renderQuery(() => Q.useTransactions());
    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useGlobalTransactions", () => {
  it("normalizes a bare array response", async () => {
    api.admin.getAllTransactions.mockResolvedValue([
      { id: "t1", amount: 10, status: "FAILED" },
    ]);
    const { result } = await renderQuery(() => Q.useGlobalTransactions());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.admin.getAllTransactions).toHaveBeenCalledWith({
      includeReceiptSignedUrls: true,
      receiptType: "ALL",
      page: 1,
    });
    expect(result.current.data!.items[0].status).toBe("Failed");
  });

  it("unwraps a paginated envelope", async () => {
    api.admin.getAllTransactions.mockResolvedValue({
      items: [{ id: "t2", amount: 20, status: "PENDING" }],
      total: 137,
      page: 1,
      totalPages: 3,
    });
    const { result } = await renderQuery(() => Q.useGlobalTransactions());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.items).toHaveLength(1);
    expect(result.current.data!.items[0].id).toBe("t2");
    // The envelope's totals must survive: they are what tells the screen the
    // page it is holding is not the whole ledger.
    expect(result.current.data!.total).toBe(137);
    expect(result.current.data!.totalPages).toBe(3);
  });
});

describe("useSchools", () => {
  it("normalizes the public schools list", async () => {
    api.public.getSchools.mockResolvedValue([
      { id: "s1", name: "Sunrise", ownerName: "Ada" },
    ]);
    const { result } = await renderQuery(() => Q.useSchools());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data![0].name).toBe("Sunrise");
  });
});

describe("useSchoolStats", () => {
  it("returns the raw stats payload", async () => {
    api.school.getStats.mockResolvedValue({ totalCollected: 999 });
    const { result } = await renderQuery(() => Q.useSchoolStats());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ totalCollected: 999 });
  });
});

describe("usePendingPayments", () => {
  it("keeps only Pending items (string contextKey overload)", async () => {
    api.school.getPendingPayments.mockResolvedValue([
      { id: "p1", amount: 1, status: "PENDING" },
      { id: "p2", amount: 2, status: "SUCCESS" },
    ]);
    const { result } = await renderQuery(() =>
      Q.usePendingPayments("dashboard", true),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].id).toBe("p1");
  });

  it("supports the boolean-enabled overload", async () => {
    api.school.getPendingPayments.mockResolvedValue([]);
    const { result } = await renderQuery(() => Q.usePendingPayments(true));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("is disabled when passed false", async () => {
    const { result } = await renderQuery(() => Q.usePendingPayments(false));
    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useSchoolTransactions", () => {
  it("normalizes school transactions", async () => {
    api.school.getTransactions.mockResolvedValue([
      { id: "t1", amount: 42, status: "SUCCESS" },
    ]);
    const { result } = await renderQuery(() => Q.useSchoolTransactions());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.items[0].amount).toBe(42);
  });
});

describe("useSchoolStudents", () => {
  it("normalizes students (string contextKey overload)", async () => {
    api.school.getAllStudents.mockResolvedValue({
      items: [{ id: "e1", childName: "Bob" }],
      total: 1,
      truncated: false,
    });
    const { result } = await renderQuery(() =>
      Q.useSchoolStudents("roster", true),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data![0].name).toBe("Bob");
  });

  /*
   * The whole roster, not page 1. The dashboard derives its registry count and
   * search from this list, and the endpoint pages at 50 by default.
   */
  it("returns every student the paging helper collected", async () => {
    api.school.getAllStudents.mockResolvedValue({
      items: Array.from({ length: 55 }, (_, i) => ({
        id: `e${i}`,
        childName: `Kid ${i}`,
      })),
      total: 55,
      truncated: false,
    });
    const { result } = await renderQuery(() => Q.useSchoolStudents(true));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(55);
  });

  it("carries the enrollment balance through to the Child model", async () => {
    api.school.getAllStudents.mockResolvedValue({
      items: [
        {
          id: "e1",
          childName: "Ada",
          totalFee: 100000,
          paidAmount: 52500,
          remainingBalance: 50000,
          paymentStatus: "DEFAULTED",
        },
      ],
      total: 1,
      truncated: false,
    });
    const { result } = await renderQuery(() => Q.useSchoolStudents(true));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // NOT totalFee - paidAmount (47,500), which is short by the platform fee.
    expect(result.current.data![0].remainingBalance).toBe(50000);
  });

  it("logs when the roster came back truncated", async () => {
    api.school.getAllStudents.mockResolvedValue({
      items: [{ id: "e1", childName: "Bob" }],
      total: 900,
      truncated: true,
    });
    const { result } = await renderQuery(() => Q.useSchoolStudents(true));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("truncated"),
    );
  });

  it("returns [] when the roster is empty", async () => {
    api.school.getAllStudents.mockResolvedValue({
      items: [],
      total: 0,
      truncated: false,
    });
    const { result } = await renderQuery(() => Q.useSchoolStudents(true));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});

describe("useSchoolFees", () => {
  it("returns the fee list for a school", async () => {
    api.public.getSchoolFees.mockResolvedValue([
      { className: "JSS1", feeAmount: 100 },
    ]);
    const { result } = await renderQuery(() => Q.useSchoolFees("s1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.public.getSchoolFees).toHaveBeenCalledWith("s1");
    expect(result.current.data![0].className).toBe("JSS1");
  });

  it("is disabled without a schoolId", async () => {
    const { result } = await renderQuery(() => Q.useSchoolFees(""));
    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useSchoolBankDetails", () => {
  it("returns bank details for a school", async () => {
    api.public.getSchoolBankDetails.mockResolvedValue({ bankName: "GTBank" });
    const { result } = await renderQuery(() => Q.useSchoolBankDetails("s1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ bankName: "GTBank" });
  });

  it("is disabled when the schoolId is null", async () => {
    const { result } = await renderQuery(() => Q.useSchoolBankDetails(null));
    expect(result.current.fetchStatus).toBe("idle");
    expect(api.public.getSchoolBankDetails).not.toHaveBeenCalled();
  });
});

describe("useAdminPendingFirstPayments", () => {
  it("unwraps a paginated envelope and filters to Pending", async () => {
    api.admin.getPendingFirstPayments.mockResolvedValue({
      items: [
        { id: "p1", status: "PENDING" },
        { id: "p2", status: "SUCCESS" },
      ],
      total: 2,
      totalPages: 3,
      page: 1,
    });
    const { result } = await renderQuery(() =>
      Q.useAdminPendingFirstPayments(),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.admin.getPendingFirstPayments).toHaveBeenCalledWith({ page: 1 });
    expect(result.current.data!.items).toHaveLength(1);
    expect(result.current.data!.total).toBe(2);
    expect(result.current.data!.totalPages).toBe(3);
    expect(result.current.data!.page).toBe(1);
  });

  it("tolerates a bare array (back-compat)", async () => {
    api.admin.getPendingFirstPayments.mockResolvedValue([
      { id: "p1", status: "PENDING" },
    ]);
    const { result } = await renderQuery(() =>
      Q.useAdminPendingFirstPayments(true, 2),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.admin.getPendingFirstPayments).toHaveBeenCalledWith({ page: 2 });
    expect(result.current.data!.total).toBe(1);
    expect(result.current.data!.totalPages).toBe(1);
    expect(result.current.data!.page).toBe(1);
  });
});

describe("useAdminPendingInstallments", () => {
  it("unwraps a paginated envelope and filters to Pending", async () => {
    api.admin.getPendingInstallments.mockResolvedValue({
      items: [
        { id: "p1", status: "PENDING" },
        { id: "p2", status: "SUCCESS" },
      ],
      total: 2,
      totalPages: 4,
      page: 1,
    });
    const { result } = await renderQuery(() =>
      Q.useAdminPendingInstallments(),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.items).toHaveLength(1);
    expect(result.current.data!.totalPages).toBe(4);
  });

  it("tolerates a bare array (back-compat)", async () => {
    api.admin.getPendingInstallments.mockResolvedValue([
      { id: "p1", status: "PENDING" },
    ]);
    const { result } = await renderQuery(() =>
      Q.useAdminPendingInstallments(),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.total).toBe(1);
  });
});

describe("useAdminPlatformRevenue", () => {
  it("returns the revenue payload", async () => {
    api.admin.getPlatformRevenue.mockResolvedValue({ revenue: 1234 });
    const { result } = await renderQuery(() => Q.useAdminPlatformRevenue());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ revenue: 1234 });
  });
});

describe("useAdminStudentsSummary", () => {
  it("returns the students summary payload", async () => {
    api.admin.getStudentsSummary.mockResolvedValue({ total: 7 });
    const { result } = await renderQuery(() => Q.useAdminStudentsSummary());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ total: 7 });
  });
});

describe("useAdminSchoolsSummary", () => {
  it("returns the schools summary payload", async () => {
    api.admin.getSchoolsSummary.mockResolvedValue([{ schoolId: "s1" }]);
    const { result } = await renderQuery(() => Q.useAdminSchoolsSummary());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ schoolId: "s1" }]);
  });
});

describe("useAdminOverview", () => {
  it("normalizes the recentTransactions inside the overview", async () => {
    api.admin.getOverview.mockResolvedValue({
      recentTransactions: [{ id: "t1", amount: 9, status: "SUCCESS" }],
    });
    const { result } = await renderQuery(() => Q.useAdminOverview());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.recentTransactions[0].status).toBe(
      "Successful",
    );
  });

  it("defaults recentTransactions to [] when absent", async () => {
    api.admin.getOverview.mockResolvedValue({ totalUsers: 1 });
    const { result } = await renderQuery(() => Q.useAdminOverview());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.recentTransactions).toEqual([]);
  });
});

describe("useUser", () => {
  it("normalizes a single user", async () => {
    api.users.get.mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      fullName: "Ada",
      role: "PARENT",
    });
    const { result } = await renderQuery(() => Q.useUser("u1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.users.get).toHaveBeenCalledWith("u1");
    expect(result.current.data!.id).toBe("u1");
    expect(result.current.data!.name).toBe("Ada");
  });

  it("is disabled when userId is null", async () => {
    const { result } = await renderQuery(() => Q.useUser(null));
    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useUsers", () => {
  it("normalizes the admin users list", async () => {
    api.admin.getUsers.mockResolvedValue([
      { id: "u1", email: "a@b.com", role: "SUPER_ADMIN" },
    ]);
    const { result } = await renderQuery(() => Q.useUsers());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data![0].role).toBe("owner");
  });

  it("tolerates a non-array response", async () => {
    api.admin.getUsers.mockResolvedValue(undefined);
    const { result } = await renderQuery(() => Q.useUsers());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

/** Render a mutation hook, run it once, return the invalidateQueries spy. */
async function runMutation<TVars>(
  hook: () => { mutateAsync: (v: TVars) => Promise<unknown> },
  vars: TVars,
) {
  const { queryClient, wrapper } = setup();
  const spy = vi.spyOn(queryClient, "invalidateQueries");
  const { result } = renderHook(hook, { wrapper });
  await act(async () => {
    await result.current.mutateAsync(vars);
  });
  return { spy };
}

function invalidatedKeys(spy: { mock: { calls: unknown[][] } }): unknown[] {
  return spy.mock.calls.map((c) => (c[0] as { queryKey: unknown }).queryKey);
}

describe("usePayInstallment", () => {
  it("forwards the installment args and invalidates payment caches", async () => {
    api.parent.payInstallment.mockResolvedValue({ ok: true });
    const { spy } = await runMutation(() => Q.usePayInstallment(), {
      enrollmentId: "e1",
      amount: 250,
    });
    expect(api.parent.payInstallment).toHaveBeenCalledWith(
      "e1",
      250,
      undefined,
      undefined,
    );
    expect(invalidatedKeys(spy)).toContainEqual(Q.QUERY_KEYS.pendingPayments);
    expect(invalidatedKeys(spy)).toContainEqual(Q.QUERY_KEYS.children);
  });
});

describe("notification mutations", () => {
  it("useMarkNotificationRead marks read and invalidates notifications", async () => {
    api.notifications.markRead.mockResolvedValue({ ok: true });
    const { spy } = await runMutation(() => Q.useMarkNotificationRead(), "n1");
    expect(api.notifications.markRead).toHaveBeenCalledWith(
      "n1",
      expect.anything(),
    );
    expect(invalidatedKeys(spy)).toContainEqual(Q.QUERY_KEYS.notifications);
  });

  it("useMarkAllNotificationsRead marks all read and invalidates notifications", async () => {
    api.notifications.markAllRead.mockResolvedValue({ ok: true });
    const { spy } = await runMutation(
      () => Q.useMarkAllNotificationsRead(),
      undefined,
    );
    expect(api.notifications.markAllRead).toHaveBeenCalledTimes(1);
    expect(invalidatedKeys(spy)).toContainEqual(Q.QUERY_KEYS.notifications);
  });
});

describe("school payment mutations", () => {
  it("useConfirmPayment confirms and invalidates payment caches", async () => {
    api.school.confirmPayment.mockResolvedValue({ ok: true });
    const { spy } = await runMutation(() => Q.useConfirmPayment(), "pay1");
    expect(api.school.confirmPayment).toHaveBeenCalledWith(
      "pay1",
      expect.anything(),
    );
    expect(invalidatedKeys(spy)).toContainEqual(Q.QUERY_KEYS.pendingPayments);
  });

  it("useConfirmFirstPayment confirms and invalidates enrollment caches", async () => {
    api.school.confirmFirstPayment.mockResolvedValue({ ok: true });
    const { spy } = await runMutation(() => Q.useConfirmFirstPayment(), "enr1");
    expect(api.school.confirmFirstPayment).toHaveBeenCalledWith(
      "enr1",
      expect.anything(),
    );
    expect(invalidatedKeys(spy)).toContainEqual(Q.QUERY_KEYS.children);
  });

  it("useDeclinePayment declines and invalidates payment caches", async () => {
    api.school.declinePayment.mockResolvedValue({ ok: true });
    const { spy } = await runMutation(() => Q.useDeclinePayment(), "pay2");
    expect(api.school.declinePayment).toHaveBeenCalledWith(
      "pay2",
      expect.anything(),
    );
    expect(invalidatedKeys(spy)).toContainEqual(Q.QUERY_KEYS.pendingPayments);
  });
});

describe("admin settlement mutations", () => {
  it("useSettleFirstPayment settles and invalidates admin caches", async () => {
    api.admin.settleFirstPayment.mockResolvedValue({ ok: true });
    const { spy } = await runMutation(() => Q.useSettleFirstPayment(), "pay1");
    expect(api.admin.settleFirstPayment).toHaveBeenCalledWith(
      "pay1",
      expect.anything(),
    );
    expect(invalidatedKeys(spy)).toContainEqual(
      Q.QUERY_KEYS.adminPendingFirstPayments,
    );
  });

  it("useRejectFirstPayment rejects and invalidates admin caches", async () => {
    api.admin.rejectFirstPayment.mockResolvedValue({ ok: true });
    const { spy } = await runMutation(() => Q.useRejectFirstPayment(), "pay2");
    expect(api.admin.rejectFirstPayment).toHaveBeenCalledWith(
      "pay2",
      expect.anything(),
    );
    expect(invalidatedKeys(spy)).toContainEqual(
      Q.QUERY_KEYS.adminPendingFirstPayments,
    );
  });
});

describe("school CRUD mutations", () => {
  it("useAddSchool onboards and invalidates schools", async () => {
    api.admin.onboardSchool.mockResolvedValue({ ok: true });
    const { spy } = await runMutation(
      () => Q.useAddSchool(),
      { schoolName: "New" } as never,
    );
    expect(api.admin.onboardSchool).toHaveBeenCalledTimes(1);
    expect(invalidatedKeys(spy)).toContainEqual(Q.QUERY_KEYS.schools);
  });

  it("useUpdateSchool updates and invalidates schools + bank details", async () => {
    api.admin.updateSchool.mockResolvedValue({ ok: true });
    const { spy } = await runMutation(
      () => Q.useUpdateSchool(),
      { id: "s1", name: "Renamed" } as never,
    );
    expect(api.admin.updateSchool).toHaveBeenCalledWith({
      id: "s1",
      name: "Renamed",
    });
    expect(invalidatedKeys(spy)).toContainEqual(Q.QUERY_KEYS.schools);
    expect(invalidatedKeys(spy)).toContainEqual(["schoolBankDetails"]);
  });

  it("useDeleteSchool deletes and invalidates schools", async () => {
    api.admin.deleteSchool.mockResolvedValue({ ok: true });
    const { spy } = await runMutation(() => Q.useDeleteSchool(), "s1");
    expect(api.admin.deleteSchool).toHaveBeenCalledWith(
      "s1",
      expect.anything(),
    );
    expect(invalidatedKeys(spy)).toContainEqual(Q.QUERY_KEYS.schools);
  });
});

describe("useDeleteAllSchools", () => {
  it("loops until no schools remain, then invalidates schools", async () => {
    api.public.getSchools
      .mockResolvedValueOnce([{ id: "s1" }, { id: "s2" }])
      .mockResolvedValueOnce([]);
    api.admin.deleteSchool.mockResolvedValue({ ok: true });
    const { spy } = await runMutation(
      () => Q.useDeleteAllSchools(),
      undefined,
    );
    expect(api.public.getSchools).toHaveBeenCalledTimes(2);
    expect(api.admin.deleteSchool).toHaveBeenCalledTimes(2);
    expect(invalidatedKeys(spy)).toContainEqual(Q.QUERY_KEYS.schools);
  });

  it("throws when a batch deletes nothing (avoids an infinite loop)", async () => {
    api.public.getSchools.mockResolvedValue([{ id: "s1" }]);
    api.admin.deleteSchool.mockRejectedValue(new Error("nope"));
    const { wrapper } = setup();
    const { result } = renderHook(() => Q.useDeleteAllSchools(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(undefined).catch(() => undefined);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useBroadcast", () => {
  it("forwards title and message", async () => {
    api.admin.broadcast.mockResolvedValue({ ok: true });
    await runMutation(() => Q.useBroadcast(), {
      title: "Notice",
      message: "Hello",
    });
    expect(api.admin.broadcast).toHaveBeenCalledWith("Notice", "Hello");
  });
});

describe("user mutations", () => {
  it("useDeleteUser deletes and invalidates users", async () => {
    api.admin.deleteUser.mockResolvedValue({ ok: true });
    const { spy } = await runMutation(() => Q.useDeleteUser(), "u1");
    expect(api.admin.deleteUser).toHaveBeenCalledWith(
      "u1",
      expect.anything(),
    );
    expect(invalidatedKeys(spy)).toContainEqual(Q.QUERY_KEYS.users);
  });

  it("useUpdateUser updates and invalidates users", async () => {
    api.users.update.mockResolvedValue({ ok: true });
    const { spy } = await runMutation(
      () => Q.useUpdateUser(),
      { id: "u1", name: "Ada" } as never,
    );
    expect(api.users.update).toHaveBeenCalledWith(
      { id: "u1", name: "Ada" },
      expect.anything(),
    );
    expect(invalidatedKeys(spy)).toContainEqual(Q.QUERY_KEYS.users);
  });
});

describe("useUpdateChildStatus", () => {
  it("updates status and invalidates students + children", async () => {
    api.school.updateStudentStatus.mockResolvedValue({ ok: true });
    const { spy } = await runMutation(() => Q.useUpdateChildStatus(), {
      childId: "c1",
      status: "ACTIVE",
    });
    expect(api.school.updateStudentStatus).toHaveBeenCalledWith("c1", "ACTIVE");
    expect(invalidatedKeys(spy)).toContainEqual(Q.QUERY_KEYS.schoolStudents);
    expect(invalidatedKeys(spy)).toContainEqual(Q.QUERY_KEYS.children);
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
// The module is mocked below, so the genuine implementations have to be pulled
// in separately for the real-client test at the end of the refresh suite.
const { QueryClient: RealQueryClient, QueryObserver: RealQueryObserver } =
  await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
import {
  DataProvider,
  useData,
  useParentData,
  useSchoolData,
  useOwnerData,
} from "./DataContext";

// DataContext is pure orchestration over useAuth + the useQueries hooks +
// react-query's queryClient. All three are mocked so the derived flags,
// selectors, refresh routing and mutation wrappers can be driven directly.
const H = vi.hoisted(() => ({
  auth: {
    value: {
      user: null as any,
      isAuthenticated: false,
    },
  },
  q: {} as Record<string, any>,
  mutateAsync: vi.fn(),
  invalidateQueries: vi.fn(),
  refetchQueries: vi.fn(),
}));

vi.mock("./AuthContext", () => ({ useAuth: () => H.auth.value }));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: H.invalidateQueries,
    refetchQueries: H.refetchQueries,
  }),
}));
vi.mock("../hooks/useQueries", () => {
  const mutation = () => ({ mutateAsync: H.mutateAsync });
  return {
    QUERY_KEYS: new Proxy({}, { get: (_t, p) => [String(p)] }),
    useChildren: () => H.q.useChildren,
    useTransactions: () => H.q.useTransactions,
    useSchoolTransactions: () => H.q.useSchoolTransactions,
    useGlobalTransactions: () => H.q.useGlobalTransactions,
    useNotifications: () => H.q.useNotifications,
    useParentDashboardSummary: () => H.q.useParentDashboardSummary,
    useSchools: () => H.q.useSchools,
    useSchoolStudents: () => H.q.useSchoolStudents,
    usePendingPayments: () => H.q.usePendingPayments,
    useSchoolStats: () => H.q.useSchoolStats,
    usePayInstallment: mutation,
    useMarkNotificationRead: mutation,
    useMarkAllNotificationsRead: mutation,
    useConfirmPayment: mutation,
    useConfirmFirstPayment: mutation,
    useDeclinePayment: mutation,
    useUpdateFee: mutation,
  };
});

let data: ReturnType<typeof useData>;
const Probe = () => {
  data = useData();
  return null;
};

const QUERY_NAMES = [
  "useChildren",
  "useTransactions",
  "useSchoolTransactions",
  "useGlobalTransactions",
  "useNotifications",
  "useParentDashboardSummary",
  "useSchools",
  "useSchoolStudents",
  "usePendingPayments",
  "useSchoolStats",
];

const renderData = (
  auth: Partial<typeof H.auth.value>,
  q: Record<string, any> = {},
) => {
  H.auth.value = {
    user: null,
    isAuthenticated: true,
    ...auth,
  } as any;
  QUERY_NAMES.forEach((n) => (H.q[n] = {}));
  Object.assign(H.q, q);
  render(
    <DataProvider>
      <Probe />
    </DataProvider>,
  );
};

// Every flag is derived from the session's real role — the acting-role
// override that could once make these disagree with `user.role` is gone.
const PARENT = { user: { role: "parent" } };
const OWNER = { user: { role: "owner" } };
const SCHOOL = { user: { role: "school_owner" } };

beforeEach(() => {
  H.mutateAsync.mockReset().mockResolvedValue(undefined);
  H.invalidateQueries.mockReset().mockResolvedValue(undefined);
  H.refetchQueries.mockReset().mockResolvedValue(undefined);
});

describe("DataProvider — role-derived flags & selectors", () => {
  it("resolves parent context and picks parent transactions", () => {
    // The history hooks return a page envelope; the context unwraps `.items`.
    renderData(PARENT as any, {
      useTransactions: { data: { items: [{ id: "t1" }], total: 1, page: 1, totalPages: 1 } },
    });
    expect(data.isParent).toBe(true);
    expect(data.isSchoolContext).toBe(false);
    expect(data.isPlatformOwner).toBe(false);
    expect(data.transactions).toEqual([{ id: "t1" }]);
  });

  it("resolves platform-owner context and picks global transactions", () => {
    renderData(OWNER as any, {
      useGlobalTransactions: {
        data: { items: [{ id: "g1" }], total: 1, page: 1, totalPages: 1 },
      },
    });
    expect(data.isPlatformOwner).toBe(true);
    expect(data.isParent).toBe(false);
    expect(data.transactions).toEqual([{ id: "g1" }]);
    expect(data.allStudents).toEqual([]);
    expect(data.pendingPayments).toEqual([]);
    expect(data.schoolStats).toBeNull();
  });

  it("resolves school context and its data", () => {
    renderData(
      SCHOOL as any,
      {
        useSchoolTransactions: {
          data: { items: [{ id: "s1" }], total: 1, page: 1, totalPages: 1 },
        },
        useSchoolStudents: { data: [{ id: "stu-1" }] },
        usePendingPayments: { data: [{ id: "pend-1" }] },
        useSchoolStats: { data: { totalRevenue: 5 } },
      },
    );
    expect(data.isSchoolContext).toBe(true);
    expect(data.isPlatformOwner).toBe(false);
    expect(data.transactions).toEqual([{ id: "s1" }]);
    expect(data.allStudents).toEqual([{ id: "stu-1" }]);
    expect(data.pendingPayments).toEqual([{ id: "pend-1" }]);
    expect(data.schoolStats).toEqual({ totalRevenue: 5 });
  });

  /*
   * Guards the acting-role removal: a school owner is a school context and
   * ONLY a school context. The old override could label the same session
   * "parent", which flipped this provider into a mixed state the server never
   * recognised.
   */
  it("derives every flag from the session's real role alone", () => {
    renderData(SCHOOL as any);
    expect(data.isSchoolContext).toBe(true);
    expect(data.isParent).toBe(false);
    expect(data.isPlatformOwner).toBe(false);
    expect(data.transactions).toBe(data.schoolTransactions);
  });

  it("falls back to a 'none' context when unauthenticated / role-less", () => {
    renderData({ user: null } as any);
    expect(data.isParent).toBe(false);
    expect(data.isSchoolContext).toBe(false);
    expect(data.isPlatformOwner).toBe(false);
    expect(data.transactions).toBe(data.parentTransactions);
  });
});

describe("DataProvider — loading & error aggregation", () => {
  it("is loading when a core query is loading", () => {
    renderData(PARENT as any, { useChildren: { isLoading: true } });
    expect(data.isLoading).toBe(true);
  });

  it("is loading when a school query is loading in school context", () => {
    renderData(SCHOOL as any, { useSchoolStudents: { isLoading: true } });
    expect(data.isLoading).toBe(true);
  });

  it("is not loading when nothing is in flight", () => {
    renderData(PARENT as any);
    expect(data.isLoading).toBe(false);
  });

  it("has an error when a core query errors", () => {
    renderData(PARENT as any, { useChildren: { isError: true } });
    expect(data.hasError).toBe(true);
  });

  it("has an error when a school query errors in school context", () => {
    renderData(SCHOOL as any, { usePendingPayments: { isError: true } });
    expect(data.hasError).toBe(true);
  });

  it("has no error on a clean load", () => {
    renderData(PARENT as any);
    expect(data.hasError).toBe(false);
  });
});

describe("DataProvider — refresh", () => {
  /**
   * Refresh used to be three hand-maintained key lists, one per role, and the
   * tests here pinned their exact contents. That is the thing that kept
   * breaking: a screen whose key nobody remembered to add (`schools`, `users`,
   * `auditLogs`, `myClassFees`) refreshed nothing, and a test asserting "15
   * invalidations" happily passed while it did. So these assert the property
   * that matters — whatever is mounted gets refetched — and no longer encode a
   * list that can drift from the screens.
   */
  it.each([
    ["parent", PARENT],
    ["school owner", SCHOOL],
    ["platform owner", OWNER],
    ["no role", { user: null }],
  ])("refetches the active queries for %s", async (_label, auth) => {
    renderData(auth as any);
    await act(async () => {
      await data.refreshData();
    });
    expect(H.refetchQueries).toHaveBeenCalledTimes(1);
    expect(H.refetchQueries).toHaveBeenCalledWith(
      { type: "active" },
      { throwOnError: true },
    );
  });

  it("refetches rather than invalidating, so the spinner outlasts the request", async () => {
    // invalidateQueries only marks data stale and resolves once it has, which
    // let the pull-to-refresh spinner stop before any response arrived.
    renderData(PARENT as any);
    await act(async () => {
      await data.refreshData();
    });
    expect(H.invalidateQueries).not.toHaveBeenCalled();
  });

  it("propagates a failed refresh so callers can report it", async () => {
    H.refetchQueries.mockRejectedValueOnce(new Error("network"));
    renderData(PARENT as any);
    await expect(data.refreshData()).rejects.toThrow("network");
  });

  /**
   * Against a REAL QueryClient, not the mock above.
   *
   * The mock resolves or rejects as told, so it cannot see that query-core
   * catches every query failure with `noop` unless `throwOnError` is set —
   * `refetchQueries` resolves on a failed network by default. The mocked test
   * for error propagation passed while the real refresh could not report a
   * failure at all, which is precisely the silent-success this work set out to
   * remove.
   */
  it("rejects on a real failing refetch, not just against the mock", async () => {
    const client = new RealQueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const queryFn = vi.fn().mockResolvedValue("ok");
    const observer = new RealQueryObserver(client, {
      queryKey: ["probe"],
      queryFn,
    });
    const unsubscribe = observer.subscribe(() => {});
    // Wait for the data to LAND, not merely for queryFn to have been called:
    // while the first fetch is still in flight the refetch below joins it and
    // resolves with that success, which hides the very behaviour under test.
    await vi.waitFor(() => expect(client.getQueryData(["probe"])).toBe("ok"));

    queryFn.mockRejectedValue(new Error("network"));

    await expect(
      client.refetchQueries({ type: "active" }, { throwOnError: true }),
    ).rejects.toThrow("network");

    unsubscribe();
  });

  it.each(["refreshParentView", "refreshSchoolView", "refreshOwnerView"])(
    "%s reloads the active screen like refreshData",
    async (name) => {
      renderData(PARENT as any);
      await act(async () => {
        await (data as any)[name]();
      });
      expect(H.refetchQueries).toHaveBeenCalledWith(
      { type: "active" },
      { throwOnError: true },
    );
    },
  );
});

describe("DataProvider — mutation wrappers", () => {
  it("submitPayment maps to the pay-installment payload", async () => {
    renderData(PARENT as any);
    await act(async () => {
      await data.submitPayment("child-1", 500, "rcpt", "idem-2");
    });
    expect(H.mutateAsync).toHaveBeenCalledWith({
      enrollmentId: "child-1",
      amount: 500,
      receiptUrl: "rcpt",
      idempotencyKey: "idem-2",
    });
  });

  it("markNotificationRead forwards the id", async () => {
    renderData(PARENT as any);
    await act(async () => {
      await data.markNotificationRead("n1");
    });
    expect(H.mutateAsync).toHaveBeenCalledWith("n1");
  });

  it("markAllNotificationsRead calls the mutation", async () => {
    renderData(PARENT as any);
    await act(async () => {
      await data.markAllNotificationsRead();
    });
    expect(H.mutateAsync).toHaveBeenCalledTimes(1);
  });

  it("confirmPayment forwards the payment id", async () => {
    renderData(SCHOOL as any);
    await act(async () => {
      await data.confirmPayment("pay-1");
    });
    expect(H.mutateAsync).toHaveBeenCalledWith("pay-1");
  });

  it("confirmFirstPayment forwards the enrollment id", async () => {
    renderData(SCHOOL as any);
    await act(async () => {
      await data.confirmFirstPayment("enr-1");
    });
    expect(H.mutateAsync).toHaveBeenCalledWith("enr-1");
  });

  it("declinePayment forwards the payment id", async () => {
    renderData(SCHOOL as any);
    await act(async () => {
      await data.declinePayment("pay-2");
    });
    expect(H.mutateAsync).toHaveBeenCalledWith("pay-2");
  });

});

describe("DataProvider — context-guard hooks", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("useData throws when used outside a provider", () => {
    const Solo = () => {
      useData();
      return null;
    };
    expect(() => render(<Solo />)).toThrow(
      "useData must be used within a DataProvider",
    );
  });

  it("useParentData returns context in a parent context", () => {
    let pd: any;
    const P = () => {
      pd = useParentData();
      return null;
    };
    H.auth.value = {
      user: { role: "parent" },
      isAuthenticated: true,
    } as any;
    QUERY_NAMES.forEach((n) => (H.q[n] = {}));
    render(
      <DataProvider>
        <P />
      </DataProvider>,
    );
    expect(pd.isParent).toBe(true);
  });

  it("useParentData throws outside a parent context", () => {
    const Bad = () => {
      useParentData();
      return null;
    };
    H.auth.value = {
      user: { role: "owner" },
      isAuthenticated: true,
    } as any;
    QUERY_NAMES.forEach((n) => (H.q[n] = {}));
    expect(() =>
      render(
        <DataProvider>
          <Bad />
        </DataProvider>,
      ),
    ).toThrow("useParentData");
  });

  it("useSchoolData returns context for a platform owner", () => {
    let sd: any;
    const P = () => {
      sd = useSchoolData();
      return null;
    };
    H.auth.value = {
      user: { role: "owner" },
      isAuthenticated: true,
    } as any;
    QUERY_NAMES.forEach((n) => (H.q[n] = {}));
    render(
      <DataProvider>
        <P />
      </DataProvider>,
    );
    expect(sd.isPlatformOwner).toBe(true);
  });

  it("useSchoolData throws in a parent context", () => {
    const Bad = () => {
      useSchoolData();
      return null;
    };
    H.auth.value = {
      user: { role: "parent" },
      isAuthenticated: true,
    } as any;
    QUERY_NAMES.forEach((n) => (H.q[n] = {}));
    expect(() =>
      render(
        <DataProvider>
          <Bad />
        </DataProvider>,
      ),
    ).toThrow("useSchoolData");
  });

  it("useOwnerData throws when not a platform owner", () => {
    const Bad = () => {
      useOwnerData();
      return null;
    };
    H.auth.value = {
      user: { role: "school_owner" },
      isAuthenticated: true,
    } as any;
    QUERY_NAMES.forEach((n) => (H.q[n] = {}));
    expect(() =>
      render(
        <DataProvider>
          <Bad />
        </DataProvider>,
      ),
    ).toThrow("useOwnerData");
  });

  it("useOwnerData returns context for a platform owner", () => {
    let od: any;
    const P = () => {
      od = useOwnerData();
      return null;
    };
    H.auth.value = {
      user: { role: "owner" },
      isAuthenticated: true,
    } as any;
    QUERY_NAMES.forEach((n) => (H.q[n] = {}));
    render(
      <DataProvider>
        <P />
      </DataProvider>,
    );
    expect(od.isPlatformOwner).toBe(true);
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
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
      effectiveRole: null as any,
      activeSchoolId: null as any,
    },
  },
  q: {} as Record<string, any>,
  mutateAsync: vi.fn(),
  invalidateQueries: vi.fn(),
}));

vi.mock("./AuthContext", () => ({ useAuth: () => H.auth.value }));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: H.invalidateQueries }),
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
    effectiveRole: null,
    activeSchoolId: null,
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

const PARENT = { user: { role: "parent" }, effectiveRole: "parent" };
const OWNER = { user: { role: "owner" }, effectiveRole: "owner" };
const SCHOOL = { user: { role: "school_owner" }, effectiveRole: "school_owner" };

beforeEach(() => {
  H.mutateAsync.mockReset().mockResolvedValue(undefined);
  H.invalidateQueries.mockReset().mockResolvedValue(undefined);
});

describe("DataProvider — role-derived flags & selectors", () => {
  it("resolves parent context and picks parent transactions", () => {
    renderData(PARENT as any, { useTransactions: { data: [{ id: "t1" }] } });
    expect(data.isParent).toBe(true);
    expect(data.isSchoolContext).toBe(false);
    expect(data.isPlatformOwner).toBe(false);
    expect(data.transactions).toEqual([{ id: "t1" }]);
  });

  it("resolves platform-owner context and picks global transactions", () => {
    renderData(OWNER as any, {
      useGlobalTransactions: { data: [{ id: "g1" }] },
    });
    expect(data.isPlatformOwner).toBe(true);
    expect(data.isParent).toBe(false);
    expect(data.transactions).toEqual([{ id: "g1" }]);
    expect(data.allStudents).toEqual([]);
    expect(data.pendingPayments).toEqual([]);
    expect(data.schoolStats).toBeNull();
  });

  it("resolves school context (with an active school id) and its data", () => {
    renderData(
      { ...SCHOOL, activeSchoolId: "sch-1" } as any,
      {
        useSchoolTransactions: { data: [{ id: "s1" }] },
        useSchoolStudents: { data: [{ id: "stu-1" }] },
        usePendingPayments: { data: [{ id: "pend-1" }] },
        useSchoolStats: { data: { totalRevenue: 5 } },
      },
    );
    expect(data.isSchoolContext).toBe(true);
    expect(data.transactions).toEqual([{ id: "s1" }]);
    expect(data.allStudents).toEqual([{ id: "stu-1" }]);
    expect(data.pendingPayments).toEqual([{ id: "pend-1" }]);
    expect(data.schoolStats).toEqual({ totalRevenue: 5 });
  });

  it("handles school context without an active school id", () => {
    renderData({ ...SCHOOL, activeSchoolId: null } as any);
    expect(data.isSchoolContext).toBe(true);
    expect(data.isPlatformOwner).toBe(false);
  });

  it("treats a school owner previewing the parent role as both parent and school", () => {
    renderData({
      user: { role: "school_owner" },
      effectiveRole: "parent",
    } as any);
    expect(data.isParent).toBe(true);
    expect(data.isSchoolContext).toBe(true);
    // Not platform owner + is school context → school transactions win.
    expect(data.transactions).toBe(data.schoolTransactions);
  });

  it("falls back to a 'none' context when unauthenticated / role-less", () => {
    renderData({ user: null, effectiveRole: null } as any);
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

describe("DataProvider — refresh routing", () => {
  it("routes refreshData to the owner view (9 invalidations)", async () => {
    renderData(OWNER as any);
    await act(async () => {
      await data.refreshData();
    });
    expect(H.invalidateQueries).toHaveBeenCalledTimes(9);
  });

  it("routes refreshData to the school view (4 invalidations)", async () => {
    renderData(SCHOOL as any);
    await act(async () => {
      await data.refreshData();
    });
    expect(H.invalidateQueries).toHaveBeenCalledTimes(4);
  });

  it("routes refreshData to the parent view (3 invalidations)", async () => {
    renderData(PARENT as any);
    await act(async () => {
      await data.refreshData();
    });
    expect(H.invalidateQueries).toHaveBeenCalledTimes(3);
  });

  it("falls back to a blanket invalidation with no role", async () => {
    renderData({ user: null, effectiveRole: null } as any);
    await act(async () => {
      await data.refreshData();
    });
    expect(H.invalidateQueries).toHaveBeenCalledTimes(1);
    expect(H.invalidateQueries.mock.calls[0]).toHaveLength(0);
  });
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

  it("updateFee forwards class, amount and school id", async () => {
    renderData(SCHOOL as any);
    await act(async () => {
      await data.updateFee("Grade 2", 1000, "sch-9");
    });
    expect(H.mutateAsync).toHaveBeenCalledWith({
      className: "Grade 2",
      feeAmount: 1000,
      schoolId: "sch-9",
    });
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
      effectiveRole: "parent",
      isAuthenticated: true,
      activeSchoolId: null,
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
      effectiveRole: "owner",
      isAuthenticated: true,
      activeSchoolId: null,
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
      effectiveRole: "owner",
      isAuthenticated: true,
      activeSchoolId: null,
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
      effectiveRole: "parent",
      isAuthenticated: true,
      activeSchoolId: null,
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
      effectiveRole: "school_owner",
      isAuthenticated: true,
      activeSchoolId: null,
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
      effectiveRole: "owner",
      isAuthenticated: true,
      activeSchoolId: null,
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

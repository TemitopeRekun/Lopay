/**
 * End-to-end fidelity check for the school-owner dashboard.
 *
 * Renders the real screen through the real DataContext, the real react-query
 * hooks and the real adapters, with ONLY the axios layer replaced by payloads
 * captured from a live backend (scripts/dash-e2e.ts writes the fixture, whose
 * `truth` block is computed straight from Postgres with Prisma).
 *
 * Every assertion compares what the owner SEES against what the database SAYS.
 *
 *   DASH_FIXTURE=/path/to/dash-fixture.json npx vitest run pages/SchoolOwnerDashboard.e2e.test.tsx
 */
import React from "react";
import fs from "fs";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Opt-in: without a captured fixture there is nothing to compare against, so the
// suite skips rather than failing CI.
const FIXTURE_PATH = process.env.DASH_FIXTURE;
const HAS_FIXTURE = !!FIXTURE_PATH && fs.existsSync(FIXTURE_PATH);
const fixture = HAS_FIXTURE
  ? JSON.parse(fs.readFileSync(FIXTURE_PATH as string, "utf8"))
  : {
      schoolId: "",
      api: {
        stats: null,
        students: { items: [], total: 0, page: 1, limit: 50, totalPages: 1 },
        studentsAll: { items: [], total: 0, page: 1, limit: 200, totalPages: 1 },
        pending: [],
        history: [],
        schools: [],
      },
      truth: { students: [] },
    };
const { api, truth, schoolId } = fixture;

const navigate = vi.fn();

/** Page-1-vs-full-roster is served by the same paging helper the app uses. */
const envelopePage = (page: number, limit: number) => {
  const all: any[] = api.studentsAll?.items ?? api.students?.items ?? [];
  const start = (page - 1) * limit;
  return {
    items: all.slice(start, start + limit),
    total: all.length,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(all.length / limit)),
  };
};

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "owner-1",
      name: "Dash Owner",
      role: "school_owner",
      schoolId: fixture.schoolId,
    },
    isAuthenticated: true,
    effectiveRole: "school_owner",
    userRole: "school_owner",
    isOwnerAccount: false,
    activeSchoolId: null,
    setActingRole: vi.fn(),
  }),
}));

const getTransactions = vi.fn(async (_params?: unknown) => api.history);

// The ONLY seam: real HTTP replaced by real captured responses. getAllStudents
// mirrors the shipped implementation (walk the envelope) over fixture pages.
vi.mock("../services/backend", () => ({
  API_URL: "http://localhost:3005",
  apiClient: { get: vi.fn(), post: vi.fn() },
  BackendAPI: {
    school: {
      getStats: vi.fn(async () => api.stats),
      getStudents: vi.fn(async (params?: { page?: number; limit?: number }) =>
        envelopePage(params?.page ?? 1, params?.limit ?? 50),
      ),
      getAllStudents: vi.fn(async () => {
        const items: any[] = [];
        let page = 1;
        let totalPages = 1;
        let total = 0;
        do {
          const body = envelopePage(page, 200);
          items.push(...body.items);
          total = body.total;
          totalPages = body.totalPages;
          page += 1;
        } while (page <= totalPages && page <= 50);
        return { items, total, truncated: items.length < total };
      }),
      getPendingPayments: vi.fn(async () => api.pending),
      getTransactions: (params?: unknown) => getTransactions(params),
    },
    public: { getSchools: vi.fn(async () => api.schools) },
    notifications: { get: vi.fn(async () => []) },
    parent: {
      getChildren: vi.fn(async () => []),
      getHistory: vi.fn(async () => []),
    },
    admin: { getAllTransactions: vi.fn(async () => []) },
  },
}));

vi.mock("../components/Layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../components/BottomNav", () => ({ BottomNav: () => null }));

import { DataProvider } from "../context/DataContext";
import { useUIStore } from "../store/uiStore";
import SchoolOwnerDashboard from "./SchoolOwnerDashboard";

const renderScreen = async () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const utils = render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <DataProvider>
          <SchoolOwnerDashboard />
        </DataProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await waitFor(() =>
    expect(screen.queryByText(/Loading school dashboard/i)).toBeNull(),
  );
  return utils;
};

/** Read the ₦ figure rendered in the same card as a label. */
const naira = (label: RegExp): number => {
  const labelEl = screen.getByText(label);
  const text = labelEl.parentElement?.textContent ?? "";
  const m = text.match(/₦([\d,]+)/);
  return m ? Number(m[1].replace(/,/g, "")) : NaN;
};

beforeEach(() => {
  vi.clearAllMocks();
  getTransactions.mockImplementation(async () => api.history);
});

describe.skipIf(!HAS_FIXTURE)("school-owner dashboard vs database truth", () => {
  it("fixture came from a real backend", () => {
    expect(schoolId).toBeTruthy();
    expect(truth.totalStudents).toBeGreaterThan(0);
  });

  it("School Collections equals confirmed school revenue in the DB", async () => {
    await renderScreen();
    expect(naira(/School Collections/i)).toBe(truth.totalRevenue);
  });

  it("the REGISTERED badge equals the school's enrollment count", async () => {
    await renderScreen();
    const badge = await screen.findByText(/REGISTERED$/);
    expect(Number(badge.textContent!.replace(/\D/g, ""))).toBe(
      truth.totalStudents,
    );
  });

  it("the Student Registry lists every enrolled student, not just page 1", async () => {
    await renderScreen();
    const chip = await screen.findByText(/\d+ Students/);
    expect(Number(chip.textContent!.replace(/\D/g, ""))).toBe(
      truth.totalStudents,
    );
    // The seeded school is deliberately larger than one page.
    expect(truth.totalStudents).toBeGreaterThan(api.students.limit);
  });

  it("does not warn about a partial roster when the roster is complete", async () => {
    await renderScreen();
    expect(screen.queryByText(/roster didn't load fully/i)).toBeNull();
  });

  it("Active Plans equals the count of ACTIVE enrollments", async () => {
    await renderScreen();
    const label = screen.getByText(/Active Plans/i);
    const card = label.parentElement as HTMLElement;
    const value = Number(
      within(card).getByText(/^\d+$/).textContent!.replace(/\D/g, ""),
    );
    expect(value).toBe(truth.activeCount);
  });

  it("Fee Arrears equals the DB's defaulted outstanding balance", async () => {
    await renderScreen();
    expect(naira(/Fee Arrears/i)).toBe(truth.defaultedAmount);
  });

  it("'Pending approvals' equals money actually awaiting approval", async () => {
    await renderScreen();
    const card = screen.getByText(/Pending approvals/i)
      .parentElement as HTMLElement;
    const shown = Number(
      (card.textContent!.match(/₦([\d,]+)/) ?? [])[1]?.replace(/,/g, ""),
    );
    expect(shown).toBe(truth.pendingRevenue);
  });

  it("rejected and reversed money is excluded from 'Pending approvals'", async () => {
    // The fixture is seeded with a rejected and a reversed payment, so the
    // unfiltered definition is strictly larger. If these ever coincide the
    // assertion below would pass vacuously.
    expect(truth.unconfirmedAnyStatus).toBeGreaterThan(truth.pendingRevenue);
    await renderScreen();
    const card = screen.getByText(/Pending approvals/i)
      .parentElement as HTMLElement;
    const shown = Number(
      (card.textContent!.match(/₦([\d,]+)/) ?? [])[1]?.replace(/,/g, ""),
    );
    expect(shown).not.toBe(truth.unconfirmedAnyStatus);
  });

  it("first payments awaiting activation are shown apart from approvals", async () => {
    expect(truth.awaitingActivation).toBeGreaterThan(0);
    await renderScreen();
    const row = screen.getByText(/Awaiting platform activation/i)
      .parentElement as HTMLElement;
    const shown = Number(
      (row.textContent!.match(/₦([\d,]+)/) ?? [])[1]?.replace(/,/g, ""),
    );
    expect(shown).toBe(truth.awaitingActivation);
  });

  it("the Verify Payments badge equals the pending approval queue length", async () => {
    await renderScreen();
    const badge = screen.queryByText(/\d+ New/);
    const shown = badge ? Number(badge.textContent!.replace(/\D/g, "")) : 0;
    expect(shown).toBe(api.pending.length);
    expect(shown).toBe(truth.pendingInstallments);
  });

  it("per-student outstanding matches the enrollment's own balance", async () => {
    const { container } = await renderScreen();
    const defaulted = truth.students.find(
      (s: any) => s.paymentStatus === "DEFAULTED" && s.remainingBalance > 0,
    );
    expect(defaulted).toBeTruthy();
    // The roster card that names this student — PlanCard renders the balance
    // in a sibling block, so walk up to the whole card.
    const card = Array.from(container.querySelectorAll("div")).find(
      (el) =>
        el.textContent?.includes(defaulted.name) &&
        el.textContent?.includes("Balance"),
    );
    expect(card).toBeTruthy();
    expect(card!.textContent).toContain(
      `₦${defaulted.remainingBalance.toLocaleString()}`,
    );
    // And it is NOT the lossy derivation, which is short by the platform fee.
    const apiRow = (api.studentsAll.items as any[]).find(
      (s) => s.studentName === defaulted.name,
    )!;
    expect(defaulted.remainingBalance - (apiRow.totalFee - apiRow.paidAmount)).toBe(
      defaulted.platformFee,
    );
  });

  it("recent transactions come from the school's payment history", async () => {
    await renderScreen();
    expect(api.history.length).toBeGreaterThan(0);
    const firstChild = api.history[0].childName;
    const hits = await screen.findAllByText(new RegExp(firstChild, "i"));
    expect(hits.length).toBeGreaterThan(0);
  });

  it("Download Collection Ledger fetches the chosen month and writes a file", async () => {
    await renderScreen();
    const createObjectURL = vi.fn(() => "blob:mock");
    (URL as any).createObjectURL = createObjectURL;
    (URL as any).revokeObjectURL = vi.fn();
    const anchorClicks: string[] = [];
    const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      anchorClicks.push(this.download || this.href);
    };

    const btn = screen.getByRole("button", {
      name: /DOWNLOAD COLLECTION LEDGER/i,
    });
    btn.click();

    await waitFor(() => expect(anchorClicks.length).toBeGreaterThan(0));
    HTMLAnchorElement.prototype.click = origClick;

    // The export is scoped to the selected month, not "everything". (The
    // dashboard's own transactions query also calls getTransactions, with no
    // arguments — the export is the call that carries a window.)
    const exportCall = getTransactions.mock.calls.find(
      (c) => (c[0] as { from?: string } | undefined)?.from,
    );
    expect(exportCall).toBeTruthy();
    const params = exportCall![0] as { from: string; to: string; take: number };
    expect(params.from).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(new Date(params.to).getTime()).toBeGreaterThan(
      new Date(params.from).getTime(),
    );
    expect(createObjectURL).toHaveBeenCalled();
    expect(anchorClicks[0]).toMatch(/\.csv$/);
  });

  it("reports an empty month instead of claiming a successful export", async () => {
    getTransactions.mockImplementation(async () => []);
    await renderScreen();
    const createObjectURL = vi.fn(() => "blob:mock");
    (URL as any).createObjectURL = createObjectURL;
    useUIStore.setState({ toasts: [] });

    const btn = screen.getByRole("button", {
      name: /DOWNLOAD COLLECTION LEDGER/i,
    });
    btn.click();

    // Layout (and with it the toast host) is stubbed out here, so assert on the
    // store the screen actually writes to.
    await waitFor(() =>
      expect(
        useUIStore
          .getState()
          .toasts.some((t) => /No payments recorded for/i.test(t.message)),
      ).toBe(true),
    );
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});

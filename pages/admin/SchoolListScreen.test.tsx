import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SchoolListScreen from "./SchoolListScreen";
import { BackendAPI } from "../../services/backend";

/**
 * The payout column exists because our own `paystackSubaccountActive` flag lied:
 * it records that a payout account was created ONCE, not that it exists on the
 * Paystack integration the current keys belong to. A school onboarded in test
 * mode therefore looked perfectly healthy after the switch to live keys, and the
 * mismatch only surfaced when a parent's card was refused at checkout.
 *
 * These tests pin the two things that make the column trustworthy: a broken
 * school is visibly broken and repairable, and an unreachable Paystack is NOT
 * reported as broken.
 */
vi.mock("../../services/backend", () => ({
  BackendAPI: {
    public: { getSchools: vi.fn() },
    admin: {
      getSchoolsPayoutStatus: vi.fn(),
      createSubaccount: vi.fn(),
      deleteSchool: vi.fn(),
    },
  },
}));

vi.mock("../../components/Layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../../components/Header", () => ({
  Header: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

const showToast = vi.fn();
vi.mock("../../store/uiStore", () => ({
  useUIStore: () => ({ showToast }),
}));

const api = BackendAPI as unknown as {
  public: { getSchools: ReturnType<typeof vi.fn> };
  admin: {
    getSchoolsPayoutStatus: ReturnType<typeof vi.fn>;
    createSubaccount: ReturnType<typeof vi.fn>;
    deleteSchool: ReturnType<typeof vi.fn>;
  };
};

const SCHOOLS = [{ id: "s1", name: "Febison Montessori" }];

const status = (over: Record<string, unknown> = {}) => ({
  schoolId: "s1",
  schoolName: "Febison Montessori",
  subaccountCode: "ACCT_test",
  storedActive: true,
  canRetry: true,
  state: "NOT_ON_INTEGRATION",
  detail: "This payout account does not exist on the Paystack integration…",
  ...over,
});

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SchoolListScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SchoolListScreen — payout health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.public.getSchools.mockResolvedValue(SCHOOLS);
    api.admin.getSchoolsPayoutStatus.mockResolvedValue([status()]);
  });

  it("flags a school whose payout account is not on this integration", async () => {
    renderScreen();
    expect(await screen.findByText(/payout account invalid/i)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /set up payouts/i }),
    ).toBeTruthy();
  });

  it("says nothing at all when payouts are healthy", async () => {
    api.admin.getSchoolsPayoutStatus.mockResolvedValue([
      status({ state: "ACTIVE", detail: "Verified against Paystack." }),
    ]);
    renderScreen();

    // The school still lists; only the warning is absent. A tick on every row
    // would train admins to stop reading the column.
    expect(await screen.findByText("Febison Montessori")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /set up payouts/i })).toBeNull();
  });

  /*
   * An outage is not a verdict. Offering "set up payouts" here would have an
   * admin replace a healthy school's payout account and orphan the real one.
   */
  it("shows UNKNOWN as a caution and offers no repair button", async () => {
    api.admin.getSchoolsPayoutStatus.mockResolvedValue([
      status({ state: "UNKNOWN", detail: "Could not reach Paystack." }),
    ]);
    renderScreen();

    expect(await screen.findByText(/payout status unknown/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /set up payouts/i })).toBeNull();
  });

  it("offers no repair button when there is no settlement bank to use", async () => {
    api.admin.getSchoolsPayoutStatus.mockResolvedValue([
      status({
        state: "MISSING",
        subaccountCode: null,
        canRetry: false,
        detail: "No settlement bank on file…",
      }),
    ]);
    renderScreen();

    expect(await screen.findByText(/payouts not set up/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /set up payouts/i })).toBeNull();
  });

  it("repairs the payout account and reports what actually happened", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    api.admin.createSubaccount.mockResolvedValue({
      subaccountCode: "ACCT_live",
      active: true,
      created: true,
    });
    renderScreen();

    await userEvent.click(
      await screen.findByRole("button", { name: /set up payouts/i }),
    );

    // React Query v5 hands the mutationFn a context object as a second argument,
    // so assert on the school id rather than the whole call signature.
    await waitFor(() =>
      expect(api.admin.createSubaccount.mock.calls[0]?.[0]).toBe("s1"),
    );
    expect(showToast).toHaveBeenCalledWith(
      expect.stringMatching(/payout account created/i),
      "success",
    );
  });

  /*
   * The endpoint is idempotent, so a second press is a no-op — the toast has to
   * say so rather than claim a creation that did not happen.
   */
  it("says nothing was changed when the account was already valid", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    api.admin.createSubaccount.mockResolvedValue({
      subaccountCode: "ACCT_live",
      active: true,
      created: false,
    });
    renderScreen();

    await userEvent.click(
      await screen.findByRole("button", { name: /set up payouts/i }),
    );

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.stringMatching(/already had a valid payout account/i),
        "success",
      ),
    );
  });

  it("does not touch Paystack when the admin cancels the confirm", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderScreen();

    await userEvent.click(
      await screen.findByRole("button", { name: /set up payouts/i }),
    );

    expect(api.admin.createSubaccount).not.toHaveBeenCalled();
  });

  it("surfaces the server's reason when repair fails", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    api.admin.createSubaccount.mockRejectedValue({
      response: { data: { message: "No bank code on file" } },
    });
    renderScreen();

    await userEvent.click(
      await screen.findByRole("button", { name: /set up payouts/i }),
    );

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.stringMatching(/No bank code on file/),
        "error",
      ),
    );
  });
});

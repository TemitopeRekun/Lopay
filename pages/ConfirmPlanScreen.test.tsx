import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ConfirmPlanScreen from "./ConfirmPlanScreen";
import { BackendAPI } from "../services/backend";
import { openPaystackPopup } from "../services/paystack";

const navigate = vi.fn();
const showToast = vi.fn();
const updateUser = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("../services/backend", () => ({
  BackendAPI: {
    public: { calculatePaymentPlan: vi.fn() },
    parent: {
      initiateFirstPayment: vi.fn(),
      verifyPaystack: vi.fn(),
    },
  },
}));

vi.mock("../services/paystack", () => ({ openPaystackPopup: vi.fn() }));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: { name: "Ada", phoneNumber: "+2348012345678" },
    updateUser,
  }),
}));

vi.mock("../store/uiStore", () => ({
  useUIStore: () => ({ showToast }),
}));

vi.mock("../components/Layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const api = BackendAPI as unknown as {
  public: { calculatePaymentPlan: ReturnType<typeof vi.fn> };
  parent: {
    initiateFirstPayment: ReturnType<typeof vi.fn>;
    verifyPaystack: ReturnType<typeof vi.fn>;
  };
};
const popup = openPaystackPopup as unknown as ReturnType<typeof vi.fn>;

/** ₦100,000 fee: 2.5% platform fee, 25% deposit → ₦27,500 minimum. */
const CALCULATION = {
  originalAmount: 100_000,
  platformFeeAmount: 2_500,
  totalPayable: 102_500,
  depositAmount: 25_000,
  totalInitialPayment: 27_500,
  depositPercentage: 0.25,
  remainingBalance: 75_000,
  platformFeePercentage: 0.025,
  plans: [],
};

/** What the dashboard sends on a first-payment retry: no money figures at all. */
const RETRY_STATE = {
  childName: "Ada Lovelace",
  schoolName: "Acme School",
  grade: "JSS1",
  totalFee: 100_000,
  feeType: "Session" as const,
  schoolId: "school-1",
  plan: {
    type: "Monthly" as const,
    amount: 100_000,
    frequencyLabel: "Monthly",
    numberOfPayments: 3,
  },
};

/** What the calculator screen sends: figures already resolved. */
const CALCULATED_STATE = {
  ...RETRY_STATE,
  depositAmount: 25_000,
  platformFeeAmount: 2_500,
  totalInitialPayment: 27_500,
};

const renderScreen = (state: Record<string, unknown>) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[{ pathname: "/confirm-plan", state }]}>
        <Routes>
          <Route path="/confirm-plan" element={<ConfirmPlanScreen />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const amountBox = () => screen.getByRole("spinbutton");

beforeEach(() => {
  vi.clearAllMocks();
  api.public.calculatePaymentPlan.mockResolvedValue(CALCULATION);
  api.parent.initiateFirstPayment.mockResolvedValue({
    reference: "ref-1",
    accessCode: "ac-1",
  });
  popup.mockResolvedValue("success");
});

/**
 * This screen no longer verifies. It charges and hands the reference to
 * /payment-status, which asks the server for the verdict — so a stubbed
 * verifyPaystack here would only describe behaviour that no longer exists.
 */
it("does not verify inline — the result screen owns the outcome", async () => {
  const user = userEvent.setup();
  renderScreen(CALCULATED_STATE);
  await waitFor(() => expect(amountBox()).toHaveValue(27500));

  await user.click(screen.getByRole("button", { name: /with Paystack/ }));

  await waitFor(() => expect(navigate).toHaveBeenCalled());
  expect(api.parent.verifyPaystack).not.toHaveBeenCalled();
});

describe("ConfirmPlanScreen — figures come from the backend", () => {
  it("does not call the calculator when the figures were handed over", async () => {
    renderScreen(CALCULATED_STATE);

    await waitFor(() => expect(amountBox()).toHaveValue(27500));
    expect(api.public.calculatePaymentPlan).not.toHaveBeenCalled();
  });

  it("fetches them when they are missing (first-payment retry)", async () => {
    renderScreen(RETRY_STATE);

    await waitFor(() =>
      expect(api.public.calculatePaymentPlan).toHaveBeenCalledWith({
        schoolId: "school-1",
        totalAmount: 100_000,
        feeType: "Session",
        grade: "JSS1",
      }),
    );
  });

  it("shows the server's platform fee on a retry rather than ₦0.00", async () => {
    // The dashboard used to pass platformFeeAmount: 0, so the split card claimed
    // the whole payment went to the school and no platform fee was taken.
    renderScreen(RETRY_STATE);

    await waitFor(() => expect(amountBox()).toHaveValue(27500));
    expect(screen.getByText("₦2,500.00")).toBeInTheDocument();
    // To school = 27,500 − 2,500.
    expect(screen.getByText("₦25,000.00")).toBeInTheDocument();
  });

  it("states the true balance after payment on a retry", async () => {
    // With a ₦0 platform fee the balance was understated by exactly that fee:
    // 100,000 − 27,500 = 72,500 instead of the real 75,000.
    renderScreen(RETRY_STATE);

    await waitFor(() => expect(amountBox()).toHaveValue(27500));
    expect(screen.getByText("₦75,000.00")).toBeInTheDocument();
    expect(screen.queryByText("₦72,500.00")).not.toBeInTheDocument();
  });

  it("seeds the minimum, never ₦0, when no prior attempt is known", async () => {
    renderScreen(RETRY_STATE);

    await waitFor(() => expect(amountBox()).toHaveValue(27500));
    expect(
      screen.getByRole("button", { name: /Pay ₦27,500\.00 with Paystack/ }),
    ).toBeEnabled();
  });

  it("prefills a prior attempt when it is within bounds", async () => {
    renderScreen({ ...RETRY_STATE, suggestedFirstPayment: 40_000 });

    await waitFor(() => expect(amountBox()).toHaveValue(40000));
  });

  it("ignores a prior attempt that the server would now reject", async () => {
    renderScreen({ ...RETRY_STATE, suggestedFirstPayment: 1_000 });

    await waitFor(() => expect(amountBox()).toHaveValue(27500));
  });

  it("waits rather than rendering a guessed breakdown", () => {
    api.public.calculatePaymentPlan.mockReturnValue(new Promise(() => {}));
    renderScreen(RETRY_STATE);

    expect(screen.getByText(/Loading your payment details/)).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("says so when the figures cannot be loaded", async () => {
    api.public.calculatePaymentPlan.mockRejectedValue(new Error("down"));
    renderScreen(RETRY_STATE);

    await waitFor(() =>
      expect(
        screen.getByText(/couldn't load this school's payment details/i),
      ).toBeInTheDocument(),
    );
    expect(api.parent.initiateFirstPayment).not.toHaveBeenCalled();
  });
});

describe("ConfirmPlanScreen — amount bounds", () => {
  it("rejects less than the minimum", async () => {
    const user = userEvent.setup();
    renderScreen(CALCULATED_STATE);
    await waitFor(() => expect(amountBox()).toHaveValue(27500));

    await user.clear(amountBox());
    await user.type(amountBox(), "1000");

    expect(
      screen.getByText("Minimum first payment is ₦27,500.00"),
    ).toBeInTheDocument();
  });

  it("rejects more than the full fee plus the platform fee", async () => {
    const user = userEvent.setup();
    renderScreen(CALCULATED_STATE);
    await waitFor(() => expect(amountBox()).toHaveValue(27500));

    await user.clear(amountBox());
    await user.type(amountBox(), "200000");

    expect(
      screen.getByText("Maximum first payment is ₦102,500.00"),
    ).toBeInTheDocument();
  });

  it("accepts the full fee via the preset", async () => {
    const user = userEvent.setup();
    renderScreen(CALCULATED_STATE);
    await waitFor(() => expect(amountBox()).toHaveValue(27500));

    await user.click(screen.getByRole("button", { name: "Full fee" }));

    expect(amountBox()).toHaveValue(102500);
    expect(screen.getByText("Paid in full 🎉")).toBeInTheDocument();
  });
});

describe("ConfirmPlanScreen — charging", () => {
  /**
   * This screen no longer decides the outcome. It charges, then hands the
   * reference to /payment-status, which asks the server (that call reconciles
   * with Paystack) and renders the verdict. Verifying inline made a
   * three-second toast the entire confirmation for a payment of tens of
   * thousands of naira, and put the "did this work?" decision in the client.
   */
  it("sends the entered amount, then routes to the result screen", async () => {
    const user = userEvent.setup();
    renderScreen(CALCULATED_STATE);
    await waitFor(() => expect(amountBox()).toHaveValue(27500));

    await user.click(screen.getByRole("button", { name: /with Paystack/ }));

    await waitFor(() =>
      expect(api.parent.initiateFirstPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          schoolId: "school-1",
          className: "JSS1",
          installmentFrequency: "MONTHLY",
          firstPaymentPaid: 27_500,
        }),
      ),
    );
    expect(popup).toHaveBeenCalledWith("ac-1");
    // `replace` so the back button cannot return to a checkout screen whose
    // transaction has already been consumed.
    expect(navigate).toHaveBeenCalledWith(
      "/payment-status",
      expect.objectContaining({
        replace: true,
        state: expect.objectContaining({ reference: "ref-1" }),
      }),
    );
  });

  it("reuses one idempotency key across retries of the same intent", async () => {
    const user = userEvent.setup();
    api.parent.initiateFirstPayment
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ reference: "ref-1", accessCode: "ac-1" });
    renderScreen(CALCULATED_STATE);
    await waitFor(() => expect(amountBox()).toHaveValue(27500));

    await user.click(screen.getByRole("button", { name: /with Paystack/ }));
    await waitFor(() => expect(showToast).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: /with Paystack/ }));

    await waitFor(() =>
      expect(api.parent.initiateFirstPayment).toHaveBeenCalledTimes(2),
    );
    const [first] = api.parent.initiateFirstPayment.mock.calls[0];
    const [second] = api.parent.initiateFirstPayment.mock.calls[1];
    expect(first.idempotencyKey).toBe(second.idempotencyKey);
  });

  /**
   * A cancelled popup is the one outcome with no server-side row to read — no
   * charge was ever attempted — so it is the only one the client labels itself,
   * passed through as navigation state rather than fetched.
   */
  it("does not claim success when the popup was cancelled", async () => {
    const user = userEvent.setup();
    popup.mockResolvedValue("cancelled");
    renderScreen(CALCULATED_STATE);
    await waitFor(() => expect(amountBox()).toHaveValue(27500));

    await user.click(screen.getByRole("button", { name: /with Paystack/ }));

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(
        "/payment-status",
        expect.objectContaining({
          state: expect.objectContaining({ outcome: "cancelled" }),
        }),
      ),
    );
    // No reference is handed over, so the result screen cannot report a charge
    // that never happened as processing.
    const [, options] = navigate.mock.calls[0];
    expect(options.state.reference).toBeUndefined();
  });

  /**
   * "Try again" must land on a fully-populated checkout, not a blank one. The
   * fresh mount also mints a new idempotency key, which is what makes the retry
   * a real second charge rather than a replay of the dead one.
   */
  it("carries the checkout state through for a retry", async () => {
    const user = userEvent.setup();
    popup.mockResolvedValue("cancelled");
    renderScreen(CALCULATED_STATE);
    await waitFor(() => expect(amountBox()).toHaveValue(27500));

    await user.click(screen.getByRole("button", { name: /with Paystack/ }));

    await waitFor(() => expect(navigate).toHaveBeenCalled());
    const [, options] = navigate.mock.calls[0];
    expect(options.state.retryTo).toBe("/confirm-plan");
    expect(options.state.retryState).toEqual(
      expect.objectContaining({ schoolId: "school-1" }),
    );
  });

  it("surfaces a server rejection verbatim", async () => {
    const user = userEvent.setup();
    api.parent.initiateFirstPayment.mockRejectedValue({
      response: { data: { message: "Deposit is below minimum required." } },
    });
    renderScreen(CALCULATED_STATE);
    await waitFor(() => expect(amountBox()).toHaveValue(27500));

    await user.click(screen.getByRole("button", { name: /with Paystack/ }));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        "Payment Failed: Deposit is below minimum required.",
        "error",
      ),
    );
  });
});

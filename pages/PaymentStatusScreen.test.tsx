import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import PaymentStatusScreen from "./PaymentStatusScreen";

const navigate = vi.fn();
const showToast = vi.fn();

/** What usePaymentOutcome resolves to, and the locator it was called with. */
let outcomeQuery: {
  data?: unknown;
  isLoading?: boolean;
  isError?: boolean;
  isFetching?: boolean;
};
let queriedLocator: unknown;
const refetch = vi.fn();

let routerState: unknown = {};

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return {
    ...actual,
    useNavigate: () => navigate,
    useLocation: () => ({ state: routerState }),
  };
});

vi.mock("../store/uiStore", () => ({
  useUIStore: () => ({ showToast }),
}));

vi.mock("../hooks/useQueries", () => ({
  usePaymentOutcome: (locator: unknown) => {
    queriedLocator = locator;
    return { refetch, ...outcomeQuery };
  },
}));

vi.mock("../components/Layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../components/Header", () => ({
  Header: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

const SUCCEEDED = {
  state: "succeeded",
  paymentType: "FIRST_PAYMENT",
  amount: 27_500,
  reference: "lopay_abc123",
  childName: "Ada Lovelace",
  schoolName: "Sunrise Academy",
  className: "JSS1",
  reason: null,
  enrollmentStatus: "ACTIVE",
  remainingBalance: 72_500,
  nextInstallmentAmount: 24_166,
  nextDueDate: "2026-09-03",
};

const renderScreen = () =>
  render(
    <MemoryRouter>
      <PaymentStatusScreen />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  routerState = { reference: "lopay_abc123" };
  outcomeQuery = { data: SUCCEEDED };
  queriedLocator = undefined;
});

describe("PaymentStatusScreen", () => {
  describe("success", () => {
    it("shows the amount, who it was for, and what happens next", async () => {
      renderScreen();

      expect(screen.getByText("Payment Successful")).toBeInTheDocument();
      expect(screen.getByText("₦27,500.00")).toBeInTheDocument();
      expect(
        screen.getByText(/Ada Lovelace · JSS1 · Sunrise Academy/),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/enrollment is now active/i),
      ).toBeInTheDocument();
    });

    it("shows the plan state the payment produced", () => {
      renderScreen();
      expect(screen.getByText("₦72,500.00")).toBeInTheDocument();
      expect(screen.getByText(/₦24,166.00/)).toBeInTheDocument();
      expect(screen.getByText(/due 2026-09-03/)).toBeInTheDocument();
    });

    /**
     * The reference is what support asks for. It was previously shown nowhere
     * in the app, so a parent reporting "I paid and it didn't work" had nothing
     * to quote.
     */
    it("copies the reference", async () => {
      // Spy on the stub userEvent.setup() installs rather than replacing it:
      // it defines `navigator.clipboard` as a getter-only property.
      const user = userEvent.setup();
      const writeText = vi
        .spyOn(navigator.clipboard, "writeText")
        .mockResolvedValue(undefined);
      renderScreen();

      await user.click(screen.getByText("lopay_abc123"));

      await waitFor(() =>
        expect(writeText).toHaveBeenCalledWith("lopay_abc123"),
      );
      expect(showToast).toHaveBeenCalledWith("Reference copied.", "success");
    });

    it("goes back to the dashboard", async () => {
      const user = userEvent.setup();
      renderScreen();

      await user.click(screen.getByRole("button", { name: /go to dashboard/i }));

      expect(navigate).toHaveBeenCalledWith("/dashboard", { replace: true });
    });

    it("offers no retry for a payment that worked", () => {
      renderScreen();
      expect(
        screen.queryByRole("button", { name: /try again/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("failure", () => {
    /**
     * Without the gateway's own words a decline reads "Payment failed. Please
     * try again" — advice that produces an identical decline every time for a
     * blocked card.
     */
    it("shows the bank's reason for the decline", () => {
      outcomeQuery = {
        data: { ...SUCCEEDED, state: "failed", reason: "Insufficient funds" },
      };
      renderScreen();

      expect(screen.getByText("Payment Failed")).toBeInTheDocument();
      expect(screen.getByText("Insufficient funds")).toBeInTheDocument();
      expect(screen.getByText(/no money has left your account/i)).toBeInTheDocument();
    });

    it("retries into the screen that charged, carrying its state", async () => {
      routerState = {
        reference: "lopay_abc123",
        retryTo: "/confirm-plan",
        retryState: { schoolId: "school-1" },
      };
      outcomeQuery = { data: { ...SUCCEEDED, state: "failed" } };
      const user = userEvent.setup();
      renderScreen();

      await user.click(screen.getByRole("button", { name: /try again/i }));

      expect(navigate).toHaveBeenCalledWith("/confirm-plan", {
        replace: true,
        state: { schoolId: "school-1" },
      });
    });
  });

  describe("processing", () => {
    it("tells an installment payer the school still has to confirm", () => {
      outcomeQuery = {
        data: {
          ...SUCCEEDED,
          state: "processing",
          paymentType: "INSTALLMENT",
        },
      };
      renderScreen();

      expect(screen.getByText("Payment Processing")).toBeInTheDocument();
      expect(screen.getByText(/school will review your receipt/i)).toBeInTheDocument();
    });

    it("does not tell a card payer their charge failed", () => {
      outcomeQuery = { data: { ...SUCCEEDED, state: "processing" } };
      renderScreen();

      expect(screen.queryByText("Payment Failed")).not.toBeInTheDocument();
      expect(screen.getByText(/completes automatically/i)).toBeInTheDocument();
    });
  });

  describe("cancelled", () => {
    /**
     * The only outcome the client owns: no charge was attempted, so there is no
     * payment row to read and the screen must not query for one.
     */
    it("reports a closed popup without querying the server", () => {
      routerState = { outcome: "cancelled", retryTo: "/confirm-plan" };
      outcomeQuery = { data: undefined };
      renderScreen();

      expect(screen.getByText("Payment Cancelled")).toBeInTheDocument();
      expect(screen.getByText(/nothing was charged/i)).toBeInTheDocument();
      expect(queriedLocator).toEqual({});
    });
  });

  describe("when the lookup itself fails", () => {
    /**
     * A failed LOOKUP is not a failed PAYMENT. The charge has very likely gone
     * through and the webhook will settle it regardless of what this screen can
     * reach — showing "failed" here would push the parent into paying twice.
     */
    it("never reports it as a failed payment", async () => {
      outcomeQuery = { isError: true };
      const user = userEvent.setup();
      renderScreen();

      expect(screen.queryByText("Payment Failed")).not.toBeInTheDocument();
      expect(screen.getByText(/doesn't mean it failed/i)).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /check again/i }));
      expect(refetch).toHaveBeenCalled();
    });
  });

  describe("opened without a payment to show", () => {
    it("explains itself instead of spinning forever", () => {
      routerState = {};
      outcomeQuery = { data: undefined };
      renderScreen();

      expect(screen.getByText(/no payment to show/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /go to dashboard/i }),
      ).toBeInTheDocument();
    });
  });

  describe("while confirming", () => {
    it("shows the amount it already knows rather than a blank spinner", () => {
      outcomeQuery = { isLoading: true };
      routerState = {
        reference: "lopay_abc123",
        fallbackAmount: 27_500,
        fallbackChildName: "Ada Lovelace",
      };
      renderScreen();

      expect(screen.getByText(/confirming your payment/i)).toBeInTheDocument();
      expect(screen.getByText(/₦27,500.00 · Ada Lovelace/)).toBeInTheDocument();
    });
  });
});

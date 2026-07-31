import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PaymentMethodsScreen from "./PaymentMethodsScreen";
import type { Child } from "../types";

const navigate = vi.fn();
const showToast = vi.fn();
const submitPayment = vi.fn();
const childrenData: Child[] = [];
let bankDetails: Record<string, string> | null = null;
let bankQueryState = { isLoading: false, isError: false };

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("../context/DataContext", () => ({
  useData: () => ({
    submitPayment,
    childrenData,
    schools: [{ id: "school-1", name: "Acme School" }],
  }),
}));

vi.mock("../store/uiStore", () => ({
  useUIStore: () => ({ showToast }),
}));

vi.mock("../hooks/useQueries", () => ({
  useSchoolBankDetails: () => ({
    data: bankDetails,
    isLoading: bankQueryState.isLoading,
    isError: bankQueryState.isError,
  }),
}));

vi.mock("../services/backend", () => ({
  BackendAPI: {
    documents: { receipts: { createUploadUrl: vi.fn() } },
  },
}));

vi.mock("../services/native", () => ({
  NativeBridge: { isNative: () => false },
}));

vi.mock("../components/Layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const child: Child = {
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
  payments: [],
} as Child;

const INSTALLMENT_STATE = {
  paymentType: "installment",
  amount: 25_000,
  childId: "enr-1",
  allowCustom: true,
};

const renderScreen = (state: Record<string, unknown> | null) =>
  render(
    <MemoryRouter
      initialEntries={[{ pathname: "/payment-methods", state: state ?? undefined }]}
    >
      <Routes>
        <Route path="/payment-methods" element={<PaymentMethodsScreen />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  childrenData.length = 0;
  childrenData.push(child);
  bankDetails = {
    bankName: "Acme Bank",
    accountName: "Acme School",
    accountNumber: "0123456789",
  };
  bankQueryState = { isLoading: false, isError: false };
  vi.clearAllMocks();
});

describe("PaymentMethodsScreen — destination account", () => {
  it("shows the school's own account, from the server", () => {
    renderScreen(INSTALLMENT_STATE);

    expect(screen.getByText("0123456789")).toBeInTheDocument();
    expect(screen.getAllByText(/Acme Bank/).length).toBeGreaterThan(0);
  });

  it("never shows the platform's own account number", () => {
    // A hardcoded Moniepoint account (9090390581) used to be rendered here as the
    // destination for a manual first-payment transfer — a flow the backend removed.
    renderScreen(INSTALLMENT_STATE);

    expect(screen.queryByText("9090390581")).not.toBeInTheDocument();
    expect(screen.queryByText(/Moniepoint/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Lopay Activation Hub/)).not.toBeInTheDocument();
  });

  it("says so when the school has published no bank details", () => {
    bankDetails = null;
    renderScreen(INSTALLMENT_STATE);

    expect(
      screen.getByText(/has not published its bank details/),
    ).toBeInTheDocument();
  });

  it("reports a failure to load them", () => {
    bankDetails = null;
    bankQueryState = { isLoading: false, isError: true };
    renderScreen(INSTALLMENT_STATE);

    expect(
      screen.getByText(/Unable to load this school’s bank details/),
    ).toBeInTheDocument();
  });
});

describe("PaymentMethodsScreen — arriving without an enrollment", () => {
  it("does not render a form it cannot submit", () => {
    // Reached directly (a bookmarked URL), this used to render the platform bank
    // details and a receipt uploader whose submit only ever toasted an error.
    bankDetails = null;
    renderScreen(null);

    expect(
      screen.getByText(/Choose a plan from your dashboard/),
    ).toBeInTheDocument();
    expect(screen.queryByText("0123456789")).not.toBeInTheDocument();
  });

  it("offers a way back to the dashboard", async () => {
    const user = userEvent.setup();
    bankDetails = null;
    renderScreen(null);

    await user.click(screen.getByRole("button", { name: /Go to dashboard/ }));

    expect(navigate).toHaveBeenCalledWith("/dashboard");
  });
});

describe("PaymentMethodsScreen — submitting", () => {
  it("refuses to submit without a receipt", async () => {
    const user = userEvent.setup();
    renderScreen(INSTALLMENT_STATE);

    await user.click(
      screen.getByRole("button", { name: /I have made this transfer/i }),
    );

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        "Please upload a payment receipt before submitting.",
        "error",
      ),
    );
    expect(submitPayment).not.toHaveBeenCalled();
  });
});

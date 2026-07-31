import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import HistoryScreen from "./HistoryScreen";
import type { Transaction } from "../types";

const transactions: Transaction[] = [];
let role = "parent";

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ role }),
}));

vi.mock("../context/DataContext", () => ({
  useData: () => ({ transactions }),
}));

vi.mock("../components/Layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../components/BottomNav", () => ({
  BottomNav: () => null,
}));

const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: "t1",
  userId: "",
  childName: "Ada Lovelace",
  schoolName: "Acme School",
  amount: 25_000,
  date: "2026-06-15T14:35:00.000Z",
  status: "Successful",
  type: "INSTALLMENT",
  ...over,
});

const renderScreen = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <HistoryScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  transactions.length = 0;
  role = "parent";
});

describe("HistoryScreen — dates", () => {
  it("never shows the raw ISO timestamp the API returns", () => {
    // `{t.date}` was rendered verbatim, so a parent read
    // "2026-06-15T14:35:00.000Z" as the date of their payment.
    transactions.push(tx());
    renderScreen();

    expect(screen.queryByText(/2026-06-15T14:35/)).not.toBeInTheDocument();
    expect(screen.getByText(/15 Jun 2026/)).toBeInTheDocument();
  });
});

describe("HistoryScreen — reversed payments", () => {
  it("shows a reversed payment as Reversed rather than Pending", () => {
    transactions.push(tx({ status: "Reversed" }));
    renderScreen();

    // "Reversed" is also a filter tab, so assert on the row's own status badge.
    const badges = screen
      .getAllByText("Reversed")
      .filter((el) => el.tagName !== "BUTTON");
    expect(badges).toHaveLength(1);
    expect(screen.queryByText("Pending", { selector: "div" })).not.toBeInTheDocument();
  });

  it("offers a Reversed filter that isolates those rows", async () => {
    const user = userEvent.setup();
    transactions.push(
      tx({ id: "ok", status: "Successful", childName: "Settled Child" }),
      tx({ id: "rev", status: "Reversed", childName: "Reversed Child" }),
    );
    renderScreen();

    await user.click(screen.getByRole("button", { name: "Reversed" }));

    expect(screen.getByText("Reversed Child")).toBeInTheDocument();
    expect(screen.queryByText("Settled Child")).not.toBeInTheDocument();
  });

  it("keeps a reversed row out of the Pending tab", async () => {
    const user = userEvent.setup();
    transactions.push(tx({ status: "Reversed", childName: "Reversed Child" }));
    renderScreen();

    await user.click(screen.getByRole("button", { name: "Pending" }));

    expect(screen.queryByText("Reversed Child")).not.toBeInTheDocument();
  });
});

describe("HistoryScreen — payment type", () => {
  it("distinguishes the first payment from an installment", () => {
    transactions.push(
      tx({ id: "a", type: "FIRST_PAYMENT" }),
      tx({ id: "b", type: "INSTALLMENT" }),
    );
    renderScreen();

    expect(screen.getByText("First payment")).toBeInTheDocument();
    expect(screen.getByText("Installment")).toBeInTheDocument();
  });
});

describe("HistoryScreen — receipts", () => {
  it("offers no receipt button when the row has no signed url", () => {
    transactions.push(tx());
    renderScreen();

    expect(
      screen.queryByRole("button", { name: "Receipt" }),
    ).not.toBeInTheDocument();
  });

  it("lets the payer open the receipt they uploaded", async () => {
    // The list already fetched `receiptSignedUrl` but never rendered it, so a
    // parent could upload proof of transfer and never see it again.
    const user = userEvent.setup();
    transactions.push(tx({ receiptSignedUrl: "https://signed.example/r.jpg" }));
    renderScreen();

    await user.click(screen.getByRole("button", { name: "Receipt" }));

    const image = screen.getByRole("img", { name: /Receipt for/ });
    expect(image).toHaveAttribute("src", "https://signed.example/r.jpg");
    expect(
      screen.getByRole("link", { name: "Open full size" }),
    ).toHaveAttribute("href", "https://signed.example/r.jpg");
  });

  it("closes the receipt preview again", async () => {
    const user = userEvent.setup();
    transactions.push(tx({ receiptSignedUrl: "https://signed.example/r.jpg" }));
    renderScreen();

    await user.click(screen.getByRole("button", { name: "Receipt" }));
    const dialog = screen.getByRole("img", { name: /Receipt for/ })
      .parentElement as HTMLElement;
    await user.click(within(dialog).getByText("close"));

    expect(
      screen.queryByRole("img", { name: /Receipt for/ }),
    ).not.toBeInTheDocument();
  });
});

describe("HistoryScreen — reversal control", () => {
  it("is hidden from parents", () => {
    transactions.push(tx({ status: "Successful", type: "INSTALLMENT" }));
    renderScreen();

    expect(
      screen.queryByRole("button", { name: "Reverse" }),
    ).not.toBeInTheDocument();
  });

  it("is offered to a school owner on a settled installment", () => {
    role = "school_owner";
    transactions.push(tx({ status: "Successful", type: "INSTALLMENT" }));
    renderScreen();

    expect(screen.getByRole("button", { name: "Reverse" })).toBeInTheDocument();
  });

  it("is not offered on an already-reversed payment", () => {
    role = "school_owner";
    transactions.push(tx({ status: "Reversed", type: "INSTALLMENT" }));
    renderScreen();

    expect(
      screen.queryByRole("button", { name: "Reverse" }),
    ).not.toBeInTheDocument();
  });
});

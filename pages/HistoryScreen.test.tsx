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
/** The status the screen last asked the SERVER for, per history hook. */
let requestedStatus: string | undefined;
let requestedPage = 1;

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ role, user: { id: "u1" } }),
}));

/*
 * The three history hooks are mocked at the query layer rather than at
 * DataContext: this screen owns its own page and status filter and sends both
 * to the server, so the filter assertions below are about what it REQUESTS, not
 * about what it removes from a list it was handed.
 */
vi.mock("../hooks/useQueries", async () => {
  const actual =
    await vi.importActual<typeof import("../hooks/useQueries")>(
      "../hooks/useQueries",
    );
  const page = (
    _enabledOrUserId?: unknown,
    _enabled?: unknown,
    options: { page?: number; status?: string } = {},
  ) => {
    requestedStatus = options.status;
    requestedPage = options.page ?? 1;
    return {
      data: {
        items: transactions,
        total: transactions.length,
        page: requestedPage,
        totalPages: 1,
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    };
  };
  return {
    ...actual,
    useTransactions: page,
    // The school/owner variants take (enabled, options) — one arg fewer.
    useSchoolTransactions: (enabled?: unknown, options = {}) =>
      page(enabled, undefined, options),
    useGlobalTransactions: (enabled?: unknown, options = {}) =>
      page(enabled, undefined, options),
  };
});

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
  requestedStatus = undefined;
  requestedPage = 1;
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

  /*
   * The tabs filter SERVER-side. They used to filter the fetched array, and
   * every history endpoint returns one bounded page (50 rows for the admin
   * ledger), so a tab showed only the matches within that page and rendered
   * them as the complete set — with no pager to reach the rest. These assert on
   * the request the screen makes, which is where the filtering now happens.
   */
  it("asks the server for the Reversed set rather than filtering a page", async () => {
    const user = userEvent.setup();
    transactions.push(tx({ id: "ok", status: "Successful" }));
    renderScreen();

    await user.click(screen.getByRole("button", { name: "Reversed" }));

    expect(requestedStatus).toBe("REVERSED");
  });

  it("maps each tab to its API status value", async () => {
    const user = userEvent.setup();
    renderScreen();

    // "Successful" is the UI label; SUCCESS is what the enum stores. Sending
    // the label would match nothing and empty the tab.
    await user.click(screen.getByRole("button", { name: "Successful" }));
    expect(requestedStatus).toBe("SUCCESS");

    await user.click(screen.getByRole("button", { name: "Pending" }));
    expect(requestedStatus).toBe("PENDING");

    await user.click(screen.getByRole("button", { name: "Failed" }));
    expect(requestedStatus).toBe("FAILED");
  });

  it("sends no status filter on the All tab", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole("button", { name: "Failed" }));
    await user.click(screen.getByRole("button", { name: "All" }));

    expect(requestedStatus).toBeUndefined();
  });

  it("returns to page 1 when the filter changes", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole("button", { name: "Failed" }));

    // Staying on page 4 of the old set would land past the end of the new one.
    expect(requestedPage).toBe(1);
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

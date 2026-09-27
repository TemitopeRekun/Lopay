import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MigrationWindowsScreen from "./MigrationWindowsScreen";
import type { MigrationWindow } from "../../services/backend";

/**
 * The platform admin's view of who can still migrate families for free.
 *
 * The rule is enforced server-side either way; this screen exists so it is not
 * enforced *invisibly*. Before it, a school learned its period was closing by
 * being refused, and the platform learned when they telephoned — and the
 * product's own "contact Lopay to have the window extended" resolved to
 * somebody editing the database by hand.
 *
 * What is asserted here is the part a type cannot: that the dangerous edit is
 * gated, that the screen refuses to let an admin save a change with no reason,
 * and that the wording matches what will actually happen.
 */

const getMigrationWindows = vi.fn();
const setMigrationWindow = vi.fn();
const showToast = vi.fn();
const navigate = vi.fn();
let userRole: string | null = "owner";

vi.mock("../../services/backend", () => ({
  BackendAPI: {
    admin: {
      getMigrationWindows: () => getMigrationWindows(),
      setMigrationWindow: (id: string, closesAt: string, reason: string) =>
        setMigrationWindow(id, closesAt, reason),
    },
  },
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ userRole }),
}));

vi.mock("../../store/uiStore", () => ({
  useUIStore: (selector: (s: { showToast: typeof showToast }) => unknown) =>
    selector({ showToast }),
}));

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("../../components/Layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../../components/Header", () => ({
  Header: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

const DAY = 24 * 60 * 60 * 1000;
const ahead = (days: number) => new Date(Date.now() + days * DAY).toISOString();

const window_ = (overrides: Partial<MigrationWindow> = {}): MigrationWindow => ({
  schoolId: "school-1",
  schoolName: "Febison Montessori",
  joinedAt: new Date(Date.now() - 30 * DAY).toISOString(),
  closesAt: ahead(30),
  isOpen: true,
  daysRemaining: 30,
  migratedStudents: 12,
  ...overrides,
});

const renderScreen = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <MigrationWindowsScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("MigrationWindowsScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userRole = "owner";
    getMigrationWindows.mockResolvedValue([window_()]);
    setMigrationWindow.mockResolvedValue({
      schoolId: "school-1",
      schoolName: "Febison Montessori",
      previousClosesAt: ahead(30),
      closesAt: ahead(60),
      isOpen: true,
      daysRemaining: 60,
    });
  });

  it("refuses anyone who is not a platform admin", async () => {
    // Not merely hidden from the nav: this route moves what a school is given
    // for free, so reaching it by URL must not work either.
    userRole = "school_owner";
    renderScreen();

    expect(await screen.findByText(/access denied/i)).toBeInTheDocument();
    expect(getMigrationWindows).not.toHaveBeenCalled();
  });

  it("shows each school with its deadline and how much it has used", async () => {
    renderScreen();

    expect(await screen.findByText("Febison Montessori")).toBeInTheDocument();
    // The count is what turns "they want more time" into a decision.
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText(/30 days left/i)).toBeInTheDocument();
  });

  it("says '1 day left', never '1 days left'", async () => {
    getMigrationWindows.mockResolvedValue([
      window_({ daysRemaining: 1, closesAt: ahead(1) }),
    ]);
    renderScreen();

    expect(await screen.findByText("1 day left")).toBeInTheDocument();
    expect(screen.queryByText("1 days left")).not.toBeInTheDocument();
  });

  it("marks a lapsed period as closed rather than as zero days", async () => {
    getMigrationWindows.mockResolvedValue([
      window_({ isOpen: false, daysRemaining: 0, closesAt: ahead(-2) }),
    ]);
    renderScreen();

    // Both the badge and the row label say "Closed", which is correct on
    // screen and ambiguous to a query — assert on what distinguishes the state.
    expect(await screen.findAllByText(/closed/i)).toHaveLength(2);
    // And the action reads as reopening, because that is what it would do.
    expect(
      screen.getByRole("button", { name: /reopen migration/i }),
    ).toBeInTheDocument();
  });

  it("warns when schools are running out, as one readable phrase", async () => {
    // Split across text nodes a screen reader announces the number and the
    // noun separately, and nothing can match it as a sentence.
    getMigrationWindows.mockResolvedValue([
      window_({ daysRemaining: 9 }),
      window_({ schoolId: "s2", schoolName: "Greenfield", daysRemaining: 3 }),
    ]);
    renderScreen();

    expect(
      await screen.findByText("2 schools have 2 weeks or less left to migrate."),
    ).toBeInTheDocument();
  });

  it("stays quiet when nobody is close to the deadline", async () => {
    renderScreen();
    await screen.findByText("Febison Montessori");

    expect(screen.queryByText(/weeks or less/i)).not.toBeInTheDocument();
  });

  it("will not save a change without a reason", async () => {
    // This changes what a school gets for free, and the person who has to
    // understand it later is not the person making it now.
    renderScreen();
    fireEvent.click(await screen.findByRole("button", { name: /change the date/i }));

    fireEvent.change(screen.getByLabelText(/migration closes on/i), {
      target: { value: "2026-12-01" },
    });

    expect(screen.getByRole("button", { name: /^save$/i })).toBeDisabled();
  });

  it("will not save when the date has not actually moved", async () => {
    renderScreen();
    fireEvent.click(await screen.findByRole("button", { name: /change the date/i }));

    fireEvent.change(screen.getByLabelText(/why/i), {
      target: { value: "no change" },
    });

    expect(screen.getByRole("button", { name: /^save$/i })).toBeDisabled();
  });

  it("sends the resulting DATE, not an amount of time", async () => {
    // "+7 days" on a period that lapsed a fortnight ago lands in the past and
    // silently changes nothing — the admin believes they granted it and the
    // school is still blocked.
    renderScreen();
    fireEvent.click(await screen.findByRole("button", { name: /change the date/i }));

    fireEvent.change(screen.getByLabelText(/migration closes on/i), {
      target: { value: "2026-12-01" },
    });
    fireEvent.change(screen.getByLabelText(/why/i), {
      target: { value: "Still migrating 120 families" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(setMigrationWindow).toHaveBeenCalled());
    const [schoolId, closesAt, reason] = setMigrationWindow.mock.calls[0];
    expect(schoolId).toBe("school-1");
    // Local midday, so a bare date cannot land on the previous day in Lagos.
    expect(closesAt).toBe("2026-12-01T12:00:00.000Z");
    expect(reason).toBe("Still migrating 120 families");
  });

  it("tells the admin what the school actually ended up with", async () => {
    renderScreen();
    fireEvent.click(await screen.findByRole("button", { name: /change the date/i }));
    fireEvent.change(screen.getByLabelText(/migration closes on/i), {
      target: { value: "2026-12-01" },
    });
    fireEvent.change(screen.getByLabelText(/why/i), {
      target: { value: "agreed" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining("Febison Montessori can migrate until"),
        "success",
      ),
    );
  });

  it("surfaces the server's refusal rather than a generic failure", async () => {
    // The server bounds the date to within a year; a mistyped year has to come
    // back as the reason it was refused, not as "something went wrong".
    const refusal = new Error("Request failed with status code 400");
    (refusal as unknown as { response: unknown }).response = {
      status: 400,
      data: {
        message: "A free-migration deadline cannot be more than a year away.",
      },
    };
    setMigrationWindow.mockRejectedValue(refusal);
    renderScreen();
    fireEvent.click(await screen.findByRole("button", { name: /change the date/i }));
    fireEvent.change(screen.getByLabelText(/migration closes on/i), {
      target: { value: "2030-12-01" },
    });
    fireEvent.change(screen.getByLabelText(/why/i), {
      target: { value: "oops" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining("more than a year away"),
        "error",
      ),
    );
  });

  it("explains how to stop a school, since that is the same control", async () => {
    renderScreen();
    fireEvent.click(await screen.findByRole("button", { name: /change the date/i }));

    expect(
      screen.getByText(/set today's date to stop this school migrating/i),
    ).toBeInTheDocument();
  });
});

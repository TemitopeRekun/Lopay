import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CollectionsBreakdownScreen from "./CollectionsBreakdownScreen";
import { BackendAPI } from "../../services/backend";

vi.mock("../../services/backend", () => ({
  BackendAPI: {
    admin: {
      getBreakdownSummary: vi.fn(),
      getSchoolBreakdown: vi.fn(),
    },
  },
}));

vi.mock("../../components/Layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../../components/Header", () => ({
  Header: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

const SUMMARY = {
  totalOutstanding: 1_000_000,
  totalOverdue: 250_000,
  totalStudents: 40,
  studentsWithBalance: 12,
  overdueStudents: 4,
  overdueSchools: 1,
  schools: [
    {
      schoolId: "s1",
      schoolName: "Acme College",
      totalStudents: 25,
      studentsWithBalance: 8,
      outstanding: 700_000,
      overdue: 250_000,
      overdueStudentCount: 4,
    },
    {
      schoolId: "s2",
      schoolName: "Bright Stars",
      totalStudents: 15,
      studentsWithBalance: 4,
      outstanding: 300_000,
      overdue: 0,
      overdueStudentCount: 0,
    },
  ],
};

const studentPage = (items: unknown[]) => ({
  items,
  total: items.length,
  page: 1,
  limit: 50,
  totalPages: 1,
  schoolId: "s1",
  schoolName: "Acme College",
  tab: "overdue",
});

const STUDENT = {
  childId: "c1",
  studentName: "Ada Obi",
  className: "JSS1",
  parentName: "Mrs Obi",
  paymentStatus: "DEFAULTED",
  totalFee: 120_000,
  outstanding: 90_000,
  overdue: 60_000,
  paidInstallments: 2,
  missedInstallments: 3,
  daysOverdue: 21,
  termExpired: false,
  nextDueDate: "2026-08-10",
  installmentFrequency: "WEEKLY",
};

const renderScreen = (state?: { tab?: string; schoolId?: string }) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[{ pathname: "/admin/breakdown", state }]}>
        <CollectionsBreakdownScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("CollectionsBreakdownScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(BackendAPI.admin.getBreakdownSummary).mockResolvedValue(
      SUMMARY as never,
    );
    vi.mocked(BackendAPI.admin.getSchoolBreakdown).mockResolvedValue(
      studentPage([STUDENT]) as never,
    );
  });

  it("opens on the tab the dashboard card asked for", async () => {
    renderScreen({ tab: "overdue" });
    // Wait on the data-derived caption; the tab label renders before the fetch.
    await waitFor(() =>
      expect(
        screen.getByText("4 student(s) across 1 school(s)"),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("Overdue — platform total")).toBeInTheDocument();
    // ₦250,000 is both the platform total and Acme's row total here.
    expect(screen.getAllByText("₦250,000").length).toBeGreaterThan(0);
  });

  it("defaults to arrears with no navigation state", async () => {
    renderScreen();
    await waitFor(() =>
      expect(
        screen.getByText("12 student(s) carrying a balance"),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("Arrears — platform total")).toBeInTheDocument();
    expect(screen.getByText("₦1,000,000")).toBeInTheDocument();
  });

  it("hides schools with nothing overdue on the overdue tab", async () => {
    renderScreen({ tab: "overdue" });
    await waitFor(() =>
      expect(screen.getByText("Acme College")).toBeInTheDocument(),
    );
    // Bright Stars owes money but is on schedule — noise on this tab.
    expect(screen.queryByText("Bright Stars")).not.toBeInTheDocument();
  });

  it("shows every owing school on the arrears tab", async () => {
    renderScreen({ tab: "outstanding" });
    await waitFor(() =>
      expect(screen.getByText("Acme College")).toBeInTheDocument(),
    );
    expect(screen.getByText("Bright Stars")).toBeInTheDocument();
  });

  it("nests students under a school when it is expanded", async () => {
    const user = userEvent.setup();
    renderScreen({ tab: "overdue" });
    await waitFor(() =>
      expect(screen.getByText("Acme College")).toBeInTheDocument(),
    );

    expect(screen.queryByText("Ada Obi")).not.toBeInTheDocument();
    await user.click(screen.getByText("Acme College"));

    await waitFor(() => expect(screen.getByText("Ada Obi")).toBeInTheDocument());
    expect(BackendAPI.admin.getSchoolBreakdown).toHaveBeenCalledWith("s1", {
      tab: "overdue",
      page: 1,
    });
    // Per-student detail an admin needs to chase the parent.
    expect(screen.getByText("JSS1 · Mrs Obi")).toBeInTheDocument();
    expect(screen.getByText("3 missed · 21d late")).toBeInTheDocument();
  });

  it("pre-expands the school it was opened for", async () => {
    renderScreen({ tab: "students", schoolId: "s1" });
    await waitFor(() => expect(screen.getByText("Ada Obi")).toBeInTheDocument());
    expect(BackendAPI.admin.getSchoolBreakdown).toHaveBeenCalledWith("s1", {
      tab: "students",
      page: 1,
    });
  });

  it("collapses a school when the tab changes", async () => {
    const user = userEvent.setup();
    renderScreen({ tab: "overdue" });
    await waitFor(() =>
      expect(screen.getByText("Acme College")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Acme College"));
    await waitFor(() => expect(screen.getByText("Ada Obi")).toBeInTheDocument());

    // The expanded rows belong to the previous tab's filter, so they must not
    // linger as a stale nesting.
    await user.click(screen.getByRole("button", { name: "Students" }));
    await waitFor(() =>
      expect(screen.queryByText("Ada Obi")).not.toBeInTheDocument(),
    );
  });

  it("collapses on a second tap", async () => {
    const user = userEvent.setup();
    renderScreen({ tab: "overdue" });
    await waitFor(() =>
      expect(screen.getByText("Acme College")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Acme College"));
    await waitFor(() => expect(screen.getByText("Ada Obi")).toBeInTheDocument());
    await user.click(screen.getByText("Acme College"));
    await waitFor(() =>
      expect(screen.queryByText("Ada Obi")).not.toBeInTheDocument(),
    );
  });

  it("reports an empty overdue tab as good news, not an error", async () => {
    vi.mocked(BackendAPI.admin.getBreakdownSummary).mockResolvedValue({
      ...SUMMARY,
      totalOverdue: 0,
      overdueStudents: 0,
      overdueSchools: 0,
      schools: SUMMARY.schools.map((s) => ({
        ...s,
        overdue: 0,
        overdueStudentCount: 0,
      })),
    } as never);

    renderScreen({ tab: "overdue" });
    await waitFor(() =>
      expect(
        screen.getByText("No school is behind schedule"),
      ).toBeInTheDocument(),
    );
  });

  it("surfaces a retry when the summary fails", async () => {
    vi.mocked(BackendAPI.admin.getBreakdownSummary).mockRejectedValue(
      new Error("boom"),
    );
    renderScreen();
    await waitFor(() =>
      expect(
        screen.getByText("Couldn't load the breakdown."),
      ).toBeInTheDocument(),
    );
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import MigrationInviteScreen from "./MigrationInviteScreen";
import ClaimMigrationInviteScreen from "./ClaimMigrationInviteScreen";
import { DataProvider } from "../context/DataContext";

const navigate = vi.fn();
const queryClient = new QueryClient();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "owner-1", role: "school_owner" },
  }),
}));

describe("Migration invite UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds an invite and routes the parent into the claim flow", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <DataProvider>
          <MemoryRouter>
            <MigrationInviteScreen />
          </MemoryRouter>
        </DataProvider>
      </QueryClientProvider>,
    );

    await user.type(screen.getByLabelText(/student name/i), "Ada Lovelace");
    await user.type(screen.getByLabelText(/class\/grade/i), "JSS1");
    await user.type(screen.getByLabelText(/total fee/i), "150000");
    await user.type(screen.getByLabelText(/amount already paid/i), "45000");

    await user.click(screen.getByRole("button", { name: /create invite/i }));

    expect(navigate).toHaveBeenCalledWith(
      "/claim-migration-invite",
      expect.objectContaining({
        state: expect.objectContaining({
          invite: expect.objectContaining({
            studentName: "Ada Lovelace",
            migratedBalance: 45_000,
            remainingBalance: 105_000,
            status: "pending_confirmation",
          }),
        }),
      }),
    );
  });

  it("lets the parent confirm a migration before activation starts the plan", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <DataProvider>
          <MemoryRouter initialEntries={[
            {
              pathname: "/claim-migration-invite",
              state: {
                invite: {
                  id: "mig-1",
                  studentName: "Ada Lovelace",
                  className: "JSS1",
                  totalFee: 150000,
                  amountAlreadyPaid: 45000,
                  migratedBalance: 45000,
                  remainingBalance: 105000,
                  migrationDate: "2026-09-13",
                  startDate: "2026-09-13",
                  installmentFrequency: "MONTHLY",
                  status: "pending_confirmation",
                },
              },
            },
          ]}>
            <ClaimMigrationInviteScreen />
          </MemoryRouter>
        </DataProvider>
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole("button", { name: /confirm migration/i }));

    expect(screen.getByText(/migration confirmed/i)).toBeInTheDocument();
    expect(screen.getByText(/Migration confirmed.*13 Sept? 2026/i)).toBeInTheDocument();
  });
});

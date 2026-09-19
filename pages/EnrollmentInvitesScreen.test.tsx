import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import EnrollmentInvitesScreen from "./EnrollmentInvitesScreen";
import type { SchoolInvite } from "../services/enrollmentInvites";

/**
 * The school owner's side of a claim they did not authorise.
 *
 * Claiming an invite requires only the link — deliberately, because the link is
 * sent inside a conversation the school and parent have already had. That makes
 * this screen the whole of the detection and recovery story: it is where the
 * school finds out WHO claimed, is warned when the number does not match, and
 * removes a plan that went to the wrong person.
 *
 * These assert the parts a type cannot: that the warning only fires on a real
 * mismatch, that removal is never one tap away, and that the confirmation says
 * what will actually be destroyed.
 */

const revokeMutate = vi.fn();
const releaseMutate = vi.fn();
let invites: SchoolInvite[];

vi.mock("../hooks/useEnrollmentInvites", () => ({
  useEnrollmentInvites: () => ({
    data: { items: invites, total: invites.length, page: 1, limit: 25, totalPages: 1 },
    isLoading: false,
    isError: false,
  }),
  useRevokeEnrollmentInvite: () => ({
    mutate: revokeMutate,
    isPending: false,
    variables: undefined,
  }),
  useReleaseEnrollmentInvite: () => ({
    mutate: releaseMutate,
    isPending: false,
    variables: undefined,
  }),
  useAmendEnrollmentInvite: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  }),
}));

vi.mock("../components/Layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../components/Header", () => ({
  Header: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

const claimedInvite = (overrides: Partial<SchoolInvite> = {}): SchoolInvite => ({
  id: "invite-1",
  studentName: "Ada Lovelace",
  className: "Basic 1",
  totalFee: 100_000,
  amountAlreadyPaid: 40_000,
  remainingBalance: 60_000,
  parentPhone: "+2348012345678",
  installmentFrequency: "MONTHLY",
  planStartDate: "2026-09-19T00:00:00.000Z",
  termEndDate: "2026-12-19T00:00:00.000Z",
  expiresAt: "2026-10-03T00:00:00.000Z",
  status: "CLAIMED",
  isLive: false,
  disputeReason: null,
  disputedAt: null,
  revokedAt: null,
  claimedAt: "2026-09-20T00:00:00.000Z",
  createdAt: "2026-09-19T00:00:00.000Z",
  enrollmentId: "enrollment-1",
  claimedByName: "Grace Lovelace",
  claimantPhoneMatched: true,
  ...overrides,
});

const renderScreen = () =>
  render(
    <MemoryRouter>
      <EnrollmentInvitesScreen />
    </MemoryRouter>,
  );

describe("EnrollmentInvitesScreen — a claim that may have gone astray", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invites = [claimedInvite()];
  });

  it("names who claimed, so the school can check it was the right family", () => {
    renderScreen();

    expect(screen.getByText("Grace Lovelace")).toBeInTheDocument();
  });

  it("does NOT warn when the claimant's number matched", () => {
    // A warning on every claim is a warning nobody reads.
    renderScreen();

    expect(
      screen.queryByText(/different phone number/i),
    ).not.toBeInTheDocument();
  });

  it("does not warn on an unclaimed invite either", () => {
    // `claimantPhoneMatched` is null until a claim happens. Null is "nothing to
    // report", not "mismatch" — treating it as the latter would light up every
    // pending invite.
    invites = [
      claimedInvite({
        status: "PENDING",
        claimedAt: null,
        claimedByName: null,
        claimantPhoneMatched: null,
        enrollmentId: null,
        isLive: true,
      }),
    ];
    renderScreen();

    expect(
      screen.queryByText(/different phone number/i),
    ).not.toBeInTheDocument();
  });

  it("warns, and names the number the school addressed, on a mismatch", () => {
    invites = [claimedInvite({ claimantPhoneMatched: false })];
    renderScreen();

    // Scoped to the warning itself: the number also appears in the card header,
    // so a bare text query would pass even if the warning never rendered it.
    const warning = screen.getByText(/different phone number than the/i);
    expect(warning).toBeInTheDocument();
    // The number they typed, so they can see the digit they got wrong.
    expect(warning).toHaveTextContent("+2348012345678");
  });

  it("never removes a plan in one tap", () => {
    // Deleting a live plan and the record of a prior payment is not an
    // accidental-tap-shaped action.
    renderScreen();

    fireEvent.click(screen.getByRole("button", { name: /wrong parent/i }));
    expect(releaseMutate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /^remove plan$/i })).toBeInTheDocument();
  });

  it("says exactly what will be destroyed before asking", () => {
    renderScreen();
    fireEvent.click(screen.getByRole("button", { name: /wrong parent/i }));

    // Scoped to the confirmation copy — the figure is also on the summary rows
    // above, where it means something entirely different.
    const confirmation = screen.getByText(/cannot be undone/i);
    expect(confirmation).toHaveTextContent("₦40,000");
    expect(confirmation).toHaveTextContent("Ada Lovelace");
  });

  it("sends the reason with the removal, because the claimant is told it", () => {
    renderScreen();
    fireEvent.click(screen.getByRole("button", { name: /wrong parent/i }));
    fireEvent.change(screen.getByLabelText(/why are you removing it/i), {
      target: { value: "sent to the wrong number" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^remove plan$/i }));

    expect(releaseMutate).toHaveBeenCalledWith({
      id: "invite-1",
      reason: "sent to the wrong number",
    });
  });

  it("omits an empty reason rather than sending a blank string", () => {
    renderScreen();
    fireEvent.click(screen.getByRole("button", { name: /wrong parent/i }));
    fireEvent.click(screen.getByRole("button", { name: /^remove plan$/i }));

    expect(releaseMutate).toHaveBeenCalledWith({
      id: "invite-1",
      reason: undefined,
    });
  });

  it("lets the school back out", () => {
    renderScreen();
    fireEvent.click(screen.getByRole("button", { name: /wrong parent/i }));
    fireEvent.click(screen.getByRole("button", { name: /keep it/i }));

    expect(releaseMutate).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: /^remove plan$/i }),
    ).not.toBeInTheDocument();
  });

  it("offers no removal on an invite nobody has claimed", () => {
    // There is no plan to remove; the remedy there is to cancel the link.
    invites = [
      claimedInvite({
        status: "PENDING",
        claimedAt: null,
        claimedByName: null,
        claimantPhoneMatched: null,
        enrollmentId: null,
        isLive: true,
      }),
    ];
    renderScreen();

    expect(
      screen.queryByRole("button", { name: /wrong parent/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /cancel invite/i }),
    ).toBeInTheDocument();
  });
});

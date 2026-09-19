import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AmendInviteForm } from "./AmendInviteForm";
import type { SchoolInvite } from "../../services/enrollmentInvites";

/**
 * Correcting a migrated amount moves a real balance on a live plan, so this
 * form gets tested even though presentational components are outside the
 * coverage gate. The assertions are about what it refuses to send and what it
 * refuses to claim: a no-op correction, an out-of-range figure, and — most
 * importantly — a "saved" state after a rejected request.
 */

const amendMutate = vi.fn();
let amendState: { isPending: boolean; isError: boolean; error?: unknown };

vi.mock("../../hooks/useEnrollmentInvites", () => ({
  useAmendEnrollmentInvite: () => ({
    mutateAsync: amendMutate,
    ...amendState,
  }),
}));

const INVITE: SchoolInvite = {
  id: "invite-1",
  studentName: "Ada Lovelace",
  className: "Basic 1",
  totalFee: 100_000,
  amountAlreadyPaid: 40_000,
  remainingBalance: 60_000,
  parentPhone: "+2348012345678",
  installmentFrequency: "MONTHLY",
  planStartDate: "2026-09-19T12:00:00.000Z",
  termEndDate: "2026-12-19T12:00:00.000Z",
  expiresAt: "2026-10-03T12:00:00.000Z",
  status: "CLAIMED",
  isLive: false,
  disputeReason: null,
  disputedAt: null,
  revokedAt: null,
  claimedAt: "2026-09-20T12:00:00.000Z",
  createdAt: "2026-09-19T12:00:00.000Z",
  enrollmentId: "enrollment-1",
  claimedByName: "Ada's Mum",
  claimantPhoneMatched: true,
};

const onClose = vi.fn();
const renderForm = () =>
  render(<AmendInviteForm invite={INVITE} onClose={onClose} />);

const amountField = () => screen.getByLabelText(/currently recorded/i);
const saveButton = () => screen.getByRole("button", { name: /save correction/i });

describe("AmendInviteForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    amendState = { isPending: false, isError: false };
    amendMutate.mockResolvedValue({ remainingBalance: 75_000 });
  });

  it("opens on the currently recorded figure", () => {
    renderForm();
    expect(amountField()).toHaveValue(40_000);
  });

  it("will not submit an unchanged amount", () => {
    // A no-op correction is refused by the server too; catching it here saves a
    // round trip and an unhelpful error.
    renderForm();
    expect(saveButton()).toBeDisabled();
  });

  it("previews the balance the correction would leave", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.clear(amountField());
    await user.type(amountField(), "25000");

    expect(screen.getByText(/₦75,000/)).toBeInTheDocument();
    // Hedged on purpose: instalments paid since the claim mean the server has
    // the final word, and the copy must not promise a figure it cannot know.
    expect(screen.getByText(/less anything they have paid since/i)).toBeInTheDocument();
  });

  it("sends the corrected amount and the reason", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.clear(amountField());
    await user.type(amountField(), "25000");
    await user.type(screen.getByLabelText(/why\?/i), "second transfer found");
    await user.click(saveButton());

    expect(amendMutate).toHaveBeenCalledWith({
      id: "invite-1",
      dto: { amountAlreadyPaid: 25_000, reason: "second transfer found" },
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("omits an empty reason rather than sending a blank string", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.clear(amountField());
    await user.type(amountField(), "25000");
    await user.click(saveButton());

    expect(amendMutate).toHaveBeenCalledWith({
      id: "invite-1",
      dto: { amountAlreadyPaid: 25_000, reason: undefined },
    });
  });

  it("rejects an amount above the school fee before sending", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.clear(amountField());
    await user.type(amountField(), "150000");

    expect(screen.getByText(/between ₦0 and ₦100,000/i)).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    expect(amendMutate).not.toHaveBeenCalled();
  });

  it("stays open and shows the server's reason when the correction is refused", async () => {
    // The realistic refusal: instalments have been paid since, so the correction
    // would leave the plan overpaid. The school needs the actual number.
    amendMutate.mockRejectedValue(new Error("would leave this plan overpaid"));
    amendState = {
      isPending: false,
      isError: true,
      error: new Error("Correcting to ₦90,000 would leave this plan overpaid by ₦20,000."),
    };
    const user = userEvent.setup();
    renderForm();

    await user.clear(amountField());
    await user.type(amountField(), "90000");
    await user.click(saveButton());

    await waitFor(() =>
      expect(screen.getByText(/overpaid by ₦20,000/i)).toBeInTheDocument(),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("disables saving while the request is in flight", () => {
    amendState = { isPending: true, isError: false };
    renderForm();
    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
  });

  it("closes without sending when cancelled", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(amendMutate).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InviteSharePanel } from "./InviteSharePanel";
import type { CreatedInvite } from "../../services/enrollmentInvites";

/**
 * The one and only chance to send an invite link.
 *
 * The raw claim token is returned exactly once — the server stores only its
 * SHA-256 digest, so no endpoint can ever produce it again. Everything here
 * follows from that: if the school leaves this screen without the link in their
 * clipboard or their chat, the invite is dead and the student's slot is held by
 * a row nobody can use.
 *
 * ## What is actually being pinned
 *
 * That the school copies the MESSAGE, not a naked URL. The server composes one
 * — it names the child, says what the link is for, and says nothing has changed
 * yet — and this panel used to return it and throw it away, offering only
 * `claimUrl`. A bare link dropped into WhatsApp by a school is the exact shape
 * parents are taught not to tap, and this one asks them to confirm money.
 */

const INVITE: CreatedInvite = {
  invite: {
    id: "inv-1",
    studentName: "Ada Lovelace",
    className: "Basic 1",
    totalFee: 90000,
    amountAlreadyPaid: 25000,
    remainingBalance: 65000,
    parentPhone: "+2348012345678",
    installmentFrequency: "MONTHLY",
    planStartDate: "2026-10-01T00:00:00.000Z",
    termEndDate: "2027-01-01T00:00:00.000Z",
    expiresAt: "2026-10-11T00:00:00.000Z",
    status: "PENDING",
    isLive: true,
    disputeReason: null,
    disputedAt: null,
    revokedAt: null,
    claimedAt: null,
    createdAt: "2026-09-27T00:00:00.000Z",
    enrollmentId: null,
    claimedByName: null,
    claimantPhoneMatched: null,
  },
  claimUrl: "https://app.lopay.test/#/claim-invite?token=abc123",
  message:
    "Hello! Ada Lovelace's school has set up a Lopay account for your remaining Basic 1 fees, " +
    "including what you have already paid. Open this link to check the details and confirm: " +
    "https://app.lopay.test/#/claim-invite?token=abc123",
  expiresAt: "2026-10-11T00:00:00.000Z",
};

const writeText = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  writeText.mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
});

const renderPanel = () =>
  render(
    <InviteSharePanel invite={INVITE} onDone={vi.fn()} onAnother={vi.fn()} />,
  );

describe("InviteSharePanel", () => {
  it("copies the composed message, not the bare link, as the primary action", async () => {
    renderPanel();

    await userEvent.click(screen.getByRole("button", { name: /copy message/i }));

    expect(writeText).toHaveBeenCalledWith(INVITE.message);
  });

  it("still offers the link on its own, for a school writing its own greeting", async () => {
    renderPanel();

    await userEvent.click(
      screen.getByRole("button", { name: /copy link only/i }),
    );

    expect(writeText).toHaveBeenCalledWith(INVITE.claimUrl);
  });

  it("shows the message so it can be read — and selected — before sending", () => {
    // Clipboard access is denied in some in-app browsers and over plain http.
    // The text being on screen and selectable is what makes that survivable.
    renderPanel();

    expect(screen.getByTestId("invite-share-message")).toHaveTextContent(
      "Ada Lovelace's school has set up a Lopay account",
    );
    expect(screen.getByTestId("invite-claim-url")).toHaveTextContent(
      INVITE.claimUrl,
    );
  });

  it("puts the number in front of the school at the moment they copy", () => {
    // The one field they must get right. Since the claim is authorised by the
    // link alone, a mistyped digit sends a child's fee details to a stranger
    // who can open a plan in their own name — a warning after the fact is the
    // only other defence, so this is the last chance to prevent it.
    renderPanel();

    // Twice, deliberately: once in the summary as "Sent to", and once in the
    // paste instruction right beside the copy button.
    expect(screen.getAllByText(/\+2348012345678/).length).toBeGreaterThanOrEqual(
      2,
    );
  });

  it("says plainly that the link cannot be recovered", () => {
    renderPanel();

    expect(screen.getByText(/shown once/i)).toBeInTheDocument();
  });

  it("does not report success when the clipboard refuses", async () => {
    // Telling a school "copied" when nothing was copied loses the only copy of
    // a token that cannot be reissued.
    writeText.mockRejectedValue(new Error("denied"));
    renderPanel();

    await userEvent.click(screen.getByRole("button", { name: /copy message/i }));

    expect(
      screen.queryByRole("button", { name: /message copied/i }),
    ).toBeNull();
  });

  it("confirms only the button that was pressed", async () => {
    renderPanel();

    await userEvent.click(screen.getByRole("button", { name: /copy message/i }));

    expect(
      screen.getByRole("button", { name: /message copied/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /copy link only/i }),
    ).toBeInTheDocument();
  });
});

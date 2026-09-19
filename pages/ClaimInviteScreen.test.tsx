import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ClaimInviteScreen from "./ClaimInviteScreen";

/**
 * The claim screen's one non-negotiable property: it never tells a parent
 * something happened unless the server said so.
 *
 * A previous attempt at this feature rendered "Migration confirmed. The plan is
 * now active" from a local `useState` flag with no request behind it — in a
 * product that handles a family's school fees. Most of what is asserted below
 * exists to make that specific failure impossible to reintroduce: the confirm
 * button must call the API, a rejected call must not produce a success state,
 * and every figure on screen must come from a server response.
 */

const navigate = vi.fn();

// The app is hash-routed, so the router has already parsed `?token=` out of the
// fragment by the time this screen renders — which is why reading it with
// `useSearchParams` costs nothing in privacy. That the URL a parent opens
// actually routes here is proven separately, against a real HashRouter, in
// utils/claimUrl.hashrouter.test.tsx; this mock cannot show it.
let searchParams = new URLSearchParams();

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return {
    ...actual,
    useNavigate: () => navigate,
    useSearchParams: () => [searchParams, vi.fn()],
  };
});

let isAuthenticated = true;
let userRole: string | null = "parent";
// `signup-guard.ts` makes the phone OPTIONAL so Google sign-in works, so an
// authenticated user with no number is an ordinary state, not a broken one —
// and it is the state the claim's second factor cannot be satisfied in.
let userPhoneNumber: string | null = "+2348012345678";
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated,
    role: userRole,
    user: { phoneNumber: userPhoneNumber },
  }),
}));

// Layout reaches for DataProvider and Header renders nav chrome; neither is
// what this screen is being tested for. Same approach as the other page suites.
vi.mock("../components/Layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../components/Header", () => ({
  Header: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

const claimMutate = vi.fn();
const disputeMutate = vi.fn();
let previewQuery: {
  data?: unknown;
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
};
let claimState: { isPending: boolean; isError: boolean; error?: unknown };
let disputeState: { isPending: boolean; isError: boolean; error?: unknown };

vi.mock("../hooks/useEnrollmentInvites", () => ({
  useInvitePreview: () => previewQuery,
  useClaimEnrollmentInvite: () => ({
    mutateAsync: claimMutate,
    ...claimState,
  }),
  useDisputeEnrollmentInvite: () => ({
    mutateAsync: disputeMutate,
    ...disputeState,
  }),
}));

const rememberPendingInvite = vi.fn();
const clearPendingInvite = vi.fn();
vi.mock("../utils/pendingInvite", () => ({
  rememberPendingInvite: (t: string) => rememberPendingInvite(t),
  clearPendingInvite: () => clearPendingInvite(),
}));

const PREVIEW = {
  studentName: "Ada Lovelace",
  className: "Basic 1",
  schoolName: "Acme Academy",
  totalFee: 100_000,
  amountAlreadyPaid: 40_000,
  remainingBalance: 60_000,
  installmentFrequency: "MONTHLY" as const,
  planStartDate: "2026-09-19T12:00:00.000Z",
  termEndDate: "2026-12-19T12:00:00.000Z",
  expiresAt: "2026-10-03T12:00:00.000Z",
  status: "PENDING" as const,
  canClaim: true,
};

const renderScreen = () =>
  render(
    <MemoryRouter>
      <ClaimInviteScreen />
    </MemoryRouter>,
  );

describe("ClaimInviteScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParams = new URLSearchParams({ token: "token-abc" });
    isAuthenticated = true;
    userRole = "parent";
    userPhoneNumber = "+2348012345678";
    previewQuery = { data: PREVIEW, isLoading: false, isError: false };
    claimState = { isPending: false, isError: false };
    disputeState = { isPending: false, isError: false };
    claimMutate.mockResolvedValue({
      enrollmentId: "enrollment-1",
      studentName: "Ada Lovelace",
      className: "Basic 1",
      schoolName: "Acme Academy",
      totalFee: 100_000,
      amountAlreadyPaid: 40_000,
      remainingBalance: 60_000,
      paymentStatus: "ACTIVE",
      planStartDate: PREVIEW.planStartDate,
    });
    disputeMutate.mockResolvedValue({ id: "invite-1", status: "DISPUTED" });
  });

  describe("reading the invite", () => {
    it("shows the figures the parent is being asked to confirm", () => {
      renderScreen();

      expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
      expect(screen.getByText("Acme Academy")).toBeInTheDocument();
      expect(screen.getByText("₦100,000")).toBeInTheDocument();
      expect(screen.getByText("₦40,000")).toBeInTheDocument();
      expect(screen.getByText("₦60,000")).toBeInTheDocument();
    });

    it("explains that prior payments do not count as missed instalments", () => {
      renderScreen();
      expect(screen.getByText(/not be marked late/i)).toBeInTheDocument();
    });

    it("asks for the link when there is no token", () => {
      searchParams = new URLSearchParams();
      renderScreen();

      expect(screen.getByText(/needs the link your school sent/i)).toBeInTheDocument();
    });

    it("shows a loading state rather than an empty screen", () => {
      previewQuery = { isLoading: true, isError: false };
      renderScreen();
      expect(screen.getByText(/one moment/i)).toBeInTheDocument();
    });

    it("shows the server's reason when the link is dead", () => {
      previewQuery = {
        isLoading: false,
        isError: true,
        error: new Error("This invite link is not valid."),
      };
      renderScreen();

      expect(screen.getByText(/doesn’t work/i)).toBeInTheDocument();
      expect(screen.getByText(/not valid/i)).toBeInTheDocument();
    });
  });

  describe("confirming", () => {
    it("calls the API and renders the SERVER's result, not a local flag", async () => {
      const user = userEvent.setup();
      renderScreen();

      await user.click(screen.getByRole("button", { name: /this is correct/i }));

      expect(claimMutate).toHaveBeenCalledWith("token-abc");
      await waitFor(() =>
        expect(screen.getByText(/plan active/i)).toBeInTheDocument(),
      );
      expect(screen.getByText(/already credited/i)).toBeInTheDocument();
    });

    it("shows NO success state when the server refuses", async () => {
      // The regression guard. A rejected claim must leave the parent on the
      // review screen with the reason — never on a confirmation.
      claimMutate.mockRejectedValue(new Error("different phone number"));
      claimState = {
        isPending: false,
        isError: true,
        error: new Error("This invite was sent to a different phone number."),
      };
      const user = userEvent.setup();
      renderScreen();

      await user.click(screen.getByRole("button", { name: /this is correct/i }));

      await waitFor(() =>
        expect(screen.getByText(/different phone number/i)).toBeInTheDocument(),
      );
      expect(screen.queryByText(/plan active/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/all set/i)).not.toBeInTheDocument();
    });

    it("disables the button while the request is in flight", () => {
      claimState = { isPending: true, isError: false };
      renderScreen();

      const button = screen.getByRole("button", { name: /confirming/i });
      expect(button).toBeDisabled();
    });

    it("clears the held token once the claim succeeds", async () => {
      const user = userEvent.setup();
      renderScreen();

      await user.click(screen.getByRole("button", { name: /this is correct/i }));

      await waitFor(() => expect(clearPendingInvite).toHaveBeenCalled());
    });

    it("sends a parent to their own dashboard when done", async () => {
      const user = userEvent.setup();
      renderScreen();

      await user.click(screen.getByRole("button", { name: /this is correct/i }));
      await user.click(
        await screen.findByRole("button", { name: /go to my dashboard/i }),
      );

      expect(navigate).toHaveBeenCalledWith("/dashboard");
    });

    it("sends a school owner to THEIR dashboard, not the parent-only one", async () => {
      // A school owner can be a parent at another school, and the API allows
      // the claim on that basis. `/dashboard` is `allowedRoles={["parent"]}`,
      // so hardcoding it bounced them off the plan they had just activated.
      userRole = "school_owner";
      const user = userEvent.setup();
      renderScreen();

      await user.click(screen.getByRole("button", { name: /this is correct/i }));
      await user.click(
        await screen.findByRole("button", { name: /go to my dashboard/i }),
      );

      expect(navigate).toHaveBeenCalledWith("/school-owner-dashboard");
    });

    it("states the full commitment, not only the instalment size", async () => {
      // This screen is the parent's one chance to refuse before a plan exists
      // (ADR 0006 §5), so it has to say how many payments and when the last one
      // is due — the derived `termEndDate`, which is also the date an unpaid
      // plan starts being treated as defaulting.
      renderScreen();

      // PREVIEW is MONTHLY with 60,000 left: 3 payments of ~20,000.
      expect(
        screen.getByText(/3 monthly payments of about/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/last payment due by/i)).toBeInTheDocument();
    });

    /**
     * The stash survives being signed in, and is dropped when the claim is
     * FINISHED — not on arrival.
     *
     * Clearing on arrival looked equivalent and was not. A parent who signed in
     * with Google has no phone on their account, so the next thing they do is
     * detour to `/profile`; dropping the token on the way in made that trip
     * depend entirely on browser history.
     */
    it("keeps the held token while the claim is still outstanding", async () => {
      renderScreen();

      await waitFor(() => expect(rememberPendingInvite).toHaveBeenCalled());
      expect(clearPendingInvite).not.toHaveBeenCalled();
    });

    it("drops the held token once the invite can no longer be claimed", async () => {
      // Nothing to come back for, so it must not sit in sessionStorage
      // hijacking a later, unrelated sign-in on this tab.
      previewQuery = {
        data: { ...PREVIEW, status: "CLAIMED", canClaim: false },
        isLoading: false,
        isError: false,
      };
      renderScreen();

      await waitFor(() => expect(clearPendingInvite).toHaveBeenCalled());
    });

    it("drops the held token after a successful claim", async () => {
      renderScreen();
      fireEvent.click(screen.getByRole("button", { name: /this is correct/i }));

      await waitFor(() => expect(clearPendingInvite).toHaveBeenCalled());
    });
  });

  /**
   * Signed in with no phone number — the Google sign-in path.
   *
   * This used to be a dead end: the server refused the claim, and the screen
   * rendered a sentence telling the parent to visit a page it gave them no route
   * to. The refusal itself has since been removed — a phone match proved almost
   * nothing while blocking the people this feature is FOR — so the state is now
   * entirely ordinary and the screen must not treat it as special.
   */
  describe("when signed in without a phone number", () => {
    beforeEach(() => {
      userPhoneNumber = null;
    });

    it("offers to confirm, exactly as it would for anyone else", () => {
      renderScreen();

      expect(
        screen.getByRole("button", { name: /this is correct/i }),
      ).toBeInTheDocument();
    });

    it("lets them dispute too", () => {
      renderScreen();

      expect(
        screen.getByRole("button", { name: /this amount is wrong/i }),
      ).toBeInTheDocument();
    });

    it("says nothing about adding a phone number", () => {
      // The old dead end. Holding the link is the whole authorisation now, so
      // asking for a number would be asking for something nothing checks.
      renderScreen();

      expect(
        screen.queryByText(/add your phone number/i),
      ).not.toBeInTheDocument();
    });
  });

  describe("when not signed in", () => {
    beforeEach(() => {
      isAuthenticated = false;
    });

    it("still shows the figures, so the parent knows what they are signing up for", () => {
      renderScreen();
      expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
      expect(screen.getByText("₦60,000")).toBeInTheDocument();
    });

    it("offers sign-in instead of a confirm button", () => {
      renderScreen();

      expect(
        screen.getByRole("button", { name: /sign in to continue/i }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /this is correct/i }),
      ).not.toBeInTheDocument();
    });

    it("holds the token so it survives the sign-up round trip", () => {
      renderScreen();
      expect(rememberPendingInvite).toHaveBeenCalledWith("token-abc");
      expect(clearPendingInvite).not.toHaveBeenCalled();
    });

  });

  describe("disputing", () => {
    it("sends the reason and confirms only after the server accepts", async () => {
      const user = userEvent.setup();
      renderScreen();

      await user.click(screen.getByRole("button", { name: /amount is wrong/i }));
      await user.type(
        screen.getByLabelText(/what is wrong/i),
        "I paid ₦35,000",
      );
      await user.click(screen.getByRole("button", { name: /send to school/i }));

      expect(disputeMutate).toHaveBeenCalledWith({
        token: "token-abc",
        reason: "I paid ₦35,000",
      });
      await waitFor(() =>
        expect(screen.getByText(/sent to your school/i)).toBeInTheDocument(),
      );
    });

    it("will not send an empty reason", async () => {
      const user = userEvent.setup();
      renderScreen();

      await user.click(screen.getByRole("button", { name: /amount is wrong/i }));
      expect(
        screen.getByRole("button", { name: /send to school/i }),
      ).toBeDisabled();
    });

    it("stays on the form when the server refuses the dispute", async () => {
      disputeMutate.mockRejectedValue(new Error("no longer awaiting"));
      disputeState = {
        isPending: false,
        isError: true,
        error: new Error("This invite is no longer awaiting your confirmation."),
      };
      const user = userEvent.setup();
      renderScreen();

      await user.click(screen.getByRole("button", { name: /amount is wrong/i }));
      await user.type(screen.getByLabelText(/what is wrong/i), "wrong");
      await user.click(screen.getByRole("button", { name: /send to school/i }));

      await waitFor(() =>
        expect(screen.getByText(/no longer awaiting/i)).toBeInTheDocument(),
      );
      expect(screen.queryByText(/sent to your school/i)).not.toBeInTheDocument();
    });
  });

  describe("an invite that cannot be claimed", () => {
    it.each([
      ["CLAIMED", /already been used/i],
      ["REVOKED", /cancelled this invite/i],
      ["EXPIRED", /has expired/i],
      ["DISPUTED", /corrected invite/i],
    ])("explains a %s invite instead of offering a button", (status, copy) => {
      previewQuery = {
        data: { ...PREVIEW, status, canClaim: false },
        isLoading: false,
        isError: false,
      };
      renderScreen();

      expect(screen.getByText(copy)).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /this is correct/i }),
      ).not.toBeInTheDocument();
    });
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Cache-invalidation and error-surfacing contract for the invite hooks.
 *
 * The API layer is mocked wholesale — its HTTP shape is covered in
 * `services/enrollmentInvites.test.ts`. What is locked here is what each
 * mutation promises the rest of the app: which cached queries go stale, and
 * which surface a toast. A missing invalidation is a figure on screen that
 * silently stops tracking the server, which is exactly the class of bug the
 * realtime key map exists to prevent.
 */
const api = vi.hoisted(() => ({
  create: vi.fn(),
  list: vi.fn(),
  revoke: vi.fn(),
  amend: vi.fn(),
  preview: vi.fn(),
  claim: vi.fn(),
  dispute: vi.fn(),
}));

vi.mock("../services/enrollmentInvites", () => ({
  EnrollmentInvitesAPI: api,
}));

const showToast = vi.hoisted(() => vi.fn());
vi.mock("../store/uiStore", () => ({
  useUIStore: (selector: (s: { showToast: unknown }) => unknown) =>
    selector({ showToast }),
}));

import {
  useAmendEnrollmentInvite,
  useClaimEnrollmentInvite,
  useCreateEnrollmentInvite,
  useDisputeEnrollmentInvite,
  useEnrollmentInvites,
  useInvitePreview,
  useRevokeEnrollmentInvite,
} from "./useEnrollmentInvites";

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { wrapper, invalidateSpy };
}

/**
 * The leading segment of every key an invalidation hit.
 *
 * React Query matches by prefix and every key in `QUERY_KEYS` leads with its own
 * name, so the first segment is exactly what an invalidation has to reach — the
 * same comparison `useRealtime.test.tsx` makes.
 */
const invalidatedNames = (spy: {
  mock: { calls: unknown[][] };
}): string[] =>
  spy.mock.calls.map((call) =>
    String((call[0] as { queryKey: unknown[] }).queryKey[0]),
  );

describe("enrollment invite hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.list.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 25,
      totalPages: 0,
    });
    api.create.mockResolvedValue({ claimUrl: "https://app/claim-invite?token=x" });
    api.revoke.mockResolvedValue({ id: "invite-1", status: "REVOKED" });
    api.amend.mockResolvedValue({ remainingBalance: 75_000 });
    api.claim.mockResolvedValue({ enrollmentId: "enrollment-1" });
    api.dispute.mockResolvedValue({ id: "invite-1", status: "DISPUTED" });
    api.preview.mockResolvedValue({ studentName: "Ada", canClaim: true });
  });

  describe("useEnrollmentInvites", () => {
    it("keys the cache by status and page so filters do not collide", async () => {
      const { wrapper } = makeWrapper();
      const { result } = renderHook(
        () => useEnrollmentInvites({ status: "PENDING", page: 2 }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(api.list).toHaveBeenCalledWith({
        status: "PENDING",
        page: 2,
        limit: 25,
      });
    });

    it("can be disabled so a non-owner screen does not fetch", () => {
      const { wrapper } = makeWrapper();
      renderHook(() => useEnrollmentInvites({}, false), { wrapper });
      expect(api.list).not.toHaveBeenCalled();
    });
  });

  describe("useCreateEnrollmentInvite", () => {
    it("refreshes the invite list", async () => {
      const { wrapper, invalidateSpy } = makeWrapper();
      const { result } = renderHook(() => useCreateEnrollmentInvite(), {
        wrapper,
      });

      await result.current.mutateAsync({} as never);

      expect(invalidatedNames(invalidateSpy)).toContain("enrollmentInvites");
    });

    it("does NOT toast on success", async () => {
      // The caller has to show the share link — the token is never retrievable
      // again. A success toast would imply the job is finished when the school
      // still has to send it.
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useCreateEnrollmentInvite(), {
        wrapper,
      });

      await result.current.mutateAsync({} as never);

      expect(showToast).not.toHaveBeenCalled();
    });

    it("surfaces a server refusal as a toast", async () => {
      api.create.mockRejectedValue(new Error("fee not published"));
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useCreateEnrollmentInvite(), {
        wrapper,
      });

      await expect(result.current.mutateAsync({} as never)).rejects.toThrow();
      await waitFor(() =>
        expect(showToast).toHaveBeenCalledWith(
          expect.stringContaining("fee not published"),
          "error",
        ),
      );
    });
  });

  describe("useRevokeEnrollmentInvite", () => {
    it("refreshes the list and confirms the slot is free again", async () => {
      const { wrapper, invalidateSpy } = makeWrapper();
      const { result } = renderHook(() => useRevokeEnrollmentInvite(), {
        wrapper,
      });

      await result.current.mutateAsync({ id: "invite-1" });

      expect(invalidatedNames(invalidateSpy)).toContain("enrollmentInvites");
      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining("issue a new one"),
        "success",
      );
    });
  });

  describe("useAmendEnrollmentInvite", () => {
    it("also refreshes the roster and school money figures", async () => {
      // A correction moves a real balance on a live plan, so the invite row is
      // not the only thing that went stale.
      const { wrapper, invalidateSpy } = makeWrapper();
      const { result } = renderHook(() => useAmendEnrollmentInvite(), {
        wrapper,
      });

      await result.current.mutateAsync({
        id: "invite-1",
        dto: { amountAlreadyPaid: 35_000 },
      });

      const names = invalidatedNames(invalidateSpy);
      expect(names).toEqual(
        expect.arrayContaining([
          "enrollmentInvites",
          "schoolStudents",
          "schoolStats",
        ]),
      );
    });
  });

  describe("useClaimEnrollmentInvite", () => {
    it("refreshes everything the parent's dashboard reads", async () => {
      const { wrapper, invalidateSpy } = makeWrapper();
      const { result } = renderHook(() => useClaimEnrollmentInvite(), {
        wrapper,
      });

      await result.current.mutateAsync("token-abc");

      expect(invalidatedNames(invalidateSpy)).toEqual(
        expect.arrayContaining([
          "children",
          "parentDashboardSummary",
          "transactions",
        ]),
      );
    });

    it("toasts the server's reason when a claim is refused", async () => {
      api.claim.mockRejectedValue(new Error("different phone number"));
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useClaimEnrollmentInvite(), {
        wrapper,
      });

      await expect(result.current.mutateAsync("token-abc")).rejects.toThrow();
      await waitFor(() =>
        expect(showToast).toHaveBeenCalledWith(
          expect.stringContaining("different phone number"),
          "error",
        ),
      );
    });
  });

  describe("useDisputeEnrollmentInvite", () => {
    it("reports a failure rather than appearing to have sent", async () => {
      api.dispute.mockRejectedValue(new Error("no longer awaiting"));
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useDisputeEnrollmentInvite(), {
        wrapper,
      });

      await expect(
        result.current.mutateAsync({ token: "t", reason: "wrong" }),
      ).rejects.toThrow();
      await waitFor(() => expect(showToast).toHaveBeenCalled());
    });
  });

  describe("useInvitePreview", () => {
    it("does not fetch without a token", () => {
      const { wrapper } = makeWrapper();
      renderHook(() => useInvitePreview(null), { wrapper });
      expect(api.preview).not.toHaveBeenCalled();
    });

    it("does not retry a dead link", async () => {
      // The failure is almost always expired/revoked/claimed. Retrying just
      // makes the parent wait longer to be told the same thing.
      api.preview.mockRejectedValue(new Error("not valid"));
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useInvitePreview("token-abc"), {
        wrapper,
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(api.preview).toHaveBeenCalledTimes(1);
    });
  });
});

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  EnrollmentInvitesAPI,
  type EnrollmentInviteStatus,
} from "../services/enrollmentInvites";
import type {
  AmendMigratedPaymentDto,
  CreateEnrollmentInviteDto,
} from "../services/apiTypes";
import { QUERY_KEYS } from "./useQueries";
import { useUIStore } from "../store/uiStore";
import { getErrorMessage } from "../utils/errors";

/**
 * React Query bindings for enrollment invites.
 *
 * Kept out of `useQueries.ts`, which is already the largest hook file in the
 * repo, but the KEY lives in `QUERY_KEYS` — realtime invalidation is pinned
 * against that object by `useRealtime.test.tsx`, so a key defined privately here
 * would silently stop refreshing when a parent claims an invite.
 */

/** One page of the owner's invites, filtered by status. */
export const useEnrollmentInvites = (
  filters: { status?: EnrollmentInviteStatus; page?: number } = {},
  enabled = true,
) =>
  useQuery({
    queryKey: [...QUERY_KEYS.enrollmentInvites, filters.status ?? "ALL", filters.page ?? 1],
    queryFn: () =>
      EnrollmentInvitesAPI.list({
        status: filters.status,
        page: filters.page,
        limit: 25,
      }),
    enabled,
  });

/**
 * Issue an invite.
 *
 * Deliberately does NOT toast on success: the caller needs the returned
 * `claimUrl` on screen, because the raw token is never retrievable again, and a
 * toast would imply the job is done when the school still has to send the link.
 */
export const useCreateEnrollmentInvite = () => {
  const queryClient = useQueryClient();
  const showToast = useUIStore((state) => state.showToast);

  return useMutation({
    mutationFn: (dto: CreateEnrollmentInviteDto) =>
      EnrollmentInvitesAPI.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.enrollmentInvites,
      });
    },
    onError: (error) => showToast(getErrorMessage(error), "error"),
  });
};

/**
 * Send a new link for an existing invite.
 *
 * Deliberately does NOT toast on success, for the same reason
 * `useCreateEnrollmentInvite` does not: the caller has to put the returned
 * `claimUrl` on screen, because the raw token is never retrievable again. A
 * toast would say "done" at the exact moment the school still has to copy
 * something.
 */
export const useReissueEnrollmentInvite = () => {
  const queryClient = useQueryClient();
  const showToast = useUIStore((state) => state.showToast);

  return useMutation({
    mutationFn: (id: string) => EnrollmentInvitesAPI.reissue(id),
    onSuccess: () => {
      // The row's status and expiry both moved (an EXPIRED invite is PENDING
      // again), so the list is stale even though nothing was created.
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.enrollmentInvites,
      });
    },
    onError: (error) => showToast(getErrorMessage(error), "error"),
  });
};

export const useRevokeEnrollmentInvite = () => {
  const queryClient = useQueryClient();
  const showToast = useUIStore((state) => state.showToast);

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      EnrollmentInvitesAPI.revoke(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.enrollmentInvites,
      });
      showToast("Invite cancelled. You can issue a new one.", "success");
    },
    onError: (error) => showToast(getErrorMessage(error), "error"),
  });
};

/**
 * Remove a plan that the wrong person claimed.
 *
 * Invalidates the roster and the school's money figures as well as the invite
 * list: the plan is gone, so the student count, the outstanding balance and the
 * collections all move with it.
 */
export const useReleaseEnrollmentInvite = () => {
  const queryClient = useQueryClient();
  const showToast = useUIStore((state) => state.showToast);

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      EnrollmentInvitesAPI.release(id, reason),
    onSuccess: () => {
      for (const key of [
        QUERY_KEYS.enrollmentInvites,
        QUERY_KEYS.schoolStudents,
        QUERY_KEYS.schoolStats,
      ]) {
        queryClient.invalidateQueries({ queryKey: key });
      }
      showToast(
        "Plan removed. You can now send a new invite for this student.",
        "success",
      );
    },
    onError: (error) => showToast(getErrorMessage(error), "error"),
  });
};

/** Correct the already-paid figure on a plan that has already been claimed. */
export const useAmendEnrollmentInvite = () => {
  const queryClient = useQueryClient();
  const showToast = useUIStore((state) => state.showToast);

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: AmendMigratedPaymentDto }) =>
      EnrollmentInvitesAPI.amend(id, dto),
    onSuccess: () => {
      // The correction moves a real balance, so the roster and the school's
      // money figures are stale too — not just the invite row.
      for (const key of [
        QUERY_KEYS.enrollmentInvites,
        QUERY_KEYS.schoolStudents,
        QUERY_KEYS.schoolStats,
      ]) {
        queryClient.invalidateQueries({ queryKey: key });
      }
      showToast("Amount corrected. The parent has been notified.", "success");
    },
    onError: (error) => showToast(getErrorMessage(error), "error"),
  });
};

/**
 * A short, stable fingerprint of a claim token, for use as a cache key.
 *
 * The key has one job — tell two different tokens apart so a second invite
 * cannot be served the first one's cached preview — and the raw token does that
 * job while also writing a bearer credential into React Query's cache, where
 * the Devtools panel displays every key verbatim and any future state-dumping
 * error reporter would collect it. `utils/logger.ts` already redacts a field
 * named `token` for exactly this reason; a cache key should not be the one
 * place it survives.
 *
 * Deliberately NOT a cryptographic hash. This is not a secrecy boundary — the
 * token is in the address bar either way — it is the same hygiene as the redact
 * list, and a 32-bit digest distinguishes the one or two tokens a session ever
 * sees without dragging SubtleCrypto's async API into a query key. (djb2.)
 */
const tokenFingerprint = (token: string): string => {
  let hash = 5381;
  for (let i = 0; i < token.length; i++) {
    hash = ((hash << 5) + hash + token.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16);
};

/**
 * Read an invite from its token.
 *
 * `retry: false` on purpose. The failure here is almost always a dead link —
 * expired, revoked, already claimed — and retrying a 404 three times just makes
 * the parent wait longer to be told the same thing.
 */
export const useInvitePreview = (token: string | null) =>
  useQuery({
    queryKey: ["invitePreview", token ? tokenFingerprint(token) : ""],
    queryFn: () => EnrollmentInvitesAPI.preview(token as string),
    enabled: !!token,
    retry: false,
    staleTime: 0,
  });

export const useClaimEnrollmentInvite = () => {
  const queryClient = useQueryClient();
  const showToast = useUIStore((state) => state.showToast);

  return useMutation({
    mutationFn: (token: string) => EnrollmentInvitesAPI.claim(token),
    onSuccess: () => {
      // The parent now has a plan they did not have a moment ago.
      for (const key of [
        QUERY_KEYS.children,
        QUERY_KEYS.parentDashboardSummary,
        QUERY_KEYS.transactions,
      ]) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
    onError: (error) => showToast(getErrorMessage(error), "error"),
  });
};

export const useDisputeEnrollmentInvite = () => {
  const showToast = useUIStore((state) => state.showToast);

  return useMutation({
    mutationFn: ({ token, reason }: { token: string; reason: string }) =>
      EnrollmentInvitesAPI.dispute(token, reason),
    onError: (error) => showToast(getErrorMessage(error), "error"),
  });
};

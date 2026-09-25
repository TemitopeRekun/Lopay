import { apiClient } from "./backend";
import type {
  AmendMigratedPaymentDto,
  CreateEnrollmentInviteDto,
} from "./apiTypes";

/**
 * Enrollment invites — the API surface for onboarding parents who paid their
 * school before it adopted Lopay.
 *
 * Request bodies come from the generated OpenAPI types, so a backend rename
 * surfaces here as a type error after the next `npm run generate:types` rather
 * than as a 400 in production. Responses are declared locally because the
 * backend returns projections (`SchoolInviteView` / `ParentInviteView`) rather
 * than DTO classes, so Nest cannot describe them in the spec; the e2e suite on
 * the server pins their shape.
 *
 * Money crosses this boundary as naira — the server converts from integer kobo
 * at its own edge (ADR 0001), and nothing here does arithmetic on it.
 */

/** Header the preview endpoint reads the claim token from. */
const INVITE_TOKEN_HEADER = "x-invite-token";

export type EnrollmentInviteStatus =
  | "PENDING"
  | "DISPUTED"
  | "CLAIMED"
  | "REVOKED"
  | "EXPIRED";

export type InstallmentFrequency = "WEEKLY" | "MONTHLY";

/** One row of the school owner's invite list. */
export interface SchoolInvite {
  id: string;
  studentName: string;
  className: string;
  totalFee: number;
  amountAlreadyPaid: number;
  remainingBalance: number;
  parentPhone: string;
  installmentFrequency: InstallmentFrequency;
  planStartDate: string;
  termEndDate: string;
  expiresAt: string;
  status: EnrollmentInviteStatus;
  isLive: boolean;
  disputeReason: string | null;
  disputedAt: string | null;
  revokedAt: string | null;
  claimedAt: string | null;
  createdAt: string;
  enrollmentId: string | null;
  /** Who claimed it, so the school can tell the link reached the right family. */
  claimedByName: string | null;
  /**
   * Whether that person's phone was the number the invite was addressed to.
   * A signal, not a verdict — holding the link is the whole authorisation.
   * `null` means not claimed.
   */
  claimantPhoneMatched: boolean | null;
}

/**
 * What the parent sees before signing in. Deliberately thinner than
 * `SchoolInvite` — no phone number, no ids. See `invite-view.ts` on the server.
 */
export interface InvitePreview {
  studentName: string;
  className: string;
  schoolName: string | null;
  totalFee: number;
  amountAlreadyPaid: number;
  remainingBalance: number;
  installmentFrequency: InstallmentFrequency;
  planStartDate: string;
  termEndDate: string;
  expiresAt: string;
  status: EnrollmentInviteStatus;
  canClaim: boolean;
}

/**
 * The response to creating an invite.
 *
 * `claimUrl` carries the raw token and is the ONLY time it is ever returned —
 * it is stored hashed and no other endpoint can reproduce it. If the school
 * loses the link, the remedy is to revoke and re-issue, which is why the UI
 * puts the share action in front of them immediately.
 */
export interface CreatedInvite {
  invite: SchoolInvite;
  claimUrl: string;
  /** Pre-written text the school pastes alongside the link. */
  message: string;
  expiresAt: string;
}

export interface ClaimResult {
  enrollmentId: string;
  studentName: string;
  className: string;
  schoolName: string;
  totalFee: number;
  amountAlreadyPaid: number;
  remainingBalance: number;
  paymentStatus: string;
  planStartDate: string;
}

/**
 * How long this school may still ISSUE invites.
 *
 * Migration is free, priced as one-time acquisition — the family's next term is
 * a normal paid enrollment — so issuing is bounded per school. It rides on the
 * list response rather than needing its own call, because the screen has to
 * state it BEFORE the owner fills in a form: a rule the UI only reveals by
 * being refused is a rule the UI has failed to explain.
 *
 * It bounds ISSUING only. A parent can still claim a link sent before it closed.
 */
export interface MigrationWindow {
  closesAt: string;
  daysRemaining: number;
  isOpen: boolean;
}

export interface InvitePage {
  items: SchoolInvite[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  migrationWindow: MigrationWindow;
}

export const EnrollmentInvitesAPI = {
  // ------------------------------ school owner ------------------------------

  create: async (dto: CreateEnrollmentInviteDto): Promise<CreatedInvite> => {
    const response = await apiClient.post<CreatedInvite>(
      "/enrollment-invites",
      dto,
    );
    return response.data;
  },

  list: async (params: {
    status?: EnrollmentInviteStatus;
    page?: number;
    limit?: number;
  }): Promise<InvitePage> => {
    const response = await apiClient.get<InvitePage>("/enrollment-invites", {
      params,
    });
    return response.data;
  },

  revoke: async (id: string, reason?: string) => {
    const response = await apiClient.post<{
      id: string;
      status: EnrollmentInviteStatus;
    }>(`/enrollment-invites/${id}/revoke`, reason ? { reason } : {});
    return response.data;
  },

  /**
   * Remove a plan claimed by the wrong person and free the student.
   *
   * Distinct from `revoke`, which cancels a link nobody has used. This one
   * deletes a live plan, so the UI asks for confirmation before calling it.
   */
  release: async (id: string, reason?: string) => {
    const response = await apiClient.post<{
      id: string;
      status: EnrollmentInviteStatus;
    }>(`/enrollment-invites/${id}/release`, reason ? { reason } : {});
    return response.data;
  },

  amend: async (id: string, dto: AmendMigratedPaymentDto) => {
    const response = await apiClient.post<{
      enrollmentId: string;
      previousAmount: number;
      amountAlreadyPaid: number;
      remainingBalance: number;
      paymentStatus: string;
    }>(`/enrollment-invites/${id}/amend`, dto);
    return response.data;
  },

  // --------------------------------- parent ---------------------------------

  /**
   * Read an invite from its token, before the visitor has signed in.
   *
   * The token goes in a header rather than the query string: it is a bearer
   * credential, and query strings are written to access logs, kept in browser
   * history and leaked through `Referer`.
   */
  preview: async (token: string): Promise<InvitePreview> => {
    const response = await apiClient.get<InvitePreview>(
      "/enrollment-invites/preview",
      { headers: { [INVITE_TOKEN_HEADER]: token } },
    );
    return response.data;
  },

  claim: async (token: string): Promise<ClaimResult> => {
    const response = await apiClient.post<ClaimResult>(
      "/enrollment-invites/claim",
      { token },
    );
    return response.data;
  },

  dispute: async (token: string, reason: string) => {
    const response = await apiClient.post<{
      id: string;
      status: EnrollmentInviteStatus;
    }>("/enrollment-invites/dispute", { token, reason });
    return response.data;
  },
};

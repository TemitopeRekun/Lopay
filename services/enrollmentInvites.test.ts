import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * HTTP contract for enrollment invites.
 *
 * The assertions that matter most here are about WHERE the claim token travels.
 * It is a bearer credential: put it in a query string and it lands in
 * reverse-proxy access logs, browser history and the `Referer` header of the
 * next navigation. So it goes in the body on the two POSTs and in a header on
 * the GET preview (which has no body), and these tests fail if that ever
 * regresses to `?token=`.
 */
const { post, get, patch } = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
}));

vi.mock("axios", () => ({
  default: {
    create: () => ({
      post,
      get,
      patch,
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    }),
  },
}));

import { EnrollmentInvitesAPI } from "./enrollmentInvites";

const TOKEN = "Zm9vYmFyLXRva2VuLXZhbHVlLWZvci10ZXN0cw";

describe("EnrollmentInvitesAPI", () => {
  beforeEach(() => {
    post.mockReset().mockResolvedValue({ data: { ok: true } });
    get.mockReset().mockResolvedValue({ data: { ok: true } });
    patch.mockReset();
  });

  describe("token handling", () => {
    it("sends the preview token in a header, never the URL", async () => {
      await EnrollmentInvitesAPI.preview(TOKEN);

      expect(get).toHaveBeenCalledWith("/enrollment-invites/preview", {
        headers: { "x-invite-token": TOKEN },
      });
      const [url, config] = get.mock.calls[0];
      expect(url).not.toContain(TOKEN);
      expect(JSON.stringify(config?.params ?? {})).not.toContain(TOKEN);
    });

    it("sends the claim token in the body, never the URL", async () => {
      await EnrollmentInvitesAPI.claim(TOKEN);

      expect(post).toHaveBeenCalledWith("/enrollment-invites/claim", {
        token: TOKEN,
      });
      expect(post.mock.calls[0][0]).not.toContain(TOKEN);
    });

    it("sends the dispute token and reason in the body", async () => {
      await EnrollmentInvitesAPI.dispute(TOKEN, "I paid more");

      expect(post).toHaveBeenCalledWith("/enrollment-invites/dispute", {
        token: TOKEN,
        reason: "I paid more",
      });
      expect(post.mock.calls[0][0]).not.toContain(TOKEN);
    });
  });

  describe("school-side operations", () => {
    it("POSTs a new invite to the collection route", async () => {
      const dto = {
        studentName: "Ada Lovelace",
        className: "Basic 1",
        amountAlreadyPaid: 40_000,
        parentPhone: "08012345678",
        installmentFrequency: "MONTHLY" as const,
        planStartDate: "2026-09-19T12:00:00.000Z",
        termEndDate: "2026-12-19T12:00:00.000Z",
      };

      await EnrollmentInvitesAPI.create(dto);

      expect(post).toHaveBeenCalledWith("/enrollment-invites", dto);
    });

    it("passes list filters as query params", async () => {
      await EnrollmentInvitesAPI.list({ status: "PENDING", page: 2, limit: 25 });

      expect(get).toHaveBeenCalledWith("/enrollment-invites", {
        params: { status: "PENDING", page: 2, limit: 25 },
      });
    });

    it("omits a reason from a revoke that has none", async () => {
      // Sending `{ reason: undefined }` serialises to `{}` anyway, but being
      // explicit keeps the request body honest about what the school supplied.
      await EnrollmentInvitesAPI.revoke("invite-1");

      expect(post).toHaveBeenCalledWith(
        "/enrollment-invites/invite-1/revoke",
        {},
      );
    });

    it("includes a revoke reason when given", async () => {
      await EnrollmentInvitesAPI.revoke("invite-1", "wrong number");

      expect(post).toHaveBeenCalledWith("/enrollment-invites/invite-1/revoke", {
        reason: "wrong number",
      });
    });

    it("POSTs an amendment to the invite's amend route", async () => {
      await EnrollmentInvitesAPI.amend("invite-1", {
        amountAlreadyPaid: 35_000,
        reason: "bank statement",
      });

      expect(post).toHaveBeenCalledWith("/enrollment-invites/invite-1/amend", {
        amountAlreadyPaid: 35_000,
        reason: "bank statement",
      });
    });

    it("encodes nothing into the path beyond the id", async () => {
      await EnrollmentInvitesAPI.revoke("../../admin");
      // No path traversal: the caller supplies an id from a server response, and
      // the route shape is fixed. Pinned so a future refactor to string
      // concatenation of user input is visible.
      expect(post.mock.calls[0][0]).toBe(
        "/enrollment-invites/../../admin/revoke",
      );
    });
  });

  describe("responses", () => {
    it("unwraps the axios envelope", async () => {
      get.mockResolvedValue({ data: { studentName: "Ada", canClaim: true } });
      await expect(EnrollmentInvitesAPI.preview(TOKEN)).resolves.toEqual({
        studentName: "Ada",
        canClaim: true,
      });
    });

    it("propagates a rejection rather than swallowing it", async () => {
      post.mockRejectedValue(new Error("403"));
      await expect(EnrollmentInvitesAPI.claim(TOKEN)).rejects.toThrow("403");
    });
  });
});

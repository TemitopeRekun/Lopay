import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Coverage for the BackendAPI HTTP client outside the school sub-API (which is
 * locked down in backend.school.test.ts). axios is mocked so no real request is
 * made; each method is asserted to hit the right URL + payload and to return the
 * unwrapped `response.data`. The request/response interceptors are captured from
 * the mocked `interceptors.*.use` calls and exercised directly.
 */
const { get, post, patch, del, requestUse, responseUse } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
  requestUse: vi.fn(),
  responseUse: vi.fn(),
}));

vi.mock("axios", () => ({
  default: {
    create: () => ({
      get,
      post,
      patch,
      delete: del,
      interceptors: {
        request: { use: requestUse },
        response: { use: responseUse },
      },
    }),
  },
}));

import { BackendAPI, API_URL } from "./backend";

const data = (d: unknown) => ({ data: d });

beforeEach(() => {
  get.mockReset().mockResolvedValue(data({}));
  post.mockReset().mockResolvedValue(data({}));
  patch.mockReset().mockResolvedValue(data({}));
  del.mockReset().mockResolvedValue(data({}));
});

describe("module exports", () => {
  it("exposes a default API_URL", () => {
    expect(typeof API_URL).toBe("string");
  });

  // PLATFORM_BANK / getPlatformActivationBankDetails are gone: the platform's own
  // account number no longer lives in the client, and the manual first-payment
  // transfer it fed was removed from the backend. Bank details come from the server.
  it("no longer hardcodes any bank details", async () => {
    const mod: Record<string, unknown> = await import("./backend");
    expect(mod.PLATFORM_BANK).toBeUndefined();
    expect(mod.getPlatformActivationBankDetails).toBeUndefined();
  });
});

describe("BackendAPI.users", () => {
  it("getMe GETs /users/me", async () => {
    get.mockResolvedValueOnce(data({ id: "me" }));
    const res = await BackendAPI.users.getMe();
    expect(get).toHaveBeenCalledWith("/users/me");
    expect(res).toEqual({ id: "me" });
  });

  it("updateMe PATCHes /users/me with the profile patch", async () => {
    await BackendAPI.users.updateMe({ fullName: "New", phoneNumber: "0803" });
    expect(patch).toHaveBeenCalledWith("/users/me", {
      fullName: "New",
      phoneNumber: "0803",
    });
  });

  it("get GETs /users/:id", async () => {
    get.mockResolvedValueOnce(data({ id: "u1" }));
    const res = await BackendAPI.users.get("u1");
    expect(get).toHaveBeenCalledWith("/users/u1");
    expect(res).toEqual({ id: "u1" });
  });

  it("update PATCHes /users/:id with the user body", async () => {
    await BackendAPI.users.update({ id: "u2", name: "X" } as any);
    expect(patch).toHaveBeenCalledWith("/users/u2", { id: "u2", name: "X" });
  });
});

describe("BackendAPI.admin", () => {
  it("onboardSchool POSTs /admin/onboard-school", async () => {
    const body = {
      schoolName: "S",
      ownerEmail: "o@e.com",
      ownerName: "O",
      address: "A",
      phone: "P",
      bankName: "B",
      bankCode: "001",
      accountName: "AN",
      accountNumber: "0011",
    };
    await BackendAPI.admin.onboardSchool(body);
    expect(post).toHaveBeenCalledWith("/admin/onboard-school", body);
  });

  it("deleteSchool DELETEs /schools/:id", async () => {
    await BackendAPI.admin.deleteSchool("s1");
    expect(del).toHaveBeenCalledWith("/schools/s1");
  });

  it("updateSchool PATCHes /schools/:id", async () => {
    await BackendAPI.admin.updateSchool({ id: "s1", name: "New" } as any);
    expect(patch).toHaveBeenCalledWith("/schools/s1", { id: "s1", name: "New" });
  });

  it("deleteUser DELETEs /users/:id", async () => {
    await BackendAPI.admin.deleteUser("u1");
    expect(del).toHaveBeenCalledWith("/users/u1");
  });

  it("getUsers GETs /users", async () => {
    get.mockResolvedValueOnce(data([{ id: "u1" }]));
    const res = await BackendAPI.admin.getUsers();
    expect(get).toHaveBeenCalledWith("/users");
    expect(res).toEqual([{ id: "u1" }]);
  });

  it("broadcast POSTs title + message", async () => {
    await BackendAPI.admin.broadcast("T", "M");
    expect(post).toHaveBeenCalledWith("/notifications/broadcast", {
      title: "T",
      message: "M",
    });
  });

  it("getPendingFirstPayments GETs with signed-url + paging params", async () => {
    await BackendAPI.admin.getPendingFirstPayments({ page: 2, limit: 10 });
    expect(get).toHaveBeenCalledWith("/admin/pending-first-payments", {
      params: { includeReceiptSignedUrls: true, page: 2, limit: 10 },
    });
  });

  it("getPendingFirstPayments defaults params when none are given", async () => {
    await BackendAPI.admin.getPendingFirstPayments();
    expect(get).toHaveBeenCalledWith("/admin/pending-first-payments", {
      params: { includeReceiptSignedUrls: true },
    });
  });

  it("getPendingInstallments GETs with signed-url param", async () => {
    await BackendAPI.admin.getPendingInstallments({ page: 1 });
    expect(get).toHaveBeenCalledWith("/admin/pending-installments", {
      params: { includeReceiptSignedUrls: true, page: 1 },
    });
  });

  it("getPlatformRevenue GETs /admin/revenue", async () => {
    get.mockResolvedValueOnce(data({ totalRevenue: 5 }));
    const res = await BackendAPI.admin.getPlatformRevenue();
    expect(get).toHaveBeenCalledWith("/admin/revenue");
    expect(res).toEqual({ totalRevenue: 5 });
  });

  it("getAllTransactions GETs /admin/transactions with params", async () => {
    await BackendAPI.admin.getAllTransactions({ receiptType: "ALL", page: 1 });
    expect(get).toHaveBeenCalledWith("/admin/transactions", {
      params: { receiptType: "ALL", page: 1 },
    });
  });

  it("getAllTransactions passes undefined params when omitted", async () => {
    await BackendAPI.admin.getAllTransactions();
    expect(get).toHaveBeenCalledWith("/admin/transactions", {
      params: undefined,
    });
  });

  it("getStudentsSummary GETs /admin/students/summary", async () => {
    await BackendAPI.admin.getStudentsSummary();
    expect(get).toHaveBeenCalledWith("/admin/students/summary");
  });

  it("getSchoolsSummary GETs /admin/schools/summary", async () => {
    await BackendAPI.admin.getSchoolsSummary();
    expect(get).toHaveBeenCalledWith("/admin/schools/summary");
  });

  it("getOverview GETs /admin/overview with no range by default", async () => {
    await BackendAPI.admin.getOverview();
    expect(get).toHaveBeenCalledWith("/admin/overview", { params: undefined });
  });

  it("getOverview forwards the range so the chart toggle hits the server", async () => {
    await BackendAPI.admin.getOverview("weekly");
    expect(get).toHaveBeenCalledWith("/admin/overview", {
      params: { range: "weekly" },
    });
  });

  it("getSchoolStudents GETs /admin/schools/:id/students with params", async () => {
    await BackendAPI.admin.getSchoolStudents("s1", { search: "a", page: 1 });
    expect(get).toHaveBeenCalledWith("/admin/schools/s1/students", {
      params: { search: "a", page: 1 },
    });
  });

  it("settleFirstPayment POSTs the settle endpoint", async () => {
    await BackendAPI.admin.settleFirstPayment("p1");
    expect(post).toHaveBeenCalledWith("/admin/settle-first-payment/p1");
  });

  it("rejectFirstPayment POSTs the reject endpoint", async () => {
    await BackendAPI.admin.rejectFirstPayment("p1");
    expect(post).toHaveBeenCalledWith("/admin/reject-first-payment/p1");
  });

  it("getAuditLogs returns just the items array from the envelope", async () => {
    get.mockResolvedValueOnce(
      data({ items: [{ id: "a1" }, { id: "a2" }], total: 2 }),
    );
    const res = await BackendAPI.admin.getAuditLogs({ take: 5 });
    expect(get).toHaveBeenCalledWith("/audit-logs", { params: { take: 5 } });
    expect(res).toEqual([{ id: "a1" }, { id: "a2" }]);
  });

  it("getBanks GETs the Paystack bank list", async () => {
    get.mockResolvedValueOnce(data([{ name: "GTB", code: "058", currency: "NGN" }]));
    const res = await BackendAPI.admin.getBanks();
    expect(get).toHaveBeenCalledWith("/admin/paystack/banks");
    expect(res).toEqual([{ name: "GTB", code: "058", currency: "NGN" }]);
  });

  it("resolveAccount POSTs the account/bank to resolve", async () => {
    post.mockResolvedValueOnce(data({ accountName: "N", accountNumber: "0011" }));
    const res = await BackendAPI.admin.resolveAccount("0011", "058");
    expect(post).toHaveBeenCalledWith("/admin/paystack/resolve-account", {
      accountNumber: "0011",
      bankCode: "058",
    });
    expect(res).toEqual({ accountName: "N", accountNumber: "0011" });
  });

  it("createSubaccount POSTs the school subaccount endpoint", async () => {
    await BackendAPI.admin.createSubaccount("s1");
    expect(post).toHaveBeenCalledWith("/admin/schools/s1/paystack-subaccount");
  });
});

describe("BackendAPI.school (non-ledger reads/writes)", () => {
  it("getStats GETs /school-payments/stats", async () => {
    await BackendAPI.school.getStats();
    expect(get).toHaveBeenCalledWith("/school-payments/stats");
  });

  it("getPendingPayments GETs with the signed-url param", async () => {
    await BackendAPI.school.getPendingPayments();
    expect(get).toHaveBeenCalledWith("/school-payments/pending", {
      params: { includeReceiptSignedUrls: true },
    });
  });

  it("getStudents GETs /school-payments/students with params", async () => {
    await BackendAPI.school.getStudents({ search: "x" });
    expect(get).toHaveBeenCalledWith("/school-payments/students", {
      params: { search: "x" },
    });
  });

  it("getTransactions GETs the history with signed urls", async () => {
    await BackendAPI.school.getTransactions();
    expect(get).toHaveBeenCalledWith("/school-payments/history", {
      params: { includeReceiptSignedUrls: true },
    });
  });

  it("updateFee POSTs class + amount without schoolId when omitted", async () => {
    await BackendAPI.school.updateFee("JSS1", 5000);
    expect(post).toHaveBeenCalledWith("/school-payments/fees", {
      className: "JSS1",
      feeAmount: 5000,
    });
  });

  it("updateFee includes schoolId when provided", async () => {
    await BackendAPI.school.updateFee("JSS1", 5000, "s1");
    expect(post).toHaveBeenCalledWith("/school-payments/fees", {
      className: "JSS1",
      feeAmount: 5000,
      schoolId: "s1",
    });
  });

  it("updateStudentStatus PATCHes the status endpoint", async () => {
    await BackendAPI.school.updateStudentStatus("st1", "ACTIVE");
    expect(patch).toHaveBeenCalledWith("/school-payments/students/st1/status", {
      status: "ACTIVE",
    });
  });
});

describe("BackendAPI.public", () => {
  it("getSchools GETs /schools", async () => {
    get.mockResolvedValueOnce(data([{ id: "s1" }]));
    const res = await BackendAPI.public.getSchools();
    expect(get).toHaveBeenCalledWith("/schools");
    expect(res).toEqual([{ id: "s1" }]);
  });

  it("getSchoolFees GETs the fees for a school", async () => {
    await BackendAPI.public.getSchoolFees("s1");
    expect(get).toHaveBeenCalledWith("/school-payments/fees/s1");
  });

  it("getSchoolBankDetails GETs the bank details for a school", async () => {
    await BackendAPI.public.getSchoolBankDetails("s1");
    expect(get).toHaveBeenCalledWith("/school-payments/bank-details/s1");
  });

  it("calculatePaymentPlan POSTs the calculation payload", async () => {
    const payload = {
      schoolId: "s1",
      totalAmount: 1000,
      feeType: "TERM",
      grade: "JSS1",
    };
    await BackendAPI.public.calculatePaymentPlan(payload);
    expect(post).toHaveBeenCalledWith("/payment/calculate-structure", payload);
  });
});

describe("BackendAPI.parent", () => {
  it("getChildren GETs the cache-busted my-children endpoint", async () => {
    await BackendAPI.parent.getChildren();
    expect(get).toHaveBeenCalledWith(
      expect.stringContaining("/enrollments/my-children?t="),
    );
  });

  // `enroll` (POST /enrollments) and `deleteChild` (DELETE /enrollments/:id) are
  // gone — neither route exists on the backend, so both could only 404.
  it("exposes no client for the removed enrollment routes", () => {
    const parent = BackendAPI.parent as Record<string, unknown>;
    expect(parent.enroll).toBeUndefined();
    expect(parent.deleteChild).toBeUndefined();
  });

  it("initiateFirstPayment POSTs the initiate endpoint", async () => {
    const body = {
      schoolId: "s1",
      className: "JSS1",
      installmentFrequency: "MONTHLY",
      firstPaymentPaid: 500,
      termStartDate: "2026-01-01",
      termEndDate: "2026-06-01",
    };
    post.mockResolvedValueOnce(data({ reference: "ref", accessCode: "ac" }));
    const res = await BackendAPI.parent.initiateFirstPayment(body);
    expect(post).toHaveBeenCalledWith("/enrollments/initiate-first-payment", body);
    expect(res).toEqual({ reference: "ref", accessCode: "ac" });
  });

  it("verifyPaystack GETs the verify endpoint with the reference param", async () => {
    await BackendAPI.parent.verifyPaystack("ref-1");
    expect(get).toHaveBeenCalledWith("/payments/paystack/verify", {
      params: { reference: "ref-1" },
    });
  });

  it("payInstallment POSTs the installment payload", async () => {
    await BackendAPI.parent.payInstallment("e1", 200, "receipt", "idem");
    expect(post).toHaveBeenCalledWith("/enrollments/pay-installment", {
      enrollmentId: "e1",
      amountPaid: 200,
      receiptUrl: "receipt",
      idempotencyKey: "idem",
    });
  });

  it("getHistory GETs /transactions with signed urls", async () => {
    await BackendAPI.parent.getHistory();
    expect(get).toHaveBeenCalledWith("/transactions", {
      params: { includeReceiptSignedUrls: true },
    });
  });
});

describe("BackendAPI.notifications", () => {
  it("get GETs /notifications", async () => {
    await BackendAPI.notifications.get();
    expect(get).toHaveBeenCalledWith("/notifications");
  });

  it("markRead PATCHes /notifications/:id/read", async () => {
    await BackendAPI.notifications.markRead("n1");
    expect(patch).toHaveBeenCalledWith("/notifications/n1/read");
  });

  it("markAllRead PATCHes /notifications/read-all", async () => {
    await BackendAPI.notifications.markAllRead();
    expect(patch).toHaveBeenCalledWith("/notifications/read-all");
  });
});

describe("BackendAPI.documents.receipts", () => {
  it("createUploadUrl POSTs the upload-url endpoint and returns data", async () => {
    post.mockResolvedValueOnce(data({ path: "p", signedUrl: "s" }));
    const res = await BackendAPI.documents.receipts.createUploadUrl({
      fileName: "f.jpg",
    } as any);
    expect(post).toHaveBeenCalledWith("/documents/receipts/upload-url", {
      fileName: "f.jpg",
    });
    expect(res).toEqual({ path: "p", signedUrl: "s" });
  });

  it("createDownloadUrl POSTs the download-url endpoint and returns data", async () => {
    post.mockResolvedValueOnce(data({ path: "p", signedUrl: "s" }));
    const res = await BackendAPI.documents.receipts.createDownloadUrl({
      path: "p",
    } as any);
    expect(post).toHaveBeenCalledWith("/documents/receipts/download-url", {
      path: "p",
    });
    expect(res).toEqual({ path: "p", signedUrl: "s" });
  });
});

describe("axios interceptors", () => {
  it("registered a request and a response interceptor at module load", () => {
    expect(requestUse).toHaveBeenCalledTimes(1);
    expect(responseUse).toHaveBeenCalledTimes(1);
  });

  it("request interceptor attaches a bearer token (default web = bearer mode)", () => {
    const onRequest = requestUse.mock.calls[0][0] as (c: any) => any;
    localStorage.setItem("accessToken", "tok-123");
    const config = onRequest({ url: "/users/me", headers: {} });
    expect(config.headers.Authorization).toBe("Bearer tok-123");
    localStorage.removeItem("accessToken");
  });

  it("request interceptor does not attach the token to /schools", () => {
    const onRequest = requestUse.mock.calls[0][0] as (c: any) => any;
    localStorage.setItem("accessToken", "tok-123");
    const config = onRequest({ url: "/schools", headers: {} });
    expect(config.headers.Authorization).toBeUndefined();
    localStorage.removeItem("accessToken");
  });

  it("request interceptor leaves headers untouched with no token", () => {
    const onRequest = requestUse.mock.calls[0][0] as (c: any) => any;
    localStorage.removeItem("accessToken");
    const config = onRequest({ url: "/users/me", headers: {} });
    expect(config.headers.Authorization).toBeUndefined();
  });

  it("response success handler passes the response through", () => {
    const onSuccess = responseUse.mock.calls[0][0] as (r: any) => any;
    const response = { data: 1 };
    expect(onSuccess(response)).toBe(response);
  });

  it("response error handler dispatches lopay:unauthorized on 401", async () => {
    const onError = responseUse.mock.calls[0][1] as (e: any) => Promise<never>;
    const spy = vi.fn();
    window.addEventListener("lopay:unauthorized", spy);
    const err = { response: { status: 401 } };
    await expect(onError(err)).rejects.toBe(err);
    expect(spy).toHaveBeenCalledTimes(1);
    window.removeEventListener("lopay:unauthorized", spy);
  });

  it("response error handler rejects without dispatching for non-401", async () => {
    const onError = responseUse.mock.calls[0][1] as (e: any) => Promise<never>;
    const spy = vi.fn();
    window.addEventListener("lopay:unauthorized", spy);
    const err = { response: { status: 500 } };
    await expect(onError(err)).rejects.toBe(err);
    expect(spy).not.toHaveBeenCalled();
    window.removeEventListener("lopay:unauthorized", spy);
  });
});

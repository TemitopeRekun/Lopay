import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// authClient resolves its auth mode once at module load, so each mode is tested
// by resetting the module registry and re-importing with a different getAuthMode.
const A = vi.hoisted(() => ({
  createAuthClient: vi.fn((opts: any) => ({ __opts: opts })),
  getAuthMode: vi.fn(),
}));

vi.mock("./backend", () => ({ API_URL: "http://api.example" }));
vi.mock("better-auth/client", () => ({
  createAuthClient: (o: any) => A.createAuthClient(o),
}));
vi.mock("./platform", () => ({ getAuthMode: () => A.getAuthMode() }));

const loadOpts = async (mode: "bearer" | "cookie") => {
  A.getAuthMode.mockReturnValue(mode);
  A.createAuthClient.mockClear();
  vi.resetModules();
  await import("./authClient");
  return A.createAuthClient.mock.calls[0][0] as any;
};

describe("authClient configuration", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.resetModules());

  it("points at the API base URL", async () => {
    const opts = await loadOpts("bearer");
    expect(opts.baseURL).toBe("http://api.example");
  });

  it("bearer mode wires a lazy token resolver", async () => {
    const opts = await loadOpts("bearer");
    expect(opts.fetchOptions.auth.type).toBe("Bearer");

    localStorage.setItem("accessToken", "tk-1");
    expect(opts.fetchOptions.auth.token()).toBe("tk-1");

    localStorage.removeItem("accessToken");
    expect(opts.fetchOptions.auth.token()).toBe("");
  });

  it("bearer mode persists a fresh set-auth-token header", async () => {
    const opts = await loadOpts("bearer");
    opts.fetchOptions.onSuccess({
      response: {
        headers: {
          get: (h: string) => (h === "set-auth-token" ? "new-token" : null),
        },
      },
    });
    expect(localStorage.getItem("accessToken")).toBe("new-token");
  });

  it("bearer mode leaves the token untouched when no header is returned", async () => {
    const opts = await loadOpts("bearer");
    localStorage.setItem("accessToken", "keep-me");
    opts.fetchOptions.onSuccess({
      response: { headers: { get: () => null } },
    });
    expect(localStorage.getItem("accessToken")).toBe("keep-me");
  });

  it("cookie mode sends credentials and no bearer auth", async () => {
    const opts = await loadOpts("cookie");
    expect(opts.fetchOptions).toEqual({ credentials: "include" });
    expect(opts.baseURL).toBe("http://api.example");
  });
});

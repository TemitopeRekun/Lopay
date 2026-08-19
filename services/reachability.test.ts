import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("./backend", () => ({ API_URL: "http://api.example" }));

import { probeServer, REACHABILITY_TIMEOUT_MS } from "./reachability";

/**
 * The second signal behind the offline banner. Its whole job is to answer one
 * question — did the network carry a request to the backend — without dragging
 * the auth path in, because an expired session reading as an outage is the
 * confusion that put the banner on screen over a working connection.
 */
describe("probeServer", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
  });

  const mockFetch = (impl: typeof fetch) => {
    const spy = vi.fn(impl);
    globalThis.fetch = spy as unknown as typeof fetch;
    return spy;
  };

  it("probes /health at the server root, outside the /api/v1 prefix", async () => {
    const spy = mockFetch(async () => new Response("ok", { status: 200 }));

    await expect(probeServer()).resolves.toBe(true);
    expect(spy).toHaveBeenCalledWith(
      "http://api.example/health",
      expect.objectContaining({ method: "GET", cache: "no-store" }),
    );
  });

  it("counts a 500 as reachable", async () => {
    // A response proves the request was carried. A sick handler is not an
    // offline device, and calling it one would put the banner up over a
    // perfectly good connection.
    mockFetch(async () => new Response("boom", { status: 500 }));
    await expect(probeServer()).resolves.toBe(true);
  });

  it("counts a 401 as reachable", async () => {
    // The probe is deliberately unauthenticated, but even a rejection is proof
    // the network reached the backend.
    mockFetch(async () => new Response("nope", { status: 401 }));
    await expect(probeServer()).resolves.toBe(true);
  });

  it("reports unreachable on a transport failure", async () => {
    mockFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(probeServer()).resolves.toBe(false);
  });

  it("reports unreachable when the request outlives the timeout", async () => {
    mockFetch(
      (_url, init) =>
        new Promise<Response>((_res, rej) => {
          (init?.signal as AbortSignal | undefined)?.addEventListener(
            "abort",
            () => rej(new DOMException("aborted", "AbortError")),
          );
        }),
    );

    const pending = probeServer(REACHABILITY_TIMEOUT_MS);
    await vi.advanceTimersByTimeAsync(REACHABILITY_TIMEOUT_MS);

    await expect(pending).resolves.toBe(false);
  });

  it("clears the abort timer once the probe answers", async () => {
    mockFetch(async () => new Response("ok", { status: 200 }));

    await expect(probeServer()).resolves.toBe(true);

    // A leaked timer per probe would mean one dangling abort every 15s for as
    // long as the socket stays down.
    expect(vi.getTimerCount()).toBe(0);
  });

  it("reports reachable when there is no fetch to ask with", async () => {
    globalThis.fetch = undefined as unknown as typeof fetch;
    // No way to tell is not the same as offline; accusing the network on the
    // strength of a missing API would show a banner nothing can clear.
    await expect(probeServer()).resolves.toBe(true);
  });
});

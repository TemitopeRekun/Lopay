import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock socket.io-client and the two config sources socket.ts reads. Each io()
// call yields a fresh fake socket so reuse/reconnect behaviour is observable.
const S = vi.hoisted(() => {
  const created: any[] = [];
  const io = vi.fn((..._args: unknown[]) => {
    const s = {
      connected: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
      removeAllListeners: vi.fn(),
      emit: vi.fn(),
      on: vi.fn(),
    };
    created.push(s);
    return s;
  });
  return { io, created, getAuthMode: vi.fn(() => "bearer") };
});

vi.mock("socket.io-client", () => ({ io: (...a: unknown[]) => S.io(...a) }));
vi.mock("./backend", () => ({ API_URL: "http://api.test" }));
vi.mock("./platform", () => ({ getAuthMode: () => S.getAuthMode() }));

import { connectSocket, disconnectSocket, getSocket } from "./socket";

const lastSocket = () => S.created[S.created.length - 1];

describe("socket wrapper", () => {
  beforeEach(() => {
    disconnectSocket(); // reset the module-level singleton to null
    S.io.mockClear();
    S.created.length = 0;
    S.getAuthMode.mockReturnValue("bearer");
    localStorage.clear();
  });

  it("has no socket until connected", () => {
    expect(getSocket()).toBeNull();
  });

  it("connects with bearer-token handshake auth by default", () => {
    const socket = connectSocket();
    expect(S.io).toHaveBeenCalledTimes(1);
    const [url, opts] = S.io.mock.calls[0] as [string, any];
    expect(url).toBe("http://api.test");
    expect(opts).toMatchObject({
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      autoConnect: true,
    });
    expect(opts.withCredentials).toBeUndefined();
    expect(getSocket()).toBe(socket);

    // The auth callback resolves the token lazily from localStorage.
    localStorage.setItem("accessToken", "tok-123");
    const cb = vi.fn();
    opts.auth(cb);
    expect(cb).toHaveBeenCalledWith({ token: "tok-123" });

    // ...and sends an empty string when no token is stored.
    localStorage.removeItem("accessToken");
    const cb2 = vi.fn();
    opts.auth(cb2);
    expect(cb2).toHaveBeenCalledWith({ token: "" });
  });

  it("connects with credentials (no bearer auth) in cookie mode", () => {
    S.getAuthMode.mockReturnValue("cookie");
    connectSocket();
    const opts = S.io.mock.calls[0][1] as any;
    expect(opts.withCredentials).toBe(true);
    expect(opts.auth).toBeUndefined();
  });

  it("reuses an already-connected socket without reconnecting", () => {
    const first = connectSocket();
    lastSocket().connected = true;
    const second = connectSocket();
    expect(second).toBe(first);
    expect(S.io).toHaveBeenCalledTimes(1);
    expect(first.connect).not.toHaveBeenCalled();
  });

  it("reconnects an existing-but-disconnected socket", () => {
    const first = connectSocket();
    lastSocket().connected = false;
    const second = connectSocket();
    expect(second).toBe(first);
    expect(S.io).toHaveBeenCalledTimes(1);
    expect(first.connect).toHaveBeenCalledTimes(1);
  });

  it("tears down the socket on disconnect", () => {
    const socket = connectSocket();
    disconnectSocket();
    expect(socket.removeAllListeners).toHaveBeenCalled();
    expect(socket.disconnect).toHaveBeenCalled();
    expect(getSocket()).toBeNull();

    // A subsequent connect builds a brand-new socket.
    connectSocket();
    expect(S.io).toHaveBeenCalledTimes(2);
  });
});

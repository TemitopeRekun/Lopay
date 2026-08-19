import { describe, it, expect, beforeEach } from "vitest";
import { useRealtimeStore } from "./realtimeStore";

describe("useRealtimeStore", () => {
  beforeEach(() => {
    useRealtimeStore.setState({
      status: "disconnected",
      lastEventAt: null,
      serverReachable: null,
    });
  });

  it("starts disconnected with no recorded event", () => {
    const state = useRealtimeStore.getState();
    expect(state.status).toBe("disconnected");
    expect(state.lastEventAt).toBeNull();
  });

  it("starts with no reachability verdict, so nothing can claim offline yet", () => {
    // `null`, not `false`: the banner is gated on a probe that actually failed,
    // and a default of `false` would put it on screen before anything was asked.
    expect(useRealtimeStore.getState().serverReachable).toBeNull();
  });

  it("setServerReachable records both verdicts and can return to unknown", () => {
    useRealtimeStore.getState().setServerReachable(false);
    expect(useRealtimeStore.getState().serverReachable).toBe(false);

    useRealtimeStore.getState().setServerReachable(true);
    expect(useRealtimeStore.getState().serverReachable).toBe(true);

    // Reset to unknown on reconnect, so the next drop does not inherit a stale
    // verdict and flash the banner before its own probe has run.
    useRealtimeStore.getState().setServerReachable(null);
    expect(useRealtimeStore.getState().serverReachable).toBeNull();
  });

  it("setStatus updates the connection status", () => {
    useRealtimeStore.getState().setStatus("connecting");
    expect(useRealtimeStore.getState().status).toBe("connecting");

    useRealtimeStore.getState().setStatus("connected");
    expect(useRealtimeStore.getState().status).toBe("connected");

    useRealtimeStore.getState().setStatus("disconnected");
    expect(useRealtimeStore.getState().status).toBe("disconnected");
  });

  it("markEvent records the current time as the last event timestamp", () => {
    const before = Date.now();
    useRealtimeStore.getState().markEvent();
    const after = Date.now();

    const at = useRealtimeStore.getState().lastEventAt;
    expect(at).not.toBeNull();
    expect(at as number).toBeGreaterThanOrEqual(before);
    expect(at as number).toBeLessThanOrEqual(after);
  });
});

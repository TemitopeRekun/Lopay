import { describe, it, expect, beforeEach } from "vitest";
import { useRealtimeStore } from "./realtimeStore";

describe("useRealtimeStore", () => {
  beforeEach(() => {
    useRealtimeStore.setState({ status: "disconnected", lastEventAt: null });
  });

  it("starts disconnected with no recorded event", () => {
    const state = useRealtimeStore.getState();
    expect(state.status).toBe("disconnected");
    expect(state.lastEventAt).toBeNull();
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

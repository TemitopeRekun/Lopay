import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock every Capacitor plugin NativeBridge touches so the wrapper logic can be
// exercised without a device. The enums are stubbed with sentinel values so the
// exact args passed to Camera.getPhoto can be asserted.
const N = vi.hoisted(() => ({
  isNativePlatform: vi.fn(),
  requestPermissions: vi.fn(),
  getPhoto: vi.fn(),
  fsRequestPermissions: vi.fn(),
  getStatus: vi.fn(),
  addListener: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => N.isNativePlatform() },
}));
vi.mock("@capacitor/camera", () => ({
  Camera: {
    requestPermissions: (...a: unknown[]) => N.requestPermissions(...a),
    getPhoto: (...a: unknown[]) => N.getPhoto(...a),
  },
  CameraResultType: { DataUrl: "dataUrl", Uri: "uri", Base64: "base64" },
  CameraSource: { Camera: "CAMERA", Photos: "PHOTOS", Prompt: "PROMPT" },
}));
vi.mock("@capacitor/filesystem", () => ({
  Filesystem: {
    requestPermissions: (...a: unknown[]) => N.fsRequestPermissions(...a),
  },
}));
vi.mock("@capacitor/network", () => ({
  Network: {
    getStatus: (...a: unknown[]) => N.getStatus(...a),
    addListener: (...a: unknown[]) => N.addListener(...a),
  },
}));

import { NativeBridge } from "./native";

describe("NativeBridge", () => {
  beforeEach(() => {
    Object.values(N).forEach((fn) => fn.mockReset());
  });

  it("isNative reflects Capacitor.isNativePlatform()", () => {
    N.isNativePlatform.mockReturnValue(true);
    expect(NativeBridge.isNative()).toBe(true);
    N.isNativePlatform.mockReturnValue(false);
    expect(NativeBridge.isNative()).toBe(false);
  });

  it("requestCameraPermissions asks for camera + photos and returns the status", async () => {
    N.requestPermissions.mockResolvedValue({
      camera: "granted",
      photos: "granted",
    });
    const status = await NativeBridge.requestCameraPermissions();
    expect(N.requestPermissions).toHaveBeenCalledWith({
      permissions: ["camera", "photos"],
    });
    expect(status).toEqual({ camera: "granted", photos: "granted" });
  });

  it("requestCameraPermissions returns a denied status when the plugin throws", async () => {
    N.requestPermissions.mockRejectedValue(new Error("no perm dialog"));
    const status = await NativeBridge.requestCameraPermissions();
    expect(status).toEqual({ camera: "denied", photos: "denied" });
  });

  it("requestFilesystemPermissions calls through when the plugin supports it", async () => {
    N.fsRequestPermissions.mockResolvedValue(undefined);
    await expect(
      NativeBridge.requestFilesystemPermissions(),
    ).resolves.toBeUndefined();
    expect(N.fsRequestPermissions).toHaveBeenCalled();
  });

  it("requestFilesystemPermissions swallows plugin errors", async () => {
    N.fsRequestPermissions.mockRejectedValue(new Error("denied"));
    await expect(
      NativeBridge.requestFilesystemPermissions(),
    ).resolves.toBeUndefined();
  });

  it("takePhoto captures from the camera as a data URL", async () => {
    N.getPhoto.mockResolvedValue({ dataUrl: "data:image/png;base64,AAA" });
    const photo = await NativeBridge.takePhoto();
    expect(N.getPhoto).toHaveBeenCalledWith({
      quality: 70,
      allowEditing: false,
      source: "CAMERA",
      resultType: "dataUrl",
    });
    expect(photo).toEqual({ dataUrl: "data:image/png;base64,AAA" });
  });

  it("pickPhoto selects from the photo library", async () => {
    N.getPhoto.mockResolvedValue({ dataUrl: "data:image/png;base64,BBB" });
    await NativeBridge.pickPhoto();
    expect(N.getPhoto).toHaveBeenCalledWith({
      quality: 70,
      allowEditing: false,
      source: "PHOTOS",
      resultType: "dataUrl",
    });
  });

  it("getNetworkStatus maps the plugin status onto the app shape", async () => {
    N.getStatus.mockResolvedValue({
      connected: true,
      connectionType: "wifi",
      extra: "ignored",
    });
    const status = await NativeBridge.getNetworkStatus();
    expect(status).toEqual({ connected: true, connectionType: "wifi" });
  });

  it("watchNetworkStatus forwards updates and returns an unsubscribe", async () => {
    let captured: { event: string; cb: (s: any) => void } | undefined;
    const remove = vi.fn();
    N.addListener.mockImplementation(async (event: string, cb: any) => {
      captured = { event, cb };
      return { remove };
    });

    const handler = vi.fn();
    const unsubscribe = await NativeBridge.watchNetworkStatus(handler);

    expect(captured?.event).toBe("networkStatusChange");
    captured?.cb({ connected: false, connectionType: "none", extra: "x" });
    expect(handler).toHaveBeenCalledWith({
      connected: false,
      connectionType: "none",
    });

    unsubscribe();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});

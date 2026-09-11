import { Capacitor } from "@capacitor/core";
import {
  Camera,
  CameraResultType,
  CameraSource,
  PermissionStatus as CameraPermissionStatus,
} from "@capacitor/camera";
import { Network } from "@capacitor/network";

export type NetworkStatus = {
  connected: boolean;
  connectionType: string;
};

/**
 * True when a `pickPhoto` rejection is the user backing out of the picker
 * rather than anything going wrong.
 *
 * The plugin signals a cancel as a rejection with this exact message — the same
 * string on Android, iOS and web — and gives it no code or type to match on, so
 * the message is the only thing there is to check.
 */
export const isPickerCancellation = (error: unknown): boolean =>
  error instanceof Error && error.message === "User cancelled photos app";

export const NativeBridge = {
  isNative: () => Capacitor.isNativePlatform(),

  /**
   * Only `camera` is requested, and only `takePhoto` needs it.
   *
   * Picking an existing photo needs no permission at all: the plugin opens the
   * system photo picker, which grants access to the single item the user
   * chooses. Asking for `photos` here would be worse than pointless — the
   * plugin treats that alias as an empty permission set and always reports it
   * granted, so the only thing the request achieved was a camera prompt in
   * front of a flow that never opens the camera.
   */
  async requestCameraPermissions(): Promise<CameraPermissionStatus> {
    try {
      return await Camera.requestPermissions({
        permissions: ["camera"],
      });
    } catch {
      return { camera: "denied", photos: "denied" };
    }
  },

  async takePhoto() {
    return Camera.getPhoto({
      quality: 70,
      allowEditing: false,
      source: CameraSource.Camera,
      resultType: CameraResultType.DataUrl,
    });
  },

  /**
   * Opens the system photo picker. Rejects with "User cancelled photos app" if
   * the user backs out without choosing — that is a normal outcome, not a
   * failure, so callers must not report it as one.
   */
  async pickPhoto() {
    return Camera.getPhoto({
      quality: 70,
      allowEditing: false,
      source: CameraSource.Photos,
      resultType: CameraResultType.DataUrl,
    });
  },

  async getNetworkStatus(): Promise<NetworkStatus> {
    const status = await Network.getStatus();
    return {
      connected: status.connected,
      connectionType: status.connectionType,
    };
  },

  async watchNetworkStatus(
    handler: (status: NetworkStatus) => void,
  ): Promise<() => void> {
    const listener = await Network.addListener("networkStatusChange", (s) => {
      handler({
        connected: s.connected,
        connectionType: s.connectionType,
      });
    });
    return () => listener.remove();
  },
};

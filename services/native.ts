import { Capacitor } from "@capacitor/core";
import {
  Camera,
  CameraResultType,
  CameraSource,
  PermissionStatus as CameraPermissionStatus,
} from "@capacitor/camera";
import { Filesystem } from "@capacitor/filesystem";
import { Network } from "@capacitor/network";

export type NetworkStatus = {
  connected: boolean;
  connectionType: string;
};

export const NativeBridge = {
  isNative: () => Capacitor.isNativePlatform(),

  async requestCameraPermissions(): Promise<CameraPermissionStatus> {
    try {
      return await Camera.requestPermissions({
        permissions: ["camera", "photos"],
      });
    } catch {
      return { camera: "denied", photos: "denied" };
    }
  },

  async requestFilesystemPermissions(): Promise<void> {
    try {
      // On Android, Filesystem may require explicit permission on older versions
      if ("requestPermissions" in Filesystem) {
        await (Filesystem as any).requestPermissions?.();
      }
    } catch {
      // Ignore; read will still fail if permissions are required
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

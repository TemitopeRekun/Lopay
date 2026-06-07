import React, { ReactNode } from "react";
import { useUIStore, type Theme, type ToastMessage } from "../store/uiStore";

// Re-exported for backwards compatibility with existing imports.
export type { Theme, ToastMessage };

/**
 * UI state now lives in the Zustand store ([[uiStore]]). This module keeps the
 * historical `useUI()` hook and `<UIProvider>` so existing consumers and the
 * provider tree in App.tsx work unchanged — the provider's only remaining job
 * is to render the global toast portal.
 */
export const useUI = () => useUIStore();

const getToastStyles = (type: ToastMessage["type"]) => {
  switch (type) {
    case "success":
      return "bg-success/90 text-white border-success/30";
    case "error":
      return "bg-danger/90 text-white border-danger/30";
    case "warning":
      return "bg-warning/90 text-black border-warning/40";
    default:
      return "bg-slate-900 text-white border-white/10";
  }
};

const getToastIcon = (type: ToastMessage["type"]) => {
  switch (type) {
    case "success":
      return "check_circle";
    case "error":
      return "error";
    case "warning":
      return "warning";
    default:
      return "info";
  }
};

const ToastViewport: React.FC = () => {
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);

  return (
    <div className="fixed top-4 right-4 z-[9999] flex w-[360px] max-w-[92vw] flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-xl backdrop-blur-md animate-fade-in-up ${getToastStyles(
            toast.type,
          )}`}
          role="status"
          aria-live="polite"
        >
          <span className="material-symbols-outlined text-base mt-0.5">
            {getToastIcon(toast.type)}
          </span>
          <p className="text-xs font-bold leading-relaxed flex-1">
            {toast.message}
          </p>
          <button
            type="button"
            onClick={() => removeToast(toast.id)}
            className="rounded-full p-1 text-white/80 hover:text-white transition-colors"
            aria-label="Dismiss notification"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      ))}
    </div>
  );
};

export const UIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <>
      {children}
      <ToastViewport />
    </>
  );
};

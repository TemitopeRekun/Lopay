import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { applyStoredTheme } from "./utils/theme";
import { PushBridge } from "./services/push";

// Before the first paint, so a dark-mode reader doesn't get a white flash.
applyStoredTheme();

/**
 * Attach the native "notification tapped" listener before React mounts.
 *
 * Tapping a notification while the app is killed launches it and fires the
 * event almost immediately — long before the 2.8s splash in AppRoutes clears,
 * let alone before `usePushNotifications` mounts. Anything caught here is
 * buffered and replayed to that hook (see `primeNativePush`). Without it, the
 * cold-start tap that matters most — "your payment was confirmed" — drops the
 * parent on the default dashboard instead of the notification.
 *
 * No-ops on the web, where the service worker owns the click, and never
 * requests permission or registers a token.
 */
void PushBridge.prime();

const logGlobalError = (error: unknown, extra?: Record<string, unknown>) => {
  try {
    const payload = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      time: new Date().toISOString(),
      extra,
    };
    localStorage.setItem("lopay:lastError", JSON.stringify(payload));
    console.error("Global error", payload);
  } catch (err) {
    console.error("Global error logging failed", err);
  }
};

window.addEventListener("error", (event) => {
  logGlobalError(event.error || event.message, {
    source: "window.error",
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  });
});

window.addEventListener("unhandledrejection", (event) => {
  logGlobalError(event.reason, { source: "unhandledrejection" });
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

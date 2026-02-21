import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

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

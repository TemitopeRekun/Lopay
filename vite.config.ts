import path from "path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { buildCsp } from "./build/csp";

/**
 * Inject the CSP as a <meta http-equiv> on `vite build` only. We skip it during
 * `vite dev` because the dev server injects an inline HMR client and eval'd
 * modules that a strict `script-src 'self'` would block.
 */
function cspPlugin(apiUrl: string): Plugin {
  return {
    name: "lopay-csp",
    apply: "build",
    transformIndexHtml(html) {
      const meta = `<meta http-equiv="Content-Security-Policy" content="${buildCsp(
        apiUrl,
      )}" />`;
      return html.replace("</head>", `  ${meta}\n  </head>`);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const apiUrl = env.VITE_API_URL ?? "http://localhost:3001";
  return {
    server: {
      port: 3000,
      host: "0.0.0.0",
      hmr: {
        host: "0.0.0.0",
      },
    },
    // NOTE: no `define` block. The previous build inlined an AI provider API key
    // into the client bundle (a leaked secret); the app does not use it, so the
    // key injection is gone. Rotate the old key (see docs/runbook).
    plugins: [react(), cspPlugin(apiUrl)],
    resolve: {
      alias: {
        "@": path.resolve("./"),
      },
    },
  };
});

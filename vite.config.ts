import path from "path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { buildCsp } from "./build/csp";

/**
 * Inject the CSP as a <meta http-equiv> on `vite build` only. We skip it during
 * `vite dev` because the dev server injects an inline HMR client and eval'd
 * modules that a strict `script-src 'self'` would block.
 */
/** A build aimed at a real API is one whose bundle could actually be deployed. */
function isDeploymentBuild(apiUrl: string): boolean {
  try {
    const { hostname } = new URL(apiUrl);
    return hostname !== "localhost" && hostname !== "127.0.0.1";
  } catch {
    return false;
  }
}

function cspPlugin(apiUrl: string, storageUrl?: string): Plugin {
  return {
    name: "lopay-csp",
    apply: "build",
    transformIndexHtml(html) {
      if (!storageUrl) {
        // Receipt uploads PUT straight to Supabase storage, so a CSP without
        // that origin ships a bundle whose installment flow cannot work — and
        // `vite dev` injects no CSP, so nobody would catch it before users do.
        const message =
          "VITE_SUPABASE_URL is not set, so the generated CSP omits the " +
          "storage origin and every receipt upload will be blocked. Set it to " +
          "the same project URL as the backend's SUPABASE_URL.";
        if (isDeploymentBuild(apiUrl)) {
          throw new Error(message);
        }
        // A localhost build (CI's `npm run build`, a local smoke build) is not
        // going anywhere near a user, so warn rather than fail the pipeline.
        console.warn(`[lopay-csp] ${message}`);
      }
      const meta = `<meta http-equiv="Content-Security-Policy" content="${buildCsp(
        apiUrl,
        storageUrl,
      )}" />`;
      return html.replace("</head>", `  ${meta}\n  </head>`);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const apiUrl = env.VITE_API_URL ?? "http://localhost:3001";
  // No localhost fallback: an unset value must fail the build (see cspPlugin),
  // not quietly produce a policy that blocks the receipt upload.
  const storageUrl = env.VITE_SUPABASE_URL;
  // Netlify sets COMMIT_REF, GitHub Actions sets GITHUB_SHA; neither is
  // VITE_-prefixed, so neither reaches the client on its own. A local build has
  // no commit to name and gets "".
  const commitRef = process.env.COMMIT_REF ?? process.env.GITHUB_SHA ?? "";
  return {
    server: {
      port: 3000,
      host: "0.0.0.0",
      hmr: {
        host: "0.0.0.0",
      },
    },
    // The ONLY thing injected into the bundle is the commit being deployed, so
    // a live build can be identified (see utils/version.ts). The version itself
    // is not injected — it is imported from version.json.
    //
    // NOTE: nothing secret goes in here, ever. The previous build inlined an AI
    // provider API key into the client bundle (a leaked secret); the app does
    // not use it, so the key injection is gone. Rotate the old key (see
    // docs/runbook). A value that must not reach a browser must not be defined
    // here and must not be a VITE_* var.
    define: {
      "import.meta.env.VITE_COMMIT_REF": JSON.stringify(commitRef),
    },
    plugins: [react(), cspPlugin(apiUrl, storageUrl)],
    resolve: {
      alias: {
        "@": path.resolve("./"),
      },
    },
  };
});

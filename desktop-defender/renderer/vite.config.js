/**
 * Desktop Defender Vite Configuration
 * Author: sashasmith-syber
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Strict CSP injected into production builds only (dev server needs inline HMR scripts)
const PROD_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src http://127.0.0.1:* https://127.0.0.1:* http://localhost:* https://localhost:* http://[::1]:* https://[::1]:*",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'"
].join("; ");

function cspPlugin() {
  return {
    name: "inject-csp",
    apply: "build",
    transformIndexHtml() {
      return [
        {
          tag: "meta",
          attrs: { "http-equiv": "Content-Security-Policy", content: PROD_CSP },
          injectTo: "head-prepend"
        }
      ];
    }
  };
}

export default defineConfig({
  root: "renderer",
  base: "./",
  plugins: [react(), cspPlugin()],
  server: {
    port: 5174,
    strictPort: true,
    host: "127.0.0.1"
  },
  build: {
    outDir: "../renderer-dist",
    emptyOutDir: true
  }
});

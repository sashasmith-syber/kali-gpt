/**
 * Desktop Defender Vite Configuration
 * Author: sashasmith-syber
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "renderer",
  plugins: [react()],
  server: {
    port: 5174,
    host: "127.0.0.1"
  },
  build: {
    outDir: "../renderer-dist",
    emptyOutDir: true
  }
});

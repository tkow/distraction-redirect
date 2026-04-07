import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json";

export default defineConfig(({ mode }) => ({
  plugins: [react(), crx({ manifest })],
  build: {
    target: "chrome120",
  },
  esbuild: {
    drop: mode === "production" ? ["console", "debugger"] : [],
  },
  // public/ holds icons; Vite copies them to dist/ as-is
}));

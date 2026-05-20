import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// ── PORT: env var → fallback 5173 ─────────────────────────────────────────────
const port = Number(process.env.PORT) || 5173;

// ── BASE PATH: env var → fallback "/" ─────────────────────────────────────────
const basePath = process.env.BASE_PATH || "/";

// ── Optional Replit plugins ───────────────────────────────────────────────────
const isReplit = !!process.env.REPL_ID;
const replitPlugins = isReplit
  ? await Promise.all([
      import("@replit/vite-plugin-runtime-error-modal").then((m) => m.default()),
      import("@replit/vite-plugin-cartographer").then((m) =>
        m.cartographer({ root: path.resolve(import.meta.dirname, "..") })
      ),
      import("@replit/vite-plugin-dev-banner").then((m) => m.devBanner()),
    ])
  : [];

export default defineConfig({
  base: basePath,

  plugins: [
    react(),
    tailwindcss(),
    ...replitPlugins,
  ],

  resolve: {
    alias: {
      "@":       path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },

  root: path.resolve(import.meta.dirname),

  build: {
    // 1. Ubah outDir ke 'dist' biasa agar sesuai standar Vercel monorepo
    outDir:     path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    // 2. Matikan sourcemap untuk membungkam error compiler shadcn UI
    sourcemap: false,
  },

  server: {
    port,
    strictPort: false,   // allow fallback port if busy
    host:       "0.0.0.0",
    allowedHosts: true,
    proxy: {
      // Proxy API calls to backend (adjust port if needed)
      "/api": {
        target: `http://localhost:${process.env.API_PORT || 8080}`,
        changeOrigin: true,
      },
    },
  },

  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
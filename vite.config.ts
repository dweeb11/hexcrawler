import { defineConfig } from "vite";
import viteApiPlugin from "./scripts/vite-api-plugin";

export default defineConfig({
  root: ".",
  plugins: [viteApiPlugin()],
  resolve: {
    alias: {
      // API endpoints use @libsql/client/web for Vercel (HTTP-only).
      // In local dev, remap to the full client which supports file: URLs.
      "@libsql/client/web": "@libsql/client",
    },
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: "index.html",
        admin: "admin.html",
      },
    },
  },
});

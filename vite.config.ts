import { defineConfig } from "vite";
import viteApiPlugin from "./scripts/vite-api-plugin";

export default defineConfig({
  root: ".",
  plugins: [viteApiPlugin()],
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

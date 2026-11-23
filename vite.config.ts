import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Built for GitHub Pages, which serves the site from /little-tokyo/ (constance-sun.github.io/little-tokyo/).
// The dev server stays at the root. Code that builds asset URLs uses import.meta.env.BASE_URL.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/little-tokyo/" : "/",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
}));

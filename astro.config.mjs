// @ts-check

import { defineConfig } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  output: "server",
  integrations: [react(), sitemap()],
  server: { port: 3000 },
  vite: {
    plugins: [tailwindcss()],
    build: {
      // Wymuś kodowanie UTF-8 dla outputu
      rollupOptions: {
        output: {
          // Niektóre bundlery mogą wymagać jawnego ustawienia
          // chunkFileNames: '[name]-[hash].js',
        },
      },
    },
    // Wymuś kodowanie UTF-8 dla serwera dev
    server: {
      middlewareMode: false,
    },
    // Wymuś kodowanie UTF-8 dla plików źródłowych
    resolve: {
      extensions: [".js", ".ts", ".jsx", ".tsx", ".json", ".astro", ".css"],
      alias: {
        // eslint-disable-next-line no-undef
        "@": new URL("./src", import.meta.url).pathname,
      },
    },
    // Dla bezpieczeństwa ustaw env
    define: {
      "process.env.LC_ALL": JSON.stringify("pl_PL.UTF-8"),
      "process.env.LANG": JSON.stringify("pl_PL.UTF-8"),
      "process.env.LANGUAGE": JSON.stringify("pl_PL.UTF-8"),
    },
  },
  adapter: cloudflare(),
});

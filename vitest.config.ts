import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setupTests.ts"],
    coverage: {
      reporter: ["text", "json", "html"],
      exclude: ["src/__tests__/*", "src/components/__tests__/*", "src/__tests__/e2e/*"],
    },
    exclude: ["node_modules", "src/__tests__/e2e/*"],
  },
});

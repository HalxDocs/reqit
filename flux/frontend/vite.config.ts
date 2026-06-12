/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig(({ mode }) => {
  const isWeb = mode === "web";
  const isTest = mode === "test";
  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
      },
    },
    build: isWeb
      ? {
          outDir: "dist-web",
          rollupOptions: {
            input: resolve(__dirname, "web.html"),
          },
        }
      : {},
    test: isTest
      ? {
          globals: true,
          environment: "happy-dom",
          setupFiles: ["./src/test/setup.ts"],
          include: ["src/**/*.test.{ts,tsx}"],
        }
      : undefined,
  };
});

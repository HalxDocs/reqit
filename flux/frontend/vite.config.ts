import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig(({ mode }) => {
  const isWeb = mode === "web";
  return {
    plugins: [react()],
    build: isWeb
      ? {
          outDir: "dist-web",
          rollupOptions: {
            input: resolve(__dirname, "web.html"),
          },
        }
      : {},
  };
});

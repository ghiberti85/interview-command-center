import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 2500,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.js"],
    include: ["src/**/*.test.{js,jsx}"],
    env: {
      VITE_SUPABASE_URL: "https://sumzkwjthwcdtjqheehn.supabase.co",
      VITE_SUPABASE_ANON_KEY: "mock-anon-key",
      VITE_AI_PROXY_URL: "https://sumzkwjthwcdtjqheehn.supabase.co/functions/v1/anthropic-proxy",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.{js,jsx}"],
      exclude: ["src/test/**", "src/__tests__/**", "src/main.jsx"],
    },
  },
});

import { defineConfig } from "vitest/config";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";

// Runs the Worker inside workerd with a Miniflare D1. wrangler.toml supplies main + the DB
// binding; the bindings below override its placeholders so the worker counts as configured.
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.toml" },
      miniflare: {
        bindings: {
          AZURE_TENANT_ID: "11111111-1111-4111-8111-111111111111",
          AZURE_CLIENT_ID: "22222222-2222-4222-8222-222222222222",
          ALLOWED_TENANT_IDS: "",
          REQUIRED_SCOPE: "Progress.Sync",
          ALLOWED_ORIGIN: "https://dashboard.test",
        },
      },
    }),
  ],
  test: {
    // scripts/*.test.mjs are node:test files (run by `node --test` in CI), not workerd tests.
    include: ["test/**/*.test.ts"],
    setupFiles: ["./test/apply-schema.ts"],
  },
});

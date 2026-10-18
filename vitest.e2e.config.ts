import { defineConfig } from "vitest/config";

// Runs against a live server (see e2e/auth.e2e.test.ts); kept out of the default `npm test`.
export default defineConfig({
  test: { include: ["e2e/**/*.e2e.test.ts"], testTimeout: 20_000, fileParallelism: false },
});

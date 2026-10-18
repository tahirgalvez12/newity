import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

// Browser tests that click through the app like a rep and a manager (npm run test:ui).
// Uses your installed Google Chrome by default; set PW_CHANNEL=chromium after
// `npx playwright install chromium` if you don't have Chrome.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "ui",
  fullyParallel: false,
  workers: 1, // one shared database; tests create and clean up their own accounts
  retries: 0, // a flaky pass would hide a real problem
  reporter: [["list"]],
  timeout: 30_000,
  use: {
    baseURL,
    channel: process.env.PW_CHANNEL ?? "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"], channel: process.env.PW_CHANNEL ?? "chrome" } }],
  webServer: {
    command: "npm run dev",
    url: `${baseURL}/login`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

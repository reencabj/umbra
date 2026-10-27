import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    actionTimeout: 10000,
    navigationTimeout: 30000,
    baseURL: process.env.E2E_URL || "http://127.0.0.1:5173/umbra/",
    headless: true,
    channel: process.platform === "win32" ? "chrome" : undefined,
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  webServer: process.env.E2E_URL
    ? undefined
    : {
        command: "npm run dev -- --port 5173",
        url: "http://127.0.0.1:5173/umbra/",
        reuseExistingServer: !process.env.CI,
      },
});

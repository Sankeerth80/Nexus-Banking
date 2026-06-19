import { defineConfig, devices } from "@playwright/test";

const devServerUrl = "http://127.0.0.1:3102";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: devServerUrl,
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3102",
    env: {
      NEXT_PUBLIC_API_BASE_URL: `${devServerUrl}/api`,
    },
    url: devServerUrl,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],
});

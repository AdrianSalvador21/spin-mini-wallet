import { defineConfig, devices } from "@playwright/test";
import { E2E_DB_PATH } from "./e2e/global-setup";

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: isCI ? `npm run build && npx next start --port ${PORT}` : `npx next dev --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      SESSION_SECRET: process.env.SESSION_SECRET ?? "playwright-session-secret-at-least-32-chars",
      MOCK_DB_PATH: E2E_DB_PATH,
      MOCK_ALLOW_SCENARIO_OVERRIDE: "true",
    },
  },
});

import { defineConfig, devices } from "@playwright/test";

const port = 3199;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  // One worker: the suite shares a single server and asserts on per-context
  // browser storage, so parallel files made ordering-sensitive failures look
  // like real regressions. Serial is declared here rather than implied.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${port}`,
    locale: "nb-NO",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm next build && pnpm next start --port ${port}`,
    port,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

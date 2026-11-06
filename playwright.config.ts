import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3000);

/**
 * Browser smoke tests. Uses your installed Google Chrome (no browser download).
 * Reuses a running `npm run dev` on port 3000, or starts one.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "chrome",
    headless: true,
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

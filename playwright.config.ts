import { defineConfig } from "@playwright/test";

/**
 * Browser smoke tests. Uses your installed Google Chrome (no browser download).
 *
 * By default they run against a production build (`next build` + `next start` on port 3100): the code that ships,
 * with no on-demand compilation, so results don't depend on how busy the dev server is.
 * Set E2E_PORT to test an already-running dev server instead (e.g. E2E_PORT=3000 while developing).
 */
const DEV_PORT = process.env.E2E_PORT ? Number(process.env.E2E_PORT) : null;
const PORT = DEV_PORT ?? 3100;

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
  webServer: DEV_PORT
    ? { command: `npm run dev -- --port ${PORT}`, url: `http://localhost:${PORT}`, reuseExistingServer: true, timeout: 120_000 }
    : { command: `npm run build && npm run start -- --port ${PORT}`, url: `http://localhost:${PORT}`, reuseExistingServer: false, timeout: 300_000 },
});

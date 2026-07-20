import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests drive the real `codesafari dev` server against this very
 * repository (which tours itself) using a headless Chromium.
 *
 * The `webServer` block builds the core + viewer and boots the dev server on a
 * dedicated port; Playwright waits for it to answer before running specs and
 * shuts it down afterwards. Set `reuseExistingServer` so a server you already
 * have running locally is reused instead of a second one being spawned.
 */

const PORT = Number(process.env.CODESAFARI_E2E_PORT ?? 4319);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    // The viewer is a dark Monokai theme; render at a comfortable desktop size.
    viewport: { width: 1440, height: 900 },
    // A crisp 2× capture makes the README screenshot look sharp on retina.
    deviceScaleFactor: 2,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `npm run build && node dist/cli.js dev . --no-open --port ${PORT}`,
    url: `http://localhost:${PORT}/data/manifest.json`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});

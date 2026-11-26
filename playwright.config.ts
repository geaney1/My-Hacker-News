import { defineConfig } from '@playwright/test';

/** Ports the end-to-end tests use, chosen to stay clear of the dev server (4200) and the SSR server (4000). */
const appPort = 4901;
const fakeHackerNewsPort = 4900;

// Playwright asks the processes it starts for coloured output (FORCE_COLOR). Where NO_COLOR is
// set as well, each of them warns that it is ignored, so it is taken away.
delete process.env['NO_COLOR'];

/**
 * End-to-end tests: a real browser against the built app. `npm run e2e` builds the app first.
 * Hacker News is replaced by a small fake (`e2e/fake-hn.mjs`), and the app keeps its accounts,
 * stories and comments in a fresh folder, `e2e/.data`, so every run starts clean.
 *
 * The browser is the Microsoft Edge that is installed on the machine. To use Chrome instead,
 * set E2E_BROWSER=chrome.
 */
export default defineConfig({
  testDir: './e2e',
  // The tests share one server and its data, and each uses names of its own, so they run in turn.
  workers: 1,
  timeout: 30_000,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${appPort}`,
    channel: process.env['E2E_BROWSER'] ?? 'msedge',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node e2e/fake-hn.mjs',
      env: { PORT: String(fakeHackerNewsPort) },
      url: `http://localhost:${fakeHackerNewsPort}/v0/topstories.json`,
      reuseExistingServer: false,
    },
    {
      // Starts from an empty data folder, then runs the server that `ng build` made.
      command:
        `node -e "require('node:fs').rmSync('e2e/.data',{recursive:true,force:true})" && ` +
        'node dist/hacker-news/server/server.mjs',
      env: {
        PORT: String(appPort),
        DATA_DIR: 'e2e/.data',
        HN_API_URL: `http://localhost:${fakeHackerNewsPort}/v0`,
        // The tests create a lot of users from one address, far faster than the limits allow.
        RATE_LIMITS: 'off',
      },
      url: `http://localhost:${appPort}/top`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});

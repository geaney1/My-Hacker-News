import { expect, test, type Page } from '@playwright/test';
import { password } from './helpers';

/** Fills in the form, presses Enter, and checks how the browser sends it. */
async function expectTypedTextKeptOutOfAddress(page: Page) {
  await page.getByLabel('Username').fill('earlybird');
  await page.getByLabel('Password', { exact: true }).fill(password);
  const sent = page.waitForRequest((request) => request.isNavigationRequest());
  await page.getByLabel('Password', { exact: true }).press('Enter');

  const request = await sent;
  expect(request.method()).toBe('POST');
  expect(new URL(request.url()).search).toBe('');
}

// The server sends a page that can be used before the app in it has loaded. The browser then sends
// a form itself, and must never put what was typed in the address, where the browser history and
// server logs would keep it.
for (const path of ['/log-in', '/create-user']) {
  test.describe(`the form on ${path}, sent early`, () => {
    test('keeps what was typed out of the address while the app loads', async ({ page }) => {
      await page.route('**/*.js', () => {
        // Never answered, so the app cannot take over the page.
      });
      await page.goto(path, { waitUntil: 'commit' });

      await expectTypedTextKeptOutOfAddress(page);
    });

    test.describe('when no script can run', () => {
      test.use({ javaScriptEnabled: false });

      test('keeps what was typed out of the address', async ({ page }) => {
        await page.goto(path);

        await expectTypedTextKeptOutOfAddress(page);
      });
    });
  });
}

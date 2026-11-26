import { expect, test } from '@playwright/test';
import { appIsReady, password } from './helpers';

// The server sends a page that can be used before the app in it has loaded. A form sent then must
// never put what was typed in the address, where the browser history and server logs would keep it.
for (const [path, button] of [
  ['/log-in', 'Log in'],
  ['/create-user', 'Create user'],
]) {
  test.describe(`the form on ${path}, sent early`, () => {
    test('stays on the page while the app loads, and works once it has', async ({ page }) => {
      const pagesAskedFor: string[] = [];
      page.on('request', (request) => {
        if (request.isNavigationRequest()) pagesAskedFor.push(request.url());
      });
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      // The app's scripts are held back until the form has been sent.
      let letTheAppLoad!: () => void;
      const appMayLoad = new Promise<void>((resolve) => (letTheAppLoad = resolve));
      await page.route('**/*.js', async (route) => {
        await appMayLoad;
        await route.continue();
      });

      await page.goto(path, { waitUntil: 'commit' });
      await page.getByLabel('Username').fill('earlybird');
      await page.getByLabel('Password', { exact: true }).fill(password);
      await page.getByLabel('Password', { exact: true }).press('Enter');
      letTheAppLoad();
      await appIsReady(page);

      await page.getByRole('button', { name: button, exact: true }).click();
      await expect(page.getByText('Username is required')).toBeVisible();
      // Only the page that was opened: the browser never sent the form itself.
      expect(pagesAskedFor).toHaveLength(1);
      expect(errors).toEqual([]);
    });

    test.describe('when no script can run', () => {
      test.use({ javaScriptEnabled: false });

      test('keeps what was typed out of the address', async ({ page }) => {
        await page.goto(path);
        await page.getByLabel('Username').fill('earlybird');
        await page.getByLabel('Password', { exact: true }).fill(password);
        const sent = page.waitForRequest((request) => request.isNavigationRequest());
        await page.getByLabel('Password', { exact: true }).press('Enter');

        const request = await sent;
        expect(request.method()).toBe('POST');
        expect(new URL(request.url()).search).toBe('');
      });
    });
  });
}

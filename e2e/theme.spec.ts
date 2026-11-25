import { expect, test } from '@playwright/test';
import { createUserAndLogIn, uniqueName } from './helpers';

const page_background = (page: import('@playwright/test').Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test.describe('the light and dark themes', () => {
  test('the profile has a button that switches to the dark theme and back again', async ({
    page,
  }) => {
    const username = uniqueName('theme');
    await createUserAndLogIn(page, username);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    const lightBackground = await page_background(page);

    await page.getByRole('link', { name: `Profile for ${username}` }).click();
    const dialog = page.getByRole('dialog', { name: 'Profile' });
    await dialog.getByRole('button', { name: /^(Switch to )?Dark theme$/ }).click();

    // At once, without saving the profile or closing the dialog.
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: /^(Switch to )?Light theme$/ })).toBeVisible();
    expect(await page_background(page)).not.toBe(lightBackground);

    await dialog.getByRole('button', { name: /^(Switch to )?Light theme$/ }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(await page_background(page)).toBe(lightBackground);
  });

  test('the choice is remembered after a reload, and a dark page is dark from the first paint', async ({
    page,
  }) => {
    const username = uniqueName('remember');
    await createUserAndLogIn(page, username);
    await page.getByRole('link', { name: `Profile for ${username}` }).click();
    await page
      .getByRole('dialog', { name: 'Profile' })
      .getByRole('button', { name: /^(Switch to )?Dark theme$/ })
      .click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // The page is the profile, so the dialog is open again after the reload.
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(
      page
        .getByRole('dialog', { name: 'Profile' })
        .getByRole('button', { name: /^(Switch to )?Light theme$/ }),
    ).toBeVisible();
  });

  test('the theme is set before the page is painted: the first thing in the page is dark', async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem('hacker-news.theme', 'dark'));
    // Stop the app's own scripts, so only what the HTML itself does is seen.
    await page.route('**/*.js', (route) => route.abort());
    await page.goto('/top');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await page_background(page)).toBe('rgb(11, 11, 11)');
  });

  test('with nothing chosen, the page follows what the device prefers', async ({ browser }) => {
    const dark = await browser.newContext({ colorScheme: 'dark' });
    const darkPage = await dark.newPage();
    await darkPage.goto('/top');
    await expect(darkPage.locator('html')).toHaveAttribute('data-theme', 'dark');
    await dark.close();

    const light = await browser.newContext({ colorScheme: 'light' });
    const lightPage = await light.newPage();
    await lightPage.goto('/top');
    await expect(lightPage.locator('html')).toHaveAttribute('data-theme', 'light');
    await light.close();
  });

  test('what the user chose beats what the device prefers', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'dark' });
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem('hacker-news.theme', 'light'));
    await page.goto('/top');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await context.close();
  });

  test('every page is readable in the dark theme: the story cards have the dark surface', async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem('hacker-news.theme', 'dark'));
    await page.goto('/top');
    const card = page.locator('article.story').first();
    await expect(card).toBeVisible();
    expect(await card.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
      'rgb(47, 47, 47)',
    );
  });
});

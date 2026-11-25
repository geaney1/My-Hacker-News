import { expect, test } from '@playwright/test';
import { createUserAndLogIn, uniqueName } from './helpers';

/** What the page behind an open dialog is filtered with: the dialog's backdrop. */
const backdropFilter = (dialog: import('@playwright/test').Locator) =>
  dialog.evaluate((element) => getComputedStyle(element, '::backdrop').backdropFilter);

test.describe('the page behind an open dialog is blurred', () => {
  test('the log-in dialog blurs the page by 8px, and dims it', async ({ page }) => {
    await page.goto('/log-in');
    const dialog = page.getByRole('dialog', { name: 'Log in' });
    await expect(dialog).toBeVisible();

    expect(await backdropFilter(dialog)).toBe('blur(8px)');
    const dim = await dialog.evaluate((element) => getComputedStyle(element, '::backdrop').backgroundColor);
    expect(dim).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('the Submit and Profile dialogs blur it too, in either theme', async ({ page }) => {
    const username = uniqueName('blur');
    await createUserAndLogIn(page, username);

    await page.getByRole('link', { name: 'Submit', exact: true }).click();
    const submit = page.getByRole('dialog', { name: 'Submit a story' });
    await expect(submit).toBeVisible();
    expect(await backdropFilter(submit)).toBe('blur(8px)');
    await submit.getByRole('link', { name: 'Close' }).click();

    await page.getByRole('link', { name: `Profile for ${username}` }).click();
    const profile = page.getByRole('dialog', { name: 'Profile' });
    await expect(profile).toBeVisible();
    await profile.getByRole('button', { name: /^(Switch to )?Dark theme$/ }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await backdropFilter(profile)).toBe('blur(8px)');
  });

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 800 } });

    test('the menu drawer blurs the page behind it, more lightly', async ({ page }) => {
      await page.goto('/top');
      await expect(page.locator('article.story').first()).toBeVisible();
      await page.getByRole('button', { name: 'Menu' }).click();

      const filter = await page.locator('.menu-backdrop').evaluate((element) => getComputedStyle(element).backdropFilter);
      expect(filter).toBe('blur(4px)');
    });
  });
});

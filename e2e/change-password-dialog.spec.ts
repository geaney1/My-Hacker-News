import { expect, test } from '@playwright/test';
import { createUserAndLogIn, uniqueName } from './helpers';

test('Change password opens as a dialog over the story list, and the list stays selected in the menu', async ({ page }) => {
  const username = uniqueName('cpd');
  await createUserAndLogIn(page, username);
  await page.goto('/new');
  await expect(page.locator('article.story').first()).toBeVisible();
  await page.getByRole('link', { name: `Profile for ${username}` }).click();
  await page.getByRole('dialog', { name: 'Profile' }).getByRole('link', { name: 'Change password' }).click();

  const dialog = page.getByRole('dialog', { name: 'Change password' });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/change-password/);
  // The stories are still there behind it, and the list the user came from is still highlighted.
  await expect(page.locator('article.story').first()).toBeAttached();
  await expect(page.getByRole('link', { name: 'New', exact: true })).toHaveClass(/active/);
});

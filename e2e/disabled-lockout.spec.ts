import { expect, test } from '@playwright/test';
import { createUserAndLogIn, uniqueName } from './helpers';

test('Max Visit and Min Away are turned off unless No Procrast is yes', async ({ page }) => {
  const username = uniqueName('dis');
  await createUserAndLogIn(page, username);
  await page.getByRole('link', { name: `Profile for ${username}` }).click();
  const dialog = page.getByRole('dialog', { name: 'Profile' });
  const noProcrast = dialog.getByLabel('No Procrast', { exact: true });
  const maxVisit = dialog.getByLabel('Max Visit', { exact: true });
  const minAway = dialog.getByLabel('Min Away', { exact: true });

  await expect(noProcrast).toHaveValue('no');
  await expect(maxVisit).toBeDisabled();
  await expect(minAway).toBeDisabled();

  await noProcrast.selectOption('yes');
  await expect(maxVisit).toBeEnabled();
  await expect(minAway).toBeEnabled();

  await noProcrast.selectOption('no');
  await expect(maxVisit).toBeDisabled();
  await expect(minAway).toBeDisabled();
});

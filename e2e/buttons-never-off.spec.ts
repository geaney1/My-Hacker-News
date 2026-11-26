import { expect, test } from '@playwright/test';
import { openPage, createUserAndLogIn, uniqueName } from './helpers';

// WCAG 3.3.1 / 3.3.3: a button that is turned off says nothing about why. The buttons stay available:
// pressing one with the form incomplete shows each problem and moves the focus to the first field.
test('log in, create user and change password keep their buttons on, and say what is missing', async ({
  page,
}) => {
  await openPage(page, '/log-in');
  let dialog = page.getByRole('dialog', { name: 'Log in' });
  await expect(dialog.getByRole('button', { name: 'Log in', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(dialog.getByRole('alert').first()).toBeVisible();
  await expect(dialog.getByLabel('Username')).toBeFocused();

  await openPage(page, '/create-user');
  dialog = page.getByRole('dialog');
  await dialog
    .getByRole('button', { name: /create/i })
    .last()
    .click();
  await expect(dialog.getByRole('alert').first()).toBeVisible();
  await expect(dialog.getByLabel('Username')).toBeFocused();

  await createUserAndLogIn(page, uniqueName('nbo'));
  await openPage(page, '/change-password');
  dialog = page.getByRole('dialog', { name: 'Change password' });
  await dialog.getByRole('button', { name: 'Change password' }).click();
  await expect(dialog.getByRole('alert').first()).toBeVisible();
  await expect(dialog.getByLabel('Current password')).toBeFocused();
});

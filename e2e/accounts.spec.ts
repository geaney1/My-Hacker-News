import { expect, test } from '@playwright/test';
import { openPage, logIn, password, createUser, createUserAndLogIn, uniqueName } from './helpers';

test.describe('accounts', () => {
  test('a new user can be created, log in and log out', async ({ page }) => {
    const username = uniqueName('anna');
    await page.goto('/top');
    await expect(page.getByRole('link', { name: 'Log In' })).toBeVisible();

    await createUserAndLogIn(page, username);
    await expect(page.getByRole('link', { name: `Profile for ${username}` })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Submit', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Log Out' }).click();
    await expect(page.getByRole('link', { name: 'Log In' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Submit', exact: true })).toBeHidden();
  });

  test('stays logged in after the page is reloaded', async ({ page }) => {
    await createUserAndLogIn(page, uniqueName('ben'));
    await page.reload();
    await expect(page.getByRole('button', { name: 'Log Out' })).toBeVisible();
  });

  test('a log-out that fails says so, and leaves the user logged in', async ({ page }) => {
    await createUserAndLogIn(page, uniqueName('gus'));
    // The request to log out never reaches the server.
    await page.route('**/api/auth/logout', (route) => route.abort());
    await page.getByRole('button', { name: 'Log Out' }).click();

    await expect(
      page.getByRole('alert').filter({ hasText: 'you are still logged in' }),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Log Out' })).toBeVisible();

    // Once the server can be reached, trying again works, and stays that way.
    await page.unroute('**/api/auth/logout');
    await page.getByRole('button', { name: 'Log Out' }).click();
    await expect(page.getByRole('link', { name: 'Log In' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('link', { name: 'Log In' })).toBeVisible();
  });

  test('refuses a wrong password, and says so', async ({ page }) => {
    const username = uniqueName('cara');
    await createUser(page, username);
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Password', { exact: true }).fill('not-the-password');
    await page.getByRole('button', { name: 'Log in', exact: true }).click();

    await expect(
      page.getByRole('alert').filter({ hasText: 'Incorrect username or password' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log Out' })).toBeHidden();
  });

  test('refuses a username that is taken', async ({ page }) => {
    const username = uniqueName('dave');
    await createUser(page, username);

    await openPage(page, '/create-user');
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Verify password').fill(password);
    await page.getByRole('button', { name: 'Create user' }).click();
    await expect(page.getByText('That username is already taken')).toBeVisible();
  });

  test('a page that needs a login sends a visitor to log in, and then back to it', async ({
    page,
  }) => {
    const username = uniqueName('eve');
    await createUser(page, username);
    await openPage(page, '/submit');

    await expect(page).toHaveURL(/\/log-in\?returnUrl=%2Fsubmit/);
    await logIn(page, username);
    await expect(page).toHaveURL(/\/submit$/);
    await expect(page.getByRole('dialog', { name: 'Submit a story' })).toBeVisible();
  });

  test('the log-in dialog opens over the stories, and closing it goes back to them', async ({
    page,
  }) => {
    await page.goto('/top');
    await page.getByRole('link', { name: 'Log In' }).click();

    await expect(page.getByRole('dialog', { name: 'Log in' })).toBeVisible();
    await page.getByRole('link', { name: 'Close' }).click();
    await expect(page).toHaveURL(/\/top$/);
    await expect(page.locator('article.story').first()).toBeVisible();
  });

  test('a password can be changed, and the new one then works', async ({ page }) => {
    const username = uniqueName('finn');
    await createUserAndLogIn(page, username);

    await openPage(page, '/change-password');
    await page.getByLabel('Current password').fill(password);
    await page.getByLabel('New password', { exact: true }).fill('a-brand-new-password');
    await page.getByLabel('Verify new password').fill('a-brand-new-password');
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page).toHaveURL(/\/user-profile/);

    // The profile dialog is open over the page: close it, then log out.
    await page
      .getByRole('dialog', { name: 'Profile' })
      .getByRole('link', { name: 'Close' })
      .click();
    await page.getByRole('button', { name: 'Log Out' }).click();
    // Leaving the page before the server has answered would cancel the log-out.
    await expect(page.getByRole('link', { name: 'Log In' })).toBeVisible();
    await openPage(page, '/log-in');
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Password', { exact: true }).fill('a-brand-new-password');
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Log Out' })).toBeVisible();
  });
});

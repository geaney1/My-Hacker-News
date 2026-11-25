import { expect, test } from '@playwright/test';
import { createUserAndLogIn, uniqueName } from './helpers';

/** The live region that says the page has changed. */
const announcer = (page: import('@playwright/test').Page) =>
  page.locator('div.visually-hidden[role="status"]');

test.describe('keyboard and screen reader support', () => {
  test('the first Tab goes to a "Skip to main content" link, which moves the focus to the page', async ({
    page,
  }) => {
    await page.goto('/top');
    await expect(page.locator('article.story').first()).toBeVisible();

    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skip).toBeFocused();
    // It is on the screen while it has the focus.
    const box = await skip.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);

    await page.keyboard.press('Enter');
    await expect(page.locator('main#main')).toBeFocused();
    // The address did not change: it is not a link to another page.
    await expect(page).toHaveURL(/\/top$/);

    // The next Tab goes into the page, not back to the menu.
    await page.keyboard.press('Tab');
    const inMain = await page.evaluate(() => !!document.activeElement?.closest('main'));
    expect(inMain).toBe(true);
  });

  test('the skip link is out of sight until it is focused', async ({ page }) => {
    await page.goto('/top');
    const box = await page.getByRole('link', { name: 'Skip to main content' }).boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(0);
  });

  test('a new page is announced by its title after each navigation, but not the first load', async ({
    page,
  }) => {
    await page.goto('/top');
    await expect(page.locator('article.story').first()).toBeVisible();
    await page.waitForTimeout(400);
    await expect(announcer(page)).toHaveText('');

    await page.getByRole('link', { name: 'Log In' }).click();
    await expect(page.getByRole('dialog', { name: 'Log in' })).toBeVisible();
    await expect(announcer(page)).toHaveText(await page.title());
    await expect(announcer(page)).toHaveText('Log in');

    await page.getByRole('link', { name: 'Close' }).click();
    await expect(page).toHaveURL(/\/top$/);
    await expect(announcer(page)).toHaveText(await page.title());
  });

  test('the live region is polite and read whole', async ({ page }) => {
    await page.goto('/top');
    await expect(announcer(page)).toHaveAttribute('aria-live', 'polite');
    await expect(announcer(page)).toHaveAttribute('aria-atomic', 'true');
  });

  test('closing a dialog puts the focus back on the link that opened it', async ({ page }) => {
    await createUserAndLogIn(page, uniqueName('foc'));
    const submitLink = page.getByRole('link', { name: 'Submit', exact: true });
    await submitLink.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Submit a story' })).toBeVisible();
    // The focus is in the dialog, on its first field.
    await expect(page.getByRole('dialog').getByLabel('Title')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(submitLink).toBeFocused();
  });

  test('the profile dialog starts with the focus on its first field', async ({ page }) => {
    const username = uniqueName('first');
    await createUserAndLogIn(page, username);
    await page.getByRole('link', { name: `Profile for ${username}` }).click();
    await expect(
      page.getByRole('dialog', { name: 'Profile' }).getByRole('textbox', { name: 'About You' }),
    ).toBeFocused();
  });

  test('a field that is wrong says so, and a field that has to be filled in says that too', async ({
    page,
  }) => {
    await page.goto('/create-user');
    const username = page.getByLabel('Username');
    await expect(username).toHaveAttribute('aria-required', 'true');
    await expect(username).not.toHaveAttribute('aria-invalid', 'true');

    await username.fill('a');
    await username.blur();
    await expect(username).toHaveAttribute('aria-invalid', 'true');
    await expect(username).toHaveAttribute('aria-describedby', /username-error/);

    await username.fill('valid_name');
    await expect(username).not.toHaveAttribute('aria-invalid', 'true');
  });

  test('the avatar link is named for the profile, and its letter is not read out as well', async ({
    page,
  }) => {
    const username = uniqueName('ava');
    await createUserAndLogIn(page, username);
    const avatar = page.getByRole('link', { name: `Profile for ${username}` });
    await expect(avatar).toBeVisible();
    await expect(avatar.locator('[aria-hidden="true"]')).toHaveCount(1);
  });

  test('the page number in the paging bar is announced when it changes', async ({ page }) => {
    await page.goto('/job');
    await expect(page.locator('article.story').first()).toBeVisible();
    const status = page.locator('app-pagination .status');
    await expect(status).toHaveAttribute('role', 'status');
    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(status).toHaveText('Page 2 of 3');
  });

  test('the theme button is named for what it does, with the short name showing', async ({
    page,
  }) => {
    const username = uniqueName('thm');
    await createUserAndLogIn(page, username);
    await page.getByRole('link', { name: `Profile for ${username}` }).click();
    const button = page
      .getByRole('dialog', { name: 'Profile' })
      .getByRole('button', { name: 'Switch to Dark theme' });
    await expect(button).toBeVisible();
    // The "Switch to " is for screen readers only (clipped away); what is seen is just "Dark theme".
    await expect(button.locator('.visually-hidden')).toHaveText('Switch to');
    const seen = await button.evaluate((element) =>
      Array.from(element.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent)
        .join('')
        .trim(),
    );
    expect(seen).toBe('Dark theme');
  });
});

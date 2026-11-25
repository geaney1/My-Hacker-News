import { expect, test } from '@playwright/test';
import { createUserAndLogIn, uniqueName } from './helpers';

test.describe('the story-list menu on a small screen is a hamburger drawer', () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test('is closed behind a hamburger button, and the button says what it does', async ({
    page,
  }) => {
    await page.goto('/top');
    await expect(page.locator('article.story').first()).toBeVisible();

    const button = page.getByRole('button', { name: 'Menu' });
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(button).toHaveAttribute('aria-controls', 'side-menu');
    await expect(page.getByRole('navigation', { name: 'Story lists' })).toBeHidden();
  });

  test('opens a drawer with the lists, moves the focus into it, and dims the page behind it', async ({
    page,
  }) => {
    await page.goto('/top');
    await expect(page.locator('article.story').first()).toBeVisible();
    const button = page.getByRole('button', { name: 'Menu' });

    await button.click();
    const menu = page.getByRole('navigation', { name: 'Story lists' });
    await expect(menu).toBeVisible();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    for (const name of ['Top', 'New', 'Best', 'Ask', 'Show', 'Jobs']) {
      await expect(menu.getByRole('link', { name, exact: true })).toBeVisible();
    }
    await expect(menu.getByRole('link', { name: 'Top', exact: true })).toBeFocused();
    await expect(page.locator('.menu-backdrop')).toBeVisible();

    // The drawer sits on the left edge, over the page, and is not wider than 80% of the screen.
    const box = await page.locator('app-side-menu').boundingBox();
    expect(box!.x).toBe(0);
    expect(box!.width).toBeLessThanOrEqual(390 * 0.8 + 1);
  });

  test('choosing a list goes there and closes the drawer', async ({ page }) => {
    await page.goto('/top');
    await expect(page.locator('article.story').first()).toBeVisible();

    await page.getByRole('button', { name: 'Menu' }).click();
    await page
      .getByRole('navigation', { name: 'Story lists' })
      .getByRole('link', { name: 'New', exact: true })
      .click();

    await expect(page).toHaveURL(/\/new$/);
    await expect(page.getByRole('navigation', { name: 'Story lists' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Menu' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await expect(
      page.locator('article.story', { hasText: 'Fresh Hacker News story' }),
    ).toBeVisible();
  });

  test('Escape closes it and puts the focus back on the hamburger button', async ({ page }) => {
    await page.goto('/top');
    await expect(page.locator('article.story').first()).toBeVisible();
    const button = page.getByRole('button', { name: 'Menu' });

    await button.click();
    await expect(page.getByRole('navigation', { name: 'Story lists' })).toBeVisible();
    await page.keyboard.press('Escape');

    await expect(page.getByRole('navigation', { name: 'Story lists' })).toBeHidden();
    await expect(button).toBeFocused();
  });

  test('a click on the dimmed page outside the drawer closes it', async ({ page }) => {
    await page.goto('/top');
    await expect(page.locator('article.story').first()).toBeVisible();

    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(page.getByRole('navigation', { name: 'Story lists' })).toBeVisible();
    // Well to the right of the drawer (which is 256px wide), and clear of the scrollbar.
    await page.mouse.click(330, 400);

    await expect(page.getByRole('navigation', { name: 'Story lists' })).toBeHidden();
  });

  test('pressing the hamburger again closes it', async ({ page }) => {
    await page.goto('/top');
    await expect(page.locator('article.story').first()).toBeVisible();
    const button = page.getByRole('button', { name: 'Menu' });

    await button.click();
    await expect(page.getByRole('navigation', { name: 'Story lists' })).toBeVisible();
    // The drawer covers the left of the page, but not the hamburger's own place when it is pressed with the keyboard.
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('navigation', { name: 'Story lists' })).toBeHidden();
  });

  test('a logged-in user has Submit and Welcome in the drawer too', async ({ page }) => {
    await createUserAndLogIn(page, uniqueName('mob'));
    await page.getByRole('button', { name: 'Menu' }).click();
    const menu = page.getByRole('navigation', { name: 'Story lists' });
    await expect(menu.getByRole('link', { name: 'Submit', exact: true })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Welcome', exact: true })).toBeVisible();

    await menu.getByRole('link', { name: 'Submit', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Submit a story' })).toBeVisible();
  });

  test('the page has no sideways scrolling', async ({ page }) => {
    await page.goto('/top');
    await expect(page.locator('article.story').first()).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe('the story-list menu on a wide screen stays a side menu', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('is always shown, with no hamburger button', async ({ page }) => {
    await page.goto('/top');
    await expect(page.locator('article.story').first()).toBeVisible();

    await expect(page.getByRole('button', { name: 'Menu' })).toBeHidden();
    const menu = page.getByRole('navigation', { name: 'Story lists' });
    await expect(menu).toBeVisible();
    await expect(page.locator('.menu-backdrop')).toHaveCount(0);

    // Beside the page, not over it.
    const box = await menu.boundingBox();
    expect(box!.width).toBeLessThan(250);
    expect(box!.x).toBeGreaterThan(0);
  });
});

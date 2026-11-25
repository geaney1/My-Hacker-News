import { expect, test, type Page } from '@playwright/test';
import { createUserAndLogIn, uniqueName } from './helpers';

/** Presses the mouse down on a place in an open dialog, without letting go, and measures the card. */
async function cardWhilePressing(page: Page, x: number, y: number) {
  const card = page.locator('dialog[open] .auth-page');
  const before = (await card.boundingBox())!;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(300);
  const during = (await card.boundingBox())!;
  const errors = await card.getByRole('alert').count();
  return { before, during, errors };
}

test.describe('closing a dialog does not make it jump', () => {
  test.beforeEach(async ({ page }) => {
    await createUserAndLogIn(page, uniqueName('stdy'));
    await page.goto('/submit');
    await expect(page.getByLabel('Title')).toBeFocused();
  });

  test('pressing the Close icon leaves the card as it was, and closes it', async ({ page }) => {
    const icon = (await page.getByRole('link', { name: 'Close' }).boundingBox())!;
    const { before, during, errors } = await cardWhilePressing(
      page,
      icon.x + icon.width / 2,
      icon.y + icon.height / 2,
    );
    expect(during.height).toBe(before.height);
    expect(during.y).toBe(before.y);
    expect(errors).toBe(0);

    await page.mouse.up();
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('pressing outside the card leaves it as it was, and closes it', async ({ page }) => {
    const { before, during, errors } = await cardWhilePressing(page, 20, 20);
    expect(during.height).toBe(before.height);
    expect(during.y).toBe(before.y);
    expect(errors).toBe(0);

    await page.mouse.up();
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('leaving an empty field for another part of the form still says what is wanted', async ({
    page,
  }) => {
    await page.getByLabel('Link').click();
    await expect(page.getByText('A title is required')).toBeVisible();
  });
});

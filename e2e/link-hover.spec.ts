import { expect, test, type Locator, type Page } from '@playwright/test';
import { createUserAndLogIn, uniqueName } from './helpers';

/** The width a link is drawn at and how thick its underline is, with the mouse over it. */
async function hovered(page: Page, link: Locator) {
  await page.mouse.move(0, 0);
  const width = () => link.evaluate((element) => element.getBoundingClientRect().width);
  const before = await width();
  await link.hover();
  await page.waitForTimeout(250);
  const during = await width();
  const thickness = await link.evaluate((element) => getComputedStyle(element).textDecorationThickness);
  return { before, during, thickness };
}

test('a link with words beside it does not grow over them when the mouse is on it', async ({ page }) => {
  await createUserAndLogIn(page, uniqueName('hov'));

  await page.goto('/welcome');
  const welcomeLinks = page.getByRole('article').getByRole('link');
  await expect(welcomeLinks).toHaveCount(3);
  const places: Locator[] = [welcomeLinks.nth(0), welcomeLinks.nth(1), welcomeLinks.nth(2)];
  for (const link of places) {
    const measured = await hovered(page, link);
    expect(measured.during).toBeCloseTo(measured.before, 1);
    // There is still a sign that the mouse is on it.
    expect(measured.thickness).toBe('2px');
  }

  await page.goto('/top');
  const author = page.locator('.story-meta a').first();
  await expect(author).toBeVisible();
  const inList = await hovered(page, author);
  expect(inList.during).toBeCloseTo(inList.before, 1);

  await page.goto('/item/101');
  const commenter = page.locator('.comment-header a').first();
  await expect(commenter).toBeVisible();
  const inThread = await hovered(page, commenter);
  expect(inThread.during).toBeCloseTo(inThread.before, 1);
});

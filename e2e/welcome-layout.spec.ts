import { expect, test, type Page } from '@playwright/test';
import { createUserAndLogIn, uniqueName } from './helpers';

/** The card's edges, the columns the paragraphs sit in, and any sideways scrolling. */
async function measure(page: Page) {
  return page.getByRole('article').evaluate((article) => {
    const paragraphs = Array.from(article.querySelectorAll('p')).flatMap((paragraph) =>
      Array.from(paragraph.getClientRects()),
    );
    const card = article.getBoundingClientRect();
    return {
      columns: new Set(paragraphs.map((box) => Math.round(box.left))).size,
      left: card.left,
      right: card.right,
      sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}

for (const theme of ['light', 'dark'] as const) {
  for (const { width, height } of [
    { width: 1700, height: 900 },
    { width: 1280, height: 800 },
    { width: 900, height: 800 },
    { width: 390, height: 800 },
    { width: 320, height: 640 },
  ]) {
    test(`the welcome page suits a ${width} px wide screen, ${theme} theme`, async ({ page }) => {
      await page.addInitScript(
        (chosen) => localStorage.setItem('hacker-news.theme', chosen),
        theme,
      );
      await page.setViewportSize({ width, height });
      await createUserAndLogIn(page, uniqueName('wlay'));
      await page.goto('/top');
      const story = page.locator('app-stories-page section').first();
      await expect(story).toBeVisible();
      const stories = (await story.boundingBox())!;

      await page.goto('/welcome');
      await expect(page.getByRole('article')).toBeVisible();

      const measured = await measure(page);
      // One column, from the same left edge to the same right edge as the stories page.
      expect(measured.columns).toBe(1);
      expect(Math.abs(measured.left - stories.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(measured.right - (stories.x + stories.width))).toBeLessThanOrEqual(1);
      // Below zero is the room kept for the scrollbar; above zero would be sideways scrolling.
      expect(measured.sideways).toBeLessThanOrEqual(0);
    });
  }
}

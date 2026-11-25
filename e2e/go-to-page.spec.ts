import { expect, test } from '@playwright/test';

test('on a wide screen the words "Go to page" are not shown, and the box fits the word "Page"', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/top');
  await expect(page.locator('article.story').first()).toBeVisible();

  const label = await page.locator('.go-to-label').boundingBox();
  expect(label!.width).toBeLessThanOrEqual(1);
  await expect(page.getByLabel('Go to page')).toBeVisible();

  const fits = await page.locator('#go-to-page').evaluate((input) => {
    const style = getComputedStyle(input);
    const canvas = document.createElement('canvas').getContext('2d')!;
    canvas.font = style.font;
    const word = canvas.measureText('Page').width;
    // Room for the word, plus the padding and the spinner (about 20px).
    return input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 20 >= word;
  });
  expect(fits).toBe(true);
});

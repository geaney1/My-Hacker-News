import { expect, test } from '@playwright/test';

// WCAG 2.5.8 (Target Size, Minimum): a control is at least 24 by 24 CSS pixels.
for (const path of ['/log-in', '/create-user']) {
  test(`the Show password box on ${path} is at least 24 by 24 pixels`, async ({ page }) => {
    await page.goto(path);
    const box = await page.getByRole('checkbox').boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(24);
    expect(box!.height).toBeGreaterThanOrEqual(24);
  });
}

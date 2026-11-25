import { expect, test } from '@playwright/test';

test('the close icon of a dialog shows a "Close" tooltip on hover and on keyboard focus', async ({
  page,
}) => {
  await page.goto('/create-user');
  const close = page.getByRole('link', { name: 'Close' });
  const tooltip = () =>
    close.evaluate((element) => {
      const style = getComputedStyle(element, '::after');
      return { text: style.content, opacity: style.opacity };
    });

  await expect.poll(async () => (await tooltip()).opacity).toBe('0');
  expect((await tooltip()).text).toBe('"Close"');

  await close.hover();
  await expect.poll(async () => (await tooltip()).opacity).toBe('1');

  await page.mouse.move(0, 0);
  await expect.poll(async () => (await tooltip()).opacity).toBe('0');
  await page.keyboard.press('Tab');
  await close.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect.poll(async () => (await tooltip()).opacity).toBe('1');
});

import { expect, test } from '@playwright/test';
import { createUserAndLogIn, uniqueName } from './helpers';

// WCAG 2.4.11 (Focus Not Obscured): the control that has the focus is not hidden behind the profile's
// buttons, which stay at the bottom of the dialog on a phone.
for (const height of [640, 560]) {
  test(`in the profile on a 320 by ${height} screen, no focused control is covered`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height });
    const name = uniqueName('obs');
    await createUserAndLogIn(page, name);
    await page.getByRole('link', { name: `Profile for ${name}` }).click();
    await page.getByRole('dialog', { name: 'Profile' }).waitFor();

    const covered: string[] = [];
    for (let press = 0; press < 40; press++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(60);
      const result = await page.evaluate(() => {
        const element = document.activeElement as HTMLElement;
        const box = element.getBoundingClientRect();
        const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        const own = top === element || element.contains(top) || (!!top?.closest('label') && top.closest('label') === element.closest('label'));
        return { own, name: (element.getAttribute('aria-label') || element.id || element.textContent || '').trim().slice(0, 25) };
      });
      if (!result.own) covered.push(result.name);
    }
    expect(covered).toEqual([]);
  });
}

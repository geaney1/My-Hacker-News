import { expect, test, type Page } from '@playwright/test';
import { saveProfile, createUser, createUserAndLogIn, uniqueName } from './helpers';

/** Shuts the user out, as if a visit of two minutes had gone on past a Max Visit of one. */
async function getLockedOut(page: Page, username: string) {
  await saveProfile(page, username, { noProcrast: 'yes', maxVisit: 1, minAway: 10 });
  await page.evaluate(
    ([key, started]) => localStorage.setItem(key, JSON.stringify({ visitStart: started, lastSeen: Date.now(), lockedUntil: 0 })),
    [`hacker-news.visit.${username.toLowerCase()}`, Date.now() - 120_000] as const,
  );
  await page.reload();
  await expect(page.locator('app-banner.visit-limit')).toBeVisible();
}

/** The colours a banner is drawn with, and the page behind it, measured in the browser. */
async function measureBanner(page: Page, selector: string) {
  return page.locator(selector).evaluate((host) => {
    const parse = (color: string) => (color.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);
    const luminance = ([red, green, blue]: number[]) => {
      const [redLevel, greenLevel, blueLevel] = [red, green, blue].map((channel) => {
        const value = channel / 255;
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * redLevel + 0.7152 * greenLevel + 0.0722 * blueLevel;
    };
    const ratio = (first: number[], second: number[]) => {
      const [lighter, darker] = [luminance(first), luminance(second)].sort((left, right) => right - left);
      return (lighter + 0.05) / (darker + 0.05);
    };

    const banner = host.querySelector('.banner') as HTMLElement;
    const style = getComputedStyle(banner);
    // A gradient has two colours; a banner in a solid colour (the red ones) has the same one twice.
    const gradient = (style.backgroundImage.match(/rgba?\([^)]*\)/g) ?? []).map(parse);
    const solid = parse(style.backgroundColor);
    const [start, end] = gradient.length >= 2 ? gradient : [solid, solid];
    const page = parse(getComputedStyle(document.body).backgroundColor);
    const text = parse(getComputedStyle(banner.querySelector('.text') as HTMLElement).color);
    const icon = parse(getComputedStyle(banner.querySelector('.icon') as HTMLElement).color);
    return {
      textOnStart: ratio(text, start),
      textOnEnd: ratio(text, end),
      iconOnStart: ratio(icon, start),
      iconOnEnd: ratio(icon, end),
      edgeOnPage: ratio(parse(style.borderLeftColor), page),
      topRuleOnPage: ratio(parse(style.borderTopColor), page),
      fillOnPage: Math.min(ratio(start, page), ratio(end, page)),
    };
  });
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`banners, ${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((chosen) => localStorage.setItem('hacker-news.theme', chosen), theme);
    });

    test('the break banner stands out from the page, and its words and icon can be read', async ({ page }) => {
      const username = uniqueName('ban');
      await createUserAndLogIn(page, username);
      await getLockedOut(page, username);

      const measured = await measureBanner(page, 'app-banner.visit-limit');
      // Words: 4.5:1 at the least, on both ends of the tint. Icon: 3:1.
      expect(measured.textOnStart).toBeGreaterThanOrEqual(4.5);
      expect(measured.textOnEnd).toBeGreaterThanOrEqual(4.5);
      expect(measured.iconOnStart).toBeGreaterThanOrEqual(3);
      expect(measured.iconOnEnd).toBeGreaterThanOrEqual(3);
      // Against the page: a clear edge (over 2:1) and a strong rule on top (3:1), and the fill itself
      // is not the colour of the page (before this was changed it was 1.03 to 1.05 against it).
      expect(measured.edgeOnPage).toBeGreaterThanOrEqual(2.2);
      expect(measured.topRuleOnPage).toBeGreaterThanOrEqual(3);
      expect(measured.fillOnPage).toBeGreaterThanOrEqual(1.15);
    });

    test('is a banner, not a card: it has a heading, an icon and a button, and is announced', async ({ page }) => {
      const username = uniqueName('ban');
      await createUserAndLogIn(page, username);
      await getLockedOut(page, username);

      const banner = page.locator('app-banner.visit-limit');
      await expect(banner.getByRole('heading', { name: 'Time for a break' })).toBeVisible();
      await expect(banner.locator('svg.icon')).toBeVisible();
      await expect(banner.getByRole('link', { name: 'Change your profile settings' })).toBeVisible();
      await expect(banner.locator('[role="status"]')).toHaveCount(1);
    });

    test('a failed log-in is a compact red banner, announced as an alert', async ({ page }) => {
      const username = uniqueName('ban');
      await createUser(page, username);
      await page.getByLabel('Username').fill(username);
      await page.getByLabel('Password', { exact: true }).fill('not-the-password');
      await page.getByRole('button', { name: 'Log in', exact: true }).click();

      const banner = page.locator('app-banner.form-error');
      await expect(banner).toBeVisible();
      await expect(banner.getByRole('alert')).toContainText('Incorrect username or password');
      await expect(banner).toHaveClass(/banner-error/);
      await expect(banner).toHaveClass(/banner-compact/);

      const measured = await measureBanner(page, 'app-banner.form-error');
      expect(measured.textOnStart).toBeGreaterThanOrEqual(4.5);
      expect(measured.iconOnStart).toBeGreaterThanOrEqual(3);
      expect(measured.edgeOnPage).toBeGreaterThanOrEqual(2.2);
      expect(measured.fillOnPage).toBeGreaterThanOrEqual(1.15);
    });
  });
}

test.describe('the other notices are banners too', () => {
  test('a user that does not exist is an error banner with the message in it', async ({ page }) => {
    await page.goto('/user/nobodyhere');
    const banner = page.locator('app-banner');
    await expect(banner).toBeVisible();
    await expect(banner.getByRole('alert')).toHaveText('No user named nobodyhere was found.');
    await expect(banner).toHaveClass(/banner-error/);
  });

  test('a story that does not exist is an error banner, with a way back', async ({ page }) => {
    await page.goto('/item/999999999');
    const banner = page.locator('app-banner');
    await expect(banner.getByRole('alert')).toHaveText('This story could not be found.');
    await expect(page.getByRole('button', { name: '← Back' })).toBeVisible();
  });
});


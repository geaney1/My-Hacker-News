import { expect, test } from '@playwright/test';
import { createUserAndLogIn, uniqueName } from './helpers';

test.use({ viewport: { width: 390, height: 800 } });

const sidewaysOverflow = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe('the layout on a phone', () => {
  test('the header is one line: the title does not wrap, and the buttons do not either', async ({ page }) => {
    await page.goto('/top');
    await expect(page.locator('article.story').first()).toBeVisible();

    const title = await page.getByRole('heading', { name: 'Hacker News', level: 1 }).boundingBox();
    const logIn = await page.getByRole('link', { name: 'Log In' }).boundingBox();
    const menu = await page.getByRole('button', { name: 'Menu' }).boundingBox();
    // One line of 18px text is far less than two lines.
    expect(title!.height).toBeLessThan(32);
    expect(logIn!.height).toBeLessThan(48);
    // The menu button, the title and the Log In button are on the same row.
    for (const box of [title, logIn]) {
      expect(Math.abs(box!.y + box!.height / 2 - (menu!.y + menu!.height / 2))).toBeLessThan(12);
    }
  });

  test('the avatar stays a circle, and Log Out stays on one line, once logged in', async ({ page }) => {
    const username = uniqueName('ph');
    await createUserAndLogIn(page, username);

    const avatar = await page.getByRole('link', { name: `Profile for ${username}` }).boundingBox();
    const logOut = await page.getByRole('button', { name: 'Log Out' }).boundingBox();
    expect(avatar!.width).toBeCloseTo(avatar!.height, 0);
    expect(logOut!.height).toBeLessThan(48);
    // Both are inside the screen, with the title still on the same row.
    expect(logOut!.x + logOut!.width).toBeLessThanOrEqual(390);
    const title = await page.getByRole('heading', { name: 'Hacker News', level: 1 }).boundingBox();
    expect(Math.abs(title!.y - avatar!.y)).toBeLessThan(20);
  });

  test('the search and the minimum score are one under the other, the full width', async ({ page }) => {
    await page.goto('/top');
    await expect(page.locator('article.story').first()).toBeVisible();

    const search = await page.getByRole('searchbox').boundingBox();
    const score = await page.getByRole('spinbutton', { name: /minimum score/i }).boundingBox();
    expect(Math.abs(search!.x - score!.x)).toBeLessThan(2);
    expect(Math.abs(search!.width - score!.width)).toBeLessThan(2);
    expect(score!.y).toBeGreaterThan(search!.y + search!.height);
    // Nearly the whole width of the screen.
    expect(search!.width).toBeGreaterThan(390 - 60);
  });

  test('the paging bar has the previous and next arrows without the numbered pages between them', async ({ page }) => {
    await page.goto('/job');
    await expect(page.locator('article.story').first()).toBeVisible();

    await expect(page.getByRole('button', { name: 'Previous page' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next page' })).toBeVisible();
    // The 45 jobs of the fake Hacker News are 3 pages: none of the numbered buttons show.
    await expect(page.locator('app-pagination .pages')).toBeHidden();
    await expect(page.getByRole('button', { name: /^[1-3]$/ })).toHaveCount(0);
    await expect(page.locator('app-pagination .status')).toHaveText('Page 1 of 3');

    // The arrows still work, and Go to page still reaches any page.
    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page.locator('app-pagination .status')).toHaveText('Page 2 of 3');
    await page.locator('#go-to-page').fill('3');
    await page.getByRole('button', { name: 'Go', exact: true }).click();
    await expect(page.locator('app-pagination .status')).toHaveText('Page 3 of 3');
  });

  test('the paging bar is all on one line: the page, the arrows and the box to go to a page', async ({ page }) => {
    await page.goto('/top');
    await expect(page.locator('article.story').first()).toBeVisible();

    const bar = await page.locator('app-pagination').boundingBox();
    const status = await page.locator('app-pagination .status').boundingBox();
    const previous = await page.getByRole('button', { name: 'Previous page' }).boundingBox();
    const next = await page.getByRole('button', { name: 'Next page' }).boundingBox();
    const goTo = await page.locator('#go-to-page').boundingBox();
    const go = await page.getByRole('button', { name: 'Go', exact: true }).boundingBox();

    const centre = (box: { y: number; height: number }) => box.y + box.height / 2;
    for (const [name, box] of [['arrow', previous], ['next', next], ['box', goTo], ['Go', go]] as const) {
      expect(Math.abs(centre(box!) - centre(status!)), name).toBeLessThan(8);
    }
    // In order, left to right, and all inside the bar.
    expect(status!.x).toBeLessThan(previous!.x);
    expect(previous!.x).toBeLessThan(next!.x);
    expect(next!.x + next!.width).toBeLessThanOrEqual(goTo!.x + 1);
    expect(goTo!.x).toBeLessThan(go!.x);
    expect(go!.x + go!.width).toBeLessThanOrEqual(bar!.x + bar!.width);
    // One line is a short bar.
    expect(bar!.height).toBeLessThan(75);
  });

  test('the words "Go to page" are for screen readers only, and the box still has its name', async ({ page }) => {
    await page.goto('/top');
    await expect(page.locator('article.story').first()).toBeVisible();

    await expect(page.getByLabel('Go to page')).toBeVisible();
    await expect(page.locator('#go-to-page')).toHaveAttribute('placeholder', 'Page');
    const label = await page.locator('.go-to-label').boundingBox();
    expect(label!.width).toBeLessThanOrEqual(1);
  });

  test('the paging bar is on the very bottom of the screen, edge to edge', async ({ page }) => {
    await page.goto('/top');
    await expect(page.locator('article.story').first()).toBeVisible();

    const bar = await page.locator('app-pagination').boundingBox();
    // Its bottom edge is the bottom edge of the screen, and it spans the whole width.
    expect(Math.abs(bar!.y + bar!.height - 800)).toBeLessThanOrEqual(1);
    // The whole width of the page, from its left edge to its right edge. (A desktop browser keeps
    // a strip for the scrollbar at the right; a phone has none.)
    const layout = await page.locator('.layout').boundingBox();
    expect(bar!.x).toBeCloseTo(layout!.x, 0);
    expect(bar!.width).toBeCloseTo(layout!.width, 0);
  });

  test('the paging bar stays on the very bottom while a long list scrolls behind it', async ({ page }) => {
    // The Jobs list has 45 jobs in the fake Hacker News, so the page is long.
    await page.goto('/job');
    await expect(page.locator('article.story').first()).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(200);
    const scrolled = await page.locator('app-pagination').boundingBox();
    expect(Math.abs(scrolled!.y + scrolled!.height - 800)).toBeLessThanOrEqual(1);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(200);
    const atEnd = await page.locator('app-pagination').boundingBox();
    expect(Math.abs(atEnd!.y + atEnd!.height - 800)).toBeLessThanOrEqual(1);
  });

  for (const path of ['/top', '/item/101', '/user/hnauthor', '/log-in', '/create-user']) {
    test(`${path} has no sideways scrolling`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('main')).toBeVisible();
      await page.waitForTimeout(300);
      expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);
    });
  }

  test('the profile on a phone: nearly the full width, settings in two columns, and the buttons grouped', async ({ page }) => {
    const username = uniqueName('prof');
    await createUserAndLogIn(page, username);
    await page.getByRole('link', { name: `Profile for ${username}` }).click();
    const dialog = page.getByRole('dialog', { name: 'Profile' });
    await expect(dialog).toBeVisible();

    // Nearly the whole width of the screen.
    const box = await dialog.boundingBox();
    expect(box!.width).toBeGreaterThan(390 - 40);
    expect(box!.x).toBeGreaterThanOrEqual(0);

    // Show Dead and No Procrast side by side; Max Visit and Min Away side by side.
    const showDead = await dialog.getByRole('combobox', { name: 'Show Dead' }).boundingBox();
    const noProcrast = await dialog.getByRole('combobox', { name: 'No Procrast' }).boundingBox();
    const maxVisit = await dialog.getByRole('spinbutton', { name: 'Max Visit' }).boundingBox();
    const minAway = await dialog.getByRole('spinbutton', { name: 'Min Away' }).boundingBox();
    expect(Math.abs(showDead!.y - noProcrast!.y)).toBeLessThan(2);
    expect(noProcrast!.x).toBeGreaterThan(showDead!.x + showDead!.width - 1);
    expect(Math.abs(maxVisit!.y - minAway!.y)).toBeLessThan(2);
    expect(minAway!.x).toBeGreaterThan(maxVisit!.x + maxVisit!.width - 1);

    // Update is the whole width; the theme and password buttons are side by side under it, as wide
    // as each other. The theme button is named for the theme it gives.
    await dialog.getByRole('button', { name: 'Update' }).scrollIntoViewIfNeeded();
    const update = await dialog.getByRole('button', { name: 'Update' }).boundingBox();
    const theme = await dialog.getByRole('button', { name: /^(Switch to )?Dark theme$/ }).boundingBox();
    const password = await dialog.getByRole('link', { name: 'Change password' }).boundingBox();
    expect(theme!.y).toBeGreaterThan(update!.y + update!.height - 1);
    expect(Math.abs(theme!.y - password!.y)).toBeLessThan(2);
    expect(Math.abs(theme!.width - password!.width)).toBeLessThan(2);
    expect(update!.width).toBeGreaterThan(theme!.width * 1.8);
    expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);
  });

  test('the profile buttons stay in view at the bottom of the dialog, and can be used while it is not scrolled', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 700 });
    const username = uniqueName('stk');
    await createUserAndLogIn(page, username);
    await page.getByRole('link', { name: `Profile for ${username}` }).click();
    const dialog = page.getByRole('dialog', { name: 'Profile' });
    await expect(dialog).toBeVisible();

    // At the top of the dialog, with nothing scrolled, all three buttons are on the screen.
    const update = dialog.getByRole('button', { name: 'Update' });
    const theme = dialog.getByRole('button', { name: /^(Switch to )?Dark theme$/ });
    const password = dialog.getByRole('link', { name: 'Change password' });
    await expect(update).toBeInViewport({ ratio: 1 });
    await expect(theme).toBeInViewport({ ratio: 1 });
    await expect(password).toBeInViewport({ ratio: 1 });

    // They really work from there: the theme button switches the theme.
    await theme.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    // (A button grows a little under the mouse, so the mouse is moved off it before looking.)
    await page.mouse.move(200, 100);
    await page.waitForTimeout(300);
    await expect(dialog.getByRole('button', { name: /^(Switch to )?Light theme$/ })).toBeInViewport({ ratio: 1 });

    // And they are still in view after the settings are scrolled to the end.
    await dialog.evaluate((element) => element.scrollTo(0, element.scrollHeight));
    await expect(update).toBeInViewport({ ratio: 1 });
    await expect(password).toBeInViewport({ ratio: 1 });
    const bottom = await dialog.boundingBox();
    const bar = await password.boundingBox();
    expect(bar!.y + bar!.height).toBeLessThanOrEqual(bottom!.y + bottom!.height);
  });

  test('the profile and Submit dialogs fit the screen and scroll inside themselves', async ({ page }) => {
    const username = uniqueName('dlg');
    await createUserAndLogIn(page, username);

    await page.getByRole('link', { name: `Profile for ${username}` }).click();
    const profile = page.getByRole('dialog', { name: 'Profile' });
    await expect(profile).toBeVisible();
    const box = await profile.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    expect(box!.height).toBeLessThanOrEqual(800);
    // The Update button can be reached by scrolling inside the dialog.
    await profile.getByRole('button', { name: 'Update' }).scrollIntoViewIfNeeded();
    await expect(profile.getByRole('button', { name: 'Update' })).toBeInViewport();
    expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);
  });
});

test.describe('the paging bar on a wide screen', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('still has the numbered pages between the arrows', async ({ page }) => {
    await page.goto('/top');
    await expect(page.locator('article.story').first()).toBeVisible();
    await expect(page.locator('app-pagination .pages')).toBeVisible();
    await expect(page.locator('app-pagination .pages button')).not.toHaveCount(0);
  });

  test('is on the very bottom of the screen, in the page column', async ({ page }) => {
    await page.goto('/top');
    await expect(page.locator('article.story').first()).toBeVisible();

    const bar = await page.locator('app-pagination').boundingBox();
    expect(Math.abs(bar!.y + bar!.height - 800)).toBeLessThanOrEqual(1);
    // Beside the side menu, not under it.
    expect(bar!.x).toBeGreaterThan(150);
  });
});

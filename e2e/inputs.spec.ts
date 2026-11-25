import { expect, test, type Locator, type Page } from '@playwright/test';
import { createUserAndLogIn, uniqueName } from './helpers';

const transformOf = (control: Locator) =>
  control.evaluate((element) => getComputedStyle(element).transform);

/** The width of the control as it is drawn, scaled or not. */
const drawnWidth = async (control: Locator) => (await control.boundingBox())!.width;

/**
 * Away from the control it is its normal size; while the mouse is over it, it is a little bigger;
 * once it is clicked into (focused) it goes back to its normal size, even with the mouse still on it.
 */
async function expectGrowsOnHoverButNotWhenClickedInto(page: Page, control: Locator, name: string) {
  // A field that starts with the focus (the first one in a dialog) does not grow, so it is let go of first.
  await control.evaluate((element) => (element as HTMLElement).blur());
  await page.mouse.move(0, 0);
  await page.waitForTimeout(250);
  expect(await transformOf(control), `${name} at rest`).toBe('none');
  const normal = await drawnWidth(control);

  await control.hover();
  await page.waitForTimeout(250);
  const hovered = await drawnWidth(control);
  expect(hovered, `${name} hovered`).toBeGreaterThan(normal);
  // Slightly: a few percent, not a jump.
  expect(hovered / normal, `${name} hovered`).toBeLessThan(1.06);

  await control.click();
  await page.waitForTimeout(250);
  expect(await transformOf(control), `${name} clicked into`).toBe('none');
  expect(await drawnWidth(control), `${name} clicked into`).toBeCloseTo(normal, 0);
}

test.describe('inputs grow slightly when hovered, and not when clicked into', () => {
  test('the search and filter boxes on the story lists', async ({ page }) => {
    await page.goto('/top');
    await expect(page.locator('article.story').first()).toBeVisible();

    await expectGrowsOnHoverButNotWhenClickedInto(page, page.getByRole('searchbox'), 'search');
    await expectGrowsOnHoverButNotWhenClickedInto(
      page,
      page.getByRole('spinbutton', { name: /minimum score/i }),
      'minimum score',
    );
  });

  test('the fields of the log-in dialog, but not the checkbox', async ({ page }) => {
    await page.goto('/log-in');
    const dialog = page.getByRole('dialog', { name: 'Log in' });
    await expect(dialog).toBeVisible();
    await expectGrowsOnHoverButNotWhenClickedInto(page, dialog.getByLabel('Username'), 'username');
    await expectGrowsOnHoverButNotWhenClickedInto(
      page,
      dialog.getByLabel('Password', { exact: true }),
      'password',
    );

    const checkbox = dialog.getByRole('checkbox');
    await checkbox.hover();
    await page.waitForTimeout(250);
    expect(await transformOf(checkbox)).toBe('none');
  });

  test('the comment box, and the select and text area in the profile', async ({ page }) => {
    const username = uniqueName('grow');
    await createUserAndLogIn(page, username);

    await page.goto('/item/101');
    await expectGrowsOnHoverButNotWhenClickedInto(
      page,
      page.getByLabel('Add a comment'),
      'comment box',
    );

    await page.goto('/top');
    await page.getByRole('link', { name: `Profile for ${username}` }).click();
    const dialog = page.getByRole('dialog', { name: 'Profile' });
    await expectGrowsOnHoverButNotWhenClickedInto(
      page,
      dialog.getByRole('textbox', { name: 'About You' }),
      'About You',
    );
    await expectGrowsOnHoverButNotWhenClickedInto(
      page,
      dialog.getByRole('combobox', { name: 'Show Dead' }),
      'Show Dead',
    );
    await dialog.getByRole('combobox', { name: 'No Procrast' }).selectOption('yes');
    await expectGrowsOnHoverButNotWhenClickedInto(
      page,
      dialog.getByRole('spinbutton', { name: 'Max Visit' }),
      'Max Visit',
    );
  });

  test('a field that is turned off does not react to the mouse', async ({ page }) => {
    await page.goto('/top');
    const search = page.getByRole('searchbox');
    await expect(search).toBeVisible();
    await search.evaluate((element) => ((element as HTMLInputElement).disabled = true));

    await page.mouse.move(0, 0);
    await search.hover({ force: true });
    await page.waitForTimeout(250);
    expect(await transformOf(search)).toBe('none');
  });
});

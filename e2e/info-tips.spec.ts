import { expect, test } from '@playwright/test';
import { createUserAndLogIn, uniqueName } from './helpers';

const fields = [
  { name: 'About You', role: 'textbox', explains: /public profile page/ },
  { name: 'Email', role: 'textbox', explains: /Only admins can see it/ },
  { name: 'Show Dead', role: 'combobox', explains: /Dead stories and comments are ones/ },
  { name: 'No Procrast', role: 'combobox', explains: /you are locked out for Min Away minutes/ },
  { name: 'Max Visit', role: 'spinbutton', explains: /before No Procrast locks you out/ },
  { name: 'Min Away', role: 'spinbutton', explains: /starts a fresh visit/ },
  { name: 'Delay', role: 'spinbutton', explains: /so other people see them later/ },
] as const;

async function openProfile(page: import('@playwright/test').Page) {
  const username = uniqueName('inf');
  await createUserAndLogIn(page, username);
  await page.getByRole('link', { name: `Profile for ${username}` }).click();
  const dialog = page.getByRole('dialog', { name: 'Profile' });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe('the "i" beside each profile setting explains what it is for', () => {
  test('every setting has an info button, which shows and hides its explanation', async ({
    page,
  }) => {
    const dialog = await openProfile(page);

    for (const field of fields) {
      const button = dialog.getByRole('button', { name: `About ${field.name}` });
      const text = dialog.getByText(field.explains);

      await expect(button, field.name).toBeVisible();
      await expect(button, field.name).toHaveAttribute('aria-expanded', 'false');
      await expect(text, `${field.name} closed`).toBeHidden();

      await button.click();
      await expect(button, field.name).toHaveAttribute('aria-expanded', 'true');
      await expect(text, `${field.name} open`).toBeVisible();

      await button.click();
      await expect(text, `${field.name} closed again`).toBeHidden();
    }
  });

  test("the button is big enough to press, and the explanation is the field's description even when closed", async ({
    page,
  }) => {
    const dialog = await openProfile(page);

    for (const field of fields) {
      const box = await dialog.getByRole('button', { name: `About ${field.name}` }).boundingBox();
      expect(box!.width, field.name).toBeGreaterThanOrEqual(24);
      expect(box!.height, field.name).toBeGreaterThanOrEqual(24);

      const control = dialog.getByRole(field.role, { name: field.name, exact: true });
      await expect(control, field.name).toHaveAccessibleDescription(field.explains);
    }
  });

  test('Escape hides an open explanation but does not close the dialog', async ({ page }) => {
    const dialog = await openProfile(page);

    await dialog.getByRole('button', { name: 'About Max Visit' }).click();
    await expect(dialog.getByText(/before No Procrast locks you out/)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog.getByText(/before No Procrast locks you out/)).toBeHidden();
    await expect(dialog).toBeVisible();

    // A second Escape, with nothing showing, closes the dialog as usual.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('the names of other settings in an explanation stand out, and read as plain words', async ({
    page,
  }) => {
    const dialog = await openProfile(page);

    await dialog.getByRole('button', { name: 'About Min Away' }).click();
    const names = dialog.locator('.info-text:visible .setting-name');
    await expect(names).toHaveText(['Max Visit', 'No Procrast']);
    // Bold and in the accent colour, not like the words around them.
    const style = await names.first().evaluate((element) => {
      const own = getComputedStyle(element);
      const around = getComputedStyle(element.parentElement as HTMLElement);
      return {
        weight: own.fontWeight,
        colour: own.color,
        aroundWeight: around.fontWeight,
        aroundColour: around.color,
      };
    });
    expect(Number(style.weight)).toBeGreaterThanOrEqual(700);
    expect(Number(style.aroundWeight)).toBeLessThan(600);
    expect(style.colour).not.toBe(style.aroundColour);

    // A screen reader hears the whole sentence, with no asterisks.
    const description = dialog.getByRole('spinbutton', { name: 'Min Away', exact: true });
    await expect(description).toHaveAccessibleDescription(
      /once Max Visit is reached.*Only used when No Procrast is yes/,
    );
    await expect(description).not.toHaveAccessibleDescription(/\*/);
  });

  test('works from the keyboard', async ({ page }) => {
    const dialog = await openProfile(page);

    await dialog.getByRole('button', { name: 'About Delay' }).focus();
    await page.keyboard.press('Enter');
    await expect(dialog.getByText(/so other people see them later/)).toBeVisible();
    await page.keyboard.press('Space');
    await expect(dialog.getByText(/so other people see them later/)).toBeHidden();
  });

  test('only one explanation shows at a time, and a click anywhere else hides it', async ({
    page,
  }) => {
    const dialog = await openProfile(page);
    const delay = dialog.getByText(/so other people see them later/);
    const showDead = dialog.getByText(/Dead stories and comments/);

    await dialog.getByRole('button', { name: 'About Delay' }).click();
    await expect(delay).toBeVisible();

    // Opening another hides the first.
    await dialog.getByRole('button', { name: 'About Show Dead' }).click();
    await expect(showDead).toBeVisible();
    await expect(delay).toBeHidden();
    await expect(dialog.getByRole('button', { name: 'About Delay' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );

    // Clicking inside the explanation keeps it; clicking elsewhere in the dialog hides it.
    await showDead.click();
    await expect(showDead).toBeVisible();
    await dialog.getByRole('heading', { name: 'Profile' }).click();
    await expect(showDead).toBeHidden();
  });

  test('an open explanation is not still open when the dialog is opened again', async ({
    page,
  }) => {
    const dialog = await openProfile(page);
    await dialog.getByRole('button', { name: 'About Delay' }).click();
    await expect(dialog.getByText(/so other people see them later/)).toBeVisible();
    await dialog.getByRole('link', { name: 'Close' }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole('link', { name: /^Profile for / }).click();
    const reopened = page.getByRole('dialog', { name: 'Profile' });
    await expect(reopened.getByRole('button', { name: 'About Delay' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 800 } });

    test('an open explanation fits inside the dialog', async ({ page }) => {
      const dialog = await openProfile(page);

      await dialog.getByRole('button', { name: 'About Min Away' }).click();
      const text = await dialog.getByText(/starts a fresh visit/).boundingBox();
      const box = await dialog.boundingBox();
      expect(text!.x).toBeGreaterThanOrEqual(box!.x);
      expect(text!.x + text!.width).toBeLessThanOrEqual(box!.x + box!.width);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });
});

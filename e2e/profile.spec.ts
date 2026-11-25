import { expect, test } from '@playwright/test';
import { createUserAndLogIn, submitStory, uniqueName } from './helpers';

test.describe('the profile', () => {
  test('each label is above its control, and there is no box around a setting', async ({ page }) => {
    const username = uniqueName('row');
    await createUserAndLogIn(page, username);
    await page.getByRole('link', { name: `Profile for ${username}` }).click();
    const dialog = page.getByRole('dialog', { name: 'Profile' });

    const pairs: [string, ReturnType<typeof dialog.getByRole>][] = [
      ['About You', dialog.getByRole('textbox', { name: 'About You' })],
      ['Email', dialog.getByRole('textbox', { name: 'Email' })],
      ['Show Dead', dialog.getByRole('combobox', { name: 'Show Dead' })],
      ['No Procrast', dialog.getByRole('combobox', { name: 'No Procrast' })],
      ['Max Visit', dialog.getByRole('spinbutton', { name: 'Max Visit' })],
      ['Min Away', dialog.getByRole('spinbutton', { name: 'Min Away' })],
      ['Delay', dialog.getByRole('spinbutton', { name: 'Delay' })],
    ];
    for (const [label, control] of pairs) {
      // The label element itself (the same words also appear, highlighted, inside other settings' explanations).
      const labelBox = await dialog.locator('label', { hasText: label }).first().boundingBox();
      const controlBox = await control.boundingBox();
      expect(labelBox, label).not.toBeNull();
      expect(controlBox, label).not.toBeNull();
      // The label is above the control, and starts at the same left edge.
      expect(labelBox!.y + labelBox!.height, label).toBeLessThanOrEqual(controlBox!.y + 1);
      expect(Math.abs(labelBox!.x - controlBox!.x), label).toBeLessThan(2);
    }

    // The theme and password buttons are in the row with Update, on one line, in that order.
    const update = await dialog.getByRole('button', { name: 'Update' }).boundingBox();
    const theme = await dialog.getByRole('button', { name: /theme/ }).boundingBox();
    const password = await dialog.getByRole('link', { name: 'Change password' }).boundingBox();
    for (const box of [theme, password]) {
      expect(Math.abs(box!.y - update!.y)).toBeLessThan(2);
      expect(Math.abs(box!.height - update!.height)).toBeLessThan(2);
    }
    expect(theme!.x).toBeGreaterThan(update!.x + update!.width);
    expect(password!.x).toBeGreaterThan(theme!.x + theme!.width);

    // No card around a setting: nothing has a border or a background of its own.
    const boxed = await dialog.locator('.setting').evaluateAll((rows) =>
      rows.filter((row) => {
        const style = getComputedStyle(row);
        return style.borderTopWidth !== '0px' || style.backgroundColor !== 'rgba(0, 0, 0, 0)';
      }).length,
    );
    expect(boxed).toBe(0);
  });

  test('no select or field has a shadow, hovered or not', async ({ page }) => {
    const username = uniqueName('bar');
    await createUserAndLogIn(page, username);
    await page.getByRole('link', { name: `Profile for ${username}` }).click();
    const dialog = page.getByRole('dialog', { name: 'Profile' });
    const shadowOf = (control: ReturnType<typeof dialog.getByRole>) =>
      control.evaluate((element) => getComputedStyle(element).boxShadow);

    const controls: [string, ReturnType<typeof dialog.getByRole>][] = [
      ['Show Dead', dialog.getByRole('combobox', { name: 'Show Dead' })],
      ['No Procrast', dialog.getByRole('combobox', { name: 'No Procrast' })],
      ['About You', dialog.getByRole('textbox', { name: 'About You' })],
      ['Email', dialog.getByRole('textbox', { name: 'Email' })],
      ['Max Visit', dialog.getByRole('spinbutton', { name: 'Max Visit' })],
      ['Min Away', dialog.getByRole('spinbutton', { name: 'Min Away' })],
      ['Delay', dialog.getByRole('spinbutton', { name: 'Delay' })],
    ];

    // Away from every field, over the name at the top of the dialog.
    await dialog.getByRole('heading', { level: 3 }).hover();
    await page.waitForTimeout(300);
    for (const [name, control] of controls) {
      expect(await shadowOf(control), `${name} at rest`).toBe('none');
    }

    for (const [name, control] of controls) {
      await control.hover();
      await page.waitForTimeout(300);
      expect(await shadowOf(control), `${name} hovered`).toBe('none');
    }
  });

  test('opens as a dialog from the avatar, over the stories, and closes with the X', async ({ page }) => {
    const username = uniqueName('olga');
    await createUserAndLogIn(page, username);
    await page.getByRole('link', { name: `Profile for ${username}` }).click();

    const dialog = page.getByRole('dialog', { name: 'Profile' });
    await expect(dialog).toBeVisible();
    await expect(page.locator('article.story').first()).toBeVisible();
    await dialog.getByRole('link', { name: 'Close' }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/top$/);
  });

  test('saves the settings, closes on Update, and has them again when it is reopened', async ({ page }) => {
    const username = uniqueName('paul');
    await createUserAndLogIn(page, username);
    await page.getByRole('link', { name: `Profile for ${username}` }).click();

    const dialog = page.getByRole('dialog', { name: 'Profile' });
    await dialog.getByRole('textbox', { name: 'About You' }).fill('I write the e2e tests');
    await dialog.getByLabel('Email', { exact: true }).fill('paul@example.com');
    await dialog.getByLabel('Show Dead', { exact: true }).selectOption('yes');
    await dialog.getByLabel('No Procrast', { exact: true }).selectOption('yes');
    await dialog.getByLabel('Max Visit', { exact: true }).fill('45');
    await dialog.getByRole('button', { name: 'Update' }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText('Profile updated')).toBeHidden();

    // Still there after a full reload: it is saved on the server, not just in the page.
    await page.reload();
    await page.getByRole('link', { name: `Profile for ${username}` }).click();
    const reopened = page.getByRole('dialog', { name: 'Profile' });
    await expect(reopened.getByLabel('Email', { exact: true })).toHaveValue('paul@example.com');
    await expect(reopened.getByRole('textbox', { name: 'About You' })).toHaveValue('I write the e2e tests');
    await expect(reopened.getByLabel('Show Dead', { exact: true })).toHaveValue('yes');
    await expect(reopened.getByLabel('Max Visit', { exact: true })).toHaveValue('45');
  });

  test('does not close, and says why, when the email is not valid', async ({ page }) => {
    const username = uniqueName('quin');
    await createUserAndLogIn(page, username);
    await page.getByRole('link', { name: `Profile for ${username}` }).click();

    const dialog = page.getByRole('dialog', { name: 'Profile' });
    await dialog.getByLabel('Email', { exact: true }).fill('not-an-email');
    await dialog.getByLabel('Email', { exact: true }).blur();
    await expect(dialog.getByText('Enter a valid email address')).toBeVisible();
    // The button is not turned off: pressing it keeps the dialog open and moves to the email.
    await dialog.getByRole('button', { name: 'Update' }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Email', { exact: true })).toBeFocused();
  });

  test('the About box is shown on the user\'s page, and the email never is', async ({ page }) => {
    const username = uniqueName('rosa');
    await createUserAndLogIn(page, username);
    await page.getByRole('link', { name: `Profile for ${username}` }).click();
    const dialog = page.getByRole('dialog', { name: 'Profile' });
    await dialog.getByRole('textbox', { name: 'About You' }).fill('Hello from rosa');
    await dialog.getByLabel('Email', { exact: true }).fill('rosa-private@example.com');
    await dialog.getByRole('button', { name: 'Update' }).click();
    await expect(dialog).toBeHidden();

    await page.goto(`/user/${username}`);
    await expect(page.getByText('Hello from rosa')).toBeVisible();
    await expect(page.getByText('rosa-private@example.com')).toBeHidden();
    await expect(page.locator('body')).not.toContainText('rosa-private@example.com');
  });

  test('a user of this app has a page, found through the stories they submitted', async ({ page }) => {
    const username = uniqueName('sam');
    await createUserAndLogIn(page, username);
    await submitStory(page, { title: 'Sam\'s story', link: 'https://example.com/sam' });

    await page.getByRole('link', { name: 'New', exact: true }).click();
    await page.locator('article.story', { hasText: 'Sam\'s story' }).getByRole('link', { name: username }).click();
    await expect(page).toHaveURL(new RegExp(`/user/${username}$`));
    await expect(page.getByRole('heading', { name: username })).toBeVisible();
    await expect(page.getByText('Submissions')).toBeVisible();
  });
});

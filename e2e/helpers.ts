import { expect, type Page } from '@playwright/test';

export const password = 'correct-horse-battery';

/** A username that has not been used yet in this run. Usernames are at most 15 characters. */
export function uniqueName(prefix: string) {
  return `${prefix}${Math.random().toString(36).slice(2, 8)}`;
}

/** Makes an account, the way a person does: the create-user dialog, then the log-in dialog. */
export async function createUser(page: Page, username: string) {
  await page.goto('/create-user');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Verify password').fill(password);
  await page.getByRole('button', { name: 'Create user' }).click();
  await expect(page).toHaveURL(/\/log-in/);
}

/** Logs in on the log-in dialog that is open. */
export async function logIn(page: Page, username: string) {
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Log Out' })).toBeVisible();
}

/** Makes an account and logs in, ending on the story list. */
export async function createUserAndLogIn(page: Page, username: string) {
  await createUser(page, username);
  await logIn(page, username);
}

/** Opens the Submit dialog from the side menu and sends a story or question. */
export async function submitStory(
  page: Page,
  fields: { title: string; link?: string; text?: string },
) {
  await page.getByRole('link', { name: 'Submit', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Submit a story' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Title').fill(fields.title);
  if (fields.link) {
    await dialog.getByLabel('Link').fill(fields.link);
  }
  if (fields.text) {
    await dialog.getByLabel(/^Text/).fill(fields.text);
  }
  await dialog.getByRole('button', { name: /^Submit (story|question)$/ }).click();
  await expect(dialog).toBeHidden();
}

/** The story cards on the page, by their title. */
export const storyTitles = (page: Page) => page.locator('article.story h3');

/** Opens the profile, changes some settings, and presses Update. The email is needed to save. */
export async function saveProfile(
  page: Page,
  username: string,
  settings: {
    showDead?: 'yes' | 'no';
    noProcrast?: 'yes' | 'no';
    maxVisit?: number;
    minAway?: number;
    delay?: number;
  },
) {
  await page.getByRole('link', { name: `Profile for ${username}` }).click();
  const dialog = page.getByRole('dialog', { name: 'Profile' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Email', { exact: true }).fill(`${username}@example.com`);
  if (settings.showDead)
    await dialog.getByLabel('Show Dead', { exact: true }).selectOption(settings.showDead);
  if (settings.noProcrast)
    await dialog.getByLabel('No Procrast', { exact: true }).selectOption(settings.noProcrast);
  if (settings.maxVisit !== undefined)
    await dialog.getByLabel('Max Visit', { exact: true }).fill(String(settings.maxVisit));
  if (settings.minAway !== undefined)
    await dialog.getByLabel('Min Away', { exact: true }).fill(String(settings.minAway));
  if (settings.delay !== undefined)
    await dialog.getByLabel('Delay', { exact: true }).fill(String(settings.delay));
  await dialog.getByRole('button', { name: 'Update' }).click();
  await expect(dialog).toBeHidden();
}

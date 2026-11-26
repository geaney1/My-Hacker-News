import { expect, test } from '@playwright/test';
import { openPage, saveProfile, createUserAndLogIn, submitStory, uniqueName } from './helpers';

// The settings in the profile do what their "i" explanations say. Each is tried the way a person
// would: change the setting, press Update, and look at the app.

test.describe('Show Dead', () => {
  test('hides dead stories and comments until it is turned on, then marks them [dead]', async ({
    page,
  }) => {
    const username = uniqueName('dead');
    await createUserAndLogIn(page, username);

    // Off by default: the dead story and the dead comment are left out.
    await page.getByRole('link', { name: 'New', exact: true }).click();
    await expect(
      page.locator('article.story', { hasText: 'Fresh Hacker News story' }),
    ).toBeVisible();
    await expect(
      page.locator('article.story', { hasText: 'A dead Hacker News story' }),
    ).toHaveCount(0);
    await page.goto('/item/101');
    await expect(page.getByText('A comment from Hacker News')).toBeVisible();
    await expect(page.getByText('A dead comment')).toHaveCount(0);

    // On: both appear, marked as dead.
    await page.goto('/new');
    await saveProfile(page, username, { showDead: 'yes' });
    const deadStory = page.locator('article.story', { hasText: 'A dead Hacker News story' });
    await expect(deadStory).toBeVisible();
    await expect(deadStory.locator('.dead')).toHaveText('[dead]');
    await expect(
      page.locator('article.story', { hasText: 'Fresh Hacker News story' }).locator('.dead'),
    ).toHaveCount(0);

    await page.goto('/item/101');
    const deadComment = page.locator('app-story-comment', { hasText: 'A dead comment' });
    await expect(deadComment).toBeVisible();
    await expect(deadComment.locator('.dead').first()).toHaveText('[dead]');

    // Off again: gone again.
    await page.goto('/new');
    await saveProfile(page, username, { showDead: 'no' });
    await expect(
      page.locator('article.story', { hasText: 'A dead Hacker News story' }),
    ).toHaveCount(0);
  });

  test('is per person: someone who has not turned it on still does not see dead things', async ({
    page,
    browser,
  }) => {
    const username = uniqueName('dead');
    await createUserAndLogIn(page, username);
    await saveProfile(page, username, { showDead: 'yes' });

    const other = await (await browser.newContext()).newPage();
    await other.goto('/new');
    await expect(
      other.locator('article.story', { hasText: 'Fresh Hacker News story' }),
    ).toBeVisible();
    await expect(
      other.locator('article.story', { hasText: 'A dead Hacker News story' }),
    ).toHaveCount(0);
    await other.context().close();
  });
});

test.describe('No Procrast, Max Visit and Min Away', () => {
  /** Makes it look as if the visit began `minutes` minutes ago, in this browser. */
  const startedMinutesAgo = (
    page: import('@playwright/test').Page,
    username: string,
    minutes: number,
  ) =>
    page.evaluate(
      ([key, started]) =>
        localStorage.setItem(
          key,
          JSON.stringify({ visitStart: started, lastSeen: Date.now(), lockedUntil: 0 }),
        ),
      [`hacker-news.visit.${username.toLowerCase()}`, Date.now() - minutes * 60_000] as const,
    );

  test('shuts the user out once a visit has lasted Max Visit minutes, for Min Away minutes', async ({
    page,
  }) => {
    const username = uniqueName('proc');
    await createUserAndLogIn(page, username);
    await saveProfile(page, username, { noProcrast: 'yes', maxVisit: 1, minAway: 10 });

    // Not locked yet: the visit has only just begun.
    await page.goto('/top');
    await expect(page.locator('article.story').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Time for a break' })).toHaveCount(0);

    // Two minutes later (Max Visit is one): the page is replaced by a notice with the time left.
    await startedMinutesAgo(page, username, 2);
    await page.reload();
    const notice = page.locator('.visit-limit');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('Time for a break');
    await expect(notice).toContainText('about 10 minutes');
    await expect(page.locator('article.story')).toHaveCount(0);
  });

  test('stays shut across a reload, and the profile can still be opened to turn it off', async ({
    page,
  }) => {
    const username = uniqueName('proc');
    await createUserAndLogIn(page, username);
    await saveProfile(page, username, { noProcrast: 'yes', maxVisit: 1, minAway: 10 });
    await startedMinutesAgo(page, username, 2);
    await page.reload();
    await expect(page.locator('.visit-limit')).toBeVisible();

    await page.reload();
    await expect(page.locator('.visit-limit')).toBeVisible();

    // The notice has a link to the profile; turning No Procrast off lets the user back in.
    await page.getByRole('link', { name: 'Change your profile settings' }).click();
    const dialog = page.getByRole('dialog', { name: 'Profile' });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Email', { exact: true }).fill(`${username}@example.com`);
    await dialog.getByLabel('No Procrast', { exact: true }).selectOption('no');
    await dialog.getByRole('button', { name: 'Update' }).click();

    await expect(page.locator('.visit-limit')).toHaveCount(0);
    await expect(page.locator('article.story').first()).toBeVisible();
  });

  test('does nothing while No Procrast is no, however long a visit is', async ({ page }) => {
    const username = uniqueName('proc');
    await createUserAndLogIn(page, username);
    // The limits can only be typed in while No Procrast is yes; they are kept when it is turned back to no.
    await saveProfile(page, username, { noProcrast: 'yes', maxVisit: 1, minAway: 10 });
    await saveProfile(page, username, { noProcrast: 'no' });
    await startedMinutesAgo(page, username, 500);
    await page.reload();
    await expect(page.locator('article.story').first()).toBeVisible();
    await expect(page.locator('.visit-limit')).toHaveCount(0);
  });

  test('lets the user back in once Min Away minutes have passed', async ({ page }) => {
    const username = uniqueName('proc');
    await createUserAndLogIn(page, username);
    await saveProfile(page, username, { noProcrast: 'yes', maxVisit: 1, minAway: 10 });

    // The lock ended a minute ago.
    await page.evaluate(
      (key) =>
        localStorage.setItem(
          key,
          JSON.stringify({
            visitStart: 0,
            lastSeen: Date.now() - 11 * 60_000,
            lockedUntil: Date.now() - 60_000,
          }),
        ),
      `hacker-news.visit.${username.toLowerCase()}`,
    );
    await page.reload();
    await expect(page.locator('article.story').first()).toBeVisible();
    await expect(page.locator('.visit-limit')).toHaveCount(0);
  });
});

test.describe('Delay', () => {
  test('holds back new comments from other people for that many minutes, but not from the writer', async ({
    page,
    browser,
  }) => {
    const author = uniqueName('late');
    const title = `Story for delay ${uniqueName('t')}`;
    await createUserAndLogIn(page, author);
    await submitStory(page, { title, link: 'https://example.com/delay' });
    await page.getByRole('link', { name: 'New', exact: true }).click();
    await page
      .locator('article.story', { hasText: title })
      .getByRole('link', { name: '0 comments' })
      .click();
    await expect(page).toHaveURL(/\/item\/\d+$/);
    const storyUrl = page.url();

    // A delay of 60 minutes: the writer sees the comment, nobody else does.
    await page.goto('/new');
    await saveProfile(page, author, { delay: 60 });
    await openPage(page, storyUrl);
    await page.getByLabel('Add a comment').fill('Held back for an hour');
    await page.getByRole('button', { name: 'Add comment' }).click();
    await expect(page.getByText('Held back for an hour')).toBeVisible();

    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto(storyUrl);
    await expect(visitor.getByRole('heading', { name: title })).toBeVisible();
    await expect(visitor.getByText('Held back for an hour')).toHaveCount(0);
    await expect(visitor.getByRole('heading', { name: '0 comments' })).toBeVisible();

    // With no delay, a new comment is seen by everyone at once. The earlier one is still held back.
    await page.goto('/new');
    await saveProfile(page, author, { delay: 0 });
    await openPage(page, storyUrl);
    await page.getByLabel('Add a comment').fill('Seen straight away');
    await page.getByRole('button', { name: 'Add comment' }).click();
    await expect(page.getByText('Seen straight away')).toBeVisible();

    await visitor.reload();
    await expect(visitor.getByText('Seen straight away')).toBeVisible();
    await expect(visitor.getByText('Held back for an hour')).toHaveCount(0);
    await expect(visitor.getByRole('heading', { name: '1 comments' })).toBeVisible();
    await visitor.context().close();
  });

  test('holds back a comment on a Hacker News story once the writer has logged out', async ({
    page,
  }) => {
    const author = uniqueName('hold');
    await createUserAndLogIn(page, author);
    await page.goto('/new');
    await saveProfile(page, author, { delay: 60 });
    await page.goto('/top');
    await page.locator('a.comments-link[href="/item/101"]').click();
    await page.getByLabel('Add a comment').fill('Held back on Hacker News');
    await page.getByRole('button', { name: 'Add comment' }).click();
    await expect(page.getByText('Held back on Hacker News')).toBeVisible();

    // Logging out leaves the comment in the browser's memory, so nothing may reload the page.
    await page.getByRole('button', { name: 'Log Out' }).click();
    await page.goBack();
    const count = page.locator('a.comments-link[href="/item/101"]');
    await expect(count).toHaveText('1 comments');
    await count.click();
    await expect(page.getByText('A comment from Hacker News')).toBeVisible();
    await expect(page.getByText('Held back on Hacker News')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '1 comments' })).toBeVisible();
  });
});

test.describe('About You and Email', () => {
  test('About is shown on the public profile page, and the email never is', async ({
    page,
    browser,
  }) => {
    const username = uniqueName('abt');
    await createUserAndLogIn(page, username);
    await page.getByRole('link', { name: `Profile for ${username}` }).click();
    const dialog = page.getByRole('dialog', { name: 'Profile' });
    await dialog
      .getByRole('textbox', { name: 'About You', exact: true })
      .fill('I like testing the profile');
    await dialog.getByLabel('Email', { exact: true }).fill('secret-address@example.com');
    await dialog.getByRole('button', { name: 'Update' }).click();
    await expect(dialog).toBeHidden();

    // Anyone can read the public page: the About text is on it, the email is not.
    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto(`/user/${username}`);
    await expect(visitor.getByText('I like testing the profile')).toBeVisible();
    await expect(visitor.locator('body')).not.toContainText('secret-address@example.com');
    const api = await visitor.request.get(`/api/users/${username}`);
    expect(JSON.stringify(await api.json())).not.toContain('secret-address');
    await visitor.context().close();
  });
});

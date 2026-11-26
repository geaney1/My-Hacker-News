import { expect, test } from '@playwright/test';
import { openPage, createUserAndLogIn, storyTitles, submitStory, uniqueName } from './helpers';

test.describe('submitting stories and questions', () => {
  test('a story with a link shows up in New, and is a story', async ({ page }) => {
    await createUserAndLogIn(page, uniqueName('gina'));
    await submitStory(page, { title: 'My e2e story', link: 'https://example.com/mine' });

    await page.getByRole('link', { name: 'New', exact: true }).click();
    const card = page.locator('article.story', { hasText: 'My e2e story' });
    await expect(card).toBeVisible();
    await expect(card.getByRole('link', { name: /My e2e story/ })).toHaveAttribute(
      'href',
      'https://example.com/mine',
    );
  });

  test('a question with no link shows up in Ask, and opens its own page', async ({ page }) => {
    await createUserAndLogIn(page, uniqueName('hank'));
    await submitStory(page, { title: 'My e2e question', text: 'Does this work?' });

    await page.getByRole('link', { name: 'Ask', exact: true }).click();
    await page.getByRole('link', { name: /My e2e question/ }).click();
    await expect(page).toHaveURL(/\/item\/\d+$/);
    await expect(page.getByText('Does this work?')).toBeVisible();
  });

  test('is placed among the Hacker News stories by time, not always on top', async ({ page }) => {
    await createUserAndLogIn(page, uniqueName('iris'));
    await submitStory(page, { title: 'Brand new e2e story', link: 'https://example.com/new' });

    // Made just now, so it comes after the fake Hacker News story that is dated an hour ahead,
    // and above the older ones: placed by time, not pinned to the top.
    await page.getByRole('link', { name: 'New', exact: true }).click();
    await expect(storyTitles(page).first()).toContainText('Fresh Hacker News story');
    await expect(storyTitles(page).nth(1)).toContainText('Brand new e2e story');
    await expect(storyTitles(page).last()).toContainText('Older Hacker News story');
  });

  test('the Submit button is never off: pressing it says what is wrong and goes to the first field to fix', async ({
    page,
  }) => {
    await createUserAndLogIn(page, uniqueName('jack'));
    await page.getByRole('link', { name: 'Submit', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Submit a story' });
    const send = dialog.getByRole('button', { name: /^Submit (story|question)$/ });

    await expect(send).toBeEnabled();
    await send.click();
    await expect(dialog.getByText('A title is required')).toBeVisible();
    await expect(dialog.getByLabel('Title')).toBeFocused();

    await dialog.getByLabel('Title').fill('A title');
    // No link, and no text: nothing to discuss yet. Pressing the button says so.
    await send.click();
    await expect(dialog.getByText('Add a link, or text to start a discussion')).toBeVisible();
    await expect(dialog.getByLabel('Text')).toBeFocused();

    await dialog.getByLabel('Link').fill('example.com');
    await dialog.getByLabel('Link').blur();
    await expect(
      dialog.getByText('Enter a full web address that starts with http:// or https://'),
    ).toBeVisible();
    await send.click();
    await expect(dialog.getByLabel('Link')).toBeFocused();

    await dialog.getByLabel('Link').fill('https://example.com/ok');
    await expect(send).toBeEnabled();
    await expect(send).toHaveText(/Submit story/);
  });

  test('the Submit button says question when there is no link', async ({ page }) => {
    await createUserAndLogIn(page, uniqueName('kate'));
    await page.getByRole('link', { name: 'Submit', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Submit a story' });
    await dialog.getByLabel('Title').fill('Why?');
    await dialog.getByLabel(/^Text/).fill('Because.');
    await expect(dialog.getByRole('button', { name: 'Submit question' })).toBeEnabled();
  });
});

test.describe('comments', () => {
  test('a comment on a story submitted here is kept, for everyone, after a reload', async ({
    page,
    browser,
  }) => {
    const author = uniqueName('liam');
    await createUserAndLogIn(page, author);
    await submitStory(page, { title: 'Story to discuss', link: 'https://example.com/discuss' });
    await page.getByRole('link', { name: 'New', exact: true }).click();
    await page
      .locator('article.story', { hasText: 'Story to discuss' })
      .getByRole('link', { name: '0 comments' })
      .click();
    await expect(page).toHaveURL(/\/item\/\d+$/);
    const storyUrl = page.url();

    await page.getByLabel('Add a comment').fill('First e2e comment');
    await page.getByRole('button', { name: 'Add comment' }).click();
    await expect(page.getByText('First e2e comment')).toBeVisible();
    await expect(page.getByRole('heading', { name: '1 comments' })).toBeVisible();

    await page.reload();
    await expect(page.getByText('First e2e comment')).toBeVisible();

    // Someone who is not logged in sees it too, and is asked to log in to write their own.
    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto(storyUrl);
    await expect(visitor.getByText('First e2e comment')).toBeVisible();
    await expect(visitor.getByRole('link', { name: 'Log in', exact: true })).toBeVisible();
    await visitor.context().close();
  });

  test('the comment count on the list matches the comments on the story', async ({ page }) => {
    await createUserAndLogIn(page, uniqueName('mona'));
    await submitStory(page, { title: 'Counted story', link: 'https://example.com/counted' });
    await page.getByRole('link', { name: 'New', exact: true }).click();
    await page
      .locator('article.story', { hasText: 'Counted story' })
      .getByRole('link', { name: '0 comments' })
      .click();

    await page.getByLabel('Add a comment').fill('One');
    await page.getByRole('button', { name: 'Add comment' }).click();
    await expect(page.getByRole('heading', { name: '1 comments' })).toBeVisible();
    await page.getByLabel('Add a comment').fill('Two');
    await page.getByRole('button', { name: 'Add comment' }).click();
    await expect(page.getByRole('heading', { name: '2 comments' })).toBeVisible();

    await page.getByRole('button', { name: '← Back' }).click();
    await page.getByRole('link', { name: 'New', exact: true }).click();
    await expect(
      page
        .locator('article.story', { hasText: 'Counted story' })
        .getByRole('link', { name: '2 comments' }),
    ).toBeVisible();
  });

  test('a comment on a Hacker News story is only kept until the page is reloaded', async ({
    page,
  }) => {
    await createUserAndLogIn(page, uniqueName('nate'));
    await openPage(page, '/item/101');
    await page.getByLabel('Add a comment').fill('Gone after reload');
    await page.getByRole('button', { name: 'Add comment' }).click();
    await expect(page.getByText('Gone after reload')).toBeVisible();

    await page.reload();
    await expect(page.getByText('A comment from Hacker News')).toBeVisible();
    await expect(page.getByText('Gone after reload')).toBeHidden();
  });

  test('a comment on a Hacker News story is counted on the list until then', async ({ page }) => {
    await createUserAndLogIn(page, uniqueName('olga'));
    await page.goto('/top');
    const card = page.locator('article.story').filter({ has: page.locator('a[href="/item/101"]') });
    const count = card.locator('a.comments-link');
    const before = Number((await count.innerText()).match(/\d+/)?.[0]);

    await count.click();
    await page.getByLabel('Add a comment').fill('Counted on the list');
    await page.getByRole('button', { name: 'Add comment' }).click();
    await expect(page.getByText('Counted on the list')).toBeVisible();
    await page.getByRole('button', { name: '← Back' }).click();

    await expect(count).toHaveText(`${before + 1} comments`);
  });

  test('a visitor who is not logged in is asked to log in to comment', async ({ page }) => {
    await page.goto('/item/101');
    await expect(page.getByRole('link', { name: 'Log in', exact: true })).toBeVisible();
    await expect(page.getByLabel('Add a comment')).toBeHidden();

    // The prompt is on the same line as the comment count, to the right of it.
    const count = await page.getByRole('heading', { name: /comments$/ }).boundingBox();
    const prompt = await page.locator('.login-prompt').boundingBox();
    expect(count).not.toBeNull();
    expect(prompt).not.toBeNull();
    expect(prompt!.x).toBeGreaterThan(count!.x + count!.width);
    expect(Math.abs(prompt!.y + prompt!.height / 2 - (count!.y + count!.height / 2))).toBeLessThan(
      15,
    );
  });
});

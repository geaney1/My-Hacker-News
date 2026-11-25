import { expect, test } from '@playwright/test';
import { storyTitles } from './helpers';

test.describe('reading the story lists', () => {
  test('the top list shows the stories, and a title opens the article in a new tab', async ({ page }) => {
    await page.goto('/top');
    await expect(storyTitles(page)).toHaveText([/Fake top story/, /Second fake top story/]);

    const link = page.getByRole('link', { name: /Fake top story/ }).first();
    await expect(link).toHaveAttribute('href', 'https://example.com/top');
    await expect(link).toHaveAttribute('target', '_blank');
  });

  test('choosing another list in the side menu shows its stories, and marks it as the current one', async ({ page }) => {
    await page.goto('/top');
    await page.getByRole('link', { name: 'New', exact: true }).click();

    await expect(page).toHaveURL(/\/new$/);
    // Stories submitted in the app are placed among these by time, so only the ends are certain.
    await expect(storyTitles(page).first()).toContainText('Fresh Hacker News story');
    await expect(storyTitles(page).last()).toContainText('Older Hacker News story');
    await expect(page.getByRole('link', { name: 'New', exact: true })).toHaveAttribute('aria-current', 'page');
  });

  test('the comments link opens the story\'s page in this app, with its comments', async ({ page }) => {
    await page.goto('/top');
    await page.getByRole('link', { name: /1 comments/ }).click();

    await expect(page).toHaveURL(/\/item\/101$/);
    await expect(page.getByRole('heading', { name: 'Fake top story' })).toBeVisible();
    await expect(page.getByText('A comment from Hacker News')).toBeVisible();
    await expect(page.getByRole('link', { name: 'hncommenter' })).toBeVisible();
  });

  test('a story without an article, such as an Ask HN, opens its page here', async ({ page }) => {
    await page.goto('/ask');
    await page.getByRole('link', { name: /Ask HN: a fake question/ }).click();

    await expect(page).toHaveURL(/\/item\/301$/);
    await expect(page.getByText('What do you think?')).toBeVisible();
  });

  test('an author links to their page, which shows what Hacker News has on them', async ({ page }) => {
    await page.goto('/top');
    await page.getByRole('link', { name: 'hnauthor' }).first().click();

    await expect(page).toHaveURL(/\/user\/hnauthor$/);
    await expect(page.getByText('Karma')).toBeVisible();
    await expect(page.getByText('1234')).toBeVisible();
  });

  test('a user nobody has heard of is said not to exist', async ({ page }) => {
    await page.goto('/user/nobodyhere');
    await expect(page.getByText('No user named nobodyhere was found.')).toBeVisible();
  });
});

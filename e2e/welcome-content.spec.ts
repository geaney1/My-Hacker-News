import { expect, test } from '@playwright/test';
import { createUserAndLogIn, uniqueName } from './helpers';

test('the welcome page shows its text, and its three links open in a new tab', async ({ page }) => {
  await createUserAndLogIn(page, uniqueName('welc'));
  await page.goto('/welcome');

  const article = page.getByRole('article');
  await expect(article.getByRole('heading', { name: 'Welcome to Hacker News' })).toBeVisible();
  await expect(article.locator('p')).toHaveCount(10);
  await expect(article.locator('p').first()).toContainText('as well as the official guidelines');
  await expect(article.getByRole('link', { name: 'Hacker News' })).toHaveAttribute('href', '/top');
  await expect(article.getByRole('link', { name: 'official guidelines' })).toHaveAttribute(
    'href',
    'https://news.ycombinator.com/newsguidelines.html',
  );
  const perch = article.getByRole('link', { name: 'that (opens in a new tab)', exact: true });
  await expect(perch).toHaveAttribute('href', 'http://en.wikipedia.org/wiki/Nile_perch');
  // All three links open in a new tab, and say so to a screen reader.
  await expect(article.getByRole('link')).toHaveCount(3);
  await expect(article.locator('a[target="_blank"][rel="noopener"]')).toHaveCount(3);
  await expect(article.getByRole('link', { name: /\(opens in a new tab\)$/ })).toHaveCount(3);

  // The first opens this app's Top page in the new tab, and the welcome page stays where it was.
  const [newTab] = await Promise.all([
    page.context().waitForEvent('page'),
    article.getByRole('link', { name: 'Hacker News' }).click(),
  ]);
  await expect(newTab).toHaveURL(/\/top$/);
  await expect(newTab.locator('article.story').first()).toBeVisible();
  await expect(page).toHaveURL(/\/welcome$/);
});

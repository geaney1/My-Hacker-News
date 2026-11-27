import { expect, test } from '@playwright/test';
import { createUserAndLogIn, uniqueName } from './helpers';

test('the welcome page shows its text, and its three links go where they should', async ({
  page,
}) => {
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
  // The two links to other sites open in a new tab, and say so to a screen reader.
  await expect(article.getByRole('link')).toHaveCount(3);
  await expect(article.locator('a[target="_blank"][rel="noopener"]')).toHaveCount(2);
  await expect(article.getByRole('link', { name: /\(opens in a new tab\)$/ })).toHaveCount(2);

  // The first goes to this app's Top page, in the same tab.
  await article.getByRole('link', { name: 'Hacker News', exact: true }).click();
  await expect(page).toHaveURL(/\/top$/);
  await expect(page.locator('article.story').first()).toBeVisible();
  expect(page.context().pages()).toHaveLength(1);
});

import { expect, test, type Page } from '@playwright/test';
import { logIn, createUser, uniqueName } from './helpers';

/** Records every Content Security Policy violation the page has, from before its own scripts run. */
async function recordViolations(page: Page) {
  await page.addInitScript(() => {
    const violations: string[] = [];
    (window as unknown as { violations: string[] }).violations = violations;
    document.addEventListener('securitypolicyviolation', (event) => {
      violations.push(`${event.violatedDirective}: ${event.blockedURI || 'inline'}`);
    });
  });
  return () => page.evaluate(() => (window as unknown as { violations: string[] }).violations);
}

test.describe('security headers and the content security policy', () => {
  test('every page is sent with the headers, and a nonce of its own each time', async ({
    request,
  }) => {
    const first = await request.get('/top');
    const second = await request.get('/top');

    const policy = first.headers()['content-security-policy'];
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(first.headers()['x-content-type-options']).toBe('nosniff');
    expect(first.headers()['x-powered-by']).toBeUndefined();

    const nonceOf = (headers: Record<string, string>) =>
      /'nonce-([^']+)'/.exec(headers['content-security-policy'])?.[1];
    expect(nonceOf(first.headers())).toBeTruthy();
    expect(nonceOf(first.headers())).not.toBe(nonceOf(second.headers()));
  });

  test("every inline script and style in a page has that request's nonce", async ({ request }) => {
    const response = await request.get('/top');
    const nonce = /'nonce-([^']+)'/.exec(response.headers()['content-security-policy'])?.[1];
    const html = await response.text();

    const tags = html.match(/<(script|style)\b[^>]*>/gi) ?? [];
    expect(tags.length).toBeGreaterThan(0);
    for (const tag of tags) {
      expect(tag).toContain(`nonce="${nonce}"`);
    }
    expect(html).toContain(`<app-root ngCspNonce="${nonce}"`);
  });

  test('the pages work with the policy on: nothing the app does is blocked', async ({ page }) => {
    const violations = await recordViolations(page);
    const username = uniqueName('sec');

    await page.goto('/top');
    await expect(page.locator('article.story').first()).toBeVisible();
    await page.getByRole('link', { name: 'New', exact: true }).click();
    await expect(page.locator('article.story').first()).toBeVisible();
    await page.goto('/item/101');
    await expect(page.getByText('A comment from Hacker News')).toBeVisible();
    await page.goto('/user/hnauthor');
    await expect(page.getByText('Karma')).toBeVisible();

    // The dialogs, and the pages that need a login, use the lazily loaded parts of the app.
    await createUser(page, username);
    await logIn(page, username);
    await page.getByRole('link', { name: 'Submit', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Submit a story' })).toBeVisible();
    await page.getByRole('link', { name: 'Close' }).click();
    await page.getByRole('link', { name: `Profile for ${username}` }).click();
    await expect(page.getByRole('dialog', { name: 'Profile' })).toBeVisible();

    expect(await violations()).toEqual([]);
  });

  test('a script that is injected into the page does not run', async ({ page }) => {
    const violations = await recordViolations(page);
    await page.goto('/top');
    await expect(page.locator('article.story').first()).toBeVisible();

    const ran = await page.evaluate(() => {
      const script = document.createElement('script');
      script.textContent = 'window.injectedScriptRan = true';
      document.body.appendChild(script);
      return (window as unknown as { injectedScriptRan?: boolean }).injectedScriptRan === true;
    });

    expect(ran).toBe(false);
    expect(await violations()).toEqual([expect.stringContaining('script-src')]);
  });

  test('the page cannot be put in a frame', async ({ page }) => {
    await page.goto('/top');
    const framed = await page.evaluate(
      (url) =>
        new Promise<boolean>((resolve) => {
          const frame = document.createElement('iframe');
          frame.src = url;
          frame.onload = () => {
            try {
              // A blocked frame is an empty error page of another origin.
              resolve(!!frame.contentDocument?.querySelector('app-root'));
            } catch {
              resolve(false);
            }
          };
          document.body.appendChild(frame);
          setTimeout(() => resolve(false), 3000);
        }),
      '/top',
    );
    expect(framed).toBe(false);
  });
});

import { expect, test } from '@playwright/test';

test.describe('API addresses that do not exist', () => {
  for (const path of ['/api', '/api/nope', '/api/auth/nope', '/api/stories']) {
    test(`GET ${path} answers 404 in JSON, not with a page`, async ({ request }) => {
      // A redirect to a page must not be followed, or it could pass for an answer.
      const response = await request.get(path, { maxRedirects: 0 });

      expect(response.status()).toBe(404);
      expect(response.headers()['content-type']).toContain('application/json');
      expect(await response.json()).toEqual({ message: 'Not found' });
    });
  }

  test('a change sent to an unknown address answers 404 in JSON too', async ({ request }) => {
    const response = await request.post('/api/nope', { data: {}, maxRedirects: 0 });

    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ message: 'Not found' });
  });
});

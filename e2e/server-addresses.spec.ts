import { expect, test } from '@playwright/test';

test.describe('what the server answers outside the API', () => {
  test('sends the built files, to be kept by the browser for a year', async ({ request }) => {
    const page = await (await request.get('/top')).text();
    const script = page.match(/main-[A-Za-z0-9_-]+\.js/)?.[0];

    const response = await request.get(`/${script}`);

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('javascript');
    expect(response.headers()['cache-control']).toContain('max-age=31536000');
  });

  for (const [name, options] of [
    ['JSON', { data: {} }],
    ['a form', { form: { title: 'x' } }],
  ] as const) {
    test(`renders a page that is sent ${name}`, async ({ request }) => {
      const response = await request.post('/top', options);

      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('text/html');
    });
  }

  test('renders a page whose address is very long', async ({ request }) => {
    const response = await request.get(`/no-such-page/${'a'.repeat(300)}`);

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/html');
  });

  test('does not send files from outside the built app', async ({ request }) => {
    const response = await request.get('/..%2f..%2fpackage.json');

    expect(await response.text()).not.toContain('"dependencies"');
  });
});

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('request bodies and addresses', () => {
  let directory: string;
  let api: { url: string; close: () => Promise<unknown> };

  beforeAll(async () => {
    directory = mkdtempSync(join(tmpdir(), 'hn-api-'));
    process.env['DATA_DIR'] = directory;
    const { startApiServer } = await import('./api-server.testing');
    api = await startApiServer();
  });

  afterAll(async () => {
    await api.close();
    delete process.env['DATA_DIR'];
    rmSync(directory, { recursive: true, force: true });
  });

  const send = (body: string | undefined, contentType = 'application/json', path = 'login') =>
    fetch(`${api.url}/auth/${path}`, {
      method: 'POST',
      headers: { 'content-type': contentType },
      body,
    });

  it('answers 413 to a body over 10kb', async () => {
    const response = await send(JSON.stringify({ username: 'x'.repeat(11 * 1024) }));

    expect(response.status).toBe(413);
  });

  it('accepts a body just under 10kb', async () => {
    const response = await send(JSON.stringify({ username: 'x'.repeat(9 * 1024) }));

    // Read and refused as a wrong log-in, not for its size.
    expect(response.status).toBe(401);
  });

  it.each(['{ nope', '{"__proto__": {"admin": true}}'])(
    'answers 400, in JSON, to the body %s',
    async (body) => {
      const response = await send(body);

      expect(response.status).toBe(400);
      expect(response.headers.get('content-type')).toContain('application/json');
    },
  );

  it('takes an empty JSON body as no body at all', async () => {
    expect((await send(undefined, 'application/json', 'logout')).status).toBe(204);
  });

  it.each(['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x'])(
    'answers 415 in its own words to a body of type %s, however big',
    async (contentType) => {
      const response = await send('x'.repeat(20 * 1024), contentType);

      expect(response.status).toBe(415);
      expect(await response.json()).toEqual({ message: 'Send JSON' });
    },
  );

  it('lets a route answer for a very long part of an address', async () => {
    const response = await fetch(`${api.url}/users/${'a'.repeat(300)}`);

    expect(response.status).toBe(400);
  });

  it('does not mind the case of an address, or a slash at its end', async () => {
    const response = await fetch(`${api.url}/Auth/ME/`);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: 'Not logged in' });
  });
});

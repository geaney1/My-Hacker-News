import { mkdtempSync, rmSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';

describe('comments routes', () => {
  let directory: string;
  let server: Server;
  let baseUrl: string;
  let cookie: string;
  let storyId: number;
  let getLocalComments: (id: number, viewer?: string) => Promise<{ by?: string; text?: string }[]>;
  let resetRateLimits: () => void;

  beforeAll(async () => {
    directory = mkdtempSync(join(tmpdir(), 'hn-comment-routes-'));
    process.env['DATA_DIR'] = directory;
    const { createSession } = await import('./sessions-store');
    const { addSubmission } = await import('./submissions-store');
    const comments = await import('./comments-store');
    const routes = await import('./comments-routes');
    getLocalComments = comments.getLocalComments;
    resetRateLimits = routes.resetCommentRateLimits;
    cookie = `hn_session=${await createSession('Anna')}`;
    storyId = (await addSubmission('Billy', 'A story', 'https://example.com')).itemId;

    const app = express();
    app.use('/api/items', express.json({ limit: '10kb' }), routes.commentsRouter);
    server = await new Promise<Server>((resolve) => {
      const listening = app.listen(0, () => resolve(listening));
    });
    baseUrl = `http://localhost:${(server.address() as AddressInfo).port}/api/items`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    delete process.env['DATA_DIR'];
    rmSync(directory, { recursive: true, force: true });
  });

  beforeEach(() => resetRateLimits());

  async function post(
    id: number | string,
    body?: unknown,
    withCookie: string | null = cookie,
    contentType = 'application/json',
  ) {
    const response = await fetch(`${baseUrl}/${id}/comments`, {
      method: 'POST',
      headers: { 'content-type': contentType, ...(withCookie ? { cookie: withCookie } : {}) },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    return {
      status: response.status,
      body: (await response.json().catch(() => null)) as Record<string, unknown> | null,
    };
  }

  it('saves a comment on a submitted story, by the logged-in user, and answers 201', async () => {
    const result = await post(storyId, { text: 'Great story' });
    expect(result.status).toBe(201);
    expect(result.body?.['id']).toBeGreaterThan(3_000_000_000);
    expect((await getLocalComments(storyId)).map((comment) => [comment.by, comment.text])).toContainEqual([
      'Anna',
      'Great story',
    ]);
  });

  it('takes the author from the session, not from the request', async () => {
    await post(storyId, { text: 'Not Billy', username: 'Billy', by: 'Billy' });
    expect((await getLocalComments(storyId)).find((comment) => comment.text === 'Not Billy')?.by).toBe('Anna');
  });

  it('answers 401 without a session', async () => {
    expect((await post(storyId, { text: 'Hi' }, null)).status).toBe(401);
    expect((await post(storyId, { text: 'Hi' }, 'hn_session=nope')).status).toBe(401);
  });

  it('answers 415 when the body is not JSON', async () => {
    expect((await post(storyId, 'text=x', cookie, 'application/x-www-form-urlencoded')).status).toBe(415);
  });

  it.each([
    ['no body', undefined],
    ['no text', {}],
    ['blank text', { text: '   ' }],
    ['text that is not text', { text: 5 }],
    ['text over 2000 characters', { text: 'x'.repeat(2001) }],
  ])('answers 400 for %s', async (_name, body) => {
    expect((await post(storyId, body)).status).toBe(400);
  });

  it('answers 404 for a Hacker News story or one that does not exist, and 400 for a bad id', async () => {
    expect((await post(8863, { text: 'Hi' })).status).toBe(404);
    expect((await post(storyId + 999, { text: 'Hi' })).status).toBe(404);
    expect((await post('abc', { text: 'Hi' })).status).toBe(400);
  });

  it('hides a comment from others for the author Delay, but not from the author', async () => {
    const { saveProfile } = await import('./profiles-store');
    await saveProfile('Anna', {
      about: '', email: 'anna@example.com', showdead: 'no', noprocrast: 'no', maxvisit: 20, minaway: 180, delay: 600,
    });
    await post(storyId, { text: 'Held back' });

    expect((await getLocalComments(storyId, 'Anna')).map((comment) => comment.text)).toContain('Held back');
    expect((await getLocalComments(storyId, 'Ben')).map((comment) => comment.text)).not.toContain('Held back');

    await saveProfile('Anna', {
      about: '', email: 'anna@example.com', showdead: 'no', noprocrast: 'no', maxvisit: 20, minaway: 180, delay: 0,
    });
  });

  it('slows down an address that comments too fast', async () => {
    for (let count = 0; count < 20; count++) {
      expect((await post(storyId, { text: 'x' })).status).toBe(201);
    }
    expect((await post(storyId, { text: 'x' })).status).toBe(429);
  });
});

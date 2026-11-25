import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';

type Result = { status: number; body: Record<string, unknown> | null };

describe('submissions routes', () => {
  let directory: string;
  let server: Server;
  let baseUrl: string;
  let resetRateLimits: () => void;
  let cookie: string;

  beforeAll(async () => {
    directory = mkdtempSync(join(tmpdir(), 'hn-submissions-'));
    process.env['DATA_DIR'] = directory;
    const { createSession } = await import('./sessions-store');
    const { submissionsRouter, resetSubmissionRateLimits } = await import('./submissions-routes');
    resetRateLimits = resetSubmissionRateLimits;
    cookie = `hn_session=${await createSession('Suin')}`;

    const app = express();
    app.use('/api/submissions', express.json({ limit: '10kb' }), submissionsRouter);
    server = await new Promise<Server>((resolve) => {
      const listening = app.listen(0, () => resolve(listening));
    });
    baseUrl = `http://localhost:${(server.address() as AddressInfo).port}/api/submissions`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    delete process.env['DATA_DIR'];
    rmSync(directory, { recursive: true, force: true });
  });

  beforeEach(() => resetRateLimits());

  async function post(body?: unknown, withCookie: string | null = cookie, contentType = 'application/json') {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'content-type': contentType, ...(withCookie ? { cookie: withCookie } : {}) },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json().catch(() => null) } as Result;
  }

  const saved = () =>
    JSON.parse(readFileSync(join(directory, 'submissions.json'), 'utf8')) as Record<string, unknown>[];

  it('saves a story for the logged-in user, trimmed, and answers 201 with its id', async () => {
    const result = await post({ title: '  A good story  ', url: '  https://example.com/post  ' });

    expect(result.status).toBe(201);
    expect(typeof result.body?.['id']).toBe('string');
    expect(saved().at(-1)).toMatchObject({
      id: result.body?.['id'],
      username: 'Suin',
      title: 'A good story',
      url: 'https://example.com/post',
    });
  });

  it('takes the author from the session, not from the request', async () => {
    await post({ title: 'Mine', url: 'https://example.com/mine', username: 'Somebody' });
    expect(saved().at(-1)?.['username']).toBe('Suin');
  });

  it('answers 401 without a session, or with one that does not exist', async () => {
    expect((await post({ title: 'x', url: 'https://example.com' }, null)).status).toBe(401);
    expect((await post({ title: 'x', url: 'https://example.com' }, 'hn_session=nope')).status).toBe(401);
  });

  it('answers 415 when the body is not JSON', async () => {
    expect((await post('title=x', cookie, 'application/x-www-form-urlencoded')).status).toBe(415);
  });

  it.each([
    ['a missing body', undefined],
    ['no title', { url: 'https://example.com' }],
    ['neither a link nor text', { title: 'x' }],
    ['a blank link and blank text', { title: 'x', url: '  ', text: '  ' }],
    ['a title that is not text', { title: 5, url: 'https://example.com' }],
    ['a blank title', { title: '   ', url: 'https://example.com' }],
    ['a title of 81 characters', { title: 'x'.repeat(81), url: 'https://example.com' }],
    ['a link without a scheme', { title: 'x', url: 'example.com' }],
    ['a javascript: link', { title: 'x', url: 'javascript:alert(1)' }],
    ['an ftp link', { title: 'x', url: 'ftp://example.com' }],
    ['a link that is too long', { title: 'x', url: `https://example.com/${'a'.repeat(2000)}` }],
  ])('answers 400 for %s', async (_name, body) => {
    const before = saved().length;
    expect((await post(body)).status).toBe(400);
    expect(saved()).toHaveLength(before);
  });

  it('saves a submission with a link as a story, with or without text', async () => {
    const plain = await post({ title: 'A story', url: 'https://example.com' });
    expect(plain.body?.['kind']).toBe('story');
    expect(saved().at(-1)?.['kind']).toBe('story');
    const withText = await post({ title: 'A story', url: 'https://example.com', text: 'Why' });
    expect(withText.body?.['kind']).toBe('story');
  });

  it('treats a blank link as no link: a question', async () => {
    const result = await post({ title: 'Ask: blank', url: '   ', text: 'Hello' });
    expect(result.body?.['kind']).toBe('question');
    expect(saved().at(-1)?.['url']).toBe('');
  });

  it('saves the optional text, trimmed, and treats a missing text as empty', async () => {
    await post({ title: 'With text', url: 'https://example.com', text: '  Why it matters.  ' });
    expect(saved().at(-1)?.['text']).toBe('Why it matters.');
    await post({ title: 'No text', url: 'https://example.com' });
    expect(saved().at(-1)?.['text']).toBe('');
  });

  it('saves a question for discussion: no link, only text', async () => {
    const result = await post({ title: 'Ask: anything?', text: 'My question' });
    expect(result.status).toBe(201);
    expect(result.body?.['kind']).toBe('question');
    expect(saved().at(-1)).toMatchObject({ kind: 'question', title: 'Ask: anything?', url: '', text: 'My question' });
    expect((await post({ title: 'Ask: again', url: '', text: 'Blank link' })).status).toBe(201);
  });

  it('answers 400 for text that is not text or is too long', async () => {
    expect((await post({ title: 'x', url: 'https://example.com', text: 5 })).status).toBe(400);
    expect((await post({ title: 'x', url: 'https://example.com', text: 'x'.repeat(2001) })).status).toBe(400);
  });

  it('accepts a title of exactly 80 characters', async () => {
    expect((await post({ title: 'x'.repeat(80), url: 'https://example.com' })).status).toBe(201);
  });

  it('slows down an address that submits too many stories', async () => {
    for (let count = 0; count < 10; count++) {
      expect((await post({ title: 'x', url: 'https://example.com' })).status).toBe(201);
    }
    expect((await post({ title: 'x', url: 'https://example.com' })).status).toBe(429);
  });
});

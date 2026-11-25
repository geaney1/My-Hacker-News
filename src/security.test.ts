import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { addCspNonce, nonceOf, parseTrustProxy, securityHeaders, withCspNonce } from './security';

describe('parseTrustProxy', () => {
  it.each([undefined, '', '   '])('is not set for %j', (value) => {
    expect(parseTrustProxy(value)).toBeUndefined();
  });

  it.each([
    ['true', true],
    ['TRUE', true],
    ['false', false],
    ['1', 1],
    [' 2 ', 2],
    ['loopback', 'loopback'],
    ['10.0.0.0/8, 192.168.0.1', '10.0.0.0/8, 192.168.0.1'],
  ])('reads %j as %j', (value, expected) => {
    expect(parseTrustProxy(value)).toBe(expected);
  });
});

describe('addCspNonce', () => {
  const nonce = 'abc123';

  it('puts the nonce on inline scripts and styles', () => {
    const html = '<head><style ng-app-id="ng">a{}</style></head><body><script type="text/javascript" id="x">1</script></body>';
    expect(addCspNonce(html, nonce)).toBe(
      '<head><style nonce="abc123" ng-app-id="ng">a{}</style></head><body><script nonce="abc123" type="text/javascript" id="x">1</script></body>',
    );
  });

  it('also puts it on a script that has a source, which is harmless', () => {
    expect(addCspNonce('<script src="main.js" type="module"></script>', nonce)).toBe(
      '<script nonce="abc123" src="main.js" type="module"></script>',
    );
  });

  it('puts the nonce on the Angular root, for the styles Angular adds later', () => {
    expect(addCspNonce('<app-root></app-root>', nonce)).toBe('<app-root ngCspNonce="abc123"></app-root>');
  });

  it('leaves a tag that has a nonce, and the root that has one, alone', () => {
    const html = '<script nonce="mine">1</script><app-root ngCspNonce="mine"></app-root>';
    expect(addCspNonce(html, nonce)).toBe(html);
  });

  it('does not touch other tags, nor words that only start like them', () => {
    const html = '<scripted></scripted><styled></styled><app-root-other></app-root-other><p>script style</p>';
    expect(addCspNonce(html, nonce)).toBe(html);
  });

  it('handles several tags, and tags in capitals', () => {
    expect(addCspNonce('<SCRIPT>1</SCRIPT><script>2</script>', nonce)).toBe(
      '<SCRIPT nonce="abc123">1</SCRIPT><script nonce="abc123">2</script>',
    );
  });
});

describe('withCspNonce', () => {
  it('adds the nonce to an HTML response, keeping its status and headers but not its length', async () => {
    const response = new Response('<app-root></app-root>', {
      status: 404,
      headers: { 'content-type': 'text/html; charset=utf-8', 'content-length': '21', 'x-keep': 'yes' },
    });
    const result = await withCspNonce(response, 'n1');
    expect(await result.text()).toBe('<app-root ngCspNonce="n1"></app-root>');
    expect(result.status).toBe(404);
    expect(result.headers.get('x-keep')).toBe('yes');
    expect(result.headers.get('content-length')).toBeNull();
  });

  it('passes anything that is not HTML on as it is', async () => {
    const response = new Response('{"a":"<script>"}', { headers: { 'content-type': 'application/json' } });
    expect(await withCspNonce(response, 'n1')).toBe(response);
  });

  it('passes on a response with no type', async () => {
    const response = new Response(null, { status: 204 });
    expect(await withCspNonce(response, 'n1')).toBe(response);
  });
});

describe('securityHeaders', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(...securityHeaders());
    app.get('/nonce', (_request, response) => {
      response.json({ nonce: nonceOf(response) });
    });
    server = await new Promise<Server>((resolve) => {
      const listening = app.listen(0, () => resolve(listening));
    });
    baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const policyOf = async () => {
    const response = await fetch(`${baseUrl}/nonce`);
    const header = response.headers.get('content-security-policy') ?? '';
    const directives = Object.fromEntries(
      header.split(';').map((directive) => {
        const [name, ...values] = directive.trim().split(/\s+/);
        return [name, values];
      }),
    ) as Record<string, string[]>;
    return { response, directives, nonce: ((await response.json()) as { nonce: string }).nonce };
  };

  it('only lets the page run its own scripts and the ones with this request\'s nonce', async () => {
    const { directives, nonce } = await policyOf();
    expect(directives['script-src']).toEqual(["'self'", `'nonce-${nonce}'`]);
    expect(directives['script-src']).not.toContain("'unsafe-inline'");
    expect(directives['script-src']).not.toContain("'unsafe-eval'");
  });

  it('does the same for styles, apart from the style of single elements', async () => {
    const { directives, nonce } = await policyOf();
    expect(directives['style-src']).toEqual(["'self'", `'nonce-${nonce}'`]);
    expect(directives['style-src-attr']).toEqual(["'unsafe-inline'"]);
  });

  it('closes everything else: own server only, no plugins, no framing, no other base or form target', async () => {
    const { directives } = await policyOf();
    expect(directives['default-src']).toEqual(["'self'"]);
    expect(directives['connect-src']).toEqual(["'self'"]);
    expect(directives['object-src']).toEqual(["'none'"]);
    expect(directives['frame-ancestors']).toEqual(["'none'"]);
    expect(directives['base-uri']).toEqual(["'self'"]);
    expect(directives['form-action']).toEqual(["'self'"]);
  });

  it('does not force HTTPS, so the app still works on http://localhost', async () => {
    const { directives } = await policyOf();
    expect(directives).not.toHaveProperty('upgrade-insecure-requests');
  });

  it('makes a new nonce for every request, that cannot be guessed', async () => {
    const nonces = await Promise.all([policyOf(), policyOf(), policyOf()]);
    expect(new Set(nonces.map((result) => result.nonce)).size).toBe(3);
    expect(nonces[0].nonce.length).toBeGreaterThanOrEqual(22);
  });

  it('adds the other security headers, and hides what the server is made with', async () => {
    const { response } = await policyOf();
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('strict-transport-security')).toContain('max-age=');
    expect(response.headers.get('x-frame-options')).toBe('SAMEORIGIN');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('x-powered-by')).toBeNull();
  });
});

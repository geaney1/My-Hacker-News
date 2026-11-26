import fastifyStatic from '@fastify/static';
import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import type { FastifyInstance } from 'fastify';
import { existsSync } from 'node:fs';
import type { ServerResponse } from 'node:http';
import { join } from 'node:path';
import { createApiAdapter } from './api-adapter';
import { createApiApp } from './api-app';
import { nonceOf, parseTrustProxy, securityHeaders, withCspNonce } from './security';

const browserDistFolder = join(import.meta.dirname, '../browser');

const angularApp = new AngularNodeAppEngine();

/**
 * `true` when this file is the server itself (`npm run serve:ssr:hacker-news`, a process manager),
 * and not the dev server or a build step that borrows its request handler. Only the real server
 * sends the security headers: the dev server needs inline scripts and a websocket they would block.
 */
const runsAsServer = isMainModule(import.meta.url) || !!process.env['pm_id'];

// Behind a proxy that ends HTTPS, set TRUST_PROXY (see security.ts) so cookies are marked Secure
// and the rate limits see each visitor's own address.
const adapter = createApiAdapter(parseTrustProxy(process.env['TRUST_PROXY']));

if (runsAsServer) {
  const addSecurityHeaders = securityHeaders();
  // Unlike an ordinary Fastify hook, this one also covers requests the router rejects.
  adapter.registerSecurityHook((request, response) =>
    // `response` is Node's own, though it is only typed as far as setting headers.
    addSecurityHeaders(request.raw, response as ServerResponse),
  );
}

/**
 * The app's own API, served by Nest (see api-module.ts). Its routes win over the more general
 * ones below, which get every request Nest has no route for.
 */
await createApiApp(adapter);
const fastify = adapter.getInstance<FastifyInstance>();

/**
 * Any other API address does not exist: answer in JSON instead of rendering a page.
 */
for (const path of ['/api', '/api/*']) {
  fastify.all(path, (_request, reply) => reply.code(404).send({ message: 'Not found' }));
}

/**
 * Serve static files from /browser. The dev server serves them itself, and has no such folder.
 */
if (existsSync(browserDistFolder)) {
  await fastify.register(fastifyStatic, {
    root: browserDistFolder,
    // One route for each file, so that every other address is left for the pages.
    wildcard: false,
    maxAge: '1y',
    index: false,
    redirect: false,
  });
}

/**
 * Handle all other requests by rendering the Angular application.
 */
await fastify.register(async (pages) => {
  // Angular reads the body of a request itself, so here it is left unread. This replaces the
  // adapter's body parsers for the page routes only.
  pages.removeAllContentTypeParsers();
  pages.addContentTypeParser('*', (_request, _payload, done) => done(null));

  pages.all('/*', async (request, reply) => {
    const response = await angularApp.handle(request.raw);
    if (!response) {
      return reply.callNotFound();
    }
    // The inline scripts and styles of the rendered page get this request's nonce.
    const page = runsAsServer ? await withCspNonce(response, nonceOf(reply.raw)) : response;
    // Angular writes the answer itself.
    reply.hijack();
    await writeResponseToNodeResponse(page, reply.raw);
    return reply;
  });
});

await fastify.ready();

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (runsAsServer) {
  const port = process.env['PORT'] || 4000;
  // Node's own listen, which accepts requests on every network address. Fastify's would only
  // accept them from this machine.
  fastify.server.listen(port, () => {
    console.log(`Node server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler((request, response) => {
  fastify.server.emit('request', request, response);
});

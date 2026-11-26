import { FastifyAdapter } from '@nestjs/platform-fastify';
import type { FastifyInstance } from 'fastify';
import type { parseTrustProxy } from './security';

/** The only request bodies the server reads are small JSON ones. */
const maxBodyBytes = 10 * 1024;

/** The Fastify server Nest runs on. `trustProxy` comes from the TRUST_PROXY setting (see security.ts). */
export function createApiAdapter(trustProxy?: ReturnType<typeof parseTrustProxy>) {
  const adapter = new FastifyAdapter({
    bodyLimit: maxBodyBytes,
    trustProxy,
    // Node's own time limits. Left to itself, Fastify lets a request take for ever to arrive,
    // and keeps idle connections open far longer.
    requestTimeout: 300_000,
    keepAliveTimeout: 5_000,
    routerOptions: {
      // "/API/Auth/Me/" is the same address as "/api/auth/me".
      caseSensitive: false,
      ignoreTrailingSlash: true,
      // Fastify answers 404 once a part of an address is over 100 characters. The longest that
      // Node accepts is allowed instead, so that the routes decide what to answer.
      maxParamLength: 16 * 1024,
    },
  });

  const fastify = adapter.getInstance<FastifyInstance>();
  const parseJson = fastify.getDefaultJsonParser('error', 'error');
  fastify.removeAllContentTypeParsers();
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (request, body: string, done) => {
      // A request may say it is JSON and send nothing: that is no body, not a broken one.
      if (body) {
        parseJson(request, body, done);
      } else {
        done(null, undefined);
      }
    },
  );
  // Any other kind of body is thrown away unread, so that the guards can answer for it.
  fastify.addContentTypeParser('*', (_request, payload, done) => {
    payload.resume();
    done(null);
  });

  return adapter;
}

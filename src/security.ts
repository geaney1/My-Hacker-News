import { randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { RequestHandler, Response as ExpressResponse } from 'express';
import helmet from 'helmet';

/**
 * Reads the TRUST_PROXY setting. Behind a proxy that ends HTTPS (a load balancer, nginx), Express
 * has to be told to trust it, or it sees every request as plain HTTP from the proxy's address.
 * Then the session cookie would not be marked Secure, and the rate limits would count every user
 * as the proxy. Use the number of proxies in front of the server (1), or an address list such as
 * loopback. "true" trusts any X-Forwarded-For a client sends, which anyone can fake. Gives
 * undefined when the setting is not given.
 */
export function parseTrustProxy(value: string | undefined) {
  const text = value?.trim();
  if (!text) {
    return undefined;
  }
  if (text.toLowerCase() === 'true') {
    return true;
  }
  if (text.toLowerCase() === 'false') {
    return false;
  }
  if (/^\d+$/.test(text)) {
    return Number(text);
  }
  return text;
}

const nonceKey = 'cspNonce';

/** The nonce made for this request's Content Security Policy. */
export const nonceOf = (response: ExpressResponse) => response.locals[nonceKey] as string;

const nonceSource = (request: IncomingMessage, response: ServerResponse) =>
  `'nonce-${(response as ExpressResponse).locals[nonceKey]}'`;

/**
 * Security headers on every response, and a Content Security Policy that only lets the page run
 * its own code and styles. The few inline scripts and styles that Angular's server rendering
 * writes into the page carry a new random nonce each time (see addCspNonce), so a script
 * injected into a page would not run.
 *
 * The rest is helmet's defaults: no sniffing of content types, no framing, strict transport
 * security, and no X-Powered-By. The upgrade-insecure-requests directive is left out so the app
 * still works over plain HTTP on localhost.
 */
export function securityHeaders(): RequestHandler[] {
  const makeNonce: RequestHandler = (_request, response, next) => {
    response.locals[nonceKey] = randomBytes(16).toString('base64');
    next();
  };

  return [
    makeNonce,
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", nonceSource],
          styleSrc: ["'self'", nonceSource],
          // Styles set on single elements, such as the width of a poll bar.
          styleSrcAttr: ["'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          fontSrc: ["'self'"],
          // Everything the app asks its own server for.
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  ];
}

/**
 * Puts a nonce on the inline scripts and styles of a server-rendered page, and on the Angular
 * root so the styles Angular adds later get it too. A tag that already has a nonce is left alone.
 */
export function addCspNonce(html: string, nonce: string) {
  return html
    .replace(/<(script|style)(?=[\s>])(?![^>]*\snonce=)/gi, `<$1 nonce="${nonce}"`)
    .replace(/<app-root(?=[\s>])(?![^>]*\sngCspNonce=)/i, `<app-root ngCspNonce="${nonce}"`);
}

/** The same response with a nonce added to its HTML. Anything that is not HTML is passed on as it is. */
export async function withCspNonce(response: Response, nonce: string) {
  if (!response.headers.get('content-type')?.includes('text/html')) {
    return response;
  }
  const headers = new Headers(response.headers);
  // The body changes length.
  headers.delete('content-length');
  const html = addCspNonce(await response.text(), nonce);
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

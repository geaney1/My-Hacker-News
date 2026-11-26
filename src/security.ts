import { randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import helmet from 'helmet';

/**
 * Reads the TRUST_PROXY setting. Behind a proxy that ends HTTPS (a load balancer, nginx), the
 * server has to be told to trust it, or it sees every request as plain HTTP from the proxy's
 * address. Then the session cookie would not be marked Secure, and the rate limits would count
 * every user as the proxy. Use the number of proxies in front of the server (1), or an address
 * list such as loopback. "true" trusts any X-Forwarded-For a client sends, which anyone can fake.
 * Gives undefined when the setting is not given.
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
    // That many proxies, counted from the server, are trusted. Fastify ignores a plain number,
    // because it cannot tell whether a request really came through them. So only use one when
    // the server cannot be reached except through the proxies.
    const proxies = Number(text);
    return (_address: string, hop: number) => hop < proxies;
  }
  return text;
}

const nonces = new WeakMap<ServerResponse, string>();

/** The nonce made for this request's Content Security Policy. */
export const nonceOf = (response: ServerResponse) => nonces.get(response) as string;

const nonceSource = (_request: IncomingMessage, response: ServerResponse) =>
  `'nonce-${nonceOf(response)}'`;

/**
 * Gives a function that puts security headers on a response, with a Content Security Policy
 * that only lets the page run its own code and styles. The few inline scripts and styles of a
 * rendered page (the theme script in index.html, and those Angular's server rendering writes)
 * carry a new random nonce each time (see addCspNonce), so a script injected into a page would
 * not run.
 *
 * The rest is helmet's defaults: no sniffing of content types, no framing, strict transport
 * security, and no X-Powered-By. The upgrade-insecure-requests directive is left out so the app
 * still works over plain HTTP on localhost.
 */
export function securityHeaders() {
  const addHeaders = helmet({
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
  });

  // The function gives back an error when a header could not be made, and nothing otherwise.
  return (request: IncomingMessage, response: ServerResponse) => {
    nonces.set(response, randomBytes(16).toString('base64'));
    // helmet calls back before it returns.
    let failure: Error | undefined;
    addHeaders(request, response, (error) => {
      failure = error as Error | undefined;
    });
    return failure;
  };
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

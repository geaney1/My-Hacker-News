import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { jwtVerify, SignJWT } from 'jose';
import { dataDirectory } from './accounts-store';

export const sessionCookieName = 'hn_session';

/** How long a token is valid for. The server hands out a fresh one while the user is active. */
export const sessionSeconds = 24 * 60 * 60;

const algorithm = 'HS256';
const issuer = 'hacker-news-app';
const audience = 'hacker-news-app';

const secretFile = join(dataDirectory, 'session-secret');

let secretPromise: Promise<Uint8Array> | undefined;

/** The key that signs the tokens. It is created once and kept, so logins survive restarts. */
function getSecret() {
  secretPromise ??= (async () => {
    const fromEnvironment = process.env['SESSION_SECRET'];
    if (fromEnvironment) {
      return new TextEncoder().encode(fromEnvironment);
    }
    try {
      return Buffer.from((await readFile(secretFile, 'utf8')).trim(), 'hex');
    } catch {
      const secret = randomBytes(32);
      await mkdir(dataDirectory, { recursive: true });
      await writeFile(secretFile, secret.toString('hex'), { mode: 0o600 });
      return secret;
    }
  })();
  return secretPromise;
}

export type Session = {
  username: string;
  /** The account's session version when the token was issued. */
  version: number;
  /** When the token was issued, in Unix seconds. */
  issuedAt: number;
};

/**
 * A JWT for `username`: the subject is the username, `ver` is the account's session version,
 * and it expires after `sessionSeconds`.
 */
export async function createSessionToken(username: string, version: number) {
  return new SignJWT({ ver: version })
    .setProtectedHeader({ alg: algorithm })
    .setSubject(username)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(`${sessionSeconds}s`)
    .sign(await getSecret());
}

/**
 * Checks a JWT's signature, algorithm, issuer, audience and expiry.
 * Resolves to the session it carries, or `null` when the token is missing or not valid.
 */
export async function readSessionToken(token: string | undefined) {
  if (!token) {
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, await getSecret(), {
      algorithms: [algorithm],
      issuer,
      audience,
    });
    return typeof payload.sub === 'string' &&
      typeof payload.iat === 'number' &&
      typeof payload['ver'] === 'number'
      ? ({ username: payload.sub, version: payload['ver'], issuedAt: payload.iat } satisfies Session)
      : null;
  } catch {
    return null;
  }
}

/** `true` once more than half of a token's life has passed, so it is time to issue a new one. */
export function shouldRenew(session: Session) {
  return Date.now() / 1000 - session.issuedAt > sessionSeconds / 2;
}

/** Reads one cookie from a `Cookie` request header. */
export function readCookie(cookieHeader: string | undefined, name: string) {
  for (const part of cookieHeader?.split(';') ?? []) {
    const separator = part.indexOf('=');
    if (part.slice(0, separator).trim() === name) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }
  return undefined;
}

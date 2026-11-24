import { SignJWT } from 'jose';

type SessionModule = typeof import('./session');

const secretText = 'a-test-secret-that-is-long-enough-for-hs256';
const secret = new TextEncoder().encode(secretText);
const nowInSeconds = () => Math.floor(Date.now() / 1000);

/** A token signed like the app's own, with room to change one claim at a time. */
function buildToken(
  options: { key?: Uint8Array; issuer?: string; claims?: Record<string, unknown>; issuedAt?: number; expiresAt?: number } = {},
) {
  return new SignJWT({ ver: 0, ...options.claims })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('Anna')
    .setIssuer(options.issuer ?? 'hacker-news-app')
    .setAudience('hacker-news-app')
    .setIssuedAt(options.issuedAt)
    .setExpirationTime(options.expiresAt ?? nowInSeconds() + 3600)
    .sign(options.key ?? secret);
}

describe('session tokens', () => {
  let session: SessionModule;

  beforeAll(async () => {
    process.env['SESSION_SECRET'] = secretText;
    session = await import('./session');
  });

  it('creates a standard three-part JWT with the expected claims', async () => {
    const token = await session.createSessionToken('Anna', 3);
    const [header, payload] = token
      .split('.')
      .slice(0, 2)
      .map((part) => JSON.parse(Buffer.from(part, 'base64url').toString()));

    expect(token.split('.')).toHaveLength(3);
    expect(header).toEqual({ alg: 'HS256' });
    expect(payload).toMatchObject({
      sub: 'Anna',
      ver: 3,
      iss: 'hacker-news-app',
      aud: 'hacker-news-app',
    });
    expect(payload.exp - payload.iat).toBe(session.sessionSeconds);
  });

  it('reads back the username, the version and when the token was issued', async () => {
    const result = await session.readSessionToken(await session.createSessionToken('Anna', 2));
    expect(result).toMatchObject({ username: 'Anna', version: 2 });
    expect(Math.abs((result?.issuedAt ?? 0) - nowInSeconds())).toBeLessThan(5);
  });

  it('rejects a missing, garbage or tampered token', async () => {
    const token = await session.createSessionToken('Anna', 0);
    expect(await session.readSessionToken(undefined)).toBeNull();
    expect(await session.readSessionToken('')).toBeNull();
    expect(await session.readSessionToken('abc')).toBeNull();
    expect(await session.readSessionToken(`${token.slice(0, -2)}xx`)).toBeNull();
  });

  it('rejects a token with the "none" algorithm and no signature', async () => {
    const payload = (await session.createSessionToken('Anna', 0)).split('.')[1];
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    expect(await session.readSessionToken(`${header}.${payload}.`)).toBeNull();
  });

  it('rejects a token signed with the right key but another algorithm', async () => {
    const otherAlgorithm = await new SignJWT({ ver: 0 })
      .setProtectedHeader({ alg: 'HS512' })
      .setSubject('Anna')
      .setIssuer('hacker-news-app')
      .setAudience('hacker-news-app')
      .setIssuedAt()
      .setExpirationTime(nowInSeconds() + 3600)
      .sign(secret);
    expect(await session.readSessionToken(otherAlgorithm)).toBeNull();
  });

  it('accepts a token built the same way the app builds it', async () => {
    expect(await session.readSessionToken(await buildToken())).toMatchObject({ username: 'Anna' });
  });

  it('rejects a token signed with a different key', async () => {
    const forged = await buildToken({ key: new TextEncoder().encode('another-secret-another-secret!!') });
    expect(await session.readSessionToken(forged)).toBeNull();
  });

  it('rejects an expired token', async () => {
    const expired = await buildToken({ issuedAt: nowInSeconds() - 7200, expiresAt: nowInSeconds() - 3600 });
    expect(await session.readSessionToken(expired)).toBeNull();
  });

  it('rejects a token from another issuer', async () => {
    expect(await session.readSessionToken(await buildToken({ issuer: 'someone-else' }))).toBeNull();
  });

  it('rejects a token without a version', async () => {
    expect(await session.readSessionToken(await buildToken({ claims: { ver: undefined } }))).toBeNull();
  });

  describe('shouldRenew', () => {
    it('is false for a fresh token and true once more than half its life has passed', () => {
      const half = session.sessionSeconds / 2;
      const fresh = { username: 'Anna', version: 0, issuedAt: nowInSeconds() - 60 };
      const old = { username: 'Anna', version: 0, issuedAt: nowInSeconds() - half - 60 };
      expect(session.shouldRenew(fresh)).toBe(false);
      expect(session.shouldRenew(old)).toBe(true);
    });
  });

  describe('readCookie', () => {
    it('finds a cookie among several', () => {
      expect(session.readCookie('a=1; hn_session=token.value; b=2', 'hn_session')).toBe('token.value');
    });

    it('decodes values and returns undefined for a missing cookie or header', () => {
      expect(session.readCookie('x=a%20b', 'x')).toBe('a b');
      expect(session.readCookie('a=1', 'hn_session')).toBeUndefined();
      expect(session.readCookie(undefined, 'hn_session')).toBeUndefined();
    });
  });
});

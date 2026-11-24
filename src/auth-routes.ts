import { Router, type Request, type Response } from 'express';
import {
  changePassword,
  createAccount,
  getAccountVersion,
  UsernameTakenError,
  verifyAccount,
  WrongPasswordError,
} from './accounts-store';
import { BadRequestError } from './hn-fetch';
import {
  createSessionToken,
  readCookie,
  readSessionToken,
  sessionCookieName,
  sessionSeconds,
  shouldRenew,
  type Session,
} from './session';

/** Sign-up, log-in and password attempts allowed per address in each window, to slow down guessing. */
const maxAttempts = 10;
const attemptWindowMilliseconds = 60 * 1000;

const attempts = new Map<string, { count: number; resetAt: number }>();

/** `true` when this address has used up its attempts for the current window. */
function isRateLimited(request: Request) {
  const now = Date.now();
  const key = request.ip ?? 'unknown';
  let entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + attemptWindowMilliseconds };
    attempts.set(key, entry);
  }
  entry.count++;

  if (attempts.size > 5000) {
    for (const [address, other] of attempts) {
      if (other.resetAt <= now) {
        attempts.delete(address);
      }
    }
  }
  return entry.count > maxAttempts;
}

/** Clears the attempt counters. Only used by the tests. */
export function resetRateLimits() {
  attempts.clear();
}

function bodyFields(request: Request) {
  const body: unknown = request.body;
  return (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
}

async function startSession(
  request: Request,
  response: Response,
  username: string,
  version: number,
) {
  response.cookie(sessionCookieName, await createSessionToken(username, version), {
    httpOnly: true,
    sameSite: 'lax',
    secure: request.secure,
    maxAge: sessionSeconds * 1000,
    path: '/',
  });
}

/**
 * The session in the request's cookie, or `null`. The token must be a valid JWT, and its version
 * must still match the account's, so a password change ends the sessions that came before it.
 */
async function currentSession(request: Request): Promise<Session | null> {
  const session = await readSessionToken(readCookie(request.headers.cookie, sessionCookieName));
  if (!session) {
    return null;
  }
  return (await getAccountVersion(session.username)) === session.version ? session : null;
}

function tooManyAttempts(response: Response) {
  response.status(429).json({ message: 'Too many attempts. Try again in a minute.' });
}

export const authRouter = Router();

authRouter.post('/register', async (request, response) => {
  if (isRateLimited(request)) {
    tooManyAttempts(response);
    return;
  }
  try {
    const { username, password } = bodyFields(request);
    response.status(201).json({ username: await createAccount(username, password) });
  } catch (error) {
    if (error instanceof BadRequestError) {
      response.status(400).json({ message: error.message });
    } else if (error instanceof UsernameTakenError) {
      response.status(409).json({ message: 'That username is already taken' });
    } else {
      console.error('Failed to create the account', error);
      response.status(500).json({ message: 'Could not create the account' });
    }
  }
});

authRouter.post('/login', async (request, response) => {
  if (isRateLimited(request)) {
    tooManyAttempts(response);
    return;
  }
  try {
    const { username, password } = bodyFields(request);
    const account = await verifyAccount(username, password);
    if (!account) {
      response.status(401).json({ message: 'Incorrect username or password' });
      return;
    }
    await startSession(request, response, account.username, account.version);
    response.json({ username: account.username });
  } catch (error) {
    console.error('Failed to log in', error);
    response.status(500).json({ message: 'Could not log in' });
  }
});

authRouter.post('/logout', (_request, response) => {
  response.clearCookie(sessionCookieName, { path: '/' });
  response.status(204).end();
});

/**
 * Changes the password of the logged-in user. The current password has to be given again, and
 * every other session of the account stops working. This one gets a new token straight away.
 */
authRouter.post('/change-password', async (request, response) => {
  if (isRateLimited(request)) {
    tooManyAttempts(response);
    return;
  }
  try {
    const session = await currentSession(request);
    if (!session) {
      response.status(401).json({ message: 'Not logged in' });
      return;
    }
    const { currentPassword, newPassword } = bodyFields(request);
    const version = await changePassword(session.username, currentPassword, newPassword);
    await startSession(request, response, session.username, version);
    response.status(204).end();
  } catch (error) {
    if (error instanceof BadRequestError) {
      response.status(400).json({ message: error.message });
    } else if (error instanceof WrongPasswordError) {
      response.status(403).json({ message: 'The current password is incorrect' });
    } else {
      console.error('Failed to change the password', error);
      response.status(500).json({ message: 'Could not change the password' });
    }
  }
});

/**
 * Who is logged in, according to the JWT in the session cookie. A token that is more than half
 * way to expiring is replaced by a fresh one, so someone who keeps using the app stays logged in.
 */
authRouter.get('/me', async (request, response) => {
  const session = await currentSession(request);
  if (!session) {
    response.status(401).json({ message: 'Not logged in' });
    return;
  }
  if (shouldRenew(session)) {
    await startSession(request, response, session.username, session.version);
  }
  response.json({ username: session.username });
});

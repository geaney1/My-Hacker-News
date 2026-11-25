import { Router, type Request, type Response } from 'express';
import {
  changePassword,
  createAccount,
  UsernameTakenError,
  verifyAccount,
  WrongPasswordError,
} from './accounts-store';
import { sessionIdOf } from './current-user';
import { BadRequestError } from './hn-fetch';
import { bodyFields, requireJsonForPosts } from './http-helpers';
import { createRateLimiter } from './rate-limiter';
import {
  createSession,
  deleteSession,
  deleteSessionsOf,
  findSession,
  sessionCookieName,
  sessionLifetimeMilliseconds,
} from './sessions-store';

/** Attempts to create a user, log in or change a password allowed per address in each window, to slow down guessing. */
const limiter = createRateLimiter({ maxAttempts: 10, windowMilliseconds: 60 * 1000 });

/** `true` when this address has used up its attempts for the current window. */
const isRateLimited = (request: Request) => limiter.isLimited(request.ip ?? 'unknown');

/** Clears the attempt counters. Only used by the tests. */
export const resetRateLimits = () => limiter.reset();

/** Puts a session ID in the cookie: only the browser can read it back, and only this site gets it. */
function setSessionCookie(request: Request, response: Response, sessionId: string) {
  response.cookie(sessionCookieName, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: request.secure,
    maxAge: sessionLifetimeMilliseconds,
    path: '/',
  });
}

function tooManyAttempts(response: Response) {
  response.status(429).json({ message: 'Too many attempts. Try again in a minute.' });
}

export const authRouter = Router();

authRouter.use(requireJsonForPosts);

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
    const verifiedUsername = await verifyAccount(username, password);
    if (!verifiedUsername) {
      response.status(401).json({ message: 'Incorrect username or password' });
      return;
    }
    // Every log-in gets a brand new session ID. Ending any session the browser already had stops
    // someone from planting a known ID in the browser beforehand (session fixation).
    await deleteSession(sessionIdOf(request));
    setSessionCookie(request, response, await createSession(verifiedUsername));
    response.json({ username: verifiedUsername });
  } catch (error) {
    console.error('Failed to log in', error);
    response.status(500).json({ message: 'Could not log in' });
  }
});

/** Ends the session on the server, and removes the cookie from the browser. */
authRouter.post('/logout', async (request, response) => {
  try {
    await deleteSession(sessionIdOf(request));
  } catch (error) {
    console.error('Failed to end the session', error);
  }
  response.clearCookie(sessionCookieName, { path: '/' });
  response.status(204).end();
});

/**
 * Changes the password of the logged-in user. The current password has to be given again. Every
 * session of the account is ended, and this browser gets a new one so the user stays logged in.
 */
authRouter.post('/change-password', async (request, response) => {
  if (isRateLimited(request)) {
    tooManyAttempts(response);
    return;
  }
  try {
    const session = await findSession(sessionIdOf(request));
    if (!session) {
      response.status(401).json({ message: 'Not logged in' });
      return;
    }
    const { currentPassword, newPassword } = bodyFields(request);
    await changePassword(session.username, currentPassword, newPassword);
    await deleteSessionsOf(session.username);
    setSessionCookie(request, response, await createSession(session.username));
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
 * Who is logged in, according to the session the cookie points to. A session that has been used
 * for half its life is extended, so someone who keeps using the app stays logged in.
 */
authRouter.get('/me', async (request, response) => {
  const sessionId = sessionIdOf(request);
  const session = await findSession(sessionId);
  if (!session || !sessionId) {
    response.status(401).json({ message: 'Not logged in' });
    return;
  }
  if (session.renewed) {
    setSessionCookie(request, response, sessionId);
  }
  response.json({ username: session.username });
});

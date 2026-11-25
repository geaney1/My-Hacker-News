import type { Request } from 'express';
import { readCookie } from './cookies';
import { sessionCookieName } from './sessions-store';

/** The session ID in the request's cookie, if there is one. */
export const sessionIdOf = (request: Request) =>
  readCookie(request.headers.cookie, sessionCookieName);

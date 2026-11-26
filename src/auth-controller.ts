import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  changePassword,
  createAccount,
  UsernameTakenError,
  verifyAccount,
  WrongPasswordError,
} from './accounts-store';
import { sessionIdOf } from './current-user';
import { apiError, bodyFields, failureOf } from './http-helpers';
import { JsonOnlyGuard } from './json-only-guard';
import { rateLimitGuard } from './rate-limit-guard';
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
const limitAttempts = rateLimitGuard(limiter);

/** Clears the attempt counters. Only used by the tests. */
export const resetRateLimits = () => limiter.reset();

/** Puts a session ID in the cookie: only the browser can read it back, and only this site gets it. */
function setSessionCookie(request: FastifyRequest, reply: FastifyReply, sessionId: string) {
  reply.setCookie(sessionCookieName, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: request.protocol === 'https',
    // Both say the same: how long the browser keeps the cookie.
    maxAge: sessionLifetimeMilliseconds / 1000,
    expires: new Date(Date.now() + sessionLifetimeMilliseconds),
    path: '/',
  });
}

/**
 * Accounts and sessions: create a user, log in, log out and "who am I".
 */
@Controller('api/auth')
@UseGuards(JsonOnlyGuard)
export class AuthController {
  @Post('register')
  @UseGuards(limitAttempts)
  async register(@Body() body: unknown) {
    try {
      const { username, password } = bodyFields(body);
      return { username: await createAccount(username, password) };
    } catch (error) {
      if (error instanceof UsernameTakenError) {
        throw apiError(HttpStatus.CONFLICT, 'That username is already taken');
      }
      throw failureOf(
        error,
        'Failed to create the account',
        apiError(HttpStatus.INTERNAL_SERVER_ERROR, 'Could not create the account'),
      );
    }
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(limitAttempts)
  async logIn(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    try {
      const { username, password } = bodyFields(body);
      const verifiedUsername = await verifyAccount(username, password);
      if (!verifiedUsername) {
        throw apiError(HttpStatus.UNAUTHORIZED, 'Incorrect username or password');
      }
      // Every log-in gets a brand new session ID. Ending any session the browser already had stops
      // someone from planting a known ID in the browser beforehand (session fixation).
      await deleteSession(sessionIdOf(request));
      setSessionCookie(request, reply, await createSession(verifiedUsername));
      return { username: verifiedUsername };
    } catch (error) {
      throw failureOf(
        error,
        'Failed to log in',
        apiError(HttpStatus.INTERNAL_SERVER_ERROR, 'Could not log in'),
      );
    }
  }

  /** Ends the session on the server, and removes the cookie from the browser. */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logOut(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    try {
      await deleteSession(sessionIdOf(request));
    } catch (error) {
      console.error('Failed to end the session', error);
    }
    reply.clearCookie(sessionCookieName, { path: '/' });
  }

  /**
   * Changes the password of the logged-in user. The current password has to be given again. Every
   * session of the account is ended, and this browser gets a new one so the user stays logged in.
   */
  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(limitAttempts)
  async changeOwnPassword(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    try {
      const session = await findSession(sessionIdOf(request));
      if (!session) {
        throw apiError(HttpStatus.UNAUTHORIZED, 'Not logged in');
      }
      const { currentPassword, newPassword } = bodyFields(body);
      await changePassword(session.username, currentPassword, newPassword);
      await deleteSessionsOf(session.username);
      setSessionCookie(request, reply, await createSession(session.username));
    } catch (error) {
      if (error instanceof WrongPasswordError) {
        throw apiError(HttpStatus.FORBIDDEN, 'The current password is incorrect');
      }
      throw failureOf(
        error,
        'Failed to change the password',
        apiError(HttpStatus.INTERNAL_SERVER_ERROR, 'Could not change the password'),
      );
    }
  }

  /**
   * Who is logged in, according to the session the cookie points to. A session that has been used
   * for half its life is extended, so someone who keeps using the app stays logged in.
   */
  @Get('me')
  async whoAmI(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const sessionId = sessionIdOf(request);
    const session = await findSession(sessionId);
    if (!session || !sessionId) {
      throw apiError(HttpStatus.UNAUTHORIZED, 'Not logged in');
    }
    if (session.renewed) {
      setSessionCookie(request, reply, sessionId);
    }
    return { username: session.username };
  }
}

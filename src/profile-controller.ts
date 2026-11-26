import { Body, Controller, Get, HttpStatus, Put, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { sessionIdOf } from './current-user';
import { apiError, bodyFields, failureOf } from './http-helpers';
import { JsonOnlyGuard } from './json-only-guard';
import { getProfile, saveProfile } from './profiles-store';
import { findSession } from './sessions-store';

/** The logged-in user's session, or a 401 answer when there is none. */
async function requireSession(request: FastifyRequest) {
  const session = await findSession(sessionIdOf(request));
  if (!session) {
    throw apiError(HttpStatus.UNAUTHORIZED, 'Not logged in');
  }
  return session;
}

/**
 * The logged-in user's profile: read it, and save it.
 */
@Controller('api/profile')
@UseGuards(JsonOnlyGuard)
export class ProfileController {
  /** The saved profile, or the defaults when the user has not saved one. */
  @Get()
  async read(@Req() request: FastifyRequest) {
    try {
      const { username } = await requireSession(request);
      return await getProfile(username);
    } catch (error) {
      throw failureOf(
        error,
        'Failed to load the profile',
        apiError(HttpStatus.INTERNAL_SERVER_ERROR, 'Could not load the profile'),
      );
    }
  }

  /** Saves the profile. It always belongs to the session's user. */
  @Put()
  async save(@Body() body: unknown, @Req() request: FastifyRequest) {
    try {
      const { username } = await requireSession(request);
      return await saveProfile(username, bodyFields(body));
    } catch (error) {
      throw failureOf(
        error,
        'Failed to save the profile',
        apiError(HttpStatus.INTERNAL_SERVER_ERROR, 'Could not save the profile'),
      );
    }
  }
}

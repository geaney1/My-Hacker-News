import { Body, Controller, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { sessionIdOf } from './current-user';
import { apiError, bodyFields, failureOf } from './http-helpers';
import { JsonOnlyGuard } from './json-only-guard';
import { rateLimitGuard } from './rate-limit-guard';
import { createRateLimiter } from './rate-limiter';
import { findSession } from './sessions-store';
import { addSubmission, TooManySubmissionsError } from './submissions-store';

/** Stories one address can submit per minute. */
const limiter = createRateLimiter({ maxAttempts: 10, windowMilliseconds: 60 * 1000 });

/** Clears the counters. Only used by the tests. */
export const resetSubmissionRateLimits = () => limiter.reset();

/**
 * Stories submitted by logged-in users, saved on this server.
 */
@Controller('api/submissions')
@UseGuards(JsonOnlyGuard)
export class SubmissionsController {
  /** Saves a story for the logged-in user. */
  @Post()
  @UseGuards(rateLimitGuard(limiter))
  async submit(@Body() body: unknown, @Req() request: FastifyRequest) {
    try {
      const session = await findSession(sessionIdOf(request));
      if (!session) {
        throw apiError(HttpStatus.UNAUTHORIZED, 'Not logged in');
      }
      const { title, url, text } = bodyFields(body);
      const { id, kind, submittedAt } = await addSubmission(session.username, title, url, text);
      return { id, kind, submittedAt };
    } catch (error) {
      if (error instanceof TooManySubmissionsError) {
        throw apiError(HttpStatus.FORBIDDEN, 'You have submitted as many stories as are allowed');
      }
      throw failureOf(
        error,
        'Failed to save the story',
        apiError(HttpStatus.INTERNAL_SERVER_ERROR, 'Could not save the story'),
      );
    }
  }
}

import { Body, Controller, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { addLocalComment, NoSuchStoryError, TooManyCommentsError } from './comments-store';
import { apiError, bodyFields, failureOf } from './http-helpers';
import { JsonOnlyGuard } from './json-only-guard';
import { rateLimitGuard } from './rate-limit-guard';
import { createRateLimiter } from './rate-limiter';
import { parseItemId } from './stories-proxy';
import { viewerOf } from './viewer';

/** Comments one address can write per minute. */
const limiter = createRateLimiter({ maxAttempts: 20, windowMilliseconds: 60 * 1000 });

/** Clears the counters. Only used by the tests. */
export const resetCommentRateLimits = () => limiter.reset();

/**
 * Writing a comment on a story submitted in this app. Reading comments is the threads controller.
 */
@Controller('api/items')
@UseGuards(JsonOnlyGuard)
export class CommentsController {
  /** Saves a comment, by the logged-in user, on a story that was submitted in this app. */
  @Post(':id/comments')
  @UseGuards(rateLimitGuard(limiter))
  async write(@Param('id') id: string, @Body() body: unknown, @Req() request: FastifyRequest) {
    try {
      const viewer = await viewerOf(request);
      if (!viewer.username) {
        throw apiError(HttpStatus.UNAUTHORIZED, 'Not logged in');
      }
      const { text } = bodyFields(body);
      const comment = await addLocalComment(
        viewer.username,
        parseItemId(id),
        text,
        viewer.delayMinutes,
      );
      return { id: comment.id, time: comment.time };
    } catch (error) {
      if (error instanceof NoSuchStoryError) {
        throw apiError(
          HttpStatus.NOT_FOUND,
          'Comments can only be written on stories submitted in this app',
        );
      }
      if (error instanceof TooManyCommentsError) {
        throw apiError(HttpStatus.FORBIDDEN, 'You have written as many comments as are allowed');
      }
      throw failureOf(
        error,
        'Failed to save the comment',
        apiError(HttpStatus.INTERNAL_SERVER_ERROR, 'Could not save the comment'),
      );
    }
  }
}

import { Controller, Get, HttpStatus, Param, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { apiError, failureOf } from './http-helpers';
import { parseItemId } from './stories-proxy';
import { getThread } from './thread-proxy';
import { viewerOf } from './viewer';

/**
 * Loads an item together with its comment tree. Answers 404 when the item does not exist.
 */
@Controller('api/items')
export class ThreadsController {
  @Get(':id/thread')
  async read(@Param('id') id: string, @Req() request: FastifyRequest) {
    try {
      const thread = await getThread(parseItemId(id), await viewerOf(request));
      if (!thread) {
        throw apiError(HttpStatus.NOT_FOUND, 'Item not found');
      }
      return thread;
    } catch (error) {
      throw failureOf(
        error,
        'Failed to load the thread',
        apiError(HttpStatus.BAD_GATEWAY, 'Could not load the comments'),
      );
    }
  }
}

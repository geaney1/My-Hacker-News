import { Controller, Get, HttpStatus, Param, Query, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { apiError, failureOf } from './http-helpers';
import { getStoryPage } from './stories-proxy';
import { viewerOf } from './viewer';

/**
 * Loads a page of a story list in one call, instead of the browser making one request per story.
 */
@Controller('api/stories')
export class StoriesController {
  @Get(':list')
  async page(
    @Param('list') list: string,
    @Query('page') page: unknown,
    @Query('pageSize') pageSize: unknown,
    @Req() request: FastifyRequest,
  ) {
    try {
      const { showDead } = await viewerOf(request);
      return await getStoryPage(list, page, pageSize, { showDead });
    } catch (error) {
      throw failureOf(
        error,
        'Failed to load stories',
        apiError(HttpStatus.BAD_GATEWAY, 'Could not load the stories'),
      );
    }
  }
}

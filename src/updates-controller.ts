import { Controller, Get, HttpStatus } from '@nestjs/common';
import { apiError, failureOf } from './http-helpers';
import { getUpdates } from './updates-proxy';

/**
 * The items and profiles that changed recently, so the app can tell when what it shows is stale.
 */
@Controller('api/updates')
export class UpdatesController {
  @Get()
  async read() {
    try {
      return await getUpdates();
    } catch (error) {
      throw failureOf(
        error,
        'Failed to load the updates',
        apiError(HttpStatus.BAD_GATEWAY, 'Could not load the updates'),
      );
    }
  }
}

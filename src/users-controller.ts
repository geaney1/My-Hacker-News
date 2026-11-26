import { Controller, Get, HttpStatus, Param } from '@nestjs/common';
import { apiError, failureOf } from './http-helpers';
import { getUser } from './users-proxy';

/**
 * Loads a user's public profile. Answers 404 when the user does not exist.
 */
@Controller('api/users')
export class UsersController {
  @Get(':id')
  async read(@Param('id') id: string) {
    try {
      const user = await getUser(id);
      if (!user) {
        throw apiError(HttpStatus.NOT_FOUND, 'User not found');
      }
      return user;
    } catch (error) {
      throw failureOf(
        error,
        'Failed to load the user',
        apiError(HttpStatus.BAD_GATEWAY, 'Could not load the user'),
      );
    }
  }
}

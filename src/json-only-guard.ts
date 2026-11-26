import { type CanActivate, type ExecutionContext, HttpStatus } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { apiError } from './http-helpers';

/**
 * Changes (POST and PUT) only ever come as JSON. A plain cross-site form cannot send that, which, together with
 * the SameSite cookie, stops other sites from making a logged-in user's browser change things.
 */
export class JsonOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    // "application/json; charset=utf-8" is JSON too.
    const mediaType = request.headers['content-type']?.split(';')[0].trim().toLowerCase();
    if (
      (request.method === 'POST' || request.method === 'PUT') &&
      mediaType !== 'application/json'
    ) {
      throw apiError(HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'Send JSON');
    }
    return true;
  }
}

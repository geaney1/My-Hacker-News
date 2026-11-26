import { type CanActivate, type ExecutionContext, HttpStatus } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { apiError } from './http-helpers';
import type { createRateLimiter } from './rate-limiter';

/**
 * Counts each request against the address it came from, and answers 429 once that address has
 * used up the limiter's attempts. Routes that share a limiter share the count.
 */
export function rateLimitGuard(limiter: ReturnType<typeof createRateLimiter>): CanActivate {
  return {
    canActivate(context: ExecutionContext) {
      const request = context.switchToHttp().getRequest<FastifyRequest>();
      if (limiter.isLimited(request.ip ?? 'unknown')) {
        throw apiError(HttpStatus.TOO_MANY_REQUESTS, 'Too many attempts. Try again in a minute.');
      }
      return true;
    },
  };
}

import type { NextFunction, Request, Response } from 'express';

/**
 * Changes (POST and PUT) only ever come as JSON. A plain cross-site form cannot send that, which, together with
 * the SameSite cookie, stops other sites from making a logged-in user's browser change things.
 */
export function requireJsonForPosts(request: Request, response: Response, next: NextFunction) {
  if ((request.method === 'POST' || request.method === 'PUT') && !request.is('application/json')) {
    response.status(415).json({ message: 'Send JSON' });
    return;
  }
  next();
}

/** The fields of a JSON request body, or an empty object when there is no usable body. */
export function bodyFields(request: Request) {
  const body: unknown = request.body;
  return (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
}

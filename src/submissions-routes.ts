import { Router } from 'express';
import { sessionIdOf } from './current-user';
import { BadRequestError } from './hn-fetch';
import { bodyFields, requireJsonForPosts } from './http-helpers';
import { createRateLimiter } from './rate-limiter';
import { findSession } from './sessions-store';
import { addSubmission, TooManySubmissionsError } from './submissions-store';

/** Stories one address can submit per minute. */
const limiter = createRateLimiter({ maxAttempts: 10, windowMilliseconds: 60 * 1000 });

/** Clears the counters. Only used by the tests. */
export const resetSubmissionRateLimits = () => limiter.reset();

export const submissionsRouter = Router();

submissionsRouter.use(requireJsonForPosts);

/** Saves a story for the logged-in user. */
submissionsRouter.post('/', async (request, response) => {
  if (limiter.isLimited(request.ip ?? 'unknown')) {
    response.status(429).json({ message: 'Too many attempts. Try again in a minute.' });
    return;
  }
  try {
    const session = await findSession(sessionIdOf(request));
    if (!session) {
      response.status(401).json({ message: 'Not logged in' });
      return;
    }
    const { title, url, text } = bodyFields(request);
    const { id, kind, submittedAt } = await addSubmission(session.username, title, url, text);
    response.status(201).json({ id, kind, submittedAt });
  } catch (error) {
    if (error instanceof BadRequestError) {
      response.status(400).json({ message: error.message });
    } else if (error instanceof TooManySubmissionsError) {
      response.status(403).json({ message: 'You have submitted as many stories as are allowed' });
    } else {
      console.error('Failed to save the story', error);
      response.status(500).json({ message: 'Could not save the story' });
    }
  }
});

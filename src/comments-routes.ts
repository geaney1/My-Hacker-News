import { Router } from 'express';
import { addLocalComment, NoSuchStoryError, TooManyCommentsError } from './comments-store';
import { BadRequestError } from './hn-fetch';
import { bodyFields, requireJsonForPosts } from './http-helpers';
import { createRateLimiter } from './rate-limiter';
import { parseItemId } from './stories-proxy';
import { viewerOf } from './viewer';

/** Comments one address can write per minute. */
const limiter = createRateLimiter({ maxAttempts: 20, windowMilliseconds: 60 * 1000 });

/** Clears the counters. Only used by the tests. */
export const resetCommentRateLimits = () => limiter.reset();

export const commentsRouter = Router();

commentsRouter.use(requireJsonForPosts);

/** Saves a comment, by the logged-in user, on a story that was submitted in this app. */
commentsRouter.post('/:id/comments', async (request, response) => {
  if (limiter.isLimited(request.ip ?? 'unknown')) {
    response.status(429).json({ message: 'Too many attempts. Try again in a minute.' });
    return;
  }
  try {
    const viewer = await viewerOf(request);
    if (!viewer.username) {
      response.status(401).json({ message: 'Not logged in' });
      return;
    }
    const { text } = bodyFields(request);
    const comment = await addLocalComment(
      viewer.username,
      parseItemId(request.params.id),
      text,
      viewer.delaySeconds,
    );
    response.status(201).json({ id: comment.id, time: comment.time });
  } catch (error) {
    if (error instanceof BadRequestError) {
      response.status(400).json({ message: error.message });
    } else if (error instanceof NoSuchStoryError) {
      response.status(404).json({ message: 'Comments can only be written on stories submitted in this app' });
    } else if (error instanceof TooManyCommentsError) {
      response.status(403).json({ message: 'You have written as many comments as are allowed' });
    } else {
      console.error('Failed to save the comment', error);
      response.status(500).json({ message: 'Could not save the comment' });
    }
  }
});

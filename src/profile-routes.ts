import { Router } from 'express';
import { sessionIdOf } from './current-user';
import { BadRequestError } from './hn-fetch';
import { bodyFields, requireJsonForPosts } from './http-helpers';
import { getProfile, saveProfile } from './profiles-store';
import { findSession } from './sessions-store';

export const profileRouter = Router();

profileRouter.use(requireJsonForPosts);

/** The logged-in user's saved profile, or the defaults when they have not saved one. */
profileRouter.get('/', async (request, response) => {
  try {
    const session = await findSession(sessionIdOf(request));
    if (!session) {
      response.status(401).json({ message: 'Not logged in' });
      return;
    }
    response.json(await getProfile(session.username));
  } catch (error) {
    console.error('Failed to load the profile', error);
    response.status(500).json({ message: 'Could not load the profile' });
  }
});

/** Saves the logged-in user's profile. The profile always belongs to the session's user. */
profileRouter.put('/', async (request, response) => {
  try {
    const session = await findSession(sessionIdOf(request));
    if (!session) {
      response.status(401).json({ message: 'Not logged in' });
      return;
    }
    response.json(await saveProfile(session.username, bodyFields(request)));
  } catch (error) {
    if (error instanceof BadRequestError) {
      response.status(400).json({ message: error.message });
    } else {
      console.error('Failed to save the profile', error);
      response.status(500).json({ message: 'Could not save the profile' });
    }
  }
});

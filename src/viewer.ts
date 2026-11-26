import type { FastifyRequest } from 'fastify';
import { sessionIdOf } from './current-user';
import { getProfile } from './profiles-store';
import { findSession } from './sessions-store';
import type { Viewer } from './models/viewer';

export const anonymousViewer: Viewer = { showDead: false, delayMinutes: 0 };

/** The viewer behind a request, from its session cookie and the profile that user has saved. */
export async function viewerOf(request: FastifyRequest) {
  const session = await findSession(sessionIdOf(request));
  if (!session) {
    return anonymousViewer;
  }
  const profile = await getProfile(session.username);
  return {
    username: session.username,
    showDead: profile.showdead === 'yes',
    delayMinutes: profile.delay,
  };
}

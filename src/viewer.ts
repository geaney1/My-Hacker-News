import type { Request } from 'express';
import { sessionIdOf } from './current-user';
import { getProfile } from './profiles-store';
import { findSession } from './sessions-store';

/** Who is asking, and the parts of their profile that change what the server sends or saves. */
export type Viewer = {
  /** The logged-in user, or `undefined` for a visitor. */
  username?: string;
  /** Show Dead: dead stories and comments are included. */
  showDead: boolean;
  /** Delay: how many seconds the user's own comments stay hidden from others. */
  delaySeconds: number;
};

export const anonymousViewer: Viewer = { showDead: false, delaySeconds: 0 };

/** The viewer behind a request, from its session cookie and the profile that user has saved. */
export async function viewerOf(request: Request) {
  const session = await findSession(sessionIdOf(request));
  if (!session) {
    return anonymousViewer;
  }
  const profile = await getProfile(session.username);
  return {
    username: session.username,
    showDead: profile.showdead === 'yes',
    delaySeconds: profile.delay,
  };
}

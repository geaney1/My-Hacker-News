import { createHash, randomBytes } from 'node:crypto';
import { createJsonStore } from './json-store';
import type { SessionFile } from './models/session-file';

/** The browser's cookie holds only a random session ID. Everything else stays on the server. */
export const sessionCookieName = 'hn_session';

/** A session ends this long after it was last used. */
export const sessionLifetimeMilliseconds = 14 * 24 * 60 * 60 * 1000;

/** The most sessions one user can have at once (for example on different devices). */
const maxSessionsPerUser = 10;

const hashId = (id: string) => createHash('sha256').update(id).digest('hex');

/** The sessions are read from disk once, then kept in memory and saved after each change. */
const sessionsStore = createJsonStore<SessionFile>({ file: 'sessions.json', empty: () => ({}) });

const loadSessions = () => sessionsStore.load();
const saveSessions = (sessions: SessionFile) => sessionsStore.save(sessions);

function dropExpired(sessions: SessionFile, now: number) {
  for (const [key, session] of Object.entries(sessions)) {
    if (session.expiresAt <= now) {
      delete sessions[key];
    }
  }
}

/** Starts a session for `username` and returns its ID, which goes into the cookie. */
export async function createSession(username: string) {
  const sessions = await loadSessions();
  const now = Date.now();
  dropExpired(sessions, now);

  // Keep the number of sessions per user bounded: the oldest ones go first.
  const usersSessions = Object.entries(sessions)
    .filter(([, session]) => session.username === username)
    .sort(([, first], [, second]) => first.createdAt - second.createdAt);
  while (usersSessions.length >= maxSessionsPerUser) {
    delete sessions[usersSessions.shift()![0]];
  }

  const id = randomBytes(32).toString('base64url');
  sessions[hashId(id)] = { username, createdAt: now, expiresAt: now + sessionLifetimeMilliseconds };
  await saveSessions(sessions);
  return id;
}

/**
 * Looks a session up by the ID from the cookie. Resolves to who it belongs to, or `null` when
 * there is no such session or it has ended. Using a session pushes its end out again; `renewed`
 * says that happened, so the cookie's own lifetime can be extended to match.
 */
export async function findSession(id: string | undefined) {
  if (!id) {
    return null;
  }
  const sessions = await loadSessions();
  const key = hashId(id);
  const session = sessions[key];
  if (!session) {
    return null;
  }

  const now = Date.now();
  if (session.expiresAt <= now) {
    delete sessions[key];
    await saveSessions(sessions);
    return null;
  }

  // Only once half of its life has gone, so ordinary page views do not write to disk.
  const renewed = session.expiresAt - now < sessionLifetimeMilliseconds / 2;
  if (renewed) {
    session.expiresAt = now + sessionLifetimeMilliseconds;
    await saveSessions(sessions);
  }
  return { username: session.username, renewed };
}

/** Ends one session on the server, so its cookie stops working even if somebody copied it. */
export async function deleteSession(id: string | undefined) {
  if (!id) {
    return;
  }
  const sessions = await loadSessions();
  const key = hashId(id);
  if (sessions[key]) {
    delete sessions[key];
    await saveSessions(sessions);
  }
}

/** Ends every session of a user, for example after their password has changed. */
export async function deleteSessionsOf(username: string) {
  const sessions = await loadSessions();
  let changed = false;
  for (const [key, session] of Object.entries(sessions)) {
    if (session.username === username) {
      delete sessions[key];
      changed = true;
    }
  }
  if (changed) {
    await saveSessions(sessions);
  }
}

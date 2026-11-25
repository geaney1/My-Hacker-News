import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

type SessionsStore = typeof import('./sessions-store');

const day = 24 * 60 * 60 * 1000;

describe('sessions store', () => {
  let directory: string;
  let store: SessionsStore;

  /** A fresh copy of the store, with an empty data folder unless `existingFile` is given. */
  async function load(existingFile?: string) {
    vi.resetModules();
    rmSync(directory, { recursive: true, force: true });
    directory = mkdtempSync(join(tmpdir(), 'hn-sessions-'));
    process.env['DATA_DIR'] = directory;
    if (existingFile) {
      writeFileSync(join(directory, 'sessions.json'), existingFile);
    }
    store = await import('./sessions-store');
  }

  const savedFile = () => readFileSync(join(directory, 'sessions.json'), 'utf8');

  beforeAll(() => {
    directory = mkdtempSync(join(tmpdir(), 'hn-sessions-'));
  });

  beforeEach(() => load());

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(() => {
    delete process.env['DATA_DIR'];
    rmSync(directory, { recursive: true, force: true });
  });

  describe('createSession and findSession', () => {
    it('gives a long random ID, different every time', async () => {
      const first = await store.createSession('Anna');
      const second = await store.createSession('Anna');

      expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(second).not.toBe(first);
    });

    it('finds a session by its ID and says who it belongs to', async () => {
      const id = await store.createSession('Anna');
      expect(await store.findSession(id)).toEqual({ username: 'Anna', renewed: false });
    });

    it('finds nothing for a missing, empty or unknown ID', async () => {
      await store.createSession('Anna');
      expect(await store.findSession(undefined)).toBeNull();
      expect(await store.findSession('')).toBeNull();
      expect(await store.findSession('not-a-real-session-id')).toBeNull();
    });

    it('keeps users apart', async () => {
      const anna = await store.createSession('Anna');
      const ben = await store.createSession('Ben');
      expect((await store.findSession(anna))?.username).toBe('Anna');
      expect((await store.findSession(ben))?.username).toBe('Ben');
    });
  });

  describe('what is saved', () => {
    it('never writes the session ID to disk, only a hash of it', async () => {
      const id = await store.createSession('Anna');
      const file = savedFile();

      expect(file).not.toContain(id);
      expect(Object.keys(JSON.parse(file))).toHaveLength(1);
      expect(Object.keys(JSON.parse(file))[0]).toMatch(/^[0-9a-f]{64}$/);
    });

    it('survives a restart of the server', async () => {
      const id = await store.createSession('Anna');
      const saved = savedFile();

      await load(saved);
      expect(await store.findSession(id)).toEqual({ username: 'Anna', renewed: false });
    });
  });

  describe('logging out', () => {
    it('deleteSession ends the session on the server, so a copied ID stops working', async () => {
      const id = await store.createSession('Anna');
      await store.deleteSession(id);

      expect(await store.findSession(id)).toBeNull();
      expect(JSON.parse(savedFile())).toEqual({});
    });

    it('leaves other sessions alone', async () => {
      const first = await store.createSession('Anna');
      const second = await store.createSession('Anna');
      await store.deleteSession(first);

      expect(await store.findSession(first)).toBeNull();
      expect(await store.findSession(second)).not.toBeNull();
    });

    it('does nothing for a missing or unknown ID', async () => {
      await store.createSession('Anna');
      await expect(store.deleteSession(undefined)).resolves.toBeUndefined();
      await expect(store.deleteSession('unknown')).resolves.toBeUndefined();
    });

    it('deleteSessionsOf ends every session of one user and no one else\'s', async () => {
      const annaOne = await store.createSession('Anna');
      const annaTwo = await store.createSession('Anna');
      const ben = await store.createSession('Ben');
      await store.deleteSessionsOf('Anna');

      expect(await store.findSession(annaOne)).toBeNull();
      expect(await store.findSession(annaTwo)).toBeNull();
      expect(await store.findSession(ben)).not.toBeNull();
    });
  });

  describe('expiry', () => {
    it('ends a session 14 days after it was last used', async () => {
      vi.useFakeTimers();
      const id = await store.createSession('Anna');

      vi.advanceTimersByTime(13 * day);
      expect(await store.findSession(id)).not.toBeNull();
    });

    it('rejects an expired session, and removes it', async () => {
      vi.useFakeTimers();
      const id = await store.createSession('Anna');

      vi.advanceTimersByTime(15 * day);
      expect(await store.findSession(id)).toBeNull();
      expect(JSON.parse(savedFile())).toEqual({});
    });

    it('does not extend a session that has most of its life left', async () => {
      vi.useFakeTimers();
      const id = await store.createSession('Anna');

      vi.advanceTimersByTime(3 * day);
      expect((await store.findSession(id))?.renewed).toBe(false);
    });

    it('extends a session once half its life has gone, and says so', async () => {
      vi.useFakeTimers();
      const id = await store.createSession('Anna');

      vi.advanceTimersByTime(8 * day);
      expect((await store.findSession(id))?.renewed).toBe(true);

      // It now lasts a full 14 days from today, not from the start.
      vi.advanceTimersByTime(10 * day);
      expect(await store.findSession(id)).not.toBeNull();
    });

    it('clears out expired sessions when a new one is made', async () => {
      vi.useFakeTimers();
      await store.createSession('Anna');
      vi.advanceTimersByTime(20 * day);
      await store.createSession('Ben');

      expect(Object.keys(JSON.parse(savedFile()))).toHaveLength(1);
    });
  });

  describe('limit per user', () => {
    it('keeps at most 10 sessions per user, dropping the oldest', async () => {
      vi.useFakeTimers();
      const ids: string[] = [];
      for (let index = 0; index < 11; index++) {
        ids.push(await store.createSession('Anna'));
        vi.advanceTimersByTime(1000);
      }

      expect(await store.findSession(ids[0])).toBeNull();
      expect(await store.findSession(ids[1])).not.toBeNull();
      expect(await store.findSession(ids[10])).not.toBeNull();
    });

    it('does not count one user\'s sessions against another', async () => {
      for (let index = 0; index < 10; index++) {
        await store.createSession('Anna');
      }
      const ben = await store.createSession('Ben');
      expect(await store.findSession(ben)).not.toBeNull();
    });
  });

  it('handles many sessions being created at the same time', async () => {
    const ids = await Promise.all(Array.from({ length: 20 }, (_, index) => store.createSession(`User${index}`)));
    for (const id of ids) {
      expect(await store.findSession(id)).not.toBeNull();
    }
    expect(Object.keys(JSON.parse(savedFile()))).toHaveLength(20);
  });
});

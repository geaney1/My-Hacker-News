import type { HnUser } from './app/models/hn-user';

type UsersProxy = typeof import('./users-proxy');

// The accounts and submissions of this app. The real stores are tested on their own.
const local = vi.hoisted(() => ({
  accounts: new Map<string, { username: string; createdAt?: number }>(),
  submitted: new Map<string, number[]>(),
  about: new Map<string, string>(),
}));
vi.mock('./profiles-store', () => ({
  getProfile: async (username: string) => ({
    about: local.about.get(username.toLowerCase()) ?? '',
    email: 'private@example.com',
  }),
}));
vi.mock('./accounts-store', () => ({
  findAccount: async (username: string) => local.accounts.get(username.toLowerCase()) ?? null,
}));
vi.mock('./submissions-store', () => ({
  submittedItemIdsBy: async (username: string) => local.submitted.get(username.toLowerCase()) ?? [],
  toItemHtml: (text: string) => `<p>${text}</p>`,
}));

describe('users proxy', () => {
  let proxy: UsersProxy;
  let fetchMock: ReturnType<typeof vi.fn>;
  let hnUsers: Record<string, HnUser | null>;

  beforeEach(async () => {
    local.accounts.clear();
    local.submitted.clear();
    local.about.clear();
    vi.resetModules();
    proxy = await import('./users-proxy');

    hnUsers = { pg: { id: 'pg', created: 1160418111, karma: 157316 } };
    fetchMock = vi.fn(async (url: string) => {
      const name = url
        .replace('https://hacker-news.firebaseio.com/v0/user/', '')
        .replace('.json', '');
      return Response.json(hnUsers[name] ?? null);
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('gives a Hacker News user as Hacker News has them', async () => {
    expect(await proxy.getUser('pg')).toEqual({ id: 'pg', created: 1160418111, karma: 157316 });
  });

  it('checks the users of this app when Hacker News has no such user', async () => {
    local.accounts.set('billy', { username: 'Billy', createdAt: 1_700_000_000_000 });
    local.submitted.set('billy', [2_000_000_002, 2_000_000_001]);

    expect(await proxy.getUser('Billy')).toEqual({
      id: 'Billy',
      created: 1_700_000_000,
      karma: 0,
      submitted: [2_000_000_002, 2_000_000_001],
      local: true,
    });
  });

  it('shows the About box of a user of this app, as safe HTML, and leaves it out when empty', async () => {
    local.accounts.set('billy', { username: 'Billy' });
    expect(await proxy.getUser('Billy')).not.toHaveProperty('about');

    local.about.set('billy', '  I like tests  ');
    expect((await proxy.getUser('Billy'))?.about).toBe('<p>I like tests</p>');
  });

  it('never shows the email of a user of this app', async () => {
    local.accounts.set('billy', { username: 'Billy' });
    local.about.set('billy', 'Hello');
    expect(JSON.stringify(await proxy.getUser('Billy'))).not.toContain('private@example.com');
  });

  it('finds the account whatever the case of the name, and gives its name as it was typed', async () => {
    local.accounts.set('billy', { username: 'Billy' });
    expect((await proxy.getUser('BILLY'))?.id).toBe('Billy');
  });

  it('prefers the Hacker News user when both exist', async () => {
    local.accounts.set('pg', { username: 'pg' });
    const user = await proxy.getUser('pg');
    expect(user?.karma).toBe(157316);
    expect(user).not.toHaveProperty('local');
  });

  it('says created is not known (0) for an account made before the date was kept', async () => {
    local.accounts.set('old', { username: 'Old' });
    expect((await proxy.getUser('Old'))?.created).toBe(0);
  });

  it('is null when neither Hacker News nor this app has the user', async () => {
    expect(await proxy.getUser('nobody')).toBeNull();
  });

  it('sees an account made after Hacker News was asked, even within the cache time', async () => {
    expect(await proxy.getUser('late')).toBeNull();
    local.accounts.set('late', { username: 'Late' });
    expect((await proxy.getUser('late'))?.local).toBe(true);
  });

  it('only asks Hacker News once for the same name within the cache time', async () => {
    await proxy.getUser('nobody');
    await proxy.getUser('nobody');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each(['a', 'has space', 'x'.repeat(16), '../etc'])(
    'rejects the invalid username %j',
    async (name) => {
      await expect(proxy.getUser(name)).rejects.toThrow(/Invalid username/);
    },
  );

  it('never exposes anything secret about an account', async () => {
    local.accounts.set('billy', { username: 'Billy', createdAt: 1 });
    const text = JSON.stringify(await proxy.getUser('billy'));
    expect(text).not.toMatch(/hash|salt|password/i);
  });
});

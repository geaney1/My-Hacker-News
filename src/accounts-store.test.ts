import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

type AccountsStore = typeof import('./accounts-store');

describe('accounts store', () => {
  let directory: string;
  let store: AccountsStore;

  beforeAll(async () => {
    // The data folder is read when the store is loaded, so it is set first and the store imported after.
    directory = mkdtempSync(join(tmpdir(), 'hn-accounts-'));
    process.env['DATA_DIR'] = directory;
    store = await import('./accounts-store');
  });

  afterAll(() => {
    delete process.env['DATA_DIR'];
    rmSync(directory, { recursive: true, force: true });
  });

  describe('findAccount', () => {
    it('gives the username as typed and when the account was made, whatever the case asked for', async () => {
      const before = Date.now();
      await store.createAccount('Finder', 'correct-horse');
      const found = await store.findAccount('FINDER');
      expect(found?.username).toBe('Finder');
      expect(found?.createdAt).toBeGreaterThanOrEqual(before);
    });

    it('gives nothing but the username and the date: never the password hash or salt', async () => {
      await store.createAccount('Private', 'correct-horse');
      expect(Object.keys((await store.findAccount('Private')) ?? {}).sort()).toEqual([
        'createdAt',
        'username',
      ]);
    });

    it('is null when there is no such account', async () => {
      expect(await store.findAccount('nobody-here')).toBeNull();
    });
  });

  describe('createAccount', () => {
    it('creates an account and returns the username as typed', async () => {
      expect(await store.createAccount('Anna', 'correct-horse')).toBe('Anna');
    });

    it('stores a salted hash, never the password', async () => {
      await store.createAccount('Hashed', 'plain-text-secret');
      const file = readFileSync(join(directory, 'users.json'), 'utf8');
      expect(file).not.toContain('plain-text-secret');
      expect(file).toContain('"salt"');
    });

    it('rejects a username that is taken, whatever its case', async () => {
      await store.createAccount('Taken', 'correct-horse');
      await expect(store.createAccount('taken', 'another-pass1')).rejects.toBeInstanceOf(
        store.UsernameTakenError,
      );
    });

    it.each(['a', 'x'.repeat(16), 'has space', 'bad!char', ''])(
      'rejects the invalid username %j',
      async (username) => {
        await expect(store.createAccount(username, 'correct-horse')).rejects.toThrow(/Username/);
      },
    );

    it.each(['short', 'x'.repeat(73), 12345678, undefined])(
      'rejects the invalid password %j',
      async (password) => {
        await expect(store.createAccount('Valid', password)).rejects.toThrow(/Password/);
      },
    );

    it('keeps every account when users are created at the same time', async () => {
      const names = Array.from({ length: 8 }, (_, index) => `Parallel${index}`);
      await Promise.all(names.map((name) => store.createAccount(name, 'correct-horse')));
      for (const name of names) {
        expect(await store.verifyAccount(name, 'correct-horse')).not.toBeNull();
      }
    });
  });

  describe('verifyAccount', () => {
    it('accepts the right password, whatever the case of the username, and gives the name as it was typed when the user was created', async () => {
      await store.createAccount('Verify', 'correct-horse');
      expect(await store.verifyAccount('VERIFY', 'correct-horse')).toBe('Verify');
    });

    it('rejects a wrong password, an unknown user and non-string input', async () => {
      await store.createAccount('Wrong', 'correct-horse');
      expect(await store.verifyAccount('Wrong', 'not-the-password')).toBeNull();
      expect(await store.verifyAccount('nobody-here', 'correct-horse')).toBeNull();
      expect(await store.verifyAccount({}, 'correct-horse')).toBeNull();
      expect(await store.verifyAccount('Wrong', 42)).toBeNull();
    });
  });

  describe('changePassword', () => {
    it('replaces the password', async () => {
      await store.createAccount('Change', 'old-password-1');
      await store.changePassword('Change', 'old-password-1', 'new-password-2');

      expect(await store.verifyAccount('Change', 'old-password-1')).toBeNull();
      expect(await store.verifyAccount('Change', 'new-password-2')).toBe('Change');
    });

    it('needs the current password', async () => {
      await store.createAccount('NeedsCurrent', 'old-password-1');
      await expect(
        store.changePassword('NeedsCurrent', 'guess-guess-1', 'new-password-2'),
      ).rejects.toBeInstanceOf(store.WrongPasswordError);
      expect(await store.verifyAccount('NeedsCurrent', 'old-password-1')).not.toBeNull();
    });

    it('rejects a new password that is invalid or the same as the old one', async () => {
      await store.createAccount('Rules', 'old-password-1');
      await expect(store.changePassword('Rules', 'old-password-1', 'short')).rejects.toThrow(
        /Password/,
      );
      await expect(
        store.changePassword('Rules', 'old-password-1', 'old-password-1'),
      ).rejects.toThrow(/different/);
    });
  });
});

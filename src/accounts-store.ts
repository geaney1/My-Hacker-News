import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { BadRequestError } from './hn-fetch';

const scryptAsync = promisify(scrypt);

/** Where accounts and the session secret are kept. Set `DATA_DIR` to store them elsewhere. */
export const dataDirectory = process.env['DATA_DIR'] ?? join(process.cwd(), 'data');
const accountsFile = join(dataDirectory, 'users.json');

/** The same rules as the username and password forms in the app. */
const usernamePattern = /^[A-Za-z0-9_-]{2,15}$/;
const minPasswordLength = 8;
const maxPasswordLength = 72;

const hashLength = 64;

export class UsernameTakenError extends Error {}

/** The current password given when changing a password was not the account's password. */
export class WrongPasswordError extends Error {}

type Account = {
  /** The username as the user typed it when they signed up. */
  username: string;
  salt: string;
  hash: string;
  /**
   * Goes up each time the password changes. Session tokens carry the version they were issued
   * for, so changing the password ends every session that was started with the old one.
   */
  version: number;
};

/** Accounts by lower-case username, so `Anna` and `anna` are the same person. */
type AccountFile = Record<string, Account>;

/** What a successful log-in tells the caller about the account. */
type VerifiedAccount = { username: string; version: number };

/** Writes are queued one after another so two requests can't overwrite each other. */
let writeQueue: Promise<unknown> = Promise.resolve();

async function readAccounts() {
  try {
    return JSON.parse(await readFile(accountsFile, 'utf8')) as AccountFile;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

async function writeAccounts(accounts: AccountFile) {
  await mkdir(dataDirectory, { recursive: true });
  const temporaryFile = `${accountsFile}.tmp`;
  await writeFile(temporaryFile, JSON.stringify(accounts, null, 2), { mode: 0o600 });
  await rename(temporaryFile, accountsFile);
}

/** Reads the accounts, lets `change` edit them, and saves them, one request at a time. */
async function updateAccounts<Result>(change: (accounts: AccountFile) => Result) {
  const result = writeQueue.then(async () => {
    const accounts = await readAccounts();
    const changeResult = change(accounts);
    await writeAccounts(accounts);
    return changeResult;
  });
  // Keep the queue alive after a failure, so one failed request doesn't block the next.
  writeQueue = result.catch(() => undefined);
  return result;
}

async function hashPassword(password: string, salt: Buffer) {
  return (await scryptAsync(password, salt, hashLength)) as Buffer;
}

function validateUsername(username: unknown) {
  if (typeof username !== 'string' || !usernamePattern.test(username)) {
    throw new BadRequestError(
      'Username must be 2 to 15 characters: letters, digits, dashes and underscores',
    );
  }
  return username;
}

function validatePassword(password: unknown) {
  if (
    typeof password !== 'string' ||
    password.length < minPasswordLength ||
    password.length > maxPasswordLength
  ) {
    throw new BadRequestError(
      `Password must be ${minPasswordLength} to ${maxPasswordLength} characters`,
    );
  }
  return password;
}

/** Creates an account. Throws when the username is already taken. */
export async function createAccount(usernameInput: unknown, passwordInput: unknown) {
  const username = validateUsername(usernameInput);
  const password = validatePassword(passwordInput);
  const salt = randomBytes(16);
  const hash = await hashPassword(password, salt);

  await updateAccounts((accounts) => {
    const key = username.toLowerCase();
    if (accounts[key]) {
      throw new UsernameTakenError();
    }
    accounts[key] = {
      username,
      salt: salt.toString('hex'),
      hash: hash.toString('hex'),
      version: 0,
    };
  });
  return username;
}

/** A fixed salt, used to spend the same time on unknown usernames as on real ones. */
const decoySalt = randomBytes(16);

/** Resolves to the account when the password is right, or `null` when it is not. */
export async function verifyAccount(usernameInput: unknown, passwordInput: unknown) {
  if (typeof usernameInput !== 'string' || typeof passwordInput !== 'string') {
    return null;
  }
  const account = (await readAccounts())[usernameInput.toLowerCase()];
  const salt = account ? Buffer.from(account.salt, 'hex') : decoySalt;
  const hash = await hashPassword(passwordInput.slice(0, maxPasswordLength), salt);

  if (!account) {
    return null;
  }
  const expected = Buffer.from(account.hash, 'hex');
  return expected.length === hash.length && timingSafeEqual(expected, hash)
    ? ({ username: account.username, version: account.version ?? 0 } satisfies VerifiedAccount)
    : null;
}

/**
 * Changes a password after checking the current one. Returns the account's new version, which
 * ends every session started before the change.
 */
export async function changePassword(
  usernameInput: string,
  currentPassword: unknown,
  newPasswordInput: unknown,
) {
  const verified = await verifyAccount(usernameInput, currentPassword);
  if (!verified) {
    throw new WrongPasswordError();
  }
  const newPassword = validatePassword(newPasswordInput);
  if (newPassword === currentPassword) {
    throw new BadRequestError('The new password must be different from the current one');
  }

  const salt = randomBytes(16);
  const hash = await hashPassword(newPassword, salt);
  return updateAccounts((accounts) => {
    const account = accounts[verified.username.toLowerCase()];
    account.salt = salt.toString('hex');
    account.hash = hash.toString('hex');
    account.version = (account.version ?? 0) + 1;
    return account.version;
  });
}

/** The account's current session version, or `null` when the account does not exist. */
export async function getAccountVersion(username: string) {
  const account = (await readAccounts())[username.toLowerCase()];
  return account ? (account.version ?? 0) : null;
}

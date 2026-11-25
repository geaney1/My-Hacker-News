import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { createSerialQueue, readJsonFile, writeJsonFile } from './data-files';
import { BadRequestError } from './hn-fetch';

const scryptAsync = promisify(scrypt);

const accountsFile = 'users.json';

/** The same rules as the username and password forms in the app. */
const usernamePattern = /^[A-Za-z0-9_-]{2,15}$/;
const minPasswordLength = 8;
const maxPasswordLength = 72;

const hashLength = 64;

export class UsernameTakenError extends Error {}

/** The current password given when changing a password was not the account's password. */
export class WrongPasswordError extends Error {}

type Account = {
  /** The username as the user typed it when they created the account. */
  username: string;
  salt: string;
  hash: string;
  /** When the account was made, in Unix milliseconds. Accounts made before this was kept have none. */
  createdAt?: number;
};

/** Accounts by lower-case username, so `Anna` and `anna` are the same person. */
type AccountFile = Record<string, Account>;

const enqueue = createSerialQueue();

const readAccounts = () => readJsonFile<AccountFile>(accountsFile, {});

/** Reads the accounts, lets `change` edit them, and saves them, one request at a time. */
function updateAccounts<Result>(change: (accounts: AccountFile) => Result) {
  return enqueue(async () => {
    const accounts = await readAccounts();
    const changeResult = change(accounts);
    await writeJsonFile(accountsFile, accounts);
    return changeResult;
  });
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
      createdAt: Date.now(),
    };
  });
  return username;
}

/**
 * The public facts about an account: its username as it was typed, and when it was made. Never
 * the password. Resolves to `null` when there is no such account.
 */
export async function findAccount(usernameInput: string) {
  const account = (await readAccounts())[usernameInput.toLowerCase()];
  return account ? { username: account.username, createdAt: account.createdAt } : null;
}

/** A fixed salt, used to spend the same time on unknown usernames as on real ones. */
const decoySalt = randomBytes(16);

/** Resolves to the account's username when the password is right, or `null` when it is not. */
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
    ? account.username
    : null;
}

/** Changes a password after checking the current one. */
export async function changePassword(
  usernameInput: string,
  currentPassword: unknown,
  newPasswordInput: unknown,
) {
  const username = await verifyAccount(usernameInput, currentPassword);
  if (!username) {
    throw new WrongPasswordError();
  }
  const newPassword = validatePassword(newPasswordInput);
  if (newPassword === currentPassword) {
    throw new BadRequestError('The new password must be different from the current one');
  }

  const salt = randomBytes(16);
  const hash = await hashPassword(newPassword, salt);
  await updateAccounts((accounts) => {
    const account = accounts[username.toLowerCase()];
    account.salt = salt.toString('hex');
    account.hash = hash.toString('hex');
  });
}

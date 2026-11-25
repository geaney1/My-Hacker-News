import { createJsonStore } from './json-store';
import { BadRequestError } from './hn-fetch';

const maxAboutLength = 2000;
const maxEmailLength = 254;
const maxNumber = 100_000;

export type Profile = {
  about: string;
  email: string;
  showdead: 'yes' | 'no';
  noprocrast: 'yes' | 'no';
  maxvisit: number;
  minaway: number;
  delay: number;
};

/** What a user who has never saved their profile has. The same as the form's starting values. */
const defaultProfile: Profile = {
  about: '',
  email: '',
  showdead: 'no',
  noprocrast: 'no',
  maxvisit: 20,
  minaway: 180,
  delay: 0,
};

/** Profiles by lower-case username, so `Anna` and `anna` are the same person. */
type ProfileFile = Record<string, Profile>;

const profilesStore = createJsonStore<ProfileFile>({ file: 'profiles.json', empty: () => ({}) });

const loadProfiles = () => profilesStore.load();

const keyOf = (username: string) => username.toLowerCase();

/** A simple check that it looks like an address: something@something.something, no spaces. */
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function yesNo(value: unknown, name: string) {
  if (value !== 'yes' && value !== 'no') {
    throw new BadRequestError(`${name} must be yes or no`);
  }
  return value;
}

function wholeNumber(value: unknown, name: string, minimum: number) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum || value > maxNumber) {
    throw new BadRequestError(`${name} must be a whole number from ${minimum} to ${maxNumber}`);
  }
  return value;
}

/** Checks what the browser sent. Only the known fields are kept. */
function validateProfile(fields: Record<string, unknown>) {
  const { about, email } = fields;
  if (typeof about !== 'string' || about.length > maxAboutLength) {
    throw new BadRequestError(`About can be at most ${maxAboutLength} characters`);
  }
  if (typeof email !== 'string' || email.trim().length > maxEmailLength || !emailPattern.test(email.trim())) {
    throw new BadRequestError('Enter a valid email address');
  }
  return {
    about,
    email: email.trim(),
    showdead: yesNo(fields['showdead'], 'Show Dead'),
    noprocrast: yesNo(fields['noprocrast'], 'No Procrast'),
    maxvisit: wholeNumber(fields['maxvisit'], 'Max Visit', 1),
    minaway: wholeNumber(fields['minaway'], 'Min Away', 0),
    delay: wholeNumber(fields['delay'], 'Delay', 0),
  } satisfies Profile;
}

/** The saved profile of `username`, or the defaults when there is none yet. */
export async function getProfile(username: string) {
  return (await loadProfiles())[keyOf(username)] ?? { ...defaultProfile };
}

/** Checks and saves the profile of `username`, and returns what was saved. */
export async function saveProfile(username: string, fields: Record<string, unknown>) {
  const profile = validateProfile(fields);
  const profiles = await loadProfiles();
  profiles[keyOf(username)] = profile;
  await profilesStore.save(profiles);
  return profile;
}

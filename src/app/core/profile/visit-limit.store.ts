import { isPlatformBrowser } from '@angular/common';
import {
  computed,
  DOCUMENT,
  effect,
  inject,
  PLATFORM_ID,
  Service,
  signal,
  untracked,
} from '@angular/core';
import { AuthStore } from '../auth/auth.store';
import { ProfileStore } from './profile.store';

/** How often the time spent is checked while the app is open. */
const checkMilliseconds = 15 * 1000;

const minute = 60 * 1000;

type Visit = {
  /** When the current visit started, or 0 when there is none. */
  visitStart: number;
  /** The last time the app was open. */
  lastSeen: number;
  /** The user is shut out until then, or 0. */
  lockedUntil: number;
};

/**
 * No Procrast: with it on, the user is shut out for Min Away minutes once a visit has lasted Max
 * Visit minutes. A visit starts when the app is opened after being away for Min Away minutes.
 * The times are kept in this browser, per user, so a reload does not start a new visit.
 */
@Service()
export class VisitLimitStore {
  private readonly authStore = inject(AuthStore);
  private readonly profileStore = inject(ProfileStore);
  private readonly storage = inject(DOCUMENT).defaultView?.localStorage;
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly now = signal(Date.now());
  private readonly lockedUntil = signal(0);

  /** `true` while the user is shut out. */
  readonly locked = computed(() => this.lockedUntil() > this.now());

  /** Minutes until the user can come back, rounded up. */
  readonly minutesLeft = computed(() =>
    Math.max(1, Math.ceil((this.lockedUntil() - this.now()) / minute)),
  );

  /** The Max Visit setting, for the message. */
  readonly maxVisit = computed(() => this.profileStore.profile()?.maxvisit ?? 0);

  constructor() {
    effect((onCleanup) => {
      const username = this.authStore.username();
      const profile = this.profileStore.profile();

      if (!this.isBrowser || !username || profile?.noprocrast !== 'yes') {
        this.lockedUntil.set(0);
        if (username && profile) {
          this.forget(username);
        }
        return;
      }

      const limits = { maxVisit: profile.maxvisit * minute, minAway: profile.minaway * minute };
      untracked(() => this.check(username, limits));
      const timer = setInterval(() => this.check(username, limits), checkMilliseconds);
      onCleanup(() => clearInterval(timer));
    });
  }

  private check(username: string, limits: { maxVisit: number; minAway: number }) {
    const now = Date.now();
    const visit = this.read(username);

    if (visit.lockedUntil <= now) {
      // Away for long enough (or never here) means this is a new visit.
      if (visit.visitStart === 0 || now - visit.lastSeen >= limits.minAway) {
        visit.visitStart = now;
      }
      visit.lastSeen = now;
      visit.lockedUntil = 0;
      if (now - visit.visitStart >= limits.maxVisit) {
        visit.lockedUntil = now + limits.minAway;
        visit.visitStart = 0;
      }
      this.write(username, visit);
    }

    this.lockedUntil.set(visit.lockedUntil);
    this.now.set(now);
  }

  private key(username: string) {
    return `hacker-news.visit.${username.toLowerCase()}`;
  }

  private read(username: string): Visit {
    try {
      const stored = JSON.parse(
        this.storage?.getItem(this.key(username)) ?? 'null',
      ) as Visit | null;
      if (
        stored &&
        [stored.visitStart, stored.lastSeen, stored.lockedUntil].every(Number.isFinite)
      ) {
        return stored;
      }
    } catch {
      // Unreadable or blocked storage: start a fresh visit.
    }
    return { visitStart: 0, lastSeen: 0, lockedUntil: 0 };
  }

  private write(username: string, visit: Visit) {
    try {
      this.storage?.setItem(this.key(username), JSON.stringify(visit));
    } catch {
      // Storage is full or blocked: the limit then only lasts until the page is reloaded.
    }
  }

  private forget(username: string) {
    try {
      this.storage?.removeItem(this.key(username));
    } catch {
      // Nothing to forget.
    }
  }
}

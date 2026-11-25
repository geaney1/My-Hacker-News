import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { UserProfileModel } from '../../models/user-profile-model';
import { AuthStore } from '../auth/auth.store';
import { VisitLimitStore } from './visit-limit.store';

const minute = 60 * 1000;

const profile = (overrides: Partial<UserProfileModel> = {}): UserProfileModel => ({
  about: '',
  email: 'billy@example.com',
  showdead: 'no',
  noprocrast: 'yes',
  maxvisit: 20,
  minaway: 180,
  delay: 0,
  ...overrides,
});

describe('VisitLimitStore', () => {
  let http: HttpTestingController;
  let limit: VisitLimitStore;

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T09:00:00Z'));
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.match(() => true);
    vi.useRealTimers();
    localStorage.clear();
  });

  /** Logs in as Billy, whose saved profile is `saved`, and starts the store. */
  async function start(saved: UserProfileModel) {
    limit = TestBed.inject(VisitLimitStore);
    const login = TestBed.inject(AuthStore).logIn('Billy', 'correct-horse');
    http.expectOne('/api/auth/login').flush({ username: 'Billy' });
    await login;
    TestBed.tick();
    http.expectOne('/api/profile').flush(saved);
    await vi.advanceTimersByTimeAsync(0);
    TestBed.tick();
  }

  const wait = async (minutes: number) => {
    await vi.advanceTimersByTimeAsync(minutes * minute);
    TestBed.tick();
  };

  it('is not shut out at the start of a visit', async () => {
    await start(profile());
    expect(limit.locked()).toBe(false);
  });

  it('shuts the user out once the visit has lasted Max Visit minutes', async () => {
    await start(profile());
    await wait(19);
    expect(limit.locked()).toBe(false);

    await wait(1);
    expect(limit.locked()).toBe(true);
    expect(limit.minutesLeft()).toBe(180);
    expect(limit.maxVisit()).toBe(20);
  });

  it('lets the user back in after Min Away minutes, and counts down the minutes left', async () => {
    await start(profile());
    await wait(20);
    expect(limit.locked()).toBe(true);

    await wait(100);
    expect(limit.locked()).toBe(true);
    expect(limit.minutesLeft()).toBe(80);

    await wait(80);
    expect(limit.locked()).toBe(false);
  });

  it('starts a fresh visit after coming back, with the full Max Visit again', async () => {
    await start(profile());
    await wait(20);
    await wait(180);
    expect(limit.locked()).toBe(false);

    await wait(19);
    expect(limit.locked()).toBe(false);
    await wait(1);
    expect(limit.locked()).toBe(true);
  });

  it('never shuts the user out when No Procrast is off', async () => {
    await start(profile({ noprocrast: 'no' }));
    await wait(600);
    expect(limit.locked()).toBe(false);
  });

  it('uses the Max Visit and Min Away the user chose', async () => {
    await start(profile({ maxvisit: 5, minaway: 10 }));
    await wait(5);
    expect(limit.locked()).toBe(true);
    expect(limit.minutesLeft()).toBe(10);
    await wait(10);
    expect(limit.locked()).toBe(false);
  });

  it('keeps the limit across a reload, in the same browser', async () => {
    await start(profile());
    await wait(20);
    expect(limit.locked()).toBe(true);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    await start(profile());
    expect(limit.locked()).toBe(true);
  });

  it("keeps the limit of one user apart from another's", async () => {
    await start(profile());
    await wait(20);
    expect(limit.locked()).toBe(true);

    expect(localStorage.getItem('hacker-news.visit.billy')).not.toBeNull();
    expect(localStorage.getItem('hacker-news.visit.anna')).toBeNull();
  });

  it('lifts the limit as soon as No Procrast is turned off', async () => {
    await start(profile());
    await wait(20);
    expect(limit.locked()).toBe(true);

    TestBed.inject((await import('./profile.store')).ProfileStore).remember(
      profile({ noprocrast: 'no' }),
    );
    TestBed.tick();
    expect(limit.locked()).toBe(false);
    expect(localStorage.getItem('hacker-news.visit.billy')).toBeNull();
  });

  it('is not shut out after logging out', async () => {
    await start(profile());
    await wait(20);
    expect(limit.locked()).toBe(true);

    const loggedOut = TestBed.inject(AuthStore).logOut();
    http.expectOne('/api/auth/logout').flush(null);
    await loggedOut;
    TestBed.tick();
    expect(limit.locked()).toBe(false);
  });
});

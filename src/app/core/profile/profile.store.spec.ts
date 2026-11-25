import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { UserProfileModel } from '../../models/user-profile-model';
import { AuthStore } from '../auth/auth.store';
import { ProfileStore } from './profile.store';

const saved: UserProfileModel = {
  about: 'Hi',
  email: 'anna@example.com',
  showdead: 'yes',
  noprocrast: 'no',
  maxvisit: 20,
  minaway: 180,
  delay: 0,
};

describe('ProfileStore', () => {
  let http: HttpTestingController;
  let store: ProfileStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(ProfileStore);
  });

  afterEach(() => http.verify());

  async function logIn() {
    const login = TestBed.inject(AuthStore).logIn('Anna', 'correct-horse');
    http.expectOne('/api/auth/login').flush({ username: 'Anna' });
    await login;
    TestBed.tick();
  }

  const settle = async () => {
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
  };

  it('has no profile, and asks for none, while nobody is logged in', () => {
    TestBed.tick();
    expect(store.profile()).toBeUndefined();
    expect(store.showDead()).toBe(false);
  });

  it('loads the profile once the user is logged in', async () => {
    await logIn();
    http.expectOne('/api/profile').flush(saved);
    await settle();

    expect(store.profile()).toEqual(saved);
    expect(store.showDead()).toBe(true);
  });

  it('has Show Dead off when the profile says no', async () => {
    await logIn();
    http.expectOne('/api/profile').flush({ ...saved, showdead: 'no' });
    await settle();
    expect(store.showDead()).toBe(false);
  });

  it('follows a profile that has just been saved, at once', async () => {
    await logIn();
    http.expectOne('/api/profile').flush({ ...saved, showdead: 'no' });
    await settle();

    store.remember(saved);
    expect(store.showDead()).toBe(true);
  });

  it('has no profile if it could not be loaded, rather than the wrong one', async () => {
    await logIn();
    http.expectOne('/api/profile').flush({}, { status: 500, statusText: 'Error' });
    await settle();
    expect(store.profile()).toBeUndefined();
    expect(store.showDead()).toBe(false);
  });

  it('forgets the profile when the user logs out', async () => {
    await logIn();
    http.expectOne('/api/profile').flush(saved);
    await settle();

    const loggedOut = TestBed.inject(AuthStore).logOut();
    http.expectOne('/api/auth/logout').flush(null);
    await loggedOut;
    await settle();
    expect(store.profile()).toBeUndefined();
    expect(store.showDead()).toBe(false);
  });
});

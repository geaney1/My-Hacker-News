import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from '../../app.routes';
import { AuthStore } from '../../core/auth/auth.store';
import { App } from '../../app';

/** The whole app shell with the app's real routes, so the dashboard and the pages in it are the real ones. */
describe('Dashboard', () => {
  let fixture: ComponentFixture<App>;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      // The same router features as the real app, so route parameters reach the pages' inputs.
      providers: [provideRouter(routes, withComponentInputBinding()), provideHttpClient(), provideHttpClientTesting()],
    });
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(App);
  });

  async function goTo(url: string) {
    await router.navigateByUrl(url);
    // Rendered directly: the stories page has a request waiting for an answer, so the app is
    // never "stable".
    fixture.detectChanges();
    // Lets the effects of the pages run, such as the stories page choosing its list.
    TestBed.tick();
    fixture.detectChanges();
  }

  const page = () => fixture.nativeElement as HTMLElement;
  const highlighted = () =>
    Array.from(page().querySelectorAll('app-side-menu a.tab.active')).map((link) => link.textContent?.trim());
  const tabs = () =>
    Array.from(page().querySelectorAll('app-side-menu a.tab')).map((link) => link.textContent?.trim());

  describe.each(['/log-in', '/create-user'])('on %s', (url) => {
    beforeEach(() => goTo(url));

    it('keeps the side menu, so the user can still move around', () => {
      expect(tabs()).toEqual(['Top', 'New', 'Best', 'Ask', 'Show', 'Jobs']);
    });

    it('shows the form inside the dashboard', () => {
      expect(page().querySelector('app-auth-card form')).not.toBeNull();
      expect(page().querySelector('.page app-auth-card')).not.toBeNull();
    });

    it('has one main area and one top-level heading, with the card title below it', () => {
      expect(page().querySelectorAll('main')).toHaveLength(1);
      expect(page().querySelectorAll('h1')).toHaveLength(1);
      expect(page().querySelector('h1')?.textContent).toBe('Hacker News');
      expect(page().querySelector('app-auth-card h2')).not.toBeNull();
    });

    it('does not show a Log In button in the header, as the form is already there', () => {
      expect(page().querySelector('a.sign-in')).toBeNull();
    });

    it('keeps the story list the user last had open highlighted', () => {
      expect(highlighted()).toEqual(['Top']);
    });

    it('shows the stories behind the dialog', () => {
      expect(page().querySelector('app-stories-page')).not.toBeNull();
      expect(page().querySelector('app-stories-page .filters, app-stories-page .toolbar')).not.toBeNull();
    });
  });

  it('keeps whichever list was open highlighted, and shows that list behind the dialog', async () => {
    await goTo('/best');
    await goTo('/log-in');

    expect(highlighted()).toEqual(['Best']);
    expect(page().querySelector('app-stories-page')).not.toBeNull();
  });

  it('does not show the stories behind other pages', async () => {
    await goTo('/item/1');
    expect(page().querySelector('app-stories-page')).toBeNull();
  });

  it('offers a Log In button on other pages while logged out', async () => {
    await goTo('/top');
    const button = page().querySelector<HTMLAnchorElement>('a.sign-in');
    expect(button?.textContent?.trim()).toBe('Log In');
    expect(button?.getAttribute('href')).toBe('/log-in');
  });

  it('brings the Log In button back after leaving the log-in page', async () => {
    await goTo('/log-in');
    expect(page().querySelector('a.sign-in')).toBeNull();
    await goTo('/new');
    expect(page().querySelector('a.sign-in')).not.toBeNull();
  });

  it('sends a logged-out visitor from a page that needs a login to the log-in page, inside the dashboard', async () => {
    await goTo('/user-profile');
    // The page that was wanted is remembered, so the user can be taken there after logging in.
    expect(router.url).toBe('/log-in?returnUrl=%2Fuser-profile');
    expect(tabs()).toContain('Top');
    expect(page().querySelector('app-auth-card')).not.toBeNull();
  });

  it('keeps one main area and one top-level heading on the profile page too', async () => {
    const login = TestBed.inject(AuthStore).logIn('Anna', 'correct-horse');
    TestBed.inject(HttpTestingController).expectOne('/api/auth/login').flush({ username: 'Anna' });
    await login;

    await goTo('/user-profile');
    expect(router.url).toBe('/user-profile');
    expect(page().querySelectorAll('main')).toHaveLength(1);
    expect(page().querySelectorAll('h1')).toHaveLength(1);
  });
});

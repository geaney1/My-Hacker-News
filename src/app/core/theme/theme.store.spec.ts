import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ThemeStore } from './theme.store';

const storageKey = 'hacker-news.theme';

describe('ThemeStore', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset['theme'];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    delete document.documentElement.dataset['theme'];
  });

  const prefersDark = (dark: boolean) =>
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: dark && query.includes('dark') }));

  function create() {
    const store = TestBed.inject(ThemeStore);
    TestBed.tick();
    return store;
  }

  it('starts light when nothing has been chosen and the device has no preference', () => {
    expect(create().theme()).toBe('light');
    expect(create().isDark()).toBe(false);
  });

  it('starts dark when the device prefers dark and nothing has been chosen', () => {
    prefersDark(true);
    expect(create().theme()).toBe('dark');
  });

  it('starts with the theme saved in this browser, whatever the device prefers', () => {
    prefersDark(true);
    localStorage.setItem(storageKey, 'light');
    expect(create().theme()).toBe('light');

    TestBed.resetTestingModule();
    prefersDark(false);
    localStorage.setItem(storageKey, 'dark');
    expect(create().theme()).toBe('dark');
  });

  it('ignores a saved value that is not a theme', () => {
    localStorage.setItem(storageKey, 'purple');
    expect(create().theme()).toBe('light');
  });

  it('puts the theme on the page, so the stylesheet can use it', () => {
    create();
    expect(document.documentElement.dataset['theme']).toBe('light');
  });

  it('switches to the other theme and back again', () => {
    const store = create();

    store.toggle();
    TestBed.tick();
    expect(store.theme()).toBe('dark');
    expect(store.isDark()).toBe(true);
    expect(document.documentElement.dataset['theme']).toBe('dark');

    store.toggle();
    TestBed.tick();
    expect(store.theme()).toBe('light');
    expect(document.documentElement.dataset['theme']).toBe('light');
  });

  it('remembers the choice in this browser, so the next visit starts with it', () => {
    const store = create();
    store.toggle();
    TestBed.tick();
    expect(localStorage.getItem(storageKey)).toBe('dark');

    TestBed.resetTestingModule();
    expect(create().theme()).toBe('dark');
  });

  it('leaves the page and storage alone on the server, which has no theme to show', () => {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    const store = create();
    store.toggle();
    TestBed.tick();

    expect(store.theme()).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBeUndefined();
    expect(setItem).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('still works when the browser will not store anything', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    const store = create();
    expect(store.theme()).toBe('light');
    store.toggle();
    TestBed.tick();
    expect(store.theme()).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
    vi.restoreAllMocks();
  });
});

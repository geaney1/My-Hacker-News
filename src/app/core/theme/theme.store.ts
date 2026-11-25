import { isPlatformBrowser } from '@angular/common';
import { computed, DOCUMENT, effect, inject, PLATFORM_ID, Service, signal } from '@angular/core';
import { Theme } from '../../models/theme';

const storageKey = 'hacker-news.theme';

/**
 * The colour theme: light or dark. It starts as the one saved in this browser, or else the one
 * the device prefers, and the choice is remembered. A small script in index.html sets the same
 * theme before the page is painted, so this only has to keep it in step afterwards. The server
 * does not know which theme a visitor chose, so it leaves the page alone and the light theme is
 * the one it renders; the script in the browser does the rest.
 */
@Service()
export class ThemeStore {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly theme = signal<Theme>(this.startingTheme());

  /** `true` while the dark theme is on. */
  readonly isDark = computed(() => this.theme() === 'dark');

  constructor() {
    effect(() => {
      const theme = this.theme();
      if (!this.isBrowser) {
        return;
      }
      this.document.documentElement.dataset['theme'] = theme;
      try {
        this.document.defaultView?.localStorage.setItem(storageKey, theme);
      } catch {
        // Storage is blocked: the theme then lasts until the page is reloaded.
      }
    });
  }

  /** Switches to the other theme. */
  toggle() {
    this.theme.update((theme) => (theme === 'dark' ? 'light' : 'dark'));
  }

  private startingTheme(): Theme {
    const view = this.document.defaultView;
    try {
      const saved = view?.localStorage.getItem(storageKey);
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
    } catch {
      // Storage is blocked: fall back to what the device prefers.
    }
    return view?.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}

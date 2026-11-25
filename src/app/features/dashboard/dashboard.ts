import {
  afterNextRender,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  PLATFORM_ID,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import { VisitLimitStore } from '../../core/profile/visit-limit.store';
import { firstSegmentOf, injectCurrentUrl } from '../../core/navigation/current-url';
import { StoriesPage } from '../stories/stories-page/stories-page';
import { StoriesStore } from '../stories/stories.store';
import { SideMenu } from './side-menu/side-menu';
import { Banner } from '../../shared/banner/banner';

@Component({
  selector: 'app-dashboard',
  imports: [Banner, RouterOutlet, RouterLink, RouterLinkActive, SideMenu, StoriesPage],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly store = inject(StoriesStore);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly visitLimit = inject(VisitLimitStore);
  private readonly injector = inject(Injector);
  private readonly title = inject(Title);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');

  /**
   * The title of the page just navigated to, in a live region so a screen reader says it. The page
   * is not reloaded by a navigation, so nothing else would tell the user the page has changed.
   */
  protected readonly announcement = signal('');

  /** The Skip to main content link: puts the focus on the page itself, past the menu. */
  protected skipToMain(event: Event) {
    // Not a real link to #main: the page's base address would make that a different address.
    event.preventDefault();
    this.main().nativeElement.focus();
  }

  private readonly sideMenu = viewChild.required(SideMenu);
  private readonly menuButton = viewChild.required<ElementRef<HTMLButtonElement>>('menuButton');

  /**
   * Whether the story-list menu is open. Only a small screen has this: there the menu is a drawer
   * that the hamburger button opens and closes. On a wide screen the menu is always shown.
   */
  protected readonly menuOpen = signal(false);

  protected toggleMenu() {
    if (this.menuOpen()) {
      this.closeMenu();
      return;
    }
    this.menuOpen.set(true);
    // Once the drawer is showing, the keyboard focus goes into it.
    afterNextRender(() => this.sideMenu().focusFirst(), { injector: this.injector });
  }

  /** Closes the drawer. `returnFocus` puts the focus back on the button that opened it. */
  protected closeMenu(returnFocus = false) {
    if (!this.menuOpen()) {
      return;
    }
    this.menuOpen.set(false);
    if (returnFocus) {
      this.menuButton().nativeElement.focus();
    }
  }

  /** `true` while the user is logged in. */
  protected readonly login = this.authStore.login;
  protected readonly username = this.authStore.username;
  protected readonly initial = computed(() => this.username().charAt(0));

  private readonly currentUrl = injectCurrentUrl();

  private announced = false;

  constructor() {
    effect(() => {
      this.currentUrl();
      if (!this.isBrowser) {
        return;
      }
      untracked(() => {
        // After the router has set the new title. The first page load is not announced: the screen
        // reader reads a loaded page itself.
        setTimeout(() => {
          if (this.announced) {
            this.announcement.set(this.title.getTitle());
          }
          this.announced = true;
        }, 100);
      });
    });
  }

  /** The story list the user last had open: it stays on screen behind the dialogs. */
  protected readonly backgroundList = this.store.selectedList;

  /** `true` on the log-in and create-user pages, where a "Log In" button would be redundant. */
  protected readonly onLogInPage = computed(() =>
    ['log-in', 'create-user'].includes(firstSegmentOf(this.currentUrl())),
  );

  /** `true` on the pages that open as a dialog over the stories: log-in, create-user, submit, profile and change-password. */
  protected readonly dialogOverStories = computed(() =>
    ['log-in', 'create-user', 'submit', 'user-profile', 'change-password'].includes(
      firstSegmentOf(this.currentUrl()),
    ),
  );

  /** `true` while No Procrast has shut the user out. Only the profile page, to change it, stays open. */
  protected readonly shutOut = this.visitLimit.locked;
  protected readonly minutesLeft = this.visitLimit.minutesLeft;
  protected readonly maxVisit = this.visitLimit.maxVisit;

  protected readonly onProfilePage = computed(
    () => firstSegmentOf(this.currentUrl()) === 'user-profile',
  );

  logOut() {
    this.authStore.logOut();
    // Leave the Welcome page, the Submit dialog and the profile pages, which need a login.
    if (
      this.router.url.startsWith('/welcome') ||
      this.router.url.startsWith('/submit') ||
      this.router.url.startsWith('/user-profile') ||
      this.router.url.startsWith('/change-password')
    ) {
      this.router.navigate(['/', 'top']);
    }
  }
}

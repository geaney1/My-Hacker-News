import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import { firstSegmentOf, injectCurrentUrl } from '../../core/navigation/current-url';
import { StoriesPage } from '../stories/stories-page/stories-page';
import { StoriesStore } from '../stories/stories.store';
import { SideMenu } from './side-menu/side-menu';

@Component({
  selector: 'app-dashboard',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, SideMenu, StoriesPage],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  private readonly store = inject(StoriesStore);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  /** `true` while the user is logged in. */
  protected readonly login = this.authStore.login;
  protected readonly username = this.authStore.username;
  protected readonly initial = computed(() => this.username().charAt(0));

  private readonly currentUrl = injectCurrentUrl();

  /** The story list the user last had open: it stays on screen behind the log-in dialog. */
  protected readonly backgroundList = this.store.selectedList;

  /** `true` on the log-in and create-user pages, which open as a dialog over the stories. */
  protected readonly onSignInPage = computed(() =>
    ['log-in', 'create-user'].includes(firstSegmentOf(this.currentUrl())),
  );

  signOut() {
    this.authStore.signOut();
    // Leave the Submit list, Welcome page or profile when they require a login.
    if (
      this.store.selectedList() === 'submit' ||
      this.router.url.startsWith('/welcome') ||
      this.router.url.startsWith('/user-profile') ||
      this.router.url.startsWith('/change-password')
    ) {
      this.router.navigate(['/', 'top']);
    }
  }
}

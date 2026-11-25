import { Component, computed, ElementRef, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthStore } from '../../../core/auth/auth.store';
import { firstSegmentOf, injectCurrentUrl } from '../../../core/navigation/current-url';
import { HnStoryList, hnStoryLists } from '../../../models/hn-story-list';
import { StoriesStore } from '../../stories/stories.store';

type StoryListOption = { value: HnStoryList; label: string };

/**
 * Pages opened from a story list (or over one, like the log-in and submit dialogs): the list the
 * user came from stays selected while on them.
 */
const pagesOpenedFromAList = ['item', 'user', 'log-in', 'create-user', 'submit', 'user-profile', 'change-password'];

@Component({
  selector: 'app-side-menu',
  host: { '[class.open]': 'open()' },
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './side-menu.html',
  styleUrl: './side-menu.scss',
})
export class SideMenu {
  private readonly authStore = inject(AuthStore);
  private readonly storiesStore = inject(StoriesStore);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * Whether the menu is open. It only matters on a small screen, where the menu is a drawer that
   * the hamburger button opens; on a wide screen the menu is always there.
   */
  readonly open = input(false);

  /** A tab was chosen, so the page can close the drawer. */
  readonly chosen = output();

  /** Moves the keyboard focus to the first tab, for when the drawer has just been opened. */
  focusFirst() {
    this.element.nativeElement.querySelector<HTMLElement>('a.tab')?.focus();
  }

  /** The story lists, in the order they are shown. */
  protected readonly listOptions: readonly StoryListOption[] = [
    { value: 'top', label: 'Top' },
    { value: 'new', label: 'New' },
    { value: 'best', label: 'Best' },
    { value: 'ask', label: 'Ask' },
    { value: 'show', label: 'Show' },
    { value: 'job', label: 'Jobs' },
  ];

  /** `true` while the user is logged in: Submit and Welcome are only shown then. */
  protected readonly login = this.authStore.login;


  private readonly currentUrl = injectCurrentUrl();

  /** The first part of the current address, e.g. `new` for `/new?x=1` or `user` for `/user/pg`. */
  private readonly firstSegment = computed(() => firstSegmentOf(this.currentUrl()));

  /** The list being shown right now, when the page is a story list itself. */
  protected readonly listBeingShown = computed(() =>
    hnStoryLists.find((list) => list === this.firstSegment()),
  );

  /**
   * The list to highlight. On a list page it is that list. On a story or user page it is the list
   * the user last opened, so they can see where they came from. Elsewhere, nothing.
   */
  protected readonly highlightedList = computed(() => {
    if (this.listBeingShown()) {
      return this.listBeingShown();
    }
    return pagesOpenedFromAList.includes(this.firstSegment())
      ? this.storiesStore.selectedList()
      : undefined;
  });
}

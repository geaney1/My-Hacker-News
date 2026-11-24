import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthStore } from '../../../core/auth/auth.store';
import { firstSegmentOf, injectCurrentUrl } from '../../../core/navigation/current-url';
import { HnStoryList, hnStoryLists } from '../../../models/hn-story-list';
import { StoriesStore } from '../../stories/stories.store';

type StoryListOption = { value: HnStoryList; label: string };

/**
 * Pages opened from a story list (or over one, like the log-in dialog): the list the user came
 * from stays selected while on them.
 */
const pagesOpenedFromAList = ['item', 'user', 'log-in', 'create-user'];

@Component({
  selector: 'app-side-menu',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './side-menu.html',
  styleUrl: './side-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SideMenu {
  private readonly authStore = inject(AuthStore);
  private readonly storiesStore = inject(StoriesStore);

  private readonly allListOptions: readonly StoryListOption[] = [
    { value: 'top', label: 'Top' },
    { value: 'new', label: 'New' },
    { value: 'best', label: 'Best' },
    { value: 'ask', label: 'Ask' },
    { value: 'show', label: 'Show' },
    { value: 'job', label: 'Jobs' },
    { value: 'submit', label: 'Submit' },
  ];

  /** `true` while the user is logged in. */
  protected readonly login = this.authStore.login;

  /** The story list entries; "Submit" is only available while logged in. */
  protected readonly listOptions = computed(() =>
    this.allListOptions.filter((option) => option.value !== 'submit' || this.login()),
  );

  private readonly currentUrl = injectCurrentUrl();

  /** The first part of the current address, e.g. `new` for `/new?x=1` or `item` for `/item/5`. */
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

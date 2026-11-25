import { Component, computed, effect, inject, input, linkedSignal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../../core/auth/auth.store';
import { HnStoryList } from '../../../models/hn-story-list';
import { Pagination } from '../../../shared/pagination/pagination';
import { TimeAgoPipe } from '../../../shared/time-ago.pipe';
import { StoriesStore } from '../stories.store';
import { Banner } from '../../../shared/banner/banner';

@Component({
  selector: 'app-stories-page',
  imports: [Banner, FormField, Pagination, RouterLink, TimeAgoPipe],
  templateUrl: './stories-page.html',
  styleUrl: './stories-page.scss',
})
export class StoriesPage {
  protected readonly store = inject(StoriesStore);
  private readonly authStore = inject(AuthStore);

  /** Changes when another list is chosen, or somebody logs in or out: "Go to page" is cleared. */
  protected readonly paginationResetKey = computed(
    () => `${this.store.selectedList()}:${this.authStore.username()}`,
  );

  /** The story list from the URL (`/top`, `/new`, ...), bound from the route parameter. */
  readonly list = input<HnStoryList>();

  /** Follows the store (e.g. restored preferences) and is written to by the form. */
  protected readonly filterModel = linkedSignal(() => ({
    searchTerm: this.store.searchTerm(),
    minScore: this.store.minScore(),
  }));

  protected readonly filterForm = form(this.filterModel);

  constructor() {
    // The URL decides which list is shown.
    effect(() => {
      const list = this.list();
      if (list) {
        this.store.selectList(list);
      }
    });

    effect(() => {
      const { searchTerm, minScore } = this.filterModel();
      this.store.searchTerm.set(searchTerm);
      this.store.minScore.set(Number.isFinite(minScore) ? minScore : 0);
    });
  }
}

import {
  afterNextRender,
  DestroyRef,
  DOCUMENT,
  computed,
  effect,
  inject,
  Injectable,
  linkedSignal,
  PLATFORM_ID,
  resource,
  signal,
  untracked,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HnApi } from '../../core/api/hn-api';
import { HnStoryList } from '../../models/hn-story-list';
import { StoryPage } from '../../models/story-page';

const storageKey = 'hacker-news.stories.preferences';

/** How often the app asks Hacker News which items changed. */
const updatesPollMilliseconds = 60 * 1000;

@Injectable({ providedIn: 'root' })
export class StoriesStore {
  private readonly api = inject(HnApi);

  // Writable state
  readonly selectedList = signal<HnStoryList>('top');
  readonly searchTerm = signal('');
  readonly minScore = signal(0);
  readonly pageSize = signal(20);

  /** Starts on page 1 again whenever the list or page size changes. */
  readonly page = linkedSignal({
    source: () => ({ list: this.selectedList(), pageSize: this.pageSize() }),
    computation: () => 1,
  });

  // Server data: the current page of the selected list, loaded in a single request
  private readonly pageResource = resource({
    params: () => ({ list: this.selectedList(), page: this.page(), pageSize: this.pageSize() }),
    loader: ({ params, abortSignal }) =>
      this.api.getStoryPage(params.list, params.page, params.pageSize, abortSignal),
  });

  // Derived state

  /** Keeps the last known total while the next page loads, so the page count doesn't jump. */
  readonly totalStories = linkedSignal<StoryPage | undefined, number>({
    source: () => this.pageResource.value(),
    computation: (storyPage, previous) => storyPage?.total ?? previous?.value ?? 0,
  });
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalStories() / this.pageSize())));
  readonly hasNextPage = computed(() => this.page() < this.totalPages());

  /** The current page of stories, narrowed by the search term and minimum score. */
  readonly stories = computed(() => {
    const searchTerm = this.searchTerm().trim().toLowerCase();
    const minScore = this.minScore();
    return (this.pageResource.value()?.stories ?? []).filter((story) => {
      const matchesScore = (story.score ?? 0) >= minScore;
      const matchesSearch =
        searchTerm === '' ||
        (story.title ?? '').toLowerCase().includes(searchTerm) ||
        (story.by ?? '').toLowerCase().includes(searchTerm);
      return matchesScore && matchesSearch;
    });
  });

  readonly isLoading = this.pageResource.isLoading;
  readonly error = this.pageResource.error;

  // Live updates: which items Hacker News says have changed since the page was loaded.
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  /** Items that had already changed when the current page was loaded. */
  private readonly changedWhenLoaded = signal<ReadonlySet<number>>(new Set());
  /** Items that have changed recently, as of the latest check. */
  private readonly changedNow = signal<ReadonlySet<number>>(new Set());

  /** How many of the stories on this page have changed since the page was loaded. */
  readonly changedStoryCount = computed(() => {
    const changedWhenLoaded = this.changedWhenLoaded();
    const changedNow = this.changedNow();
    return (this.pageResource.value()?.stories ?? []).filter(
      (story) => changedNow.has(story.id) && !changedWhenLoaded.has(story.id),
    ).length;
  });

  private readonly preferencesRestored = signal(false);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.watchForUpdates();
    }

    // Restore after the first render so server and client markup match during hydration.
    afterNextRender(() => {
      this.restorePreferences();
      this.preferencesRestored.set(true);
    });

    // Once a page has loaded, fetch the next one in the background while the user reads.
    effect(() => {
      if (this.pageResource.hasValue() && this.hasNextPage()) {
        this.api.prefetchStoryPage(this.selectedList(), this.page() + 1, this.pageSize());
      }
    });

    effect(() => {
      const preferences = { minScore: this.minScore() };
      if (this.preferencesRestored()) {
        this.savePreferences(preferences);
      }
    });
  }

  selectList(list: HnStoryList) {
    this.selectedList.set(list);
  }

  /** Jumps to a page, clamped to the range of available pages. */
  goToPage(page: number) {
    if (Number.isFinite(page)) {
      this.page.set(Math.min(Math.max(1, Math.trunc(page)), this.totalPages()));
    }
  }

  reload() {
    this.api.clearStoryPageCache();
    this.pageResource.reload();
  }

  /**
   * A freshly loaded page is the starting point; after that the app asks Hacker News once a
   * minute (while the tab is visible) which items changed, and compares with that starting point.
   */
  private watchForUpdates() {
    effect(() => {
      if (this.pageResource.hasValue()) {
        // Read the value so a new page, or a reload, starts a new comparison.
        this.pageResource.value();
        untracked(() => this.refreshUpdates(true));
      }
    });

    const timer = setInterval(() => {
      if (this.document.visibilityState !== 'hidden') {
        this.refreshUpdates(false);
      }
    }, updatesPollMilliseconds);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  private async refreshUpdates(isStartingPoint: boolean) {
    try {
      const changed = new Set((await this.api.getUpdates()).items);
      this.changedNow.set(changed);
      if (isStartingPoint) {
        this.changedWhenLoaded.set(changed);
      }
    } catch {
      // Not important: the next check tries again.
    }
  }

  private restorePreferences() {
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) {
        return;
      }
      const preferences: { minScore?: number } = JSON.parse(stored);
      if (typeof preferences.minScore === 'number') {
        this.minScore.set(preferences.minScore);
      }
    } catch {
      // Storage unavailable or corrupt: fall back to the defaults.
    }
  }

  private savePreferences(preferences: { minScore: number }) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(preferences));
    } catch {
      // Storage unavailable: preferences simply aren't persisted.
    }
  }
}

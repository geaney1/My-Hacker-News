import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID, REQUEST, Service } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ProfileStore } from '../profile/profile.store';
import { ItemThread } from '../../models/item-thread';
import { HnStoryList } from '../../models/hn-story-list';
import { StoryPage } from '../../models/story-page';
import { HnUpdates } from '../../models/hn-updates';
import { HnUser } from '../../models/hn-user';

@Service()
export class HnApi {
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly profileStore = inject(ProfileStore);
  private readonly request = inject(REQUEST, { optional: true });

  /**
   * When a page is rendered on the server, the browser's cookie has to be passed on by hand to the
   * calls that depend on who is looking (the stories and a story's comments: Show Dead, and a
   * comment still held back by its writer's Delay). Without it the server-rendered page would be
   * made for a visitor, and a logged-in user would not see their own settings on a page they open
   * directly. The cookie only goes to this app's own server.
   */
  private serverHeaders(): Record<string, string> {
    const cookie = this.request?.headers.get('cookie');
    return cookie ? { cookie } : {};
  }

  /** Pages already loaded in this browser. Not used on the server, which is shared by all users. */
  private readonly storyPageCache = new Map<string, StoryPage>();

  /** Pages being prefetched right now, so a page that is opened meanwhile is not requested twice. */
  private readonly pendingStoryPages = new Map<string, Promise<StoryPage>>();

  /**
   * One page of a story list, loaded through the app's own server in a single request.
   * A page that was loaded before is returned from memory, so going back to it is instant.
   * Aborting `abortSignal` cancels the request, e.g. when the user has already moved on.
   */
  async getStoryPage(list: HnStoryList, page: number, pageSize: number, abortSignal?: AbortSignal) {
    const key = this.storyPageKey(list, page, pageSize);
    const cached = this.storyPageCache.get(key);
    if (cached) {
      return cached;
    }

    const pending = this.pendingStoryPages.get(key);
    if (pending) {
      return pending;
    }

    const storyPage = await this.requestStoryPage(list, page, pageSize, abortSignal);
    if (this.isBrowser) {
      this.storyPageCache.set(key, storyPage);
    }
    return storyPage;
  }

  /**
   * Loads a page in the background so it is ready when the user asks for it. It does nothing
   * on the server, and a failure is ignored: the page is simply loaded normally when opened.
   */
  async prefetchStoryPage(list: HnStoryList, page: number, pageSize: number) {
    const key = this.storyPageKey(list, page, pageSize);
    if (!this.isBrowser || this.storyPageCache.has(key) || this.pendingStoryPages.has(key)) {
      return;
    }

    const request = this.requestStoryPage(list, page, pageSize);
    this.pendingStoryPages.set(key, request);
    try {
      this.storyPageCache.set(key, await request);
    } catch {
      // Not needed yet: opening the page will load it again and report any error then.
    } finally {
      this.pendingStoryPages.delete(key);
    }
  }

  /** Forgets every cached page, so the next load fetches fresh stories. */
  clearStoryPageCache() {
    this.storyPageCache.clear();
    this.pendingStoryPages.clear();
  }

  private storyPageKey(list: HnStoryList, page: number, pageSize: number) {
    // Show Dead changes which stories a page has, so pages are kept apart by it.
    return `${list}:${page}:${pageSize}:${this.profileStore.showDead()}`;
  }

  /** Promise-based request that stops the HTTP call when `abortSignal` is aborted. */
  private requestStoryPage(
    list: HnStoryList,
    page: number,
    pageSize: number,
    abortSignal?: AbortSignal,
  ) {
    return new Promise<StoryPage>((resolve, reject) => {
      const subscription = this.http
        .get<StoryPage>(`/api/stories/${list}`, {
          params: { page, pageSize },
          headers: this.serverHeaders(),
        })
        .subscribe({ next: resolve, error: reject });

      abortSignal?.addEventListener(
        'abort',
        () => {
          subscription.unsubscribe();
          reject(abortSignal.reason);
        },
        { once: true },
      );
    });
  }

  /** The items and profiles that changed recently. */
  getUpdates() {
    return firstValueFrom(this.http.get<HnUpdates>('/api/updates'));
  }

  /** An item with its comment tree. Resolves to `null` when the item does not exist. */
  getThread(id: number) {
    return this.getOrNull<ItemThread>(`/api/items/${id}/thread`, this.serverHeaders());
  }

  /** Resolves to `null` when the user does not exist or has no public activity. */
  getUser(username: string) {
    return this.getOrNull<HnUser>(`/api/users/${encodeURIComponent(username)}`);
  }

  /** The server answers 404 for something that does not exist: that is `null`, not an error. */
  private async getOrNull<Value>(url: string, headers: Record<string, string> = {}) {
    try {
      return await firstValueFrom(this.http.get<Value>(url, { headers }));
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        return null;
      }
      throw error;
    }
  }
}

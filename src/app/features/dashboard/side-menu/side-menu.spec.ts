import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { StoriesStore } from '../../stories/stories.store';
import { SideMenu } from './side-menu';

@Component({ template: '' })
class BlankPage {}

describe('SideMenu', () => {
  let fixture: ComponentFixture<SideMenu>;
  let router: Router;
  let stories: StoriesStore;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'item/:id', component: BlankPage },
          { path: 'user/:id', component: BlankPage },
          { path: 'log-in', component: BlankPage },
          { path: 'create-user', component: BlankPage },
          { path: 'welcome', component: BlankPage },
          { path: 'user-profile', component: BlankPage },
          { path: ':list', component: BlankPage },
        ]),
      ],
    });
    router = TestBed.inject(Router);
    stories = TestBed.inject(StoriesStore);
    fixture = TestBed.createComponent(SideMenu);
  });

  async function goTo(url: string) {
    await router.navigateByUrl(url);
    // Rendered directly: the stories store has a request waiting for an answer, so the app is never "stable".
    fixture.detectChanges();
  }

  const tabs = () => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('a.tab'));
  const tab = (label: string) => tabs().find((link) => link.textContent?.trim() === label) as HTMLAnchorElement;
  const highlighted = () => tabs().filter((link) => link.classList.contains('active')).map((link) => link.textContent?.trim());

  it('lists the story lists, without Submit while logged out', async () => {
    await goTo('/top');
    expect(tabs().map((link) => link.textContent?.trim())).toEqual(['Top', 'New', 'Best', 'Ask', 'Show', 'Jobs']);
  });

  describe('on a story list', () => {
    it.each([
      ['/top', 'Top'],
      ['/new', 'New'],
      ['/best', 'Best'],
      ['/job', 'Jobs'],
    ])('highlights the list for %s', async (url, label) => {
      await goTo(url);
      expect(highlighted()).toEqual([label]);
    });

    it('marks the list as the current page for assistive technology', async () => {
      await goTo('/new');
      expect(tab('New').getAttribute('aria-current')).toBe('page');
      expect(tab('Top').hasAttribute('aria-current')).toBe(false);
    });

    it('ignores a query string', async () => {
      await goTo('/best?x=1');
      expect(highlighted()).toEqual(['Best']);
    });
  });

  describe('on a story or user page opened from a list', () => {
    it('keeps the list the user came from highlighted', async () => {
      await goTo('/new');
      stories.selectList('new'); // what the stories page does when it shows a list
      await goTo('/item/50626578');

      expect(highlighted()).toEqual(['New']);
    });

    it('does not claim to be the current page, since the story is', async () => {
      await goTo('/best');
      stories.selectList('best');
      await goTo('/item/1');

      expect(tab('Best').hasAttribute('aria-current')).toBe(false);
    });

    it('does the same on a user page', async () => {
      await goTo('/job');
      stories.selectList('job');
      await goTo('/user/pg');

      expect(highlighted()).toEqual(['Jobs']);
    });

    it('follows the list when the user comes back through another one', async () => {
      stories.selectList('ask');
      await goTo('/item/1');
      expect(highlighted()).toEqual(['Ask']);

      stories.selectList('show');
      await goTo('/item/2');
      expect(highlighted()).toEqual(['Show']);
    });

    it.each(['/log-in', '/create-user'])('keeps the list highlighted on %s, which opens over it', async (url) => {
      await goTo('/job');
      stories.selectList('job');
      await goTo(url);

      expect(highlighted()).toEqual(['Jobs']);
      expect(tab('Jobs').hasAttribute('aria-current')).toBe(false);
    });

    it('falls back to Top when the page was opened directly', async () => {
      await goTo('/item/50626578');
      expect(highlighted()).toEqual(['Top']);
    });
  });

  describe('on other pages', () => {
    it.each(['/welcome', '/user-profile'])('highlights no list on %s', async (url) => {
      stories.selectList('new');
      await goTo(url);
      expect(highlighted()).toEqual([]);
    });
  });
});

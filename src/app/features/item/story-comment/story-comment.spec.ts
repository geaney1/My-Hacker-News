import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HnComment } from '../../../models/hn-comment';
import { StoryComment } from './story-comment';

function comment(id: number, overrides: Partial<HnComment> = {}): HnComment {
  return { id, type: 'comment', by: `user${id}`, time: 1_700_000_000, text: `Comment ${id}`, replies: [], ...overrides };
}

describe('StoryComment', () => {
  let fixture: ComponentFixture<StoryComment>;

  async function show(value: HnComment) {
    fixture = TestBed.createComponent(StoryComment);
    fixture.componentRef.setInput('comment', value);
    await fixture.whenStable();
  }

  const page = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('shows the author as a link to their profile, and the comment text', async () => {
    await show(comment(1, { by: 'anna', text: 'Hello there' }));

    const author = page().querySelector<HTMLAnchorElement>('a.author');
    expect(author?.textContent?.trim()).toBe('anna');
    expect(author?.getAttribute('href')).toBe('/user/anna');
    expect(page().querySelector('.text')?.textContent).toContain('Hello there');
  });

  it('shows the comment\'s HTML as HTML, with the shared text styling switched on', async () => {
    await show(comment(1, { text: 'Read <a href="https://example.com">this</a><p>Then <i>think</i>' }));

    const text = page().querySelector('.text') as HTMLElement;
    // Component styles cannot reach inserted HTML, so the shared `hn-text` class has to be present.
    expect(text.classList.contains('hn-text')).toBe(true);
    expect(text.querySelector('a')?.getAttribute('href')).toBe('https://example.com');
    expect(text.querySelectorAll('p')).toHaveLength(1);
    expect(text.querySelector('i')?.textContent).toBe('think');
  });

  it('keeps long code in a <pre> so the page styles can make it scroll', async () => {
    await show(comment(1, { text: 'Try:<p><pre><code>' + 'x'.repeat(500) + '</code></pre>' }));
    expect(page().querySelector('.text pre code')?.textContent).toHaveLength(500);
  });

  it('removes scripts and event handlers from the comment\'s HTML', async () => {
    await show(comment(1, { text: 'Hi<script>alert(1)</script><img src="x" onerror="alert(2)">' }));

    expect(page().querySelector('script')).toBeNull();
    expect(page().querySelector('img')?.hasAttribute('onerror') ?? false).toBe(false);
  });

  it('shows replies nested under the comment, each with its own author', async () => {
    await show(
      comment(1, {
        replies: [comment(2, { by: 'ben', replies: [comment(3, { by: 'cara' })] }), comment(4, { by: 'dan' })],
      }),
    );

    const replies = page().querySelectorAll('ul.replies');
    expect(replies).toHaveLength(2);
    expect(Array.from(page().querySelectorAll('a.author')).map((link) => link.textContent?.trim())).toEqual([
      'user1',
      'ben',
      'cara',
      'dan',
    ]);
    expect(page().querySelector('ul.replies > li:first-child ul.replies a.author')?.textContent?.trim()).toBe('cara');
  });

  it('has no replies list when there are no replies', async () => {
    await show(comment(1));
    expect(page().querySelector('ul.replies')).toBeNull();
  });

  it('can be folded away, as it is a details element that starts open', async () => {
    await show(comment(1));
    const details = page().querySelector('details') as HTMLDetailsElement;
    expect(details.open).toBe(true);
  });
});

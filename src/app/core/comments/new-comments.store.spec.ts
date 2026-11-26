import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthStore } from '../auth/auth.store';
import { NewCommentsStore } from './new-comments.store';

describe('NewCommentsStore', () => {
  let store: NewCommentsStore;

  beforeEach(() => {
    store = TestBed.inject(NewCommentsStore);
  });

  it('has no comments to begin with', () => {
    expect(store.forItem(123)).toEqual([]);
  });

  it('adds a comment by the author, on the story, with the time it was written', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
    try {
      store.add(123, 'Anna', 'Nice story');
    } finally {
      vi.useRealTimers();
    }

    const [comment] = store.forItem(123);
    expect(comment).toMatchObject({
      type: 'comment',
      by: 'Anna',
      parent: 123,
      text: 'Nice story',
      replies: [],
      time: new Date('2026-06-15T12:00:00Z').getTime() / 1000,
    });
  });

  it('lists the newest comment first', () => {
    store.add(1, 'Anna', 'first');
    store.add(1, 'Ben', 'second');
    expect(store.forItem(1).map((comment) => comment.text)).toEqual(['second', 'first']);
  });

  it('keeps comments for each story apart', () => {
    store.add(1, 'Anna', 'on one');
    store.add(2, 'Anna', 'on two');
    expect(store.forItem(1)).toHaveLength(1);
    expect(store.forItem(2)).toHaveLength(1);
    expect(store.forItem(3)).toEqual([]);
  });

  it('gives every comment its own negative id, so it cannot clash with a Hacker News id', () => {
    store.add(1, 'Anna', 'a');
    store.add(1, 'Anna', 'b');
    store.add(2, 'Anna', 'c');
    const ids = [...store.forItem(1), ...store.forItem(2)].map((comment) => comment.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids.every((id) => id < 0)).toBe(true);
  });

  describe("a comment inside its author's Delay", () => {
    const viewer = signal('');
    let held: NewCommentsStore;

    beforeEach(() => {
      vi.useFakeTimers();
      viewer.set('Anna');
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: AuthStore, useValue: { username: viewer } }],
      });
      held = TestBed.inject(NewCommentsStore);
      held.add(1, 'Anna', 'Held back', 30); // minutes
    });

    afterEach(() => vi.useRealTimers());

    it('is shown to its author straight away', () => {
      expect(held.forItem(1)).toHaveLength(1);
    });

    it.each(['', 'Ben'])('is hidden from the viewer "%s", who did not write it', (other) => {
      viewer.set(other);

      expect(held.forItem(1)).toEqual([]);
    });

    it('is shown to everyone once the Delay has passed, and not a moment before', () => {
      viewer.set('');

      vi.advanceTimersByTime(30 * 60 * 1000 - 1);
      expect(held.forItem(1)).toEqual([]);

      vi.advanceTimersByTime(1);
      expect(held.forItem(1)).toHaveLength(1);
    });

    it('goes on holding back a comment whose Delay is longer than a timer can wait', () => {
      held.add(2, 'Anna', 'For months', 100_000);
      viewer.set('');

      vi.advanceTimersByTime(60 * 60 * 1000);

      expect(held.forItem(2)).toEqual([]);
    });

    it('does not hold back a comment written with no Delay', () => {
      held.add(1, 'Anna', 'At once', 0);
      viewer.set('');

      expect(held.forItem(1).map((comment) => comment.text)).toEqual(['At once']);
    });
  });

  describe('turning text into comment HTML', () => {
    const textOfAddedComment = (text: string) => {
      store.add(1, 'Anna', text);
      return store.forItem(1)[0].text;
    };

    it('escapes HTML so it is shown as typed and cannot inject markup', () => {
      expect(textOfAddedComment('<script>alert("x")</script> & \'more\'')).toBe(
        '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;more&#39;',
      );
    });

    it('turns blank lines into paragraphs and single line breaks into <br>', () => {
      expect(textOfAddedComment('one\ntwo\n\nthree')).toBe('one<br>two<p>three');
    });

    it('trims the text', () => {
      expect(textOfAddedComment('  hello  \n')).toBe('hello');
    });
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pagination } from './pagination';

describe('Pagination', () => {
  let fixture: ComponentFixture<Pagination>;
  let emitted: number[];

  /** Shows the pagination for the given page, and waits for it to render. */
  async function render(page: number, totalPages: number, resetKey?: unknown) {
    fixture.componentRef.setInput('page', page);
    fixture.componentRef.setInput('totalPages', totalPages);
    fixture.componentRef.setInput('resetKey', resetKey);
    await fixture.whenStable();
  }

  const element = () => fixture.nativeElement as HTMLElement;
  const pageButtons = () => Array.from(element().querySelectorAll<HTMLButtonElement>('button.page'));
  const arrow = (label: string) =>
    element().querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`) as HTMLButtonElement;
  const goInput = () => element().querySelector<HTMLInputElement>('#go-to-page') as HTMLInputElement;
  const goButton = () =>
    element().querySelector<HTMLButtonElement>('form.go-to button[type="submit"]') as HTMLButtonElement;
  const goError = () => element().querySelector('.go-to-error')?.textContent?.trim();

  /** The page list as the user reads it, e.g. "1 … 3 4 5 … 25". */
  const visiblePages = () =>
    Array.from(element().querySelectorAll('ol.pages li'))
      .map((item) => item.textContent?.trim())
      .join(' ');

  async function typeIntoGoTo(value: string) {
    goInput().value = value;
    goInput().dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  async function submitGoTo() {
    element().querySelector('form.go-to')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
  }

  beforeEach(() => {
    fixture = TestBed.createComponent(Pagination);
    emitted = [];
    fixture.componentInstance.pageChange.subscribe((page) => emitted.push(page));
  });

  describe('the page list', () => {
    it('says which page it is on', async () => {
      await render(4, 25);
      expect(element().querySelector('.status')?.textContent).toBe('Page 4 of 25');
    });

    it('shows the first, last and neighbouring pages with gaps between', async () => {
      await render(4, 25);
      expect(visiblePages()).toBe('1 … 3 4 5 … 25');
    });

    it('has no gap at the start or the end of the range', async () => {
      await render(1, 25);
      expect(visiblePages()).toBe('1 2 … 25');
      await render(25, 25);
      expect(visiblePages()).toBe('1 … 24 25');
    });

    it('shows every page when there are only a few', async () => {
      await render(2, 3);
      expect(visiblePages()).toBe('1 2 3');
    });

    it('does not put a gap between pages that are next to each other', async () => {
      await render(3, 25);
      expect(visiblePages()).toBe('1 2 3 4 … 25');
    });

    it('works with a single page', async () => {
      await render(1, 1);
      expect(visiblePages()).toBe('1');
    });

    it('marks the current page for assistive technology', async () => {
      await render(4, 25);
      const current = pageButtons().filter((button) => button.getAttribute('aria-current') === 'page');
      expect(current.map((button) => button.textContent?.trim())).toEqual(['4']);
      expect(pageButtons()[0].getAttribute('aria-label')).toBe('Page 1');
    });
  });

  describe('moving between pages', () => {
    it('goes to a page when its number is clicked', async () => {
      await render(4, 25);
      pageButtons()[3].click();
      expect(emitted).toEqual([5]);
    });

    it('does nothing when the current page is clicked', async () => {
      await render(4, 25);
      pageButtons()[2].click();
      expect(emitted).toEqual([]);
    });

    it('goes one page back and forward with the arrows', async () => {
      await render(4, 25);
      arrow('Previous page').click();
      arrow('Next page').click();
      expect(emitted).toEqual([3, 5]);
    });

    it('disables Previous on the first page and Next on the last', async () => {
      await render(1, 25);
      expect(arrow('Previous page').disabled).toBe(true);
      expect(arrow('Next page').disabled).toBe(false);

      await render(25, 25);
      expect(arrow('Previous page').disabled).toBe(false);
      expect(arrow('Next page').disabled).toBe(true);
    });
  });

  describe('go to page', () => {
    it('jumps to the page that was typed, then clears the box', async () => {
      await render(1, 25);
      await typeIntoGoTo('12');
      expect(goButton().disabled).toBe(false);

      await submitGoTo();
      expect(emitted).toEqual([12]);
      expect(goInput().value).toBe('');
    });

    it('has Go disabled while the box is empty', async () => {
      await render(1, 25);
      expect(goButton().disabled).toBe(true);
    });

    it.each(['26', '999', '0', '-3', '2.5'])(
      'does not accept %s: it explains the limit and does not move',
      async (value) => {
        await render(1, 25);
        await typeIntoGoTo(value);

        expect(goButton().disabled).toBe(true);
        expect(goError()).toBe('Enter a page from 1 to 25');
        expect(goInput().getAttribute('aria-invalid')).toBe('true');

        await submitGoTo();
        expect(emitted).toEqual([]);
      },
    );

    it('accepts the first and the last page', async () => {
      await render(5, 25);
      await typeIntoGoTo('25');
      expect(goError()).toBeUndefined();
      await submitGoTo();
      expect(emitted).toEqual([25]);
    });

    it('follows the number of pages when it changes', async () => {
      await render(1, 25);
      await typeIntoGoTo('20');
      expect(goError()).toBeUndefined();

      await render(1, 10);
      expect(goError()).toBe('Enter a page from 1 to 10');
    });

    it('clears the box when the page changes', async () => {
      await render(1, 25);
      await typeIntoGoTo('12');
      await render(2, 25);
      expect(goInput().value).toBe('');
    });

    it('clears the box when the reset key changes, even on the same page', async () => {
      await render(1, 25, 'top');
      await typeIntoGoTo('12');
      await render(1, 25, 'new');
      expect(goInput().value).toBe('');
    });
  });
});

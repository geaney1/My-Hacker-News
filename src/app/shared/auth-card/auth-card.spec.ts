import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { StoriesStore } from '../../features/stories/stories.store';
import { AuthCard } from './auth-card';

@Component({
  imports: [AuthCard],
  template: `
    <app-auth-card heading="Log in" [modal]="modal" [closeLink]="closeLink">
      <input id="first-field" />
      <input id="second-field" />
    </app-auth-card>
  `,
})
class Host {
  modal = true;
  closeLink: string | undefined = undefined;
}

describe('AuthCard', () => {
  let fixture: ComponentFixture<Host>;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;
  let showModal: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // The test environment has no dialog support, so a small stand-in behaves like the real one.
    showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
    HTMLDialogElement.prototype.showModal = showModal as unknown as () => void;
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };

    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  async function render(options: { modal?: boolean; closeLink?: string } = {}) {
    fixture = TestBed.createComponent(Host);
    fixture.componentInstance.modal = options.modal ?? true;
    fixture.componentInstance.closeLink = options.closeLink;
    fixture.detectChanges();
    // Lets the "after first render" step run.
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }

  const page = () => fixture.nativeElement as HTMLElement;
  const dialog = () => page().querySelector('dialog') as HTMLDialogElement;
  const closeLink = () => page().querySelector<HTMLAnchorElement>('a.close') as HTMLAnchorElement;

  describe('as a modal dialog', () => {
    beforeEach(() => render());

    it('is a dialog, labelled by its title', () => {
      const heading = page().querySelector('h2') as HTMLElement;
      expect(dialog()).not.toBeNull();
      expect(heading.textContent).toBe('Log in');
      expect(dialog().getAttribute('aria-labelledby')).toBe(heading.id);
      expect(page().querySelector('section.auth-page')).toBeNull();
    });

    it('shows the projected content', () => {
      expect(dialog().querySelector('#first-field')).not.toBeNull();
      expect(dialog().querySelector('#second-field')).not.toBeNull();
    });

    it('is opened as a true modal in the browser, which makes the page behind it inert', () => {
      expect(showModal).toHaveBeenCalledTimes(1);
      expect(dialog().hasAttribute('open')).toBe(true);
    });

    it('puts focus on the first field, not on the close button', () => {
      expect(document.activeElement?.id).toBe('first-field');
    });

    it('closes back to the story list the user last had open', () => {
      expect(closeLink().getAttribute('href')).toBe('/top');
    });

    it('follows the list that was open when it is not the first one', async () => {
      TestBed.inject(StoriesStore).selectList('ask');
      fixture.detectChanges();
      expect(closeLink().getAttribute('href')).toBe('/ask');
    });

    it('goes back to that list when the dialog is closed, for example with Escape', () => {
      TestBed.inject(StoriesStore).selectList('show');
      dialog().dispatchEvent(new Event('close'));
      expect(navigateByUrl).toHaveBeenCalledWith('/show');
    });

    it('closes when the backdrop is clicked', () => {
      dialog().dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(dialog().hasAttribute('open')).toBe(false);
      expect(navigateByUrl).toHaveBeenCalledWith('/top');
    });

    it('stays open when the card itself is clicked', () => {
      page().querySelector('.auth-page')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(dialog().hasAttribute('open')).toBe(true);
      expect(navigateByUrl).not.toHaveBeenCalled();
    });
  });

  describe('as an ordinary card', () => {
    beforeEach(() => render({ modal: false, closeLink: '/user-profile' }));

    it('is a section in the page, not a dialog, and is not opened as a modal', () => {
      expect(page().querySelector('dialog')).toBeNull();
      const section = page().querySelector('section.auth-page') as HTMLElement;
      expect(section.getAttribute('aria-labelledby')).toBe((page().querySelector('h2') as HTMLElement).id);
      expect(showModal).not.toHaveBeenCalled();
    });

    it('closes to the address it was given', () => {
      expect(closeLink().getAttribute('href')).toBe('/user-profile');
    });

    it('shows the projected content', () => {
      expect(page().querySelector('#first-field')).not.toBeNull();
    });
  });

  it('gives each card its own heading id', async () => {
    await render();
    const first = (page().querySelector('h2') as HTMLElement).id;
    const second = TestBed.createComponent(Host);
    second.detectChanges();
    expect((second.nativeElement as HTMLElement).querySelector('h2')?.id).not.toBe(first);
  });
});

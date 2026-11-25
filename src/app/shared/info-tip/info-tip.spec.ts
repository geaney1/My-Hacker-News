import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InfoTip } from './info-tip';

@Component({
  imports: [InfoTip],
  template: `
    <label for="field">Max Visit</label>
    <app-info-tip label="Max Visit" text="How many minutes you can stay." tipId="field-info" />
    <input id="field" aria-describedby="field-info" />
  `,
})
class Host {}

@Component({
  imports: [InfoTip],
  template: `<app-info-tip label="Delay" text="Only used when **No Procrast** is yes, after **Max Visit** minutes." tipId="marked-info" />`,
})
class MarkedHost {}

describe('InfoTip', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  const page = () => fixture.nativeElement as HTMLElement;
  const button = () => page().querySelector<HTMLButtonElement>('button.info-button') as HTMLButtonElement;
  const text = () => page().querySelector<HTMLElement>('#field-info') as HTMLElement;

  async function press() {
    button().click();
    await fixture.whenStable();
  }

  it('is a button named for the field it explains', () => {
    expect(button().type).toBe('button');
    expect(button().getAttribute('aria-label')).toBe('About Max Visit');
    expect(button().getAttribute('aria-controls')).toBe('field-info');
  });

  it('starts closed: the explanation is hidden, and the button says so', () => {
    expect(button().getAttribute('aria-expanded')).toBe('false');
    expect(text().hidden).toBe(true);
  });

  it('shows the explanation when pressed, and hides it when pressed again', async () => {
    await press();
    expect(button().getAttribute('aria-expanded')).toBe('true');
    expect(text().hidden).toBe(false);
    expect(text().textContent?.trim()).toBe('How many minutes you can stay.');

    await press();
    expect(button().getAttribute('aria-expanded')).toBe('false');
    expect(text().hidden).toBe(true);
  });

  it('marks the name of a setting between double asterisks, and leaves the asterisks out', async () => {
    fixture.destroy();
    TestBed.resetTestingModule();
    const marked = TestBed.createComponent(MarkedHost);
    await marked.whenStable();

    const tip = marked.nativeElement.querySelector('.info-text') as HTMLElement;
    const names = Array.from(tip.querySelectorAll('.setting-name')).map((name) => name.textContent);
    expect(names).toEqual(['No Procrast', 'Max Visit']);
    // The words around the names stay, with the right spaces, and no asterisks are left.
    expect(tip.textContent).toBe('Only used when No Procrast is yes, after Max Visit minutes.');
    expect(tip.textContent).not.toContain('*');
  });

  it('shows plain text as plain text', () => {
    expect(text().querySelector('.setting-name')).toBeNull();
    expect(text().textContent).toBe('How many minutes you can stay.');
  });

  it('keeps the explanation in the page while closed, so the field can be described by it', () => {
    expect(page().querySelector('#field-info')).not.toBeNull();
    expect(page().querySelector('#field')?.getAttribute('aria-describedby')).toBe('field-info');
  });

  it('closes on Escape, and keeps that Escape from reaching a dialog around it', async () => {
    await press();
    const outer = vi.fn();
    page().addEventListener('keydown', outer);
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    button().dispatchEvent(escape);
    await fixture.whenStable();

    expect(text().hidden).toBe(true);
    expect(outer).not.toHaveBeenCalled();
    // The browser's own closing of a dialog on Escape is cancelled too.
    expect(escape.defaultPrevented).toBe(true);
  });

  it('leaves Escape alone when nothing is showing, so a dialog can still close', async () => {
    const outer = vi.fn();
    page().addEventListener('keydown', outer);
    button().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(outer).toHaveBeenCalledOnce();
  });
});

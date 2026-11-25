import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Banner, BannerKind } from './banner';

@Component({
  imports: [Banner],
  template: `
    <app-banner [kind]="kind()" [heading]="heading()" [compact]="compact()">
      Something to know.
      <button bannerAction type="button">Do it</button>
    </app-banner>
  `,
})
class Host {
  kind = signal<BannerKind>('warning');
  heading = signal<string | undefined>(undefined);
  compact = signal(false);
}

describe('Banner', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  async function show(change: { kind?: BannerKind; heading?: string; compact?: boolean }) {
    if (change.kind !== undefined) fixture.componentInstance.kind.set(change.kind);
    if (change.heading !== undefined) fixture.componentInstance.heading.set(change.heading);
    if (change.compact !== undefined) fixture.componentInstance.compact.set(change.compact);
    await fixture.whenStable();
  }

  const page = () => fixture.nativeElement as HTMLElement;
  const banner = () => page().querySelector('.banner') as HTMLElement;
  const host = () => page().querySelector('app-banner') as HTMLElement;

  it('shows its message, and an action put in it at the right', () => {
    expect(banner().querySelector('.text')?.textContent).toContain('Something to know.');
    expect(banner().querySelector('.action button')?.textContent).toBe('Do it');
    expect(banner().querySelector('.message button')).toBeNull();
  });

  it('has an icon that is hidden from screen readers', () => {
    expect(banner().querySelector('svg.icon')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('is announced politely when it is a warning or information', async () => {
    expect(banner().getAttribute('role')).toBe('status');
    await show({ kind: 'info' });
    expect(banner().getAttribute('role')).toBe('status');
  });

  it('is announced at once when it is an error', async () => {
    await show({ kind: 'error' });
    expect(banner().getAttribute('role')).toBe('alert');
  });

  it('says what kind it is, so it can be styled', async () => {
    expect(host().classList.contains('banner-warning')).toBe(true);
    await show({ kind: 'error' });
    expect(host().classList.contains('banner-error')).toBe(true);
    await show({ kind: 'info' });
    expect(host().classList.contains('banner-info')).toBe(true);
  });

  it('has a different icon for each kind', async () => {
    const icons = new Set<string>();
    for (const kind of ['warning', 'error', 'info'] as const) {
      await show({ kind });
      icons.add(banner().querySelector('svg.icon')?.innerHTML.replace(/\s+/g, '') ?? '');
    }
    expect(icons.size).toBe(3);
  });

  it('has a heading only when it is given one, and is named by it', async () => {
    expect(banner().querySelector('h2')).toBeNull();
    expect(banner().hasAttribute('aria-labelledby')).toBe(false);

    await show({ heading: 'Time for a break' });
    const heading = banner().querySelector('h2') as HTMLElement;
    expect(heading.textContent).toBe('Time for a break');
    expect(banner().getAttribute('aria-labelledby')).toBe(heading.id);
  });

  it('can be compact, for a dialog', async () => {
    expect(host().classList.contains('banner-compact')).toBe(false);
    await show({ compact: true });
    expect(host().classList.contains('banner-compact')).toBe(true);
  });
});

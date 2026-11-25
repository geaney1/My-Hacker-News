import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HnUser } from '../../../models/hn-user';
import { UserPage } from './user-page';

describe('UserPage', () => {
  let fixture: ComponentFixture<UserPage>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function open(id: string, answer: HnUser | null) {
    fixture = TestBed.createComponent(UserPage);
    fixture.componentRef.setInput('id', id);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));
    const request = http.expectOne(`/api/users/${id}`);
    if (answer) {
      request.flush(answer);
    } else {
      request.flush({ message: 'User not found' }, { status: 404, statusText: 'Not Found' });
    }
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }

  const page = () => fixture.nativeElement as HTMLElement;
  const text = () => page().textContent?.replace(/\s+/g, ' ') ?? '';

  it('shows a Hacker News user, with no link out to Hacker News', async () => {
    await open('pg', { id: 'pg', created: 1160418111, karma: 157316, submitted: [1, 2] });
    expect(text()).toContain('Karma157316');
    expect(text()).toContain('Submissions2');
    expect(page().querySelector('a[href*="ycombinator"]')).toBeNull();
    expect(text()).not.toContain('View on Hacker News');
  });

  it('shows a user of this app', async () => {
    await open('Billy', { id: 'Billy', created: 1_700_000_000, karma: 0, submitted: [2_000_000_001], local: true });
    expect(page().querySelector('h2')?.textContent).toBe('Billy');
    expect(text()).toContain('Submissions1');
    expect(page().querySelector('a[href*="ycombinator"]')).toBeNull();
    expect(text()).not.toContain('was found');
  });

  it('leaves out when the account was made if that is not known', async () => {
    await open('Old', { id: 'Old', created: 0, karma: 0, submitted: [], local: true });
    expect(page().querySelector('dt')?.textContent).not.toBe('Created');
    expect(text()).not.toContain('Created');
  });

  it('only says no user was found when neither Hacker News nor this app has them', async () => {
    await open('nobody', null);
    expect(page().querySelector('[role="alert"]')?.textContent).toContain('No user named nobody was found.');
  });
});

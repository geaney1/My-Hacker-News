import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HnApi } from './hn-api';

describe('HnApi', () => {
  let api: HnApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(HnApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('getUpdates', () => {
    it('returns the changed items and profiles', async () => {
      const result = api.getUpdates();
      http.expectOne('/api/updates').flush({ items: [1, 2], profiles: ['anna'] });
      expect(await result).toEqual({ items: [1, 2], profiles: ['anna'] });
    });
  });

  describe('getUser', () => {
    it('returns the user', async () => {
      const result = api.getUser('anna');
      http.expectOne('/api/users/anna').flush({ id: 'anna', karma: 5 });
      expect(await result).toMatchObject({ id: 'anna' });
    });

    it('returns null, not an error, when the user does not exist, and encodes the name', async () => {
      const result = api.getUser('a b');
      http.expectOne('/api/users/a%20b').flush({}, { status: 404, statusText: 'Not Found' });
      expect(await result).toBeNull();
    });

    it('still reports other failures as errors', async () => {
      const result = api.getUser('anna');
      http.expectOne('/api/users/anna').flush({}, { status: 502, statusText: 'Bad Gateway' });
      await expect(result).rejects.toBeTruthy();
    });
  });

  describe('getThread', () => {
    it('returns the thread, or null when the item does not exist', async () => {
      const found = api.getThread(1);
      http.expectOne('/api/items/1/thread').flush({ item: { id: 1 }, comments: [], pollOptions: [], truncated: false });
      expect(await found).toMatchObject({ item: { id: 1 } });

      const missing = api.getThread(2);
      http.expectOne('/api/items/2/thread').flush({}, { status: 404, statusText: 'Not Found' });
      expect(await missing).toBeNull();
    });
  });
});

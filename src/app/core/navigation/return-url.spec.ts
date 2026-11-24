import { safeReturnUrl } from './return-url';

describe('safeReturnUrl', () => {
  it.each(['/top', '/new?x=1', '/item/8863', '/user-profile', '/change-password', '/welcome'])(
    'accepts the address %s inside the app',
    (url) => {
      expect(safeReturnUrl(url)).toBe(url);
    },
  );

  it.each([undefined, null, ''])('has nothing to return to for %j', (url) => {
    expect(safeReturnUrl(url)).toBeUndefined();
  });

  it.each([
    'https://evil.example/steal',
    'http://evil.example',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
    'top',
  ])('refuses the address %s, which could lead outside the app', (url) => {
    expect(safeReturnUrl(url)).toBeUndefined();
  });

  it.each(['/log-in', '/log-in?returnUrl=%2Ftop', '/create-user'])(
    'never returns to %s, or the user would be sent back to the form they just used',
    (url) => {
      expect(safeReturnUrl(url)).toBeUndefined();
    },
  );
});

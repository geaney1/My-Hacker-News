import { isWebAddress, maxTitleLength, maxUrlLength } from './submit-rules';

describe('isWebAddress', () => {
  it.each([
    'https://example.com',
    'http://example.com',
    'https://example.com/a/b?c=d&e=f#g',
    'https://sub.example.co.uk:8080/path',
    'http://localhost:4200/top',
    'http://192.168.0.1/x',
    '  https://example.com  ',
    'HTTPS://EXAMPLE.COM',
  ])('accepts %j', (value) => {
    expect(isWebAddress(value)).toBe(true);
  });

  it.each([
    '',
    '   ',
    'example.com',
    'www.example.com/page',
    'ftp://example.com',
    'javascript:alert(1)',
    'data:text/html,<b>hi</b>',
    'file:///etc/passwd',
    'mailto:a@b.com',
    'http://',
    'https://',
    '//example.com',
    'not a url',
    'http:// example.com',
  ])('refuses %j', (value) => {
    expect(isWebAddress(value)).toBe(false);
  });
});

describe('limits', () => {
  it('uses the 80 character title limit', () => {
    expect(maxTitleLength).toBe(80);
  });

  it('has a sensible limit for the link', () => {
    expect(maxUrlLength).toBeGreaterThanOrEqual(2000);
  });
});

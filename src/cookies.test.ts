import { readCookie } from './cookies';

describe('readCookie', () => {
  it('finds a cookie among several', () => {
    expect(readCookie('a=1; hn_session=abc123; b=2', 'hn_session')).toBe('abc123');
  });

  it('finds the first and the last cookie', () => {
    expect(readCookie('first=1; second=2', 'first')).toBe('1');
    expect(readCookie('first=1; second=2', 'second')).toBe('2');
  });

  it('decodes encoded values', () => {
    expect(readCookie('x=a%20b', 'x')).toBe('a b');
  });

  it('keeps an equals sign inside a value', () => {
    expect(readCookie('x=a=b', 'x')).toBe('a=b');
  });

  it('returns undefined for a missing cookie or a missing header', () => {
    expect(readCookie('a=1', 'hn_session')).toBeUndefined();
    expect(readCookie(undefined, 'hn_session')).toBeUndefined();
    expect(readCookie('', 'hn_session')).toBeUndefined();
  });

  it('does not match a cookie whose name only ends the same way', () => {
    expect(readCookie('not_hn_session=1', 'hn_session')).toBeUndefined();
  });
});

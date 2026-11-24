import { TimeAgoPipe } from './time-ago.pipe';

describe('TimeAgoPipe', () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const nowInSeconds = now.getTime() / 1000;
  const pipe = new TimeAgoPipe();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** A Unix timestamp the given number of seconds before "now". */
  const ago = (seconds: number) => nowInSeconds - seconds;

  it('is empty when there is no time', () => {
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform(0)).toBe('');
  });

  it('says "just now" for under a minute, and for a time in the future', () => {
    expect(pipe.transform(ago(0))).toBe('just now');
    expect(pipe.transform(ago(59))).toBe('just now');
    expect(pipe.transform(ago(-300))).toBe('just now');
  });

  it.each([
    [60, '1m ago'],
    [59 * 60, '59m ago'],
    [3_600, '1h ago'],
    [23 * 3_600, '23h ago'],
    [86_400, '1d ago'],
    [29 * 86_400, '29d ago'],
    [30 * 86_400, '1mo ago'],
    [364 * 86_400, '12mo ago'],
    [365 * 86_400, '1y ago'],
    [3 * 365 * 86_400, '3y ago'],
  ])('formats %i seconds ago as %s', (seconds, expected) => {
    expect(pipe.transform(ago(seconds))).toBe(expected);
  });

  it('rounds down to the largest whole unit', () => {
    expect(pipe.transform(ago(90))).toBe('1m ago');
    expect(pipe.transform(ago(2 * 3_600 + 3_599))).toBe('2h ago');
  });
});

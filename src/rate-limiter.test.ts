import { createRateLimiter } from './rate-limiter';

describe('createRateLimiter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('never refuses when RATE_LIMITS is off, which only the end-to-end tests use', () => {
    vi.stubEnv('RATE_LIMITS', 'off');
    try {
      const limiter = createRateLimiter({ maxAttempts: 1, windowMilliseconds: 60_000 });
      expect([1, 2, 3].map(() => limiter.isLimited('a'))).toEqual([false, false, false]);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('allows attempts up to the limit, then refuses', () => {
    const limiter = createRateLimiter({ maxAttempts: 3, windowMilliseconds: 60_000 });
    expect([1, 2, 3, 4, 5].map(() => limiter.isLimited('a'))).toEqual([
      false,
      false,
      false,
      true,
      true,
    ]);
  });

  it('counts each key on its own', () => {
    const limiter = createRateLimiter({ maxAttempts: 1, windowMilliseconds: 60_000 });
    expect(limiter.isLimited('a')).toBe(false);
    expect(limiter.isLimited('a')).toBe(true);
    expect(limiter.isLimited('b')).toBe(false);
  });

  it('starts counting again when the window has passed', () => {
    vi.useFakeTimers();
    const limiter = createRateLimiter({ maxAttempts: 1, windowMilliseconds: 60_000 });
    limiter.isLimited('a');
    expect(limiter.isLimited('a')).toBe(true);

    vi.advanceTimersByTime(60_001);
    expect(limiter.isLimited('a')).toBe(false);
  });

  it('does not restart the window on every attempt, so steady attempts cannot stay under the limit', () => {
    vi.useFakeTimers();
    const limiter = createRateLimiter({ maxAttempts: 2, windowMilliseconds: 60_000 });
    limiter.isLimited('a');
    vi.advanceTimersByTime(30_000);
    limiter.isLimited('a');
    vi.advanceTimersByTime(20_000);
    expect(limiter.isLimited('a')).toBe(true);
  });

  it('forgets everything on reset', () => {
    const limiter = createRateLimiter({ maxAttempts: 1, windowMilliseconds: 60_000 });
    limiter.isLimited('a');
    limiter.reset();
    expect(limiter.isLimited('a')).toBe(false);
  });

  it('keeps separate limiters apart', () => {
    const first = createRateLimiter({ maxAttempts: 1, windowMilliseconds: 60_000 });
    const second = createRateLimiter({ maxAttempts: 1, windowMilliseconds: 60_000 });
    first.isLimited('a');
    expect(first.isLimited('a')).toBe(true);
    expect(second.isLimited('a')).toBe(false);
  });

  it('forgets finished windows when it is tracking a very large number of keys', () => {
    vi.useFakeTimers();
    const limiter = createRateLimiter({ maxAttempts: 1, windowMilliseconds: 1000 });
    for (let index = 0; index < 5001; index++) {
      limiter.isLimited(`key-${index}`);
    }
    vi.advanceTimersByTime(2000);
    // The next attempt triggers the clean-up. Old keys behave as new ones.
    expect(limiter.isLimited('key-0')).toBe(false);
    expect(limiter.isLimited('fresh-key')).toBe(false);
  });
});

type RateLimiterOptions = {
  /** How many attempts are allowed in each window. */
  maxAttempts: number;
  windowMilliseconds: number;
};

/** The most keys remembered at once. When it is passed, finished windows are forgotten. */
const maxKeys = 5000;

/**
 * Counts attempts per key (an address, a user name) in fixed windows, to slow down guessing and
 * flooding. The counts live in memory, so they start again when the server restarts.
 */
export function createRateLimiter({ maxAttempts, windowMilliseconds }: RateLimiterOptions) {
  // For the end-to-end tests only, which create far more users than a person would.
  const off = process.env['RATE_LIMITS'] === 'off';
  const attempts = new Map<string, { count: number; resetAt: number }>();

  return {
    /** Counts one attempt for `key`. Resolves to `true` when `key` has gone over its limit. */
    isLimited(key: string) {
      if (off) {
        return false;
      }
      const now = Date.now();
      let entry = attempts.get(key);
      if (!entry || entry.resetAt <= now) {
        entry = { count: 0, resetAt: now + windowMilliseconds };
        attempts.set(key, entry);
      }
      entry.count++;

      if (attempts.size > maxKeys) {
        for (const [otherKey, other] of attempts) {
          if (other.resetAt <= now) {
            attempts.delete(otherKey);
          }
        }
      }
      return entry.count > maxAttempts;
    },

    /** Forgets every count. Only used by the tests. */
    reset() {
      attempts.clear();
    },
  };
}

export type RateLimiterOptions = {
  /** How many attempts are allowed in each window. */
  maxAttempts: number;
  windowMilliseconds: number;
};

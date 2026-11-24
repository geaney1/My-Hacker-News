/**
 * Tests for the Node server code in `src/*.ts` (accounts, sessions, routes and the Hacker News
 * proxies). They run in Node, apart from the Angular tests, which `ng test` runs in a browser-like
 * environment. Like the Angular specs, they use the global `describe`, `it` and `expect`.
 */
export default {
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
};

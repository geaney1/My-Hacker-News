# HackerNews

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.2.6.

## Prerequisites

Use Node.js 26.13.1 with npm 11.20.0:

```bash
nvm use
node --version
npm --version
```

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Server-side rendering (SSR) server

To build the project and start the server-side rendered app in one step, run:

```bash
npm run start:ssr
```

Once the server is running, open your browser and navigate to `http://localhost:4000/`. Unlike the development server, this does not reload on changes, so run the command again after modifying source files.

If you have already built the project, you can start the SSR server without rebuilding:

```bash
npm run serve:ssr:hacker-news
```

## How the app uses the Hacker News API

The browser never calls Hacker News directly. It calls the app's own Express server (`src/server.ts`), which fetches from the [official API](https://github.com/HackerNews/API), caches the answers for a short time so users share the requests, and returns a page of stories in one call instead of one request per story.

| Hacker News endpoint | Used for |
|---|---|
| `topstories`, `newstories`, `beststories`, `askstories`, `showstories`, `jobstories` | The story lists (up to 500 stories, or 200 for ask, show and jobs) |
| `item/<id>` | The stories on a page, and a story with its comment tree and poll options |
| `user/<id>` | User profiles |
| `updates` | The "stories have been updated" notice on the stories page, checked once a minute |

### `maxitem` is deliberately not used

`maxitem` returns the id of the newest item, so that a client can count down from it to discover items. The app does not need that:

- The newest stories are already available from `newstories` (up to 500, top-level stories only, newest first). That is exactly the list you would get by walking backwards from `maxitem`, in one request instead of hundreds.
- Most ids belong to comments and poll options, which the app never shows on their own, so walking ids would mean many requests for very little.
- Live changes are covered by `updates`.

If a later feature needs "N new items since you opened the page", `maxitem` is the endpoint to add.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

There are two test suites, both run with the [Vitest](https://vitest.dev/) test runner:

```bash
ng test              # the Angular app: components, stores, forms (src/**/*.spec.ts)
npm run test:server  # the Node server: accounts, sessions, routes, proxies (src/*.test.ts)
npm run test:all     # both, one after the other
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

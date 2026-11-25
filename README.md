# HackerNews

A reader for [Hacker News](https://news.ycombinator.com), built with Angular 22 (signals, zoneless, server-side rendering) and a small Express server. You can read the story lists, stories and their comments, and user pages. When you log in you can also submit stories, write comments, and keep a profile with settings.

**The client is designed for both desktop and mobile devices.** It is responsive, from a wide desktop screen down to a small phone (320 px wide), and it works with a mouse, a touch screen and a keyboard. See [Desktop and mobile](#desktop-and-mobile).

It uses Angular 22.3 and TypeScript 6.0 (the newest TypeScript that Angular 22 supports). It was generated with [Angular CLI](https://github.com/angular/angular-cli) version 22.2.6.

**Contents**

1. [What is real and what is simulated](#what-is-real-and-what-is-simulated)
2. [How the project works](#how-the-project-works)
3. [How the project is structured, and why](#how-the-project-is-structured-and-why)
4. [Getting started](#getting-started)
5. [How the app uses the Hacker News API](#how-the-app-uses-the-hacker-news-api)
6. [Accounts, sessions and profile settings](#accounts-sessions-and-profile-settings)
7. [Running it in production](#running-it-in-production)
8. [Desktop and mobile](#desktop-and-mobile)
9. [Accessibility](#accessibility)
10. [Themes](#themes)
11. [Tests](#tests)

## What is real and what is simulated

**Hacker News's API is read-only.** It can only be used to *get* stories, comments, users and lists. It has no way to log in, post a story, write a comment, vote, or change a profile. The only way to do those things on Hacker News itself would be to hold a user's Hacker News password and drive the website, which this app does not do and never will. The app never sees a Hacker News password.

So the app is split in two:

| Part | Is it real? | Where it comes from |
| --- | --- | --- |
| Story lists (Top, New, Best, Ask, Show, Jobs), stories, comments, polls, public user pages, "what changed" updates | **Real** | Read live from Hacker News, through this app's own server |
| The welcome page | **A stored copy** | A copy of the Hacker News welcome page, written into `src/app/features/welcome/welcome.html`. It is not fetched, so it changes only when someone edits that file. Its three links open in a new tab: "Hacker News" goes to this app's Top page, and the other two to the same addresses as on Hacker News |
| Accounts, log-in, log-out, change password | **Simulated: belongs to this app only** | Saved on this app's server. They are *not* Hacker News accounts |
| Submitting a story or a question | **Simulated** | Saved on this app's server (`data/submissions.json`). Never sent to Hacker News |
| Writing a comment on a story that was submitted *in this app* | **Simulated** | Saved on this app's server (`data/comments.json`) |
| Writing a comment on a *Hacker News* story | **Simulated, and temporary** | Kept only in the browser's memory until the page is reloaded. It is not posted to Hacker News, and not saved on this app's server |
| Profile and its settings (About, email, Show Dead, No Procrast, Max Visit, Min Away, Delay) | **Simulated** | Saved per account on this app's server (`data/profiles.json`) |

Why simulate them? Because the features are part of what a Hacker News reader should demonstrate (forms, validation, sessions, settings that change how the app behaves), and the real API gives no way to do them. Simulating them on the app's own server keeps the whole flow working end to end, without pretending to write to Hacker News.

How the simulated parts show up:

- **Submitted stories** appear in this app only: stories in **New** and questions (a submission with no link) in **Ask**. They are placed among the Hacker News stories by when they were made. **New** is in time order, so a story submitted an hour ago sits among the Hacker News stories from an hour ago. **Ask** is ranked by Hacker News, so a question goes before the first Hacker News question that is older than it. Each has its own story page. Their ids start at 2,000,000,001, far above any Hacker News id, so they can never clash. Comments written in this app start at 3,000,000,001.
- **A comment on a Hacker News story** is given a negative id in the browser's memory, so it can never clash with a real one.
- **The settings really do something.** See [Profile settings](#profile-settings).

## How the project works

```
Browser (Angular app)  ──/api/...──▶  Express server (src/server.ts)  ──▶  Hacker News API (read-only)
        ▲                                      │
        │                                      └──▶  JSON files in data/  (accounts, sessions, profiles, stories, comments)
        └──── server-rendered first page (SSR) ◀──┘
```

- **The browser never calls Hacker News directly.** It calls the app's own server (every address starts with `/api`). The server fetches from the official API, keeps the answers for a short time so all users share the requests, and returns a whole page of stories in one call instead of one request per story.
- **The same server renders the first page** (server-side rendering), so the page is complete when it arrives and then the browser takes over. The server passes the user's cookie on to its own API calls while rendering, so a logged-in user sees their own settings (for example Show Dead) even on a page they open directly.
- **Everything the server saves is in JSON files** in the `data/` folder, written safely (to a temporary file that is then renamed) and one write at a time. This suits one small server. See [What a production version would add](#what-a-production-version-would-add).
- **The Angular app is signal-based and zoneless.** State lives in root-provided stores (signals, `computed`, `linkedSignal`, `resource`), forms are Signal Forms, async code uses promises, services are declared with `@Service()`, and every component has external templates and styles. Change detection is `OnPush`, the default in Angular 22, so it is not written out.

## How the project is structured, and why

```
src/
  server.ts, *-routes.ts, *-store.ts, *-proxy.ts   The Express server (Node)
  app/                                              The Angular app (browser and server rendering)
    core/        App-wide services and stores: api/, auth/, profile/, theme/, comments/, navigation/
    features/    One folder per part of the app: dashboard, stories, item, user, user-profile,
                 submit, auth, change-password, welcome
    shared/      Small components and styles used by several features: banner, auth-card,
                 form-text-field, form-text-area, info-tip, pagination
    models/      Types only, one per file
e2e/             End-to-end tests (Playwright) and a fake Hacker News
data/            The JSON files the server saves (not committed)
```

The structure follows a few rules, each for a reason:

- **Feature folders (`features/`).** Everything for one part of the app (component, template, styles, tests, and its own store) sits together, so a change to one feature touches one folder. Routes load features lazily, so a visitor only downloads the part they open.
- **`core/` for what the whole app needs once.** Stores that exist once per app (who is logged in, the saved profile, the theme, the No Procrast timer) and the API classes that talk to the server live here, away from any one screen. Components never call `HttpClient` themselves: they ask a store or an API class. This keeps requests in one place, and makes them easy to fake in tests.
- **`shared/` for reuse.** A component used by more than one feature (the banner, the dialog card, the form field, the info tip, the paging bar) lives here once, so the look and the accessibility behaviour are the same everywhere and are fixed in one place.
- **`models/`: types in their own files.** One type per file, so they are easy to find and can be shared between the app and its tests.
- **One theme file.** All colours, spacing and shapes are tokens in `src/styles.scss`. The dark theme is a second set of the same tokens, so a component never needs to know which theme is on, and the look can be changed in one place.
- **Server code is split by job, not in one big file.** `*-routes.ts` handles the requests, `*-store.ts` keeps the data, `*-proxy.ts` talks to Hacker News, and small helpers (`rate-limiter.ts`, `json-store.ts`, `security.ts`, `cookies.ts`) do one thing each. Most of these files have a test of the same name beside them; a few small ones are tested through the files that use them, and `server.ts` only by the end-to-end tests. The split keeps each piece small enough to understand and test alone.
- **Tests sit beside the code they test** (`*.spec.ts` for the app, `*.test.ts` for the server). The end-to-end tests are separate because they run the whole built app in a real browser.
- **The server is the authority.** The browser checks forms to help the user, but the server checks everything again (the length of a title, a valid link, who owns a profile, rate limits). Anything that matters is decided on the server, not in the browser.

## Getting started

### Prerequisites

Use Node.js 26.13.1 with npm 11.20.0:

```bash
nvm use
node --version
npm --version
```

Then install the packages with `npm install`.

### Development server

```bash
ng serve
```

Open `http://localhost:4200/`. The app reloads whenever you change a source file. The development server also runs the app's own API, so accounts, submissions, comments and profiles work here too.

### Server-side rendering (SSR) server

To build the project and start the server-side rendered app in one step:

```bash
npm run start:ssr
```

Open `http://localhost:4000/`. Unlike the development server, this does not reload on changes, so run the command again after changing source files. This is the server to run in production: it sends the security headers. If you have already built the project, start the server without rebuilding:

```bash
npm run serve:ssr:hacker-news
```

### Building

```bash
ng build
```

The build is stored in `dist/`. By default the production build is optimised for speed and size.

### Code scaffolding

```bash
ng generate component component-name
ng generate --help      # the other schematics: directives, pipes, and so on
```

## How the app uses the Hacker News API

| Hacker News endpoint | Used for |
|---|---|
| `topstories`, `newstories`, `beststories`, `askstories`, `showstories`, `jobstories` | The story lists (up to 500 stories, or 200 for ask, show and jobs) |
| `item/<id>` | The stories on a page of a list, and a story with its comments and poll options (`/api/items/<id>/thread`, up to 200 comments) |
| `user/<id>` | User profiles. When Hacker News has no such user, the accounts of this app are checked (username, when the account was made, and what they submitted; never the password), so authors of submitted stories have a profile page |
| `updates` | The "stories have been updated" notice on the stories page, checked once a minute |

### `maxitem` is deliberately not used

`maxitem` returns the id of the newest item, so that a client can count down from it to discover items. The app does not need that:

- The newest stories are already available from `newstories` (up to 500, top-level stories only, newest first). That is exactly the list you would get by walking backwards from `maxitem`, in one request instead of hundreds.
- Most ids belong to comments and poll options, which the app does not show, so walking ids would mean many requests for very little.
- Live changes are covered by `updates`.

If a later feature needs "N new items since you opened the page", `maxitem` is the endpoint to add.

## Accounts, sessions and profile settings

Reading Hacker News needs no account. An account is only for the parts that belong to a person: the Submit dialog and the Welcome page, writing comments, changing a password, and the profile settings. These accounts belong to this app only. The Hacker News API has no login, so they are not Hacker News accounts.

### Submitting and commenting

- **Submit** opens a dialog: a title of up to 80 characters (required), a link starting with `http://` or `https://`, and text. Leave the link blank to submit a **question** for discussion (with a link it is a **story**; the server records which as `kind`). A question needs text, which appears at the top of the thread. With a link, the text is optional.
- Submitting saves the story on this app's server (`POST /api/submissions`). The server checks it again, for logged-in users only, at most 10 a minute per address.
- A story's title opens its article. A story without one (such as an Ask HN) opens its page here. Its comments are read from Hacker News and shown on that page.
- A logged-in user can add a comment there (`POST /api/items/<id>/comments`, at most 20 a minute per address). On a story submitted in this app it is saved on the server and shown, with the others, whenever the story is opened. On a Hacker News story it is only kept in the browser's memory until the page is reloaded, and is not posted to Hacker News or saved on this app's server.

### Profile settings

The profile (about, email and preferences) is saved per account on this app's server (`GET` and `PUT /api/profile`), so it is there the next time the profile is opened. The settings do something:

| Setting | What it does |
| --- | --- |
| **About** | Shown on the user's public page. |
| **Email** | Private: never shown to anyone. |
| **Show Dead** | Includes dead stories and comments (marked [dead]). The server checks the saved profile. |
| **No Procrast**, **Max Visit**, **Min Away** | With No Procrast on, the user is shut out for Min Away minutes once a visit has lasted Max Visit minutes. Max Visit and Min Away are turned off while No Procrast is no. The times are kept per user in this browser, so this is a self-imposed limit, not one the server enforces. |
| **Delay** | Hides the user's comments on stories submitted here from everyone else for that many seconds. The user sees their own at once. 0 means no delay. |

Each setting has an "i" button beside its label that explains it. One explanation shows at a time, and it hides when you press the button again, press Escape, or click elsewhere.

### How accounts and sessions work

Accounts use the traditional model that Hacker News itself uses:

1. **Username and password.** Creating a user and logging in send the credentials to the app's server. Passwords are never stored: each is turned into a salted `scrypt` hash, and only the hash is kept (`data/users.json`).
2. **A session cookie.** A successful log-in makes the server create a session and send a cookie called `hn_session`. The browser sends it back automatically. The cookie holds only a random session ID, nothing about the user, and it is `HttpOnly` (scripts cannot read it) and `SameSite=Lax`.
3. **Server-side validation.** On each request the server looks the ID up in its own session store (`data/sessions.json`, which keeps a hash of the ID, never the ID) to find out who the user is. A session lasts 14 days from its last use.
4. **Log out.** Logging out deletes the session on the server and removes the cookie. Because the server is what decides, a copied cookie stops working at once.

Also: every log-in gets a brand new session ID (so an ID planted beforehand is useless), changing a password ends every session of that account and gives the current browser a new one, attempts to create a user, log in or change a password are limited to 10 a minute per address (counted together), and the server only accepts JSON for changes. The code is in `src/auth-routes.ts`, `src/sessions-store.ts` and `src/accounts-store.ts`.

## Running it in production

Build it and run the server (`npm run start:ssr`). These settings are read from the environment:

| Setting | What it does |
| --- | --- |
| `PORT` | The port to listen on (default 4000). |
| `DATA_DIR` | Where accounts, sessions, stories, comments, profiles and id counters are kept (default `./data`). |
| `TRUST_PROXY` | Set it when the server is behind a proxy that ends HTTPS (a load balancer, nginx): the number of proxies in front of it (`1`) or an address list (`loopback`). Without it Express sees plain HTTP from the proxy's address, so the session cookie is not marked `Secure` and the rate limits count every visitor as the proxy. Avoid `true`, which trusts any `X-Forwarded-For` a client sends. |
| `HN_API_URL` | Where Hacker News's API is (for tests; defaults to the real one). |
| `RATE_LIMITS` | `off` switches the rate limits off. Only the end-to-end tests use it. |

The running server sends security headers on every response (through `helmet`) and a Content Security Policy that lets the page run only its own scripts and styles, plus the few inline ones Angular's server rendering writes, which get a new random nonce on each request. It also blocks framing, content-type sniffing and plugins, and only allows requests to its own server. The dev server (`ng serve`) does not send them, because it needs inline scripts and a websocket that the policy would block.

Stories and comments get their ids from counters kept in `counters.json`, so an id is never used twice, even if a story or comment is later removed.

### What a production version would add

Accounts and sessions are kept in JSON files, which suits one small server. With several servers or many users they would move to a database, and the rate limits to shared storage. Email verification and a password reset are not built.

## Desktop and mobile

The app is designed for desktop and mobile devices alike, with one layout that adapts to the screen instead of a separate mobile site:

- **Desktop and wide screens.** The story-list menu (Top, New, Best, Ask, Show and Jobs, plus Submit and Welcome when logged in) is always shown on the left, and the stories flow into as many columns as fit. The paging bar shows the numbered pages between the previous and next arrows. The welcome page is a single column across the same width as the stories page.
- **Tablets and phones (narrower than 768 px).** The menu becomes a drawer opened by a hamburger button. It closes when you choose a list, press Escape, or tap outside it. The space around the page is reduced.
- **Phones (narrower than 512 px).** The header stays on one line. The stories stack one under the other, and the search and the minimum score sit one under the other at full width. The paging bar is pinned to the bottom edge of the screen, with "Page 1 of N", the arrows and the box to go to a page on one line. Dialogs fill nearly the whole screen and scroll inside themselves, and the profile's buttons stay at the bottom while the settings scroll.
- **Down to 320 px.** The page never scrolls sideways (WCAG reflow). Buttons and form controls are at least 24 by 24 pixels, and the smaller text links have enough space round them to be pressed with a finger (WCAG 2.5.8).
- **Any input.** Everything works by mouse, touch or keyboard. Hover effects are extras and nothing depends on them, and the growing on hover is switched off for people who ask their device to reduce motion.

The end-to-end tests check the desktop layout and the phone layout (390 px wide), and the reflow at 320 px.

## Accessibility

The aim is WCAG 2.2 level AA. In practice:

- **Keyboard.** Everything can be used with the keyboard. A "Skip to main content" link is the first Tab stop. Dialogs keep the focus inside, Escape closes them, and closing puts the focus back where it came from. Focus is always visible and is never hidden behind the profile's buttons on a phone.
- **Screen readers.** Pages are announced by title after each navigation. Fields have labels, hints and errors that are read out. Errors are announced at once, and other notices politely. Links that open in a new tab say so.
- **Forms never hide a button.** The Submit, Log in, Create account, Change password and Update buttons are never turned off because a form is incomplete (Update waits only while the profile is still loading). Pressing one with the form incomplete shows each problem and moves the focus to the first field to fix, so nobody is left with a button that does nothing and no word about why.
- **Contrast and size.** Text is at least 4.5:1, and icons and field borders at least 3:1. Controls are at least 24 by 24 pixels, or, for small text links, spaced far enough apart. The page does not scroll sideways at 320 px wide.
- **Notices.** Warnings, errors and messages about a whole page or form use a shared `Banner` component with an icon, an accessible role, and a colour that stands out from the page in both themes. A problem with a single field is shown beside that field.

These are checked by tests (axe, plus measurements of contrast, size, focus and spacing) on both themes. They cannot replace trying the app with a real screen reader, which is worth doing before a release.

## Themes

The app has a light and a dark theme. The profile has a button to switch between them; the change is immediate and is remembered in this browser (`localStorage`). With nothing chosen, the app follows what the device prefers (`prefers-color-scheme`). A small script in `index.html` sets the theme before the page is painted, so a dark page never flashes white; it is covered by the Content Security Policy nonce like the other inline scripts.

All colours are tokens in `src/styles.scss`. The dark theme is a second set of the same tokens under `:root[data-theme='dark']`. The end-to-end accessibility checks (WCAG A and AA with axe, text contrast on hover, and 3:1 borders on form fields) run on both themes.

## Tests

### Unit tests

There are two suites, both run with the [Vitest](https://vitest.dev/) test runner:

```bash
ng test              # the Angular app: components, stores, forms (src/**/*.spec.ts)
npm run test:server  # the Node server: accounts, sessions, routes, proxies (src/*.test.ts)
npm run test:all     # both, one after the other
```

### Test coverage

Coverage is measured with V8 (`@vitest/coverage-v8`) for both unit suites. Each prints a table in the terminal and writes an HTML report you can open in a browser:

```bash
npm run test:coverage         # the Angular app; report in coverage/hacker-news/
npm run test:server:coverage  # the Node server; report in coverage/server/
```

At the last measurement:

| Suite | Statements | Branches | Functions | Lines |
| --- | --- | --- | --- | --- |
| Angular app | 90.4% | 88.7% | 86.7% | 92.9% |
| Node server | 86.0% | 85.9% | 95.0% | 85.5% |

The server figure is pulled down by one file that the unit tests do not load: `server.ts` (the Express wiring). The end-to-end tests run it, but Playwright does not measure code coverage, so it is not counted in these numbers. The weakest app areas are the dashboard and the story page, which are mostly exercised by the end-to-end tests.

### End-to-end tests

The end-to-end tests drive a real browser (Playwright) against the built app. They cover reading the lists, accounts, submitting, comments, the profile and its settings, accessibility, and the phone layout.

```bash
npm run e2e        # builds the app, then runs the tests
npm run e2e:run    # runs them against the last build
```

They use the Microsoft Edge that is installed on the machine (set `E2E_BROWSER=chrome` for Chrome). **Hacker News is replaced by a small fake** (`e2e/fake-hn.mjs`, selected with the `HN_API_URL` setting), so the tests need no network and always see the same stories. The app's server runs on port 4901 with an empty data folder (`e2e/.data`, thrown away each run) and with the rate limits switched off (`RATE_LIMITS=off`, which is only for these tests).

## Additional resources

For more about the Angular CLI, including detailed command references, see the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli).

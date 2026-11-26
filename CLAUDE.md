
# About this repo

The application is a signals-based, zoneless Angular application with server-side rendering. Its server is NestJS running on Fastify.

Make sure that all code uses the appropriate Angular best practices and examples according to the Angular CLI MCP server.

- The Angular app is `src/app/`, with its entry points `src/main.ts` and `src/main.server.ts`.

- The server is the other TypeScript files in `src/`. It also follows the server rules below.

## Global coding rules 

- always put model files in their own separate file. Types of the app go in `src/app/models/`, and types only the server uses go in `src/models/`.

- don't use single-letter variable names, like "f" for form

- don't use _ prefixes for private variables 

# Typescript rules

- don't use void return types, those are inferred.

- don't use Promise return types in async functions, those are inferred.

- for custom object types, use type instead of interface.

# Server rules

- use NestJS with the Fastify adapter, and no other web framework. Add server features with Fastify plugins.

- put request handling in `*-controller.ts` files, and list every controller in `src/api-module.ts`.

- put checks that refuse a request before it reaches a controller in `*-guard.ts` files.

- keep data in `*-store.ts` files and Hacker News requests in `*-proxy.ts` files, as plain functions that controllers call directly.

- don't rely on constructor types for injection: the Angular build does not record them, so the dependency arrives as `undefined` although the build succeeds. If something must be injected, name it with `@Inject()`.

- answer errors as `{ message }`, using `apiError` and `failureOf` from `src/http-helpers.ts`. Never send internal error details to the browser.

- Fastify setup (body limit, body parsers, address matching) belongs in `src/api-adapter.ts`. Static files and page rendering belong in `src/server.ts`.

- add any new `@nestjs/` or `@fastify/` package to `externalDependencies` in `angular.json`.

- test server code in `*.test.ts` files beside it, run with `npm run test:server`. Controller tests start the API with `startApiServer` from `src/api-server.testing.ts`.


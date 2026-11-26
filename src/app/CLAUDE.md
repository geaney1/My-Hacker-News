## Angular code rules

- Always use Signal Forms. Don't use reactive or template-driven forms.
- Don't use RxJS and Observables unless explicitly told to. Define the API of your service layers with Promises.
- For handling async code, prefer Promises and the async/await syntax.
- If you run into Angular APIs that are still Observable-based, convert them to Promises using `firstValueFrom`.
- Where applicable, keep a common CSS theme in shared files that you import/apply to the components,
  to make it easy to adapt the theme in the future.
- All HTTP requests target the backend by having the URL start with `/api`.
- Don't use inline HTML templates or CSS in Angular components. Always use external files.
- Use domain stores, Resource Signals, computed signals, linked signals, OnPush change detection (the default in
  Angular 22, so it is not set in the decorator) and feature-based architecture.

## Folder structure

- `core/`: app-wide services and stores, such as the API classes and authentication.
- `features/`: one folder per part of the app, for example `features/stories/`.
- `shared/`: components, pipes and styles used by several features.
- `models/`: types of the app, one per file.

Keep domain stores close to their features. Stores that the whole app needs once belong in `core/`.

## Stories store

- Keep APIs, loading state, search term, pagination and filters in a root-injected store.

## Store patterns

`features/stories/stories.store.ts` is the complete example. Use writable signals for state, computed signals for
filtered and paginated results, effects for persistence and resources for server data.

- **Resource Signals:** ideal for loading top, best and new stories with automatic loading and error handling.
- **Computed Signals:** use for filtering, sorting, pagination and derived UI state.
- **Linked Signals:** keep selected entities synchronised with collections.
- **Effects:** use only for side effects such as localStorage, analytics and routing.

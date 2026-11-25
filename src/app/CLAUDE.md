## Angular code rules

- always use Signal Forms. Don't use reactive or model-driven forms.

- don't use Rxjs and Observables unless explicitly told to. Define the API of your service layers with Promises.

- For handling async code, prefer Promises and the async /await syntax

- If you run into Angular APIs that are still Observable-based, convert them to Promises using firstValueFrom

- where applicable, keep a common CSS theme in shared files that you import/apply to the components,
  to make it easy to adapt the theme in the future.

//- all HTTP requests target the backend by having the url start with /api.

- don't use inline HTML templates or CSS in Angular components. Always use external files.

- Use domain stores, Resource Signals, computed signals, linked signals, OnPush change detection (the default in Angular 22, so it is not set in the decorator) and feature-based architecture.

-Folder Structure
core/, features/stories/, stores/, services/, shared/, models/. Keep domain stores close to features.

#Stories Store

- Store APIs, loading state, search term, pagination and filters in a root-injected store.

#Complete Store Example
-Writable signals for state, computed signals for filtered and paginated results, effects for persistence, resources for server data.
-Resource Signals
Ideal for loading top, best and new stories with automatic loading/error handling.
-Computed Signals Use for filtering, sorting, pagination and derived UI state.
Linked Signals
-Keep selected entities synchronised with collections.
-Effects Use only for side effects such as localStorage, analytics and routing.

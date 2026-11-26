import { createApiApp } from './api-app';

/** Starts the API on a free port, for the controller tests. */
export async function startApiServer() {
  const apiApp = await createApiApp();
  await apiApp.listen(0, '127.0.0.1');

  return {
    url: `${await apiApp.getUrl()}/api`,
    close: () => apiApp.close(),
  };
}

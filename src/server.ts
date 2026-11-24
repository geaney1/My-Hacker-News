import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { authRouter } from './auth-routes';
import { BadRequestError } from './hn-fetch';
import { getStoryPage, parseItemId } from './stories-proxy';
import { getThread } from './thread-proxy';
import { getUpdates } from './updates-proxy';
import { getUser } from './users-proxy';
import { getWelcomeContent } from './welcome-proxy';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * Accounts and sessions: sign up, log in, log out and "who am I". Request bodies are small JSON.
 */
app.use('/api/auth', express.json({ limit: '10kb' }), authRouter);

/**
 * Proxies the Hacker News welcome page, which the browser cannot fetch directly (CORS).
 */
app.get('/api/welcome', async (_request, response) => {
  try {
    response.json(await getWelcomeContent());
  } catch (error) {
    console.error('Failed to load the welcome page', error);
    response.status(502).json({ message: 'Could not load the welcome page' });
  }
});

/**
 * Loads a page of a story list in one call, instead of the browser making one request per story.
 */
app.get('/api/stories/:list', async (request, response) => {
  try {
    const { page, pageSize } = request.query;
    response.json(await getStoryPage(request.params.list, page, pageSize));
  } catch (error) {
    if (error instanceof BadRequestError) {
      response.status(400).json({ message: error.message });
      return;
    }
    console.error('Failed to load stories', error);
    response.status(502).json({ message: 'Could not load the stories' });
  }
});

/**
 * The items and profiles that changed recently, so the app can tell when what it shows is stale.
 */
app.get('/api/updates', async (_request, response) => {
  try {
    response.json(await getUpdates());
  } catch (error) {
    console.error('Failed to load the updates', error);
    response.status(502).json({ message: 'Could not load the updates' });
  }
});

/**
 * Loads an item together with its comment tree. Answers 404 when the item does not exist.
 */
app.get('/api/items/:id/thread', async (request, response) => {
  try {
    const thread = await getThread(parseItemId(request.params.id));
    if (!thread) {
      response.status(404).json({ message: 'Item not found' });
      return;
    }
    response.json(thread);
  } catch (error) {
    if (error instanceof BadRequestError) {
      response.status(400).json({ message: error.message });
      return;
    }
    console.error('Failed to load the thread', error);
    response.status(502).json({ message: 'Could not load the comments' });
  }
});

/**
 * Loads a user's public profile. Answers 404 when the user does not exist.
 */
app.get('/api/users/:id', async (request, response) => {
  try {
    const user = await getUser(request.params.id);
    if (!user) {
      response.status(404).json({ message: 'User not found' });
      return;
    }
    response.json(user);
  } catch (error) {
    if (error instanceof BadRequestError) {
      response.status(400).json({ message: error.message });
      return;
    }
    console.error('Failed to load the user', error);
    response.status(502).json({ message: 'Could not load the user' });
  }
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);

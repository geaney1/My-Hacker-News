import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { authRouter } from './auth-routes';
import { commentsRouter } from './comments-routes';
import { BadRequestError } from './hn-fetch';
import { profileRouter } from './profile-routes';
import { nonceOf, parseTrustProxy, securityHeaders, withCspNonce } from './security';
import { getStoryPage, parseItemId } from './stories-proxy';
import { submissionsRouter } from './submissions-routes';
import { getThread } from './thread-proxy';
import { viewerOf } from './viewer';
import { getUpdates } from './updates-proxy';
import { getUser } from './users-proxy';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * `true` when this file is the server itself (`npm run serve:ssr:hacker-news`, a process manager),
 * and not the dev server or a build step that borrows its request handler. Only the real server
 * sends the security headers: the dev server needs inline scripts and a websocket they would block.
 */
const runsAsServer = isMainModule(import.meta.url) || !!process.env['pm_id'];

// Behind a proxy that ends HTTPS, set TRUST_PROXY (see security.ts) so cookies are marked Secure
// and the rate limits see each visitor's own address.
const trustProxy = parseTrustProxy(process.env['TRUST_PROXY']);
if (trustProxy !== undefined) {
  app.set('trust proxy', trustProxy);
}
app.disable('x-powered-by');

if (runsAsServer) {
  app.use(...securityHeaders());
}

/**
 * Accounts and sessions: create a user, log in, log out and "who am I". Request bodies are small JSON.
 */
app.use('/api/auth', express.json({ limit: '10kb' }), authRouter);

/**
 * The logged-in user's profile: read it, and save it.
 */
app.use('/api/profile', express.json({ limit: '10kb' }), profileRouter);

/**
 * Stories submitted by logged-in users, saved on this server.
 */
app.use('/api/submissions', express.json({ limit: '10kb' }), submissionsRouter);

/**
 * Loads a page of a story list in one call, instead of the browser making one request per story.
 */
app.get('/api/stories/:list', async (request, response) => {
  try {
    const { page, pageSize } = request.query;
    const { showDead } = await viewerOf(request);
    response.json(await getStoryPage(request.params.list, page, pageSize, { showDead }));
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
 * Writing a comment on a story submitted in this app. Reading comments is the thread route below.
 */
app.use('/api/items', express.json({ limit: '10kb' }), commentsRouter);

/**
 * Loads an item together with its comment tree. Answers 404 when the item does not exist.
 */
app.get('/api/items/:id/thread', async (request, response) => {
  try {
    const thread = await getThread(parseItemId(request.params.id), await viewerOf(request));
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
    .then(async (response) => {
      if (!response) {
        return next();
      }
      // The inline scripts and styles of the rendered page get this request's nonce.
      await writeResponseToNodeResponse(
        runsAsServer ? await withCspNonce(response, nonceOf(res)) : response,
        res,
      );
    })
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (runsAsServer) {
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

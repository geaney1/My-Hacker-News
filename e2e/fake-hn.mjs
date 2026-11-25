// A small stand-in for Hacker News's API, so the end-to-end tests do not depend on the real one
// (which changes all the time) or on the network. The app's server is pointed at it with
// HN_API_URL. Run with: PORT=4900 node e2e/fake-hn.mjs
import { createServer } from 'node:http';

const now = Math.floor(Date.now() / 1000);

// A long list, for the tests of paging: 45 jobs, which is three pages of twenty.
const jobIds = Array.from({ length: 45 }, (_, index) => 400 + index);
const jobs = Object.fromEntries(
  jobIds.map((id, index) => [id, { id, type: 'job', by: 'hnauthor', title: `Job number ${index + 1}`, url: `https://example.com/job/${id}`, score: 1, time: now - (index + 1) * 60 }]),
);

const items = {
  ...jobs,
  101: { id: 101, type: 'story', by: 'hnauthor', title: 'Fake top story', url: 'https://example.com/top', score: 120, time: now - 3600, descendants: 1, kids: [111, 112] },
  102: { id: 102, type: 'story', by: 'hnauthor', title: 'Second fake top story', url: 'https://example.com/second', score: 80, time: now - 7200, descendants: 0 },
  111: { id: 111, type: 'comment', by: 'hncommenter', text: 'A comment from Hacker News', parent: 101, time: now - 3000 },
  // Dead: only shown to someone who has Show Dead turned on.
  112: { id: 112, type: 'comment', by: 'deadcommenter', text: 'A dead comment', parent: 101, time: now - 2900, dead: true },
  203: { id: 203, type: 'story', by: 'hnauthor', title: 'A dead Hacker News story', url: 'https://example.com/dead', score: 1, time: now - 86400, descendants: 0, dead: true },
  // Dated an hour ahead, so it stays newer than any story the tests submit while they run. That
  // shows stories submitted in the app being placed among these by time, not always on top.
  201: { id: 201, type: 'story', by: 'hnauthor', title: 'Fresh Hacker News story', url: 'https://example.com/fresh', score: 10, time: now + 3600, descendants: 0 },
  202: { id: 202, type: 'story', by: 'hnauthor', title: 'Older Hacker News story', url: 'https://example.com/older', score: 5, time: now - 172800, descendants: 0 },
  301: { id: 301, type: 'story', by: 'hnauthor', title: 'Ask HN: a fake question', text: 'What do you think?', score: 7, time: now - 5000, descendants: 0 },
};

const lists = {
  topstories: [101, 102],
  newstories: [201, 203, 202],
  beststories: [101],
  askstories: [301],
  showstories: [],
  jobstories: jobIds,
};

const users = {
  hnauthor: { id: 'hnauthor', created: now - 86400 * 365, karma: 1234, submitted: [101, 102, 201, 202, 301] },
};

const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname).replace(/^\/v0\//, '');
  let body = null;
  let match;
  if (path === 'updates.json') {
    body = { items: [], profiles: [] };
  } else if (path.replace('.json', '') in lists) {
    body = lists[path.replace('.json', '')];
  } else if ((match = path.match(/^item\/(\d+)\.json$/))) {
    body = items[match[1]] ?? null;
  } else if ((match = path.match(/^user\/([^/]+)\.json$/))) {
    body = users[match[1]] ?? null;
  }
  // Like the real API, anything it does not have is the JSON `null`.
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify(body));
});

server.listen(Number(process.env.PORT ?? 4900), () => {
  console.log(`Fake Hacker News listening on ${process.env.PORT ?? 4900}`);
});

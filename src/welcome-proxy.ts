import type { WelcomeContent, WelcomeSegment } from './app/models/welcome-content';

const welcomeUrl = 'https://news.ycombinator.com/newswelcome.html';

const entities: Record<string, string> = {
  '&mdash;': '—',
  '&ndash;': '–',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
  '&nbsp;': ' ',
};

function decode(text: string) {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&[#\w]+;/g, (entity) => entities[entity] ?? entity)
    .replace(/\s+/g, ' ');
}

/** Resolves relative links against Hacker News and only allows http(s) links. */
function safeHref(href: string) {
  try {
    const url = new URL(href, welcomeUrl);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** `true` for a link to the Hacker News front page, which the app shows as its "Top" list. */
function isHomeLink(href: string | undefined) {
  if (!href) {
    return false;
  }
  const url = new URL(href);
  return url.hostname === 'news.ycombinator.com' && url.pathname === '/' && !url.search;
}

function parseParagraph(html: string) {
  const segments: WelcomeSegment[] = [];
  const linkPattern = /<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let position = 0;

  for (const match of html.matchAll(linkPattern)) {
    segments.push({ text: decode(html.slice(position, match.index)) });
    const href = safeHref(match[1]);
    segments.push(
      isHomeLink(href)
        ? { text: decode(match[2]), route: '/top' }
        : { text: decode(match[2]), href },
    );
    position = match.index + match[0].length;
  }
  segments.push({ text: decode(html.slice(position)) });

  return segments.filter((segment) => segment.text.trim().length > 0);
}

function parseWelcome(html: string): WelcomeContent {
  const titleMatch = html.match(/<b>([\s\S]*?)<\/b>/i);
  const bodyStart = titleMatch ? html.indexOf(titleMatch[0]) + titleMatch[0].length : 0;
  const bodyEnd = html.search(/<table\s+width=100%/i);
  const body = html.slice(bodyStart, bodyEnd > bodyStart ? bodyEnd : undefined);

  const paragraphs = body
    .split(/<p>/i)
    .map((chunk) => parseParagraph(chunk.replace(/<br\s*\/?>/gi, ' ')))
    .filter((segments) => segments.length > 0);

  return { title: titleMatch ? decode(titleMatch[1]).trim() : 'Welcome', paragraphs };
}

let cachedContent: WelcomeContent | undefined;

/**
 * Returns the Hacker News welcome page as structured content. It is fetched once and then
 * kept for as long as the server runs; a failed fetch is not cached, so the next call retries.
 */
export async function getWelcomeContent() {
  if (cachedContent) {
    return cachedContent;
  }

  const response = await fetch(welcomeUrl);
  if (!response.ok) {
    throw new Error(`Hacker News responded with ${response.status}`);
  }

  const content = parseWelcome(await response.text());
  if (content.paragraphs.length === 0) {
    throw new Error('The welcome page had no readable content');
  }

  cachedContent = content;
  return content;
}

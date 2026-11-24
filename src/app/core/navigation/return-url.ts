import { firstSegmentOf } from './current-url';

/**
 * A place to send the user back to after they log in, or `undefined` when the address is missing
 * or not safe. Only addresses inside this app are accepted (so a link cannot send someone to
 * another site), and never the log-in or create-user pages themselves.
 */
export function safeReturnUrl(url: string | null | undefined) {
  if (!url || !url.startsWith('/') || url.startsWith('//') || url.includes('\\')) {
    return undefined;
  }
  const first = firstSegmentOf(url);
  return first === 'log-in' || first === 'create-user' ? undefined : url;
}

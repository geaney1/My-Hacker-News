/** The longest title a story can have (Hacker News's own limit). */
export const maxTitleLength = 80;

/** The longest text a story can have. */
export const maxTextLength = 2000;

/** The longest link the form accepts. */
export const maxUrlLength = 2000;

/** `true` for a full web address that starts with http:// or https:// and names a site. */
export function isWebAddress(value: string) {
  try {
    const address = new URL(value.trim());
    return (address.protocol === 'http:' || address.protocol === 'https:') && address.hostname !== '';
  } catch {
    return false;
  }
}

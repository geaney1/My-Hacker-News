/** Reads one cookie from a `Cookie` request header. */
export function readCookie(cookieHeader: string | undefined, name: string) {
  for (const part of cookieHeader?.split(';') ?? []) {
    const separator = part.indexOf('=');
    if (part.slice(0, separator).trim() === name) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }
  return undefined;
}

/**
 * A piece of a paragraph: plain text, an external link when `href` is set,
 * or a link inside this app when `route` is set.
 */
export type WelcomeSegment = {
  text: string;
  href?: string;
  route?: string;
};

export type WelcomeContent = {
  title: string;
  paragraphs: WelcomeSegment[][];
};

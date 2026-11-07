/** Small pure string helpers shared by pages, validation and scripts. */

/** URL-safe slug: ascii letters, digits and single dashes, at most 48 chars. */
export const slugify = (s: string): string =>
  s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 48)
    .replace(/^-+|-+$/g, '');

/** Lowercase ascii word tokens (accents folded), for blocked-term matching on text and host names. */
export const words = (s: string): string[] =>
  s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/** One key per page: host without `www.`, path without trailing slash, no query or hash. Used to spot duplicates. */
export const normUrl = (u: URL): string =>
  `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`.toLowerCase();

/** Plain-text paragraphs split on blank lines. */
export const paragraphs = (s: string): string[] =>
  s.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

/** Stable 0-359 hue per string, for letter avatars. */
export const hue = (s: string): number => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

/** Cuts at n chars with an ellipsis, for meta descriptions. */
export const truncate = (s: string, n: number): string => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);

/** Host for display: `example.com/app`. */
export const displayUrl = (url: string): string => {
  const u = new URL(url);
  return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`;
};

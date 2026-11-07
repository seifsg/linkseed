import { SITE_URL, type Category } from '../config.ts';
import { slugify } from './text.ts';

/** One listing as stored in `listings/<slug>.json`. */
export interface Listing {
  slug: string;
  issue: number | null;
  author: string;
  name: string;
  url: string;
  tagline: string;
  description: string;
  category: Category;
  createdAt: string;
  updatedAt: string;
  verified: boolean;
  verifiedAt: string | null;
  checkNote: string;
}

/** Fields a maker controls through the issue form. */
export type Draft = Pick<Listing, 'name' | 'url' | 'tagline' | 'description' | 'category'>;

/** Top-level paths a listing slug must never take. */
const RESERVED = new Set(['c', 'submit', '404', '_astro', 'sitemap.xml', 'robots.txt', 'badge.svg', 'favicon.svg', 'og.png']);

export const listingUrl = (slug: string): string => `${SITE_URL}/${slug}/`;

export const categorySlug = (c: string): string => slugify(c);

export const byNewest = (a: Listing, b: Listing): number => b.createdAt.localeCompare(a.createdAt);

/** First free slug for a new listing: from the name, else suffixed with the issue number (then a counter). Kept forever after. */
export function pickSlug(name: string, issue: number, taken: ReadonlySet<string>): string {
  const base = slugify(name) || 'app';
  let slug = base;
  for (let i = 1; RESERVED.has(slug) || taken.has(slug); i++) slug = i === 1 ? `${base}-${issue}` : `${base}-${issue}-${i}`;
  return slug;
}

/** Snippets a maker adds to their site to verify ownership. */
export const metaTag = (slug: string): string => `<meta name="linkseed" content="${slug}">`;
export const badgeHtml = (slug: string): string =>
  `<a href="${listingUrl(slug)}"><img src="${SITE_URL}/badge.svg" alt="Listed on Linkseed" width="168" height="40"></a>`;

import type { APIRoute } from 'astro';
import { SITE_URL } from '../config.ts';
import { categorySlug, listingUrl } from '../lib/listing.ts';
import { loadAll } from '../lib/store.ts';

/** sitemap.xml: home, how-it-works, category pages and every listing, with `lastmod` from listing data. */
export const GET: APIRoute = () => {
  const all = loadAll();
  const latest = (ls: typeof all): string => ls.reduce((m, l) => (l.updatedAt > m ? l.updatedAt : m), '');
  const cats = [...new Set(all.map((l) => l.category))];
  const urls: [string, string][] = [
    [`${SITE_URL}/`, latest(all)],
    [`${SITE_URL}/submit/`, ''],
    ...cats.map((c): [string, string] => [`${SITE_URL}/c/${categorySlug(c)}/`, latest(all.filter((l) => l.category === c))]),
    ...all.map((l): [string, string] => [listingUrl(l.slug), l.updatedAt]),
  ];
  const body = urls
    .map(([loc, mod]) => `  <url><loc>${loc}</loc>${mod ? `<lastmod>${mod}</lastmod>` : ''}</url>`)
    .join('\n');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`, {
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  });
};

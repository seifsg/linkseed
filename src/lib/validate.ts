import { BLOCKED, CATEGORIES, LIMITS, type Category } from '../config.ts';
import { listingUrl, type Draft, type Listing } from './listing.ts';
import type { Fields } from './parse.ts';
import { normUrl, words } from './text.ts';

/** What validation needs besides the form: existing listings and who submits. */
export interface ValidateCtx {
  listings: readonly Listing[];
  issue: number;
  author: string;
  /** ISO date the author's GitHub account was created. */
  accountCreated: string;
  now: Date;
}

export type Validation = { ok: true; data: Draft } | { ok: false; errors: string[] };

const DAY_MS = 86_400_000;
// Control characters except tab and newline never belong in listing text.
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/g;
const oneLine = (s: string): string => s.replace(CONTROL, '').replace(/\s+/g, ' ').trim();
const multiLine = (s: string): string => s.replace(CONTROL, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
const isCategory = (c: string): c is Category => (CATEGORIES as readonly string[]).includes(c);

/** Length rule as a readable reason, or null. */
const length = (label: string, v: string, [min, max]: readonly [number, number]): string | null =>
  v.length < min || v.length > max ? `${label} must be ${min} to ${max} characters (it has ${v.length}).` : null;

/** Parses and checks the URL: public https host, no login, no port. Returns the URL or a reason. */
export function checkUrl(raw: string): URL | string {
  if (raw.length > LIMITS.url) return `URL must be at most ${LIMITS.url} characters.`;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return 'URL is not a valid web address.';
  }
  if (u.protocol !== 'https:') return 'URL must start with https://.';
  if (u.username || u.password) return 'URL must not contain a username or password.';
  if (u.port) return 'URL must not set a port.';
  const h = u.hostname;
  const local = /(^|\.)(localhost|local|internal|lan|home|test|example|invalid|onion)$/.test(h);
  if (!h.includes('.') || h.startsWith('[') || /^[\d.]+$/.test(h) || local) {
    return 'URL must use a public domain name, not an IP address or a local host.';
  }
  return u;
}

/** Checks every rule and returns all reasons at once, or the clean listing fields. */
export function validate(f: Fields, ctx: ValidateCtx): Validation {
  const name = oneLine(f.name);
  const tagline = oneLine(f.tagline);
  const description = multiLine(f.description);
  const category = f.category.trim();
  const u = checkUrl(f.url.trim());
  const others = ctx.listings.filter((l) => l.issue !== ctx.issue);
  const dup = typeof u === 'string' ? undefined : others.find((l) => normUrl(new URL(l.url)) === normUrl(u));
  const banned = [name, tagline, description, typeof u === 'string' ? '' : u.hostname]
    .flatMap(words)
    .filter((w) => BLOCKED.has(w));
  const ageDays = (ctx.now.getTime() - Date.parse(ctx.accountCreated)) / DAY_MS;

  const errors = [
    length('App name', name, LIMITS.name),
    typeof u === 'string' ? u : null,
    length('Tagline', tagline, LIMITS.tagline),
    length('Description', description, LIMITS.description),
    isCategory(category) ? null : `Category must be one of: ${CATEGORIES.join(', ')}.`,
    f.agree ? null : 'Tick the agreement box.',
    banned.length ? `Linkseed lists halal content only; remove: ${[...new Set(banned)].join(', ')}.` : null,
    dup ? `This URL is already listed at ${listingUrl(dup.slug)}.` : null,
    others.filter((l) => l.author === ctx.author).length >= LIMITS.perAuthor
      ? `One GitHub account can hold up to ${LIMITS.perAuthor} listings.`
      : null,
    Number.isNaN(ageDays) || ageDays < LIMITS.accountDays
      ? `Your GitHub account must be at least ${LIMITS.accountDays} days old.`
      : null,
  ].filter((e): e is string => e !== null);

  if (errors.length || typeof u === 'string' || !isCategory(category)) return { ok: false, errors };
  return { ok: true, data: { name, url: `${u.origin}${u.pathname}${u.search}`, tagline, description, category } };
}

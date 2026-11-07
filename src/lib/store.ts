import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { byNewest, type Listing } from './listing.ts';

/** Listing data folder, relative to the repo root (npm scripts run there). `LISTINGS_DIR` points demos at fixtures. */
export const DIR = resolve(process.env['LISTINGS_DIR'] ?? 'listings');

const file = (slug: string): string => join(DIR, `${slug}.json`);

/** Every listing, newest first. A corrupt file throws: a broken build beats a silent gap. */
export const loadAll = (): Listing[] =>
  readdirSync(DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as Listing)
    .sort(byNewest);

export const save = (l: Listing): void => writeFileSync(file(l.slug), `${JSON.stringify(l, null, 2)}\n`);

export const remove = (slug: string): void => rmSync(file(slug), { force: true });

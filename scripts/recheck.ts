/**
 * Weekly ownership recheck of every listing (run by the Action on a schedule).
 * Flip rules live in `applyCheck` (src/lib/recheck.ts).
 * Usage: `npm run recheck` or `npm run recheck -- --dry` (prints, writes nothing).
 */
import { commitAndPush } from '../src/lib/git.ts';
import { github } from '../src/lib/github.ts';
import type { Listing } from '../src/lib/listing.ts';
import { checkOwnership, type Ownership } from '../src/lib/proof.ts';
import { applyCheck } from '../src/lib/recheck.ts';
import { loadAll, save } from '../src/lib/store.ts';

const dry = process.argv.includes('--dry');
const PARALLEL = 8;

/** Checks listings with at most PARALLEL page loads in flight. */
async function checkAll(listings: Listing[]): Promise<Ownership[]> {
  const out: Ownership[] = new Array(listings.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    for (let i = next++; i < listings.length; i = next++) {
      const l = listings[i]!;
      out[i] = await checkOwnership(l.url, l.slug);
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, listings.length) }, worker));
  return out;
}

async function main(): Promise<void> {
  const listings = loadAll();
  const results = await checkAll(listings);
  const now = new Date().toISOString();
  let flips = 0;
  listings.forEach((l, i) => {
    const c = results[i]!;
    const next = applyCheck(l, c, now);
    console.log(`${l.slug}: ${c.verified ? 'verified' : 'not verified'} (${c.note})${next ? ` -> now ${c.verified ? 'dofollow' : 'nofollow'}` : ''}`);
    if (!next) return;
    flips++;
    if (!dry) save(next);
  });
  console.log(`${flips} of ${listings.length} changed${dry ? ' (dry run, nothing written)' : ''}`);
  if (!dry && commitAndPush('listings', `listing: weekly ownership recheck (${flips} changed)`)) await github().deploy();
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

import type { Listing } from './listing.ts';
import type { Ownership } from './proof.ts';

/**
 * The listing after a recheck, or null when nothing changes.
 * A found tag turns the link dofollow; a page that loads without it turns it back.
 * An unreachable page never revokes: a short outage should not cost a maker their link.
 */
export function applyCheck(l: Listing, c: Ownership, now: string): Listing | null {
  if (c.verified === l.verified || (!c.verified && !c.reached)) return null;
  return { ...l, verified: c.verified, verifiedAt: c.verified ? now : null, checkNote: c.note, updatedAt: now };
}

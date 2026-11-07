import { LABELS } from '../config.ts';
import { labelNames, type Issue } from './github.ts';
import { pickSlug, type Listing } from './listing.ts';
import { messages } from './messages.ts';
import { parse } from './parse.ts';
import type { Ownership } from './proof.ts';
import { validate } from './validate.ts';

export interface ReconcileCtx {
  listings: readonly Listing[];
  now: Date;
  requireApproval: boolean;
  accountCreated: (login: string) => Promise<string>;
  verify: (url: string, slug: string) => Promise<Ownership>;
}

/** What sync should do for one issue. Computed without side effects, applied by `scripts/sync.ts`. */
export interface Plan {
  write?: Listing;
  remove?: string;
  comment?: string;
  add: string[];
  drop: string[];
  close: boolean;
}

// Fields whose change rewrites the listing file (a new check note alone does not).
const KEYS = ['name', 'url', 'tagline', 'description', 'category', 'author', 'verified'] as const;
const changed = (a: Listing, b: Listing): boolean => KEYS.some((k) => a[k] !== b[k]);

/** Brings one submission issue to its desired state: listed, waiting, invalid or removed. Idempotent. */
export async function reconcile(issue: Issue, ctx: ReconcileCtx): Promise<Plan> {
  const has = labelNames(issue);
  const plan: Plan = { add: [], drop: [], close: false };
  if (!has.has(LABELS.submission)) return plan;
  const own = ctx.listings.find((l) => l.issue === issue.number);
  const labels = (on: string[], off: string[]): void => {
    plan.add = on.filter((l) => !has.has(l));
    plan.drop = off.filter((l) => has.has(l));
  };

  if (has.has(LABELS.spam) || issue.state_reason === 'not_planned') {
    if (own) plan.remove = own.slug;
    labels([], [LABELS.listed]);
    return plan;
  }

  const author = issue.user?.login ?? '';
  const v = validate(parse(issue.body), {
    listings: ctx.listings,
    issue: issue.number,
    author,
    accountCreated: author ? await ctx.accountCreated(author) : '',
    now: ctx.now,
  });
  if (!v.ok) {
    plan.comment = messages.invalid(v.errors);
    labels([LABELS.invalid], []);
    return plan;
  }

  if (ctx.requireApproval && !has.has(LABELS.approved)) {
    if (own) plan.remove = own.slug;
    plan.comment = messages.waiting;
    labels([], [LABELS.invalid, LABELS.listed]);
    return plan;
  }

  const slug = own?.slug ?? pickSlug(v.data.name, issue.number, new Set(ctx.listings.map((l) => l.slug)));
  const check = await ctx.verify(v.data.url, slug);
  if (v.contested && !check.verified) {
    plan.comment = messages.contested(v.contested, slug);
    labels([LABELS.invalid], []);
    return plan;
  }
  // A verified owner takes over an unverified listing of the same URL.
  if (v.contested) plan.remove = v.contested.slug;
  const now = ctx.now.toISOString();
  const next: Listing = {
    slug,
    issue: issue.number,
    author,
    ...v.data,
    createdAt: own?.createdAt ?? now,
    updatedAt: now,
    verified: check.verified,
    verifiedAt: check.verified ? (own?.verified ? own.verifiedAt : now) : null,
    checkNote: check.note,
  };
  if (!own || changed(own, next)) plan.write = next;
  plan.comment = messages.listed(next);
  labels([LABELS.listed], [LABELS.invalid]);
  plan.close = issue.state === 'open';
  return plan;
}

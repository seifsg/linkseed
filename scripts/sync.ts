/**
 * Syncs one submission issue into `listings/` (run by the Action on issue events).
 * Usage: `npm run sync -- <issue-number>` or `npm run sync -- --dry <issue.json> [--require-approval]`.
 * Dry runs touch no GitHub, git or network: they print the plan only.
 */
import { readFileSync } from 'node:fs';
import { REQUIRE_APPROVAL } from '../src/config.ts';
import { commitAndPush } from '../src/lib/git.ts';
import { github, type GitHub, type Issue } from '../src/lib/github.ts';
import { checkOwnership } from '../src/lib/proof.ts';
import { reconcile, type Plan } from '../src/lib/reconcile.ts';
import { loadAll, remove, save } from '../src/lib/store.ts';

const USAGE = 'usage: sync <issue-number> | sync --dry <issue.json> [--require-approval]';
const args = process.argv.slice(2);
const requireApproval = REQUIRE_APPROVAL || args.includes('--require-approval');

/** Writes files, pushes, deploys, then tells the maker: comments only follow a successful push. */
async function apply(n: number, plan: Plan, gh: GitHub): Promise<void> {
  if (plan.write) save(plan.write);
  if (plan.remove) remove(plan.remove);
  const slug = plan.write?.slug ?? plan.remove;
  if (slug && commitAndPush('listings', `listing: ${plan.write ? 'publish' : 'remove'} ${slug} (#${n})`)) await gh.deploy();
  if (plan.comment) await gh.comment(n, plan.comment);
  for (const l of plan.drop) await gh.removeLabel(n, l);
  if (plan.add.length) await gh.addLabels(n, plan.add);
  if (plan.close) await gh.close(n);
}

/** Prints the plan for a saved issue JSON (`user.created_at` stands in for the account lookup). */
async function dry(file: string): Promise<void> {
  const issue = JSON.parse(readFileSync(file, 'utf8')) as Issue & { user: { login: string; created_at?: string } | null };
  const plan = await reconcile(issue, {
    listings: loadAll(),
    now: new Date(),
    requireApproval,
    accountCreated: async () => issue.user?.created_at ?? '',
    verify: async () => ({ verified: false, reached: false, note: 'dry run, site not loaded' }),
  });
  console.log(JSON.stringify({ ...plan, deploy: Boolean(plan.write ?? plan.remove) }, null, 2));
}

async function main(): Promise<void> {
  if (args[0] === '--dry') {
    if (!args[1]) throw new Error(USAGE);
    return dry(args[1]);
  }
  const n = Number(args[0]);
  if (!Number.isInteger(n) || n < 1) throw new Error(USAGE);
  const gh = github();
  const plan = await reconcile(await gh.issue(n), {
    listings: loadAll(),
    now: new Date(),
    requireApproval,
    accountCreated: gh.accountCreated,
    verify: checkOwnership,
  });
  await apply(n, plan, gh);
  console.log(`#${n}: ${JSON.stringify({ ...plan, write: plan.write?.slug, comment: Boolean(plan.comment) })}`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

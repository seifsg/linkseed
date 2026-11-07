import { execFileSync } from 'node:child_process';

// The Actions bot identity, on every call: `commit` and the replayed commits of `pull --rebase` both need it.
const BOT = ['-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com'];

/** Runs git with arguments as an array: no shell, so no text from an issue can become a command. */
const git = (...args: string[]): string =>
  execFileSync('git', [...BOT, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/**
 * Commits changes under `path` as the Actions bot and pushes to main, rebasing on concurrent pushes.
 * Returns false when nothing changed. Throws after the last failed try, so the job fails loudly.
 */
export function commitAndPush(path: string, message: string, tries = 3): boolean {
  git('add', '--all', '--', path);
  if (!git('status', '--porcelain', '--', path)) return false;
  git('commit', '-m', message);
  for (let i = 1; ; i++) {
    try {
      git('pull', '--rebase', 'origin', 'main');
      git('push', 'origin', 'HEAD:main');
      return true;
    } catch (e) {
      if (i >= tries) throw e;
      console.log(`push try ${i} failed, retrying: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

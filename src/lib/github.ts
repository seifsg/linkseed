import { DEPLOY_WORKFLOW, REPO } from '../config.ts';

/** The fields of a GitHub issue that sync reads. */
export interface Issue {
  number: number;
  body: string | null;
  state: 'open' | 'closed';
  state_reason: string | null;
  user: { login: string } | null;
  labels: Array<{ name?: string } | string>;
}

export const labelNames = (i: Issue): Set<string> =>
  new Set(i.labels.map((l) => (typeof l === 'string' ? l : (l.name ?? ''))));

/** Minimal GitHub REST client for the Action: one token, one repo, loud on any unexpected status. */
export function github(token = process.env['GITHUB_TOKEN'], repo = process.env['GITHUB_REPOSITORY'] ?? REPO) {
  if (!token) throw new Error('GITHUB_TOKEN is not set');
  const call = async (method: string, path: string, body?: unknown, allow404 = false): Promise<unknown> => {
    const res = await fetch(`https://api.github.com${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'user-agent': 'linkseed-action',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (allow404 && res.status === 404) return null;
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`);
    return res.status === 204 ? undefined : res.json();
  };
  const r = `/repos/${repo}`;
  return {
    issue: async (n: number) => (await call('GET', `${r}/issues/${n}`)) as Issue,
    accountCreated: async (login: string) => ((await call('GET', `/users/${encodeURIComponent(login)}`)) as { created_at: string }).created_at,
    comment: (n: number, body: string) => call('POST', `${r}/issues/${n}/comments`, { body }),
    addLabels: (n: number, labels: string[]) => call('POST', `${r}/issues/${n}/labels`, { labels }),
    removeLabel: (n: number, label: string) => call('DELETE', `${r}/issues/${n}/labels/${encodeURIComponent(label)}`, undefined, true),
    close: (n: number) => call('PATCH', `${r}/issues/${n}`, { state: 'closed', state_reason: 'completed' }),
    /** Starts the deploy workflow; pushes made with GITHUB_TOKEN never trigger it on their own. */
    deploy: async (): Promise<void> => {
      const run = await call('POST', `${r}/actions/workflows/${DEPLOY_WORKFLOW}/dispatches`, { ref: 'main' }, true);
      console.log(run === null ? `deploy: ${DEPLOY_WORKFLOW} not found, skipped (repo not shipped yet)` : `deploy: ${DEPLOY_WORKFLOW} dispatched`);
    },
  };
}

export type GitHub = ReturnType<typeof github>;

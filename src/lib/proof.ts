import { lookup } from 'node:dns/promises';
import { SITE_NAME, SITE_URL } from '../config.ts';

/** Result of one ownership check. `reached` is false when the page could not be read at all. */
export interface Ownership {
  verified: boolean;
  reached: boolean;
  note: string;
}

export interface CheckOpts {
  timeoutMs?: number;
  maxBytes?: number;
  /** Decides whether a host may be fetched. Default: every DNS answer must be a public address. */
  guard?: (host: string) => Promise<boolean>;
}

const UA = `${SITE_NAME}Bot/1.0 (+${SITE_URL}/submit/)`;
const MAX_HOPS = 3;
const LISTING_HOST = new URL(SITE_URL).host;
// Loopback, private, link-local, CGNAT, multicast/reserved and unspecified ranges, v4 and v6.
const PRIVATE = /^(?:0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|2(?:2[4-9]|[3-5]\d)\.|::1?$|f[cd]|fe[89ab]|::ffff:)/i;

/** True when the host resolves and every address is public: the runner must never reach internal services. */
export async function publicHost(host: string): Promise<boolean> {
  const addrs = await lookup(host, { all: true, verbatim: true });
  return addrs.length > 0 && addrs.every(({ address }) => !PRIVATE.test(address));
}

/** Value of one attribute inside a tag, any quote style. */
const attr = (tag: string, name: string): string | undefined =>
  tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i'))?.slice(1).find((v) => v !== undefined);

/** Opening tags of one element; `[^<>]` keeps the scan linear on hostile pages. */
const tags = (html: string, el: string): string[] => html.match(new RegExp(`<${el}\\b[^<>]{0,2000}>`, 'gi')) ?? [];

/** True when the HTML carries `<meta name="linkseed" content="<slug>">` or an `<a>` linking to the listing page. */
export function hasOwnership(html: string, slug: string): boolean {
  const listing = new RegExp(`^https?://${LISTING_HOST.replace(/\./g, '\\.')}/${slug}/?(?:[?#].*)?$`, 'i');
  return (
    tags(html, 'meta').some((t) => attr(t, 'name')?.toLowerCase() === 'linkseed' && attr(t, 'content')?.trim() === slug) ||
    tags(html, 'a').some((t) => listing.test(attr(t, 'href')?.trim() ?? ''))
  );
}

/** Reads at most `max` bytes of the body, then stops the download. */
async function readCapped(res: Response, max: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const dec = new TextDecoder();
  let html = '';
  let size = 0;
  while (size < max) {
    const { done, value } = await reader.read();
    if (done) break;
    const part = value.subarray(0, max - size);
    size += part.byteLength;
    html += dec.decode(part, { stream: true });
  }
  await reader.cancel();
  return html;
}

const fail = (note: string, reached = true): Ownership => ({ verified: false, reached, note });
const bare = (h: string): string => h.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
const sizeText = (n: number): string => (n >= 1e6 ? `${n / 1e6} MB` : `${n / 1e3} kB`);

/**
 * Loads the maker's page once (following up to 3 redirects on the same site) and looks for the meta tag or badge link.
 * Fails safe: anything but a readable HTML page with the tag stays unverified, with a fixed reason in `note`.
 */
export async function checkOwnership(url: string, slug: string, opts: CheckOpts = {}): Promise<Ownership> {
  const { timeoutMs = 10_000, maxBytes = 1_000_000, guard = publicHost } = opts;
  const signal = AbortSignal.timeout(timeoutMs);
  const start = new URL(url);
  try {
    let at = start;
    for (let hop = 0; ; hop++) {
      if (!(await guard(at.hostname))) return fail('the address is not a public host', false);
      const res = await fetch(at, { redirect: 'manual', signal, headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' } });
      const location = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
      if (location === null) {
        if (!res.ok) return fail(`page answered HTTP ${res.status}`, false);
        if (!/text\/html|application\/xhtml\+xml/i.test(res.headers.get('content-type') ?? '')) return fail('page is not HTML');
        return hasOwnership(await readCapped(res, maxBytes), slug)
          ? { verified: true, reached: true, note: 'meta tag or badge found' }
          : fail(`no linkseed meta tag or badge link in the first ${sizeText(maxBytes)}`);
      }
      await res.body?.cancel();
      const next = new URL(location, at);
      if (next.protocol !== start.protocol || bare(next.hostname) !== bare(start.hostname)) return fail('page redirects to another site', false);
      if (hop >= MAX_HOPS) return fail('too many redirects', false);
      at = next;
    }
  } catch (e) {
    const timeout = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
    return fail(timeout ? `timed out after ${timeoutMs / 1000} s` : 'could not load the page', false);
  }
}

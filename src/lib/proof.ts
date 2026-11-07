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
}

const UA = `${SITE_NAME}Bot/1.0 (+${SITE_URL}/submit/)`;
const host = new URL(SITE_URL).host.replace(/\./g, '\\.');

/** Value of one attribute inside a tag, any quote style. */
const attr = (tag: string, name: string): string | undefined =>
  tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i'))?.slice(1).find((v) => v !== undefined);

/** True when the HTML carries `<meta name="linkseed" content="<slug>">` or a link to the listing page. */
export function hasOwnership(html: string, slug: string): boolean {
  const meta = [...html.matchAll(/<meta\b[^>]*>/gi)].some(
    ([tag]) => attr(tag, 'name')?.toLowerCase() === 'linkseed' && attr(tag, 'content')?.trim() === slug,
  );
  return meta || new RegExp(`href\\s*=\\s*["']?https?://${host}/${slug}/?(?:["'\\s>#?]|$)`, 'i').test(html);
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

/**
 * Loads the maker's page once and looks for the meta tag or badge link.
 * Fails safe: anything but a readable HTML page with the tag stays unverified, with the reason in `note`.
 */
export async function checkOwnership(url: string, slug: string, opts: CheckOpts = {}): Promise<Ownership> {
  const { timeoutMs = 10_000, maxBytes = 1_000_000 } = opts;
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' },
    });
    if (new URL(res.url).protocol !== new URL(url).protocol) return fail('redirect left https', false);
    if (!res.ok) return fail(`page answered HTTP ${res.status}`, false);
    if (!/text\/html|application\/xhtml\+xml/i.test(res.headers.get('content-type') ?? '')) return fail('page is not HTML');
    return hasOwnership(await readCapped(res, maxBytes), slug)
      ? { verified: true, reached: true, note: 'meta tag or badge found' }
      : fail(`no linkseed meta tag or badge link in the first ${maxBytes >= 1e6 ? `${maxBytes / 1e6} MB` : `${maxBytes / 1e3} kB`}`);
  } catch (e) {
    const timeout = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
    return fail(timeout ? `timed out after ${timeoutMs / 1000} s` : `could not load the page (${e instanceof Error ? e.message : String(e)})`, false);
  }
}

import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { checkOwnership, hasOwnership } from '../src/lib/proof.ts';

const SLUG = 'pebble-timer';
const page = (head: string, body = ''): string => `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;

// Local stand-in for a maker's site: one route per case.
const routes: Record<string, (res: import('node:http').ServerResponse) => void> = {
  '/meta': (r) => r.writeHead(200, { 'content-type': 'text/html' }).end(page(`<meta content="${SLUG}" name="linkseed">`)),
  '/badge': (r) => r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(page('', `<a href='https://linkseed.beast.dev/${SLUG}'><img></a>`)),
  '/redirect': (r) => r.writeHead(301, { location: '/meta' }).end(),
  '/away': (r) => r.writeHead(302, { location: 'https://elsewhere.dev/meta' }).end(),
  '/loop': (r) => r.writeHead(302, { location: '/loop' }).end(),
  '/none': (r) => r.writeHead(200, { 'content-type': 'text/html' }).end(page('<meta name="linkseed" content="someone-else">')),
  '/missing': (r) => r.writeHead(404, { 'content-type': 'text/html' }).end(page(`<meta name="linkseed" content="${SLUG}">`)),
  '/json': (r) => r.writeHead(200, { 'content-type': 'application/json' }).end(`{"x":"<meta name=linkseed content=${SLUG}>"}`),
  '/slow': (r) => void setTimeout(() => r.writeHead(200, { 'content-type': 'text/html' }).end(page('')), 1000),
  '/big': (r) => {
    r.writeHead(200, { 'content-type': 'text/html' });
    r.end(page('', `${'x'.repeat(5000)}<meta name="linkseed" content="${SLUG}">`));
  },
};

let server: Server;
let base = '';
before(async () => {
  server = createServer((req, res) => (routes[req.url ?? ''] ?? ((r) => r.writeHead(500).end()))(res));
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());

// The local stand-in lives on 127.0.0.1, so the public-host guard is opened for these tests only.
const open = async (): Promise<boolean> => true;
const check = (path: string) => checkOwnership(`${base}${path}`, SLUG, { timeoutMs: 300, maxBytes: 2000, guard: open });

test('meta tag in any attribute order verifies', async () => {
  assert.deepEqual(await check('/meta'), { verified: true, reached: true, note: 'meta tag or badge found' });
});

test('badge link to the listing page verifies, slash optional, redirects followed', async () => {
  assert.equal((await check('/badge')).verified, true);
  assert.equal((await check('/redirect')).verified, true);
});

test('fails safe with a reason', async () => {
  assert.deepEqual(await check('/none'), { verified: false, reached: true, note: 'no linkseed meta tag or badge link in the first 2 kB' });
  assert.deepEqual(await check('/missing'), { verified: false, reached: false, note: 'page answered HTTP 404' });
  assert.deepEqual(await check('/json'), { verified: false, reached: true, note: 'page is not HTML' });
  assert.deepEqual(await check('/slow'), { verified: false, reached: false, note: 'timed out after 0.3 s' });
  assert.equal((await check('/big')).verified, false, 'proof past the byte cap does not count');
  assert.deepEqual(await check('/away'), { verified: false, reached: false, note: 'page redirects to another site' });
  assert.deepEqual(await check('/loop'), { verified: false, reached: false, note: 'too many redirects' });
  const down = await checkOwnership('http://127.0.0.1:9/', SLUG, { timeoutMs: 300, guard: open });
  assert.equal(down.reached, false);
  assert.match(down.note, /could not load|timed out/);
});

test('private and loopback hosts are never fetched', async () => {
  assert.equal((await checkOwnership(`${base}/meta`, SLUG)).note, 'the address is not a public host');
  assert.equal((await checkOwnership('https://localhost./', SLUG)).note, 'the address is not a public host');
});

test('hostile pages stay linear: 1 MB of unclosed tags scans fast', () => {
  const t0 = performance.now();
  assert.equal(hasOwnership('<meta<a '.repeat(125_000), SLUG), false);
  assert.ok(performance.now() - t0 < 500, 'scan took too long');
});

test('slug must match exactly, look-alike links do not count', () => {
  assert.equal(hasOwnership(`<meta name="linkseed" content="${SLUG}-2">`, SLUG), false);
  assert.equal(hasOwnership(`<a href="https://linkseed.beast.dev/${SLUG}-pro/">`, SLUG), false);
  assert.equal(hasOwnership(`<a href="https://evil.dev/linkseed.beast.dev/${SLUG}/">`, SLUG), false);
  assert.equal(hasOwnership(`<a data-href="x" href=https://linkseed.beast.dev/${SLUG}/>`, SLUG), true);
  assert.equal(hasOwnership(`see https://linkseed.beast.dev/${SLUG}/ in text`, SLUG), false);
});

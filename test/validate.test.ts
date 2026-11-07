import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Listing } from '../src/lib/listing.ts';
import { parse } from '../src/lib/parse.ts';
import { validate, type ValidateCtx } from '../src/lib/validate.ts';

// A body exactly as GitHub renders the issue form.
const body = (o: Partial<Record<'name' | 'url' | 'tagline' | 'description' | 'category', string>> = {}, agree = true): string =>
  [
    `### App name\n\n${o.name ?? 'Pebble Timer'}`,
    `### URL\n\n${o.url ?? 'https://pebbletimer.app/'}`,
    `### Tagline\n\n${o.tagline ?? 'A calm focus timer for your menu bar.'}`,
    `### Description\n\n${o.description ?? 'Start a focus session in one click.\n\nIt stays out of the way until the break.'}`,
    `### Category\n\n${o.category ?? 'Productivity'}`,
    `### Agreement\n\n- [${agree ? 'X' : ' '}] I own or maintain this site, and it follows the rules.`,
  ].join('\n\n');

const listing = (o: Partial<Listing>): Listing => ({
  slug: 'x', issue: 1, author: 'someone', name: 'X', url: 'https://x.dev/', tagline: 't', description: 'd',
  category: 'Other', createdAt: '', updatedAt: '', verified: false, verifiedAt: null, checkNote: '', ...o,
});

const ctx = (o: Partial<ValidateCtx> = {}): ValidateCtx => ({
  listings: [], issue: 7, author: 'maker', accountCreated: '2020-01-01T00:00:00Z', now: new Date('2026-11-07T00:00:00Z'), ...o,
});

const errors = (b: string, c = ctx()): string[] => {
  const v = validate(parse(b), c);
  return v.ok ? [] : v.errors;
};

test('parse reads the issue-form layout, CRLF and _No response_', () => {
  const f = parse(body().replace(/\n/g, '\r\n'));
  assert.equal(f.name, 'Pebble Timer');
  assert.equal(f.category, 'Productivity');
  assert.equal(f.agree, true);
  assert.equal(f.description, 'Start a focus session in one click.\n\nIt stays out of the way until the break.');
  assert.equal(parse(body({ tagline: '_No response_' })).tagline, '');
  assert.deepEqual(parse(null), { name: '', url: '', tagline: '', description: '', category: '', agree: false });
});

test('a valid submission gives clean listing fields', () => {
  const v = validate(parse(body({ name: '  Pebble   Timer ', url: 'https://www.pebbletimer.app/?ref=ls#top' })), ctx());
  assert.ok(v.ok);
  assert.deepEqual(v.data, {
    name: 'Pebble Timer',
    url: 'https://www.pebbletimer.app/?ref=ls',
    tagline: 'A calm focus timer for your menu bar.',
    description: 'Start a focus session in one click.\n\nIt stays out of the way until the break.',
    category: 'Productivity',
  });
});

test('every broken rule is reported at once', () => {
  const e = errors(body({ name: 'P', url: 'http://pebble.app', tagline: 'short', description: 'tiny', category: 'Casino' }, false));
  assert.equal(e.length, 6);
  assert.match(e.join('\n'), /App name must be 2 to 60.*\n.*https:\/\/.*\n.*Tagline.*\n.*Description.*\n.*Category must be one of.*\n.*agreement/);
});

test('URL must be a public https domain', () => {
  for (const url of [
    'not a url',
    'ftp://files.app',
    'https://user:pw@pebble.app',
    'https://pebble.app:8443/',
    'https://127.0.0.1/',
    'https://[::1]/',
    'https://localhost/',
    'https://localhost./',
    'https://metadata.google.internal./',
    'https://printer.local/',
    'https://intranet/',
    `https://pebble.app/${'a'.repeat(200)}`,
  ]) {
    assert.equal(errors(body({ url })).length, 1, url);
  }
});

test('halal rule blocks terms in text and host, not inside other words', () => {
  assert.match(errors(body({ tagline: 'Live betting odds for every match' }))[0] ?? '', /halal.*betting/);
  assert.match(errors(body({ url: 'https://casino.example.com/' }))[0] ?? '', /halal.*casino/);
  assert.match(errors(body({ url: 'https://mycasino-deals.com/' }))[0] ?? '', /halal.*mycasino/);
  assert.match(errors(body({ tagline: 'Best ca​sino odds in town' }))[0] ?? '', /halal.*casino/);
  assert.deepEqual(errors(body({ tagline: 'Alphabet soup for better habits' })), []);
});

test('duplicates, per-author cap and account age', () => {
  const held = listing({ slug: 'pebble', issue: 3, url: 'https://pebbletimer.app' });
  assert.match(errors(body({ url: 'https://www.PebbleTimer.app/' }), ctx({ listings: [{ ...held, verified: true }] }))[0] ?? '', /verified owner at .*\/pebble\//);
  // An unverified holder does not block: the new submitter may take it over by verifying.
  const open = validate(parse(body({ url: 'https://www.PebbleTimer.app/' })), ctx({ listings: [held] }));
  assert.ok(open.ok && open.contested?.slug === 'pebble');
  // Editing your own listing is not a duplicate of itself.
  assert.deepEqual(errors(body(), ctx({ listings: [listing({ issue: 7, url: 'https://pebbletimer.app/' })] })), []);

  const three = [1, 2, 3].map((i) => listing({ issue: i, author: 'maker', url: `https://app${i}.dev/` }));
  assert.match(errors(body(), ctx({ listings: three }))[0] ?? '', /up to 3 listings/);

  assert.match(errors(body(), ctx({ accountCreated: '2026-11-03T00:00:00Z' }))[0] ?? '', /7 days old/);
  assert.match(errors(body(), ctx({ accountCreated: '' }))[0] ?? '', /7 days old/);
});

import { badgeHtml, listingUrl, metaTag, type Listing } from './listing.ts';

/** Issue comments the Action posts; one place for every word a maker reads on GitHub. */
export const messages = {
  listed: (l: Listing): string =>
    [
      `🌱 Listed: ${listingUrl(l.slug)}`,
      '',
      ...(l.verified
        ? ['✅ Ownership verified: your link is followed by search engines.']
        : [
            `Your link is \`rel="ugc nofollow"\` until your site shows it is yours (last check: ${l.checkNote}).`,
            `Add one of these to <${l.url}>, then edit this issue to check again:`,
            '',
            '```html',
            metaTag(l.slug),
            '```',
            '',
            'or the badge:',
            '',
            '```html',
            badgeHtml(l.slug),
            '```',
          ]),
      '',
      'The page goes live within a few minutes. Every listing is rechecked weekly. Edit this issue any time to update it.',
    ].join('\n'),

  invalid: (errors: readonly string[]): string =>
    [
      'Thanks for submitting! This cannot be listed yet:',
      '',
      ...errors.map((e) => `- ${e}`),
      '',
      'Edit this issue to fix it; it is checked again on every edit.',
    ].join('\n'),

  contested: (held: Listing, slug: string): string =>
    [
      `This URL is already listed at ${listingUrl(held.slug)}, not verified yet.`,
      `If the site is yours, add \`${metaTag(slug)}\` to <${held.url}> and edit this issue: a verified owner takes the listing over.`,
    ].join('\n'),

  waiting:
    'Thanks! Your submission passed every check and now waits for a maintainer to approve it. You will get a comment here once it is listed.',
};

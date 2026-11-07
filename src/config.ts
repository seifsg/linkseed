/** Every site-wide setting lives here, so a domain move or moderation change is one edit. */

export const SITE_URL = 'https://linkseed.beast.dev';
export const SITE_NAME = 'Linkseed';
export const REPO = 'seifsg/linkseed';

/** true: a valid submission waits for a maintainer's `approved` label before it is listed. */
export const REQUIRE_APPROVAL = false;

export const SUBMIT_URL = `https://github.com/${REPO}/issues/new?template=submit.yml`;
export const DEPLOY_WORKFLOW = 'preview.yml';

export const CATEGORIES = [
  'Developer tools',
  'Productivity',
  'Design',
  'Education',
  'Writing',
  'Business',
  'Marketing',
  'Health',
  'Lifestyle',
  'Games',
  'Other',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const LIMITS = {
  name: [2, 60],
  tagline: [10, 90],
  description: [30, 600],
  url: 200,
  perAuthor: 3,
  accountDays: 7,
} as const;

export const LABELS = {
  submission: 'submission',
  listed: 'listed',
  invalid: 'invalid',
  spam: 'spam',
  approved: 'approved',
} as const;

/** Whole words that keep a submission out: gambling, adult, intoxicants, fortune-telling, predatory lending. */
export const BLOCKED = new Set([
  'casino', 'gambling', 'gamble', 'bet', 'bets', 'betting', 'bookmaker', 'sportsbook', 'poker', 'slots',
  'lottery', 'jackpot', 'roulette', 'blackjack', 'porn', 'porno', 'xxx', 'nsfw', 'escort', 'escorts',
  'hookup', 'onlyfans', 'sex', 'alcohol', 'beer', 'wine', 'liquor', 'vodka', 'whiskey', 'brewery',
  'cannabis', 'marijuana', 'weed', 'vape', 'tarot', 'horoscope', 'astrology', 'psychic', 'payday',
]);

/** Issue-form field labels (`### <label>` in the issue body) mapped to listing fields. */
export const FORM_FIELDS: Readonly<Record<string, 'name' | 'url' | 'tagline' | 'description' | 'category' | 'agree'>> = {
  'App name': 'name',
  URL: 'url',
  Tagline: 'tagline',
  Description: 'description',
  Category: 'category',
  Agreement: 'agree',
};

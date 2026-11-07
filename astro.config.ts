import { defineConfig } from 'astro/config';
import { SITE_URL } from './src/config.ts';

// Static build; `site` makes canonical and og:image URLs absolute.
export default defineConfig({
  site: SITE_URL,
  trailingSlash: 'always',
  // Inline the one small stylesheet: no render-blocking request before first paint.
  build: { format: 'directory', inlineStylesheets: 'always' },
});

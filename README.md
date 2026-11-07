# Linkseed

Free listing pages for makers: submit your app through a GitHub issue form, get a public page that links to it, and turn that link dofollow by verifying you own the site.

## Run it

Needs Node 22.23.4 or newer.

```sh
npm ci
npm start        # builds and serves the site at http://localhost:4173
npm run dev      # live-reload dev server
npm test         # validation and ownership-check tests
npm run check    # strict TypeScript and Astro diagnostics
```

`npm run build` writes the static site to `dist/`.

## How it works

```text
issue form (label: submission)
  -> .github/workflows/listings.yml  sync job
       -> scripts/sync.ts: validate, check ownership, write listings/<slug>.json, push to main
       -> comment on the issue, label it, dispatch preview.yml (deploy)
weekly: scripts/recheck.ts rechecks every listing's meta tag or badge
```

- Listings live in `listings/*.json`; the site is Astro 7 with strict TypeScript.
- Links render `rel="ugc nofollow"` until the maker's page carries `<meta name="linkseed" content="<slug>">` or the badge link.
- Moderation: a `spam` label or closing an issue as not planned removes its listing. Set `REQUIRE_APPROVAL = true` in `src/config.ts` to list only issues a maintainer labels `approved`.
- Site URL, categories, limits and blocked terms: `src/config.ts`.
- Try sync without GitHub: `npm run sync -- --dry test/fixtures/issues/valid.json`.

🏭 Built with [AI Software Factory](https://softwarefactory.company/) by Seif

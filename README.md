# Cell Anatomy Atlas

Cell Anatomy Atlas is a free research resource for discovering and comparing whole-cell imaging studies: https://cellanatomy.org. Scientific leadership is provided by Mary Mirvis; software development is led by Salvador Escobedo.

The atlas extends the corpus assembled by Mirvis, Weingard, Goodman, and Marshall in [BMC Biology (2026)](https://doi.org/10.1186/s12915-026-02556-0). This release contains the 129-record public corpus exported from the live atlas on October 9, 2026, including original terminology, subsequent studies, public-data links, and curation annotations.

## Local development

Use Node.js 22 or later.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3100. Search, comparisons, analytics, precedent planning, record pages, and public exports use the bundled corpus without a separate API or PostgreSQL service. The newsletter form needs the Cloudflare runtime and a D1 database; Next.js previews display an error instead of saving a signup.

```sh
npm test
npm run typecheck
npm run verify:corpus-mechanics --
npm run build
```

Start a built Next.js preview with `npm run preview`. Run `node scripts/verify-search-metadata.mjs http://127.0.0.1:3100` against that preview.

## Cloudflare deployment

```sh
npm run build:vinext
npx wrangler d1 create cell-anatomy-atlas
```

Replace the placeholder database ID in `wrangler.jsonc` with your own database ID, then run:

```sh
npm run d1:migrate:local
npx wrangler d1 migrations apply SIGNUPS_DB --remote --config wrangler.jsonc
npx wrangler deploy --dry-run --config dist/server/wrangler.json
```

Run `npx wrangler deploy --config dist/server/wrangler.json` when ready to publish your own Worker. Configure custom domains in your own account. This repository contains no production Cloudflare credentials, and its default configuration does not target the production atlas Worker or database. Keep account-specific configuration and credentials outside version control.

## Corpus maintenance

`lib/corpus-data.json` is the versioned public metadata snapshot. Submit record corrections with the dataset identifier, publication or repository source, and a brief explanation. `npm run corpus:export-edge` refreshes the snapshot from the public atlas export; inspect and commit the diff. Set `ATLAS_CORPUS_EXPORT_URL` to use another JSON export endpoint. These refreshes do not deploy the website.

## Privacy

The opt-in newsletter collector stores submitted contact details in the operator's private D1 database. Subscriber data is not included in this repository. The optional server-side arrival counter stores only dataset identifier, UTC date, and aggregate count. It excludes internal navigation, prefetches, and identifiable automated requests, but it does not establish unique human visitors. The production service also uses Cloudflare's aggregate browser analytics. Browser storage remembers newsletter dismissal and submission preferences.

Use `npm run signups:export -- --remote --output=private/beta-signups.csv` to export newsletter records locally. Keep exports outside Git. The `private/` directory and default export filenames are ignored.

## Licensing and citation

Software is licensed under MIT. Corpus metadata is licensed under CC BY 4.0 with source attribution; see `DATA_LICENSE.md`. Linked publications and image datasets retain their own terms. Cite the underlying scoping study and this software; `CITATION.cff` supplies citation metadata. CAOS is maintained separately and is not part of this release.

## Funding

This project was funded by the UCSF Program for Breakthrough Biomedical Research, funded in part by the Sandler Foundation.

This acknowledgment follows the [PBBR award policy](https://pbbr.ucsf.edu/awards/award-policies). The atlas also received support from the National Institute of General Medical Sciences of the National Institutes of Health under award R35GM130327. The content is solely the responsibility of the authors and does not necessarily represent the official views of the National Institutes of Health.

The project team confirmed that both PBBR/Sandler and NIH support contributed to site expenses. NIH's current acknowledgment guidance also calls for project funding amounts and percentages where applicable; those accounting details must come from the award recipient and are not inferred from the public grant record. See https://grants.nih.gov/policy-and-compliance/policy-topics/federal-funding.

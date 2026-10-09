# Contributing

Report dataset corrections, missing public-data links, or interface defects through GitHub issues. Include the record URL, source publication or repository, and the proposed correction. Do not include subscriber addresses, private datasets, credentials, or unpublished correspondence.

Keep metadata changes traceable to their sources. Preserve original reported terms and distinguish reported measurements from inference. Scope code changes to one issue, include relevant checks, and open a pull request. Contributions to software are provided under MIT; contributions to the corpus compilation are provided under CC BY 4.0.

Use precise professional vocabulary for new names. Human-facing interface text and figures use Palatino-family fonts. Maintain keyboard access, server-rendered research content, privacy-respecting collection, and original dataset URLs.

Before opening a pull request, run `npm test`, `npm run typecheck`, `node scripts/verify-corpus-mechanics.mjs`, and `npm run build` as appropriate to the change.

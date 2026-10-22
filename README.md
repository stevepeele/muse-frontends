# Muse Frontends

Single-purpose front ends for [Muse Vault](https://vault.stevepeeleii.com) templates and collections.
One input, one job, the finished result. No chat window, no setup.

- **From Vault:** every Vault template becomes a front end at `#/run/<template-id>`. Every Vault collection (kit) becomes a step-by-step front end at `#/c/<collection-id>`, and each step's result can feed the next.
- **On its own:** turn Vault off and ship only your own front ends from `./interfaces/*.json`.
- **Yours to keep:** MIT licensed. Fork it, change it, deploy it. Runs bill to *your* API key, set in Vercel and never committed.

## Deploy your own

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fstevepeele%2Fmuse-frontends&env=ANTHROPIC_API_KEY&envDescription=Your%20Anthropic%20API%20key.%20Runs%20bill%20to%20your%20account.)

Or by hand:

```bash
git clone https://github.com/<you>/muse-frontends && cd muse-frontends   # after forking
npm install
npm test
npx vercel            # preview
npx vercel env add ANTHROPIC_API_KEY
```

Environment variables:

| Name | Required | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Without it the site still browses; runs return a clear "not configured" message. |
| `ANTHROPIC_MODEL` | no | Defaults to `claude-sonnet-5`. |

## Configure

`muse.config.json`:

```json
{
  "title": "Muse Frontends",
  "tagline": "…",
  "vault": { "enabled": true, "url": "https://vault.stevepeeleii.com", "collections": [], "templates": [] }
}
```

- **Deploy one collection:** `"collections": ["morning-os"]` ships only that collection and its templates.
- **Deploy a few templates:** `"templates": ["deep-research", "cold-email-surgeon"]`.
- **Run independently:** `"enabled": false`. Only `./interfaces` is used.
- **Point at another Vault:** set `url`, then `npm run sync:vault`.

The Vault catalog is a committed snapshot in `data/vault.json`, so builds never depend on the Vault being up. Refresh it with `npm run sync:vault` (reads the Vault's public catalog files).

## Add your own front end

Drop a file in `interfaces/` (see `interfaces/deep-research.json`):

```json
{ "slug": "my-tool", "name": "My Tool", "tagline": "…", "prompt_label": "…", "prompt_placeholder": "…",
  "example_prompts": [], "max_tokens": 2000, "accent_color": "#e8b34b", "system_prompt": "…" }
```

A local interface with the same id as a Vault template overrides it.

## How it works

- `src/` React + Vite UI (hash routes, no router dependency).
- `api/run.js` Vercel function. Validates input, rate-limits per IP (10/hour, per instance), calls the model with the template, and streams the result back as SSE.
- `scripts/sync-vault.mjs` pulls the Vault catalog. `scripts/prepare.mjs` bundles the catalog for the UI at build time.

## Develop

```bash
npm install
npm test          # vitest: data, API, UI
npm run build
npx vercel dev    # UI + /api/run locally
```

## License

MIT. See [LICENSE](LICENSE).

# Muse Frontends v0.2: Plan

## What exists (discovery, 2026-10-22)
- **Vault** = Vercel project `muse-templates` (team spiix) → vault.stevepeeleii.com. Static HTML + Tailwind CDN + Supabase (community/email capture). CLI deploys, no Git repo. Catalog ships as public JS files: `templates-a…h2.js` (`TEMPLATES`, 163 entries, 162 unique ids; `weekly-review` is duplicated) and `kits.js` (`KITS`, 16 collections; nodes reference template ids, plus edges and orchestration).
- **Muse Frontends v0.1** = Vercel project `muse-frontends` → muse-frontends.vercel.app + try.stevepeeleii.com (domain attached and verified). Built 2026-10-14. Static HTML plus `api/run.js`, 3 hand-written interfaces (deep-research, cold-email-surgeon, second-in-command), BYOK Anthropic. **No env vars set**, so runs return `not_configured`. The source existed only in Vercel deployment files; the GitHub repo named in app.json (`stevepeele/muse-frontends`) does not exist.

## MVP scope (v0.2)
1. Every Vault template is a front end (`#/run/<id>`). Every Vault collection is a stepwise front end (`#/c/<id>`), with "send result to next step" chaining.
2. Keeps the 3 v0.1 hand-tuned interfaces as "Featured". They override Vault templates that share an id.
3. Independent mode: `vault.enabled=false` → only `./interfaces`.
4. Scoped deploys: ship one collection or a template list via `muse.config.json`.
5. Fork and deploy: MIT, Deploy-to-Vercel button, README.

Out of scope: auth, per-user keys in the browser, saved history, Supabase, analytics (v0.1 had PostHog; not carried over until Steve confirms the key and consent).

## Architecture
- React 18 + Vite static UI. The Vercel function `api/run.js` is ported from v0.1 (same validation, rate limit, and SSE streaming) and resolves ids from local interfaces or the Vault snapshot.
- Vault integration is **pull, not runtime-coupled**: `scripts/sync-vault.mjs` fetches Vault's public catalog JS, evaluates it in an empty `node:vm` context, normalizes it, and writes `data/vault.json` (committed). Builds and runs never depend on Vault uptime. Vault stays untouched.
- Future: when Vault exposes a `catalog.json` (recommended), sync reads that instead of evaluating JS.

## Deploy path
- Now: Vercel **preview** on existing project `muse-frontends` (no `--prod`, so try.stevepeeleii.com is unaffected).
- Production (Steve): approve the public repo, set `ANTHROPIC_API_KEY`, then `vercel --prod` (or promote the preview). Optionally add a "Open as front end" link on Vault cards → `try.stevepeeleii.com/#/run/<id>`.

## Testing
Vitest: normalization and dedupe, slug safety, local override, real-snapshot integrity (every collection step resolves), API (405/503/400 plus a streamed run with a mocked provider), UI gallery and search. Build must pass.

## Risks
- Shared key abuse on a public deployment → per-IP rate limit is per-instance only; add a spend cap on the key or Vercel KV/firewall limits before promoting.
- Vault catalog format is not a contract (JS globals) → snapshot plus a recommended catalog.json.
- Some templates are desktop or cron oriented and don't make sense as one-shot prompts → featured list plus scoping.
- Public copy: kept product-focused, with no "AI-powered" framing.

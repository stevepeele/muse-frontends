// Pull templates + collections from a Muse Vault site into data/vault.json.
// Vault ships its catalog as plain JS files (TEMPLATES_A..H2, KITS). We evaluate
// them in an isolated node:vm context with no globals, then keep only data fields.
// Usage: VAULT_URL=https://vault.stevepeeleii.com node scripts/sync-vault.mjs
import vm from 'node:vm';
import fs from 'node:fs';
import { normalizeVault } from '../src/lib/vault.js';

const BASE = (process.env.VAULT_URL || 'https://vault.stevepeeleii.com').replace(/\/$/, '');
const FILES = ['templates-a', 'templates-b', 'templates-c', 'templates-d', 'templates-e',
  'templates-f', 'templates-g', 'templates-h1', 'templates-h2', 'templates', 'kits'];

const get = async (f) => {
  const r = await fetch(`${BASE}/${f}.js`);
  if (!r.ok) throw new Error(`${f}.js -> ${r.status}`);
  return r.text();
};

const src = (await Promise.all(FILES.map(get))).join('\n;\n') +
  '\n;globalThis.__out = { templates: TEMPLATES, kits: KITS };';
const ctx = vm.createContext(Object.create(null));
vm.runInContext(src, ctx, { timeout: 2000 });
const data = normalizeVault(JSON.parse(JSON.stringify(ctx.__out)), BASE);
for (const out of ['data/vault.json', 'public/data/vault.json']) {
  fs.mkdirSync(out.replace(/\/[^/]+$/, ''), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(data));
}
console.log(`synced ${data.templates.length} templates, ${data.collections.length} collections from ${BASE}`);

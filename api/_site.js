// Loads the site catalog on the server: local interfaces + (optionally) a Vault snapshot.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SLUG_RE } from '../src/lib/vault.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p, d) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8')); } catch { return d; } };

export function loadSite() {
  const config = readJson('muse.config.json', {});
  const dir = path.join(ROOT, 'interfaces');
  const interfaces = (fs.existsSync(dir) ? fs.readdirSync(dir) : [])
    .filter((f) => f.endsWith('.json')).map((f) => readJson('interfaces/' + f, null))
    .filter((c) => c && SLUG_RE.test(c.slug || '') && typeof c.system_prompt === 'string' && c.system_prompt.length);
  let templates = [], collections = [], vaultSource = null, syncedAt = null;
  if (!config.vault || config.vault.enabled !== false) {
    const v = readJson('data/vault.json', { templates: [], collections: [] });
    const onlyC = config.vault?.collections || [], onlyT = config.vault?.templates || [];
    collections = onlyC.length ? v.collections.filter((c) => onlyC.includes(c.id)) : v.collections;
    const keep = new Set([...onlyT, ...collections.flatMap((c) => c.steps.map((s) => s.id))]);
    templates = onlyC.length || onlyT.length ? v.templates.filter((t) => keep.has(t.id)) : v.templates;
    vaultSource = v.source; syncedAt = v.syncedAt;
  }
  return { title: config.title || 'Muse Frontends', tagline: config.tagline || '', vaultSource, syncedAt, interfaces, templates, collections };
}

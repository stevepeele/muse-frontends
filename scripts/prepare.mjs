// Build step: bundle local interfaces + config into public/data for the UI.
// Vault data comes from data/vault.json (committed snapshot; refresh with `npm run sync:vault`).
// Independent mode: set vault.enabled=false in muse.config.json and only ./interfaces is used.
import fs from 'node:fs';
import { loadSite } from '../api/_site.js';
const site = loadSite();
fs.mkdirSync('public/data', { recursive: true });
fs.writeFileSync('public/data/site.json', JSON.stringify(site));
console.log(`prepared ${site.interfaces.length} interfaces, ${site.templates.length} templates, ${site.collections.length} collections`);

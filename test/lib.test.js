import { describe, it, expect } from 'vitest';
import { normalizeVault, resolveInterface, templateToInterface, search } from '../src/lib/vault.js';
import { loadSite } from '../api/_site.js';

describe('vault normalization', () => {
  const raw = { templates: [{ id: 'a', title: 'A', content: 'do A' }, { id: 'BAD ID', title: 'x' }],
    kits: [{ id: 'k', name: 'K', nodes: [{ id: 'a', role: 'r' }, { id: 'missing' }] }] };
  const v = normalizeVault(raw, 'x');
  it('drops invalid ids and dangling collection steps', () => {
    expect(v.templates.map((t) => t.id)).toEqual(['a']);
    expect(v.collections[0].steps).toEqual([{ id: 'a', role: 'r' }]);
  });
  it('builds a runnable interface from a template', () => {
    const i = templateToInterface(v.templates[0]);
    expect(i.system_prompt).toContain('do A');
    expect(i.max_tokens).toBeGreaterThan(0);
  });
  it('prefers local interfaces and rejects bad slugs', () => {
    const site = { interfaces: [{ slug: 'a', name: 'local' }], templates: v.templates };
    expect(resolveInterface('a', site).name).toBe('local');
    expect(resolveInterface('../etc', site)).toBeNull();
    expect(resolveInterface('nope', site)).toBeNull();
  });
  it('searches case-insensitively', () => {
    expect(search([{ t: 'Deep Research' }, { t: 'x' }], 'deep', ['t'])).toHaveLength(1);
  });
});

describe('site catalog (real Vault snapshot)', () => {
  const site = loadSite();
  it('loads local interfaces and the vault snapshot', () => {
    expect(site.interfaces.length).toBeGreaterThanOrEqual(3);
    expect(site.templates.length).toBeGreaterThan(100);
    expect(site.collections.length).toBeGreaterThan(5);
  });
  it('every collection step resolves to a runnable template', () => {
    for (const c of site.collections) for (const s of c.steps) expect(resolveInterface(s.id, site)).not.toBeNull();
  });
});

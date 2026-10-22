// Shared (browser + node) data shaping. No dependencies.
export const SLUG_RE = /^[a-z0-9-]{1,80}$/;

export function normalizeVault(raw, source) {
  const seen = new Set();
  // Vault ids are not guaranteed unique; keep the first occurrence.
  const templates = (raw.templates || []).filter((t) => t && SLUG_RE.test(t.id || '') && !seen.has(t.id) && seen.add(t.id)).map((t) => ({
    id: t.id, title: String(t.title || t.id), category: String(t.category || 'Other'),
    track: String(t.track || ''), tagline: String(t.tagline || ''),
    description: String(t.description || ''), content: String(t.content || ''),
    version: String(t.version || '1.0'),
  }));
  const ids = new Set(templates.map((t) => t.id));
  const collections = (raw.kits || raw.collections || []).filter((k) => k && SLUG_RE.test(k.id || '')).map((k) => ({
    id: k.id, name: String(k.name || k.id), icon: String(k.icon || ''), tagline: String(k.tagline || ''),
    framework: String(k.framework || ''),
    steps: (k.nodes || []).filter((n) => ids.has(n.id)).map((n) => ({ id: n.id, role: String(n.role || '') })),
  }));
  return { source, syncedAt: new Date().toISOString(), templates, collections };
}

// Turn a Vault template into a single-purpose interface config.
export function templateToInterface(t) {
  return {
    slug: t.id, name: t.title, tagline: t.tagline, vault_template_id: t.id,
    prompt_label: 'Your input', prompt_placeholder: `Give "${t.title}" one task or paste what it should work on.`,
    example_prompts: [], max_tokens: 2000, accent_color: '#e8b34b',
    system_prompt:
      `You are running the "${t.title}" template through a single-purpose interface. ` +
      'Apply the template below to the user\'s input and return the finished result. ' +
      'Do not ask clarifying questions; state any assumptions briefly at the top.\n\n' +
      `--- TEMPLATE ---\n${t.content}`,
  };
}

export function resolveInterface(id, { interfaces = [], templates = [] }) {
  if (!SLUG_RE.test(id || '')) return null;
  const own = interfaces.find((i) => i.slug === id);
  if (own) return own;
  const t = templates.find((x) => x.id === id);
  return t ? templateToInterface(t) : null;
}

export function search(items, q, fields) {
  const s = (q || '').trim().toLowerCase();
  if (!s) return items;
  return items.filter((i) => fields.some((f) => String(i[f] || '').toLowerCase().includes(s)));
}

import React, { useEffect, useMemo, useState } from 'react';
import { resolveInterface, search } from './lib/vault.js';
import { runInterface, ERRORS } from './lib/stream.js';

const REPO = 'https://github.com/stevepeele/muse-frontends';
const DEPLOY = `https://vercel.com/new/clone?repository-url=${encodeURIComponent(REPO)}&env=ANTHROPIC_API_KEY&envDescription=${encodeURIComponent('Your Anthropic API key. Runs bill to your account.')}`;

export function useHash() {
  const [h, setH] = useState(() => window.location.hash.slice(1) || '/');
  useEffect(() => { const f = () => setH(window.location.hash.slice(1) || '/'); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  return h;
}

export default function App({ initialSite }) {
  const [site, setSite] = useState(initialSite || null);
  const [err, setErr] = useState('');
  useEffect(() => { if (!site) fetch('/data/site.json').then((r) => r.json()).then(setSite).catch(() => setErr('Could not load the catalog.')); }, []);
  const route = useHash();
  if (err) return <Shell><p className="error">{err}</p></Shell>;
  if (!site) return <Shell><p className="muted">Loading…</p></Shell>;
  const [, kind, id] = route.split('/');
  if (kind === 'run') return <Shell site={site}><Runner site={site} id={id} /></Shell>;
  if (kind === 'c') return <Shell site={site}><Collection site={site} id={id} /></Shell>;
  return <Shell site={site}><Gallery site={site} /></Shell>;
}

function Shell({ site, children }) {
  return (
    <div className="wrap">
      <header className="top">
        <a href="#/" className="brand">{site?.title || 'Muse Frontends'}</a>
        <nav>
          {site?.vaultSource && <a href={site.vaultSource} target="_blank" rel="noreferrer">Vault ↗</a>}
          <a href={REPO} target="_blank" rel="noreferrer">Fork on GitHub</a>
          <a className="btn" href={DEPLOY} target="_blank" rel="noreferrer">Deploy your own</a>
        </nav>
      </header>
      <main>{children}</main>
      <footer className="muted">Open source (MIT). Every template runs on the deployer's own API key.{site?.syncedAt && ` Vault catalog synced ${site.syncedAt.slice(0, 10)}.`}</footer>
    </div>
  );
}

export function Gallery({ site }) {
  const [tab, setTab] = useState(site.collections.length ? 'collections' : 'interfaces');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const cats = useMemo(() => [...new Set(site.templates.map((t) => t.category))].sort(), [site]);
  const temps = search(site.templates, q, ['title', 'tagline', 'category']).filter((t) => !cat || t.category === cat);
  return (
    <>
      <section className="hero">
        <h1>One job per screen.</h1>
        <p>{site.tagline} Pick a front end, type one input, get the finished result. No setup, no chat history.</p>
      </section>
      <div className="tabs" role="tablist">
        {site.interfaces.length > 0 && <Tab on={tab === 'interfaces'} set={() => setTab('interfaces')}>Featured ({site.interfaces.length})</Tab>}
        {site.collections.length > 0 && <Tab on={tab === 'collections'} set={() => setTab('collections')}>Collections ({site.collections.length})</Tab>}
        {site.templates.length > 0 && <Tab on={tab === 'templates'} set={() => setTab('templates')}>All templates ({site.templates.length})</Tab>}
      </div>
      {tab === 'templates' && (
        <div className="filters">
          <input aria-label="Search templates" placeholder="Search templates" value={q} onChange={(e) => setQ(e.target.value)} />
          <select aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All categories</option>{cats.map((c) => <option key={c}>{c}</option>)}</select>
        </div>
      )}
      <div className="grid">
        {tab === 'interfaces' && site.interfaces.map((i) => <Card key={i.slug} href={`#/run/${i.slug}`} kicker="Featured" title={i.name} body={i.tagline} />)}
        {tab === 'collections' && site.collections.map((c) => <Card key={c.id} href={`#/c/${c.id}`} kicker={`${c.icon} ${c.steps.length} steps`} title={c.name} body={c.tagline} />)}
        {tab === 'templates' && temps.map((t) => <Card key={t.id} href={`#/run/${t.id}`} kicker={t.category} title={t.title} body={t.tagline} />)}
      </div>
    </>
  );
}

const Tab = ({ on, set, children }) => <button role="tab" aria-selected={on} className={on ? 'tab on' : 'tab'} onClick={set}>{children}</button>;
const Card = ({ href, kicker, title, body }) => <a className="card" href={href}><span className="kicker">{kicker}</span><h3>{title}</h3><p>{body}</p><span className="open">Open →</span></a>;

export function Runner({ site, id, seed = '', onDone, compact }) {
  const cfg = resolveInterface(id, site);
  const [prompt, setPrompt] = useState(seed);
  const [out, setOut] = useState('');
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');
  useEffect(() => { setPrompt(seed); setOut(''); setState('idle'); setError(''); }, [id, seed]);
  if (!cfg) return <p className="error">That front end does not exist on this deployment. <a href="#/">Back to all</a></p>;
  const go = async (e) => {
    e.preventDefault(); setState('running'); setError(''); setOut('');
    try { const all = await runInterface(cfg.slug, prompt, setOut); setState('done'); onDone && onDone(all); }
    catch (x) { setError(ERRORS[x.message] || x.message); setState('idle'); }
  };
  return (
    <section className="runner" style={{ '--accent': cfg.accent_color || '#e8b34b' }}>
      {!compact && <><a href="#/" className="muted">← All front ends</a><h1>{cfg.name}</h1><p className="muted">{cfg.tagline}</p></>}
      <form onSubmit={go}>
        <label htmlFor={`p-${id}`}>{cfg.prompt_label}</label>
        <textarea id={`p-${id}`} rows={5} maxLength={4000} placeholder={cfg.prompt_placeholder} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        {cfg.example_prompts?.length > 0 && <div className="examples">{cfg.example_prompts.map((p) => <button type="button" key={p} onClick={() => setPrompt(p)}>{p.slice(0, 70)}…</button>)}</div>}
        <button className="btn" disabled={state === 'running' || !prompt.trim()}>{state === 'running' ? 'Running…' : 'Run'}</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      {out && <div className="output"><pre>{out}</pre><button type="button" onClick={() => navigator.clipboard?.writeText(out)}>Copy</button></div>}
    </section>
  );
}

export function Collection({ site, id }) {
  const c = site.collections.find((x) => x.id === id);
  const [step, setStep] = useState(0);
  const [carry, setCarry] = useState('');
  if (!c) return <p className="error">That collection does not exist on this deployment. <a href="#/">Back to all</a></p>;
  const s = c.steps[step];
  return (
    <section>
      <a href="#/" className="muted">← All front ends</a>
      <h1>{c.icon} {c.name}</h1>
      <p className="muted">{c.tagline}</p>
      <ol className="steps">
        {c.steps.map((x, i) => <li key={x.id}><button className={i === step ? 'on' : ''} onClick={() => setStep(i)}>{i + 1}. {site.templates.find((t) => t.id === x.id)?.title || x.id}</button><small>{x.role}</small></li>)}
      </ol>
      {s && <Runner compact site={site} id={s.id} seed={carry} onDone={(o) => step < c.steps.length - 1 && setCarry(o.slice(0, 4000))} />}
      {carry && step < c.steps.length - 1 && <button className="btn ghost" onClick={() => setStep(step + 1)}>Send result to step {step + 2} →</button>}
    </section>
  );
}

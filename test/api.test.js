import { describe, it, expect, vi, afterEach } from 'vitest';
import { Readable } from 'node:stream';
import handler from '../api/run.js';

function call(body, method = 'POST') {
  const req = Readable.from([typeof body === 'string' ? body : JSON.stringify(body)]);
  Object.assign(req, { method, headers: { 'x-forwarded-for': String(Math.random()) }, socket: {} });
  return new Promise((resolve) => {
    let status = 200, chunks = '';
    const res = { headersSent: false,
      writeHead(s) { status = s; this.headersSent = true; }, setHeader() {}, write(c) { chunks += c; },
      end(c) { if (c) chunks += c; resolve({ status, body: chunks }); } };
    Object.defineProperty(res, 'statusCode', { set(v) { status = v; }, get() { return status; } });
    handler(req, res);
  });
}
afterEach(() => { delete process.env.ANTHROPIC_API_KEY; vi.unstubAllGlobals(); });

describe('/api/run', () => {
  it('405 on GET', async () => expect((await call('', 'GET')).status).toBe(405));
  it('503 when no key', async () => expect((await call({ interface: 'deep-research', prompt: 'x' })).body).toContain('not_configured'));
  it('400 on unknown interface', async () => {
    process.env.ANTHROPIC_API_KEY = 'k';
    expect((await call({ interface: 'nope-nope', prompt: 'x' })).status).toBe(400);
  });
  it('streams a Vault template through the provider', async () => {
    process.env.ANTHROPIC_API_KEY = 'k';
    const sse = 'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"hi"}}\n\n';
    const fetchMock = vi.fn(async () => new Response(sse, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const r = await call({ interface: 'morning-briefing', prompt: 'plan my day' });
    expect(r.body).toContain('"text":"hi"');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).system).toContain('TEMPLATE');
  });
});

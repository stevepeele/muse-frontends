/* Muse Frontends — template execution endpoint.
 *
 * POST /api/run  { interface: "<slug>", prompt: "<user prompt>" }
 *
 * Loads interfaces/<slug>.json from the repo, executes its system_prompt
 * against the Anthropic Messages API using the deployer's key
 * (ANTHROPIC_API_KEY env var — never in the repo), and streams the
 * response back to the browser as SSE:  data: {"text": "..."}  …  data: [DONE]
 *
 * No dependencies. Native fetch only.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SLUG_RE = /^[a-z0-9-]+$/;
const MAX_PROMPT_CHARS = 4000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 10; // requests per IP per window
const ANTHROPIC_VERSION = '2023-06-01';

const hits = new Map(); // ip -> [timestamps]

function clientIp(req) {
  const fwd = req.headers && req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  if (req.socket && req.socket.remoteAddress) return req.socket.remoteAddress;
  return 'unknown';
}

function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) return true;
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function loadConfig(slug) {
  const dir = path.join(__dirname, '..', 'interfaces');
  const file = path.join(dir, slug + '.json');
  // Belt-and-braces against traversal (slug is also regex-validated).
  if (path.dirname(file) !== dir) return null;
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const cfg = JSON.parse(raw);
    if (!cfg || typeof cfg.system_prompt !== 'string' || !cfg.system_prompt.length) return null;
    if (!Number.isFinite(cfg.max_tokens) || cfg.max_tokens <= 0) return null;
    return cfg;
  } catch (e) {
    return null;
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 1024 * 1024) reject(new Error('body too large'));
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return sendJson(res, 503, { error: 'not_configured' });
  }

  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch (e) {
    return sendJson(res, 400, { error: 'invalid_json' });
  }

  const slug = body && body.interface;
  const prompt = body && body.prompt;

  if (!SLUG_RE.test(slug || '')) {
    return sendJson(res, 400, { error: 'unknown_interface' });
  }
  const cfg = loadConfig(slug);
  if (!cfg) {
    return sendJson(res, 400, { error: 'unknown_interface' });
  }
  if (typeof prompt !== 'string' || !prompt.trim()) {
    return sendJson(res, 400, { error: 'empty_prompt' });
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    return sendJson(res, 400, { error: 'prompt_too_long' });
  }

  if (rateLimited(clientIp(req))) {
    return sendJson(res, 429, { error: 'rate_limited' });
  }

  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

  let upstream;
  try {
    upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      // NOTE: no temperature/top_p — current Claude models 400 on non-default values.
      body: JSON.stringify({
        model,
        max_tokens: cfg.max_tokens,
        system: cfg.system_prompt,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      }),
    });
  } catch (e) {
    return sendJson(res, 502, { error: 'provider_unreachable' });
  }

  if (!upstream.ok || !upstream.body) {
    let detail = 'provider_error';
    try {
      const errJson = await upstream.json();
      if (errJson && errJson.error && errJson.error.message) {
        detail = 'provider_error: ' + String(errJson.error.message).slice(0, 200);
      }
    } catch (e) { /* keep generic */ }
    return sendJson(res, 502, { error: detail });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const sendText = (text) => {
    res.write('data: ' + JSON.stringify({ text }) + '\n\n');
  };

  try {
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const payload = trimmed.slice(6);
        if (payload === '[DONE]') continue;
        let evt;
        try {
          evt = JSON.parse(payload);
        } catch (e) {
          continue;
        }
        if (evt.type === 'error') {
          throw new Error(
            (evt.error && evt.error.message) ? String(evt.error.message).slice(0, 200) : 'stream_error'
          );
        }
        if (
          evt.type === 'content_block_delta' &&
          evt.delta &&
          evt.delta.type === 'text_delta' &&
          typeof evt.delta.text === 'string'
        ) {
          sendText(evt.delta.text);
        }
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (e) {
    // Stream died mid-flight. If headers already went out, close the stream
    // with an error event the client can surface; otherwise JSON.
    try {
      if (!res.headersSent) {
        return sendJson(res, 502, { error: 'provider_error: ' + e.message });
      }
      res.write('data: ' + JSON.stringify({ error: e.message }) + '\n\n');
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (ignored) { /* socket already gone */ }
  }
};

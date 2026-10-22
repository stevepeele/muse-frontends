// Reads the SSE stream from /api/run. Calls onText for each chunk.
export async function runInterface(id, prompt, onText, fetchImpl = fetch) {
  const r = await fetchImpl('/api/run', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ interface: id, prompt }),
  });
  if (!r.ok) {
    let e = 'request_failed';
    try { e = (await r.json()).error || e; } catch {}
    throw new Error(e);
  }
  const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = '', all = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n'); buf = lines.pop();
    for (const l of lines) {
      if (!l.startsWith('data: ')) continue;
      const p = l.slice(6); if (p === '[DONE]') continue;
      const evt = JSON.parse(p);
      if (evt.error) throw new Error(evt.error);
      if (evt.text) { all += evt.text; onText(all); }
    }
  }
  return all;
}

export const ERRORS = {
  not_configured: 'This deployment has no model key yet. The owner sets ANTHROPIC_API_KEY in Vercel, then it runs.',
  rate_limited: 'Too many runs from this address. Try again in an hour.',
  prompt_too_long: 'That input is over 4,000 characters. Trim it and try again.',
  empty_prompt: 'Type something first.',
  unknown_interface: 'That front end does not exist on this deployment.',
};

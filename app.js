/* Muse Frontends — interface renderer + streaming runner. No dependencies. */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var slug = params.get('i');

  var titleEl = document.getElementById('title');
  var taglineEl = document.getElementById('tagline');
  var labelEl = document.getElementById('promptLabel');
  var promptEl = document.getElementById('prompt');
  var chipsEl = document.getElementById('chips');
  var runBtn = document.getElementById('runBtn');
  var hintEl = document.getElementById('hint');
  var outputEl = document.getElementById('output');
  var copyBtn = document.getElementById('copyBtn');
  var errorBox = document.getElementById('errorBox');
  var footEl = document.getElementById('ifaceFoot');

  var rawText = '';
  var running = false;

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* Plain-text rendering: paragraphs + line breaks. No markdown parsing. */
  function render(text, streaming) {
    var html = escapeHtml(text)
      .split(/\n{2,}/)
      .map(function (p) { return '<p>' + p.replace(/\n/g, '<br>') + '</p>'; })
      .join('');
    if (streaming) html += '<span class="cursor"></span>';
    outputEl.innerHTML = html;
    outputEl.scrollTop = outputEl.scrollHeight;
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.add('show');
  }

  function clearError() {
    errorBox.textContent = '';
    errorBox.classList.remove('show');
  }

  function setRunning(state) {
    running = state;
    runBtn.disabled = state;
    runBtn.textContent = state ? 'Running…' : 'Run';
    hintEl.textContent = state
      ? 'Generating — the template is working.'
      : 'Streams the result as it\u2019s generated.';
  }

  function validSlug(s) {
    return typeof s === 'string' && /^[a-z0-9-]+$/.test(s);
  }

  async function run() {
    if (running) return;
    var prompt = promptEl.value.trim();
    if (!prompt) {
      showError('Type a prompt first — the template needs something to work with.');
      promptEl.focus();
      return;
    }
    clearError();
    setRunning(true);
    rawText = '';
    copyBtn.style.display = 'none';
    render('', true);

    try {
      var resp = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interface: slug, prompt: prompt })
      });

      if (!resp.ok) {
        var errBody = await resp.json().catch(function () { return {}; });
        throw new Error(errBody.error || ('Request failed (' + resp.status + ')'));
      }

      var reader = resp.body.getReader();
      var decoder = new TextDecoder();
      var buf = '';
      for (;;) {
        var chunk = await reader.read();
        if (chunk.done) break;
        buf += decoder.decode(chunk.value, { stream: true });
        var lines = buf.split('\n');
        buf = lines.pop();
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();
          if (line.indexOf('data: ') !== 0) continue;
          var payload = line.slice(6);
          if (payload === '[DONE]') continue;
          var evt = null;
          try { evt = JSON.parse(payload); }
          catch (e) { /* partial line; ignore */ }
          if (!evt) continue;
          if (evt.error) throw new Error(evt.error);
          if (evt.text) {
            rawText += evt.text;
            render(rawText, true);
          }
        }
      }
      render(rawText, false);
      if (rawText) copyBtn.style.display = '';
    } catch (e) {
      showError(e.message || 'Something went wrong running the template.');
      outputEl.innerHTML = '<span class="placeholder">The result lands here.</span>';
    } finally {
      setRunning(false);
    }
  }

  copyBtn.addEventListener('click', function () {
    if (!rawText) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(rawText).then(function () {
        copyBtn.textContent = 'Copied';
        setTimeout(function () { copyBtn.textContent = 'Copy'; }, 1500);
      });
    } else {
      var ta = document.createElement('textarea');
      ta.value = rawText;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
      copyBtn.textContent = 'Copied';
      setTimeout(function () { copyBtn.textContent = 'Copy'; }, 1500);
    }
  });

  runBtn.addEventListener('click', run);
  promptEl.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') run();
  });

  /* ---- boot: load the interface config ---- */
  if (!validSlug(slug)) {
    titleEl.textContent = 'Unknown interface';
    taglineEl.textContent = 'Pick one from the gallery.';
    showError('No interface selected. Go back and pick one.');
    runBtn.disabled = true;
    return;
  }

  fetch('interfaces/' + slug + '.json')
    .then(function (r) {
      if (!r.ok) throw new Error('not found');
      return r.json();
    })
    .then(function (cfg) {
      document.title = cfg.name + ' — Muse Frontends';
      document.documentElement.style.setProperty('--accent', cfg.accent_color || '#e8b34b');
      titleEl.textContent = cfg.name;
      taglineEl.textContent = cfg.tagline;
      labelEl.textContent = cfg.prompt_label;
      promptEl.placeholder = cfg.prompt_placeholder;
      footEl.innerHTML = 'Powered by the \u2018' + escapeHtml(cfg.name) +
        '\u2019 template from <a href="https://vault.stevepeeleii.com">Muse Vault</a>.';
      chipsEl.innerHTML = '';
      (cfg.example_prompts || []).forEach(function (ex) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip';
        b.textContent = ex.length > 90 ? ex.slice(0, 90) + '…' : ex;
        b.title = ex;
        b.addEventListener('click', function () {
          promptEl.value = ex;
          run();
        });
        chipsEl.appendChild(b);
      });
    })
    .catch(function () {
      titleEl.textContent = 'Interface not found';
      taglineEl.textContent = '\u2018' + slug + '\u2019 doesn\u2019t exist in this deployment.';
      runBtn.disabled = true;
    });
})();

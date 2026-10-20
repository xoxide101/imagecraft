/* ImageCraft debug log (window.ICLOG), loaded first so it catches everything: page errors, failed promises,
   console errors and warnings (the AI library reports there), and ImageCraft's own notes (tools run and how long they
   took, files opened and saved). The last 300 entries are kept in this browser, so they survive a reload or a crash.
     ICLOG.add(level 'error' | 'warn' | 'info', message, detail?)   ICLOG.entries()   ICLOG.clear()   ICLOG.onChange(fn)
     ICLOG.text() → the whole log as plain text (with the browser and computer at the top), for copying or saving */
(function () {
  'use strict';
  const KEY = 'imagecraft-log', MAX = 300, listeners = new Set();
  let list = []; const START = Date.now();
  try { list = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { list = []; }
  let saveT = null;
  const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX))); } catch (e) { /* full or blocked */ } }, 300); };
  const str = (v) => { if (v == null) return ''; if (v instanceof Error) return (v.stack || v.message || String(v)); if (typeof v === 'string') return v; try { return JSON.stringify(v); } catch (e) { return String(v); } };
  function add(level, message, detail) {
    const e = { t: Date.now(), level, msg: String(message || '').slice(0, 2000), detail: str(detail).slice(0, 6000) };
    list.push(e); if (list.length > MAX) list = list.slice(-MAX);
    save(); listeners.forEach((f) => { try { f(e); } catch (err) { /* ignore */ } });
    return e;
  }
  window.addEventListener('error', (ev) => add('error', ev.message || 'Error', ev.error || `${ev.filename || ''}:${ev.lineno || ''}:${ev.colno || ''}`));
  window.addEventListener('unhandledrejection', (ev) => { const r = ev.reason; add('error', (r && r.message) || String(r) || 'A promise failed', r); });
  // console errors and warnings are copied into the log too (and still go to the console)
  let ortNotes = 0, ortT = null;
  ['error', 'warn'].forEach((lv) => {
    const orig = console[lv].bind(console);
    console[lv] = (...a) => { try {
      // the AI runtime's own notes ("[W:onnxruntime …] could not constant fold …") are not errors: counted, not listed
      if (typeof a[0] === 'string' && /\[W:onnxruntime|\[I:onnxruntime/.test(a[0])) { ortNotes++; clearTimeout(ortT); ortT = setTimeout(() => { add('info', `AI runtime notes: ${ortNotes} (harmless)`); ortNotes = 0; }, 800); orig(...a); return; }
      // the face finder (MediaPipe) prints its start-up notes as errors: "INFO: Created TensorFlow Lite XNNPACK delegate…"
      if (typeof a[0] === 'string' && /^INFO:/.test(a[0])) { add('info', a[0].slice(0, 300)); orig(...a); return; }
      add(lv, a.map((x) => (x instanceof Error ? x.message : typeof x === 'string' ? x : str(x))).join(' ').slice(0, 2000), a.find((x) => x instanceof Error)); } catch (e) { /* ignore */ } orig(...a); };
  });
  const env = () => {
    const n = navigator, lines = [`ImageCraft debug log — ${new Date().toISOString()}`, `Page: ${location.protocol}//${location.pathname.split('/').slice(-2).join('/')}`, `Browser: ${n.userAgent}`, `Screen: ${screen.width} × ${screen.height} at ${devicePixelRatio}×, window ${innerWidth} × ${innerHeight}`, `Processor threads: ${n.hardwareConcurrency || '?'}, memory: ${n.deviceMemory ? n.deviceMemory + ' GB or more' : '?'}`];
    try { const f = window.CRAFTAI && CRAFTAI.found(); if (f) lines.push(`AI: ${f.webgpu ? 'WebGPU on ' + (f.gpu || 'a graphics card') : 'no WebGPU (processor only)'}, level ${f.level}`); } catch (e) { /* ignore */ }
    return lines.join('\n');
  };
  const time = (t) => { const d = new Date(t); return d.toTimeString().slice(0, 8) + '.' + String(d.getMilliseconds()).padStart(3, '0'); };
  const text = () => env() + '\n\n' + list.map((e) => `${new Date(e.t).toISOString().slice(0, 10)} ${time(e.t)} ${e.level.toUpperCase().padEnd(5)} ${e.msg}${e.detail ? '\n      ' + e.detail.replace(/\n/g, '\n      ') : ''}`).join('\n');
  window.ICLOG = {
    add, info: (m, d) => add('info', m, d), warn: (m, d) => add('warn', m, d), error: (m, d) => add('error', m, d),
    entries: () => list.slice(), clear: () => { list = []; save(); listeners.forEach((f) => f(null)); },
    onChange: (f) => { listeners.add(f); return () => listeners.delete(f); }, text, env, time,
    // the red badge counts this session's errors; the log keeps earlier ones (marked by their date) for reference
    errors: () => list.filter((e) => e.level === 'error' && e.t >= START).length, allErrors: () => list.filter((e) => e.level === 'error').length,
  };
  add('info', 'ImageCraft started');
})();

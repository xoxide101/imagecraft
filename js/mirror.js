/* ImageCraft model mirror: if an AI model's own download address fails (the file was moved, deleted or the site is
   down), the copy kept in the craft-models repository is used instead. The copy is stored in parts (GitHub serves files
   under 100 MB to pages), rejoined here and checked against its SHA-256 before it is used, so a broken or altered
   copy is never loaded. Loaded right after debug.js, before anything downloads. Nothing changes while the originals
   work. (manifest.json there lists each original address with its size, fingerprint and number of parts.) */
(function () {
  'use strict';
  const BASE0 = 'https://raw.githubusercontent.com/xoxide101/craft-models/main/', base = () => window.CRAFT_MIRROR_BASE || BASE0; // the override is for testing
  const MIRRORED = /^https:\/\/(huggingface\.co\/|storage\.googleapis\.com\/mediapipe-models\/)/;
  const orig = window.fetch.bind(window);
  let manifest = null;
  const getManifest = () => (manifest = manifest || orig(base() + 'manifest.json', { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error('mirror list ' + r.status); return r.json(); }).catch((e) => { manifest = null; throw e; }));
  async function fromMirror(url) {
    const m = (await getManifest())[url]; if (!m) return null;
    const path = base() + url.split('://')[1], parts = [];
    for (let i = 0; i < m.parts; i++) { const r = await orig(`${path}.part${String(i).padStart(3, '0')}`); if (!r.ok) throw new Error(`mirror part ${i} ${r.status}`); parts.push(new Uint8Array(await r.arrayBuffer())); }
    const all = new Uint8Array(m.size); let k = 0; parts.forEach((p) => { all.set(p, k); k += p.length; });
    const hex = [...new Uint8Array(await crypto.subtle.digest('SHA-256', all))].map((b) => b.toString(16).padStart(2, '0')).join('');
    if (k !== m.size || hex !== m.sha256) throw new Error('the mirrored copy does not match its fingerprint');
    if (window.ICLOG) ICLOG.warn(`Used the mirrored copy of ${url.split('/').slice(-2).join('/')} (the original could not be downloaded)`);
    return new Response(all, { status: 200, headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(m.size) } });
  }
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : input && input.url;
    if (!url || !MIRRORED.test(url)) return orig(input, init);
    let res = null, err = null;
    try { res = await orig(input, init); if (res.ok || res.status === 304) return res; } catch (e) { err = e; }
    try { const m = await fromMirror(url); if (m) return m; } catch (e) { if (window.ICLOG) ICLOG.warn(`The mirror could not supply ${url}`, e); }
    if (res) return res; throw err;
  };
  window.CRAFTMIRROR = { base, fromMirror };
})();

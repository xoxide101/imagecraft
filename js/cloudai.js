/* ImageCraft – Cloud AI (IC.cloud): the user's own Anthropic (Claude), Google (Gemini) and OpenAI keys, for two jobs:
     describe(img, provider, model)          → the same assessment as Ask AI (what the photo is, what is wrong)
     regenerate(img, provider, model, text)  → ImageData: the photo redrawn by an image model (Gemini or OpenAI)
     models(provider)                        → the models that key can use (asked from the service itself)
   The keys are typed into ImageCraft by the user and kept only in this browser (localStorage); each request goes
   straight from this page to that company and nowhere else. Every result says where it came from. */
(function () {
  'use strict';
  const IC = (window.IC = window.IC || {});
  const KEY = 'imagecraft-cloud';
  let cfg = { keys: { anthropic: '', gemini: '', openai: '' }, models: {}, workspace: '' }; // workspace: Anthropic workspace ID, for keys not tied to one workspace
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) cfg = { keys: { ...cfg.keys, ...(s.keys || {}) }, models: s.models || {}, workspace: s.workspace || '' }; } catch (e) { /* blocked storage */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) { /* blocked storage */ } };
  const NAMES = { anthropic: 'Claude (Anthropic)', gemini: 'Gemini (Google)', openai: 'GPT (OpenAI)' };
  const has = (p) => !!(cfg.keys[p] || '').trim();

  const anthHeaders = (k, json) => ({ ...(json ? { 'content-type': 'application/json' } : {}), 'x-api-key': k, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true', ...(cfg.workspace.trim() ? { 'anthropic-workspace-id': cfg.workspace.trim() } : {}) });
  // ------------------------------------------------------------------ the activity log: every call, what was sent and what came back (never the key)
  // Kept in memory for this session only (the last 40). IC.cloud.task('Repair fill') names the calls that follow.
  const log = [], listeners = new Set(); let task = '';
  const setTask = (t) => { task = t || ''; };
  const onLog = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
  const tell = () => listeners.forEach((fn) => { try { fn(log); } catch (e) { /* a closed view */ } });
  function sentOf(opts) {
    const o = { pics: [], text: '', bytes: 0 }, b = opts && opts.body;
    if (typeof b === 'string') { o.bytes = b.length; let j = null; try { j = JSON.parse(b); } catch (e) { /* not JSON */ }
      const walk = (x) => { if (!x || typeof x !== 'object') return; if (Array.isArray(x)) { x.forEach(walk); return; }
        const d = x.inline_data || x.inlineData; if (d && d.data) o.pics.push(`data:${d.mime_type || d.mimeType || 'image/jpeg'};base64,${d.data}`);
        if (x.type === 'image' && x.source && x.source.data) o.pics.push(`data:${x.source.media_type};base64,${x.source.data}`);
        if (x.image_url && x.image_url.url) o.pics.push(x.image_url.url);
        if (typeof x.text === 'string') o.text += (o.text ? '\n' : '') + x.text;
        for (const k in x) if (k !== 'inline_data' && k !== 'inlineData' && k !== 'source' && k !== 'image_url') walk(x[k]); };
      walk(j); }
    else if (b instanceof FormData) { for (const [k, v] of b.entries()) { if (v instanceof Blob) { o.bytes += v.size; o.pics.push({ blob: v, label: k }); } else if (k === 'prompt') { o.text = String(v); o.bytes += o.text.length; } } }
    return o;
  }
  function backOf(j) {
    const o = { pics: [], text: '' }; if (!j) return o;
    (j.data || []).forEach((d) => { if (d && d.b64_json) o.pics.push('data:image/png;base64,' + d.b64_json); });
    ((j.candidates || [])[0]?.content?.parts || []).forEach((x) => { const d = x.inline_data || x.inlineData; if (d && d.data) o.pics.push(`data:${d.mime_type || d.mimeType};base64,${d.data}`); if (x.text) o.text += x.text; });
    (j.content || []).forEach((c) => { if (c.text) o.text += c.text; });
    if (j.choices) o.text += j.choices.map((c) => c.message?.content || '').join('');
    o.text = o.text.replace(/"mask"\s*:\s*"(?:data:image\/png;base64,)?([A-Za-z0-9+/=]{80,})"/g, (all, b64) => { o.pics.push('data:image/png;base64,' + b64); return `"mask": "(picture ${o.pics.length})"`; }); // Gemini's outlines: shown as pictures
    if (!o.text && !o.pics.length && Array.isArray(j.data || j.models)) o.text = `(a list of ${(j.data || j.models).length} models)`;
    return o;
  }
  async function call(url, opts, who) {
    if (IC.cloud.hold) { const e = new Error('The 16-bit pass does not call the cloud again.'); e.cloudHold = true; throw e; }
    const e = { at: Date.now(), who, task, what: url.replace(/^https:\/\/[^/]+/, '').replace(/[?&]key=[^&]*/, '').replace(/\?$/, ''), model: (() => { try { return JSON.parse(opts.body).model || ''; } catch (err) { return opts && opts.body instanceof FormData ? opts.body.get('model') || '' : (url.match(/models\/([^:/?]+):/) || [])[1] || ''; } })(), sent: sentOf(opts), state: 'sending' };
    if (!/\/models(\?|$)/.test(e.what)) { log.unshift(e); if (log.length > 40) log.pop(); tell(); }
    for (const p of e.sent.pics) if (p.blob) p.url = URL.createObjectURL(p.blob);
    let r; try { r = await fetch(url, opts); } catch (err) { e.state = 'failed'; e.error = 'could not be reached'; e.secs = (Date.now() - e.at) / 1000; tell(); throw new Error(`${NAMES[who]} could not be reached (no internet, or the browser blocked it).`); }
    const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (err) { /* not JSON */ }
    e.secs = (Date.now() - e.at) / 1000; e.status = r.status; e.backBytes = t.length; e.state = r.ok ? 'done' : 'failed'; if (r.ok) e.back = backOf(j); else e.error = (j && j.error && (j.error.message || j.error.type)) || t.slice(0, 300); if (j && j.usage) e.usage = j.usage; if (j && j.usageMetadata) e.usage = j.usageMetadata; tell();
    if (!r.ok && /quota|billing|credit balance|insufficient_quota/i.test(t)) throw new Error(`${NAMES[who]}: this account has no paid credit for it yet (${who === 'gemini' ? 'Google: turn on billing for the key in Google AI Studio; the free tier does not draw pictures' : who === 'anthropic' ? 'Anthropic Console › Plans & Billing' : 'OpenAI: Settings › Billing'}). The other services and the built-in AI still work.`);
    if (!r.ok) { const m = (j && (j.error && (j.error.message || j.error.type))) || t.slice(0, 200); throw new Error(`${NAMES[who]}: ${/workspace/i.test(m) ? 'this key is not tied to one workspace: add the Workspace ID (Anthropic Console › Settings › Workspaces) under the Claude key, or use a key made inside a workspace. ' : r.status === 401 || r.status === 403 ? 'the key was refused (check it in AI settings › Cloud AI). ' : ''}${m}`); }
    return j;
  }
  // a JPEG of at most `max` pixels across (what the services take; smaller is quicker and cheaper)
  function jpeg(img, max = 1536) {
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').putImageData(img, 0, 0);
    const k = Math.min(1, max / Math.max(img.width, img.height)), o = document.createElement('canvas'); o.width = Math.round(img.width * k); o.height = Math.round(img.height * k);
    const x = o.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, o.width, o.height); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, o.width, o.height);
    return o.toDataURL('image/jpeg', 0.92).split(',')[1];
  }
  const toImageData = (b64, type = 'image/png') => new Promise((res, rej) => { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight; const x = c.getContext('2d'); x.drawImage(i, 0, 0); res(x.getImageData(0, 0, c.width, c.height)); }; i.onerror = () => rej(new Error('The picture that came back could not be read.')); i.src = `data:${type};base64,${b64}`; });

  // ------------------------------------------------------------------ which models a key can use
  async function models(p) {
    const k = cfg.keys[p].trim(); if (!k) return [];
    if (p === 'anthropic') { const j = await call('https://api.anthropic.com/v1/models?limit=100', { headers: anthHeaders(k) }, p); return (j.data || []).map((m) => ({ id: m.id, name: m.display_name || m.id, see: true })); }
    if (p === 'gemini') { const j = await call(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(k)}`, {}, p); return (j.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => ({ id: m.name.replace(/^models\//, ''), name: m.displayName || m.name, see: !/embedding|aqa|tts/i.test(m.name), draw: /image/i.test(m.name) })); }
    const j = await call('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${k}` } }, p);
    return (j.data || []).map((m) => ({ id: m.id, name: m.id, see: /^(gpt-4o|gpt-4\.1|gpt-5|o3|o4)/.test(m.id) && !/audio|realtime|transcribe|tts|search/.test(m.id), draw: /^(gpt-image|dall-e)/.test(m.id) })).filter((m) => m.see || m.draw);
  }

  // ------------------------------------------------------------------ describe (the Ask AI assessment, from the cloud)
  async function describe(img, p, model) {
    const k = cfg.keys[p].trim(); if (!k) throw new Error(`No ${NAMES[p]} key yet: add it in AI settings › Cloud AI (the AI button in the status bar).`);
    const O = IC.ollama, schema = O.SCHEMA, prompt = O.PROMPT + ' Answer with JSON only, matching this schema: ' + JSON.stringify(schema), b64 = jpeg(img, 1280); let text = '';
    if (p === 'anthropic') {
      const j = await call('https://api.anthropic.com/v1/messages', { method: 'POST', headers: anthHeaders(k, true), body: JSON.stringify({ model, max_tokens: 1500, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } }, { type: 'text', text: prompt }] }] }) }, p);
      text = (j.content || []).map((c) => c.text || '').join('');
    } else if (p === 'gemini') {
      const j = await call(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(k)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: 'image/jpeg', data: b64 } }, { text: prompt }] }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } }) }, p);
      text = ((j.candidates || [])[0]?.content?.parts || []).map((x) => x.text || '').join('');
    } else {
      const j = await call('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${k}` }, body: JSON.stringify({ model, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } }, { type: 'text', text: prompt }] }] }) }, p);
      text = j.choices?.[0]?.message?.content || '';
    }
    const m = text.match(/\{[\s\S]*\}/); if (!m) throw new Error(`${NAMES[p]} did not answer in the expected form.`);
    const a = JSON.parse(m[0]); a.problems = (a.problems || []).filter((x) => O.PROBLEMS.includes(x)); a.model = `${model} (${NAMES[p]}, cloud)`; return a;
  }

  // ------------------------------------------------------------------ regenerate (an image model redraws the photo)
  const REGEN = 'Restore this photograph. Keep the same people, faces, pose, framing, clothing and setting exactly; do not add, remove or move anything. Repair tears, scratches, stains and missing parts, remove dust, noise and blur, and fix fading and colour casts, so it looks like the same photo taken with a good modern camera.';
  async function regenerate(img, p, model, text = '', { colour = false } = {}) {
    const k = cfg.keys[p].trim(); if (!k) throw new Error(`No ${NAMES[p]} key yet: add it in AI settings › Cloud AI (the AI button in the status bar).`);
    const prompt = REGEN + (colour ? ' Give it natural, realistic colour.' : ' Keep its own colours (or its black and white or sepia tone).') + (text ? ' What it shows: ' + text : ''), b64 = jpeg(img, 1536);
    if (p === 'gemini') {
      const j = await call(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(k)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: 'image/jpeg', data: b64 } }, { text: prompt }] }], generationConfig: { responseModalities: ['IMAGE', 'TEXT'] } }) }, p);
      const part = ((j.candidates || [])[0]?.content?.parts || []).find((x) => x.inline_data || x.inlineData), d = part && (part.inline_data || part.inlineData);
      if (!d) throw new Error(`${NAMES[p]} sent no picture back (this model may not make pictures: choose one with "image" in its name).`);
      return toImageData(d.data, d.mime_type || d.mimeType || 'image/png');
    }
    if (p === 'openai') {
      const blob = await (await fetch(`data:image/jpeg;base64,${b64}`)).blob(), fd = new FormData(); fd.append('model', model); fd.append('prompt', prompt); fd.append('image', new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
      const j = await call('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${k}` }, body: fd }, p);
      const b = j.data?.[0]?.b64_json; if (!b) throw new Error(`${NAMES[p]} sent no picture back.`); return toImageData(b);
    }
    throw new Error('Claude describes pictures but does not draw them: choose Gemini or OpenAI to regenerate.');
  }
  // ------------------------------------------------------------------ a picture (canvas-sized) to a PNG blob / base64
  const pngOf = (img) => new Promise((res) => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').putImageData(img, 0, 0); c.toBlob((b) => res(b), 'image/png'); });
  const b64Of = async (blob) => { const u = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s); };
  const scaled = (img, W, H) => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').putImageData(img, 0, 0); const o = document.createElement('canvas'); o.width = W; o.height = H; const x = o.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, W, H); return x.getImageData(0, 0, W, H); };
  // a picture and an instruction to an image model; back: ImageData at the size sent
  async function edit(img, p, model, prompt, mask) {
    const k = cfg.keys[p].trim(); if (!k) throw new Error(`No ${NAMES[p]} key yet: add it in AI settings › Cloud AI (the AI button in the status bar).`);
    let out;
    if (p === 'openai') {
      const fd = new FormData(); fd.append('model', model); fd.append('prompt', prompt); fd.append('image', new File([await pngOf(img)], 'image.png', { type: 'image/png' }));
      if (mask) fd.append('mask', new File([await pngOf(mask)], 'mask.png', { type: 'image/png' }));
      const j = await call('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${k}` }, body: fd }, p);
      const b = j.data?.[0]?.b64_json; if (!b) throw new Error(`${NAMES[p]} sent no picture back.`); out = await toImageData(b);
    } else if (p === 'gemini') {
      const j = await call(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(k)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: 'image/png', data: await b64Of(await pngOf(img)) } }, { text: prompt }] }], generationConfig: { responseModalities: ['IMAGE', 'TEXT'] } }) }, p);
      const part = ((j.candidates || [])[0]?.content?.parts || []).find((x) => x.inline_data || x.inlineData), d = part && (part.inline_data || part.inlineData);
      if (!d) throw new Error(`${NAMES[p]} sent no picture back (choose a model with "image" in its name).`); out = await toImageData(d.data, d.mime_type || d.mimeType || 'image/png');
    } else throw new Error('Claude describes pictures but does not draw them: choose Gemini or OpenAI.');
    return out.width === img.width && out.height === img.height ? out : scaled(out, img.width, img.height);
  }

  // ------------------------------------------------------------------ fill marked areas (repair): only the marked parts change
  // The marked area and a margin round it are cut out (sharper and cheaper than the whole picture), at most 1024 px
  // across; OpenAI gets a mask (see-through = fill), Gemini sees the area painted magenta and is asked to fill it. The
  // answer is laid back only where it was marked, with a soft edge, so the rest stays the original.
  async function fill(img, hole, p, model, text = '') {
    const W = img.width, H = img.height; let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (hole[y * W + x] > 0.5) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) throw new Error('Nothing is marked.');
    const m = Math.round(Math.max(x1 - x0, y1 - y0) * 0.35 + 24); x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(W - 1, x1 + m); y1 = Math.min(H - 1, y1 + m);
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1, k = Math.min(1, 1024 / Math.max(cw, ch)), sw = Math.max(16, Math.round(cw * k)), sh = Math.max(16, Math.round(ch * k));
    const crop = new ImageData(cw, ch), hc = new Float32Array(cw * ch);
    for (let y = 0; y < ch; y++) { crop.data.set(img.data.subarray(((y0 + y) * W + x0) * 4, ((y0 + y) * W + x0 + cw) * 4), y * cw * 4); for (let x = 0; x < cw; x++) hc[y * cw + x] = hole[(y0 + y) * W + x0 + x]; }
    const small = scaled(crop, sw, sh), hs = new Float32Array(sw * sh); for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) hs[y * sw + x] = hc[Math.min(ch - 1, Math.floor(((y + 0.5) * ch) / sh)) * cw + Math.min(cw - 1, Math.floor(((x + 0.5) * cw) / sw))];
    const what = text ? ` The photo shows: ${text}` : '';
    let back;
    if (p === 'openai') { const mask = new ImageData(sw, sh); for (let i = 0; i < sw * sh; i++) mask.data[i * 4 + 3] = hs[i] > 0.5 ? 0 : 255; back = await edit(small, p, model, `Fill in the transparent (masked) areas of this old photograph so they match the surrounding photo exactly: same people, clothing, textures, lighting, colour and grain. Change nothing else.${what}`, mask); }
    else { const shown = new ImageData(new Uint8ClampedArray(small.data), sw, sh); for (let i = 0; i < sw * sh; i++) if (hs[i] > 0.5) { shown.data[i * 4] = 255; shown.data[i * 4 + 1] = 0; shown.data[i * 4 + 2] = 255; } back = await edit(shown, p, model, `The bright magenta areas of this old photograph are damage. Repaint only those areas so they match the photo around them exactly (same people, clothing, textures, lighting, colour and grain) and leave everything else exactly as it is. No magenta may remain.${what}`); }
    return layBack(img, scaled(back, cw, ch), hc, x0, y0, cw, ch, Math.max(2, Math.round(3 / k)));
  }
  // the filled crop laid back only where marked (the mark grown a little and feathered)
  function layBack(img, big, hc, x0, y0, cw, ch, r) {
    const W = img.width, out = new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), o = out.data, soft = new Float32Array(cw * ch), st = Math.max(1, r >> 1);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { let v = hc[y * cw + x] > 0.5 ? 1 : 0; for (let j = -r; j <= r && v < 1; j += st) for (let i = -r; i <= r; i += st) { const yy = y + j, xx = x + i; if (yy >= 0 && yy < ch && xx >= 0 && xx < cw && hc[yy * cw + xx] > 0.5) v = Math.max(v, 1 - Math.hypot(i, j) / (r + 1)); } soft[y * cw + x] = v; }
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { const w = soft[y * cw + x]; if (w <= 0) continue; const pi = ((y0 + y) * W + x0 + x) * 4, bi = (y * cw + x) * 4; for (let c = 0; c < 3; c++) o[pi + c] = Math.round(o[pi + c] + (big.data[bi + c] - o[pi + c]) * w); }
    return out;
  }

  // ------------------------------------------------------------------ colour from the cloud, detail from the photo
  // The cloud model colourises a copy; only its colour (Lab a and b, smoothed a little) is joined to the photo's own
  // full-size lightness, so nothing in the photo is redrawn: every edge and texture stays the original's.
  async function colourise(img, p, model, { amount = 100, text = '' } = {}) {
    const k = Math.min(1, 1536 / Math.max(img.width, img.height)), small = scaled(img, Math.round(img.width * k), Math.round(img.height * k));
    const back = await edit(small, p, model, `Colourise this old black-and-white or faded photograph with natural, realistic colours. Keep everything exactly as it is: same people, faces, clothing, objects, framing and detail; change only the colours.${text ? ' The photo shows: ' + text : ''}`);
    return IC.filters.colourFrom(img, scaled(back, img.width, img.height), { amount });
  }

  // ------------------------------------------------------------------ object masks (Gemini): sharper than CLIPSeg
  // Gemini answers with a box (0–1000) and a small PNG mask for each thing it finds; they are laid into one map 0–1.
  async function segment(img, words, model) { const r = await segmentMany(img, [words], model); return r[words]; }
  // one call, several things: { label: map }. Each answer goes to the asked-for label it names (or the only one asked)
  async function segmentMany(img, labels, model) {
    const k = cfg.keys.gemini.trim(); if (!k) throw new Error('No Gemini key yet.');
    const W = img.width, H = img.height, b64 = jpeg(img, 1024), maps = {}; labels.forEach((l) => { maps[l] = new Float32Array(W * H); });
    const prompt = `Give the segmentation masks for: ${labels.map((l) => `"${l}"`).join(', ')}. Output a JSON list of masks where each entry contains the 2D bounding box in the key "box_2d", the segmentation mask in key "mask", and the text label in the key "label"${labels.length > 1 ? ', which must be exactly one of the names given' : ''}. Several entries may share a label. Leave out anything not in the picture.`;
    const j = await call(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(k)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: 'image/jpeg', data: b64 } }, { text: prompt }] }], generationConfig: { temperature: 0.2 } }) }, 'gemini');
    const text = ((j.candidates || [])[0]?.content?.parts || []).map((x) => x.text || '').join(''), m = text.match(/\[[\s\S]*\]/); if (!m) throw new Error('Gemini did not answer with masks.');
    const items = JSON.parse(m[0]), norm = (s) => String(s || '').toLowerCase().replace(/[^a-z ]/g, '').trim();
    for (const it of items) {
      const [ya, xa, yb, xb] = it.box_2d || []; if (!it.mask || !(xb > xa) || !(yb > ya)) continue;
      const nl = norm(it.label), lab = labels.length === 1 ? labels[0] : labels.find((l) => norm(l) === nl) || labels.find((l) => nl && (norm(l).includes(nl) || nl.includes(norm(l)))); if (!lab) continue; const map = maps[lab];
      const bx0 = Math.round((xa / 1000) * W), by0 = Math.round((ya / 1000) * H), bw = Math.max(1, Math.round(((xb - xa) / 1000) * W)), bh = Math.max(1, Math.round(((yb - ya) / 1000) * H));
      const mk = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = String(it.mask).startsWith('data:') ? it.mask : 'data:image/png;base64,' + it.mask; }); if (!mk) continue;
      const c = document.createElement('canvas'); c.width = bw; c.height = bh; const x = c.getContext('2d'); x.drawImage(mk, 0, 0, bw, bh); const d = x.getImageData(0, 0, bw, bh).data;
      for (let y = 0; y < bh; y++) for (let xx = 0; xx < bw; xx++) { const X = bx0 + xx, Y = by0 + y; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const v = d[(y * bw + xx) * 4] / 255; if (v > map[Y * W + X]) map[Y * W + X] = v; }
    }
    return maps;
  }

  // ------------------------------------------------------------------ where things are (any service that can look): boxes and points inside
  // For services without outlines (OpenAI, Claude): each thing as boxes (0 to 1000, [ymin, xmin, ymax, xmax]) with a few points
  // well inside it. The built-in outliner (SlimSAM) then traces the real edges on this computer.
  async function locate(img, labels, p, model) {
    const k = cfg.keys[p].trim(); if (!k) throw new Error(`No ${NAMES[p]} key yet.`);
    const b64 = jpeg(img, 1024), prompt = `For each of these: ${labels.map((l) => `"${l}"`).join(', ')}, find every area of the picture that shows it. Answer with JSON only: {"found":[{"label":"<exactly one of the names given>","box_2d":[ymin,xmin,ymax,xmax],"points":[[y,x],[y,x],[y,x]]}]} with all numbers from 0 to 1000 across the picture. The points must lie well inside that thing (not on its edge), spread over it. Several entries may share a label (two people, two patches of sky). Leave out anything not in the picture.`;
    let text = '';
    if (p === 'anthropic') { const j = await call('https://api.anthropic.com/v1/messages', { method: 'POST', headers: anthHeaders(k, true), body: JSON.stringify({ model, max_tokens: 2000, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } }, { type: 'text', text: prompt }] }] }) }, p); text = (j.content || []).map((c) => c.text || '').join(''); }
    else { const j = await call('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${k}` }, body: JSON.stringify({ model, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } }, { type: 'text', text: prompt }] }] }) }, p); text = j.choices?.[0]?.message?.content || ''; }
    const m = text.match(/\{[\s\S]*\}/); if (!m) throw new Error(`${NAMES[p]} did not answer in the expected form.`);
    const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z ]/g, '').trim();
    return (JSON.parse(m[0]).found || []).map((f) => { const nl = norm(f.label); return { ...f, label: labels.find((l) => norm(l) === nl) || labels.find((l) => nl && (norm(l).includes(nl) || nl.includes(norm(l)))) }; }).filter((f) => f.label && Array.isArray(f.box_2d) && f.box_2d.length === 4);
  }

  // ------------------------------------------------------------------ one aligned face (512 × 512) redrawn by the cloud
  const face = (crop, p, model) => edit(crop, p, model, 'Restore this old, blurred or damaged face photo so it looks sharp and natural, like a modern photo of the same person. Keep the identity, expression, pose, hair, age and framing exactly the same. Do not change the background or the crop.');

  // which services can do a job, given the keys; which of their models to use (the person's choice, or a good default)
  const engines = (job) => lastIn(({ fill: ['openai', 'gemini'], colour: ['gemini', 'openai'], masks: ['gemini'], locate: ['openai', 'anthropic'], face: ['gemini', 'openai'] }[job] || []).filter(has));
  // the newest model that fits (by the version numbers in its name), so retired models (gemini-2.5-flash) are never chosen
  const ver = (id) => (String(id).match(/\d+(?:\.\d+)?/g) || []).map(Number);
  const newest = (ms) => ms.slice().sort((a, b) => { const x = ver(a.id), y = ver(b.id); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (y[i] || 0) - (x[i] || 0); if (d) return d; } return a.id.length - b.id.length; })[0];
  const drawModel = async (p) => { const want = cfg.models['draw:' + p], ms = (await models(p)).filter((x) => x.draw); if (want && ms.some((x) => x.id === want)) return want; const pick = newest(ms.filter((x) => /^gpt-image/.test(x.id) && !/mini/.test(x.id))) || newest(ms.filter((x) => /flash-image/.test(x.id) && !/preview/.test(x.id))) || newest(ms.filter((x) => /flash-image|gpt-image/.test(x.id))) || ms[0]; if (!pick) throw new Error(`${NAMES[p]}: this key has no model that can draw pictures.`); return pick.id; };
  const seeModel = async (p) => { const want = cfg.models['see:' + p], ms = (await models(p)).filter((x) => x.see && !x.draw); if (want && ms.some((x) => x.id === want)) return want; const plain = (x) => !/lite|image|tts|live|audio|thinking|preview|exp/.test(x.id); const pick = newest(ms.filter((x) => /^gemini-[\d.]+-flash$/.test(x.id))) || newest(ms.filter((x) => /flash/.test(x.id) && plain(x))) || newest(ms.filter(plain)) || ms[0]; if (!pick) throw new Error(`${NAMES[p]}: this key has no model that can look at pictures.`); return pick.id; };

  const passable = (e) => /paid credit|quota|no longer available|not found|could not be reached|sent no picture|did not answer/i.test(e.message);
  // a service that said it is unpaid (or over its quota) goes to the back of the line for the rest of the session
  const unpaid = new Set(), lastIn = (l) => [...l.filter((p) => !unpaid.has(p)), ...l.filter((p) => unpaid.has(p))];
  async function tryEach(list, fn) { list = lastIn(list); let last = null; for (const p of list) { try { return await fn(p); } catch (e) { last = e; if (/paid credit|quota/i.test(e.message)) unpaid.add(p); if (!passable(e) || p === list[list.length - 1]) throw e; if (window.ICLOG) ICLOG.add('info', `Cloud: ${NAMES[p]} could not do it (${e.message.slice(0, 120)}); trying ${NAMES[list[list.indexOf(p) + 1]]}`); } } throw last; }
  // a job with this service first, then the others that can do it
  const orderFrom = (job, first) => { const l = engines(job); return first && l.includes(first) ? [first, ...l.filter((x) => x !== first)] : l; };
  IC.cloud = { tryEach, orderFrom, log, onLog, task: setTask, cfg, save, has, NAMES, models, describe, regenerate, edit, fill, layBack, colourise, segment, segmentMany, locate, face, engines, drawModel, seeModel };
})();

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
  let cfg = { keys: { anthropic: '', gemini: '', openai: '' }, models: {} };
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) cfg = { keys: { ...cfg.keys, ...(s.keys || {}) }, models: s.models || {} }; } catch (e) { /* blocked storage */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) { /* blocked storage */ } };
  const NAMES = { anthropic: 'Claude (Anthropic)', gemini: 'Gemini (Google)', openai: 'GPT (OpenAI)' };
  const has = (p) => !!(cfg.keys[p] || '').trim();

  async function call(url, opts, who) {
    let r; try { r = await fetch(url, opts); } catch (e) { throw new Error(`${NAMES[who]} could not be reached (no internet, or the browser blocked it).`); }
    const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) { /* not JSON */ }
    if (!r.ok) { const m = (j && (j.error && (j.error.message || j.error.type))) || t.slice(0, 200); throw new Error(`${NAMES[who]}: ${r.status === 401 || r.status === 403 ? 'the key was refused (check it in Cloud AI keys). ' : ''}${m}`); }
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
    if (p === 'anthropic') { const j = await call('https://api.anthropic.com/v1/models?limit=100', { headers: { 'x-api-key': k, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' } }, p); return (j.data || []).map((m) => ({ id: m.id, name: m.display_name || m.id, see: true })); }
    if (p === 'gemini') { const j = await call(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(k)}`, {}, p); return (j.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => ({ id: m.name.replace(/^models\//, ''), name: m.displayName || m.name, see: !/embedding|aqa|tts/i.test(m.name), draw: /image/i.test(m.name) })); }
    const j = await call('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${k}` } }, p);
    return (j.data || []).map((m) => ({ id: m.id, name: m.id, see: /^(gpt-4o|gpt-4\.1|gpt-5|o3|o4)/.test(m.id) && !/audio|realtime|transcribe|tts|search/.test(m.id), draw: /^(gpt-image|dall-e)/.test(m.id) })).filter((m) => m.see || m.draw);
  }

  // ------------------------------------------------------------------ describe (the Ask AI assessment, from the cloud)
  async function describe(img, p, model) {
    const k = cfg.keys[p].trim(); if (!k) throw new Error(`No ${NAMES[p]} key yet: add it in View › Cloud AI keys.`);
    const O = IC.ollama, schema = O.SCHEMA, prompt = O.PROMPT + ' Answer with JSON only, matching this schema: ' + JSON.stringify(schema), b64 = jpeg(img, 1280); let text = '';
    if (p === 'anthropic') {
      const j = await call('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': k, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify({ model, max_tokens: 1500, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } }, { type: 'text', text: prompt }] }] }) }, p);
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
    const k = cfg.keys[p].trim(); if (!k) throw new Error(`No ${NAMES[p]} key yet: add it in View › Cloud AI keys.`);
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
  IC.cloud = { cfg, save, has, NAMES, models, describe, regenerate };
})();

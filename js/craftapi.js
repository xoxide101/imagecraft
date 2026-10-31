/* craftapi for ImageCraft (v0.1): one command layer for people and agents (Claude, Copilot, Gemini through the craftapi
   MCP server, or a script in the page). Follows craftapi's SPEC v0.2 core: describe, state, summary, apply, snapshot,
   restore, diff, score, render, export; plus open, recipe and tasks (the "What do you want to do?" level).
   Everything goes through the same calls the GUI uses. Pictures never leave as raw pixels: answers are JSON, with a
   short report in words, and a small preview image when asked ({ preview: true }).
   window.craftAPI.describe() lists everything with its inputs. */
(() => {
  'use strict';
  const VERSION = '0.1', IC = window.IC, X = IC.filters, F = IC.formats, I = () => window.ImageCraft._inner;
  const snaps = new Map(); let snapN = 0;
  const ok = (data = {}, report = []) => ({ ok: true, ...data, report: [].concat(report) });
  const fail = (code, message, hint) => ({ ok: false, error: { code, message, ...(hint ? { hint } : {}) } });
  const pic = () => I().pic(), now = () => I().now();
  const need = () => (pic() ? null : fail('no_picture', 'No picture is open.', 'Call open({ name, dataUrl }) or open({ name, base64 }) first.'));
  const canvasOf = (img) => X.canvasOf(img);
  const preview = (img, max = 384) => { const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k)); const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(canvasOf(img), 0, 0, c.width, c.height); return c.toDataURL('image/png'); };
  const b64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (s) => { const t = atob(String(s).replace(/^data:[^,]*,/, '')); const u = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) u[i] = t.charCodeAt(i); return u; };
  const quiet = async (fn) => { const el = document.getElementById('kindtiles'); try { return await fn(); } finally { if (el) el.hidden = true; } };

  // ------------------------------------------------------------------ what the tools take (from the GUI's own fields)
  function toolSchema(id) {
    const T = I().TOOLS[id]; if (!T) return null; const fields = {};
    (T.fields || []).forEach((f) => { if (!f || !f.k) return; const e = { type: f.t === 'range' ? 'number' : f.t === 'check' ? 'boolean' : f.t === 'seg' || f.t === 'sel' ? 'choice' : f.t, label: f.label || '' };
      if (f.t === 'range') Object.assign(e, { min: f.min, max: f.max, step: f.step }); if (f.options) e.options = f.options.map((o) => (Array.isArray(o) ? o[0] : o)); fields[f.k] = e; });
    return { id, title: T.title, fields, needsMarks: !!T.paint, viewOnly: !!T.viewOnly };
  }
  const defaults = (id, img) => { const T = I().TOOLS[id]; return JSON.parse(JSON.stringify(typeof T.s === 'function' ? T.s(img) : T.s || {})); };

  // ------------------------------------------------------------------ tasks: what a person (or an agent) wants done
  const TASKS = {
    fixPhoto: { what: 'Measure the picture and run its whole plan (by its kind), then touch-up passes', args: { passes: 'number 1-4 (default 2)', faces: 'boolean (redraws faces)', colourise: 'boolean' },
      async run(a) { const S = { goals: { edits: false, bigger: false, colour: true, repair: true }, factor: 2, faces: false, auto: { faces: !!a.faces, colourise: !!a.colourise }, passes: a.passes || 2 }; await I().fixEverything(S); I().closeTool(true); return { report: (S.report || []).map((r) => r.steps.length ? `Pass ${r.pass}: ${r.steps.map((x) => x.label).join(', ')}` : r.note) }; } },
    removeBackground: { what: 'Take the background away (see-through), inside shapes too, with clean edges', args: { how: "'colour' (default: by colour from the edges) | 'ai' (photos) | 'cloud' (Runware)", tolerance: 'number 5-160' },
      async run(a) { const img = now(), s = { ...defaults('cutout', img), mode: a.how === 'ai' ? 'ai' : 'edges', cloudCut: a.how === 'cloud', tolerance: a.tolerance || 40, points: [] }; const o = await I().TOOLS.cutout.run(img, s); await I().pushDeep('Remove background', o, null, 0); return { report: 'Background taken away.' }; } },
    keyGreenScreen: { what: 'Green or blue screen taken away (chroma key), spill removed', args: { colour: '[r,g,b] (default: found by itself)', clipBlack: 'number', clipWhite: 'number', background: "'#rrggbb' or '' for see-through" },
      async run(a) { const img = now(), s = { ...defaults('keyer', img), ...(a.colour ? { rgb: a.colour } : {}), ...(a.clipBlack != null ? { clipBlack: a.clipBlack } : {}), ...(a.clipWhite != null ? { clipWhite: a.clipWhite } : {}), back: a.background || '' }; await I().pushDeep('Chroma key', X.chromaKey(img, { ...s, view: 'result' }), null, 0); return { report: `Screen ${JSON.stringify(s.rgb)} taken away.` }; } },
    traceToSvg: { what: 'Trace to SVG (RasterTrace): one colour per real colour, clean shapes', args: { profile: "'icon' | 'balanced' | 'detail' | 'maxDetail' | 'print' | 'web' | 'pixelExact' | 'vinyl' | 'monoBlack' | 'monoWhite' | 'laser' | 'lineArt'", background: "'keep' | 'auto' | 'edges'", colours: 'number (at most), or omit to detect', swatches: "['#hex', ...] my colours" },
      async run(a) { const r = window.CRAFT_RASTERTRACE.traceImage(now(), { profile: a.profile || 'icon', colors: a.colours || 0, autoDetect: !a.colours && !(a.swatches && a.swatches.length), settings: { ...(a.background && a.background !== 'keep' ? { transparent: a.background, enclosed: true } : {}), ...(a.swatches ? { swatches: a.swatches } : {}) } }); return { file: { name: `${(pic().name || 'picture').replace(/\.[^.]+$/, '')}.svg`, mime: 'image/svg+xml', text: r.svg }, colours: r.colours, report: `Traced: ${r.colours.length} colours, ${(r.svg.match(/<path/g) || []).length} shapes, ${Math.round(r.svg.length / 1024)} KB.` }; } },
    makeBigger: { what: 'Make bigger', args: { factor: '2 | 3 | 4', method: "'smooth' | 'nearest' | 'mmpx' | 'ai-esrgan3' | ...", cloud: 'boolean (Runware upscaler)' },
      async run(a) { const img = now(), s = { ...defaults('upscale', img), factor: a.factor || 2, ...(a.method ? { method: a.method } : {}), cloudUp: !!a.cloud }; const o = await I().TOOLS.upscale.run(img, s); await I().pushDeep(`Make bigger ${s.factor}×`, o, null, 0); return { report: `Now ${o.width} × ${o.height}.` }; } },
    splitSheet: { what: 'Split a sheet of clip art into separate pictures (see-through, clean edges)', args: { names: "['Barn', ...] in reading order", gap: 'number (join parts closer than; 0 = automatic)', svg: 'boolean (also trace each)' },
      async run(a) { const img = now(), sh = X.splitSheet(img, { gap: a.gap || 0, min: 0.002 }), files = [];
        sh.items.forEach((it, i) => { const o = X.sheetItem(img, sh, it, { pad: 6, see: true }), nm = (a.names && a.names[i]) || `item ${i + 1}`, c = canvasOf(o); files.push({ name: `${nm}.png`, mime: 'image/png', base64: c.toDataURL('image/png').split(',')[1], width: o.width, height: o.height });
          if (a.svg && window.CRAFT_RASTERTRACE) files.push({ name: `${nm}.svg`, mime: 'image/svg+xml', text: window.CRAFT_RASTERTRACE.traceImage(o, { profile: 'icon' }).svg }); });
        return { files, report: `${sh.items.length} items cut out.` }; } },
  };

  // ------------------------------------------------------------------ operations for apply (each is a step in History)
  const OPS = {
    async tool({ id, s = {} }) { const T = I().TOOLS[id]; if (!T) throw new Error(`no tool ${id} (see describe().tools)`); if (T.viewOnly) throw new Error(`${id} only shows things; use a task`); if (T.paint) throw new Error(`${id} needs marks painted by a person`); const ok2 = await I().runSteps([{ id, s }], true); if (!ok2) throw new Error(`${T.title} failed (see the Debug log)`); return `${T.title}`; },
    async quick({ name }) { const fn = I().QUICK[name]; if (!fn) throw new Error(`no quick action ${name} (${Object.keys(I().QUICK).join(', ')})`); await I().pushDeep(name, await fn(now()), fn, 0, null, { quick: name }); return name; }, // recorded as the GUI does, so it is in the recipe
    async task({ name, ...args }) { const t = TASKS[name]; if (!t) throw new Error(`no task ${name} (${Object.keys(TASKS).join(', ')})`); const r = await t.run(args); return r; },
    async select({ index }) { if (!I().pics()[index]) throw new Error(`no picture ${index}`); I().select(index); return `Picture ${index}`; },
    async goto({ step }) { if (step < 0 || step >= pic().steps.length) throw new Error(`no step ${step}`); I().goStep(step); return `Step ${step}`; },
    async undo() { I().undo(); return 'Undo'; }, async redo() { I().redo(); return 'Redo'; },
    async kind({ kind }) { I().setKind(kind); return `Kind: ${kind}`; },
  };

  // ------------------------------------------------------------------ scores (measured, outside the agent's opinion)
  function compare(a, b) { if (!a || !b) return null; const W = Math.min(a.width, b.width), H = Math.min(a.height, b.height); let se = 0, ch = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * a.width + x) * 4, j = (y * b.width + x) * 4; let e = 0; for (let c = 0; c < 3; c++) { const d = a.data[i + c] - b.data[j + c]; e += d * d; } se += e; if (e > 300) ch++; } const mse = se / (W * H * 3); return { psnr: mse ? +(10 * Math.log10(255 * 255 / mse)).toFixed(2) : 99, changedPct: +(100 * ch / (W * H)).toFixed(2), sameSize: a.width === b.width && a.height === b.height }; }
  const SCORES = {
    colours: () => { const n = F.countColours(now(), 1 << 20); return { value: n, detail: 'distinct colours' }; },
    transparency: () => { const d = now().data; let c = 0; for (let i = 3; i < d.length; i += 4) if (d[i] < 128) c++; return { value: +(c / (d.length / 4)).toFixed(4), detail: 'share of see-through pixels' }; },
    noise: () => { const n = IC.restore.noiseLevel(now()); return { value: +n.luma.toFixed(2), detail: { luma: n.luma, colour: n.chroma } }; },
    blur: () => { const m = IC.restore.measure(now()); return { value: m ? +m.radius.toFixed(2) : 0, detail: 'blur radius, pixels (0 = sharp)' }; },
    jagged: () => { const a = X.aliasCheck(now()); return { value: +a.ratio.toFixed(3), detail: 'share of slanted edges that are hard steps' }; },
    fileSize: async ({ format = 'png' } = {}) => { const b = await F.write(now(), format, { bits: 24, quality: 0.9 }); return { value: b.size, detail: `bytes as ${format}` }; },
    fidelity: ({ snapshot, step = 0 } = {}) => { const ref = snapshot ? snaps.get(snapshot)?.img : pic().steps[step]?.img, r = compare(now(), ref); if (!r) throw new Error('nothing to compare with'); return { value: r.psnr, detail: { ...r, against: snapshot ? `snapshot ${snapshot}` : `step ${step}` } }; },
    refDiff: async ({ dataUrl } = {}) => { if (!dataUrl) throw new Error('refDiff needs { dataUrl } of the reference picture'); const im = new Image(); im.src = dataUrl; await im.decode(); const c = document.createElement('canvas'); c.width = now().width; c.height = now().height; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); const r = compare(now(), c.getContext('2d').getImageData(0, 0, c.width, c.height)); return { value: r.psnr, detail: { ...r, note: 'PSNR in dB: higher is closer (40+ looks the same)' } }; },
  };

  const api = {
    version: VERSION,
    describe() {
      const T = I().TOOLS, tools = Object.keys(T).map(toolSchema).filter((t) => t && !t.viewOnly);
      return ok({ app: 'imagecraft', api: VERSION, commands: ['describe', 'open', 'state', 'summary', 'apply', 'snapshot', 'restore', 'snapshots', 'diff', 'score', 'render', 'export', 'recipe', 'runRecipe'],
        tasks: Object.fromEntries(Object.entries(TASKS).map(([k, t]) => [k, { what: t.what, args: t.args }])),
        ops: { tool: '{ op:"tool", id, s:{...settings} }', quick: `{ op:"quick", name } (${Object.keys(I().QUICK).join(', ')})`, task: '{ op:"task", name, ...args }', select: '{ op:"select", index }', goto: '{ op:"goto", step }', undo: '{ op:"undo" }', redo: '{ op:"redo" }', kind: '{ op:"kind", kind: photo|painting|drawing|logo|vector|pixel }' },
        scores: Object.keys(SCORES), formats: Object.keys(F.FORMATS), tools, aiMode: I().aiMode() }, 'Start with open(), then apply([...]) with tasks or tools; check with summary() and score(); finish with export().');
    },
    async open({ name = 'picture.png', dataUrl, base64 } = {}) {
      if (!dataUrl && !base64) return fail('bad_input', 'open needs dataUrl or base64 of the file.');
      try { const bytes = unb64(dataUrl || base64), r = await F.read({ name, bytes }); await quiet(async () => { I().addPic(name, r.img || r.image || r, r.info || { format: name.split('.').pop() }); }); return ok({ picture: I().pics().length - 1, width: now().width, height: now().height }, `Opened ${name}.`); }
      catch (e) { return fail('read_failed', String(e.message || e), 'Formats: ' + Object.keys(F.FORMATS).join(', ')); }
    },
    state() { return ok({ current: I().pics().indexOf(pic()), pictures: I().pics().map((p, i) => ({ index: i, name: p.name, width: p.steps[p.at].img.width, height: p.steps[p.at].img.height, kind: p.kind || null, at: p.at, steps: p.steps.map((s, j) => ({ step: j, label: s.label, tool: s.how ? s.how.id : null, settings: s.how ? s.how.s : null })) })) }); },
    summary(opts = {}) { const e = need(); if (e) return e; const p = pic(), img = now(); return ok({ name: p.name, width: img.width, height: img.height, kind: I().kindOf(p), step: p.at, steps: p.steps.length, lastStep: p.steps[p.at].label, ...(opts.preview ? { preview: preview(img) } : {}) }); },
    async apply(ops = [], opts = {}) {
      const e = need(); if (e && !(ops[0] && ops[0].op === 'select')) return e;
      const p = pic(), at0 = p ? p.at : 0, done = [];
      try { for (const o of [].concat(ops)) { const f = OPS[o.op]; if (!f) throw new Error(`unknown op ${o.op} (${Object.keys(OPS).join(', ')})`); const r = await quiet(() => f(o)); done.push(r); } }
      catch (err) { if (p) { if (p.at !== at0) I().goStep(at0); p.steps.length = Math.min(p.steps.length, at0 + 1); I().afterChange(); } return fail('op_failed', String(err.message || err), `Rolled back to step ${at0}: the ${done.length} op(s) that had run were taken away.`); }
      const files = done.flatMap((r) => (r && r.files) || (r && r.file ? [r.file] : []));
      return ok({ step: pic().at, ...(files.length ? { files } : {}), ...(opts.preview ? { preview: preview(now()) } : {}) }, done.map((r) => (typeof r === 'string' ? r : [].concat(r.report || []).join(' '))));
    },
    snapshot(label = '') { const e = need(); if (e) return e; const id = 's' + ++snapN; snaps.set(id, { label, img: now(), pic: I().pics().indexOf(pic()), step: pic().at }); return ok({ id }, `Snapshot ${id}${label ? ` (${label})` : ''}.`); },
    snapshots() { return ok({ snapshots: [...snaps].map(([id, s]) => ({ id, label: s.label, picture: s.pic, step: s.step, width: s.img.width, height: s.img.height })) }); },
    async restore(id) { const s = snaps.get(id); if (!s) return fail('no_snapshot', `No snapshot ${id}.`); if (I().pics()[s.pic] && I().pics()[s.pic] !== pic()) I().select(s.pic); I().push(`Back to ${s.label || id}`, s.img); I().afterChange(); return ok({ step: pic().at }, `Restored ${id} as a new step (nothing was lost).`); },
    diff(a, b) { const A = snaps.get(a), B = snaps.get(b); if (!A || !B) return fail('no_snapshot', 'diff needs two snapshot ids.'); return ok({ ...compare(B.img, A.img), sizeA: [A.img.width, A.img.height], sizeB: [B.img.width, B.img.height] }); },
    async score(name, args = {}) { const s = SCORES[name]; if (!s) return fail('no_score', `No score ${name}.`, Object.keys(SCORES).join(', ')); const e = need(); if (e) return e; try { return ok(await s(args)); } catch (err) { return fail('score_failed', String(err.message || err)); } },
    render({ max = 1024 } = {}) { const e = need(); if (e) return e; return ok({ image: preview(now(), max), width: now().width, height: now().height }); },
    async export(format = 'png', opts = {}) {
      const e = need(); if (e) return e; if (!F.FORMATS[format]) return fail('bad_format', `No format ${format}.`, Object.keys(F.FORMATS).join(', '));
      try { const bits = opts.bits || I().bitsFor(format), o = { palette: 'adaptive', dither: 'fs', quality: (opts.quality || 90) / 100, fit: 'cover', back: '#ffffff', aa: 0, ...opts, bits }, img = I().prepared(now(), format, o), blob = await F.write(img, format, o), bytes = new Uint8Array(await blob.arrayBuffer()), nm = `${(pic().name || 'picture').replace(/\.[^.]+$/, '')}.${F.FORMATS[format].ext || format}`;
        return ok({ file: { name: nm, mime: blob.type || 'application/octet-stream', base64: b64(bytes), size: bytes.length } }, `${nm}: ${bytes.length} bytes.`); }
      catch (err) { return fail('export_failed', String(err.message || err)); }
    },
    recipe() { const e = need(); if (e) return e; return ok({ recipe: I().recipeOf(pic()) }, 'The steps as a recipe: run it on another picture with runRecipe().'); },
    async runRecipe(rec) { const e = need(); if (e) return e; try { await I().runRecipe(rec); return ok({ step: pic().at }, `${rec.steps.length} steps run.`); } catch (err) { return fail('recipe_failed', String(err.message || err)); } },
  };
  window.craftAPI = api;
})();

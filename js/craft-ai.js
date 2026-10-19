/* ImageCraft AI helpers (window.CRAFTAI; ImageCraft's own copy of the Craft AI helpers): small AI models that run
   inside the browser, on the graphics card when there is one (WebGPU) or on the processor (WebAssembly) when not. No
   server, no account, no key: each model downloads once (when first used, or with "Download now"), is kept by the
   browser and works offline after that.
     cutout(src)            → { W, H, a: Uint8Array 0–255 (255 = keep) }  U²-Net (Apache-2.0; U²-Netp on a basic computer),
                                                                           or BEN2 (MIT) for the best quality (slower)
     pick(src, pts)         → { W, H, a }  pts = [[u, v, 1 keep | 0 not]]  SlimSAM (Apache-2.0)
     find(src, words)       → { w, h, maps: [Float32Array 0–1] } one map per word or phrase   CLIPSeg (Apache-2.0)
     upscale(src, kind)     → canvas, 2× or 4× bigger                       Swin2SR (Apache-2.0): 'sharp' 2×, 'photo' 4×
                                                                           (real-world photos: noise and blur), 'jpeg' 4×
   The models come from huggingface.co; the library (Transformers.js, Apache-2.0) is lib/craft-ai-libs.js. */
(function () {
  'use strict';
  const KEY = 'imagecraft-ai';
  const MODELS = {
    cutout: { id: 'BritishWerewolf/U-2-Net', cpuId: 'BritishWerewolf/U-2-Netp', file: 'onnx/model.onnx', name: 'Background cut-out', what: 'Finds the main subject of a photo and takes the background away, even on busy backgrounds. (About 4 seconds a picture; on a basic computer a small, quicker version is used.)', mb: { gpu: 176, cpu: 176 }, licence: 'Apache-2.0' },
    best: { id: 'onnx-community/BEN2-ONNX', name: 'Best-quality cut-out', what: 'Finer edges (hair, fur) for the background cut-out, but slow: about 20 seconds a picture, and only with a graphics card.', mb: { gpu: 219, cpu: 219 }, licence: 'MIT', gpuOnly: true },
    sharp: { gpuDtype: 'fp32', id: 'Xenova/swin2SR-classical-sr-x2-64', name: 'Upscale 2× (clean pictures)', what: 'Doubles the size of a clean picture and keeps edges sharp instead of blurring them.', mb: { gpu: 48, cpu: 15 }, licence: 'Apache-2.0', scale: 2 },
    photo: { gpuDtype: 'fp32', id: 'Xenova/swin2SR-realworld-sr-x4-64-bsrgan-psnr', name: 'Upscale 4× (old photos)', what: 'Makes an old, small or noisy photo four times bigger and cleans the noise and blur as it goes.', mb: { gpu: 50, cpu: 15 }, licence: 'Apache-2.0', scale: 4 },
    jpeg: { gpuDtype: 'fp32', id: 'Xenova/swin2SR-compressed-sr-x4-48', name: 'Upscale 4× (JPEG clean-up)', what: 'For pictures spoilt by JPEG blocks and smudges: four times bigger with the blocks taken out.', mb: { gpu: 30, cpu: 10 }, licence: 'Apache-2.0', scale: 4 },
    esrgan: { raw: 'https://huggingface.co/SceneWorks/real-esrgan-onnx/resolve/main/real_esrgan_x4.onnx', name: 'Upscale 4× (Real-ESRGAN, real photos)', what: 'The standard for real-world photos: four times bigger, with crisp edges and natural texture in grass, gravel, fabric and leaves; also cleans JPEG blocks and noise.', mb: { gpu: 67, cpu: 67 }, licence: 'BSD-3-Clause', scale: 4 },
    esrgan2: { raw: 'https://huggingface.co/SceneWorks/real-esrgan-onnx/resolve/main/real_esrgan_x2.onnx', name: 'Upscale 2× (Real-ESRGAN)', what: 'Real-ESRGAN at twice the size, for photos that only need a little more.', mb: { gpu: 67, cpu: 67 }, licence: 'BSD-3-Clause', scale: 2 },
    find: { id: 'Xenova/clipseg-rd64-refined', name: 'Find things by name', what: 'Finds sky, grass, trees, people, clothes, buildings and anything you name in a picture, by what they are rather than by their colour, so it works on sepia and faded prints too. (About 15 seconds a picture on the processor.)', mb: { gpu: 139, cpu: 139 }, licence: 'Apache-2.0' },
    pick: { id: 'Xenova/slimsam-77-uniform', name: 'Pick an object', what: 'Click an object in a picture and it is outlined for you, to keep or take out.', mb: { gpu: 21, cpu: 14 }, licence: 'Apache-2.0' },
  };
  const DEFAULTS = { on: true, gpu: null, use: { cutout: true, best: false, sharp: true, photo: true, jpeg: true, esrgan: true, esrgan2: true, find: true, pick: true } };
  let settings = DEFAULTS;
  try { settings = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; settings.use = { ...DEFAULTS.use, ...(settings.use || {}) }; } catch (e) { /* ignore */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ } };

  // ------------------------------------------------------------------ what this computer can do
  let found = null;
  async function probe() {
    const r = { webgpu: false, gpu: '', f16: false, bigBuffers: false, cores: navigator.hardwareConcurrency || 2, memory: navigator.deviceMemory || 0, cache: false };
    try {
      if (navigator.gpu) {
        const a = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
        if (a && !a.isFallbackAdapter) {
          const i = a.info || {};
          r.webgpu = true; r.gpu = [i.vendor, i.architecture, i.description].filter(Boolean).join(' ') || 'a graphics card';
          r.f16 = a.features.has('shader-f16'); r.bigBuffers = (a.limits.maxBufferSize || 0) >= 1024 ** 3;
        }
      }
    } catch (e) { /* no WebGPU */ }
    try { await caches.open('craft-ai-test'); await caches.delete('craft-ai-test'); r.cache = true; } catch (e) { /* no cache */ }
    // a level: high (a strong graphics card), medium (any graphics card), basic (the processor only)
    r.level = r.webgpu && r.f16 && r.bigBuffers ? 'high' : r.webgpu ? 'medium' : 'basic';
    found = r;
    if (settings.gpu == null) settings.gpu = r.webgpu;
    return r;
  }
  const probed = probe();
  const device = () => (settings.gpu && found && found.webgpu ? 'webgpu' : 'wasm');
  // about how many MB a helper downloads on this computer
  const sizeOf = (k) => (k === 'cutout' && cutoutId() === MODELS.cutout.cpuId ? 5 : MODELS[k].mb[device() === 'webgpu' ? 'gpu' : 'cpu']);
  const cutoutId = () => (found && found.level !== 'basic' ? MODELS.cutout.id : MODELS.cutout.cpuId);

  // ------------------------------------------------------------------ the library, loaded the first time it is needed
  let libP = null;
  function lib() {
    if (window.CraftTF) return Promise.resolve(window.CraftTF);
    if (!libP) libP = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = 'lib/craft-ai-libs.js';
      s.onload = async () => {
        const T = window.CraftTF; T.env.allowLocalModels = false; T.env.useBrowserCache = true;
        // the runtime itself (a 20 MB file) is kept too, so it is not fetched again; its small loader stays in the browser's own cache
        try {
          const W = T.ort.env.wasm, base = typeof W.wasmPaths === 'string' ? W.wasmPaths : 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/';
          W.wasmBinary = await fetchCached(base + 'ort-wasm-simd-threaded.jsep.wasm');
        } catch (e) { /* the runtime fetches them itself */ }
        res(T);
      };
      s.onerror = () => { libP = null; rej(new Error('The AI library (lib/craft-ai-libs.js) is missing from the ImageCraft folder.')); };
      document.head.append(s);
    });
    return libP;
  }

  // a file kept in the browser's cache (the same one Transformers.js uses), fetched the first time with progress
  async function fetchCached(url, onProg) {
    let c = null; try { c = await caches.open('transformers-cache'); const hit = await c.match(url); if (hit) return hit.arrayBuffer(); } catch (e) { /* no cache */ }
    const r = await fetch(url); if (!r.ok) throw new Error(`could not download ${url.split('/').pop()} (${r.status})`);
    const total = +r.headers.get('content-length') || 0, rd = r.body.getReader(), parts = []; let got = 0;
    for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; if (onProg && total) onProg(got, total); }
    const buf = await new Blob(parts).arrayBuffer();
    if (c) try { await c.put(url, new Response(buf, { headers: { 'content-type': 'application/octet-stream', 'content-length': String(buf.byteLength) } })); } catch (e) { /* full */ }
    return buf;
  }

  // ------------------------------------------------------------------ models: loaded once, with progress
  const loaded = {}, listeners = new Set();
  const progress = (k, p) => listeners.forEach((f) => f(k, p));
  function onProgress(f) { listeners.add(f); return () => listeners.delete(f); }
  const cpuOnly = new Set();   // models that failed on the graphics card: they use the processor from then on
  const deviceFor = (k) => (cpuOnly.has(k) ? 'wasm' : device());
  // one model at a time: they share one runtime, which must not be entered twice
  let queue = Promise.resolve();
  const inTurn = (fn) => { const p = queue.then(fn, fn); queue = p.catch(() => {}); return p; };
  function run(k, fn) { return inTurn(() => run1(k, fn)); }
  async function run1(k, fn) {
    try { return await fn(await ready(k)); }
    catch (e) {
      if (deviceFor(k) !== 'webgpu' || !/OrtRun|webgpu|shader|GPU/i.test(e.message)) throw e;
      if (window.ICLOG) ICLOG.warn(`AI model “${MODELS[k].name}” failed on the graphics card; using the processor`, e);
      cpuOnly.add(k); progress(k, { status: 'cpu' });
      return fn(await ready(k));
    }
  }
  function ready(k) {
    if (!settings.on) return Promise.reject(new Error('AI helpers are switched off (AI helpers… to switch them on).'));
    if (!settings.use[k] && k !== 'best') return Promise.reject(new Error(`“${MODELS[k].name}” is switched off in AI helpers.`));
    const key = k + ':' + (k === 'cutout' ? cutoutId() : deviceFor(k));
    if (!loaded[key]) loaded[key] = (async () => {
      await probed; const T = await lib(), m = MODELS[k], files = {};
      // the upscalers (Swin2SR) only run on the graphics card in full precision: their half-precision files fail there
      const dv = deviceFor(k), opts = { device: dv, dtype: dv === 'webgpu' ? (m.gpuDtype || (found.f16 || k === 'cutout' ? 'fp16' : 'fp32')) : 'q8', progress_callback: (e) => {
        if (e.status === 'progress' && e.total) { files[e.file] = [e.loaded, e.total]; const v = Object.values(files); progress(k, { loaded: v.reduce((s, x) => s + x[0], 0), total: v.reduce((s, x) => s + x[1], 0) }); }
      } };
      progress(k, { status: 'starting' });
      try {
        let r;
        if (m.raw) { // a plain ONNX file (Real-ESRGAN): ONNX Runtime directly, graphics card first
          const buf = await fetchCached(m.raw, (l, t) => progress(k, { loaded: l, total: t }));
          r = await T.ort.InferenceSession.create(new Uint8Array(buf), { executionProviders: dv === 'webgpu' ? ['webgpu'] : ['wasm'], graphOptimizationLevel: 'all' });
          r.isRaw = true;
        }
        else if (m.scale) r = await T.pipeline('image-to-image', m.id, opts);
        else if (k === 'best') r = await T.pipeline('background-removal', m.id, { ...opts, dtype: 'fp16' });
        else if (k === 'cutout') {
          // U²-Net runs on the processor (the graphics-card runtime cannot run one of its steps yet): the full model on a
          // capable computer (about 4 seconds a picture), the small one on a basic computer
          const url = `https://huggingface.co/${cutoutId()}/resolve/main/${m.file}`;
          const buf = await fetchCached(url, (l, t) => progress(k, { loaded: l, total: t }));
          r = await T.ort.InferenceSession.create(new Uint8Array(buf), { executionProviders: ['wasm'] });
        }
        // CLIPSeg runs on the processor in 8-bit (dependable everywhere; the full-precision file is 545 MB)
        else if (k === 'find') r = { tok: await T.AutoTokenizer.from_pretrained(m.id), processor: await T.AutoProcessor.from_pretrained(m.id), model: await T.AutoModel.from_pretrained(m.id, { ...opts, device: 'wasm', dtype: 'q8' }) };
        else r = { model: await T.SamModel.from_pretrained(m.id, opts), processor: await T.AutoProcessor.from_pretrained(m.id, { progress_callback: opts.progress_callback }) };
        progress(k, { status: 'ready' }); return r;
      } catch (e) {
        delete loaded[key];
        // a model the graphics card cannot run: the processor runs it instead (slower, but it works)
        if (window.ICLOG) ICLOG.warn(`AI model “${m.name}” did not load on ${dv === 'webgpu' ? 'the graphics card' : 'the processor'} (${opts.dtype})`, e);
        if (dv === 'webgpu' && !m.gpuOnly) { cpuOnly.add(k); progress(k, { status: 'cpu' }); return ready(k); }
        const msg = (e && (e.message || String(e))) || 'unknown error'; if (window.ICLOG) ICLOG.error(`AI model “${m.name}” could not be loaded`, e); progress(k, { status: 'error', message: msg }); throw new Error(`${m.name} could not be loaded: ${msg}`);
      }
    })();
    return loaded[key];
  }

  // pictures: a data URL, an <img> or a <canvas>, read as a canvas (at most max pixels across) and a RawImage
  const imgOf = (src) => new Promise((res, rej) => { if (src instanceof HTMLCanvasElement || src instanceof HTMLImageElement) return res(src); const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That picture could not be read.')); i.src = src; });
  async function canvasOf(src, max) {
    const im = await imgOf(src), iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height, k = Math.min(1, max / Math.max(iw, ih));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(iw * k)); c.height = Math.max(1, Math.round(ih * k));
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height); return c;
  }
  const rawOf = async (T, c) => T.RawImage.fromCanvas ? T.RawImage.fromCanvas(c) : T.RawImage.fromURL(c.toDataURL('image/png'));
  // a few answers are kept, so moving a slider does not run a model again
  const memo = new Map();
  const remember = (key, p) => { memo.set(key, p); if (memo.size > 12) memo.delete(memo.keys().next().value); p.catch(() => memo.delete(key)); return p; };
  const keyOf = (src) => (typeof src === 'string' ? src.length + ':' + src.slice(-64) : src);

  // a float grid from a tensor [.., h, w], resampled to W × H
  function resample(data, w, h, W, H) {
    const out = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const fx = ((x + 0.5) * w) / W - 0.5, fy = ((y + 0.5) * h) / H - 0.5, x0 = Math.max(0, Math.min(w - 1, Math.floor(fx))), y0 = Math.max(0, Math.min(h - 1, Math.floor(fy))), x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1), tx = Math.max(0, Math.min(1, fx - x0)), ty = Math.max(0, Math.min(1, fy - y0));
      out[y * W + x] = (data[y0 * w + x0] * (1 - tx) + data[y0 * w + x1] * tx) * (1 - ty) + (data[y1 * w + x0] * (1 - tx) + data[y1 * w + x1] * tx) * ty;
    }
    return out;
  }

  // ------------------------------------------------------------------ the helpers
  function cutout(src) {
    return remember('cutout:' + (settings.use.best ? 'best:' : '') + keyOf(src), (async () => {
      const T = await lib(), c = await canvasOf(src, 1024);
      if (!(settings.use.best && device() === 'webgpu')) {
        // U²-Net: the picture at 320 × 320 in ImageNet colours; out comes how likely each point is the subject
        const N = 320, s2 = document.createElement('canvas'); s2.width = s2.height = N; s2.getContext('2d').drawImage(c, 0, 0, N, N);
        const D = s2.getContext('2d').getImageData(0, 0, N, N).data, x = new Float32Array(3 * N * N), mean = [0.485, 0.456, 0.406], sd = [0.229, 0.224, 0.225];
        let mx = 1; for (let i = 0; i < N * N; i++) mx = Math.max(mx, D[i * 4], D[i * 4 + 1], D[i * 4 + 2]);
        for (let i = 0; i < N * N; i++) for (let q = 0; q < 3; q++) x[q * N * N + i] = (D[i * 4 + q] / mx - mean[q]) / sd[q];
        const out = await run('cutout', (ses) => ses.run({ [ses.inputNames[0]]: new T.ort.Tensor('float32', x, [1, 3, N, N]) }).then((o) => o[ses.outputNames[0]]));
        const d = out.data; let lo = Infinity, hi = -Infinity; for (let i = 0; i < d.length; i++) { if (d[i] < lo) lo = d[i]; if (d[i] > hi) hi = d[i]; }
        const f = resample(d, N, N, c.width, c.height), k = 255 / Math.max(1e-6, hi - lo), a = new Uint8Array(f.length);
        for (let i = 0; i < f.length; i++) a[i] = Math.max(0, Math.min(255, (f[i] - lo) * k));
        return { W: c.width, H: c.height, a };
      }
      const raw0 = await rawOf(T, c), out = await run('best', (pipe) => pipe(raw0)), im = Array.isArray(out) ? out[0] : out;
      const ch = im.channels || 4, a = new Uint8Array(im.width * im.height); for (let i = 0; i < a.length; i++) a[i] = im.data[i * ch + ch - 1];
      if (im.width === c.width && im.height === c.height) return { W: c.width, H: c.height, a };
      const f = resample(Float32Array.from(a), im.width, im.height, c.width, c.height); return { W: c.width, H: c.height, a: Uint8Array.from(f) };
    })());
  }
  // Upscale in tiles (so a big picture fits in memory and progress can be shown); the tiles overlap and only their
  // middles are kept, so no seams show. See-through parts keep their see-through, scaled up smoothly.
  async function upscale(src, kind = 'sharp', onTile) {
    const T = await lib(), m = MODELS[kind], S = m.scale, im = await imgOf(src), W = im.naturalWidth || im.width, H = im.naturalHeight || im.height;
    const out = document.createElement('canvas'); out.width = W * S; out.height = H * S; const ox = out.getContext('2d');
    // Tiles overlap by OV pixels and are faded into each other (weights ramp down over the overlap), so no seam shows.
    // The model pads each tile to a multiple of its window, so its output can be a little bigger than the tile: only
    // the tile's own part (exactly S times its size, from the top left) is used.
    const TILE = 160, OV = 24, tiles = [];
    for (let y = 0; y < H; y += TILE) for (let x = 0; x < W; x += TILE) tiles.push([x, y]);
    const OW = W * S, OH = H * S, acc = new Float32Array(OW * OH * 3), wsum = new Float32Array(OW * OH);
    let n = 0;
    for (const [x, y] of tiles) {
      const x0 = Math.max(0, x - OV), y0 = Math.max(0, y - OV), x1 = Math.min(W, x + TILE + OV), y1 = Math.min(H, y + TILE + OV);
      const c = document.createElement('canvas'); c.width = x1 - x0; c.height = y1 - y0; const cx = c.getContext('2d');
      cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height); cx.drawImage(im, -x0, -y0);
      let res;
      if (m.raw) {
        // Real-ESRGAN: [1, 3, h, w] RGB 0–1 in, [1, 3, S·h, S·w] out
        const cw = c.width, chh = c.height, px = cx.getImageData(0, 0, cw, chh).data, inp = new Float32Array(3 * cw * chh);
        for (let i = 0; i < cw * chh; i++) { inp[i] = px[i * 4] / 255; inp[cw * chh + i] = px[i * 4 + 1] / 255; inp[2 * cw * chh + i] = px[i * 4 + 2] / 255; }
        const o = await run(kind, (ses) => ses.run({ [ses.inputNames[0]]: new T.ort.Tensor('float32', inp, [1, 3, chh, cw]) }).then((x) => x[ses.outputNames[0]]));
        const ow = o.dims[3], oh = o.dims[2], od = o.data, hwc = new Uint8ClampedArray(ow * oh * 3), plane = ow * oh;
        for (let i = 0; i < plane; i++) { hwc[i * 3] = od[i] * 255; hwc[i * 3 + 1] = od[plane + i] * 255; hwc[i * 3 + 2] = od[2 * plane + i] * 255; }
        res = { data: hwc, width: ow, height: oh, channels: 3 };
      } else { const raw = await rawOf(T, c), r = await run(kind, (pipe) => pipe(raw)); res = Array.isArray(r) ? r[0] : r; }
      const ch = res.channels, rw = res.width;
      const tw = Math.min((x1 - x0) * S, res.width), th = Math.min((y1 - y0) * S, res.height);
      // how much each output pixel of this tile counts: full in the middle, fading to the tile's edges inside the
      // picture (not at the picture's own edges)
      const ramp = (pos, lo, hi, atLo, atHi) => { const a = atLo ? 1 : Math.min(1, (pos - lo + 0.5) / (OV * S)), b = atHi ? 1 : Math.min(1, (hi - pos - 0.5) / (OV * S)); return Math.max(0.001, Math.min(a, b)); };
      for (let v = 0; v < th; v++) {
        const Y = y0 * S + v, wy = ramp(v, 0, th, y0 === 0, y1 === H);
        for (let u = 0; u < tw; u++) {
          const X = x0 * S + u, w = wy * ramp(u, 0, tw, x0 === 0, x1 === W), q = Y * OW + X, i = (v * rw + u) * ch;
          acc[q * 3] += res.data[i] * w; acc[q * 3 + 1] += res.data[i + 1] * w; acc[q * 3 + 2] += res.data[i + 2] * w; wsum[q] += w;
        }
      }
      n++; if (onTile) onTile(n, tiles.length);
      await new Promise((r2) => setTimeout(r2, 0)); // let the page breathe between tiles
    }
    const od = ox.createImageData(OW, OH);
    for (let q = 0; q < OW * OH; q++) { const w = wsum[q] || 1; od.data[q * 4] = acc[q * 3] / w; od.data[q * 4 + 1] = acc[q * 3 + 1] / w; od.data[q * 4 + 2] = acc[q * 3 + 2] / w; od.data[q * 4 + 3] = 255; }
    ox.putImageData(od, 0, 0);
    // see-through: the original's alpha, scaled smoothly
    const a = document.createElement('canvas'); a.width = out.width; a.height = out.height; const ax = a.getContext('2d'); ax.imageSmoothingQuality = 'high'; ax.drawImage(im, 0, 0, a.width, a.height);
    const ad = ax.getImageData(0, 0, a.width, a.height).data;
    let any = false; for (let i = 3; i < ad.length; i += 4) if (ad[i] < 255) { any = true; break; }
    if (any) { const od = ox.getImageData(0, 0, out.width, out.height); for (let i = 3; i < ad.length; i += 4) od.data[i] = ad[i]; ox.putImageData(od, 0, 0); }
    return out;
  }
  // Find things by name (CLIPSeg): one 352 × 352 map of 0–1 per word, for the whole picture
  async function find(src, words) {
    const T = await lib(), c = await canvasOf(src, 1024), raw = await rawOf(T, c);
    return run('find', async ({ tok, processor, model }) => {
      const ti = tok(words, { padding: true, truncation: true }), ii = await processor(words.map(() => raw)), { logits } = await model({ ...ti, ...ii });
      const dims = logits.dims, h = dims[dims.length - 2], w = dims[dims.length - 1], d = logits.data, maps = [];
      for (let k = 0; k < words.length; k++) { const m = new Float32Array(w * h); for (let i = 0; i < m.length; i++) m[i] = 1 / (1 + Math.exp(-d[k * w * h + i])); maps.push(m); }
      return { w, h, maps };
    });
  }
  function pick(src, pts) {
    return remember('pick:' + keyOf(src) + JSON.stringify(pts), (async () => {
      const T = await lib(), c = await canvasOf(src, 1024), image = await rawOf(T, c);
      const { out, masks } = await run('pick', async (sam) => {
        const ek = 'emb:' + keyOf(src) + ':' + deviceFor('pick');
        if (!memo.has(ek)) remember(ek, sam.processor(image).then((inp) => sam.model.get_image_embeddings(inp)));
        const emb = await memo.get(ek);
        const inp = await sam.processor(image, { input_points: [[pts.map(([u, v]) => [u * c.width, v * c.height])]], input_labels: [[pts.map((p) => (p[2] === 0 ? 0 : 1))]] });
        const o = await sam.model({ ...emb, input_points: inp.input_points, input_labels: inp.input_labels });
        return { out: o, masks: await sam.processor.post_process_masks(o.pred_masks, inp.original_sizes, inp.reshaped_input_sizes) };
      });
      const m = masks[0], sc = out.iou_scores.data;
      let best = 0; for (let i = 1; i < sc.length; i++) if (sc[i] > sc[best]) best = i;
      const dims = m.dims, H = dims[dims.length - 2], W = dims[dims.length - 1], a = new Uint8Array(W * H), off = best * W * H;
      for (let i = 0; i < W * H; i++) a[i] = m.data[off + i] ? 255 : 0;
      return { W, H, a };
    })());
  }

  // ------------------------------------------------------------------ downloaded or not
  async function downloaded() {
    const have = {}; Object.keys(MODELS).forEach((k) => { have[k] = false; });
    try { const c = await caches.open('transformers-cache'), keys = (await c.keys()).map((r) => r.url); Object.entries(MODELS).forEach(([k, m]) => { const id = k === 'cutout' ? cutoutId() : m.id; have[k] = keys.some((u) => u.includes(id + '/') && /\.onnx/.test(u)); }); } catch (e) { /* none */ }
    return have;
  }
  async function forget() { try { await caches.delete('transformers-cache'); } catch (e) { /* ignore */ } Object.keys(loaded).forEach((k) => delete loaded[k]); memo.clear(); }
  const enabled = (k) => settings.on && settings.use[k];

  // ------------------------------------------------------------------ the AI helpers dialog
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  async function openSettings() {
    await probed;
    let back = document.getElementById('aidlg');
    if (!back) { back = document.createElement('div'); back.className = 'backdrop'; back.id = 'aidlg'; document.body.append(back); }
    const LEVEL = { high: 'High: a strong graphics card. Every helper runs quickly.', medium: 'Medium: a graphics card. Every helper works; the cut-out takes a few seconds.', basic: 'Basic: no graphics card the browser can use, so the processor does the work. Slower, but everything still works.' };
    const draw = async () => {
      const have = await downloaded(), dev = device() === 'webgpu' ? 'gpu' : 'cpu';
      back.innerHTML = `<div class="dialog wide" role="dialog" aria-modal="true" aria-labelledby="ai-title">
        <h2 id="ai-title">AI helpers</h2>
        <p class="hint">Small AI models that run inside this browser: nothing is sent anywhere, no account or key. Each downloads once when first used (or now), then works offline.</p>
        <div class="field"><span>This computer (checked automatically)</span>
          <p style="margin:4px 0">${found.webgpu ? `Graphics card: <b>${esc(found.gpu)}</b>${found.f16 ? ', fast half-precision maths' : ''}` : 'No graphics card the browser can use for AI.'} · ${found.cores} processor threads${found.memory ? ` · ${found.memory >= 32 ? '32 GB or more' : found.memory + ' GB'} memory` : ''}</p>
          <p class="hint" style="margin:0">${LEVEL[found.level]}</p></div>
        <label class="check"><input type="checkbox" data-ai="on" ${settings.on ? 'checked' : ''}> Use AI helpers</label>
        <label class="check"><input type="checkbox" data-ai="gpu" ${settings.gpu ? 'checked' : ''} ${found.webgpu ? '' : 'disabled'}> Use the graphics card ${found.webgpu ? '(found)' : '(none found)'}</label>
        <div class="field"><span>Helpers</span>${Object.entries(MODELS).map(([k, m]) => `
          <div class="ai-row" style="display:flex;gap:10px;align-items:flex-start;padding:6px 0;border-top:1px solid var(--line)">
            <label class="check" style="flex:1"><input type="checkbox" data-use="${k}" ${settings.use[k] ? 'checked' : ''} ${m.gpuOnly && !found.webgpu ? 'disabled' : ''}> <span><b>${m.name}</b><br><span class="hint">${m.what} About ${sizeOf(k)} MB · ${m.licence}</span></span></label>
            <span class="hint" data-state="${k}" style="min-width:110px;text-align:right">${have[k] ? '✓ Downloaded' : 'Not downloaded'}</span></div>`).join('')}</div>
        <p class="hint" id="ai-note"></p>
        <div class="dialog-actions"><button class="btn" type="button" data-act="forget">Remove downloaded models</button><button class="btn" type="button" data-act="get">Download now</button><button class="btn primary" type="button" data-act="close">Close</button></div></div>`;
    };
    await draw(); back.hidden = false;
    back.onchange = (e) => {
      const t = e.target;
      if (t.dataset.ai === 'on') settings.on = t.checked; else if (t.dataset.ai === 'gpu') settings.gpu = t.checked; else if (t.dataset.use) settings.use[t.dataset.use] = t.checked;
      save();
    };
    const off = onProgress((k, p) => {
      const el = back.querySelector(`[data-state="${k}"]`); if (!el) return;
      el.title = p.status === 'error' ? p.message || '' : ''; // the reason, on hover (and in the Debug tab)
      el.textContent = p.status === 'ready' ? '✓ Ready' : p.status === 'error' ? 'Could not load' : p.total ? `Downloading ${Math.round((p.loaded / p.total) * 100)}%` : 'Starting…';
    });
    back.onclick = async (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'close') { back.hidden = true; off(); return; }
      if (b.dataset.act === 'forget') { await forget(); await draw(); back.querySelector('#ai-note').textContent = 'Downloaded models removed. They download again when next used.'; return; }
      if (b.dataset.act === 'get') {
        b.disabled = true; const note = back.querySelector('#ai-note');
        for (const k of Object.keys(MODELS)) { if (!enabled(k)) continue; try { note.textContent = `Getting ${MODELS[k].name}…`; await ready(k); } catch (err) { note.textContent = err.message; } }
        if (!/could not/.test(note.textContent)) note.textContent = 'All set: the helpers that are ticked are ready, and work offline from now on.';
        b.disabled = false;
      }
    };
  }

  window.CRAFTAI = { find, sizeOf, probe: () => probed, found: () => found, settings: () => settings, enabled, ready, cutout, pick, upscale, onProgress, downloaded, forget, openSettings, MODELS };
})();

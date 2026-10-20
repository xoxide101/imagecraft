/* ImageCraft – Process a photo (IC.process): what you want to do (edits, make bigger, colour correction, repair) and
   what the photo needs, measured, become one plan in the order that works best:
     repair (printing dots, JPEG blocks, specks, then what you mark by hand) → clean (noise, blur) → light and colour →
     your own edits → faces → make bigger → a light final sharpen.
   Each step says why (the measurement behind it) and roughly how long it takes. Steps that need a person (crop, curves,
   painting tears) are listed as "your turn" with a button to open the tool.
     measure(img, { faces }) → findings      plan(findings, goals, { factor }) → [{ id, s, label, why, on, manual, ms }]
   Measured only (no AI) unless faces are asked for. Thresholds are the ones tested on the sample and test photos. */
(function () {
  'use strict';
  const IC = (window.IC = window.IC || {});

  // a centre crop for the slower measures on big pictures (the whole picture is not needed to judge noise or a screen)
  function centre(img, n) {
    if (img.width <= n && img.height <= n) return img;
    const w = Math.min(n, img.width), h = Math.min(n, img.height), x0 = (img.width - w) >> 1, y0 = (img.height - h) >> 1, o = new ImageData(w, h);
    for (let y = 0; y < h; y++) o.data.set(img.data.subarray(((y0 + y) * img.width + x0) * 4, ((y0 + y) * img.width + x0 + w) * 4), y * w * 4);
    return o;
  }
  async function measure(img, { faces = false, say } = {}) {
    const R = IC.restore, X = IC.filters, M = IC.maps, W = img.width, H = img.height, d = img.data, n = W * H, f = { W, H, mp: (W * H) / 1e6 };
    say && say('Measuring noise and blur…'); await null;
    const c = centre(img, 1024);
    f.noise = R.noiseLevel(c); const bl = R.measure(c); f.blur = bl ? bl.radius : 0;
    say && say('Looking for JPEG blocks and printing dots…'); await new Promise((r) => setTimeout(r, 0));
    f.blocks = R.blockiness(img); f.screen = R.descreen(centre(img, 1024), { detectOnly: true });
    say && say('Light and colour…'); await new Promise((r) => setTimeout(r, 0));
    // light: mean, spread (1st to 99th percentile) and clipping, on a sample of pixels
    const st = Math.max(1, Math.floor(n / 200000)), hist = new Uint32Array(256); let sum = 0, k = 0, clipW = 0, clipB = 0, colours = new Set();
    for (let p = 0; p < n; p += st) { const r = d[p * 4], g = d[p * 4 + 1], b = d[p * 4 + 2], L = Math.round(0.299 * r + 0.587 * g + 0.114 * b); hist[L]++; sum += L; k++; if (Math.min(r, g, b) >= 253) clipW++; if (Math.max(r, g, b) <= 2) clipB++; if (colours.size < 300) colours.add((r << 16) | (g << 8) | b); }
    const pct = (q) => { let c2 = 0; for (let i = 0; i < 256; i++) { c2 += hist[i]; if (c2 >= q * k) return i; } return 255; };
    f.mean = sum / k / 255; f.lo = pct(0.01) / 255; f.hi = pct(0.99) / 255; f.spread = f.hi - f.lo; f.clipped = (clipW + clipB) / k; f.fewColours = colours.size < 300 ? colours.size : 0;
    f.toned = X.isToned(img); f.cast = M.castRatio(img); f.haze = X.hazeLevel(c);
    say && say('Specks…'); await new Promise((r) => setTimeout(r, 0));
    const sp = M.damage(c, { specks: true }); let s2 = 0; sp.forEach((v) => (s2 += v)); f.specks = s2 / sp.length;
    f.dots = X.dotsOff(c, { countOnly: true }).frac;
    const fl = M.damage(c, { specks: false, flecks: true }); let s3 = 0; fl.forEach((v) => (s3 += v)); f.flecks = s3 / fl.length;
    f.kind = f.fewColours && f.fewColours <= 64 && n < 600000 ? 'pixel' : f.fewColours && f.fewColours < 300 ? 'drawing' : 'photo';
    if (faces) { say && say('Finding faces (the first time downloads the face finder)…'); try { const fs = await IC.faces.ensure(img); f.faces = fs.length; f.faceSize = fs.length ? Math.min(...fs.map((q) => q.box[2] - q.box[0])) : 0; } catch (e) { f.faces = null; } }
    return f;
  }
  // what kind of picture: pixel art (few colours, small), vector art (flat colour areas, few colours), a drawing (mostly
  // plain paper, little colour, dark lines) or a photo. A painting is not guessed (it reads as a photo): chosen by the person.
  function guessKind(img) {
    const W = img.width, H = img.height, d = img.data, n = W * H, st = Math.max(1, Math.floor(n / 150000)), cols = new Set(), q5 = new Set();
    let paper = 0, dark = 0, chroma = 0, flat = 0, k = 0, ink = 0, inkC = 0, inkFlat = 0;
    for (let p = 0; p + W + 1 < n; p += st) { const i = p * 4, r = d[i], g = d[i + 1], b = d[i + 2], L = 0.299 * r + 0.587 * g + 0.114 * b, mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (cols.size < 5000) cols.add((r << 16) | (g << 8) | b); q5.add(((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)); k++; chroma += mx - mn; const isPaper = L > 200 && mx - mn < 40; if (isPaper) paper++; else { ink++; inkC += mx - mn; } if (L < 110) dark++;
      const j = i + 4, l = i + W * 4; if (Math.abs(d[j] - r) + Math.abs(d[j + 1] - g) + Math.abs(d[j + 2] - b) < 6 && Math.abs(d[l] - r) + Math.abs(d[l + 1] - g) + Math.abs(d[l + 2] - b) < 6) { flat++; if (!(L > 200 && mx - mn < 40)) inkFlat++; } }
    const fc = cols.size, pf = paper / k, df = dark / k, cm = chroma / k / 255, ff = flat / k, ic = ink ? inkC / ink / 255 : 0, iff = ink ? inkFlat / ink : 0; // ic: how colourful the marks are (not the paper)
    if (fc <= 64 && n < 600000) return { kind: 'pixel', why: `${fc} colours, small` };
    if (pf > 0.3 && ic > 0.25 && iff > 0.45) return { kind: 'logo', why: `strong solid colours on a plain background (${Math.round(iff * 100)}% of the marks flat)` };
    if (pf > 0.5 && df < 0.3 && ic < 0.18) return { kind: 'drawing', why: `${Math.round(pf * 100)}% plain paper, grey or dark marks` };
    if (ff > 0.6 && q5.size < 1500) return { kind: 'vector', why: `${Math.round(ff * 100)}% flat colour areas, ${q5.size < 300 ? 'few' : 'a limited number of'} colours` };
    return { kind: 'photo', why: 'continuous tones' };
  }
  // what the findings say, in words (for the panel)
  function describe(f) {
    const L = [];
    L.push(`${f.W} × ${f.H} pixels (${f.mp.toFixed(1)} megapixels)${f.kind === 'pixel' ? ', pixel art' : f.kind === 'drawing' ? ', a drawing or graphic (few colours)' : ''}.`);
    L.push(`Noise ${f.noise.luma.toFixed(1)} (colour ${f.noise.chroma.toFixed(1)})${f.noise.luma > 3 ? ': grainy' : f.noise.luma > 1.5 ? ': a little grain' : ': clean'}. Blur about ${f.blur.toFixed(1)} px${f.blur > 1.2 ? ': soft' : ''}.`);
    if (f.blocks.luma > 1.3 || f.blocks.colour > 2) L.push(`JPEG blocks ${f.blocks.luma.toFixed(1)}× (colour ${f.blocks.colour.toFixed(1)}×): heavily compressed.`);
    if (f.screen.peaks) L.push(`Printing dots every ${f.screen.period.toFixed(1)} px (a printed photo).`);
    L.push(`Light: average ${(f.mean * 100).toFixed(0)}%, range ${(f.lo * 100).toFixed(0)}–${(f.hi * 100).toFixed(0)}%${f.spread < 0.6 ? ' (faded, flat)' : ''}${f.mean < 0.33 ? ' (dark)' : ''}; haze ${f.haze.toFixed(2)}${f.haze > 0.22 ? ' (a grey veil)' : ''}${f.clipped > 0.02 ? `; ${(f.clipped * 100).toFixed(0)}% pure white or black (lost, cannot be brought back)` : ''}.`);
    L.push(f.toned ? 'Colour: black and white or toned (sepia).' : f.cast > 1.2 ? `Colour: leans one way (cast ${f.cast.toFixed(1)}).` : 'Colour: natural range.');
    if (f.specks > 0.0002) L.push(`Specks and dust: ${(f.specks * 100).toFixed(2)}% of the picture.`);
    if (f.faces != null) L.push(f.faces ? `${f.faces} face${f.faces === 1 ? '' : 's'}${f.faceSize < 120 ? ` (the smallest is ${Math.round(f.faceSize)} px across: small)` : ''}.` : 'No faces found.');
    return L;
  }
  // rough time for a step on this picture (ms), from tested speeds; the AI ones from this computer's own timings when known
  const PER_MP = { cutout: 400, aa: 800, dots: 600, paper: 300, remaster: 4000, descreen: 400, deblock: 300, chroma: 400, repair: 600, nlm: 6000, deblur: 9000, autocolour: 400, balance: 200, shadows: 900, dehaze: 900, clahe: 500, light: 100, sharpen: 200, deband: 1500, resize: 600 };
  function estimate(step, f, speed) {
    const sp = speed || {};
    if (step.id === 'upscale') { const sq = Math.ceil(f.W / 160) * Math.ceil(f.H / 160); return sq * (sp['esrgan3'] || 150) + 500; }
    if (step.id === 'colourise') return sp.colourise || 10000;
    if (step.id === 'facerestore') return (f.faces || 1) * (sp.codeformer || 6000) + (sp.codeformer ? 0 : 40000);
    return (PER_MP[step.id] || 500) * Math.max(0.3, f.mp) * (step.ms8 === false ? 1 : 1.5); // ×1.5: the 16-bit pass
  }
  // the plan: goals = { edits, bigger, colour, repair }, factor = 2 | 4
  // auto: nothing is left for the person (damage found automatically; no edits). touchup: a later pass of Fix everything,
  // only what still measures as needing it (stricter, so nothing is done twice for a marginal reading), and not the
  // one-time steps (colourise, faces, make bigger). also: { faces, colourise } chosen for Fix everything.
  function plan(f, goals, o = {}) {
    const K = o.kind || (f.kind === 'pixel' ? 'pixel' : f.kind === 'drawing' ? 'vector' : 'photo');
    if (K === 'photo') return planPhoto(f, goals, o);
    const { factor = 2, speed, touchup = false } = o, P = [], add = (id, label, why, s = {}, on = true) => P.push({ id, label, why, s, on }), W2 = Math.round(f.W * factor), H2 = Math.round(f.H * factor);
    if (K === 'painting') { // the photo plan, keeping the brushwork: no faces or colour guessed, no deblur, only strong noise, a light finish
      const Q = planPhoto(f, goals, { ...o, also: {} }).filter((x) => !['facerestore', 'facerefine', 'colourise', 'deblur'].includes(x.id) && !(x.id === 'nlm' && f.noise.luma < 4));
      Q.forEach((x) => { if (x.id === 'nlm') { x.label = 'Remove noise (gently)'; x.s = { ...x.s, strength: 50 }; } if (x.id === 'sharpen') { x.on = false; x.s = { ...x.s, cas: 15 }; } if (x.id === 'upscale') x.s = { ...x.s, denoise: 10 }; if (x.id === 'repair' && !x.manual) x.label = touchup ? 'Repair what is left' : 'Repair cracks, flaking and specks'; if (x.id === 'balance') x.why += ' (yellowed varnish or light)'; });
      Q.forEach((st) => { if (!st.manual) st.ms = estimate(st, f, speed); }); return Q;
    }
    if (K === 'drawing') {
      if (!touchup && f.screen.peaks) add('descreen', 'Descreen', `printing dots every ${f.screen.period.toFixed(1)} px (a printed drawing or comic)`);
      if (f.blocks.luma > (touchup ? 1.7 : 1.3)) add('deblock', 'Remove JPEG blocks', `blocks ${f.blocks.luma.toFixed(1)}×`, { strength: 50 });
      if (!touchup && (goals.repair || goals.colour)) add('paper', 'Clean the paper', 'the paper made white and even; the lines kept and deepened', { strength: 85, deepen: 30, keepColour: !f.toned });
      if (f.dots > (touchup ? 0.0003 : 0.00005)) add('dots', 'Remove stray dots', `${(f.dots * 100).toFixed(3)}% of the picture in small marks that touch no line (lines are never touched)`, { size: 12 });
      if (goals.bigger && !touchup) add('resize', `Make bigger ${factor}× (Splat)`, 'a drawing: edge-following, smooth lines without halos', { w: W2, h: H2, method: 'splat' });
      if (!touchup) add('sharpen', 'Crisp lines', 'a light finish on the lines', { how: 'smart', cas: 25 }, true);
    } else if (K === 'vector') {
      if (f.blocks.luma > (touchup ? 1.4 : 1.1)) add('deblock', 'Remove JPEG blocks', `blocks ${f.blocks.luma.toFixed(1)}× around the flat colours`, { strength: 70 });
      if (!touchup && (goals.repair || goals.colour || goals.bigger)) { const vc = (o.also && o.also.vcolours) || 'keep'; if (vc !== 'keep') add('remaster', `Rebuild the shapes${goals.bigger ? ` ${factor}× bigger` : ''} (${vc === 'rich' ? 'rich colours' : vc + ' colours'})`, vc === 'rich' ? 'clean shapes, keeping the shades and gradients (6 to 12 colours)' : `clean shapes in ${vc} colours`, { scale: goals.bigger ? Math.min(4, factor) : 1, colours: vc, where: 'all', blend: 100 }); else if (goals.bigger) add('resize', `Make bigger ${factor}× (Splat)`, 'all colours kept: edge-following, no halos', { w: W2, h: H2, method: 'splat' });
        // then the background away (inside the shapes too) with the white blend taken off the edges, and only then the edges smoothed
        add('cutout', 'Take the background away (see-through)', 'the background colour, inside the shapes too; the white blend taken off the edges', { mode: 'edges', tolerance: 40, inside: true, defringe: true, points: [] }, o.also ? o.also.transparent !== false : true);
        add('aa', 'Smooth the edges', 'last, after the background and its white edge blend are gone, so no white creeps back', { amount: 60, threshold: 32, show: 'result' }); }
    } else if (K === 'logo') { // precision first: nothing redrawn or flattened
      if (f.blocks.luma > (touchup ? 1.4 : 1.1)) add('deblock', 'Remove JPEG blocks', `blocks ${f.blocks.luma.toFixed(1)}× around the colours`, { strength: 60 });
      if (!touchup) { if (goals.bigger) add('resize', `Make bigger ${factor}× (Splat)`, 'edge-following: lettering stays crisp, no halos', { w: W2, h: H2, method: 'splat' }); add('cutout', 'Take the background away (see-through)', 'the background colour, inside the letters too; the white blend taken off the edges', { mode: 'edges', tolerance: 40, inside: true, defringe: true, points: [] }, o.also ? o.also.transparent !== false : true); add('aa', 'Smooth the edges', 'last, after the background and its white edge blend are gone', { amount: 50, threshold: 32, show: 'result' }); }
    } else if (K === 'pixel') {
      if (goals.bigger && !touchup) add('resize', `Make bigger ${factor}× (pixel art, MMPX)`, 'shapes and dithering kept, no new colours', { w: W2, h: H2, method: 'mmpx' });
    }
    P.forEach((st) => { st.ms = estimate(st, f, speed); }); return P;
  }
  function planPhoto(f, goals, { factor = 2, speed, auto = false, touchup = false, also = {} } = {}) {
    const k = touchup ? 1.3 : 1;
    const P = [], add = (id, label, why, s = {}, on = true, extra = {}) => P.push({ id, label, why, s, on, ...extra });
    const manual = (id, label, why, extra = {}) => P.push({ id, label, why, manual: true, on: true, ...extra });
    const photo = f.kind === 'photo';
    // 1 repair: printing dots and JPEG blocks come out before anything sharpens them; then specks; then the person marks the rest
    if (goals.repair || goals.colour || goals.bigger) {
      if (f.screen.peaks) add('descreen', 'Descreen', `printing dots every ${f.screen.period.toFixed(1)} px`);
      if (f.blocks.luma > 1.3 * k) add('deblock', 'Remove JPEG blocks', `blocks ${f.blocks.luma.toFixed(1)}× at the 8-pixel grid (a clean photo is about 1)`, { strength: 50 });
      if (f.blocks.colour > 2 * k) add('chroma', 'Rebuild colour detail', `colour in blocks ${f.blocks.colour.toFixed(1)}×`, { size: 8 });
    }
    if (goals.repair) {
      if (auto) { if (!touchup || f.specks > 0.0002 * k || f.flecks > 0.0005 * k) add('repair', touchup ? 'Repair what is left' : 'Repair damage (found automatically)', `${(f.specks * 100).toFixed(2)}% specks, ${(f.flecks * 100).toFixed(2)}% flecks and flaking${touchup ? '' : ', and scratches (AI finder)'}; filled with AI`, { specks: true, flecks: true, scratches: !touchup, level: 50, how: 'ai', auto: true }); }
      else {
      if (f.specks > 0.0002) add('repair', 'Repair specks and dust', `${(f.specks * 100).toFixed(2)}% specks (filled from the edges, Telea)`, { specks: true, flecks: false, how: 'smooth' });
      manual('repair', 'Mark tears, flaking and stains', 'your turn: paint over them (or click them) in Repair damage, then choose AI fill for anything bigger than a speck');
      }
    }
    // 2 clean: noise before sharpening, blur after the noise is gone
    if ((goals.repair || goals.colour || goals.bigger) && photo) {
      if (f.noise.luma > 1.5 * k || f.noise.chroma > 1.5 * k) add('nlm', 'Remove noise (smart)', `noise ${f.noise.luma.toFixed(1)} / colour ${f.noise.chroma.toFixed(1)}`);
      if (f.blur > 1.2 * k && goals.repair) add('deblur', 'Restore sharpness', `blur about ${f.blur.toFixed(1)} px`, {}, f.blur < 3);
    }
    // 3 light and colour
    if (goals.colour) {
      if (f.mean < 0.33 / k) add('shadows', 'Recover shadows', `dark: average ${(f.mean * 100).toFixed(0)}%`);
      if (f.haze > 0.22 * k) add('dehaze', 'Dehaze', `grey veil ${f.haze.toFixed(2)}`);
      if (f.toned) { add('autocolour', 'Auto colour (keeping the tone)', 'black and white or sepia: levels and fade fixed, the tone kept', { keepTone: 'auto' }); if (!touchup) add('colourise', 'Colourise (AI, a guess)', 'black and white: likely colours, only the colour guessed', { amount: 80 }, !!(auto && also.colourise)); }
      else { if (f.cast > 1.2 * k) add('balance', 'Fix a colour cast', `colours lean one way (${f.cast.toFixed(1)})`); if (!touchup || f.spread < 0.6) add('autocolour', 'Auto colour', f.spread < 0.6 ? `faded: range only ${(f.spread * 100).toFixed(0)}%` : 'levels and colour balance', {}, true); }
      if (f.spread < 0.5 / k) add('clahe', 'Bring back faded detail', `very flat: range ${(f.spread * 100).toFixed(0)}%`, {}, false);
    }
    // 4 your own edits (Photoshop-style), in the usual order
    if (goals.edits && !auto) {
      manual('straighten', 'Straighten', 'your turn, if the horizon or a wall leans');
      manual('crop', 'Crop', 'your turn: frame it');
      manual('curves', 'Curves (or Brightness)', 'your turn: the overall light; use Where to work on the sky, faces or background alone');
      manual('colour', 'Colour', 'your turn: warmth, saturation, vibrance');
      manual('clarity', 'Clarity and detail', 'your turn: local contrast (Detail equaliser for finer control)');
    }
    // 5 faces (only on request: they are redrawn)
    if ((goals.repair || goals.colour) && f.faces && !touchup) { if (f.faceSize < 160 || (auto && also.faces)) add('facerestore', 'Restore faces (AI, redrawn)', `${f.faces} face${f.faces === 1 ? '' : 's'}, the smallest ${Math.round(f.faceSize)} px across`, { fidelity: 70 }, !!(auto && also.faces)); else if (!auto) manual('facerefine', 'Face refine', 'your turn: skin, eyes and teeth gently, nothing redrawn'); }
    // 6 bigger: by kind; photos 4× with the AI and then a careful shrink when 2× is wanted (enlarging past the target and averaging down)
    if (goals.bigger && !touchup) {
      const W2 = Math.round(f.W * factor), H2 = Math.round(f.H * factor);
      if (f.kind === 'pixel') add('resize', `Make bigger ${factor}× (pixel art, MMPX)`, 'pixel art: shapes and dithering kept, no new colours', { w: W2, h: H2, method: 'mmpx' });
      else if (f.kind === 'drawing') add('resize', `Make bigger ${factor}× (Splat)`, 'a drawing: edge-following blobs keep lines smooth without halos', { w: W2, h: H2, method: 'splat' });
      else {
        add('upscale', 'Make bigger 4× (AI, compact Real-ESRGAN)', `a photo; noise removal set from the measured noise (${f.noise.luma.toFixed(1)})`, { method: 'ai-esrgan3', denoise: f.noise.luma > 3 ? 70 : f.noise.luma > 1.5 ? 45 : 25, mix: 100 });
        if (factor !== 4) add('resize', `Down to ${factor}× (${W2} × ${H2})`, 'made 4× and averaged down: finer than enlarging straight to the size', { w: W2, h: H2, method: 'smooth' });
      }
    }
    // 7 a light final sharpen (contrast-adaptive: no halos)
    if ((goals.bigger || goals.repair || goals.colour) && (!touchup || f.blur > 1.2)) add('sharpen', 'Final sharpen (smart)', 'last, so nothing sharpens noise or blocks', { how: 'smart', cas: f.kind === 'photo' ? 35 : 20 }, f.kind === 'photo');
    P.forEach((st) => { if (!st.manual) st.ms = estimate(st, f, speed); });
    return P;
  }
  IC.process = { measure, describe, plan, estimate, guessKind };
})();

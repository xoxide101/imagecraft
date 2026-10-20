/* Picture to outlines (ImageCraft's own copy of the Craft tracer). A picture is reduced to a few
   colours and each colour's areas become filled outlines (SVG), using ImageTracer (public domain).
   CraftTracer.trace(src, { colors: 'auto' | n, detail: 1–10, smooth: 0–5, removeBg }) → { svg, colors, width, height } */
(function () {
  'use strict';
  const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That picture could not be read.')); i.src = src; });
  // The picture's real colours: k-means on the solid pixels (k-means++ start, so small strong colours are found).
  function kmeans(px, k) {
    const cs = [px[Math.floor(px.length / 2)].slice()];
    while (cs.length < k) { // the next centre: the pixel farthest from the centres so far
      let far = null, fd = -1;
      for (let i = 0; i < px.length; i += 7) { const p = px[i]; let d = Infinity; for (const c of cs) d = Math.min(d, (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2); if (d > fd) { fd = d; far = p; } }
      if (!far || fd < 1) break; cs.push(far.slice());
    }
    let count = [], err = 0;
    for (let it = 0; it < 10; it++) {
      const sum = cs.map(() => [0, 0, 0, 0]); err = 0;
      for (const p of px) { let b = 0, bd = Infinity; for (let j = 0; j < cs.length; j++) { const c = cs[j], d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (d < bd) { bd = d; b = j; } } const s = sum[b]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++; err += Math.sqrt(bd); }
      cs.forEach((c, j) => { const s = sum[j]; if (s[3]) { c[0] = s[0] / s[3]; c[1] = s[1] / s[3]; c[2] = s[2] / s[3]; } });
      count = sum.map((s) => s[3]);
    }
    return { cs, count, err: err / px.length };
  }
  const solidPixels = (data) => { const px = []; for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 127) px.push([data[i], data[i + 1], data[i + 2]]); return px; };
  // "Best match": the fewest colours that describe the picture well. Colours under 2.5% of the picture are only the
  // soft edges between two colours (anti-aliasing), so they are left out; their pixels join the nearest real colour.
  // "Rich": the shades too (the darker and lighter edges of a colour, a gradient in a leaf): 6 to 12 colours, small ones
  // kept down to 0.4% of the picture, nearly equal ones merged.
  function palette(data, want) {
    const px = solidPixels(data); if (px.length < 8) return [[0, 0, 0]];
    if (want === 'rich') { let r = null; for (let k = 6; k <= 12; k++) { r = kmeans(px, k); if (r.err < 3) break; } const cs = r.cs.filter((c, j) => r.count[j] / px.length >= 0.004), out = []; for (const c of cs) if (!out.some((e) => Math.hypot(e[0] - c[0], e[1] - c[1], e[2] - c[2]) < 10)) out.push(c); return out; }
    const keep = (r) => r.cs.filter((c, j) => r.count[j] / px.length >= 0.025);
    if (want && want !== 'auto') { const r = kmeans(px, want); return r.cs.filter((c, j) => r.count[j] / px.length >= 0.003).slice(0, want); } // a number asked for: shades kept down to 0.3%
    let prev = kmeans(px, 2);
    for (let k = 3; k <= 16; k++) { const r = kmeans(px, k); if (prev.err < 8 || (prev.err - r.err) / prev.err < 0.18) return keep(prev); prev = r; }
    return keep(prev);
  }
  const bestColours = (data) => palette(data, 'auto').length;
  async function trace(src, o = {}) {
    if (!window.ImageTracer) throw new Error('The tracer library is missing.');
    const img = await loadImg(src);
    const detail = Math.max(1, Math.min(10, o.detail || 6)), max = o.max || 160 + detail * 70;
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(8, Math.round(img.naturalWidth * k)), h = Math.max(8, Math.round(img.naturalHeight * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, w, h);
    const id = x.getImageData(0, 0, w, h);
    // the colours, from a small copy (quick), then every pixel is snapped to the nearest one so soft edges do not make slivers
    const sm = document.createElement('canvas'), sk = Math.min(1, (o.precise ? 320 : o.colors === 'rich' ? 200 : 96) / Math.max(w, h)); sm.width = Math.max(4, Math.round(w * sk)); sm.height = Math.max(4, Math.round(h * sk));
    const smx = sm.getContext('2d', { willReadFrequently: true }); smx.imageSmoothingEnabled = false; smx.drawImage(img, 0, 0, sm.width, sm.height); // no blending: soft edges stay rare
    const pal = palette(smx.getImageData(0, 0, sm.width, sm.height).data, o.colors === 'auto' || !o.colors ? 'auto' : o.colors === 'rich' ? 'rich' : Math.max(2, Math.min(32, o.colors | 0)));
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) { d[i + 3] = 0; continue; }
      let b = pal[0], bd = Infinity; for (const c of pal) { const e = (d[i] - c[0]) ** 2 + (d[i + 1] - c[1]) ** 2 + (d[i + 2] - c[2]) ** 2; if (e < bd) { bd = e; b = c; } }
      d[i] = b[0]; d[i + 1] = b[1]; d[i + 2] = b[2]; d[i + 3] = 255;
    }
    const colors = pal.length;
    const svg = ImageTracer.imagedataToSVG(id, {
      pal: [...pal.map((c) => ({ r: Math.round(c[0]), g: Math.round(c[1]), b: Math.round(c[2]), a: 255 })), { r: 0, g: 0, b: 0, a: 0 }], numberofcolors: colors + 1, colorquantcycles: 1, mincolorratio: 0,
      ltres: 0.4 + (o.smooth ?? 1) * 0.5 + (10 - detail) * 0.08, qtres: 0.4 + (o.smooth ?? 1) * 0.5 + (10 - detail) * 0.08, pathomit: Math.round(28 - detail * 2.4),
      blurradius: 0, strokewidth: 0, linefilter: detail < 5, roundcoords: 2, viewbox: true, desc: false,
    });
    // keep the filled paths; drop see-through ones and (if asked) the background colour from the corners
    const bg = o.removeBg ? cornerColour(id.data, w, h) : null;
    const paths = [...svg.matchAll(/<path[^>]*\/>/g)].map((m) => m[0]).filter((p) => {
      const op = +(/opacity="([\d.]+)"/.exec(p) || [0, 1])[1]; if (op < 0.5) return false;
      if (!bg) return true;
      const f = /fill="rgb\((\d+),(\d+),(\d+)\)"/.exec(p); if (!f) return true;
      return Math.hypot(f[1] - bg[0], f[2] - bg[1], f[3] - bg[2]) > 40;
    }).map((p) => p.replace(/ stroke="[^"]*"/, '').replace(/ stroke-width="[^"]*"/, ''));
    const out = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${paths.join('')}</svg>`;
    return { svg: out, colors, width: w, height: h, paths: paths.length };
  }
  // the most common colour along the edges, if the corners agree (otherwise nothing is removed)
  function cornerColour(d, w, h) {
    const at = (x, y) => { const i = (y * w + x) * 4; return d[i + 3] < 128 ? null : [d[i], d[i + 1], d[i + 2]]; };
    const cs = [at(0, 0), at(w - 1, 0), at(0, h - 1), at(w - 1, h - 1)].filter(Boolean);
    if (cs.length < 3) return null;
    const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 40;
    const best = cs.find((c) => cs.filter((x) => near(x, c)).length >= 3);
    return best || null;
  }
  window.CraftTracer = { trace, bestColours };
})();

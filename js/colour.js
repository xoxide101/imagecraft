/* ImageCraft colours (IC.colour): fewer colours, colour depth, dithering, classic palettes and the looks of old
   computers, including their rules (the ZX Spectrum's two colours in each 8 × 8 square, the C64's four in each 4 × 8).
     reduce(img, opts) → ImageData
       opts.colours  how many colours (2–256) picked to suit the picture (median cut, then refined)
       opts.palette  a fixed palette id (PALETTES), or 'adaptive'
       opts.levels   palette entries snapped to a hardware grid (8 = the Atari ST's 512 colours, 16 = the Amiga's 4096…)
       opts.depth    'high16' (5-6-5, 65,536 colours), 'high15' (5-5-5), 'true' (no change)
       opts.grey     true: grey levels only
       opts.dither   'none' | 'fs' | 'atkinson' | 'jarvis' | 'stucki' | 'burkes' | 'sierra' | 'sierralite' | 'bayer2' | 'bayer4' | 'bayer8' | 'noise'
       opts.amount   dither strength 0–1 (default 1)
       opts.cells    'zx' | 'c64' (the colour rules of those computers)
     LOOKS: ready-made looks of old computers (screen size, pixel shape, palette, rules). */
(function () {
  'use strict';
  const IC = (window.IC = window.IC || {});
  const F = () => IC.formats;
  const hex = (s) => s.split(' ').map((h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]);
  const greys = (n) => Array.from({ length: n }, (_, i) => { const v = Math.round((i * 255) / (n - 1)); return [v, v, v]; });
  const grid = (L) => { const p = []; for (let r = 0; r < L; r++) for (let g = 0; g < L; g++) for (let b = 0; b < L; b++) p.push([r, g, b].map((v) => Math.round((v * 255) / (L - 1)))); return p; };

  // Fixed palettes (the colour values are the well-known ones for each machine)
  const PALETTES = {
    bw: { name: 'Black and white', colours: [[0, 0, 0], [255, 255, 255]] },
    grey4: { name: '4 greys', colours: greys(4) },
    grey16: { name: '16 greys', colours: greys(16) },
    grey256: { name: '256 greys', colours: greys(256) },
    cga1: { name: 'CGA (cyan, magenta, white)', colours: hex('000000 55ffff ff55ff ffffff') },
    cga0: { name: 'CGA (green, red, yellow)', colours: hex('000000 55ff55 ff5555 ffff55') },
    ega: { name: 'EGA / CGA 16 colours', colours: null },
    web: { name: 'Web-safe 216', colours: grid(6) },
    c64: { name: 'Commodore 64', colours: null },
    zx: { name: 'ZX Spectrum', colours: null },
    cpc: { name: 'Amstrad CPC (27)', colours: grid(3) },
    gameboy: { name: 'Game Boy (4 greens)', colours: hex('0f380f 306230 8bac0f 9bbc0f') },
    apple2: { name: 'Apple II hi-res (6)', colours: hex('000000 ffffff 14f53c ff44fd ff6a3c 14cfff') },
    mac16: { name: 'Macintosh 16 colours', colours: hex('ffffff fbf305 ff6403 dd0907 f20884 4700a5 0000d3 02abea 1fb714 006412 562c05 90713a c0c0c0 808080 404040 000000') },
    pico8: { name: 'PICO-8 (16)', colours: hex('000000 1d2b53 7e2553 008751 ab5236 5f574f c2c3c7 fff1e8 ff004d ffa300 ffec27 00e436 29adff 83769c ff77a8 ffccaa') },
    teletext: { name: 'Teletext (8)', colours: hex('000000 ff0000 00ff00 ffff00 0000ff ff00ff 00ffff ffffff') },
    win16: { name: 'Windows 16 colours', colours: hex('000000 800000 008000 808000 000080 800080 008080 c0c0c0 808080 ff0000 00ff00 ffff00 0000ff ff00ff 00ffff ffffff') },
  };
  const paletteOf = (id) => { const p = PALETTES[id]; if (!p) return null; if (!p.colours) p.colours = id === 'ega' ? F().EGA : id === 'c64' ? F().C64 : F().ZX.filter((c, i) => i !== 8); return p.colours; };

  // ------------------------------------------------------------------ picking colours that suit the picture
  // median cut on a 5-bit-a-channel histogram, then a few rounds of k-means on it
  function quantize(img, n, { levels } = {}) {
    const d = img.data, H = new Uint32Array(32768);
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] >= 128) H[((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3)]++;
    const bins = []; for (let k = 0; k < 32768; k++) if (H[k]) bins.push([((k >> 10) << 3) + 4, (((k >> 5) & 31) << 3) + 4, ((k & 31) << 3) + 4, H[k]]);
    if (!bins.length) return [[0, 0, 0]];
    if (bins.length <= n) return snap(bins.map((b) => [b[0], b[1], b[2]]), levels);
    let boxes = [bins];
    const range = (bx) => { const lo = [255, 255, 255], hi = [0, 0, 0]; let c = 0; for (const b of bx) { for (let q = 0; q < 3; q++) { if (b[q] < lo[q]) lo[q] = b[q]; if (b[q] > hi[q]) hi[q] = b[q]; } c += b[3]; } return { lo, hi, c }; };
    while (boxes.length < n) {
      let best = -1, bs = -1, ax = 0;
      boxes.forEach((bx, i) => { if (bx.length < 2) return; const { lo, hi, c } = range(bx), sp = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], a = sp.indexOf(Math.max(...sp)), s = sp[a] * Math.sqrt(c); if (s > bs) { bs = s; best = i; ax = a; } });
      if (best < 0) break;
      const bx = boxes[best].sort((p, q) => p[ax] - q[ax]), half = bx.reduce((s, b) => s + b[3], 0) / 2; let acc = 0, cut = 1;
      for (let i = 0; i < bx.length - 1; i++) { acc += bx[i][3]; if (acc >= half) { cut = i + 1; break; } }
      boxes.splice(best, 1, bx.slice(0, cut), bx.slice(cut));
    }
    let pal = boxes.map((bx) => { let r = 0, g = 0, b = 0, c = 0; for (const x of bx) { r += x[0] * x[3]; g += x[1] * x[3]; b += x[2] * x[3]; c += x[3]; } return [r / c, g / c, b / c]; });
    for (let it = 0; it < 4; it++) {
      const sum = pal.map(() => [0, 0, 0, 0]);
      for (const x of bins) { let bi = 0, bd = Infinity; for (let j = 0; j < pal.length; j++) { const e = dist(x[0], x[1], x[2], pal[j]); if (e < bd) { bd = e; bi = j; } } const s = sum[bi]; s[0] += x[0] * x[3]; s[1] += x[1] * x[3]; s[2] += x[2] * x[3]; s[3] += x[3]; }
      pal = pal.map((p, j) => (sum[j][3] ? [sum[j][0] / sum[j][3], sum[j][1] / sum[j][3], sum[j][2] / sum[j][3]] : p));
    }
    // the darkest and lightest are kept true (black stays black)
    return snap(pal.map((p) => p.map((v) => Math.max(0, Math.min(255, Math.round(v))))), levels);
  }
  const snap = (pal, L) => { if (!L) return pal; const out = [], seen = new Set(); pal.forEach((p) => { const q = p.map((v) => Math.round((Math.round((v * (L - 1)) / 255) * 255) / (L - 1))), k = q.join(); if (!seen.has(k)) { seen.add(k); out.push(q); } }); return out; };
  // a colour distance a little closer to how eyes see (green counts most)
  const dist = (r, g, b, p) => { const rm = (r + p[0]) / 2, dr = r - p[0], dg = g - p[1], db = b - p[2]; return (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db; };

  // nearest palette colour, remembered for each 6-bit-a-channel colour
  function nearestOf(pal) {
    const cache = new Int16Array(262144).fill(-1);
    return (r, g, b) => {
      r = r < 0 ? 0 : r > 255 ? 255 : r; g = g < 0 ? 0 : g > 255 ? 255 : g; b = b < 0 ? 0 : b > 255 ? 255 : b;
      const k = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2); let i = cache[k];
      if (i < 0) { let bd = Infinity; for (let j = 0; j < pal.length; j++) { const e = dist(r, g, b, pal[j]); if (e < bd) { bd = e; i = j; } } cache[k] = i; }
      return pal[i];
    };
  }
  // per-channel rounding (high colour)
  const channels = (bits) => { const L = bits.map((b) => (1 << b) - 1); return (r, g, b) => [r, g, b].map((v, q) => Math.round((Math.round((Math.max(0, Math.min(255, v)) * L[q]) / 255) * 255) / L[q])); };

  // ------------------------------------------------------------------ dithering
  const KERNELS = {
    fs: [16, [1, 0, 7], [-1, 1, 3], [0, 1, 5], [1, 1, 1]],
    atkinson: [8, [1, 0, 1], [2, 0, 1], [-1, 1, 1], [0, 1, 1], [1, 1, 1], [0, 2, 1]],
    jarvis: [48, [1, 0, 7], [2, 0, 5], [-2, 1, 3], [-1, 1, 5], [0, 1, 7], [1, 1, 5], [2, 1, 3], [-2, 2, 1], [-1, 2, 3], [0, 2, 5], [1, 2, 3], [2, 2, 1]],
    stucki: [42, [1, 0, 8], [2, 0, 4], [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2], [-2, 2, 1], [-1, 2, 2], [0, 2, 4], [1, 2, 2], [2, 2, 1]],
    burkes: [32, [1, 0, 8], [2, 0, 4], [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2]],
    sierra: [32, [1, 0, 5], [2, 0, 3], [-2, 1, 2], [-1, 1, 4], [0, 1, 5], [1, 1, 4], [2, 1, 2], [-1, 2, 2], [0, 2, 3], [1, 2, 2]],
    sierralite: [4, [1, 0, 2], [-1, 1, 1], [0, 1, 1]],
  };
  const DITHERS = [['none', 'None (flat colours)'], ['fs', 'Floyd–Steinberg (smooth)'], ['atkinson', 'Atkinson (crisp, the classic Mac)'], ['jarvis', 'Jarvis (soft)'], ['stucki', 'Stucki'], ['burkes', 'Burkes'], ['sierra', 'Sierra'], ['sierralite', 'Sierra Lite (quick)'], ['bayer2', 'Ordered 2 × 2'], ['bayer4', 'Ordered 4 × 4 (the old game look)'], ['bayer8', 'Ordered 8 × 8'], ['noise', 'Noise']];
  const bayer = (n) => { let m = [[0]]; while (m.length < n) { const s = m.length, o = []; for (let y = 0; y < s * 2; y++) { o.push([]); for (let x = 0; x < s * 2; x++) o[y].push(4 * m[y % s][x % s] + [0, 2, 3, 1][(y >= s) * 2 + (x >= s)]); } m = o; } return m.map((r) => r.map((v) => (v + 0.5) / (n * n) - 0.5)); };

  // map every pixel to near(r, g, b) → [r, g, b], dithered; near can depend on the pixel (for cell rules: nearAt(x, y))
  function mapPixels(img, nearAt, { dither = 'none', amount = 1, spread = 64 } = {}) {
    const W = img.width, H = img.height, s = img.data, out = new ImageData(W, H), d = out.data;
    const K = KERNELS[dither];
    if (K) {
      const buf = new Float32Array(W * H * 3); for (let p = 0; p < W * H; p++) { buf[p * 3] = s[p * 4]; buf[p * 3 + 1] = s[p * 4 + 1]; buf[p * 3 + 2] = s[p * 4 + 2]; }
      const div = K[0], taps = K.slice(1);
      for (let y = 0; y < H; y++) {
        const rtl = y & 1, x0 = rtl ? W - 1 : 0, dx = rtl ? -1 : 1; // serpentine: every other row right to left
        for (let x = x0; x >= 0 && x < W; x += dx) {
          const p = y * W + x, i = p * 4;
          if (s[i + 3] < 128) { d[i + 3] = 0; continue; }
          // the carried error is kept within the colour range, or it piles up in bright and dark areas (blots)
          const cl = (v) => (v < 0 ? 0 : v > 255 ? 255 : v), r = cl(buf[p * 3]), g = cl(buf[p * 3 + 1]), b = cl(buf[p * 3 + 2]), c = nearAt(x, y)(r, g, b);
          d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
          const er = (r - c[0]) * amount, eg = (g - c[1]) * amount, eb = (b - c[2]) * amount;
          for (const [tx, ty, w] of taps) {
            const nx = x + (rtl ? -tx : tx), ny = y + ty; if (nx < 0 || nx >= W || ny >= H) continue;
            const q = (ny * W + nx) * 3, f = w / div; buf[q] += er * f; buf[q + 1] += eg * f; buf[q + 2] += eb * f;
          }
        }
      }
      return out;
    }
    const M = /^bayer(\d)$/.exec(dither) ? bayer(+RegExp.$1) : null, n = M ? M.length : 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4; if (s[i + 3] < 128) { d[i + 3] = 0; continue; }
      const t = M ? M[y % n][x % n] * spread * amount : dither === 'noise' ? (Math.random() - 0.5) * spread * amount : 0;
      const c = nearAt(x, y)(s[i] + t, s[i + 1] + t, s[i + 2] + t); d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
    return out;
  }

  const toGrey = (img) => { const o = new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), d = o.data; for (let i = 0; i < d.length; i += 4) { const v = Math.round(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114); d[i] = d[i + 1] = d[i + 2] = v; } return o; };
  // see-through edges: pixels are either solid or clear in an indexed picture
  const hardAlpha = (img) => { const d = img.data; for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 128 ? 255 : 0; return img; };

  function reduce(img, o = {}) {
    let src = o.grey ? toGrey(img) : img;
    if (o.cells === 'zx') return zxCells(src, o);
    if (o.cells === 'c64') return c64Cells(src, o);
    if (o.depth === 'true') return img;
    if (o.depth === 'high16' || o.depth === 'high15') { const near = channels(o.depth === 'high16' ? [5, 6, 5] : [5, 5, 5]); return mapPixels(src, () => near, { dither: o.dither, amount: o.amount ?? 1, spread: 8 }); }
    let pal = o.palette && o.palette !== 'adaptive' ? paletteOf(o.palette) : null;
    if (!pal) pal = o.grey ? greys(Math.max(2, Math.min(256, o.colours || 16))) : quantize(src, Math.max(2, Math.min(256, o.colours || 16)), { levels: o.levels });
    // ordered dithering spreads each pixel by about one step between the palette's colours
    const near = nearestOf(pal), step = o.grey ? 255 / (pal.length - 1) : 255 / Math.max(1, Math.cbrt(pal.length) - 1);
    return hardAlpha(mapPixels(src, () => near, { dither: o.dither, amount: o.amount ?? 1, spread: Math.min(128, step) }));
  }

  // ------------------------------------------------------------------ the rules of old computers
  // ZX Spectrum: each 8 × 8 square has an ink and a paper colour, both bright or both not
  function zxCells(img, o = {}) {
    const ZX = F().ZX, W = img.width, H = img.height, s = img.data, cw = Math.ceil(W / 8), ch = Math.ceil(H / 8), pick = [];
    for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) {
      let best = null, be = Infinity;
      // the pair that best makes the square's colours, counting the in-between shades dithering can mix from them
      for (const br of [0, 1]) for (let a = 0; a < 8; a++) for (let b = a; b < 8; b++) {
        const pa = ZX[br * 8 + a], pb = ZX[br * 8 + b], mix = [0, 0.25, 0.5, 0.75, 1].map((t) => [0, 1, 2].map((q) => pa[q] * (1 - t) + pb[q] * t)); let e = 0;
        for (let y = cy * 8; y < Math.min(H, cy * 8 + 8); y++) for (let x = cx * 8; x < Math.min(W, cx * 8 + 8); x++) { const i = (y * W + x) * 4; let m = Infinity; for (const c of mix) { const d = dist(s[i], s[i + 1], s[i + 2], c); if (d < m) m = d; } e += m; }
        if (e < be) { be = e; best = [pa, pb]; }
      }
      pick.push(nearestOf(best));
    }
    return mapPixels(img, (x, y) => pick[((y / 8) | 0) * cw + ((x / 8) | 0)], { dither: o.dither, amount: o.amount ?? 1, spread: 100 });
  }
  // Commodore 64 multicolour: wide pixels; one background colour for the screen and 3 more in each 4 × 8 square
  function c64Cells(img, o = {}) {
    const C = F().C64, W = img.width, H = img.height;
    // work at half the width (the wide pixels), then double
    const half = new ImageData(Math.ceil(W / 2), H), hs = half.data, s = img.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < half.width; x++) { const a = (y * W + x * 2) * 4, b = (y * W + Math.min(W - 1, x * 2 + 1)) * 4, t = (y * half.width + x) * 4; for (let q = 0; q < 4; q++) hs[t + q] = (s[a + q] + s[b + q]) / 2; }
    const all = nearestOf(C), idx = (r, g, b) => C.indexOf(all(r, g, b)), hw = half.width, hist = new Array(16).fill(0);
    for (let i = 0; i < hs.length; i += 4) hist[idx(hs[i], hs[i + 1], hs[i + 2])]++;
    const bg = hist.indexOf(Math.max(...hist)), cw = Math.ceil(hw / 4), ch = Math.ceil(H / 8), pick = [];
    for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) {
      const h = new Array(16).fill(0);
      for (let y = cy * 8; y < Math.min(H, cy * 8 + 8); y++) for (let x = cx * 4; x < Math.min(hw, cx * 4 + 4); x++) { const i = (y * hw + x) * 4; h[idx(hs[i], hs[i + 1], hs[i + 2])]++; }
      const top = h.map((n, k) => [n, k]).filter(([n, k]) => n && k !== bg).sort((a, b) => b[0] - a[0]).slice(0, 3).map(([, k]) => C[k]);
      pick.push(nearestOf([C[bg], ...top]));
    }
    const m = mapPixels(half, (x, y) => pick[((y / 8) | 0) * cw + ((x / 4) | 0)], { dither: o.dither, amount: o.amount ?? 1, spread: 64 });
    const out = new ImageData(W, H), d = out.data, md = m.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const a = (y * hw + (x >> 1)) * 4, t = (y * W + x) * 4; d[t] = md[a]; d[t + 1] = md[a + 1]; d[t + 2] = md[a + 2]; d[t + 3] = s[t + 3] >= 128 ? 255 : 0; }
    return out;
  }

  // ------------------------------------------------------------------ looks of old computers
  // size: the real screen; aspect: how tall a pixel is (2 = twice as tall as wide, 0.5 = twice as wide)
  const LOOKS = {
    st: { name: 'Atari ST (16 of 512 colours)', size: [320, 200], colours: 16, levels: 8, dither: 'fs' },
    stmed: { name: 'Atari ST medium (4 colours)', size: [640, 200], aspect: 2, colours: 4, levels: 8, dither: 'bayer4' },
    amiga: { name: 'Amiga (32 of 4,096 colours)', size: [320, 256], colours: 32, levels: 16, dither: 'fs' },
    amigaehb: { name: 'Amiga (64 colours)', size: [320, 256], colours: 64, levels: 16, dither: 'fs' },
    c64: { name: 'Commodore 64', size: [320, 200], cells: 'c64', palette: 'c64', dither: 'bayer4' },
    zx: { name: 'ZX Spectrum', size: [256, 192], cells: 'zx', palette: 'zx', dither: 'bayer4' },
    cpc: { name: 'Amstrad CPC (16 of 27, wide pixels)', size: [160, 200], aspect: 0.5, palette: 'cpc', colours: 16, dither: 'bayer4' },
    cga: { name: 'IBM PC CGA (4 colours)', size: [320, 200], palette: 'cga1', dither: 'bayer4' },
    ega: { name: 'IBM PC EGA (16 colours)', size: [320, 200], palette: 'ega', dither: 'fs' },
    vga: { name: 'IBM PC VGA (256 of 262,144)', size: [320, 200], colours: 256, levels: 64, dither: 'fs' },
    mac: { name: 'Macintosh (black and white)', size: [512, 342], palette: 'bw', dither: 'atkinson' },
    gameboy: { name: 'Game Boy (4 greens)', size: [160, 144], palette: 'gameboy', dither: 'bayer4' },
    apple2: { name: 'Apple II (6 colours)', size: [280, 192], palette: 'apple2', dither: 'bayer4' },
    pico8: { name: 'PICO-8 (16 colours)', size: [128, 128], palette: 'pico8', dither: 'none' },
    teletext: { name: 'Teletext (8 colours)', size: [78, 72], palette: 'teletext', dither: 'none' },
  };
  // the look: shrink to the screen (pixels the right shape), use its colours, and (if keep) grow back with square edges
  function look(img, id, { keep = true, dither, amount = 1, fit = 'cover' } = {}) {
    const L = LOOKS[id], [SW, SH] = L.size, a = L.aspect || 1;
    const c = F().canvasOf(img), s = document.createElement('canvas'); s.width = SW; s.height = SH; const x = s.getContext('2d'); x.imageSmoothingQuality = 'high';
    // the picture as seen on the screen: its width in screen pixels is wider when pixels are tall
    const shown = [img.width, img.height / a], k = fit === 'cover' ? Math.max(SW / shown[0], SH / shown[1]) : Math.min(SW / shown[0], SH / shown[1]);
    const w = shown[0] * k, h = shown[1] * k; if (fit !== 'cover') { x.fillStyle = '#000'; x.fillRect(0, 0, SW, SH); }
    x.drawImage(c, (SW - w) / 2, (SH - h) / 2, w, h);
    let r = reduce(x.getImageData(0, 0, SW, SH), { palette: L.palette, colours: L.colours, levels: L.levels, cells: L.cells, dither: dither || L.dither, amount });
    if (!keep) return r;
    // grow back to about the picture's size, each screen pixel a block (tall or wide as on the screen)
    const pw = a < 1 ? 1 / a : 1, ph = a > 1 ? a : 1, u = Math.max(1, Math.round(img.width / (SW * pw))), kx = u * pw, ky = u * ph;
    const o = document.createElement('canvas'); o.width = SW * kx; o.height = SH * ky; const ox = o.getContext('2d'); ox.imageSmoothingEnabled = false; ox.drawImage(F().canvasOf(r), 0, 0, o.width, o.height);
    return ox.getImageData(0, 0, o.width, o.height);
  }

  // the colours a picture has, most used first (for the palette view)
  function colours(img, max = 256) {
    const m = new Map(), d = img.data;
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) continue; const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]; m.set(k, (m.get(k) || 0) + 1); if (m.size > 65536) break; }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([k, n]) => ({ rgb: [k >> 16, (k >> 8) & 255, k & 255], n }));
  }

  IC.colour = { reduce, quantize, PALETTES, paletteOf, DITHERS, LOOKS, look, colours, toGrey, mapPixels, nearestOf };
})();

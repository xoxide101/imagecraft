/* ImageCraft filters (IC.filters): each takes a picture (ImageData) and settings and gives back a new picture; the
   original is never changed, so every step can be undone and compared. */
(function () {
  'use strict';
  const IC = (window.IC = window.IC || {});
  const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
  const copy = (img) => new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
  const canvasOf = (img) => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').putImageData(img, 0, 0); return c; };
  const draw = (w, h, fn) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); const x = c.getContext('2d', { willReadFrequently: true }); fn(x, c); return x.getImageData(0, 0, c.width, c.height); };
  const lut = (img, f) => { const o = copy(img), d = o.data, t = new Uint8ClampedArray(256); for (let i = 0; i < 256; i++) t[i] = f(i); for (let i = 0; i < d.length; i += 4) { d[i] = t[d[i]]; d[i + 1] = t[d[i + 1]]; d[i + 2] = t[d[i + 2]]; } return o; };

  // ------------------------------------------------------------------ light and colour
  // brightness and contrast −100…100, gamma 0.2…3 (1 = none), shadows and highlights −100…100 (lift or deepen)
  function light(img, { brightness = 0, contrast = 0, gamma = 1, shadows = 0, highlights = 0 } = {}) {
    const c = contrast >= 0 ? 1 + contrast / 40 : 1 + contrast / 100, b = brightness * 1.6;
    return lut(img, (v) => {
      let x = v / 255;
      x = Math.pow(x, 1 / gamma);
      // shadows lift (or deepen) the dark tones and highlights the light ones; black and white stay put
      x += (shadows / 100) * Math.pow(1 - x, 2) * x; x += (highlights / 100) * x * x * (1 - x);
      x = (x - 0.5) * c + 0.5;
      return clamp(x * 255 + b);
    });
  }
  const rgb2hsl = (r, g, b) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; } return [h, s, l]; };
  const hue2 = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  const hsl2rgb = (h, s, l) => { if (!s) return [l * 255, l * 255, l * 255]; const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; return [hue2(p, q, h + 1 / 3) * 255, hue2(p, q, h) * 255, hue2(p, q, h - 1 / 3) * 255]; };
  // saturation −100…100, vibrance (gentle saturation that spares skin and strong colours), hue −180…180°, warmth and tint −100…100
  function colour(img, { saturation = 0, vibrance = 0, hue = 0, warmth = 0, tint = 0 } = {}) {
    const o = copy(img), d = o.data, s = 1 + saturation / 100, wr = warmth * 0.35, tg = tint * 0.3;
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i] + wr, g = d[i + 1] - tg, b = d[i + 2] - wr;
      if (hue || saturation || vibrance) {
        let [h, sat, l] = rgb2hsl(clamp(r), clamp(g), clamp(b));
        h = (h + hue / 360 + 1) % 1; sat = Math.min(1, sat * s); if (vibrance) sat = Math.min(1, sat + (vibrance / 100) * (1 - sat) * sat * 1.5);
        [r, g, b] = hsl2rgb(h, Math.max(0, sat), l);
      }
      d[i] = clamp(r); d[i + 1] = clamp(g); d[i + 2] = clamp(b);
    }
    return o;
  }
  // stretch the darkest to black and the lightest to white (each colour on its own when fixing a colour cast)
  function autoLevels(img, { clip = 0.5, perChannel = true } = {}) {
    const d = img.data, n = d.length / 4, H = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) continue; H[0][d[i]]++; H[1][d[i + 1]]++; H[2][d[i + 2]]++; }
    const ends = (h) => { const cut = (n * clip) / 100; let a = 0, s = 0; while (a < 255 && s + h[a] <= cut) s += h[a++]; let b = 255; s = 0; while (b > 0 && s + h[b] <= cut) s += h[b--]; return [a, Math.max(a + 1, b)]; };
    let E = H.map(ends);
    if (!perChannel) { const lo = Math.min(...E.map((e) => e[0])), hi = Math.max(...E.map((e) => e[1])); E = [[lo, hi], [lo, hi], [lo, hi]]; }
    const T = E.map(([a, b]) => { const t = new Uint8ClampedArray(256); for (let v = 0; v < 256; v++) t[v] = ((v - a) * 255) / (b - a); return t; });
    const o = copy(img), od = o.data; for (let i = 0; i < od.length; i += 4) { od[i] = T[0][od[i]]; od[i + 1] = T[1][od[i + 1]]; od[i + 2] = T[2][od[i + 2]]; }
    return o;
  }
  // Auto fix: levels, a gentle lift of the colours and a little sharpening, as a photo shop would
  const autoFix = (img) => sharpen(colour(autoLevels(img, { clip: 0.4 }), { vibrance: 18 }), { amount: 35, radius: 1 });
  // grey-world white balance: the picture's average made neutral (old photos that went yellow, red or blue)
  // Colour cast. Three ways: 'grey' (grey world: the average colour made neutral), 'white' (white patch: the brightest
  // few percent of each colour made white; percent sets how few), 'pick' (ground truth: the colour of something that
  // should be white or grey, picked on the picture, made neutral).
  function whiteBalance(img, { strength = 100, method = 'grey', percent = 1, rgb } = {}) {
    const d = img.data; let r = 0, g = 0, b = 0, n = 0, f;
    if (method === 'pick' && rgb) { const m = (rgb[0] + rgb[1] + rgb[2]) / 3; f = rgb.map((v) => m / Math.max(1, v)); }
    else if (method === 'auto') {
      // only near-grey things (low colour) are made neutral: a sunset stays warm, a yellowed print is fixed; without
      // enough of them nothing changes
      for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) continue; const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); if (mx > 40 && mx < 250 && mx - mn < mx * 0.22) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; } }
      if (n < (d.length / 4) * 0.03) return copy(img); r /= n; g /= n; b /= n; const m = (r + g + b) / 3; f = [m / r, m / g, m / b];
    }
    else if (method === 'white') {
      const H = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
      for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) continue; H[0][d[i]]++; H[1][d[i + 1]]++; H[2][d[i + 2]]++; n++; }
      f = H.map((h) => { let c = 0, v = 255; while (v > 0 && c + h[v] < (n * percent) / 100) c += h[v--]; return 255 / Math.max(1, v); });
    } else {
      for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) continue; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
      if (!n) return copy(img); r /= n; g /= n; b /= n; const m = (r + g + b) / 3; f = [m / r, m / g, m / b];
    }
    const k = strength / 100; f = f.map((v) => 1 + (v - 1) * k);
    const o = copy(img), od = o.data; for (let i = 0; i < od.length; i += 4) { od[i] = clamp(od[i] * f[0]); od[i + 1] = clamp(od[i + 1] * f[1]); od[i + 2] = clamp(od[i + 2] * f[2]); }
    return o;
  }
  function greyscale(img) { const o = copy(img), d = o.data; for (let i = 0; i < d.length; i += 4) { const v = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114; d[i] = d[i + 1] = d[i + 2] = v; } return o; }
  function sepia(img, { strength = 100 } = {}) { const o = copy(img), d = o.data, k = strength / 100; for (let i = 0; i < d.length; i += 4) { const r = d[i], g = d[i + 1], b = d[i + 2]; d[i] = r + (r * 0.393 + g * 0.769 + b * 0.189 - r) * k; d[i + 1] = g + (r * 0.349 + g * 0.686 + b * 0.168 - g) * k; d[i + 2] = b + (r * 0.272 + g * 0.534 + b * 0.131 - b) * k; } return o; }
  const invert = (img) => lut(img, (v) => 255 - v);
  function threshold(img, { level = 128 } = {}) { const o = copy(img), d = o.data; for (let i = 0; i < d.length; i += 4) { const v = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114 >= level ? 255 : 0; d[i] = d[i + 1] = d[i + 2] = v; } return o; }
  const posterize = (img, { levels = 4 } = {}) => lut(img, (v) => Math.round(Math.round((v * (levels - 1)) / 255) * (255 / (levels - 1))));

  // ------------------------------------------------------------------ blur, sharpen, noise
  // box blur three times ≈ a Gaussian blur (radius in pixels); alpha blurs with it
  function blur(img, { radius = 2 } = {}) {
    const r = Math.max(0, Math.round(radius)); if (!r) return copy(img);
    const W = img.width, H = img.height, a = new Float32Array(img.data), b = new Float32Array(a.length);
    const pass = (src, dst, horiz) => {
      const len = horiz ? W : H, lines = horiz ? H : W, step = horiz ? 4 : W * 4, k = 1 / (2 * r + 1);
      for (let l = 0; l < lines; l++) {
        const base = horiz ? l * W * 4 : l * 4;
        for (let c = 0; c < 4; c++) {
          let s = 0; for (let i = -r; i <= r; i++) s += src[base + Math.min(len - 1, Math.max(0, i)) * step + c];
          for (let i = 0; i < len; i++) { dst[base + i * step + c] = s * k; s += src[base + Math.min(len - 1, i + r + 1) * step + c] - src[base + Math.max(0, i - r) * step + c]; }
        }
      }
    };
    for (let t = 0; t < 3; t++) { pass(a, b, true); pass(b, a, false); }
    return new ImageData(Uint8ClampedArray.from(a), W, H);
  }
  // unsharp mask: amount 0–300 %, radius, and a threshold so smooth areas (skin, sky) stay smooth
  function sharpen(img, { amount = 80, radius = 1, threshold: th = 2 } = {}) {
    const bl = blur(img, { radius }), o = copy(img), d = o.data, b = bl.data, k = amount / 100;
    for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c++) { const diff = d[i + c] - b[i + c]; if (Math.abs(diff) > th) d[i + c] = clamp(d[i + c] + diff * k); }
    return o;
  }
  // edge-keeping smoothing (a bilateral filter): nearby pixels of a similar colour are averaged, edges stay sharp.
  // strength 0–100: how different a colour may be and still be smoothed; radius 1–4
  function denoise(img, { strength = 40, radius = 2 } = {}) {
    const W = img.width, H = img.height, s = img.data, o = copy(img), d = o.data, R = Math.max(1, Math.min(4, radius | 0));
    const sc = 6 + strength * 0.9, cw = new Float32Array(766); for (let i = 0; i < 766; i++) cw[i] = Math.exp(-(i * i) / (2 * sc * sc * 3));
    const sw = []; for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) sw.push([x, y, Math.exp(-(x * x + y * y) / (2 * (R * 0.6) ** 2 + 1))]);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4; let r = 0, g = 0, b = 0, t = 0;
      for (const [dx, dy, w0] of sw) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = (ny * W + nx) * 4, w = w0 * cw[Math.abs(s[j] - s[i]) + Math.abs(s[j + 1] - s[i + 1]) + Math.abs(s[j + 2] - s[i + 2])];
        r += s[j] * w; g += s[j + 1] * w; b += s[j + 2] * w; t += w;
      }
      d[i] = r / t; d[i + 1] = g / t; d[i + 2] = b / t;
    }
    return o;
  }
  // the middle value of each 3 × 3 (or 5 × 5) square: takes out specks and scratches (dust on a scan)
  function median(img, { radius = 1 } = {}) {
    const W = img.width, H = img.height, s = img.data, o = copy(img), d = o.data, R = radius, vals = [[], [], []];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      vals[0].length = vals[1].length = vals[2].length = 0;
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const nx = Math.min(W - 1, Math.max(0, x + dx)), ny = Math.min(H - 1, Math.max(0, y + dy)), j = (ny * W + nx) * 4; vals[0].push(s[j]); vals[1].push(s[j + 1]); vals[2].push(s[j + 2]); }
      const i = (y * W + x) * 4, m = vals[0].length >> 1; for (let c = 0; c < 3; c++) { vals[c].sort((a, b) => a - b); d[i + c] = vals[c][m]; }
    }
    return o;
  }
  // dust and scratches: only pixels far from the middle value of their neighbours are replaced (the rest is untouched)
  function despeckle(img, { radius = 1, threshold: th = 40 } = {}) {
    const m = median(img, { radius }), o = copy(img), d = o.data, md = m.data;
    for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - md[i]) + Math.abs(d[i + 1] - md[i + 1]) + Math.abs(d[i + 2] - md[i + 2]) > th) { d[i] = md[i]; d[i + 1] = md[i + 1]; d[i + 2] = md[i + 2]; }
    return o;
  }
  // JPEG blocks: smooth the small steps along the 8 × 8 block edges (real edges, bigger steps, stay)
  function deblock(img, { strength = 50 } = {}) {
    const W = img.width, H = img.height, o = copy(img), d = o.data, lim = 4 + strength * 0.4;
    const fix = (a, b, a2, b2) => { for (let c = 0; c < 3; c++) { const step = d[b + c] - d[a + c]; if (Math.abs(step) < lim && Math.abs(d[a + c] - d[a2 + c]) < lim && Math.abs(d[b2 + c] - d[b + c]) < lim) { d[a + c] += step / 4; d[b + c] -= step / 4; d[a2 + c] += step / 8; d[b2 + c] -= step / 8; } } };
    for (let y = 0; y < H; y++) for (let x = 8; x < W - 1; x += 8) { const r = y * W; fix((r + x - 1) * 4, (r + x) * 4, (r + Math.max(0, x - 2)) * 4, (r + x + 1) * 4); }
    for (let y = 8; y < H - 1; y += 8) for (let x = 0; x < W; x++) fix(((y - 1) * W + x) * 4, (y * W + x) * 4, (Math.max(0, y - 2) * W + x) * 4, ((y + 1) * W + x) * 4);
    return denoise(o, { strength: strength * 0.25, radius: 1 });
  }
  // Undither: the dots of a dithered picture (old GIFs, 16-colour screens) blended back into smooth colour.
  // Dots alternate within a small area while real edges run on; a wide, colour-tolerant smoothing evens the dots out.
  function undither(img, { strength = 60 } = {}) {
    const r = strength > 70 ? 3 : 2;
    let o = denoise(img, { strength: 40 + strength * 0.9, radius: r });
    o = denoise(o, { strength: 20 + strength * 0.4, radius: 1 });
    return sharpen(o, { amount: 40, radius: 1, threshold: 4 });
  }
  // bigger squares, like a censor blur or a mosaic
  function pixelate(img, { size = 8 } = {}) {
    const W = img.width, H = img.height, s = img.data, o = copy(img), d = o.data, S = Math.max(2, size | 0);
    for (let by = 0; by < H; by += S) for (let bx = 0; bx < W; bx += S) {
      let r = 0, g = 0, b = 0, a = 0, n = 0; for (let y = by; y < Math.min(H, by + S); y++) for (let x = bx; x < Math.min(W, bx + S); x++) { const i = (y * W + x) * 4; r += s[i]; g += s[i + 1]; b += s[i + 2]; a += s[i + 3]; n++; }
      for (let y = by; y < Math.min(H, by + S); y++) for (let x = bx; x < Math.min(W, bx + S); x++) { const i = (y * W + x) * 4; d[i] = r / n; d[i + 1] = g / n; d[i + 2] = b / n; d[i + 3] = a / n; }
    }
    return o;
  }

  // ------------------------------------------------------------------ size and shape
  // methods: 'smooth' (high quality), 'nearest' (square pixels, for pixel art), 'scale2x' / 'scale3x' (pixel art grown
  // with its diagonals filled in), 'smoothpixel' (pixel art grown with smooth, rounded edges)
  // methods: 'smooth' / 'auto' (best: no-halo Lanczos to enlarge, averaging to shrink), the IC.resample methods
  // ('area' pixel averaging, 'nohalo', 'lanczos', 'cubic', 'mitchell', 'linear'), 'nearest' (square pixels), 'scale2x' /
  // 'scale3x' (pixel art grown with its diagonals filled in), 'smoothpixel' (pixel art with smooth, rounded edges).
  // linear: average in linear light (default), as GIMP does.
  function resize(img, { width, height, method = 'smooth', linear = true } = {}) {
    const W = Math.max(1, Math.round(width || img.width)), H = Math.max(1, Math.round(height || img.height));
    if (method === 'scale2x' || method === 'scale3x' || method === 'smoothpixel') {
      // smooth pixel art: grown well past the size with Scale2x, then averaged down, so each edge is anti-aliased
      // from many sub-pixels (supersampling) instead of blurred
      let s = img; const f = method === 'scale3x' ? 3 : 2, aim = method === 'smoothpixel' ? 3 : 1;
      while ((s.width < W * aim || s.height < H * aim) && s.width * s.height * f * f <= 64e6) s = f === 3 ? scale3x(s) : scale2x(s);
      if (s.width === W && s.height === H) return s;
      return resize(s, { width: W, height: H, method: 'area', linear });
    }
    if (method === 'nearest') { const src = canvasOf(img); return draw(W, H, (x) => { x.imageSmoothingEnabled = false; x.drawImage(src, 0, 0, W, H); }); }
    const m = method === 'smooth' ? 'auto' : method;
    if (IC.resample && W * H <= 60e6 && img.width * img.height <= 60e6) return IC.resample.resize(img, W, H, { method: m, linear });
    // very big pictures: the browser's own scaling, shrinking in halves so fine detail averages instead of shimmering
    let c = canvasOf(img), cw = img.width, ch = img.height;
    while (cw / 2 >= W && ch / 2 >= H) { const n = document.createElement('canvas'); n.width = Math.round(cw / 2); n.height = Math.round(ch / 2); const x = n.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, n.width, n.height); c = n; cw = n.width; ch = n.height; }
    return draw(W, H, (x) => { x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, W, H); });
  }
  // EPX / Scale2x: each pixel becomes 2 × 2, taking a neighbour's colour where two neighbours agree on a diagonal
  function scale2x(img) {
    const W = img.width, H = img.height, s = new Uint32Array(img.data.buffer.slice(0)), o = new ImageData(W * 2, H * 2), d = new Uint32Array(o.data.buffer), at = (x, y) => s[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const P = at(x, y), A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1), r = y * 2 * W * 2 + x * 2;
      d[r] = C === A && C !== D && A !== B ? A : P; d[r + 1] = A === B && A !== C && B !== D ? B : P;
      d[r + W * 2] = D === C && D !== B && C !== A ? C : P; d[r + W * 2 + 1] = B === D && B !== A && D !== C ? D : P;
    }
    return o;
  }
  function scale3x(img) {
    const W = img.width, H = img.height, s = new Uint32Array(img.data.buffer.slice(0)), o = new ImageData(W * 3, H * 3), d = new Uint32Array(o.data.buffer), at = (x, y) => s[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))], W3 = W * 3;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const A = at(x - 1, y - 1), B = at(x, y - 1), C = at(x + 1, y - 1), D = at(x - 1, y), E = at(x, y), Fv = at(x + 1, y), G = at(x - 1, y + 1), Hh = at(x, y + 1), I = at(x + 1, y + 1), r = y * 3 * W3 + x * 3;
      const db = D === B && B !== Fv && D !== Hh, bf = B === Fv && B !== D && Fv !== Hh, dh = D === Hh && D !== B && Hh !== Fv, hf = Hh === Fv && D !== Hh && B !== Fv;
      d[r] = db ? D : E; d[r + 1] = (db && E !== C) || (bf && E !== A) ? B : E; d[r + 2] = bf ? Fv : E;
      d[r + W3] = (db && E !== G) || (dh && E !== A) ? D : E; d[r + W3 + 1] = E; d[r + W3 + 2] = (bf && E !== I) || (hf && E !== C) ? Fv : E;
      d[r + 2 * W3] = dh ? D : E; d[r + 2 * W3 + 1] = (dh && E !== I) || (hf && E !== G) ? Hh : E; d[r + 2 * W3 + 2] = hf ? Fv : E;
    }
    return o;
  }
  const rotate = (img, deg) => {
    const q = ((deg % 360) + 360) % 360;
    if (q === 90 || q === 270) return draw(img.height, img.width, (x, c) => { x.translate(c.width / 2, c.height / 2); x.rotate((q * Math.PI) / 180); x.drawImage(canvasOf(img), -img.width / 2, -img.height / 2); });
    if (q === 180) return draw(img.width, img.height, (x) => { x.translate(img.width, img.height); x.rotate(Math.PI); x.drawImage(canvasOf(img), 0, 0); });
    // any angle: the picture grows to hold the turned corners (or, with crop, is cut to the biggest straight box inside)
    return null;
  };
  function rotateAny(img, { angle = 0, crop = true, fill = '' } = {}) {
    const q = rotate(img, angle); if (q && Math.abs(angle) % 90 === 0) return q;
    const a = (angle * Math.PI) / 180, cs = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a)), W = img.width, H = img.height;
    let w = W * cs + H * sn, h = W * sn + H * cs;
    if (crop) { // the largest box with the picture's own shape that fits inside the turned picture
      const k = Math.min(W / (W * cs + H * sn), H / (W * sn + H * cs)); w = W * k; h = H * k;
    }
    return draw(w, h, (x, c) => { if (fill) { x.fillStyle = fill; x.fillRect(0, 0, c.width, c.height); } x.imageSmoothingQuality = 'high'; x.translate(c.width / 2, c.height / 2); x.rotate(a); x.drawImage(canvasOf(img), -W / 2, -H / 2); });
  }
  const flip = (img, horiz) => draw(img.width, img.height, (x) => { if (horiz) { x.translate(img.width, 0); x.scale(-1, 1); } else { x.translate(0, img.height); x.scale(1, -1); } x.drawImage(canvasOf(img), 0, 0); });
  const crop = (img, { x = 0, y = 0, width, height }) => draw(width, height, (c) => c.drawImage(canvasOf(img), -Math.round(x), -Math.round(y)));
  // the box round everything that is not the border colour (or see-through)
  function trimBox(img, { tolerance = 24 } = {}) {
    const W = img.width, H = img.height, d = img.data, bg = [d[0], d[1], d[2], d[3]];
    const off = (i) => (bg[3] < 128 ? d[i + 3] >= 128 : d[i + 3] >= 128 && Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > tolerance);
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (off((y * W + x) * 4)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return x1 < 0 ? null : { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
  }
  // a bigger or smaller canvas, the picture placed by anchor ('c', 'n', 'ne', …), the new space filled (or clear)
  function canvasSize(img, { width, height, anchor = 'c', fill = '' } = {}) {
    const W = Math.round(width), H = Math.round(height), ax = /w/.test(anchor) ? 0 : /e/.test(anchor) ? 1 : 0.5, ay = /n/.test(anchor) ? 0 : /s/.test(anchor) ? 1 : 0.5;
    return draw(W, H, (x) => { if (fill) { x.fillStyle = fill; x.fillRect(0, 0, W, H); } x.drawImage(canvasOf(img), Math.round((W - img.width) * ax), Math.round((H - img.height) * ay)); });
  }

  // ------------------------------------------------------------------ see-through
  // a colour (and those close to it) made see-through; connected: only the area touching the picked point (or edges)
  function makeClear(img, { rgb, tolerance = 30, soft = 0 } = {}) {
    const o = copy(img), d = o.data, t = tolerance * 3, sf = soft * 3;
    for (let i = 0; i < d.length; i += 4) { const e = Math.abs(d[i] - rgb[0]) + Math.abs(d[i + 1] - rgb[1]) + Math.abs(d[i + 2] - rgb[2]); if (e <= t) d[i + 3] = 0; else if (sf && e <= t + sf) d[i + 3] = Math.min(d[i + 3], ((e - t) / sf) * 255); }
    return o;
  }
  // see-through parts filled with a colour (or a checker) so formats without see-through look right
  const flatten = (img, { fill = '#ffffff' } = {}) => draw(img.width, img.height, (x) => { x.fillStyle = fill; x.fillRect(0, 0, img.width, img.height); x.drawImage(canvasOf(img), 0, 0); });


  // ------------------------------------------------------------------ edges: checking and smoothing jagged steps
  // An edge pixel: a big brightness difference across its 3 × 3 square. Its direction comes from the gradient (Sobel).
  // A slanted edge (not level or upright) drawn with no in-between shades is a staircase: "jagged" (aliased).
  function edgeInfo(img, threshold, reach = 3) {
    const W = img.width, H = img.height, s = img.data, N = W * H, L = new Float32Array(N);
    for (let p = 0; p < N; p++) L[p] = 0.299 * s[p * 4] + 0.587 * s[p * 4 + 1] + 0.114 * s[p * 4 + 2];
    const at = (x, y) => L[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))];
    // the edge's direction over an area (a structure tensor): up close a staircase is only level and upright bits,
    // but over a few pixels its true slope shows
    const Jxx = new Float32Array(N), Jxy = new Float32Array(N), Jyy = new Float32Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const gx = at(x + 1, y) - at(x - 1, y), gy = at(x, y + 1) - at(x, y - 1), p = y * W + x; Jxx[p] = gx * gx; Jxy[p] = gx * gy; Jyy[p] = gy * gy; }
    const box = (A) => { const t = new Float32Array(N), o = new Float32Array(N), R = reach; for (let y = 0; y < H; y++) { let acc = 0; for (let x = -R; x <= R; x++) acc += A[y * W + Math.min(W - 1, Math.max(0, x))]; for (let x = 0; x < W; x++) { t[y * W + x] = acc; acc += A[y * W + Math.min(W - 1, x + R + 1)] - A[y * W + Math.max(0, x - R)]; } } for (let x = 0; x < W; x++) { let acc = 0; for (let y = -R; y <= R; y++) acc += t[Math.min(H - 1, Math.max(0, y)) * W + x]; for (let y = 0; y < H; y++) { o[y * W + x] = acc; acc += t[Math.min(H - 1, y + R + 1) * W + x] - t[Math.max(0, y - R) * W + x]; } } return o; };
    const Sxx = box(Jxx), Sxy = box(Jxy), Syy = box(Jyy);
    return { W, H, L, at, edge: (x, y) => {
      let mn = 255, mx = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const v = at(x + dx, y + dy); if (v < mn) mn = v; if (v > mx) mx = v; }
      if (mx - mn < threshold) return null;
      const p = y * W + x, th = 0.5 * Math.atan2(2 * Sxy[p], Sxx[p] - Syy[p]), gx = Math.cos(th), gy = Math.sin(th);
      const ang = (Math.atan2(Math.abs(gy), Math.abs(gx)) * 180) / Math.PI, c = at(x, y);
      return { mn, mx, gx, gy, slant: ang > 12 && ang < 78, hard: Math.min(c - mn, mx - c) < (mx - mn) * 0.12 };
    } };
  }
  // the check: how many slanted edge pixels are hard steps, and a map (red: jagged, green: smooth edge)
  function aliasCheck(img, { threshold = 48 } = {}) {
    const E = edgeInfo(img, threshold), { W, H, L } = E, map = new ImageData(W, H), d = map.data; let slanted = 0, jagged = 0;
    const lin = (x, y) => { const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0; return (E.at(x0, y0) * (1 - fx) + E.at(x0 + 1, y0) * fx) * (1 - fy) + (E.at(x0, y0 + 1) * (1 - fx) + E.at(x0 + 1, y0 + 1) * fx) * fy; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, g = L[y * W + x] * 0.3; d[i] = d[i + 1] = d[i + 2] = g; d[i + 3] = 255;
      const e = E.edge(x, y); if (!e || !e.slant) continue; slanted++;
      // along the edge, a smooth (anti-aliased) edge changes gently; a staircase jumps from one side to the other
      const tx = -e.gy, ty = e.gx, c = L[y * W + x], mid = (lin(x + tx, y + ty) + lin(x - tx, y - ty)) / 2;
      if (Math.abs(c - mid) > (e.mx - e.mn) * 0.22) { jagged++; d[i] = 240; d[i + 1] = 60; d[i + 2] = 60; } else { d[i] = 60; d[i + 1] = 200; d[i + 2] = 90; }
    }
    return { ratio: slanted ? jagged / slanted : 0, slanted, jagged, map };
  }
  // smoothing: on edge pixels only, a blend with points along the edge (never across it), so steps become a smooth
  // slope while the edge stays sharp. amount 0–100; level and upright edges are left as they are.
  function antialias(img, { amount = 60, threshold = 32, reach = 0 } = {}) {
    // how far to reach along an edge: about the length of a step (pictures grown with square pixels have long steps)
    let R = reach; if (!R) { const a = aliasCheck(img, { threshold }); R = a.ratio > 0.25 ? 4 : a.ratio > 0.12 ? 3 : 2; }
    const E = edgeInfo(img, threshold, Math.max(2, R)), { W, H } = E, s = img.data, o = copy(img), d = o.data, k = amount / 100;
    const sample = (x, y, c) => { const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, px = (xx, yy) => s[(Math.min(H - 1, Math.max(0, yy)) * W + Math.min(W - 1, Math.max(0, xx))) * 4 + c]; return (px(x0, y0) * (1 - fx) + px(x0 + 1, y0) * fx) * (1 - fy) + (px(x0, y0 + 1) * (1 - fx) + px(x0 + 1, y0 + 1) * fx) * fy; };
    const taps = []; let tw = 0; for (let t = 1; t <= R * 1.5; t += 0.5) { const wt = R * 1.5 + 0.5 - t; taps.push([t, wt]); tw += 2 * wt; }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const e = E.edge(x, y); if (!e || !e.slant) continue;
      const tx = -e.gy, ty = e.gx, i = (y * W + x) * 4, w = k * (e.hard ? 1 : 0.5);
      for (let c = 0; c < 4; c++) { let along = 0; for (const [t, wt] of taps) along += (sample(x + tx * t, y + ty * t, c) + sample(x - tx * t, y - ty * t, c)) * wt; d[i + c] = s[i + c] * (1 - w) + (along / tw) * w; }
    }
    return o;
  }

  // ------------------------------------------------------------------ multi-band blending (Laplacian pyramids)
  // As in Burt and Adelson's pyramid blending: both pictures are split into bands from fine detail to broad colour;
  // each band is blended through the mask blurred to that band's scale, then the bands are added back up. Fine edges
  // switch over sharply and broad colour gently, so no seam shows. mask: Float32Array (0 = a, 1 = b), one per pixel.
  function pyramidBlend(a, b, mask, levels = 5) {
    const W = a.width, H = a.height;
    const toF = (img) => Float32Array.from(img.data);
    const down = (f, w, h) => { // binomial blur, then every other pixel
      const w2 = Math.max(1, (w + 1) >> 1), h2 = Math.max(1, (h + 1) >> 1), ch = f.length / (w * h), o = new Float32Array(w2 * h2 * ch), K = [1, 4, 6, 4, 1];
      for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) for (let c = 0; c < ch; c++) { let t = 0, n = 0; for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const xx = Math.min(w - 1, Math.max(0, x * 2 + i)), yy = Math.min(h - 1, Math.max(0, y * 2 + j)), k = K[i + 2] * K[j + 2]; t += f[(yy * w + xx) * ch + c] * k; n += k; } o[(y * w2 + x) * ch + c] = t / n; }
      return [o, w2, h2];
    };
    const up = (f, w, h, W2, H2) => { // back to W2 × H2, bilinear
      const ch = f.length / (w * h), o = new Float32Array(W2 * H2 * ch);
      for (let y = 0; y < H2; y++) { const fy = Math.min(h - 1, Math.max(0, (y + 0.5) / 2 - 0.5)), y0 = Math.floor(fy), y1 = Math.min(h - 1, y0 + 1), ty = fy - y0;
        for (let x = 0; x < W2; x++) { const fx = Math.min(w - 1, Math.max(0, (x + 0.5) / 2 - 0.5)), x0 = Math.floor(fx), x1 = Math.min(w - 1, x0 + 1), tx = fx - x0;
          for (let c = 0; c < ch; c++) o[(y * W2 + x) * ch + c] = (f[(y0 * w + x0) * ch + c] * (1 - tx) + f[(y0 * w + x1) * ch + c] * tx) * (1 - ty) + (f[(y1 * w + x0) * ch + c] * (1 - tx) + f[(y1 * w + x1) * ch + c] * tx) * ty; } }
      return o;
    };
    // Gaussian pyramids of both pictures and the mask
    let ga = [[toF(a), W, H]], gb = [[toF(b), W, H]], gm = [[Float32Array.from(mask), W, H]];
    for (let l = 1; l < levels && ga[l - 1][1] > 8 && ga[l - 1][2] > 8; l++) { ga.push(down(...ga[l - 1])); gb.push(down(...gb[l - 1])); gm.push(down(...gm[l - 1])); }
    const n = ga.length;
    // start from the smallest level, blended; then add each finer band (the picture minus its blurred self), blended
    let [cur] = ga[n - 1]; const top = gb[n - 1][0], mt = gm[n - 1][0]; cur = cur.map((v, i) => v * (1 - mt[i >> 2]) + top[i] * mt[i >> 2]);
    for (let l = n - 2; l >= 0; l--) {
      const [fa, w, h] = ga[l], fb = gb[l][0], m = gm[l][0], ua = up(ga[l + 1][0], ga[l + 1][1], ga[l + 1][2], w, h), ub = up(gb[l + 1][0], gb[l + 1][1], gb[l + 1][2], w, h), uc = up(cur, ga[l + 1][1], ga[l + 1][2], w, h);
      cur = new Float32Array(fa.length);
      for (let i = 0; i < fa.length; i++) { const t = m[i >> 2]; cur[i] = uc[i] + (fa[i] - ua[i]) * (1 - t) + (fb[i] - ub[i]) * t; }
    }
    return new ImageData(Uint8ClampedArray.from(cur), W, H);
  }


  // ------------------------------------------------------------------ faded prints: colour and detail
  // Auto colour, the way a photo lab corrects a faded print: (1) each colour's own darkest and lightest points stretched
  // to black and white (a fade lifts and tints the blacks and dulls the whites differently in each colour); (2) the
  // midtones made neutral with a gamma for each colour (a curve, not a flat shift, so blacks and whites stay put),
  // judged from nearly-grey midtone pixels; (3) colour that faded brought back, by how much is missing.
  //   strength 0–100 (mix with the original), keepTone: true leaves a picture that is meant to be one colour (sepia,
  //   cyanotype) toned, only correcting its levels.
  function autoColour(img, { strength = 100, clip = 0.3, keepTone = 'auto', saturation = true } = {}) {
    const d = img.data, N = d.length / 4, H = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) continue; H[0][d[i]]++; H[1][d[i + 1]]++; H[2][d[i + 2]]++; }
    const ends = (h) => { const cut = (N * clip) / 100; let a = 0, t = 0; while (a < 254 && t + h[a] <= cut) t += h[a++]; let b = 255; t = 0; while (b > a + 1 && t + h[b] <= cut) t += h[b--]; return [a, b]; };
    const E = H.map(ends);
    // a toned picture (sepia and the like): its colour hardly varies from pixel to pixel
    let sv = 0, sm = [0, 0, 0], n0 = 0;
    for (let i = 0; i < d.length; i += 16) { const r = d[i], g = d[i + 1], b = d[i + 2], l = (r + g + b) / 3; if (l < 20 || l > 235) continue; sm[0] += r - l; sm[1] += g - l; sm[2] += b - l; n0++; }
    if (n0) { sm = sm.map((v) => v / n0); for (let i = 0; i < d.length; i += 16) { const r = d[i], g = d[i + 1], b = d[i + 2], l = (r + g + b) / 3; if (l < 20 || l > 235) continue; sv += (r - l - sm[0]) ** 2 + (g - l - sm[1]) ** 2 + (b - l - sm[2]) ** 2; } sv = Math.sqrt(sv / n0 / 3); }
    const toned = keepTone === true || (keepTone === 'auto' && sv < 5.5); let skinEase = 1;
    // levels: per colour, or (toned) the same for all three so the tone stays
    let L = E;
    if (toned) { const lo = Math.min(...E.map((e) => e[0])), hi = Math.max(...E.map((e) => e[1])); L = [[lo, hi], [lo, hi], [lo, hi]]; }
    const stretch = (v, c) => Math.max(0, Math.min(1, (v - L[c][0]) / Math.max(1, L[c][1] - L[c][0])));
    // midtone gammas from nearly-grey midtones (after the stretch)
    let gam = [1, 1, 1];
    if (!toned) {
      const acc = [0, 0, 0]; let n = 0;
      for (let i = 0; i < d.length; i += 8) { const v = [stretch(d[i], 0), stretch(d[i + 1], 1), stretch(d[i + 2], 2)], l = (v[0] + v[1] + v[2]) / 3, sat = Math.max(...v) - Math.min(...v); if (l > 0.25 && l < 0.75 && sat < 0.18) { acc[0] += Math.log(v[0] + 1e-3); acc[1] += Math.log(v[1] + 1e-3); acc[2] += Math.log(v[2] + 1e-3); n++; } }
      if (n > N * 0.01) { const m = acc.map((a) => a / n), target = (m[0] + m[1] + m[2]) / 3; gam = m.map((v) => Math.max(0.6, Math.min(1.6, target / v))); }
    }
    // skin protection: the warm, skin-like pixels of the picture (red over green over blue) must stay warm after the
    // correction (pinkish, peach or tan, never grey-lilac); if they would not, the midtone curves are eased back
    if (!toned) {
      const skin = []; for (let i = 0; i < d.length; i += 12) { const r = d[i], g = d[i + 1], b = d[i + 2]; if (r > 60 && r > g && g > b && r - b > 25 && r - b < 140 && (r + g + b) / 3 > 50) skin.push(i); }
      if (skin.length > N * 0.004) {
        const warm = (gg) => { let rb = 0, rg = 0; for (const i of skin) { const r = Math.pow(stretch(d[i], 0), gg[0]), g = Math.pow(stretch(d[i + 1], 1), gg[1]), b = Math.pow(stretch(d[i + 2], 2), gg[2]); rb += r - b; rg += r - g; } return [rb / skin.length, rg / skin.length]; };
        const full = gam.slice(); let used = 1;
        for (const t of [1, 0.75, 0.5, 0.25, 0]) { const gg = full.map((v) => Math.pow(v, t)), [rb, rg] = warm(gg); used = t; gam = gg; if (rb > 0.09 && rg > 0.03) break; }
        skinEase = used;
      }
    }
    // how much colour faded: the picture's average saturation against a natural photo's (about 0.22 in HSV terms)
    let boost = 0;
    if (saturation && !toned) { let ss = 0, ns = 0; for (let i = 0; i < d.length; i += 16) { const v = [stretch(d[i], 0) ** gam[0], stretch(d[i + 1], 1) ** gam[1], stretch(d[i + 2], 2) ** gam[2]], mx = Math.max(...v); if (mx > 0.1) { ss += (mx - Math.min(...v)) / mx; ns++; } } const avg = ns ? ss / ns : 0.22; boost = Math.max(0, Math.min(0.6, (0.22 - avg) * 2.2)); }
    const T = [0, 1, 2].map((c) => { const t = new Float32Array(256); for (let v = 0; v < 256; v++) t[v] = Math.pow(stretch(v, c), gam[c]) * 255; return t; });
    const o = copy(img), od = o.data, k = strength / 100;
    for (let i = 0; i < od.length; i += 4) {
      let r = T[0][d[i]], g = T[1][d[i + 1]], b = T[2][d[i + 2]];
      if (boost) { const l = 0.299 * r + 0.587 * g + 0.114 * b, s0 = (Math.max(r, g, b) - Math.min(r, g, b)) / 255, f = 1 + boost * (1 - s0); r = l + (r - l) * f; g = l + (g - l) * f; b = l + (b - l) * f; }
      od[i] = clamp(d[i] + (r - d[i]) * k); od[i + 1] = clamp(d[i + 1] + (g - d[i + 1]) * k); od[i + 2] = clamp(d[i + 2] + (b - d[i + 2]) * k);
    }
    o.colourInfo = { toned, gamma: gam.map((v) => +v.toFixed(2)), levels: L, boost: +boost.toFixed(2), skinEase };
    return o;
  }
  // Clarity: local contrast. The picture's large-scale brightness (a wide blur) is taken away and the rest made
  // stronger, on brightness only and mostly in the midtones, so texture and detail stand out without hard halos or
  // colour shifts. amount 0–100; radius in pixels (default: 1.5% of the picture's size).
  function clarity(img, { amount = 35, radius = 0 } = {}) {
    const W = img.width, H = img.height, R = radius || Math.max(4, Math.round(Math.max(W, H) * 0.015));
    const s = img.data, Y = new ImageData(W, H), yd = Y.data;
    for (let i = 0; i < s.length; i += 4) { const l = 0.299 * s[i] + 0.587 * s[i + 1] + 0.114 * s[i + 2]; yd[i] = yd[i + 1] = yd[i + 2] = l; yd[i + 3] = 255; }
    const B = blur(Y, { radius: R }).data, o = copy(img), d = o.data, k = (amount / 100) * 1.2;
    for (let i = 0; i < d.length; i += 4) {
      const l = yd[i], m = l / 255, mid = 4 * m * (1 - m), dl = (l - B[i]) * k * mid, nl = Math.max(0, Math.min(255, l + dl)), f = l > 1 ? nl / l : 1;
      d[i] = clamp(s[i] * f); d[i + 1] = clamp(s[i + 1] * f); d[i + 2] = clamp(s[i + 2] * f);
    }
    return o;
  }

  IC.filters = { autoColour, clarity, pyramidBlend, aliasCheck, antialias, light, colour, autoLevels, autoFix, whiteBalance, greyscale, sepia, invert, threshold, posterize, blur, sharpen, denoise, median, despeckle, deblock, undither, pixelate, resize, scale2x, scale3x, rotate: rotateAny, rotate90: rotate, flip, crop, trimBox, canvasSize, makeClear, flatten, copy, canvasOf };
})();

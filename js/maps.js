/* ImageCraft maps (IC.maps): a picture measured into many "maps" — where its edges, texture, smooth areas, noise,
   specks, skin, greenery, sky, shadows and highlights, haze, blur and clipping are — each a value from 0 to 1 for every
   pixel. Shown as heat maps (pages to look through), and used as masks so a tool works only where it should: sharpen the
   detail but not the sky, smooth the noise but not the texture, lift the colour but not the skin. All measured; no AI.
     LIST: [{ id, name, what, make(img) → Float32Array }]
     make(id, img) → Float32Array (remembered per picture)   heat(map, img) → ImageData (the map in colour over a faint
     copy of the picture)   mask(img, { map, invert, level, softness, feather }) → Float32Array 0–1 */
(function () {
  'use strict';
  const IC = (window.IC = window.IC || {});
  const lumOf = (img) => { const d = img.data, n = img.width * img.height, L = new Float32Array(n); for (let p = 0; p < n; p++) L[p] = (0.299 * d[p * 4] + 0.587 * d[p * 4 + 1] + 0.114 * d[p * 4 + 2]) / 255; return L; };
  // a square average (running sums), radius r
  function box(A, W, H, r) {
    const S = new Float64Array((W + 1) * (H + 1)), o = new Float32Array(W * H);
    for (let y = 0; y < H; y++) { let run = 0; for (let x = 0; x < W; x++) { run += A[y * W + x]; S[(y + 1) * (W + 1) + x + 1] = S[y * (W + 1) + x + 1] + run; } }
    for (let y = 0; y < H; y++) { const y0 = Math.max(0, y - r), y1 = Math.min(H, y + r + 1); for (let x = 0; x < W; x++) { const x0 = Math.max(0, x - r), x1 = Math.min(W, x + r + 1); o[y * W + x] = (S[y1 * (W + 1) + x1] - S[y0 * (W + 1) + x1] - S[y1 * (W + 1) + x0] + S[y0 * (W + 1) + x0]) / ((y1 - y0) * (x1 - x0)); } }
    return o;
  }
  // values spread to 0–1 by a high percentile (so one bright spot does not squash the rest)
  function normalise(A, pct = 0.98) { const s = Float32Array.from(A).sort(), top = s[Math.min(s.length - 1, Math.floor(s.length * pct))] || 1e-6; const o = new Float32Array(A.length); for (let i = 0; i < A.length; i++) o[i] = Math.min(1, A[i] / Math.max(1e-6, top)); return o; }
  const hsv = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), c = mx - mn; let h = 0; if (c) h = mx === r ? ((g - b) / c + 6) % 6 : mx === g ? (b - r) / c + 2 : (r - g) / c + 4; return [h * 60, mx ? c / mx : 0, mx / 255]; };
  const smoothstep = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const scaleR = (img, f) => Math.max(1, Math.round(Math.max(img.width, img.height) * f));

  function sobel(L, W, H) { const g = new Float32Array(W * H), at = (x, y) => L[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))]; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const gx = at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1), gy = at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1); g[y * W + x] = Math.hypot(gx, gy); } return g; }
  function localStd(L, W, H, r) { const m = box(L, W, H, r), L2 = new Float32Array(L.length); for (let i = 0; i < L.length; i++) L2[i] = L[i] * L[i]; const m2 = box(L2, W, H, r), o = new Float32Array(L.length); for (let i = 0; i < L.length; i++) o[i] = Math.sqrt(Math.max(0, m2[i] - m[i] * m[i])); return o; }

  const LIST = [ // (measurements first; the channels are added below)
    { id: 'edges', name: 'Edges', what: 'Outlines and strong changes: where sharpening helps and where smoothing must stop.',
      make: (img) => { const W = img.width, H = img.height; return normalise(box(sobel(lumOf(img), W, H), W, H, 1), 0.97); } },
    { id: 'texture', name: 'Texture', what: 'Fine detail: hair, fabric, leaves, grass, gravel. Keep it; sharpen it gently.',
      make: (img) => { const W = img.width, H = img.height, L = lumOf(img), fine = new Float32Array(L.length), bl = box(L, W, H, 1); for (let i = 0; i < L.length; i++) fine[i] = Math.abs(L[i] - bl[i]); return normalise(box(fine, W, H, scaleR(img, 0.006)), 0.97); } },
    { id: 'smooth', name: 'Smooth areas', what: 'Sky, walls, skin, out-of-focus backgrounds: where noise shows most and sharpening hurts.',
      make: (img) => { const W = img.width, H = img.height, s = normalise(localStd(lumOf(img), W, H, scaleR(img, 0.008)), 0.9); return s.map((v) => 1 - v); } },
    { id: 'noise', name: 'Noise', what: 'Grain and speckle: how far each pixel differs from the middle of its neighbours, averaged around it.',
      make: (img) => { const W = img.width, H = img.height, L = lumOf(img), r = new Float32Array(L.length), v = new Float32Array(9); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let k = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) v[k++] = L[Math.min(H - 1, Math.max(0, y + dy)) * W + Math.min(W - 1, Math.max(0, x + dx))]; v.sort(); const d = L[y * W + x] - v[4]; r[y * W + x] = d * d; } return normalise(box(r, W, H, 3).map(Math.sqrt), 0.97); } },
    { id: 'specks', name: 'Specks and damage', what: 'Dust, spots and flakes found by the speck finder (the pixels Dust and scratches would repair).',
      make: (img) => { const fixed = IC.restore.impulse(img, { threshold: 25 }), a = img.data, b = fixed.data, o = new Float32Array(img.width * img.height); for (let p = 0; p < o.length; p++) o[p] = Math.abs(a[p * 4] - b[p * 4]) + Math.abs(a[p * 4 + 1] - b[p * 4 + 1]) + Math.abs(a[p * 4 + 2] - b[p * 4 + 2]) > 6 ? 1 : 0; return box(o, img.width, img.height, 1).map((v) => Math.min(1, v * 2)); } },
    { id: 'skin', name: 'Skin', what: 'Skin tones (a common colour rule, softened): protect them from strong colour changes and harsh sharpening.',
      make: (img) => { const d = img.data, n = img.width * img.height, o = new Float32Array(n); for (let p = 0; p < n; p++) { const [h, sa, v] = hsv(d[p * 4], d[p * 4 + 1], d[p * 4 + 2]); const hue = h <= 50 ? 1 - smoothstep(30, 50, h) : smoothstep(335, 355, h); o[p] = hue * smoothstep(0.08, 0.18, sa) * (1 - smoothstep(0.6, 0.8, sa)) * smoothstep(0.22, 0.38, v); } return box(o, img.width, img.height, scaleR(img, 0.004)); } },
    { id: 'green', name: 'Greenery', what: 'Grass, leaves and trees (green over red and blue).',
      make: (img) => { const d = img.data, n = img.width * img.height, o = new Float32Array(n); for (let p = 0; p < n; p++) { const [h, sa, v] = hsv(d[p * 4], d[p * 4 + 1], d[p * 4 + 2]); o[p] = smoothstep(55, 75, h) * (1 - smoothstep(160, 185, h)) * smoothstep(0.06, 0.16, sa) * smoothstep(0.08, 0.18, v); } return box(o, img.width, img.height, 2); } },
    { id: 'sky', name: 'Sky', what: 'Bright, smooth, bluish or white areas, mostly near the top.',
      make: (img) => { const W = img.width, H = img.height, d = img.data, L = lumOf(img), sm = normalise(localStd(L, W, H, scaleR(img, 0.008)), 0.9), o = new Float32Array(W * H), srt = Float32Array.from(L).sort(), lo = srt[Math.floor(srt.length * 0.5)], hi = Math.max(lo + 0.05, srt[Math.floor(srt.length * 0.85)]); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = y * W + x, [h, sa] = hsv(d[p * 4], d[p * 4 + 1], d[p * 4 + 2]), blueish = h > 180 && h < 260 ? 1 : 0, pale = 1 - smoothstep(0.12, 0.3, sa); o[p] = smoothstep(lo, hi, L[p]) /* bright for this picture (an underexposed sky is still its brightest part) */ * Math.max(blueish, pale) * (1 - smoothstep(0.5, 0.92, sm[p])) * (1 - smoothstep(0.3, 0.75, y / H)); } return box(o, W, H, scaleR(img, 0.006)); } },
    { id: 'shadows', name: 'Shadows', what: 'The dark parts of the picture (soft-edged).',
      make: (img) => { const W = img.width, H = img.height; return box(lumOf(img), W, H, scaleR(img, 0.006)).map((v) => 1 - smoothstep(0.12, 0.38, v)); } },
    { id: 'highlights', name: 'Highlights', what: 'The bright parts of the picture (soft-edged).',
      make: (img) => { const W = img.width, H = img.height; return box(lumOf(img), W, H, scaleR(img, 0.006)).map((v) => smoothstep(0.62, 0.88, v)); } },
    { id: 'midtones', name: 'Midtones', what: 'Neither dark nor bright: where most detail and colour live.',
      make: (img) => { const W = img.width, H = img.height; return box(lumOf(img), W, H, scaleR(img, 0.006)).map((v) => 4 * v * (1 - v)); } },
    { id: 'colour', name: 'Colourfulness', what: 'How colourful each place is (saturation).',
      make: (img) => { const d = img.data, n = img.width * img.height, o = new Float32Array(n); for (let p = 0; p < n; p++) { const mx = Math.max(d[p * 4], d[p * 4 + 1], d[p * 4 + 2]), mn = Math.min(d[p * 4], d[p * 4 + 1], d[p * 4 + 2]); o[p] = mx ? (mx - mn) / mx : 0; } return normalise(box(o, img.width, img.height, 2), 0.98); } },
    { id: 'haze', name: 'Haze and fading', what: 'How thick a grey veil is at each place (the dark channel): where Dehaze will act.',
      make: (img) => { const W = img.width, H = img.height, d = img.data, m = new Float32Array(W * H); for (let p = 0; p < W * H; p++) m[p] = Math.min(d[p * 4], d[p * 4 + 1], d[p * 4 + 2]) / 255; const R = scaleR(img, 0.01), t = new Float32Array(W * H), o = new Float32Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = 1; for (let k = Math.max(0, x - R); k <= Math.min(W - 1, x + R); k++) v = Math.min(v, m[y * W + k]); t[y * W + x] = v; } for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = 1; for (let k = Math.max(0, y - R); k <= Math.min(H - 1, y + R); k++) v = Math.min(v, t[k * W + x]); o[y * W + x] = v; } return box(o, W, H, R).map((v) => smoothstep(0.05, 0.45, v)); } },
    { id: 'focus', name: 'Sharp or blurred', what: 'Where the picture is in focus (bright) and where it is soft (dark), from the fine detail around each place.',
      make: (img) => { const W = img.width, H = img.height, L = lumOf(img), lap = new Float32Array(L.length), at = (x, y) => L[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))]; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = 4 * at(x, y) - at(x - 1, y) - at(x + 1, y) - at(x, y - 1) - at(x, y + 1); lap[y * W + x] = v * v; } return normalise(box(lap, W, H, scaleR(img, 0.015)).map(Math.sqrt), 0.95); } },
    { id: 'clipped', name: 'Clipped', what: 'Pure white or pure black: detail that is lost in the file (nothing can bring it back except another scan).',
      make: (img) => { const d = img.data, n = img.width * img.height, o = new Float32Array(n); for (let p = 0; p < n; p++) { const mx = Math.max(d[p * 4], d[p * 4 + 1], d[p * 4 + 2]), mn = Math.min(d[p * 4], d[p * 4 + 1], d[p * 4 + 2]); o[p] = mn >= 253 || mx <= 2 ? 1 : 0; } return o; } },
  ];
  // Channels: the picture taken apart, each part as a greyscale map (for looking at damage and detail separately,
  // masking, or opening as a picture of its own to work on)
  const ch = (f) => (img) => { const d = img.data, n = img.width * img.height, o = new Float32Array(n); for (let p = 0; p < n; p++) o[p] = f(d[p * 4] / 255, d[p * 4 + 1] / 255, d[p * 4 + 2] / 255); return o; };
  const lin = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)), fLab = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const lab = (r, g, b) => { const R = lin(r), G = lin(g), B = lin(b), X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047, Y = 0.2126 * R + 0.7152 * G + 0.0722 * B, Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883; return [116 * fLab(Y) - 16, 500 * (fLab(X) - fLab(Y)), 200 * (fLab(Y) - fLab(Z))]; };
  const kOf = (r, g, b) => 1 - Math.max(r, g, b), cmyk = (r, g, b, i) => { const k = kOf(r, g, b); if (i === 3) return k; if (k >= 0.999) return 0; return (1 - [r, g, b][i] - k) / (1 - k); };
  const CHANNELS = [
    ['red', 'Red channel', (r) => r], ['greenc', 'Green channel', (r, g) => g], ['blue', 'Blue channel', (r, g, b) => b],
    ['cyan', 'Cyan (CMYK)', (r, g, b) => cmyk(r, g, b, 0)], ['magenta', 'Magenta (CMYK)', (r, g, b) => cmyk(r, g, b, 1)], ['yellow', 'Yellow (CMYK)', (r, g, b) => cmyk(r, g, b, 2)], ['black', 'Black / K (CMYK)', (r, g, b) => cmyk(r, g, b, 3)],
    ['lightness', 'Lightness (Lab L*)', (r, g, b) => lab(r, g, b)[0] / 100], ['labA', 'Green ↔ red (Lab a*)', (r, g, b) => Math.max(0, Math.min(1, lab(r, g, b)[1] / 60 + 0.5))], ['labB', 'Blue ↔ yellow (Lab b*)', (r, g, b) => Math.max(0, Math.min(1, lab(r, g, b)[2] / 60 + 0.5))],
  ];
  CHANNELS.forEach(([id, name, f]) => LIST.push({ id, name, group: 'Channels', what: `The picture’s ${name.toLowerCase()} on its own, white = most.`, grey: true, make: ch(f) }));
  // extreme greyscale: lightness with its contrast pushed to the limit, area by area, so faint marks and detail show
  LIST.push({ id: 'extreme', name: 'Extreme greyscale', group: 'Channels', grey: true, what: 'Lightness with the contrast pushed to the limit in every area: scratches, creases, faint detail and stains stand out.',
    make: (img) => { const W = img.width, H = img.height, L = ch((r, g, b) => lab(r, g, b)[0] / 100)(img), R = scaleR(img, 0.03), m = box(L, W, H, R), sd = localStd(L, W, H, R); return L.map((v, i) => Math.max(0, Math.min(1, 0.5 + (v - m[i]) / (2.5 * sd[i] + 0.01)))); } });
  // black and white at the threshold that best splits the picture into two groups (Otsu's method)
  LIST.push({ id: 'bw', name: 'Black and white', group: 'Channels', grey: true, what: 'Two values only, split at the level that best separates the picture into dark and light (Otsu’s method): clean shapes for masking or tracing.',
    make: (img) => { const L = lumOf(img), h = new Float64Array(256); L.forEach((v) => h[Math.min(255, Math.round(v * 255))]++); const N = L.length; let sum = 0; for (let i = 0; i < 256; i++) sum += i * h[i]; let sB = 0, wB = 0, best = 0, th = 128; for (let t = 0; t < 256; t++) { wB += h[t]; if (!wB) continue; const wF = N - wB; if (!wF) break; sB += t * h[t]; const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) ** 2; if (v > best) { best = v; th = t; } } return L.map((v) => (v * 255 > th ? 1 : 0)); } });
  const byId = Object.fromEntries(LIST.map((m) => [m.id, m]));

  // maps are remembered for the picture they were made from (the same ImageData object)
  const memo = new WeakMap();
  function make(id, img) {
    let m = memo.get(img); if (!m) { m = {}; memo.set(img, m); }
    if (!m[id]) m[id] = byId[id].make(img);
    return m[id];
  }
  // heat colours: dark purple → red → orange → yellow, over a faint grey copy of the picture
  const STOPS = [[0, [10, 6, 30]], [0.25, [86, 22, 110]], [0.5, [190, 45, 70]], [0.75, [245, 130, 30]], [1, [252, 240, 120]]];
  const heatCol = (v) => { for (let i = 1; i < STOPS.length; i++) if (v <= STOPS[i][0]) { const [a, ca] = STOPS[i - 1], [b, cb] = STOPS[i], t = (v - a) / (b - a); return [0, 1, 2].map((q) => ca[q] + (cb[q] - ca[q]) * t); } return STOPS[STOPS.length - 1][1]; };
  // a map as plain grey (white = 1): how a mask or a channel really looks
  function grey(map, W, H) { const o = new ImageData(W, H), d = o.data; for (let p = 0; p < W * H; p++) { const v = map[p] * 255; d[p * 4] = d[p * 4 + 1] = d[p * 4 + 2] = v; d[p * 4 + 3] = 255; } return o; }
  function heat(map, img) {
    const W = img.width, H = img.height, s = img.data, o = new ImageData(W, H), d = o.data;
    for (let p = 0; p < W * H; p++) { const g = (0.299 * s[p * 4] + 0.587 * s[p * 4 + 1] + 0.114 * s[p * 4 + 2]) * 0.22, c = heatCol(map[p]), k = 0.25 + 0.75 * map[p]; d[p * 4] = g * (1 - k) + c[0] * k; d[p * 4 + 1] = g * (1 - k) + c[1] * k; d[p * 4 + 2] = g * (1 - k) + c[2] * k; d[p * 4 + 3] = 255; }
    return o;
  }
  // a mask from a map: level (0–1) is where it turns on, softness how gradually, feather blurs its edges; invert flips it
  // Calculations (as in Photoshop's Image › Calculations): two maps combined, 0–1 each:
  //   multiply (where both), add (where either), subtract (the first without the second), difference, lighter, darker
  const OPS = { multiply: (a, b) => a * b, add: (a, b) => Math.min(1, a + b), subtract: (a, b) => Math.max(0, a - b), difference: (a, b) => Math.abs(a - b), lighter: (a, b) => Math.max(a, b), darker: (a, b) => Math.min(a, b) };
  function combined(img, map, map2, op) { const a = make(map, img); if (!map2 || !OPS[op]) return a; const b = make(map2, img), f = OPS[op], o = new Float32Array(a.length); for (let i = 0; i < a.length; i++) o[i] = f(a[i], b[i]); return o; }
  function mask(img, { map, map2 = '', op = 'multiply', invert = false, level = 0.35, softness = 0.3, feather = 2 } = {}) {
    const m = combined(img, map, map2, op), lo = Math.max(0, level - softness / 2), hi = Math.min(1, level + softness / 2 + 1e-3);
    let o = m.map((v) => { const t = smoothstep(lo, hi, v); return invert ? 1 - t : t; });
    if (feather > 0) o = box(o, img.width, img.height, Math.round(feather));
    return o;
  }
  // a tool's result kept only where the mask is (base elsewhere)
  function apply(base, result, msk) {
    if (result.width !== base.width || result.height !== base.height) return result;
    const o = new ImageData(base.width, base.height), d = o.data, a = base.data, b = result.data;
    for (let p = 0; p < msk.length; p++) { const t = msk[p]; for (let c = 0; c < 4; c++) d[p * 4 + c] = a[p * 4 + c] + (b[p * 4 + c] - a[p * 4 + c]) * t; }
    return o;
  }
  IC.maps = { LIST, make, heat, grey, mask, apply, box, combined, OPS };
})();

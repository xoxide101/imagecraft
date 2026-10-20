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
  // stretched ("false") channels: a toned or faded print keeps almost nothing in its colour separations (magenta 0–9%
  // on a sepia print), so each is stretched from its own 0.5% to 99.5% to show the faint differences (stains, fading,
  // toning, the ghost of a colour) as a full-range map, like the false colour of telescope pictures
  function stretch(v, lo = 0.005, hi = 0.995) {
    const h = new Uint32Array(1024); for (let i = 0; i < v.length; i++) h[Math.min(1023, Math.max(0, Math.round(v[i] * 1023)))]++;
    let c = 0, a = 0, b = 1023; const n = v.length; for (let i = 0; i < 1024; i++) { c += h[i]; if (c >= n * lo) { a = i; break; } }
    c = 0; for (let i = 1023; i >= 0; i--) { c += h[i]; if (c >= n * (1 - hi)) { b = i; break; } }
    const A = a / 1023, B = Math.max(A + 1 / 255, b / 1023), o = new Float32Array(v.length); for (let i = 0; i < v.length; i++) o[i] = Math.max(0, Math.min(1, (v[i] - A) / (B - A)));
    o.range = [A, B]; return o;
  }
  CHANNELS.filter(([id]) => ['cyan', 'magenta', 'yellow', 'labA', 'labB'].includes(id)).forEach(([id, name, f]) => LIST.push({ id: id + 'S', name: name.replace(/ \(.*\)/, '') + ', stretched', group: 'Channels, stretched', grey: true,
    what: `The ${name.toLowerCase()} stretched to its own full range, so faint differences show (on a faded or toned print this channel may hold only a few percent).`, make: (img) => stretch(ch(f)(img)) }));
  // extreme greyscale: lightness with its contrast pushed to the limit, area by area, so faint marks and detail show
  LIST.push({ id: 'extreme', name: 'Extreme greyscale', group: 'Channels', grey: true, what: 'Lightness with the contrast pushed to the limit in every area: scratches, creases, faint detail and stains stand out.',
    make: (img) => { const W = img.width, H = img.height, L = ch((r, g, b) => lab(r, g, b)[0] / 100)(img), R = scaleR(img, 0.03), m = box(L, W, H, R), sd = localStd(L, W, H, R); return L.map((v, i) => Math.max(0, Math.min(1, 0.5 + (v - m[i]) / (2.5 * sd[i] + 0.01)))); } });
  // black and white at the threshold that best splits the picture into two groups (Otsu's method)
  LIST.push({ id: 'bw', name: 'Black and white', group: 'Channels', grey: true, what: 'Two values only, split at the level that best separates the picture into dark and light (Otsu’s method): clean shapes for masking or tracing.',
    make: (img) => { const L = lumOf(img), h = new Float64Array(256); L.forEach((v) => h[Math.min(255, Math.round(v * 255))]++); const N = L.length; let sum = 0; for (let i = 0; i < 256; i++) sum += i * h[i]; let sB = 0, wB = 0, best = 0, th = 128; for (let t = 0; t < 256; t++) { wB += h[t]; if (!wB) continue; const wF = N - wB; if (!wF) break; sB += t * h[t]; const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) ** 2; if (v > best) { best = v; th = t; } } return L.map((v) => (v * 255 > th ? 1 : 0)); } });
  if (IC.faces) IC.faces.PARTS.forEach(([part, name]) => LIST.push({ id: 'f_' + part, name, group: 'Faces (AI)', needsFaces: true, what: `${name}, from the face finder (478 points on each face; nothing is redrawn). The first use downloads it (about 4 MB).`, make: (img) => IC.faces.partMask(img, IC.faces.known(img), part) }));
  // ------------------------------------------------------------------ AI: things found by what they are (CLIPSeg)
  // The colour rules above judge by colour, so a sepia or colour-cast print fools them (everything is skin-coloured,
  // nothing is green). These ask a model that knows what sky, grass and people look like; its coarse answer (352 × 352)
  // is then snapped to the picture's own edges with a guided filter.
  const findMemo = new WeakMap(); // picture → Map(words → 352² map)
  const SCENE = [['sky', 'Sky', 'the sky'], ['trees', 'Trees and bushes', 'trees and bushes'], ['grass', 'Grass and lawn', 'grass'], ['flowers', 'Flowers', 'flowers'], ['people', 'People', 'a person'], ['clothes', 'Clothes', 'clothes'], ['hair', 'Hair', 'hair'], ['buildings', 'Buildings and walls', 'a building'], ['ground', 'Road, path and ground', 'the road and ground'], ['vehicles', 'Cars and bikes', 'a car or motorbike'], ['water', 'Water', 'water']];
  function found(img, words) {
    const fm = findMemo.get(img), r = fm && fm.get(words); const W = img.width, H = img.height;
    if (!r) return new Float32Array(W * H);
    // the coarse map, enlarged smoothly, then snapped to the picture's edges
    const o = new Float32Array(W * H), fx = r.w / W, fy = r.h / H;
    for (let y = 0; y < H; y++) { const sy = Math.min(r.h - 1, Math.max(0, (y + 0.5) * fy - 0.5)), y0 = Math.floor(sy), y1 = Math.min(r.h - 1, y0 + 1), ty = sy - y0;
      for (let x = 0; x < W; x++) { const sx = Math.min(r.w - 1, Math.max(0, (x + 0.5) * fx - 0.5)), x0 = Math.floor(sx), x1 = Math.min(r.w - 1, x0 + 1), tx = sx - x0, m = r.m;
        o[y * W + x] = (m[y0 * r.w + x0] * (1 - tx) + m[y0 * r.w + x1] * tx) * (1 - ty) + (m[y1 * r.w + x0] * (1 - tx) + m[y1 * r.w + x1] * tx) * ty; } }
    const q = IC.filters.guidedBy(lumOf(img), o, W, H, scaleR(img, 0.012), 0.0004);
    // the model's certainty is modest (0.3 is a clear yes): stretched so a clear yes is white; nothing there stays dark
    const sorted = Float32Array.from(q).sort(), top = Math.max(0.25, sorted[Math.floor(sorted.length * 0.995)]), lo = 0.06;
    return q.map((v) => Math.max(0, Math.min(1, (v - lo) / (top - lo))));
  }
  SCENE.forEach(([id, name, words]) => LIST.push({ id: 's_' + id, name, group: 'Scene (AI)', needsFind: [words], what: `${name}, recognised by what it is, not by colour (works on sepia, black-and-white and faded prints). The first use downloads the finder (CLIPSeg, Apache-2.0, about 139 MB).`, make: (img) => found(img, words) }));
  // skin, learned from this picture's own faces: the colour of the cheeks and forehead the face finder found, looked for
  // nearby (necks, arms, hands), so a colour cast or a sepia tone does not matter
  const labOf = (r, g, b) => lab(r / 255, g / 255, b / 255);
  LIST.push({ id: 'skinface', name: 'Skin (learned from the faces)', group: 'Faces (AI)', needsFaces: true, what: 'The skin colour of the faces in this picture, found again on necks, arms and hands nearby. Works with any colour cast or tone.',
    make: (img) => {
      const W = img.width, H = img.height, o = new Float32Array(W * H), faces = IC.faces && IC.faces.known(img); if (!faces || !faces.length) return o;
      const sk = IC.faces.partMask(img, faces, 'skin'), d = img.data; let n = 0; const S = [0, 0, 0], Q = [0, 0, 0];
      for (let p = 0; p < W * H; p += 2) if (sk[p] > 0.6) { const v = labOf(d[p * 4], d[p * 4 + 1], d[p * 4 + 2]); for (let c = 0; c < 3; c++) { S[c] += v[c]; Q[c] += v[c] * v[c]; } n++; }
      if (n < 20) return o;
      const mu = S.map((s) => s / n), sd = Q.map((q, c) => Math.max([8, 2.5, 2.5][c], Math.sqrt(Math.max(0, q / n - mu[c] * mu[c])) * 1.6));
      const boxes = faces.map((f) => ({ x: f.box[0], y: f.box[1], w: f.box[2] - f.box[0], h: f.box[3] - f.box[1] })), reach = (x, y) => { let best = 0; for (const b of boxes) { const cx = b.x + b.w / 2, cy = b.y + b.h * 0.9, dx = (x - cx) / (b.w * 1.6), dy = (y - cy) / (b.h * 2.6), r = dx * dx + (dy < 0 ? 4 * dy * dy : dy * dy); best = Math.max(best, Math.exp(-1.5 * r)); } return best; };
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = y * W + x, v = labOf(d[p * 4], d[p * 4 + 1], d[p * 4 + 2]); let e = 0; for (let c = 0; c < 3; c++) { const z = (v[c] - mu[c]) / sd[c]; e += z * z; } o[p] = Math.max(sk[p], Math.exp(-0.5 * e) * reach(x, y)); }
      return box(o, W, H, 1);
    } });
  // the main subject and the background (the cut-out AI: U²-Net, or BEN2 when chosen): restore each its own way; the
  // background is not what matters, but it gives colour hints
  const cutMemo = new WeakMap();
  function subjectOf(img) {
    const r = cutMemo.get(img), W = img.width, H = img.height, o = new Float32Array(W * H); if (!r) return o;
    const fx = r.W / W, fy = r.H / H;
    for (let y = 0; y < H; y++) { const sy = Math.min(r.H - 1, Math.max(0, (y + 0.5) * fy - 0.5)), y0 = Math.floor(sy), y1 = Math.min(r.H - 1, y0 + 1), ty = sy - y0;
      for (let x = 0; x < W; x++) { const sx = Math.min(r.W - 1, Math.max(0, (x + 0.5) * fx - 0.5)), x0 = Math.floor(sx), x1 = Math.min(r.W - 1, x0 + 1), tx = sx - x0, a = r.a;
        o[y * W + x] = ((a[y0 * r.W + x0] * (1 - tx) + a[y0 * r.W + x1] * tx) * (1 - ty) + (a[y1 * r.W + x0] * (1 - tx) + a[y1 * r.W + x1] * tx) * ty) / 255; } }
    return o;
  }
  LIST.push({ id: 'subject', name: 'Main subject', group: 'Subject (AI)', needsCut: true, what: 'The main subject (people, an animal, an object), found by the cut-out AI. Restore it with care.', make: (img) => subjectOf(img) });
  LIST.push({ id: 'background', name: 'Background', group: 'Subject (AI)', needsCut: true, what: 'Everything but the main subject: it can take stronger clean-up, and gives colour hints.', make: (img) => subjectOf(img).map((v) => 1 - v) });
  // anything named: "the motorbike\", "a tear in the paper", "flowers" (added from the Maps tab)
  function addFind(text) {
    const words = String(text).trim().slice(0, 80); if (!words) return null; const id = 'q:' + words.toLowerCase();
    if (!byId[id]) { const m = { id, name: `“${words}”`, group: 'Found by name (AI)', needsFind: [words], what: `Where the picture shows “${words}”, found by the AI finder.`, make: (img) => found(img, words) }; LIST.push(m); byId[id] = m; }
    return id;
  }
  // colour rules cannot see on a picture whose colours all lean one way (sepia, a strong cast): measured once
  const castMemo = new WeakMap();
  function castRatio(img) {
    if (castMemo.has(img)) return castMemo.get(img);
    const d = img.data, n = img.width * img.height, st = Math.max(1, Math.floor(n / 40000)); let k = 0, sa = 0, sb = 0, qa = 0, qb = 0;
    for (let p = 0; p < n; p += st) { const r = d[p * 4], g = d[p * 4 + 1], b = d[p * 4 + 2], a = r - g, y = 0.5 * (r + g) - b; sa += a; sb += y; qa += a * a; qb += y * y; k++; }
    const ma = sa / k, mb = sb / k, sd = Math.sqrt(Math.max(0, qa / k - ma * ma) + Math.max(0, qb / k - mb * mb)), v = Math.hypot(ma, mb) / Math.max(1, sd);
    castMemo.set(img, v); return v;
  }
  const colourBlind = (img) => castRatio(img) > 1.2 || (IC.filters.isToned && IC.filters.isToned(img));
  const byId = Object.fromEntries(LIST.map((m) => [m.id, m]));

  // maps are remembered for the picture they were made from (the same ImageData object)
  const memo = new WeakMap();
  function make(id, img) {
    let m = memo.get(img); if (!m) { m = {}; memo.set(img, m); }
    if (!known(id, img)) return byId[id].make(img); // the AI has not looked yet: an empty map, not remembered
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
    // anything a map needs first (the face finder looks at the picture once)
  async function prepare(ids, img) {
    const want = new Set();
    for (const id of [].concat(ids)) { const m = id && byId[id]; if (!m) continue; if (m.needsFaces) await IC.faces.ensure(img); if (m.needsFind) m.needsFind.forEach((w) => want.add(w)); if (m.needsCut && !cutMemo.has(img)) { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').putImageData(img, 0, 0); cutMemo.set(img, await CRAFTAI.cutout(c)); } }
    if (!want.size) return;
    let fm = findMemo.get(img); if (!fm) { fm = new Map(); findMemo.set(img, fm); }
    // the scene words go together the first time (one look at the picture, about 15 seconds)
    const missing = [...want].filter((w) => !fm.has(w)); if (!missing.length) return;
    if (missing.some((w) => SCENE.some((s) => s[2] === w))) SCENE.forEach((s) => { if (!fm.has(s[2]) && !missing.includes(s[2])) missing.push(s[2]); });
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').putImageData(img, 0, 0);
    const r = await CRAFTAI.find(c, missing); missing.forEach((w, i) => fm.set(w, { w: r.w, h: r.h, m: r.maps[i] }));
  }
  const known = (id, img) => { const m = byId[id]; if (!m) return false; if (m.needsFaces && !IC.faces.known(img)) return false; if (m.needsCut && !cutMemo.has(img)) return false; if (m.needsFind) { const fm = findMemo.get(img); return !!fm && m.needsFind.every((w) => fm.has(w)); } return true; };
  // a smaller copy (thumbnails) shares what the AI found in the full picture
  const share = (from, to) => { if (findMemo.has(from)) findMemo.set(to, findMemo.get(from)); if (cutMemo.has(from)) cutMemo.set(to, cutMemo.get(from)); };
  // a gap filled smoothly from what is around it (push–pull: averaged down a pyramid, then filled back up): a guess, for colour hints only
  function fillGap(img, hole) {
    const W = img.width, H = img.height, levels = []; let w = W, h = H, C = new Float32Array(W * H * 4); const s = img.data;
    for (let p = 0; p < W * H; p++) { const k = 1 - hole[p]; for (let c = 0; c < 3; c++) C[p * 4 + c] = s[p * 4 + c] * k; C[p * 4 + 3] = k; }
    levels.push([C, w, h]);
    while (w > 1 || h > 1) { const w2 = Math.max(1, w >> 1), h2 = Math.max(1, h >> 1), D = new Float32Array(w2 * h2 * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const q = (Math.min(h2 - 1, y >> 1) * w2 + Math.min(w2 - 1, x >> 1)) * 4, p = (y * w + x) * 4; for (let c = 0; c < 4; c++) D[q + c] += C[p + c]; } C = D; w = w2; h = h2; levels.push([C, w, h]); }
    for (let l = levels.length - 2; l >= 0; l--) { const [F, fw, fh] = levels[l], [G, gw, gh] = levels[l + 1]; for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) { const p = (y * fw + x) * 4, a = F[p + 3]; if (a >= 0.999) continue; const t = 1 - Math.min(1, a), sx = Math.min(gw - 1, Math.max(0, (x + 0.5) / 2 - 0.5)), sy = Math.min(gh - 1, Math.max(0, (y + 0.5) / 2 - 0.5)), x0 = Math.floor(sx), y0 = Math.floor(sy), x1 = Math.min(gw - 1, x0 + 1), y1 = Math.min(gh - 1, y0 + 1), tx = sx - x0, ty = sy - y0; // the coarser level, read smoothly (bilinear), as colour per weight
        const at = (xx, yy, c) => { const q = (yy * gw + xx) * 4; return G[q + c] / Math.max(1e-6, G[q + 3]); }; for (let c = 0; c < 3; c++) F[p + c] += ((at(x0, y0, c) * (1 - tx) + at(x1, y0, c) * tx) * (1 - ty) + (at(x0, y1, c) * (1 - tx) + at(x1, y1, c) * tx) * ty) * t; F[p + 3] = a + t; } }
    const out = new ImageData(W, H), d = out.data, F = levels[0][0]; for (let p = 0; p < W * H; p++) { const a = Math.max(1e-6, F[p * 4 + 3]); for (let c = 0; c < 3; c++) d[p * 4 + c] = Math.round(F[p * 4 + c] / a); d[p * 4 + 3] = 255; } return out;
  }
  // false colour: the stretched cyan, magenta and yellow inked again as a picture (black left out)
  function falseColour(img, { amount = 100 } = {}) {
    const n = img.width * img.height, sep = [0, 1, 2].map((i) => stretch(ch((r, g, b) => cmyk(r, g, b, i))(img))), K = ch((r, g, b) => cmyk(r, g, b, 3))(img), out = new ImageData(img.width, img.height), d = out.data, s = img.data, k = amount / 100;
    const ranges = sep.map((v) => v.range);
    for (let p = 0; p < n; p++) { const o = p * 4, kk = 1 - 0.5 * K[p]; for (let c = 0; c < 3; c++) d[o + c] = Math.round(s[o + c] * (1 - k) + 255 * (1 - sep[c][p]) * kk * k); d[o + 3] = s[o + 3]; }
    out.ranges = ranges; return out;
  }
  // ------------------------------------------------------------------ damage, found for repair
  // Found automatically only where it can be told from detail with confidence (on test photos a looser finder marked
  // 20–67% of the picture, hair and faces included): specks (the speck finder: isolated pixels beyond all but one of
  // their neighbours), white or black flecks and thin scratches (pure, colourless, and narrower than 7 pixels: what a
  // small opening or closing takes away), and an orange date stamp near the bottom. Tears and flaking are marked by
  // hand (paint, or click and the AI outlines them).
  function minMax(A, W, H, r, isMax) {
    const t = new Float32Array(A.length), o = new Float32Array(A.length);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let m = isMax ? -1e9 : 1e9; for (let i = Math.max(0, x - r); i <= Math.min(W - 1, x + r); i++) { const v = A[y * W + i]; m = isMax ? Math.max(m, v) : Math.min(m, v); } t[y * W + x] = m; }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let m = isMax ? -1e9 : 1e9; for (let j = Math.max(0, y - r); j <= Math.min(H - 1, y + r); j++) { const v = t[j * W + x]; m = isMax ? Math.max(m, v) : Math.min(m, v); } o[y * W + x] = m; }
    return o;
  }
  function damage(img, { specks = true, flecks = false, stamp = false, level = 50 } = {}) {
    const W = img.width, H = img.height, n = W * H, d = img.data, o = new Float32Array(n), k = 1.6 - level / 100;
    if (specks) { const f = IC.restore.impulse(img, { threshold: Math.round(30 * k + 5) }).data; for (let p = 0; p < n; p++) if (Math.abs(f[p * 4] - d[p * 4]) + Math.abs(f[p * 4 + 1] - d[p * 4 + 1]) + Math.abs(f[p * 4 + 2] - d[p * 4 + 2]) > 6) o[p] = 1; }
    if (flecks) {
      const L = new Float32Array(n), C = new Float32Array(n); for (let p = 0; p < n; p++) { const r = d[p * 4], g = d[p * 4 + 1], b = d[p * 4 + 2]; L[p] = 0.299 * r + 0.587 * g + 0.114 * b; C[p] = Math.max(r, g, b) - Math.min(r, g, b); }
      const nz = IC.restore.noiseLevel ? IC.restore.noiseLevel(img).luma : 3, t = Math.max(30, nz * 6) * k, open = minMax(minMax(L, W, H, 3, false), W, H, 3, true), close = minMax(minMax(L, W, H, 3, true), W, H, 3, false);
      for (let p = 0; p < n; p++) if (C[p] < 35 && ((L[p] > 205 && L[p] - open[p] > t) || (L[p] < 45 && close[p] - L[p] > t))) o[p] = 1;
    }
    if (stamp) for (let y = Math.floor(H * 0.65); y < H; y++) for (let x = 0; x < W; x++) { const p = y * W + x, r = d[p * 4] / 255, g = d[p * 4 + 1] / 255, b = d[p * 4 + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx < 0.5 || mx - mn < 0.5 * mx) continue; let h = mx === r ? ((g - b) / (mx - mn)) * 60 : mx === g ? (2 + (b - r) / (mx - mn)) * 60 : (4 + (r - g) / (mx - mn)) * 60; if (h < 0) h += 360; if (h < 45 || h > 330) o[p] = 1; }
    return o;
  }
  // a mask grown by r pixels (anything near a marked pixel is marked)
  const grow = (M, W, H, r) => (r > 0 ? box(M, W, H, r).map((v) => (v > 0.001 ? 1 : 0)) : M);
    // Telea's fast-marching inpainting (2004): the gap is filled from its edge inwards, nearest first; each pixel takes a
  // weighted mean of the known pixels within a few pixels, each continued by its own slope (value + gradient · offset),
  // weighted towards the direction the fill is moving, to nearer pixels, and to pixels on the same "level" of the
  // march. Good for thin cracks, scratches and specks; wide holes need the AI.
  function telea(img, hole, R = 5, slope = 1) {
    const W = img.width, H = img.height, n = W * H, s = img.data, F = new Float32Array(n * 3), T = new Float32Array(n).fill(1e6), flag = new Uint8Array(n); // 0 known, 1 band, 2 unknown
    for (let p = 0; p < n; p++) { for (let c = 0; c < 3; c++) F[p * 3 + c] = s[p * 4 + c]; if (hole[p] > 0.5) flag[p] = 2; }
    // the band: unknown pixels next to a known one
    const heap = [], push = (t, p) => { heap.push([t, p]); let i = heap.length - 1; while (i > 0) { const j = (i - 1) >> 1; if (heap[j][0] <= heap[i][0]) break; [heap[i], heap[j]] = [heap[j], heap[i]]; i = j; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[i], heap[m]] = [heap[m], heap[i]]; i = m; } } return top; };
    for (let p = 0; p < n; p++) if (flag[p] === 0) { T[p] = 0; const x = p % W, y = (p / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const u = x + dx, v = y + dy; if (u >= 0 && v >= 0 && u < W && v < H && flag[v * W + u] === 2) { flag[p] = 1; push(0, p); break; } } }
    for (let p = 0; p < n; p++) if (flag[p] === 1) flag[p] = 0; // known pixels stay known; the heap holds the edge
    const solve = (a, b, c, d) => { // the march's arrival time from two neighbours (eikonal)
      let r = 1e6; const t1 = a, t2 = b; if (Math.min(t1, t2) >= 1e6) return Math.min(c, d) + 1;
      const s2 = 2 - (t1 - t2) * (t1 - t2); if (s2 > 0) r = (t1 + t2 + Math.sqrt(s2)) / 2; else r = Math.min(t1, t2) + 1; return r; };
    const tAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 1e6 : T[y * W + x]);
    const gradOf = (q, c) => { const x = q % W, y = (q / W) | 0, k = (u, v) => (u >= 0 && v >= 0 && u < W && v < H && flag[v * W + u] !== 2 ? v * W + u : -1); const xr = k(x + 1, y), xl = k(x - 1, y), yd = k(x, y + 1), yu = k(x, y - 1);
      const gx = xr >= 0 && xl >= 0 ? (F[xr * 3 + c] - F[xl * 3 + c]) / 2 : xr >= 0 ? F[xr * 3 + c] - F[q * 3 + c] : xl >= 0 ? F[q * 3 + c] - F[xl * 3 + c] : 0;
      const gy = yd >= 0 && yu >= 0 ? (F[yd * 3 + c] - F[yu * 3 + c]) / 2 : yd >= 0 ? F[yd * 3 + c] - F[q * 3 + c] : yu >= 0 ? F[q * 3 + c] - F[yu * 3 + c] : 0; return [gx, gy]; };
    while (heap.length) {
      const [, p] = pop(); const x = p % W, y = (p / W) | 0; if (flag[p] === 3) continue; flag[p] = 3; // 0 known, 1 filled and waiting, 2 still to fill, 3 done
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const u = x + dx, v = y + dy; if (u < 0 || v < 0 || u >= W || v >= H) continue; const q = v * W + u; if (flag[q] !== 2) continue;
        const t = Math.min(solve(tAt(u - 1, v), tAt(u, v - 1), tAt(u + 1, v), tAt(u, v + 1)), solve(tAt(u + 1, v), tAt(u, v - 1), 1e6, 1e6), solve(tAt(u - 1, v), tAt(u, v + 1), 1e6, 1e6), solve(tAt(u + 1, v), tAt(u, v + 1), 1e6, 1e6));
        T[q] = Math.min(T[q], t);
        // fill q from the known pixels round it
        const gTx = (tAt(u + 1, v) < 1e6 && tAt(u - 1, v) < 1e6 ? (tAt(u + 1, v) - tAt(u - 1, v)) / 2 : 0), gTy = (tAt(u, v + 1) < 1e6 && tAt(u, v - 1) < 1e6 ? (tAt(u, v + 1) - tAt(u, v - 1)) / 2 : 0);
        const acc = [0, 0, 0]; let ws = 0;
        for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
          const a = u + i, b = v + j; if (a < 0 || b < 0 || a >= W || b >= H) continue; const k = b * W + a; if (flag[k] === 2 || (i === 0 && j === 0)) continue; const d2 = i * i + j * j; if (d2 > R * R) continue;
          const dir = Math.max(1e-6, Math.abs((-i * gTx - j * gTy) / Math.sqrt(d2))), dst = 1 / d2, lev = 1 / (1 + Math.abs(T[q] - T[k])), w = dir * dst * lev;
          for (let c = 0; c < 3; c++) { const [gx, gy] = gradOf(k, c); acc[c] += w * (F[k * 3 + c] + slope * (gx * -i + gy * -j)); } ws += w;
        }
        if (ws > 0) for (let c = 0; c < 3; c++) F[q * 3 + c] = acc[c] / ws;
        flag[q] = 1; push(T[q], q);
      }
    }
    const out = new ImageData(new Uint8ClampedArray(s), W, H), d = out.data; for (let p = 0; p < n; p++) if (hole[p] > 0.5) for (let c = 0; c < 3; c++) d[p * 4 + c] = Math.round(F[p * 3 + c]);
    return out;
  }
  IC.maps = { telea, damage, grow, fillGap, addFind, known, share, castRatio, colourBlind, stretch, falseColour, LIST, make, heat, grey, mask, apply, box, combined, OPS, prepare };
})();

/* ImageCraft resampling (IC.resample): high-quality resizing, written here from the well-known methods.
   Lessons taken from how GIMP scales (its documentation; none of its code):
   - work in linear light: averaging sRGB numbers darkens edges and fine detail, averaging light does not;
   - see-through parts are averaged with their colour weighted by how solid they are (premultiplied), so no dark fringes;
   - shrinking is real pixel averaging: every source pixel under an output pixel counts, by how much of it is covered;
   - enlarging with a sharp filter rings (light and dark halos beside edges), so the result is held between the
     lightest and darkest of the nearby source pixels ("no halo"), keeping the sharpness without the halos.
     resize(img, W, H, { method, linear = true }) → ImageData
   methods: 'auto' (no-halo Lanczos to enlarge, averaging Mitchell to shrink), 'area' (exact pixel averaging), 'nohalo',
            'lanczos', 'cubic' (Catmull-Rom), 'mitchell' (soft, no ringing), 'linear', 'nearest' */
(function () {
  'use strict';
  const IC = (window.IC = window.IC || {});
  // sRGB ↔ linear light
  const TO_LIN = new Float32Array(256); for (let i = 0; i < 256; i++) { const c = i / 255; TO_LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  const OUT_N = 8192, TO_SRGB = new Uint8ClampedArray(OUT_N + 1); for (let i = 0; i <= OUT_N; i++) { const l = i / OUT_N; TO_SRGB[i] = Math.round(255 * (l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055)); }

  const sinc = (x) => { if (x === 0) return 1; const p = Math.PI * x; return Math.sin(p) / p; };
  const cubicBC = (B, C) => (x) => { x = Math.abs(x); if (x < 1) return ((12 - 9 * B - 6 * C) * x ** 3 + (-18 + 12 * B + 6 * C) * x * x + (6 - 2 * B)) / 6; if (x < 2) return ((-B - 6 * C) * x ** 3 + (6 * B + 30 * C) * x * x + (-12 * B - 48 * C) * x + (8 * B + 24 * C)) / 6; return 0; };
  const KERNELS = {
    linear: { r: 1, f: (x) => Math.max(0, 1 - Math.abs(x)) },
    cubic: { r: 2, f: cubicBC(0, 0.5) },
    mitchell: { r: 2, f: cubicBC(1 / 3, 1 / 3) },
    lanczos: { r: 3, f: (x) => (Math.abs(x) < 3 ? sinc(x) * sinc(x / 3) : 0) },
  };

  // for each output position along one axis: which source pixels count, and how much
  function weights(src, dst, kind) {
    const scale = src / dst, out = [];
    if (kind === 'area' || kind === 'nearest') {
      for (let o = 0; o < dst; o++) {
        if (kind === 'nearest') { out.push([[Math.min(src - 1, Math.floor((o + 0.5) * scale))], [1]]); continue; }
        const a = o * scale, b = a + scale, idx = [], w = []; let t = 0;
        // the output pixel's footprint on the source; each source pixel counts by how much of it is covered
        // (enlarging, this gives square pixels with soft one-pixel seams: the "sharp bilinear" look)
        for (let i = Math.floor(a); i < Math.ceil(b) && i < src; i++) { const cov = Math.min(b, i + 1) - Math.max(a, i); if (cov > 0) { idx.push(i); w.push(cov); t += cov; } }
        out.push([idx, w.map((v) => v / t)]);
      }
      return out;
    }
    const K = KERNELS[kind], wide = Math.max(1, scale), sup = K.r * wide; // shrinking widens the filter: it averages
    for (let o = 0; o < dst; o++) {
      const c = (o + 0.5) * scale - 0.5, i0 = Math.floor(c - sup) + 1, i1 = Math.floor(c + sup), idx = [], w = []; let t = 0;
      for (let i = i0; i <= i1; i++) { const v = K.f((i - c) / wide); if (!v) continue; idx.push(Math.min(src - 1, Math.max(0, i))); w.push(v); t += v; }
      out.push([idx, w.map((v) => v / t)]);
    }
    return out;
  }

  function resize(img, W, H, { method = 'auto', linear = true } = {}) {
    W = Math.max(1, Math.round(W)); H = Math.max(1, Math.round(H));
    const sw = img.width, sh = img.height, up = W >= sw && H >= sh;
    let kind = method, halo = false;
    if (method === 'auto') { kind = up ? 'lanczos' : 'mitchell'; halo = up; }
    if (method === 'nohalo') { kind = 'lanczos'; halo = true; }
    // the source as light (or plain numbers), premultiplied by how solid each pixel is
    const s = img.data, n = sw * sh, src = new Float32Array(n * 4), lin = linear && kind !== 'nearest';
    for (let p = 0, i = 0; p < n; p++, i += 4) { const a = s[i + 3] / 255; src[i] = (lin ? TO_LIN[s[i]] : s[i] / 255) * a; src[i + 1] = (lin ? TO_LIN[s[i + 1]] : s[i + 1] / 255) * a; src[i + 2] = (lin ? TO_LIN[s[i + 2]] : s[i + 2] / 255) * a; src[i + 3] = a; }
    // across, then down
    const wx = weights(sw, W, kind), wy = weights(sh, H, kind), mid = new Float32Array(W * sh * 4), out = new Float32Array(W * H * 4);
    for (let y = 0; y < sh; y++) {
      const row = y * sw * 4, orow = y * W * 4;
      for (let x = 0; x < W; x++) { const [idx, w] = wx[x]; let r = 0, g = 0, b = 0, a = 0; for (let k = 0; k < idx.length; k++) { const j = row + idx[k] * 4, v = w[k]; r += src[j] * v; g += src[j + 1] * v; b += src[j + 2] * v; a += src[j + 3] * v; } const o = orow + x * 4; mid[o] = r; mid[o + 1] = g; mid[o + 2] = b; mid[o + 3] = a; }
    }
    for (let y = 0; y < H; y++) {
      const [idx, w] = wy[y], orow = y * W * 4;
      for (let x = 0; x < W; x++) { let r = 0, g = 0, b = 0, a = 0; for (let k = 0; k < idx.length; k++) { const j = (idx[k] * W + x) * 4, v = w[k]; r += mid[j] * v; g += mid[j + 1] * v; b += mid[j + 2] * v; a += mid[j + 3] * v; } const o = orow + x * 4; out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = a; }
    }
    // no halo: each output held between the darkest and lightest of the 2 × 2 source pixels it sits among
    if (halo) {
      const fx = sw / W, fy = sh / H;
      for (let y = 0; y < H; y++) {
        const cy = (y + 0.5) * fy - 0.5, y0 = Math.max(0, Math.min(sh - 1, Math.floor(cy))), y1 = Math.min(sh - 1, y0 + 1);
        for (let x = 0; x < W; x++) {
          const cx = (x + 0.5) * fx - 0.5, x0 = Math.max(0, Math.min(sw - 1, Math.floor(cx))), x1 = Math.min(sw - 1, x0 + 1), o = (y * W + x) * 4;
          const q = [(y0 * sw + x0) * 4, (y0 * sw + x1) * 4, (y1 * sw + x0) * 4, (y1 * sw + x1) * 4];
          for (let c = 0; c < 4; c++) { let lo = src[q[0] + c], hi = lo; for (let k = 1; k < 4; k++) { const v = src[q[k] + c]; if (v < lo) lo = v; if (v > hi) hi = v; } const v = out[o + c]; out[o + c] = v < lo ? lo : v > hi ? hi : v; }
        }
      }
    }
    // back to sRGB numbers, colour divided by solidity again
    const res = new ImageData(W, H), d = res.data;
    for (let i = 0; i < out.length; i += 4) {
      const a = Math.max(0, Math.min(1, out[i + 3])); d[i + 3] = Math.round(a * 255); if (a <= 1e-6) continue;
      for (let c = 0; c < 3; c++) { const v = Math.max(0, Math.min(1, out[i + c] / a)); d[i + c] = lin ? TO_SRGB[Math.round(v * OUT_N)] : Math.round(v * 255); }
    }
    return res;
  }

  const METHODS = [['auto', 'Best (automatic)'], ['area', 'Pixel averaging (area)'], ['nohalo', 'Sharp, no halos (for enlarging)'], ['lanczos', 'Lanczos (sharpest)'], ['cubic', 'Cubic'], ['mitchell', 'Soft (Mitchell)'], ['linear', 'Linear']];
  IC.resample = { resize, METHODS, toLinear: TO_LIN };
})();

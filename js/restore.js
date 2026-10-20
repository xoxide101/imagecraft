/* ImageCraft restore (IC.restore): un-blurring an old or degraded picture.
   A degraded picture is modelled as  g = h * f + n : the true picture f, blurred by the blur h (how one point of light
   was spread: a soft old lens, out of focus, or a shaken camera), plus noise n. Wiener deconvolution undoes the blur in
   the frequency domain:  F = G · conj(H) / (|H|² + K),  where K stands for the noise: a bigger K trusts the picture
   less and sharpens more gently, so noise is not blown up.
   The work is done in linear light (where blur really happens), in overlapping tiles (so big pictures fit in memory),
   with mirrored edges (so the picture's borders do not ring).
     deblur(img, { kind: 'gauss' | 'disk' | 'motion', radius, length, angle, noise 0–100, strength 0–100 }) → ImageData
     psf(o) → the blur as a small picture (for showing what is being undone) */
(function () {
  'use strict';
  const IC = (window.IC = window.IC || {});

  // ------------------------------------------------------------------ FFT (radix 2, in place)
  function fft(re, im, inv) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = ((inv ? 2 : -2) * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang), h = len >> 1;
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < h; k++) {
          const a = i + k, b = a + h, xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
          re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
          const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
        }
      }
    }
    if (inv) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  }
  // 2-D: every row, then every column
  function fft2(re, im, P, Q, inv) {
    const rr = new Float64Array(P), ri = new Float64Array(P);
    for (let y = 0; y < Q; y++) { const o = y * P; for (let x = 0; x < P; x++) { rr[x] = re[o + x]; ri[x] = im[o + x]; } fft(rr, ri, inv); for (let x = 0; x < P; x++) { re[o + x] = rr[x]; im[o + x] = ri[x]; } }
    const cr = new Float64Array(Q), ci = new Float64Array(Q);
    for (let x = 0; x < P; x++) { for (let y = 0; y < Q; y++) { cr[y] = re[y * P + x]; ci[y] = im[y * P + x]; } fft(cr, ci, inv); for (let y = 0; y < Q; y++) { re[y * P + x] = cr[y]; im[y * P + x] = ci[y]; } }
  }
  const pow2 = (n) => { let p = 1; while (p < n) p <<= 1; return p; };

  // ------------------------------------------------------------------ the blur (point spread function)
  // as a list of [dx, dy, weight], centred on 0, adding up to 1
  function psfTaps({ kind = 'gauss', radius = 2, length = 10, angle = 0 } = {}) {
    const taps = [];
    if (kind === 'motion') {
      const L = Math.max(1, length), a = (angle * Math.PI) / 180, steps = Math.ceil(L * 4), m = new Map();
      for (let i = 0; i <= steps; i++) { const t = i / steps - 0.5, x = t * L * Math.cos(a), y = -t * L * Math.sin(a), x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
        [[x0, y0, (1 - fx) * (1 - fy)], [x0 + 1, y0, fx * (1 - fy)], [x0, y0 + 1, (1 - fx) * fy], [x0 + 1, y0 + 1, fx * fy]].forEach(([px, py, w]) => { const k = px + ',' + py; m.set(k, (m.get(k) || 0) + w); }); }
      m.forEach((w, k) => { const [x, y] = k.split(',').map(Number); taps.push([x, y, w]); });
    } else if (kind === 'disk') {
      const R = Math.max(0.5, radius), r = Math.ceil(R) + 1;
      for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) { let c = 0; for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) { const px = x - 0.375 + sx * 0.25, py = y - 0.375 + sy * 0.25; if (px * px + py * py <= R * R) c++; } if (c) taps.push([x, y, c / 16]); }
    } else {
      const s = Math.max(0.3, radius), r = Math.ceil(s * 3);
      for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) taps.push([x, y, Math.exp(-(x * x + y * y) / (2 * s * s))]);
    }
    const t = taps.reduce((a, b) => a + b[2], 0); taps.forEach((p) => { p[2] /= t; });
    return taps;
  }
  function psf(o) {
    const taps = psfTaps(o), r = Math.max(2, ...taps.map(([x, y]) => Math.max(Math.abs(x), Math.abs(y)))), n = r * 2 + 1, img = new ImageData(n, n), mx = Math.max(...taps.map((p) => p[2]));
    for (let i = 3; i < img.data.length; i += 4) img.data[i] = 255;
    taps.forEach(([x, y, w]) => { const i = ((y + r) * n + (x + r)) * 4, v = Math.round((w / mx) * 255); img.data[i] = img.data[i + 1] = img.data[i + 2] = v; });
    return img;
  }

  // ------------------------------------------------------------------ Wiener deconvolution
  const TO_LIN = new Float64Array(256); for (let i = 0; i < 256; i++) { const c = i / 255; TO_LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  const toS = (l) => 255 * (l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055);
  function deblur(img, o = {}) {
    const W = img.width, H = img.height, s = img.data, taps = psfTaps(o);
    const reach = Math.max(2, ...taps.map(([x, y]) => Math.max(Math.abs(x), Math.abs(y)))), pad = Math.min(128, reach * 3 + 4);
    const K = 0.0001 * Math.pow(10, (o.noise ?? 30) / 33), k = (o.strength ?? 100) / 100;
    const CORE = 384, P = pow2(Math.min(W, CORE) + pad * 2), Q = pow2(Math.min(H, CORE) + pad * 2);
    // the blur's spectrum, once (the same for every tile)
    const hr = new Float64Array(P * Q), hi = new Float64Array(P * Q);
    taps.forEach(([x, y, w]) => { hr[(((y % Q) + Q) % Q) * P + (((x % P) + P) % P)] += w; });
    fft2(hr, hi, P, Q, false);
    // the noise term: a constant K (Wiener) plus a gradient prior λ|∇|² (the MAP form, min |g − h∗f|² + λ|∇f|²), which
    // holds back the high frequencies where noise lives more than the middle ones where detail lives
    const lam = o.prior === false ? 0 : K * 6, den = new Float64Array(P * Q);
    for (let v = 0; v < Q; v++) { const sv = Math.sin((Math.PI * v) / Q) ** 2; for (let u = 0; u < P; u++) { const i = v * P + u, g2 = 4 * (Math.sin((Math.PI * u) / P) ** 2 + sv); den[i] = hr[i] * hr[i] + hi[i] * hi[i] + K + lam * g2; } }
    // the picture in linear light, one channel at a time
    const lin = [0, 1, 2].map((c) => { const a = new Float64Array(W * H); for (let p = 0; p < W * H; p++) a[p] = TO_LIN[s[p * 4 + c]]; return a; });
    const outL = [0, 1, 2].map(() => new Float64Array(W * H));
    const mirror = (v, n) => { if (n === 1) return 0; const m = 2 * n - 2; v = ((v % m) + m) % m; return v < n ? v : m - v; };
    const cw = P - pad * 2, chh = Q - pad * 2, re = new Float64Array(P * Q), im = new Float64Array(P * Q);
    for (let ty = 0; ty < H; ty += chh) for (let tx = 0; tx < W; tx += cw) {
      const ox = tx - pad, oy = ty - pad;
      for (let c = 0; c < 3; c++) {
        const L = lin[c];
        for (let y = 0; y < Q; y++) { const sy = mirror(oy + y, H); for (let x = 0; x < P; x++) { re[y * P + x] = L[sy * W + mirror(ox + x, W)]; im[y * P + x] = 0; } }
        fft2(re, im, P, Q, false);
        for (let i = 0; i < P * Q; i++) { const gr = re[i], gi = im[i], a = hr[i], b = -hi[i]; re[i] = (gr * a - gi * b) / den[i]; im[i] = (gr * b + gi * a) / den[i]; }
        fft2(re, im, P, Q, true);
        const O = outL[c];
        for (let y = 0; y < chh && ty + y < H; y++) for (let x = 0; x < cw && tx + x < W; x++) O[(ty + y) * W + tx + x] = re[(y + pad) * P + x + pad];
      }
    }
    // no halo: sharpening may not go past the lightest and darkest pixels near by (the blur's reach), so edges get
    // crisp without the light and dark rings deconvolution leaves beside them
    if (o.halo !== false) { const R = Math.max(1, Math.min(6, Math.round(o.kind === 'motion' ? (o.length || 10) / 2 : (o.radius || 2) * (o.kind === 'disk' ? 1 : 1.5)))); for (let c = 0; c < 3; c++) { const [lo, hi] = minMax(lin[c], W, H, R), O = outL[c], m = 0.04; for (let p = 0; p < W * H; p++) { const v = O[p], mm = (hi[p] - lo[p]) * m; O[p] = v < lo[p] - mm ? lo[p] - mm : v > hi[p] + mm ? hi[p] + mm : v; } } }
    const res = new ImageData(W, H), d = res.data;
    for (let p = 0; p < W * H; p++) {
      for (let c = 0; c < 3; c++) { const v = lin[c][p] + (outL[c][p] - lin[c][p]) * k; d[p * 4 + c] = toS(Math.max(0, Math.min(1, v))); }
      d[p * 4 + 3] = s[p * 4 + 3];
    }
    return res;
  }
  // Measure the blur: across the picture's strongest edges, how many pixels it takes to go from 10% to 90% of the step.
  // For a Gaussian blur that width is about 2.56 σ (a perfectly sharp edge still takes about one pixel).
  function measure(img) {
    const W = img.width, H = img.height, s = img.data, L = new Float32Array(W * H);
    for (let p = 0; p < W * H; p++) L[p] = 0.299 * s[p * 4] + 0.587 * s[p * 4 + 1] + 0.114 * s[p * 4 + 2];
    const at = (x, y) => L[Math.min(H - 1, Math.max(0, Math.round(y))) * W + Math.min(W - 1, Math.max(0, Math.round(x)))];
    const cand = [];
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) { const gx = L[y * W + x + 1] - L[y * W + x - 1], gy = L[(y + 1) * W + x] - L[(y - 1) * W + x], g = gx * gx + gy * gy; if (g > 400) cand.push([g, x, y, gx, gy]); }
    // (noise makes single-pixel gradients jump: the strongest are kept only one in each 4 × 4 square)
    { const seen = new Set(); cand.sort((a, b) => b[0] - a[0]); const keep = []; for (const c of cand) { const k = (c[1] >> 2) + ',' + (c[2] >> 2); if (!seen.has(k)) { seen.add(k); keep.push(c); } } cand.length = 0; cand.push(...keep.slice(0, 20000)); }
    const widths = [];
    for (const [, x, y, gx, gy] of cand.slice(0, 600)) {
      const n = Math.hypot(gx, gy), dx = gx / n, dy = gy / n, prof = [];
      // the profile across the edge, averaged over five parallel lines along it (noise averages out)
      for (let t = -12; t <= 12; t += 0.5) { let v = 0; for (let q = -2; q <= 2; q++) v += at(x + dx * t - dy * q, y + dy * t + dx * q); prof.push(v / 5); }
      const lo = Math.min(...prof.slice(0, 8)), hi = Math.max(...prof.slice(-8)); if (hi - lo < 30) continue;
      // monotonic enough to be one edge (not a thin line)
      let up = 0; for (let i = 1; i < prof.length; i++) if (prof[i] < prof[i - 1] - (hi - lo) * 0.12) up++; if (up > 2) continue;
      const a = lo + (hi - lo) * 0.1, b = lo + (hi - lo) * 0.9; let ta = null, tb = null;
      for (let i = 1; i < prof.length; i++) { if (ta === null && prof[i] >= a) ta = (i - 1) + (a - prof[i - 1]) / Math.max(1e-6, prof[i] - prof[i - 1]); if (tb === null && prof[i] >= b) tb = (i - 1) + (b - prof[i - 1]) / Math.max(1e-6, prof[i] - prof[i - 1]); }
      if (ta !== null && tb !== null) widths.push((tb - ta) * 0.5);
    }
    if (widths.length < 8) return null;
    widths.sort((a, b) => a - b); const w = widths[Math.floor(widths.length * 0.3)]; // the sharper edges: those are the blur itself, not soft things in the scene
    return { width: w, radius: Math.max(0.3, Math.sqrt(Math.max(0, w * w - 1.1)) / 2.56), edges: widths.length };
  }
  // Measure the noise from one picture (Immerkær's method): a small filter that cancels smooth shading and straight
  // edges leaves mostly noise; its average size gives the noise's standard deviation, in grey levels. Strong edges are
  // left out (they would count as noise). Brightness and colour are measured separately.
  function noiseLevel(img) {
    const W = img.width, H = img.height, s = img.data, N = W * H, Y = new Float32Array(N), C = new Float32Array(N);
    for (let p = 0; p < N; p++) { const r = s[p * 4], g = s[p * 4 + 1], b = s[p * 4 + 2]; Y[p] = 0.299 * r + 0.587 * g + 0.114 * b; C[p] = Math.abs((b - Y[p]) * 0.564) + Math.abs((r - Y[p]) * 0.713); }
    const one = (A) => {
      const vals = [], grads = [];
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const i = y * W + x, a = A[i - W - 1] - 2 * A[i - W] + A[i - W + 1] - 2 * A[i - 1] + 4 * A[i] - 2 * A[i + 1] + A[i + W - 1] - 2 * A[i + W] + A[i + W + 1];
        grads.push(Math.abs(A[i + 1] - A[i - 1]) + Math.abs(A[i + W] - A[i - W])); vals.push(Math.abs(a));
      }
      const g2 = grads.slice().sort((a, b) => a - b), lim = g2[Math.floor(g2.length * 0.9)]; let t = 0, n = 0;
      for (let i = 0; i < vals.length; i++) if (grads[i] <= lim) { t += vals[i]; n++; }
      return n ? Math.sqrt(Math.PI / 2) * (t / n) / 6 : 0;
    };
    return { luma: one(Y), chroma: one(C) * 0.7 };
  }
  // where the noise is: each pixel's difference from the middle value of its neighbours, as a local RMS, brightened
  function noiseMap(img) {
    const W = img.width, H = img.height, s = img.data, N = W * H, Y = new Float32Array(N), R2 = new Float32Array(N);
    for (let p = 0; p < N; p++) Y[p] = 0.299 * s[p * 4] + 0.587 * s[p * 4 + 1] + 0.114 * s[p * 4 + 2];
    const v = new Float32Array(9);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let k = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) v[k++] = Y[Math.min(H - 1, Math.max(0, y + dy)) * W + Math.min(W - 1, Math.max(0, x + dx))]; v.sort(); const d = Y[y * W + x] - v[4]; R2[y * W + x] = d * d; }
    const out = new ImageData(W, H), d = out.data, r = 3;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let t = 0, n = 0; for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) { const yy = y + dy, xx = x + dx; if (yy < 0 || xx < 0 || yy >= H || xx >= W) continue; t += R2[yy * W + xx]; n++; }
      const rms = Math.sqrt(t / n), val = Math.min(1, rms / 20), i = (y * W + x) * 4;
      // dark blue (little noise) → yellow (much), over a faint copy of the picture
      const g = Y[y * W + x] * 0.25; d[i] = g + val * 230; d[i + 1] = g + val * 200; d[i + 2] = g + (1 - val) * 120; d[i + 3] = 255;
    }
    return out;
  }
  // the smallest and largest value within R pixels (a square), across then down
  function minMax(a, W, H, R) {
    const pass = (src, horiz, fn) => { const out = new Float64Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = src[y * W + x]; for (let k = -R; k <= R; k++) { const xx = horiz ? Math.min(W - 1, Math.max(0, x + k)) : x, yy = horiz ? y : Math.min(H - 1, Math.max(0, y + k)), u = src[yy * W + xx]; v = fn(v, u); } out[y * W + x] = v; } return out; };
    return [pass(pass(a, true, Math.min), false, Math.min), pass(pass(a, true, Math.max), false, Math.max)];
  }
  // the blur applied (to try the model forwards: g = h * f, for testing and for showing what a setting means)
  function blurWith(img, o = {}) {
    const W = img.width, H = img.height, s = img.data, taps = psfTaps(o), res = new ImageData(W, H), d = res.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let r = 0, g = 0, b = 0;
      for (const [dx, dy, w] of taps) { const i = (Math.min(H - 1, Math.max(0, y + dy)) * W + Math.min(W - 1, Math.max(0, x + dx))) * 4; r += TO_LIN[s[i]] * w; g += TO_LIN[s[i + 1]] * w; b += TO_LIN[s[i + 2]] * w; }
      const i = (y * W + x) * 4; d[i] = toS(r); d[i + 1] = toS(g); d[i + 2] = toS(b); d[i + 3] = s[i + 3];
    }
    return res;
  }



  // ------------------------------------------------------------------ careful deblur (plug-and-play)
  // The idea of plug-and-play restoration (Zhang, Timofte and others): split  min |g − h∗f|² + prior(f)  into two easy
  // steps and alternate them a few times: (1) undo the blur, staying close to the current guess z
  //   F = (conj(H)·G + μ·Z) / (|H|² + μ)   (one FFT solve), then (2) clean that with a good denoiser (non-local means),
  // which plays the part of the prior. The denoiser starts strong and eases off, so noise never gets amplified.
  function deblurCareful(img, o = {}, say) {
    const W = img.width, H = img.height, s = img.data, taps = psfTaps(o);
    const reach = Math.max(2, ...taps.map(([x, y]) => Math.max(Math.abs(x), Math.abs(y)))), pad = Math.min(96, reach * 3 + 4);
    const P = pow2(W + pad * 2), Q = pow2(H + pad * 2);
    if (P * Q > 2048 * 2048) return deblur(img, o); // too big for one pass: the quick way
    const hr = new Float64Array(P * Q), hi = new Float64Array(P * Q);
    taps.forEach(([x, y, w]) => { hr[(((y % Q) + Q) % Q) * P + (((x % P) + P) % P)] += w; }); fft2(hr, hi, P, Q, false);
    const mirror = (v, n) => { if (n === 1) return 0; const m = 2 * n - 2; v = ((v % m) + m) % m; return v < n ? v : m - v; };
    const sigma = Math.max(1, o.sigma ?? noiseLevel(img).luma), iters = o.iters || 6;
    // the observed picture's spectrum, per colour (linear light, mirrored out to the FFT size)
    const G = [0, 1, 2].map((c) => { const re = new Float64Array(P * Q), im = new Float64Array(P * Q); for (let y = 0; y < Q; y++) { const sy = mirror(y - pad, H); for (let x = 0; x < P; x++) re[y * P + x] = TO_LIN[s[(sy * W + mirror(x - pad, W)) * 4 + c]]; } fft2(re, im, P, Q, false); return [re, im]; });
    let z = img;
    for (let it = 0; it < iters; it++) {
      const t = it / Math.max(1, iters - 1), sd = sigma * (o.sd0 ?? 1.6) * Math.pow((o.sd1 ?? 0.4), t), mu = (o.mu0 ?? 0.25) * Math.pow((o.mu1 ?? 0.3), t); // tuned on a blurred, noisy test picture
      say && say(`Careful deblur… ${it + 1} of ${iters}`);
      const x = new ImageData(W, H), xd = x.data, zd = z.data;
      for (let c = 0; c < 3; c++) {
        const re = new Float64Array(P * Q), im = new Float64Array(P * Q);
        for (let y = 0; y < Q; y++) { const sy = mirror(y - pad, H); for (let xx = 0; xx < P; xx++) re[y * P + xx] = TO_LIN[zd[(sy * W + mirror(xx - pad, W)) * 4 + c]]; }
        fft2(re, im, P, Q, false);
        const [gr, gi] = G[c];
        for (let i = 0; i < P * Q; i++) { const a = hr[i], b = hi[i], d = a * a + b * b + mu; const nr = a * gr[i] + b * gi[i] + mu * re[i], ni = a * gi[i] - b * gr[i] + mu * im[i]; re[i] = nr / d; im[i] = ni / d; }
        fft2(re, im, P, Q, true);
        for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) xd[(y * W + xx) * 4 + c] = toS(Math.max(0, Math.min(1, re[(y + pad) * P + xx + pad])));
      }
      for (let i = 3; i < xd.length; i += 4) xd[i] = s[i];
      const L = Math.max(0, Math.min(100, (1.7 * sd - 2) / 0.35));
      z = L > 1 ? nlm(x, { luma: L, chroma: Math.min(100, L * 1.3), patch: 1, search: 3 }) : x;
    }
    const k = (o.strength ?? 100) / 100; if (k >= 1) return z;
    const out = new ImageData(W, H); for (let i = 0; i < out.data.length; i++) out.data[i] = s[i] + (z.data[i] - s[i]) * k; return out;
  }


  // ------------------------------------------------------------------ specks: impulse noise (salt and pepper, dust)
  // After the hybrid adaptive / decision-based median filters (AMF + MDBMF): first decide which pixels are specks, then
  // repair only those, each from the median of its *clean* neighbours, in a window that grows (3 × 3 up to 11 × 11)
  // until there are enough of them. Clean pixels are never touched, so edges and detail stay exactly as they were.
  //   A speck: a pure black or white pixel (salt and pepper, as in damaged files), or a pixel that is the brightest or
  //   darkest of its 3 × 3 square by more than `threshold` against their middle value (dust and dropouts on scans).
  function impulse(img, { threshold = 20, extremes = true, maxWindow = 11 } = {}) {
    const W = img.width, H = img.height, s = img.data, N = W * H, L = new Float32Array(N), bad = new Uint8Array(N), v = new Float32Array(9);
    for (let p = 0; p < N; p++) L[p] = 0.299 * s[p * 4] + 0.587 * s[p * 4 + 1] + 0.114 * s[p * 4 + 2];
    // a picture full of pure black and white pixels (over 4%, beyond its real blacks and whites) is salt and pepper:
    // then every one of them is a speck, however many sit together
    const isExt = (i) => (s[i] <= 2 && s[i + 1] <= 2 && s[i + 2] <= 2) || (s[i] >= 253 && s[i + 1] >= 253 && s[i + 2] >= 253);
    let ext = 0; for (let p = 0; p < N; p++) if (isExt(p * 4)) ext++;
    const saltPepper = extremes && ext > N * 0.04;
    let count = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = y * W + x, i = p * 4;
      if (extremes && isExt(i)) {
        // a black or white pixel counts only if most of its neighbours are not the same (a real black area is not noise)
        let same = 0; const dark = s[i] <= 2; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const q = (Math.min(H - 1, Math.max(0, y + dy)) * W + Math.min(W - 1, Math.max(0, x + dx))) * 4; if (dark ? s[q] <= 2 && s[q + 1] <= 2 && s[q + 2] <= 2 : s[q] >= 253 && s[q + 1] >= 253 && s[q + 2] >= 253) same++; }
        // (in a salt-and-pepper picture specks crowd together, so only a mostly-same neighbourhood means a real area)
        if (same <= (saltPepper ? 4 : 3)) { bad[p] = 1; count++; continue; }
      }
      let k = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) v[k++] = L[Math.min(H - 1, Math.max(0, y + dy)) * W + Math.min(W - 1, Math.max(0, x + dx))];
      // brighter than all but one neighbour (or darker): two specks side by side still count
      const c = L[p], nb = [v[0], v[1], v[2], v[3], v[5], v[6], v[7], v[8]].sort((a, b) => a - b);
      if ((c > nb[6] || c < nb[1]) && Math.abs(c - (nb[3] + nb[4]) / 2) > threshold) { bad[p] = 1; count++; }
    }
    const out = new ImageData(new Uint8ClampedArray(s), W, H), d = out.data, ch = [[], [], []];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = y * W + x; if (!bad[p]) continue;
      let r = 1;
      for (; r <= (maxWindow >> 1); r++) {
        ch[0].length = ch[1].length = ch[2].length = 0;
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const yy = y + dy, xx = x + dx; if (yy < 0 || xx < 0 || yy >= H || xx >= W) continue; const q = yy * W + xx; if (bad[q]) continue; const j = q * 4; ch[0].push(s[j]); ch[1].push(s[j + 1]); ch[2].push(s[j + 2]); }
        if (ch[0].length >= Math.min(3, r * 2)) break;
      }
      const i = p * 4;
      if (ch[0].length) for (let c = 0; c < 3; c++) { const a = ch[c].sort((m, n) => m - n), m = a.length >> 1; d[i + c] = a.length & 1 ? a[m] : (a[m - 1] + a[m]) / 2; }
      else { // nothing clean in reach: the average of the repaired pixels already done above and to the left
        let t = [0, 0, 0], n = 0; for (const [dx, dy] of [[-1, 0], [0, -1], [-1, -1], [1, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W) continue; const j = (yy * W + xx) * 4; t[0] += d[j]; t[1] += d[j + 1]; t[2] += d[j + 2]; n++; }
        if (n) for (let c = 0; c < 3; c++) d[i + c] = t[c] / n;
      }
    }
    out.specks = count; return out;
  }

  // ------------------------------------------------------------------ Non-local means denoising
  // Each pixel is averaged with pixels anywhere nearby (a search square) whose surrounding patch looks alike, weighted by
  // how alike: textures and edges are averaged only with their own kind, so they stay while the grain goes. Brightness
  // and colour noise are treated separately (colour noise in old scans is blotchy and can be smoothed harder).
  // Patch distances for each offset come from a running-sum (integral) image, so the cost does not grow with the patch.
  function nlm(img, { luma = 40, chroma = 60, patch = 1, search = 5 } = {}) {
    const W = img.width, H = img.height, s = img.data, N = W * H;
    const Y = new Float32Array(N), Cb = new Float32Array(N), Cr = new Float32Array(N);
    for (let p = 0; p < N; p++) { const r = s[p * 4], g = s[p * 4 + 1], b = s[p * 4 + 2]; Y[p] = 0.299 * r + 0.587 * g + 0.114 * b; Cb[p] = (b - Y[p]) * 0.564; Cr[p] = (r - Y[p]) * 0.713; }
    const hY = 2 + luma * 0.35, hC = 2 + chroma * 0.5;
    const accY = new Float32Array(N), accB = new Float32Array(N), accR = new Float32Array(N), wY = new Float32Array(N), wC = new Float32Array(N);
    const diff = new Float64Array(N), S = new Float64Array((W + 1) * (H + 1));
    const EXP = new Float32Array(4096); // exp(-t) for t in 0…16
    for (let i = 0; i < 4096; i++) EXP[i] = Math.exp(-i / 256);
    const ex = (t) => (t >= 16 ? 0 : EXP[(t * 256) | 0]);
    for (let dy = -search; dy <= search; dy++) for (let dx = -search; dx <= search; dx++) {
      for (let y = 0; y < H; y++) { const y2 = Math.min(H - 1, Math.max(0, y + dy)); for (let x = 0; x < W; x++) { const p = y * W + x, q = y2 * W + Math.min(W - 1, Math.max(0, x + dx)), a = Y[p] - Y[q], b = Cb[p] - Cb[q], c = Cr[p] - Cr[q]; diff[p] = a * a + 0.5 * (b * b + c * c); } }
      for (let y = 0; y < H; y++) { let run = 0; for (let x = 0; x < W; x++) { run += diff[y * W + x]; S[(y + 1) * (W + 1) + x + 1] = S[y * (W + 1) + x + 1] + run; } }
      for (let y = 0; y < H; y++) {
        const y0 = Math.max(0, y - patch), y1 = Math.min(H, y + patch + 1), y2 = Math.min(H - 1, Math.max(0, y + dy));
        for (let x = 0; x < W; x++) {
          const x0 = Math.max(0, x - patch), x1 = Math.min(W, x + patch + 1), n = (y1 - y0) * (x1 - x0);
          const d = (S[y1 * (W + 1) + x1] - S[y0 * (W + 1) + x1] - S[y1 * (W + 1) + x0] + S[y0 * (W + 1) + x0]) / n;
          const p = y * W + x, q = y2 * W + Math.min(W - 1, Math.max(0, x + dx)), a = ex(d / (hY * hY)), c = ex(d / (hC * hC));
          accY[p] += a * Y[q]; wY[p] += a; accB[p] += c * Cb[q]; accR[p] += c * Cr[q]; wC[p] += c;
        }
      }
    }
    const out = new ImageData(W, H), d = out.data;
    for (let p = 0; p < N; p++) {
      const y = accY[p] / wY[p], cb = accB[p] / wC[p], cr = accR[p] / wC[p];
      d[p * 4] = y + cr / 0.713; d[p * 4 + 2] = y + cb / 0.564; d[p * 4 + 1] = (y - 0.299 * (y + cr / 0.713) - 0.114 * (y + cb / 0.564)) / 0.587; d[p * 4 + 3] = s[p * 4 + 3];
    }
    return out;
  }

  // ------------------------------------------------------------------ CLAHE: adaptive histogram equalisation
  // Faded photos: the brightness is spread out again square by square (tiles), so each part gets its own contrast, with
  // a clip limit so flat areas (sky, walls) are not pushed into noise. The squares' curves blend smoothly into each
  // other. Only brightness changes; colours keep their hue.
  function clahe(img, { clip = 2.5, tiles = 8, amount = 100 } = {}) {
    const W = img.width, H = img.height, s = img.data, N = W * H, Y = new Uint8Array(N);
    for (let p = 0; p < N; p++) Y[p] = Math.round(0.299 * s[p * 4] + 0.587 * s[p * 4 + 1] + 0.114 * s[p * 4 + 2]);
    const tx = Math.max(1, Math.min(tiles, W >> 3)), ty = Math.max(1, Math.min(tiles, H >> 3)), maps = [];
    for (let j = 0; j < ty; j++) for (let i = 0; i < tx; i++) {
      const x0 = Math.floor((i * W) / tx), x1 = Math.floor(((i + 1) * W) / tx), y0 = Math.floor((j * H) / ty), y1 = Math.floor(((j + 1) * H) / ty), h = new Float64Array(256);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) h[Y[y * W + x]]++;
      const n = (x1 - x0) * (y1 - y0), lim = Math.max(1, (clip * n) / 256); let over = 0;
      for (let v = 0; v < 256; v++) if (h[v] > lim) { over += h[v] - lim; h[v] = lim; }
      const m = new Uint8Array(256); let c = 0; for (let v = 0; v < 256; v++) { c += h[v] + over / 256; m[v] = Math.min(255, Math.round((c / n) * 255)); }
      maps.push(m);
    }
    const out = new ImageData(W, H), d = out.data, k = amount / 100;
    for (let y = 0; y < H; y++) {
      const fy = Math.max(0, Math.min(ty - 1, (y + 0.5) / (H / ty) - 0.5)), j0 = Math.floor(fy), j1 = Math.min(ty - 1, j0 + 1), vy = fy - j0;
      for (let x = 0; x < W; x++) {
        const fx = Math.max(0, Math.min(tx - 1, (x + 0.5) / (W / tx) - 0.5)), i0 = Math.floor(fx), i1 = Math.min(tx - 1, i0 + 1), vx = fx - i0, p = y * W + x, v = Y[p];
        const ny = (maps[j0 * tx + i0][v] * (1 - vx) + maps[j0 * tx + i1][v] * vx) * (1 - vy) + (maps[j1 * tx + i0][v] * (1 - vx) + maps[j1 * tx + i1][v] * vx) * vy;
        const target = v + (ny - v) * k, f = v > 0 ? target / v : 0, add = v > 0 ? 0 : target;
        // the colour scaled with its brightness (hue kept); black lifted evenly
        for (let c = 0; c < 3; c++) d[p * 4 + c] = s[p * 4 + c] * f + add;
        d[p * 4 + 3] = s[p * 4 + 3];
      }
    }
    return out;
  }

  // How blocky a JPEG is: edges across the 8-pixel grid against edges elsewhere (brightness), and across the 16-pixel
  // colour grid (colour kept at half size). About 1 for a clean picture; tested: 1.8–2.4 and 6 on heavily compressed
  // photos from a social site, back to 1.1–1.3 after Remove JPEG blocks and Rebuild colour detail.
  function blockiness(img) {
    const W = img.width, H = img.height, d = img.data, Y = new Float32Array(W * H), C = new Float32Array(W * H);
    for (let p = 0; p < W * H; p++) { const r = d[p * 4], g = d[p * 4 + 1], b = d[p * 4 + 2]; Y[p] = 0.299 * r + 0.587 * g + 0.114 * b; C[p] = 0.5 * b - 0.1687 * r - 0.3313 * g; }
    const ratio = (A, P) => { const on = new Float64Array(P), no = new Float64Array(P); let all = 0, n = 0; const st = Math.max(1, Math.floor(H / 400)); for (let y = 0; y < H; y += st) for (let x = 0; x < W - 1; x++) { const v = Math.abs(A[y * W + x + 1] - A[y * W + x]); on[x % P] += v; no[x % P]++; all += v; n++; } let best = 0; for (let o = 0; o < P; o++) { const off = (all - on[o]) / Math.max(1, n - no[o]); best = Math.max(best, on[o] / Math.max(1, no[o]) / Math.max(1e-6, off)); } return best; };
    return { luma: ratio(Y, 8), colour: ratio(C, 16) };
  }
  // Descreen: a printed photo (newspaper, yearbook, magazine) is a regular grid of dots, which shows as sharp spikes in
  // the frequency spectrum, away from the middle where the picture itself lives. Each spike and its mirror is notched
  // out with a soft Butterworth notch; everything else (the edges of faces too) is kept. A plain low-pass blur (the
  // usual quick answer) softens the whole picture instead.
  function descreen(img, { strength = 100, sensitivity = 50, cut = 0.7, sharpen = 60, detectOnly = false } = {}) {
    const W = img.width, H = img.height, P = pow2(W), Q = pow2(H), N = P * Q, s = img.data;
    if (N > 4096 * 4096) throw new Error('This picture is too big to descreen in one go (over 16 megapixels once padded): crop it or make it smaller first.');
    const mx = (x, n) => { const m = 2 * n; x = ((x % m) + m) % m; return x < n ? x : m - 1 - x; }; // mirrored edges (no seams in the spectrum)
    const plane = (f) => { const re = new Float64Array(N), im = new Float64Array(N); for (let y = 0; y < Q; y++) { const yy = mx(y, H); for (let x = 0; x < P; x++) re[y * P + x] = f((yy * W + mx(x, W)) * 4); } return [re, im]; };
    // find the spikes in the brightness spectrum
    const [lr, li] = plane((i) => 0.299 * s[i] + 0.587 * s[i + 1] + 0.114 * s[i + 2]); fft2(lr, li, P, Q, false);
    const mag = new Float32Array(N); for (let i = 0; i < N; i++) mag[i] = Math.log(1 + Math.hypot(lr[i], li[i]));
    const R = 6, bg = new Float32Array(N), tmp = new Float32Array(N);
    for (let y = 0; y < Q; y++) for (let x = 0; x < P; x++) { let t = 0; for (let k = -R; k <= R; k++) t += mag[y * P + ((x + k + P) % P)]; tmp[y * P + x] = t / (2 * R + 1); }
    for (let y = 0; y < Q; y++) for (let x = 0; x < P; x++) { let t = 0; for (let k = -R; k <= R; k++) t += tmp[((y + k + Q) % Q) * P + x]; bg[y * P + x] = t / (2 * R + 1); }
    const fu = (x) => (x < P / 2 ? x : x - P), fv = (y) => (y < Q / 2 ? y : y - Q), rmin = 0.06 * Math.min(P, Q), thr = 3.4 - sensitivity / 50, peaks = [];
    for (let y = 0; y < Q; y++) for (let x = 0; x < P; x++) {
      const u = fu(x), v = fv(y); if (Math.hypot(u / P, v / Q) * Math.min(P, Q) < rmin || v < 0 || (v === 0 && u < 0)) continue; // one of each mirrored pair
      // the JPEG block grid makes spikes at multiples of 1/8 (and 1/16 for colour) along the axes: not a printing screen
      const onGrid = (f, n) => { const k = f * 16 / n; return Math.abs(k - Math.round(k)) * (n / 16) < 1.5; };
      if ((onGrid(u, P) && Math.abs(v) <= 2) || (onGrid(v, Q) && Math.abs(u) <= 2) || (onGrid(u, P) && onGrid(v, Q))) continue;
      const i = y * P + x, e = mag[i] - bg[i]; if (e < thr) continue;
      let top = true; for (let j = -2; j <= 2 && top; j++) for (let k = -2; k <= 2; k++) if ((j || k) && mag[((y + j + Q) % Q) * P + ((x + k + P) % P)] > mag[i]) { top = false; break; }
      if (top) peaks.push([u, v, e]);
    }
    peaks.sort((a, b) => b[2] - a[2]); peaks.length = Math.min(peaks.length, 48);
    if (detectOnly) return peaks.length < 4 ? { peaks: 0, period: 0 } : { peaks: peaks.length, period: 1 / Math.min(...peaks.slice(0, 6).map(([u, v]) => Math.hypot(u / P, v / Q))) };
    if (peaks.length < 4) { const o = new ImageData(new Uint8ClampedArray(s), W, H); o.peaks = 0; return o; } // no screen found: left alone
    // the screen's own spacing: the strongest spikes are its first harmonic. Notching the spikes left the rosette that
    // colour screens make with each other (it sits below the screen frequency), so the screen is taken out by a blur
    // matched to its spacing, and the edges are sharpened back without bringing the dots back (contrast-adaptive)
    const f0 = Math.min(...peaks.slice(0, 6).map(([u, v]) => Math.hypot(u / P, v / Q))), T = 1 / f0, X = IC.filters;
    let out = X.blur(img, { radius: Math.max(1, Math.round(T * 0.5 * cut / 0.7)) });
    if (sharpen) out = X.cas(out, { amount: sharpen });
    if (strength < 100) { const a = out.data, k = strength / 100; for (let i = 0; i < a.length; i++) if ((i & 3) !== 3) a[i] = Math.round(s[i] + (a[i] - s[i]) * k); }
    out.peaks = peaks.length; out.period = T; return out;
  }
  IC.restore = { descreen, blockiness, impulse, deblurCareful, deblur, psf, psfTaps, blurWith, nlm, clahe, measure, noiseLevel, noiseMap, fft2, pow2 };
})();

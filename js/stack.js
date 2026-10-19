/* ImageCraft stack (IC.stack): several shots or scans of the same thing combined into one better picture: the
   photograph's version of what DLSS, FSR 2, XeSS and TSR do in games, Hubble's drizzle, and the Pixel phones' handheld
   super-resolution (Wronski and others, 2019). Each shot samples the scene at slightly different points (a hand never
   holds still; a print never lands in exactly the same place on a scanner), so together they hold real detail no
   single shot has, measured, not invented. Noise falls by the square root of the number of shots.
     align(ref, img, { local }) → { dx, dy, field? }   where img sits relative to ref, to a fraction of a pixel
                                    (phase correlation; local: also each 64-pixel area on its own, for handheld shots)
     combine(imgs, { mode: 'super' | 'average' | 'median', scale: 1 | 2, local, onStep }) → ImageData
       super: merged onto a finer grid with edge-following kernels (as the Splat upscaler) and robustness (a shot that
              disagrees with the others somewhere, because something moved or a speck of dust, counts less there)
       average: aligned and averaged (cleanest); median: the middle value (drops moving things and one-off dust) */
(function () {
  'use strict';
  const IC = (window.IC = window.IC || {});
  const LIN = new Float32Array(256); for (let i = 0; i < 256; i++) { const c = i / 255; LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  const toS = (l) => 255 * (l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(Math.min(1, Math.max(0, l)), 1 / 2.4) - 0.055);
  const lumOf = (img) => { const d = img.data, n = img.width * img.height, L = new Float32Array(n); for (let p = 0; p < n; p++) L[p] = (0.299 * d[p * 4] + 0.587 * d[p * 4 + 1] + 0.114 * d[p * 4 + 2]) / 255; return L; };
  const pow2 = (n) => { let p = 1; while (p < n) p <<= 1; return p; };

  // Phase correlation of two equal-size patches (P × Q, powers of two): the peak of the normalised cross-power spectrum
  // is the shift; its neighbours give the fraction (a parabola through three points on each axis)
  function phaseShift(a, b, P, Q) {
    const F = IC.restore.fft2, ar = Float64Array.from(a), ai = new Float64Array(P * Q), br = Float64Array.from(b), bi = new Float64Array(P * Q);
    // a gentle window so the patch edges do not look like a shift of their own
    for (let y = 0; y < Q; y++) for (let x = 0; x < P; x++) { const w = (0.5 - 0.5 * Math.cos((2 * Math.PI * (x + 0.5)) / P)) * (0.5 - 0.5 * Math.cos((2 * Math.PI * (y + 0.5)) / Q)); ar[y * P + x] *= w; br[y * P + x] *= w; }
    F(ar, ai, P, Q, false); F(br, bi, P, Q, false);
    for (let i = 0; i < P * Q; i++) { const re = ar[i] * br[i] + ai[i] * bi[i], im = ai[i] * br[i] - ar[i] * bi[i], m = Math.hypot(re, im) + 1e-12; ar[i] = re / m; ai[i] = im / m; }
    F(ar, ai, P, Q, true);
    let best = 0, bv = -Infinity; for (let i = 0; i < P * Q; i++) if (ar[i] > bv) { bv = ar[i]; best = i; }
    const px = best % P, py = (best / P) | 0, at = (x, y) => ar[((y + Q) % Q) * P + ((x + P) % P)];
    const fx = (() => { const l = at(px - 1, py), c = at(px, py), r = at(px + 1, py), d = l - 2 * c + r; return Math.abs(d) > 1e-12 ? Math.max(-0.5, Math.min(0.5, (l - r) / (2 * d))) : 0; })();
    const fy = (() => { const u = at(px, py - 1), c = at(px, py), dn = at(px, py + 1), d = u - 2 * c + dn; return Math.abs(d) > 1e-12 ? Math.max(-0.5, Math.min(0.5, (u - dn) / (2 * d))) : 0; })();
    let dx = px + fx, dy = py + fy; if (dx > P / 2) dx -= P; if (dy > Q / 2) dy -= Q;
    return { dx, dy, peak: bv };
  }
  // a square patch (size N) of a brightness image around (cx, cy), sampled with a shift (bilinear), edges clamped
  function patch(L, W, H, cx, cy, N, sx = 0, sy = 0) {
    const o = new Float64Array(N * N), x0 = cx - N / 2 + sx, y0 = cy - N / 2 + sy;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const fx = Math.min(W - 1.001, Math.max(0, x0 + x)), fy = Math.min(H - 1.001, Math.max(0, y0 + y)), ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy; o[y * N + x] = (L[iy * W + ix] * (1 - tx) + L[iy * W + ix + 1] * tx) * (1 - ty) + (L[(iy + 1) * W + ix] * (1 - tx) + L[(iy + 1) * W + ix + 1] * tx) * ty; }
    return o;
  }
  // where img sits relative to ref: (dx, dy) such that ref(x, y) ≈ img(x + dx, y + dy)
  function align(ref, img, { local = true } = {}) {
    const W = ref.width, H = ref.height, A = lumOf(ref), B = lumOf(img);
    // whole picture first (on the middle part, up to 512 pixels square), then refined once with the shift applied
    const N = Math.min(512, pow2(Math.min(W, H)) / (pow2(Math.min(W, H)) > Math.min(W, H) ? 2 : 1));
    const pa = patch(A, W, H, W / 2, H / 2, N), g1 = phaseShift(pa, patch(B, W, H, W / 2, H / 2, N), N, N);
    let dx = -g1.dx, dy = -g1.dy;
    const g2 = phaseShift(pa, patch(B, W, H, W / 2, H / 2, N, dx, dy), N, N); dx -= g2.dx; dy -= g2.dy;
    if (!local) return { dx, dy };
    // then each 64-pixel area (every 32 pixels) on its own, starting from the whole-picture shift; areas with too little
    // detail to judge, or a weak match, keep the whole-picture shift; the field is smoothed (median of neighbours)
    const T = 64, step = 32, gw = Math.max(1, Math.floor((W - T) / step) + 1), gh = Math.max(1, Math.floor((H - T) / step) + 1), fdx = new Float32Array(gw * gh), fdy = new Float32Array(gw * gh);
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const cx = i * step + T / 2, cy = j * step + T / 2, a = patch(A, W, H, cx, cy, T); let v = 0, m = 0; for (const q of a) m += q; m /= a.length; for (const q of a) v += (q - m) ** 2;
      fdx[j * gw + i] = dx; fdy[j * gw + i] = dy; if (v / a.length < 2e-4) continue;
      const r = phaseShift(a, patch(B, W, H, cx, cy, T, dx, dy), T, T);
      if (r.peak > 0.12 && Math.hypot(r.dx, r.dy) < 6) { fdx[j * gw + i] = dx - r.dx; fdy[j * gw + i] = dy - r.dy; }
    }
    const med = (F) => { const o = new Float32Array(F.length); for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const v = []; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const ii = Math.min(gw - 1, Math.max(0, i + a)), jj = Math.min(gh - 1, Math.max(0, j + b)); v.push(F[jj * gw + ii]); } v.sort((p, q) => p - q); o[j * gw + i] = v[4]; } return o; };
    return { dx, dy, field: { gw, gh, step, T, dx: med(fdx), dy: med(fdy) } };
  }
  // the shift at a point (bilinear in the field)
  function shiftAt(al, x, y) {
    const f = al.field; if (!f) return [al.dx, al.dy];
    const gx = Math.max(0, Math.min(f.gw - 1, (x - f.T / 2) / f.step)), gy = Math.max(0, Math.min(f.gh - 1, (y - f.T / 2) / f.step)), i0 = Math.floor(gx), j0 = Math.floor(gy), i1 = Math.min(f.gw - 1, i0 + 1), j1 = Math.min(f.gh - 1, j0 + 1), tx = gx - i0, ty = gy - j0;
    const bl = (F) => (F[j0 * f.gw + i0] * (1 - tx) + F[j0 * f.gw + i1] * tx) * (1 - ty) + (F[j1 * f.gw + i0] * (1 - tx) + F[j1 * f.gw + i1] * tx) * ty;
    return [bl(f.dx), bl(f.dy)];
  }

  async function combine(imgs, { mode = 'super', scale = 2, local = true, onStep, kernel = 0.4, finish = 60 } = {}) {
    if (imgs.length < 2) throw new Error('Choose at least two pictures of the same thing.');
    const ref = imgs[0], W = ref.width, H = ref.height, X = IC.filters;
    const frames = imgs.map((im) => (im.width === W && im.height === H ? im : X.resize(im, { width: W, height: H })));
    const al = [{ dx: 0, dy: 0 }]; for (let f = 1; f < frames.length; f++) { onStep && onStep(`Lining up picture ${f + 1} of ${frames.length}…`); await new Promise((r) => setTimeout(r, 0)); al.push(align(ref, frames[f], { local })); }
    const lin = frames.map((im) => { const d = im.data, o = new Float32Array(W * H * 3); for (let p = 0; p < W * H; p++) for (let c = 0; c < 3; c++) o[p * 3 + c] = LIN[d[p * 4 + c]]; return o; });
    const cubic = (F, x, y, c) => { const ix = Math.floor(x), iy = Math.floor(y), tx = x - ix, ty = y - iy, wt = (t) => { const a = -0.5, t2 = t * t, t3 = t2 * t; return [a * t3 - 2 * a * t2 + a * t, (a + 2) * t3 - (a + 3) * t2 + 1, -(a + 2) * t3 + (2 * a + 3) * t2 - a * t, -a * t3 + a * t2]; }, wx = wt(tx), wy = wt(ty); let v = 0; for (let j = 0; j < 4; j++) { const yy = Math.min(H - 1, Math.max(0, iy - 1 + j)); let row = 0; for (let i = 0; i < 4; i++) row += F[(yy * W + Math.min(W - 1, Math.max(0, ix - 1 + i))) * 3 + c] * wx[i]; v += row * wy[j]; } return v; };
    const sample = (F, x, y, c) => { const fx = Math.min(W - 1.001, Math.max(0, x)), fy = Math.min(H - 1.001, Math.max(0, y)), ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy; return (F[(iy * W + ix) * 3 + c] * (1 - tx) + F[(iy * W + ix + 1) * 3 + c] * tx) * (1 - ty) + (F[((iy + 1) * W + ix) * 3 + c] * (1 - tx) + F[((iy + 1) * W + ix + 1) * 3 + c] * tx) * ty; };
    if (mode !== 'super') {
      // aligned, then averaged or the middle value per pixel
      onStep && onStep('Combining…'); const out = new ImageData(W, H), d = out.data, vals = new Float32Array(frames.length);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { for (let c = 0; c < 3; c++) { for (let f = 0; f < frames.length; f++) { const [sx, sy] = shiftAt(al[f], x, y); vals[f] = f === 0 ? lin[0][(y * W + x) * 3 + c] : cubic(lin[f], x + sx, y + sy, c); } let v; if (mode === 'median') { const s = Array.from(vals).sort((a, b) => a - b), m = s.length >> 1; v = s.length & 1 ? s[m] : (s[m - 1] + s[m]) / 2; } else { v = 0; for (const q of vals) v += q; v /= vals.length; } d[(y * W + x) * 4 + c] = toS(v); } d[(y * W + x) * 4 + 3] = 255; }
      return { img: out, shifts: al.map((a) => [a.dx, a.dy]) };
    }
    // super-resolution: every output pixel gathers the nearby samples of every shot, each weighted by an edge-following
    // kernel (thin across edges, long along them; from the reference's structure tensor) and by how well that shot agrees
    // with the reference there (robustness: motion and specks count less)
    onStep && onStep('Merging the shots onto a finer grid…'); await new Promise((r) => setTimeout(r, 0));
    const S = scale, OW = W * S, OH = H * S, L = lumOf(ref), at = (x, y) => L[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))];
    const jxx = new Float32Array(W * H), jxy = new Float32Array(W * H), jyy = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const gx = (at(x + 1, y) - at(x - 1, y)) / 2, gy = (at(x, y + 1) - at(x, y - 1)) / 2, p = y * W + x; jxx[p] = gx * gx; jxy[p] = gx * gy; jyy[p] = gy * gy; }
    const bx = (A) => IC.maps.box(A, W, H, 2), Sxx = bx(jxx), Sxy = bx(jxy), Syy = bx(jyy);
    // local mean and spread of the reference (3 × 3), for robustness; noise level from the picture
    const mRef = IC.maps.box(L, W, H, 1), L2 = L.map((v) => v * v), m2 = IC.maps.box(L2, W, H, 1), noise = Math.max(0.004, (IC.restore.noiseLevel(ref).luma / 255) * 1.5);
    const fl = frames.map((im) => { const l = lumOf(im); return IC.maps.box(l, W, H, 1); });
    const out = new ImageData(OW, OH), d = out.data, R = 2;
    for (let oy = 0; oy < OH; oy++) {
      if (oy % 64 === 0) { onStep && onStep(`Merging… ${Math.round((oy / OH) * 100)}%`); await new Promise((r) => setTimeout(r, 0)); }
      for (let ox = 0; ox < OW; ox++) {
        const rx = (ox + 0.5) / S - 0.5, ry = (oy + 0.5) / S - 0.5, rp = Math.min(H - 1, Math.max(0, Math.round(ry))) * W + Math.min(W - 1, Math.max(0, Math.round(rx)));
        // the kernel at this place: thin across the edge (0.4 px), long along it (up to 1.2 px), round where flat
        const tr = Sxx[rp] + Syy[rp], det = Sxx[rp] * Syy[rp] - Sxy[rp] * Sxy[rp], disc = Math.sqrt(Math.max(0, tr * tr / 4 - det)), l1 = tr / 2 + disc, l2 = Math.max(0, tr / 2 - disc), coh = l1 + l2 > 1e-7 ? Math.sqrt((l1 - l2) / (l1 + l2)) * Math.min(1, Math.sqrt(l1) * 30) : 0;
        const th = 0.5 * Math.atan2(2 * Sxy[rp], Sxx[rp] - Syy[rp]), cs = Math.cos(th), sn = Math.sin(th), sA = (0.6 - 0.2 * coh) * kernel, sL = (0.6 + 0.6 * coh) * kernel, ka = 1 / (sA * sA), kl = 1 / (sL * sL), ia = ka * cs * cs + kl * sn * sn, ib = (ka - kl) * cs * sn, ic = ka * sn * sn + kl * cs * cs;
        const refSd = Math.sqrt(Math.max(0, m2[rp] - mRef[rp] * mRef[rp]));
        let r = 0, g = 0, b = 0, ws = 0;
        for (let f = 0; f < frames.length; f++) {
          const [sx, sy] = shiftAt(al[f], rx, ry), fx = rx + sx, fy = ry + sy, cx = Math.round(fx), cy = Math.round(fy);
          // robustness: this shot's local mean against the reference's, allowing for detail and noise
          const fq = Math.min(H - 1, Math.max(0, cy)) * W + Math.min(W - 1, Math.max(0, cx)), diff = fl[f][fq] - mRef[rp], rob = f === 0 ? 1 : Math.exp(-(diff * diff) / (2 * (refSd * refSd * 0.25 + noise * noise * 4)));
          for (let j = -R; j <= R; j++) { const yy = cy + j; if (yy < 0 || yy >= H) continue; for (let i = -R; i <= R; i++) { const xx = cx + i; if (xx < 0 || xx >= W) continue;
            const dx = xx - fx, dy = yy - fy, e = ia * dx * dx + 2 * ib * dx * dy + ic * dy * dy; if (e > 9) continue; const w = Math.exp(-0.5 * e) * rob, q = (yy * W + xx) * 3; r += lin[f][q] * w; g += lin[f][q + 1] * w; b += lin[f][q + 2] * w; ws += w; } }
        }
        const o = (oy * OW + ox) * 4; if (ws < 1e-9) { const q = rp * 3; d[o] = toS(lin[0][q]); d[o + 1] = toS(lin[0][q + 1]); d[o + 2] = toS(lin[0][q + 2]); } else { d[o] = toS(r / ws); d[o + 1] = toS(g / ws); d[o + 2] = toS(b / ws); }
        d[o + 3] = 255;
      }
    }
    // the shots' own pixel blur (each camera pixel averages its area) taken back a little
    const res = finish ? X.sharpen(out, { amount: finish, radius: 1, threshold: 1 }) : out;
    return { img: res, shifts: al.map((a) => [a.dx, a.dy]) };
  }
  IC.stack = { align, combine, phaseShift };
})();

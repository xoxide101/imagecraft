/* ImageCraft detail (IC.detail): ways of bringing out detail and shaping light that work like layers of curves
   recombined, written as the mathematics behind them.
     equaliser(img, { gains: [fine, small, medium, large, broad] %, protect }) — the picture split into bands of detail
       size (a Laplacian pyramid), a curve on each band (small changes lifted more than big edges, so no halos), recombined
     gradientLift(img, { strength, detail }) — gradient-domain tone mapping (Fattal, Lischinski and Werman): big brightness
       jumps compressed, small ones lifted, then the picture rebuilt from its changed gradients by solving the Poisson
       equation ∇²u = div G (multigrid)
     diffuse(img, { strength, keepEdges }) — Perona–Malik anisotropic diffusion: smoothing that flows along edges, never
       across them
     crispEdges(img, { strength, size }) — a shock filter (Osher and Rudin; Kramer and Bruckner's form): soft edges pulled
       to crisp steps, without halos — good after enlarging
     curve(points) → a 256-entry table (monotone cubic through the points), applyCurves(img, tables)
     blend(base, other, { mode, amount }) — two versions combined (normal, multiply, screen, overlay, soft light,
       lighten, darken, difference, luminosity, colour)
   All work on brightness and keep the colours' hue unless the operation is about colour. */
(function () {
  'use strict';
  const IC = (window.IC = window.IC || {});
  const LIN = new Float32Array(256); for (let i = 0; i < 256; i++) { const c = i / 255; LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  const toS = (l) => 255 * (l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(Math.min(1, Math.max(0, l)), 1 / 2.4) - 0.055);
  const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
  const lumOf = (img) => { const d = img.data, n = img.width * img.height, L = new Float32Array(n); for (let p = 0; p < n; p++) L[p] = (0.299 * d[p * 4] + 0.587 * d[p * 4 + 1] + 0.114 * d[p * 4 + 2]) / 255; return L; };
  // a new brightness (0–1, perceptual) put back into the picture: each pixel's colour scaled in linear light, hue kept
  function withLum(img, L0, L1, sat = 1) {
    const o = new ImageData(img.width, img.height), s = img.data, d = o.data;
    for (let p = 0; p < L0.length; p++) {
      const a = Math.max(1e-4, LIN[Math.round(Math.max(0, Math.min(1, L0[p])) * 255)]), b = Math.max(0, Math.min(1, L1[p])), bl = b <= 0.04045 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4), k = bl / a;
      for (let c = 0; c < 3; c++) { const v = LIN[s[p * 4 + c]]; d[p * 4 + c] = toS(sat === 1 ? v * k : Math.pow(Math.max(1e-6, v / a), sat) * bl); }
      d[p * 4 + 3] = s[p * 4 + 3];
    }
    return o;
  }

  // ------------------------------------------------------------------ pyramids (binomial down, bilinear up)
  function down(A, W, H) {
    const w = Math.max(1, (W + 1) >> 1), h = Math.max(1, (H + 1) >> 1), o = new Float32Array(w * h), K = [1, 4, 6, 4, 1];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let t = 0, n = 0; for (let j = -2; j <= 2; j++) { const yy = Math.min(H - 1, Math.max(0, y * 2 + j)); for (let i = -2; i <= 2; i++) { const xx = Math.min(W - 1, Math.max(0, x * 2 + i)), k = K[i + 2] * K[j + 2]; t += A[yy * W + xx] * k; n += k; } } o[y * w + x] = t / n; }
    return [o, w, h];
  }
  function up(A, w, h, W, H) {
    const o = new Float32Array(W * H);
    for (let y = 0; y < H; y++) { const fy = Math.min(h - 1, Math.max(0, (y + 0.5) / 2 - 0.5)), y0 = Math.floor(fy), y1 = Math.min(h - 1, y0 + 1), ty = fy - y0;
      for (let x = 0; x < W; x++) { const fx = Math.min(w - 1, Math.max(0, (x + 0.5) / 2 - 0.5)), x0 = Math.floor(fx), x1 = Math.min(w - 1, x0 + 1), tx = fx - x0; o[y * W + x] = (A[y0 * w + x0] * (1 - tx) + A[y0 * w + x1] * tx) * (1 - ty) + (A[y1 * w + x0] * (1 - tx) + A[y1 * w + x1] * tx) * ty; } }
    return o;
  }

  // ------------------------------------------------------------------ detail equaliser
  // gains (%) for: fine (1–2 px), small (2–4), medium (4–8), large (8–16), broad (the light and shade beyond that).
  // Each band's values d are remapped by d · (1 + (g − 1) · e^(−(d/σ)²)): small changes (texture) get the gain, big ones
  // (strong edges) keep theirs, which is what keeps halos away (the idea of the local Laplacian filter). protect: σ.
  function equaliser(img, { gains = [120, 130, 120, 100, 100], protect = 0.12 } = {}) {
    const W = img.width, H = img.height, L = lumOf(img), levels = Math.min(gains.length, Math.floor(Math.log2(Math.min(W, H))) - 1);
    const G = [[L, W, H]]; for (let l = 1; l < levels; l++) G.push(down(...G[l - 1]));
    let cur = Float32Array.from(G[levels - 1][0]); const gb = (gains[levels - 1] ?? 100) / 100, gm = G[levels - 1][0];
    // the broadest level: contrast around its own average
    { let m = 0; for (const v of gm) m += v; m /= gm.length; for (let i = 0; i < cur.length; i++) cur[i] = m + (gm[i] - m) * gb; }
    for (let l = levels - 2; l >= 0; l--) {
      const [g, w, h] = G[l], [gn, wn, hn] = G[l + 1], u = up(gn, wn, hn, w, h), uc = up(cur, wn, hn, w, h), k = (gains[l] ?? 100) / 100, sg = protect * (1 + l * 0.5);
      cur = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) { const dd = g[i] - u[i]; cur[i] = uc[i] + dd * (1 + (k - 1) * Math.exp(-(dd / sg) * (dd / sg))); }
    }
    return withLum(img, L, cur);
  }

  // ------------------------------------------------------------------ Poisson solver (multigrid, Neumann edges)
  // solves ∇²u = f on a W × H grid (5-point Laplacian, unit spacing), starting from u0; the mean of u is kept at u0's
  function poisson(f, W, H, u0, cycles = 8) {
    const smooth = (u, f, W, H, n) => { for (let it = 0; it < n; it++) for (let c = 0; c < 2; c++) for (let y = 0; y < H; y++) for (let x = (y + c) & 1; x < W; x += 2) { const p = y * W + x; let s = 0, k = 0; if (x > 0) { s += u[p - 1]; k++; } if (x < W - 1) { s += u[p + 1]; k++; } if (y > 0) { s += u[p - W]; k++; } if (y < H - 1) { s += u[p + W]; k++; } if (k) u[p] = (s - f[p]) / k; } };
    const residual = (u, f, W, H) => { const r = new Float32Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = y * W + x; let s = 0, k = 0; if (x > 0) { s += u[p - 1]; k++; } if (x < W - 1) { s += u[p + 1]; k++; } if (y > 0) { s += u[p - W]; k++; } if (y < H - 1) { s += u[p + W]; k++; } r[p] = f[p] - (s - k * u[p]); } return r; };
    const restrict = (r, W, H) => { const w = (W + 1) >> 1, h = (H + 1) >> 1, o = new Float32Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let t = 0, n = 0; for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { const xx = x * 2 + i, yy = y * 2 + j; if (xx < W && yy < H) { t += r[yy * W + xx]; n++; } } o[y * w + x] = (t / n) * 4; } return [o, w, h]; };
    const vcycle = (u, f, W, H) => {
      if (W <= 3 || H <= 3) { smooth(u, f, W, H, 40); return; }
      smooth(u, f, W, H, 3);
      const [rc, w, h] = restrict(residual(u, f, W, H), W, H), ec = new Float32Array(w * h);
      vcycle(ec, rc, w, h);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) u[y * W + x] += ec[Math.min(h - 1, y >> 1) * w + Math.min(w - 1, x >> 1)];
      smooth(u, f, W, H, 3);
    };
    const u = Float32Array.from(u0); let m0 = 0; for (const v of u0) m0 += v; m0 /= u0.length;
    for (let c = 0; c < cycles; c++) vcycle(u, f, W, H);
    let m = 0; for (const v of u) m += v; m = m / u.length - m0; for (let i = 0; i < u.length; i++) u[i] -= m;
    return u;
  }

  // ------------------------------------------------------------------ gradient-domain lift
  // On log brightness: each gradient scaled by φ = (α / |∇|)^(1−β) (α: a tenth of the average gradient), so jumps
  // bigger than α shrink and smaller ones grow; tiny ones at the noise level are left alone. Then rebuilt by solving
  // ∇²u = div(φ∇I), and the colours follow the new brightness.
  function gradientLift(img, { strength = 50, detail = 50, noise = 0 } = {}) {
    const W = img.width, H = img.height, L = lumOf(img), lg = new Float32Array(W * H);
    for (let p = 0; p < W * H; p++) lg[p] = Math.log(0.01 + L[p]);
    const gx = new Float32Array(W * H), gy = new Float32Array(W * H); let avg = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = y * W + x; gx[p] = x < W - 1 ? lg[p + 1] - lg[p] : 0; gy[p] = y < H - 1 ? lg[p + W] - lg[p] : 0; avg += Math.hypot(gx[p], gy[p]); }
    avg /= W * H;
    const beta = 1 - 0.3 * (strength / 100), alpha = avg * (0.3 + (1 - detail / 100) * 1.4), nf = Math.max(1e-4, noise || avg * 0.15);
    for (let p = 0; p < W * H; p++) {
      const m = Math.hypot(gx[p], gy[p]); if (m < 1e-6) continue;
      let phi = Math.pow(alpha / m, 1 - beta); if (phi > 1) phi = 1 + (phi - 1) * Math.min(1, (m / nf) * (m / nf)); // noise-sized changes not lifted
      phi = Math.max(0.25, Math.min(3, phi)); gx[p] *= phi; gy[p] *= phi;
    }
    const f = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = y * W + x; f[p] = gx[p] - (x > 0 ? gx[p - 1] : 0) + gy[p] - (y > 0 ? gy[p - W] : 0); }
    const u = poisson(f, W, H, lg, 10), out = new Float32Array(W * H);
    // back to brightness, then spread to the original's range (0.5% and 99.5% points)
    for (let p = 0; p < W * H; p++) out[p] = Math.exp(u[p]) - 0.01;
    const so = Float32Array.from(out).sort(), si = Float32Array.from(L).sort(), q = (a, t) => a[Math.min(a.length - 1, Math.floor(a.length * t))];
    const a0 = q(so, 0.005), a1 = q(so, 0.995), b0 = q(si, 0.005), b1 = q(si, 0.995);
    for (let p = 0; p < W * H; p++) out[p] = b0 + ((out[p] - a0) / Math.max(1e-4, a1 - a0)) * (b1 - b0);
    return withLum(img, L, out, 1 - 0.2 * (strength / 100)); // colours ease a little as the light is compressed (as in the paper)
  }

  // ------------------------------------------------------------------ Perona–Malik diffusion
  // ∂I/∂t = div( g(|∇I|) ∇I ), g(s) = 1 / (1 + (s/K)²): where the change is small (noise, grain) it flows and evens
  // out; where it is big (an edge) it hardly moves. keepEdges sets K (smaller keeps more).
  function diffuse(img, { strength = 50, keepEdges = 50 } = {}) {
    const W = img.width, H = img.height, N = W * H, iters = Math.round(2 + strength * 0.25), K = 0.015 + (100 - keepEdges) * 0.0008, dt = 0.2;
    const ch = [0, 1, 2].map((c) => { const a = new Float32Array(N); for (let p = 0; p < N; p++) a[p] = img.data[p * 4 + c] / 255; return a; });
    const L = new Float32Array(N), g = (s) => 1 / (1 + (s / K) * (s / K));
    for (let it = 0; it < iters; it++) {
      for (let p = 0; p < N; p++) L[p] = 0.299 * ch[0][p] + 0.587 * ch[1][p] + 0.114 * ch[2][p];
      // conduction on each of the four sides, from brightness (so colours move together)
      const cE = new Float32Array(N), cS = new Float32Array(N);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = y * W + x; if (x < W - 1) cE[p] = g(Math.abs(L[p + 1] - L[p])); if (y < H - 1) cS[p] = g(Math.abs(L[p + W] - L[p])); }
      for (const A of ch) {
        const B = Float32Array.from(A);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = y * W + x; let fl = 0; if (x < W - 1) fl += cE[p] * (B[p + 1] - B[p]); if (x > 0) fl += cE[p - 1] * (B[p - 1] - B[p]); if (y < H - 1) fl += cS[p] * (B[p + W] - B[p]); if (y > 0) fl += cS[p - W] * (B[p - W] - B[p]); A[p] = B[p] + dt * fl; }
      }
    }
    const o = new ImageData(W, H); for (let p = 0; p < N; p++) { for (let c = 0; c < 3; c++) o.data[p * 4 + c] = clamp(ch[c][p] * 255); o.data[p * 4 + 3] = img.data[p * 4 + 3]; }
    return o;
  }

  // ------------------------------------------------------------------ shock filter (crisp edges)
  // Each step, a pixel on the bright side of an edge (where the smoothed second derivative is negative) takes the
  // brightest of its neighbours, one on the dark side the darkest: soft ramps become steps, flat areas stay flat (no
  // change where there is no slope), and nothing overshoots (no halos). size: the smoothing that decides the sides.
  function crispEdges(img, { strength = 40, size = 1.2 } = {}) {
    const W = img.width, H = img.height, N = W * H, steps = Math.max(1, Math.round(strength / 25)), mix = Math.min(1, strength / 100);
    const L0 = lumOf(img); let L = Float32Array.from(L0);
    const R = Math.max(1, Math.round(size * 2)), wts = []; let ws = 0; for (let i = -R; i <= R; i++) { const w = Math.exp(-(i * i) / (2 * size * size)); wts.push(w); ws += w; }
    const blur = (A) => { const t = new Float32Array(N), o = new Float32Array(N); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s = 0; for (let i = -R; i <= R; i++) s += A[y * W + Math.min(W - 1, Math.max(0, x + i))] * wts[i + R]; t[y * W + x] = s / ws; } for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s = 0; for (let i = -R; i <= R; i++) s += t[Math.min(H - 1, Math.max(0, y + i)) * W + x] * wts[i + R]; o[y * W + x] = s / ws; } return o; };
    for (let st = 0; st < steps; st++) {
      const S = blur(L), next = new Float32Array(N);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const p = y * W + x, xm = Math.max(0, x - 1), xp = Math.min(W - 1, x + 1), ym = Math.max(0, y - 1), yp = Math.min(H - 1, y + 1);
        const lap = S[y * W + xm] + S[y * W + xp] + S[ym * W + x] + S[yp * W + x] - 4 * S[p];
        const nb = [L[y * W + xm], L[y * W + xp], L[ym * W + x], L[yp * W + x], L[p]], hi = Math.max(...nb), lo = Math.min(...nb);
        next[p] = Math.abs(lap) < 1e-5 ? L[p] : lap < 0 ? hi : lo;
      }
      L = next;
    }
    const out = new Float32Array(N); for (let p = 0; p < N; p++) out[p] = L0[p] + (L[p] - L0[p]) * mix;
    return withLum(img, L0, out);
  }

  // ------------------------------------------------------------------ curves
  // A smooth curve through the points ([x, y] in 0–255, sorted by x) that never wiggles past them (monotone cubic,
  // Fritsch–Carlson), as a 256-entry table.
  function curve(points) {
    const P = points.slice().sort((a, b) => a[0] - b[0]), n = P.length, t = new Float32Array(256);
    if (n < 2) { for (let i = 0; i < 256; i++) t[i] = i; return t; }
    const dx = [], dy = [], m = []; for (let i = 0; i < n - 1; i++) { dx.push(Math.max(1e-6, P[i + 1][0] - P[i][0])); dy.push((P[i + 1][1] - P[i][1]) / dx[i]); }
    m.push(dy[0]); for (let i = 1; i < n - 1; i++) m.push(dy[i - 1] * dy[i] <= 0 ? 0 : (dy[i - 1] + dy[i]) / 2); m.push(dy[n - 2]);
    for (let i = 0; i < n - 1; i++) { if (!dy[i]) { m[i] = m[i + 1] = 0; continue; } const a = m[i] / dy[i], b = m[i + 1] / dy[i], s = a * a + b * b; if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * dy[i]; m[i + 1] = k * b * dy[i]; } }
    for (let v = 0; v < 256; v++) {
      if (v <= P[0][0]) { t[v] = P[0][1]; continue; } if (v >= P[n - 1][0]) { t[v] = P[n - 1][1]; continue; }
      let i = 0; while (i < n - 2 && v > P[i + 1][0]) i++;
      const h = dx[i], s = (v - P[i][0]) / h, h00 = 2 * s ** 3 - 3 * s * s + 1, h10 = s ** 3 - 2 * s * s + s, h01 = -2 * s ** 3 + 3 * s * s, h11 = s ** 3 - s * s;
      t[v] = Math.max(0, Math.min(255, h00 * P[i][1] + h10 * h * m[i] + h01 * P[i + 1][1] + h11 * h * m[i + 1]));
    }
    return t;
  }
  // tables: { rgb, r, g, b, lum } (any may be missing); lum changes brightness only (hue kept)
  function applyCurves(img, tables) {
    const o = new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), d = o.data, T = tables;
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i], g = d[i + 1], b = d[i + 2];
      if (T.rgb) { r = T.rgb[r]; g = T.rgb[g]; b = T.rgb[b]; }
      if (T.r) r = T.r[Math.round(r)]; if (T.g) g = T.g[Math.round(g)]; if (T.b) b = T.b[Math.round(b)];
      if (T.lum) { const l = 0.299 * r + 0.587 * g + 0.114 * b, nl = T.lum[Math.round(Math.max(0, Math.min(255, l)))], k = l > 0.5 ? nl / l : 1; r *= k; g *= k; b *= k; if (l <= 0.5) { r = g = b = nl; } }
      d[i] = clamp(r); d[i + 1] = clamp(g); d[i + 2] = clamp(b);
    }
    return o;
  }

  // ------------------------------------------------------------------ blending two versions
  const MODES = {
    normal: (a, b) => b, multiply: (a, b) => (a * b) / 255, screen: (a, b) => 255 - ((255 - a) * (255 - b)) / 255,
    overlay: (a, b) => (a < 128 ? (2 * a * b) / 255 : 255 - (2 * (255 - a) * (255 - b)) / 255),
    softlight: (a, b) => { const A = a / 255, B = b / 255; return 255 * (B < 0.5 ? A - (1 - 2 * B) * A * (1 - A) : A + (2 * B - 1) * ((A < 0.25 ? ((16 * A - 12) * A + 4) * A : Math.sqrt(A)) - A)); },
    lighten: (a, b) => Math.max(a, b), darken: (a, b) => Math.min(a, b), difference: (a, b) => Math.abs(a - b),
  };
  function blend(base, other, { mode = 'normal', amount = 100 } = {}) {
    const W = base.width, H = base.height, k = amount / 100, o = new ImageData(W, H), d = o.data, a = base.data;
    const b = other.width === W && other.height === H ? other.data : IC.filters.resize(other, { width: W, height: H }).data;
    for (let i = 0; i < d.length; i += 4) {
      let r, g, bb;
      if (mode === 'luminosity' || mode === 'colour') {
        // brightness of one, colour of the other (in linear light, hue kept)
        const la = 0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2], lb = 0.299 * b[i] + 0.587 * b[i + 1] + 0.114 * b[i + 2];
        const [src, tl] = mode === 'luminosity' ? [a, lb] : [b, la], ls = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2], f = ls > 0.5 ? tl / ls : 0;
        r = ls > 0.5 ? src[i] * f : tl; g = ls > 0.5 ? src[i + 1] * f : tl; bb = ls > 0.5 ? src[i + 2] * f : tl;
      } else { const f = MODES[mode] || MODES.normal; r = f(a[i], b[i]); g = f(a[i + 1], b[i + 1]); bb = f(a[i + 2], b[i + 2]); }
      const kk = k * (b[i + 3] / 255); // a cut-out (see-through around it) only counts where it is solid
      d[i] = clamp(a[i] + (r - a[i]) * kk); d[i + 1] = clamp(a[i + 1] + (g - a[i + 1]) * kk); d[i + 2] = clamp(a[i + 2] + (bb - a[i + 2]) * kk); d[i + 3] = a[i + 3];
    }
    return o;
  }

  IC.detail = { equaliser, gradientLift, poisson, diffuse, crispEdges, curve, applyCurves, blend, MODES: [...Object.keys(MODES), 'luminosity', 'colour'] };
})();

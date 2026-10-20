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
  // Contrast-adaptive sharpening (after AMD FidelityFX CAS, MIT): each pixel is sharpened by how much room its
  // neighbours leave before black or white, so flat areas and strong edges get less and nothing rings or clips.
  function cas(img, { amount = 60 } = {}) {
    const W = img.width, H = img.height, s = img.data, out = new ImageData(W, H), d = out.data, peak = -1 / (8 - 3 * Math.min(1, amount / 100));
    const at = (x, y, c) => s[(Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))) * 4 + c] / 255;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      for (let c = 0; c < 3; c++) {
        const m = at(x, y, c), n = at(x, y - 1, c), so = at(x, y + 1, c), e = at(x + 1, y, c), w = at(x - 1, y, c);
        let mn = Math.min(m, n, so, e, w), mx = Math.max(m, n, so, e, w);
        const mn2 = Math.min(mn, at(x - 1, y - 1, c), at(x + 1, y - 1, c), at(x - 1, y + 1, c), at(x + 1, y + 1, c)), mx2 = Math.max(mx, at(x - 1, y - 1, c), at(x + 1, y - 1, c), at(x - 1, y + 1, c), at(x + 1, y + 1, c));
        mn += mn2; mx += mx2; // the cross plus the ring, as CAS does
        const amp = Math.sqrt(Math.max(0, Math.min(1, Math.min(mn, 2 - mx) / Math.max(1e-5, mx)))), k = amp * peak;
        d[o + c] = Math.round(Math.max(0, Math.min(1, (m + k * (n + so + e + w)) / (1 + 4 * k))) * 255);
      }
      d[o + 3] = s[o + 3];
    }
    return out;
  }
  // Rebuild colour detail: a JPEG keeps brightness in full but colour at half size in 8 × 8 blocks, and old prints and
  // scans smear colour more than brightness. Colour edges nearly always sit on brightness edges, so the colour is
  // smoothed over the block size (the blocks go) and then made to follow the brightness detail that is really there
  // (a guided filter, colour as a local linear function of brightness). Nothing is invented: brightness is untouched.
  function chromaRebuild(img, { strength = 100, size = 8 } = {}) {
    const W = img.width, H = img.height, s = img.data, n = W * H, Y = new Float32Array(n), Cb = new Float32Array(n), Cr = new Float32Array(n);
    for (let p = 0; p < n; p++) { const r = s[p * 4] / 255, g = s[p * 4 + 1] / 255, b = s[p * 4 + 2] / 255; Y[p] = 0.299 * r + 0.587 * g + 0.114 * b; Cb[p] = (b - Y[p]) * 0.564; Cr[p] = (r - Y[p]) * 0.713; }
    const R = Math.max(1, Math.round(size / 2)), sm = (A) => boxMean(boxMean(A, W, H, R), W, H, R);
    const nb = guidedBy(Y, sm(Cb), W, H, size, 0.0008), nr = guidedBy(Y, sm(Cr), W, H, size, 0.0008), k = strength / 100, out = new ImageData(W, H), d = out.data;
    for (let p = 0; p < n; p++) {
      const cb = Cb[p] + (nb[p] - Cb[p]) * k, cr = Cr[p] + (nr[p] - Cr[p]) * k, y = Y[p];
      const r = y + cr / 0.713, b = y + cb / 0.564, g = (y - 0.299 * r - 0.114 * b) / 0.587;
      d[p * 4] = Math.round(Math.max(0, Math.min(1, r)) * 255); d[p * 4 + 1] = Math.round(Math.max(0, Math.min(1, g)) * 255); d[p * 4 + 2] = Math.round(Math.max(0, Math.min(1, b)) * 255); d[p * 4 + 3] = s[p * 4 + 3];
    }
    return out;
  }
  // Smooth out banding (after the f3kdb idea): each pixel is compared with four others a random distance away (the
  // corners of a box); where all four are within a level or two of it, the area is a smooth gradient that was rounded
  // into bands, and the pixel takes their average. Edges and texture differ by more and stay. Two sizes, so wide and
  // narrow bands both go. With 16-bit steps the averages keep their in-between levels.
  // Colourise: lightness (CIE Lab, D65, sRGB gamma, as OpenCV's float conversion) of the picture → a grey 512 × 512 copy
  // for DDColor → its colour (a, b) enlarged smoothly back to the picture's size, joined with the picture's own lightness.
  // So only the colour is guessed: every detail stays the photo's own.
  const srgbToLin = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)), linToSrgb = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
  const fLab = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116), fInv = (t) => (t > 0.206893 ? t * t * t : (t - 16 / 116) / 7.787);
  function toLab(r, g, b) { const R = srgbToLin(r), G = srgbToLin(g), B = srgbToLin(b), X = (0.412453 * R + 0.35758 * G + 0.180423 * B) / 0.950456, Y = 0.212671 * R + 0.71516 * G + 0.072169 * B, Z = (0.019334 * R + 0.119193 * G + 0.950227 * B) / 1.088754; const fy = fLab(Y); return [Y > 0.008856 ? 116 * fy - 16 : 903.3 * Y, 500 * (fLab(X) - fy), 200 * (fy - fLab(Z))]; }
  function fromLab(L, a, b) { const fy = (L + 16) / 116, X = fInv(fy + a / 500) * 0.950456, Y = fInv(fy), Z = fInv(fy - b / 200) * 1.088754; const R = 3.240479 * X - 1.53715 * Y - 0.498535 * Z, G = -0.969256 * X + 1.875992 * Y + 0.041556 * Z, B = 0.055648 * X - 0.204043 * Y + 1.057311 * Z; return [R, G, B].map((v) => Math.max(0, Math.min(1, linToSrgb(Math.max(0, v))))); }
  // the colour of one picture (Lab a, b, a little smoothed) joined to the lightness of another of the same size
  function colourFrom(img, col, { amount = 100 } = {}) {
    const W = img.width, H = img.height, n = W * H, d = img.data, c = col.data, A = new Float32Array(n), B = new Float32Array(n), L = new Float32Array(n);
    for (let p = 0; p < n; p++) { L[p] = toLab(d[p * 4] / 255, d[p * 4 + 1] / 255, d[p * 4 + 2] / 255)[0]; const q = toLab(c[p * 4] / 255, c[p * 4 + 1] / 255, c[p * 4 + 2] / 255); A[p] = q[1]; B[p] = q[2]; }
    const r = Math.max(1, Math.round(Math.max(W, H) / 700)), sa = boxMean(A, W, H, r), sb = boxMean(B, W, H, r), k = amount / 100, out = new ImageData(W, H), o = out.data;
    for (let p = 0; p < n; p++) { const rgb = fromLab(L[p], sa[p] * k, sb[p] * k); for (let q = 0; q < 3; q++) o[p * 4 + q] = Math.round(rgb[q] * 255); o[p * 4 + 3] = d[p * 4 + 3]; }
    return out;
  }
  // light and colour from another version (a cloud result), detail from the photo itself: the broad difference in
  // lightness and colour is carried over (smoothed), so no edge, texture or face is redrawn
  // Clean the paper (drawings, sketches, documents): the paper's own colour and its uneven light are found (the
  // brightest nearby, smoothed) and divided out, so the paper turns white and even and the lines stay; then the lines
  // are deepened. keepColour: each colour divided by the paper's own (coloured pencil, ink); else greys.
  // Remove stray dots (drawings, line art): only small marks standing alone, darker than the paper, that touch nothing,
  // are taken away (filled with the paper round them); anything joined to a line stays whole, however thin.
  function dotsOff(img, { size = 12, countOnly = false } = {}) {
    const W = img.width, H = img.height, d = img.data, n = W * H, L = new Uint8Array(n), hist = new Uint32Array(256);
    for (let p = 0; p < n; p++) { const v = (d[p * 4] * 77 + d[p * 4 + 1] * 150 + d[p * 4 + 2] * 29) >> 8; L[p] = v; hist[v]++; }
    let c = 0, paper = 255; for (let v = 255; v >= 0; v--) { c += hist[v]; if (c >= n * 0.3) { paper = v; break; } }
    const thr = paper * 0.72, lab = new Int32Array(n), stack = new Int32Array(n), maxSide = Math.ceil(2 * Math.sqrt(size)) + 2;
    const out = countOnly ? null : new ImageData(new Uint8ClampedArray(d), W, H); let removed = 0, comps = 0;
    for (let s0 = 0; s0 < n; s0++) {
      if (lab[s0] || L[s0] >= thr) continue; comps++; let top = 0, area = 0, x0 = W, y0 = H, x1 = 0, y1 = 0; stack[top++] = s0; lab[s0] = comps; const px = [];
      while (top) { const p = stack[--top], x = p % W, y = (p / W) | 0; area++; if (area <= size + 1) px.push(p); if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const q = yy * W + xx; if (!lab[q] && L[q] < thr) { lab[q] = comps; stack[top++] = q; } } }
      if (area > size || x1 - x0 + 1 > maxSide || y1 - y0 + 1 > maxSide) continue;
      removed += area; if (countOnly) continue;
      let r = 0, g = 0, b = 0, m = 0; for (let y = Math.max(0, y0 - 2); y <= Math.min(H - 1, y1 + 2); y++) for (let x = Math.max(0, x0 - 2); x <= Math.min(W - 1, x1 + 2); x++) { const q = y * W + x; if (L[q] >= thr) { r += d[q * 4]; g += d[q * 4 + 1]; b += d[q * 4 + 2]; m++; } }
      if (!m) continue; for (const p of px) { const o = out.data; o[p * 4] = r / m; o[p * 4 + 1] = g / m; o[p * 4 + 2] = b / m; }
    }
    return countOnly ? { frac: removed / n } : out;
  }
  function paperClean(img, { strength = 80, deepen = 30, keepColour = true } = {}) {
    const W = img.width, H = img.height, d = img.data, k = Math.min(1, 400 / Math.max(W, H)), w = Math.max(8, Math.round(W * k)), h = Math.max(8, Math.round(H * k));
    const sm = resize(img, { width: w, height: h }), sd = sm.data, R = Math.max(2, Math.round(Math.max(w, h) / 30)), bg = [new Float32Array(w * h), new Float32Array(w * h), new Float32Array(w * h)];
    for (let c = 0; c < 3; c++) { // local maximum (the paper between the lines), rows then columns, then smoothed
      const a = new Float32Array(w * h), b = bg[c]; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let m = 0; for (let i = Math.max(0, x - R); i <= Math.min(w - 1, x + R); i++) m = Math.max(m, sd[(y * w + i) * 4 + c]); a[y * w + x] = m; }
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let m = 0; for (let j = Math.max(0, y - R); j <= Math.min(h - 1, y + R); j++) m = Math.max(m, a[j * w + x]); b[y * w + x] = m; }
      bg[c] = boxMean(b, w, h, R);
    }
    const out = new ImageData(W, H), o = out.data, t = strength / 100, g = 1 + (deepen / 100) * 1.5;
    for (let y = 0; y < H; y++) { const sy = Math.min(h - 1, Math.max(0, (y + 0.5) * k - 0.5)), y0 = Math.floor(sy), y1 = Math.min(h - 1, y0 + 1), ty = sy - y0;
      for (let x = 0; x < W; x++) { const sx = Math.min(w - 1, Math.max(0, (x + 0.5) * k - 0.5)), x0 = Math.floor(sx), x1 = Math.min(w - 1, x0 + 1), tx = sx - x0, p = (y * W + x) * 4;
        const at = (A) => (A[y0 * w + x0] * (1 - tx) + A[y0 * w + x1] * tx) * (1 - ty) + (A[y1 * w + x0] * (1 - tx) + A[y1 * w + x1] * tx) * ty;
        const bl = keepColour ? null : (at(bg[0]) * 0.299 + at(bg[1]) * 0.587 + at(bg[2]) * 0.114);
        for (let c = 0; c < 3; c++) { const B = Math.max(24, keepColour ? at(bg[c]) : bl), v0 = keepColour ? d[p + c] : d[p] * 0.299 + d[p + 1] * 0.587 + d[p + 2] * 0.114; let v = Math.min(1, v0 / B); v = Math.pow(v, g); o[p + c] = Math.round(d[p + c] + (v * 255 - d[p + c]) * t); }
        o[p + 3] = d[p + 3]; } }
    return out;
  }
  function toneFrom(img, ref) {
    const W = img.width, H = img.height, n = W * H, d = img.data, c = ref.data, dL = new Float32Array(n), dA = new Float32Array(n), dB = new Float32Array(n), O = [];
    for (let p = 0; p < n; p++) { const a = toLab(d[p * 4] / 255, d[p * 4 + 1] / 255, d[p * 4 + 2] / 255), b = toLab(c[p * 4] / 255, c[p * 4 + 1] / 255, c[p * 4 + 2] / 255); O.push(a); dL[p] = b[0] - a[0]; dA[p] = b[1] - a[1]; dB[p] = b[2] - a[2]; }
    const r = Math.max(2, Math.round(Math.max(W, H) / 120)), sL = boxMean(dL, W, H, r), sA = boxMean(dA, W, H, r), sB = boxMean(dB, W, H, r), out = new ImageData(W, H), o = out.data;
    for (let p = 0; p < n; p++) { const a = O[p], rgb = fromLab(Math.max(0, Math.min(100, a[0] + sL[p])), a[1] + sA[p], a[2] + sB[p]); for (let q = 0; q < 3; q++) o[p * 4 + q] = Math.round(Math.max(0, Math.min(1, rgb[q])) * 255); o[p * 4 + 3] = d[p * 4 + 3]; }
    return out;
  }
  async function colourise(img, { amount = 100, warm = 0 } = {}) {
    const W = img.width, H = img.height, d = img.data, L = new Float32Array(W * H);
    for (let p = 0; p < W * H; p++) L[p] = toLab(d[p * 4] / 255, d[p * 4 + 1] / 255, d[p * 4 + 2] / 255)[0];
    // the grey 512 × 512 copy: lightness averaged over each output pixel's area, then back to grey RGB
    const N = 512, g = new Float32Array(3 * N * N);
    for (let v = 0; v < N; v++) for (let u = 0; u < N; u++) {
      const x0 = Math.floor((u * W) / N), x1 = Math.max(x0 + 1, Math.floor(((u + 1) * W) / N)), y0 = Math.floor((v * H) / N), y1 = Math.max(y0 + 1, Math.floor(((v + 1) * H) / N)); let t = 0, k = 0;
      for (let y = y0; y < Math.min(H, y1); y++) for (let x = x0; x < Math.min(W, x1); x++) { t += L[y * W + x]; k++; }
      const grey = fromLab(t / Math.max(1, k), 0, 0)[0], i = v * N + u; g[i] = g[N * N + i] = g[2 * N * N + i] = grey;
    }
    const ab = await CRAFTAI.colourise(g), out = new ImageData(W, H), o = out.data, k = amount / 100;
    for (let y = 0; y < H; y++) { const sy = Math.min(N - 1, Math.max(0, ((y + 0.5) * N) / H - 0.5)), y0 = Math.floor(sy), y1 = Math.min(N - 1, y0 + 1), ty = sy - y0;
      for (let x = 0; x < W; x++) { const sx = Math.min(N - 1, Math.max(0, ((x + 0.5) * N) / W - 0.5)), x0 = Math.floor(sx), x1 = Math.min(N - 1, x0 + 1), tx = sx - x0;
        const at = (A) => (A[y0 * N + x0] * (1 - tx) + A[y0 * N + x1] * tx) * (1 - ty) + (A[y1 * N + x0] * (1 - tx) + A[y1 * N + x1] * tx) * ty;
        const p = y * W + x, rgb = fromLab(L[p], at(ab.a) * k + warm * 0.15, at(ab.b) * k + warm * 0.3); for (let c = 0; c < 3; c++) o[p * 4 + c] = Math.round(rgb[c] * 255); o[p * 4 + 3] = d[p * 4 + 3]; } }
    return out;
  }
  function deband(img, { threshold = 3, radius = 16 } = {}) {
    const W = img.width, H = img.height, s = img.data; let cur = new Float32Array(s.length); for (let i = 0; i < s.length; i++) cur[i] = s[i];
    for (const R of [radius, Math.max(2, radius >> 2)]) {
      const o = Float32Array.from(cur);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const h = Math.imul(x * 73856093 ^ y * 19349663, 2654435761) >>> 0, dx = 1 + (h % R), dy = 1 + ((h >>> 12) % R), p = (y * W + x) * 4;
        const q = [[x + dx, y + dy], [x - dx, y - dy], [x + dy, y - dx], [x - dy, y + dx]].map(([u, v]) => (Math.min(H - 1, Math.max(0, v)) * W + Math.min(W - 1, Math.max(0, u))) * 4);
        let ok = true; for (const k of q) { for (let c = 0; c < 3; c++) if (Math.abs(cur[k + c] - cur[p + c]) > threshold) { ok = false; break; } if (!ok) break; }
        if (ok) for (let c = 0; c < 3; c++) o[p + c] = (cur[q[0] + c] + cur[q[1] + c] + cur[q[2] + c] + cur[q[3] + c] + cur[p + c]) / 5;
      }
      cur = o;
    }
    const out = new ImageData(W, H); for (let i = 0; i < s.length; i++) out.data[i] = Math.round(cur[i]); return out;
  }
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
    if (method === 'mmpx') { // MMPX in 2× steps; anything in between is averaged down from the next step up
      let s = img; while ((s.width < W || s.height < H) && s.width * s.height * 4 <= 64e6) s = mmpx(s);
      return s.width === W && s.height === H ? s : resize(s, { width: W, height: H, method: 'area', linear });
    }
    if (method === 'scale2x' || method === 'scale3x' || method === 'smoothpixel') {
      // smooth pixel art: grown well past the size with Scale2x, then averaged down, so each edge is anti-aliased
      // from many sub-pixels (supersampling) instead of blurred
      let s = img; const f = method === 'scale3x' ? 3 : 2, aim = method === 'smoothpixel' ? 3 : 1;
      while ((s.width < W * aim || s.height < H * aim) && s.width * s.height * f * f <= 64e6) s = f === 3 ? scale3x(s) : scale2x(s);
      if (s.width === W && s.height === H) return s;
      return resize(s, { width: W, height: H, method: 'area', linear });
    }
    if (method === 'nearest') { const src = canvasOf(img); return draw(W, H, (x) => { x.imageSmoothingEnabled = false; x.drawImage(src, 0, 0, W, H); }); }
    if (method === 'splat' && IC.resample) return W >= img.width ? IC.resample.splat(img, W, H, { linear }) : IC.resample.resize(img, W, H, { method: 'auto', linear });
    const m = method === 'smooth' ? 'auto' : method;
    if (IC.resample && W * H <= 60e6 && img.width * img.height <= 60e6) return IC.resample.resize(img, W, H, { method: m, linear });
    // very big pictures: the browser's own scaling, shrinking in halves so fine detail averages instead of shimmering
    let c = canvasOf(img), cw = img.width, ch = img.height;
    while (cw / 2 >= W && ch / 2 >= H) { const n = document.createElement('canvas'); n.width = Math.round(cw / 2); n.height = Math.round(ch / 2); const x = n.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, n.width, n.height); c = n; cw = n.width; ch = n.height; }
    return draw(W, H, (x) => { x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, W, H); });
  }
  // MMPX: style-preserving pixel-art magnification (2×), ported from the MIT reference code. Copyright 2020 Morgan
  // McGuire & Mara Gagiu, https://casual-effects.com/research/McGuire2021PixelArt/ . Like EPX, each pixel becomes 2 × 2,
  // but with rules for 1:1 and 2:1 slopes and for lines crossing, and ties settled by brightness, so thin lines,
  // corners and dithering keep their look and no new colours are made.
  function mmpx(img) {
    const sw = img.width, sh = img.height, src = new Uint32Array(img.data.buffer.slice(img.data.byteOffset, img.data.byteOffset + sw * sh * 4)), out = new ImageData(sw * 2, sh * 2), dst = new Uint32Array(out.data.buffer);
    const mx = sw - 1, my = sh - 1, px = (x, y) => src[Math.min(my, Math.max(0, y)) * sw + Math.min(mx, Math.max(0, x))];
    const luma = (c) => (((c >>> 16) & 255) + ((c >>> 8) & 255) + (c & 255) + 1) * (256 - (c >>> 24));
    const all2 = (B, a, b) => B === a && B === b, all3 = (B, a, b, c) => B === a && B === b && B === c, all4 = (B, a, b, c, d) => B === a && B === b && B === c && B === d;
    const any3 = (B, a, b, c) => B === a || B === b || B === c, none2 = (B, a, b) => B !== a && B !== b, none4 = (B, a, b, c, d) => B !== a && B !== b && B !== c && B !== d;
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      const A = px(x - 1, y - 1), B = px(x, y - 1), C = px(x + 1, y - 1), D = px(x - 1, y), E = px(x, y), F = px(x + 1, y), G = px(x - 1, y + 1), H = px(x, y + 1), I = px(x + 1, y + 1);
      let J = E, K = E, L = E, M = E;
      if (A !== E || B !== E || C !== E || D !== E || F !== E || G !== E || H !== E || I !== E) {
        const P = px(x, y - 2), S = px(x, y + 2), Q = px(x - 2, y), R = px(x + 2, y), Bl = luma(B), Dl = luma(D), El = luma(E), Fl = luma(F), Hl = luma(H);
        // 1:1 slopes
        if (D === B && D !== H && D !== F && (El >= Dl || E === A) && any3(E, A, C, G) && (El < Dl || A !== D || E !== P || E !== Q)) J = D;
        if (B === F && B !== D && B !== H && (El >= Bl || E === C) && any3(E, A, C, I) && (El < Bl || C !== B || E !== P || E !== R)) K = B;
        if (H === D && H !== F && H !== B && (El >= Hl || E === G) && any3(E, A, G, I) && (El < Hl || G !== H || E !== S || E !== Q)) L = H;
        if (F === H && F !== B && F !== D && (El >= Fl || E === I) && any3(E, C, G, I) && (El < Fl || I !== H || E !== R || E !== S)) M = F;
        // lines crossing
        if (E !== F && all4(E, C, I, D, Q) && all2(F, B, H) && F !== px(x + 3, y)) K = M = F;
        if (E !== D && all4(E, A, G, F, R) && all2(D, B, H) && D !== px(x - 3, y)) J = L = D;
        if (E !== H && all4(E, G, I, B, P) && all2(H, D, F) && H !== px(x, y + 3)) L = M = H;
        if (E !== B && all4(E, A, C, H, S) && all2(B, D, F) && B !== px(x, y - 3)) J = K = B;
        if (Bl < El && all4(E, G, H, I, S) && none4(E, A, D, C, F)) J = K = B;
        if (Hl < El && all4(E, A, B, C, P) && none4(E, D, G, I, F)) L = M = H;
        if (Fl < El && all4(E, A, D, G, Q) && none4(E, B, C, I, H)) K = M = F;
        if (Dl < El && all4(E, C, F, I, R) && none4(E, B, A, G, H)) J = L = D;
        // 2:1 slopes
        if (H !== B) {
          if (H !== A && H !== E && H !== C) { if (all3(H, G, F, R) && none2(H, D, px(x + 2, y - 1))) L = M; if (all3(H, I, D, Q) && none2(H, F, px(x - 2, y - 1))) M = L; }
          if (B !== I && B !== G && B !== E) { if (all3(B, A, F, R) && none2(B, D, px(x + 2, y + 1))) J = K; if (all3(B, C, D, Q) && none2(B, F, px(x - 2, y + 1))) K = J; }
        }
        if (F !== D) {
          if (D !== I && D !== E && D !== C) { if (all3(D, A, H, S) && none2(D, B, px(x + 1, y + 2))) J = L; if (all3(D, G, B, P) && none2(D, H, px(x + 1, y - 2))) L = J; }
          if (F !== E && F !== A && F !== G) { if (all3(F, C, H, S) && none2(F, B, px(x - 1, y + 2))) K = M; if (all3(F, I, B, P) && none2(F, H, px(x - 1, y - 2))) M = K; }
        }
      }
      const o = 2 * y * 2 * sw + 2 * x; dst[o] = J; dst[o + 1] = K; dst[o + 2 * sw] = L; dst[o + 2 * sw + 1] = M;
    }
    return out;
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
  // the background colour: the most common of the four corners (a logo on white: white)
  function cornerBg(img) { const W = img.width, H = img.height, d = img.data, cs = [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]].map(([x, y]) => { const i = (y * W + x) * 4; return [d[i], d[i + 1], d[i + 2]]; }); let best = cs[0], bn = -1; for (const c of cs) { const n = cs.filter((e) => Math.abs(e[0] - c[0]) + Math.abs(e[1] - c[1]) + Math.abs(e[2] - c[2]) < 30).length; if (n > bn) { bn = n; best = c; } } return best; }
  // Defringe: the soft edge pixels next to what was taken away are part background colour (a white rim). Each gets its
  // true colour back (the strongest colour near it, inside the shape) and becomes as see-through as it was background.
  function defringe(img, bg, { reach = 2 } = {}) {
    const W = img.width, H = img.height, d = img.data, o = copy(img), od = o.data, n = W * H, clear = new Uint8Array(n);
    for (let p = 0; p < n; p++) clear[p] = d[p * 4 + 3] < 16 ? 1 : 0;
    const dist = (i) => Math.hypot(d[i] - bg[0], d[i + 1] - bg[1], d[i + 2] - bg[2]);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = y * W + x; if (clear[p]) continue; let near = false;
      for (let j = -reach; j <= reach && !near; j++) for (let i = -reach; i <= reach; i++) { const xx = x + i, yy = y + j; if (xx >= 0 && yy >= 0 && xx < W && yy < H && clear[yy * W + xx]) { near = true; break; } }
      if (!near) continue;
      let F = -1, fd = 0; const R = reach + 2; for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) { const xx = x + i, yy = y + j; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const q = (yy * W + xx) * 4; if (d[q + 3] < 240) continue; const e = dist(q); if (e > fd) { fd = e; F = q; } }
      if (F < 0 || fd < 24) continue;
      const q = p * 4, a = Math.max(0, Math.min(1, dist(q) / fd));
      if (a < 0.06) { od[q + 3] = 0; continue; }
      for (let c = 0; c < 3; c++) od[q + c] = Math.max(0, Math.min(255, Math.round(bg[c] + (d[q + c] - bg[c]) / a)));
      od[q + 3] = Math.round(Math.min(d[q + 3], a * 255));
    }
    return o;
  }
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
    const spread = hueSpread(d), toned = keepTone === true || (keepTone === 'auto' && spread < 0.01); let skinEase = 1, leafEase = 1; void sv;
    // between toned and plainly colour: only part of the colour correction (the rest stays as the picture's own tone)
    const graded = keepTone === 'auto' && !toned ? Math.min(1, (spread - 0.01) / 0.09) : 1;
    // levels: per colour, or (toned) the same for all three so the tone stays
    let L = E;
    if (toned) { const lo = Math.min(...E.map((e) => e[0])), hi = Math.max(...E.map((e) => e[1])); L = [[lo, hi], [lo, hi], [lo, hi]]; }
    const stretch = (v, c) => Math.max(0, Math.min(1, (v - L[c][0]) / Math.max(1, L[c][1] - L[c][0])));
    // the neutral version: one stretch for all three colours (what easing falls back toward)
    const sLo = Math.min(...E.map((e) => e[0])), sHi = Math.max(...E.map((e) => e[1])), shared = (v) => Math.max(0, Math.min(1, (v - sLo) / Math.max(1, sHi - sLo)));
    let ease = graded; const corr = (v, c, gg, t) => (1 - t) * shared(v) + t * Math.pow(stretch(v, c), gg[c]);
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
      // skin by a common RGB rule (bright, red over green over blue, enough difference): brown stains and dark wood mostly fail it
      const skin = []; for (let i = 0; i < d.length; i += 12) { const r = d[i], g = d[i + 1], b = d[i + 2]; if (r > 95 && g > 40 && b > 20 && r > g && g > b && r - g > 12 && r - b > 30 && Math.max(r, g, b) - Math.min(r, g, b) > 15 && r < 250) skin.push(i); }
      if (skin.length > N * 0.004) {
        // the share of those pixels still clearly warm after the curves (red above blue by 8%, above green by 3%)
        const warm = (gg) => { let ok = 0; for (const i of skin) { const r = corr(d[i], 0, gg, et), g = corr(d[i + 1], 1, gg, et), b = corr(d[i + 2], 2, gg, et); if (r - b > 0.08 && r - g > 0.03) ok++; } return ok / skin.length; };
        let et = 1;
        const full = gam.slice(); let used = 1;
        // ease the whole correction (levels and curves together) toward the neutral one until skin is warm again
        for (const t of [1, 0.8, 0.6, 0.4, 0.2, 0].map((v) => v * graded)) { et = t; used = t; if (warm(full) > 0.85) break; }
        ease = used;
        skinEase = used;
      }
    }
    // foliage protection: plainly green pixels (grass, leaves) must stay green after the correction
    if (!toned) {
      const leaf = []; for (let i = 0; i < d.length; i += 12) { const r = d[i], g = d[i + 1], b = d[i + 2]; if (g > r + 8 && g > b + 8 && g > 40) leaf.push(i); }
      if (leaf.length > N * 0.01) {
        const greenOK = (gg) => { let t = 0; for (const i of leaf) { const r = Math.pow(stretch(d[i], 0), gg[0]), g = Math.pow(stretch(d[i + 1], 1), gg[1]), b = Math.pow(stretch(d[i + 2], 2), gg[2]); t += g - Math.max(r, b); } return t / leaf.length; };
        const full = gam.slice(); for (const t of [1, 0.75, 0.5, 0.25, 0]) { const gg = full.map((v) => Math.pow(v, t)); gam = gg; if (greenOK(gg) > 0.02) { leafEase = t; break; } leafEase = t; }
      }
    }
    // how much colour faded: the picture's average saturation against a natural photo's (about 0.22 in HSV terms)
    let boost = 0;
    if (saturation && !toned) { let ss = 0, ns = 0; for (let i = 0; i < d.length; i += 16) { const v = [stretch(d[i], 0) ** gam[0], stretch(d[i + 1], 1) ** gam[1], stretch(d[i + 2], 2) ** gam[2]], mx = Math.max(...v); if (mx > 0.1) { ss += (mx - Math.min(...v)) / mx; ns++; } } const avg = ns ? ss / ns : 0.22; boost = Math.max(0, Math.min(0.6, (0.22 - avg) * 2.2)); }
    const T = [0, 1, 2].map((c) => { const t = new Float32Array(256); for (let v = 0; v < 256; v++) t[v] = (toned ? Math.pow(stretch(v, c), gam[c]) : corr(v, c, gam, ease)) * 255; return t; });
    const o = copy(img), od = o.data, k = strength / 100;
    for (let i = 0; i < od.length; i += 4) {
      let r = T[0][d[i]], g = T[1][d[i + 1]], b = T[2][d[i + 2]];
      if (boost) { const l = 0.299 * r + 0.587 * g + 0.114 * b, s0 = (Math.max(r, g, b) - Math.min(r, g, b)) / 255, f = 1 + boost * (1 - s0); r = l + (r - l) * f; g = l + (g - l) * f; b = l + (b - l) * f; }
      od[i] = clamp(d[i] + (r - d[i]) * k); od[i + 1] = clamp(d[i + 1] + (g - d[i + 1]) * k); od[i + 2] = clamp(d[i + 2] + (b - d[i + 2]) * k);
    }
    o.colourInfo = { toned, gamma: gam.map((v) => +v.toFixed(2)), levels: L, boost: +boost.toFixed(2), skinEase, leafEase, spread: +spread.toFixed(3), graded: +graded.toFixed(2) };
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


  // ------------------------------------------------------------------ shadow recovery (local tone mapping)
  // The picture's brightness is split (in log terms) into its broad lighting and its detail with an edge-keeping
  // guided filter; the lighting is lifted where it is dark (and gently held down where it is very bright), then the
  // detail is put back. Dark areas come up with their texture and without halos at their edges, the sky stays as it was.
  // Gain is limited (maxGain) so noise in the shadows is not blown up. shadows / highlights 0–100.
  function boxMean(A, W, H, r) {
    const S = new Float64Array((W + 1) * (H + 1)), o = new Float32Array(W * H);
    for (let y = 0; y < H; y++) { let run = 0; for (let x = 0; x < W; x++) { run += A[y * W + x]; S[(y + 1) * (W + 1) + x + 1] = S[y * (W + 1) + x + 1] + run; } }
    for (let y = 0; y < H; y++) { const y0 = Math.max(0, y - r), y1 = Math.min(H, y + r + 1); for (let x = 0; x < W; x++) { const x0 = Math.max(0, x - r), x1 = Math.min(W, x + r + 1); o[y * W + x] = (S[y1 * (W + 1) + x1] - S[y0 * (W + 1) + x1] - S[y1 * (W + 1) + x0] + S[y0 * (W + 1) + x0]) / ((y1 - y0) * (x1 - x0)); } }
    return o;
  }
  function guided(I, W, H, r, eps) { // self-guided filter (He, Sun and Tang): smooths while keeping strong edges
    const N = W * H, II = new Float32Array(N); for (let i = 0; i < N; i++) II[i] = I[i] * I[i];
    const mI = boxMean(I, W, H, r), mII = boxMean(II, W, H, r), a = new Float32Array(N), b = new Float32Array(N);
    for (let i = 0; i < N; i++) { const v = mII[i] - mI[i] * mI[i]; a[i] = v / (v + eps); b[i] = mI[i] - a[i] * mI[i]; }
    const ma = boxMean(a, W, H, r), mb = boxMean(b, W, H, r), q = new Float32Array(N); for (let i = 0; i < N; i++) q[i] = ma[i] * I[i] + mb[i];
    return q;
  }
  function shadowRecover(img, { shadows = 50, highlights = 20, detail = 10, maxGain = 3 } = {}) {
    const W = img.width, H = img.height, s = img.data, N = W * H, Lg = new Float32Array(N);
    for (let p = 0; p < N; p++) Lg[p] = Math.log(1 + 0.2126 * TO_LIN8[s[p * 4]] * 255 + 0.7152 * TO_LIN8[s[p * 4 + 1]] * 255 + 0.0722 * TO_LIN8[s[p * 4 + 2]] * 255);
    const base = guided(Lg, W, H, Math.max(4, Math.round(Math.max(W, H) * 0.02)), 0.08);
    // the middle of the picture's lighting (median of the base), the level shadows are pulled toward
    const sorted = Float32Array.from(base).sort(), mid = sorted[N >> 1], hiRef = sorted[Math.floor(N * 0.98)];
    const ks = shadows / 100 * 0.75, kh = highlights / 100 * 0.35, kd = 1 + detail / 100, o = copy(img), d = o.data;
    for (let p = 0; p < N; p++) {
      const bse = base[p], nb = bse < mid ? bse + (mid - bse) * ks : bse > mid ? bse - (bse - mid) * kh * Math.max(0, (bse - mid) / Math.max(1e-3, hiRef - mid)) : bse;
      const nl = nb + (Lg[p] - bse) * kd, gain = Math.min(maxGain, Math.max(0.5, (Math.exp(nl) - 1) / Math.max(1e-3, Math.exp(Lg[p]) - 1)));
      // the gain applies to light (linear), then back to sRGB numbers: colours keep their hue
      for (let c = 0; c < 3; c++) { const lin = TO_LIN8[s[p * 4 + c]] * gain; d[p * 4 + c] = 255 * (lin <= 0.0031308 ? lin * 12.92 : 1.055 * Math.pow(Math.min(1, lin), 1 / 2.4) - 0.055); }
    }
    return o;
  }
  const TO_LIN8 = (() => { const t = new Float32Array(256); for (let i = 0; i < 256; i++) { const c = i / 255; t[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); } return t; })();


  // ------------------------------------------------------------------ dehaze (dark channel prior, He, Sun and Tang)
  // In a clear photo almost every small area has something dark in it (a shadow, a dark colour); a veil of haze or
  // fading lifts those darks everywhere. The "dark channel" (the darkest value in each small square) measures how thick
  // the veil is at each place; the veil's own colour is taken from where it is thickest. Then each pixel is
  //   J = (I − A) / t + A,  with t = 1 − ω · dark(I / A)
  // (t: how much of the real scene shows through), the map t smoothed with a guided filter so edges stay clean.
  //   strength 0–100 (ω up to 0.95), keepSome: a little veil is kept so distance still looks like distance.
  function guidedBy(G, P, W, H, r, eps) { // guided filter: P smoothed, following the edges of the guide G
    const N = W * H, GP = new Float32Array(N), GG = new Float32Array(N); for (let i = 0; i < N; i++) { GP[i] = G[i] * P[i]; GG[i] = G[i] * G[i]; }
    const mG = boxMean(G, W, H, r), mP = boxMean(P, W, H, r), mGP = boxMean(GP, W, H, r), mGG = boxMean(GG, W, H, r), a = new Float32Array(N), b = new Float32Array(N);
    for (let i = 0; i < N; i++) { const v = mGG[i] - mG[i] * mG[i], cov = mGP[i] - mG[i] * mP[i]; a[i] = cov / (v + eps); b[i] = mP[i] - a[i] * mG[i]; }
    const ma = boxMean(a, W, H, r), mb = boxMean(b, W, H, r), q = new Float32Array(N); for (let i = 0; i < N; i++) q[i] = ma[i] * G[i] + mb[i];
    return q;
  }
  function darkChannel(img, R) {
    const W = img.width, H = img.height, s = img.data, N = W * H, m = new Float32Array(N), t = new Float32Array(N), o = new Float32Array(N);
    for (let p = 0; p < N; p++) m[p] = Math.min(s[p * 4], s[p * 4 + 1], s[p * 4 + 2]) / 255;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = 1; for (let k = Math.max(0, x - R); k <= Math.min(W - 1, x + R); k++) v = Math.min(v, m[y * W + k]); t[y * W + x] = v; }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = 1; for (let k = Math.max(0, y - R); k <= Math.min(H - 1, y + R); k++) v = Math.min(v, t[k * W + x]); o[y * W + x] = v; }
    return o;
  }
  // how hazy a picture is: the average of its dark channel (clear photos: under about 0.1; a heavy veil: 0.3 and up)
  // a picture that is one colour throughout (sepia, cyanotype, black and white): its colour hardly varies pixel to pixel
  // one hue throughout: nearly every coloured pixel within 25° of the picture's average hue (sepia stays sepia however
  // strong); saturation kept modest (a real colour photo of, say, autumn leaves can be mostly one hue but is saturated)
  // How much clearly different colour a picture has: the share of coloured midtone pixels whose hue is more than 60°
  // from the main hue (very bright and very dark pixels, where flakes and glare live, are left out). A toned print
  // (sepia, cyanotype, black and white) has almost none; a colour photo, even badly faded, has some (a blue shirt,
  // grass). Under 1%: toned; 10% and more: colour; between, a faded colour print or a toned one with stains.
  function hueSpread(d) {
    let sx = 0, sy = 0, n = 0; const hs = [], cs = [];
    for (let i = 0; i < d.length; i += 16) { const r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx < 40 || mx > 205 || mx - mn < 8) continue; const c = mx - mn; let h = mx === r ? ((g - b) / c) % 6 : mx === g ? (b - r) / c + 2 : (r - g) / c + 4; h *= Math.PI / 3; hs.push(h); cs.push(c); sx += Math.cos(h); sy += Math.sin(h); n++; }
    if (n < 50) return 0;
    const mean = Math.atan2(sy, sx); let far = 0, strong = 0;
    for (let k = 0; k < hs.length; k++) { if (cs[k] <= 10) continue; strong++; let dd = Math.abs(hs[k] - mean) % (2 * Math.PI); if (dd > Math.PI) dd = 2 * Math.PI - dd; if (dd > Math.PI / 3) far++; }
    return strong ? far / strong : 0;
  }
  const oneHue = (d) => hueSpread(d) < 0.01;
  function isToned(img) { return oneHue(img.data); }
  function hazeLevel(img) { const D = darkChannel(img, Math.max(3, Math.round(Math.max(img.width, img.height) * 0.01))); let t = 0; for (let i = 0; i < D.length; i++) t += D[i]; return t / D.length; }
  function dehaze(img, { strength = 70, keepSome = 0.1 } = {}) {
    const W = img.width, H = img.height, s = img.data, N = W * H, R = Math.max(3, Math.round(Math.max(W, H) * 0.01));
    const D = darkChannel(img, R);
    // the veil's colour: the brightest original pixels among the 0.1% thickest-veil places
    const idx = Array.from({ length: N }, (_, i) => i).sort((a, b) => D[b] - D[a]).slice(0, Math.max(1, Math.floor(N * 0.001)));
    const A = [0, 0, 0]; let bestL = -1; const top = idx.map((i) => [i, s[i * 4] + s[i * 4 + 1] + s[i * 4 + 2]]).sort((a, b) => b[1] - a[1]).slice(0, Math.max(1, Math.floor(idx.length * 0.2)));
    top.forEach(([i]) => { A[0] += s[i * 4]; A[1] += s[i * 4 + 1]; A[2] += s[i * 4 + 2]; }); for (let c = 0; c < 3; c++) A[c] = Math.max(1, A[c] / top.length); void bestL;
    // a toned picture (sepia…): its colour is the tone, not the veil, so the veil is taken as colourless and the tone stays
    if (isToned(img)) { const m = (A[0] + A[1] + A[2]) / 3; A[0] = A[1] = A[2] = m; }
    // transmission from the dark channel of I / A, smoothed along the picture's own edges
    const norm = new ImageData(W, H), nd = norm.data; for (let p = 0; p < N; p++) { for (let c = 0; c < 3; c++) nd[p * 4 + c] = Math.min(255, (s[p * 4 + c] / A[c]) * 255); nd[p * 4 + 3] = 255; }
    const Dn = darkChannel(norm, R), w = 0.95 * (strength / 100), t0 = new Float32Array(N), G = new Float32Array(N);
    for (let p = 0; p < N; p++) { t0[p] = 1 - w * Dn[p]; G[p] = (0.299 * s[p * 4] + 0.587 * s[p * 4 + 1] + 0.114 * s[p * 4 + 2]) / 255; }
    const t = guidedBy(G, t0, W, H, R * 3, 0.001);
    const o = copy(img), d = o.data, tmin = 0.1 + keepSome * 0.3;
    for (let p = 0; p < N; p++) { const tt = Math.max(tmin, Math.min(1, t[p])); for (let c = 0; c < 3; c++) d[p * 4 + c] = clamp((s[p * 4 + c] - A[c]) / tt + A[c]); }
    o.haze = { A: A.map(Math.round), level: +(D.reduce((a, b) => a + b, 0) / N).toFixed(3) };
    return o;
  }

  IC.filters = { cornerBg, defringe, dotsOff, paperClean, toneFrom, colourFrom, colourise, mmpx, deband, chromaRebuild, guidedBy, cas, dehaze, hazeLevel, isToned, shadowRecover, guided, autoColour, clarity, pyramidBlend, aliasCheck, antialias, light, colour, autoLevels, autoFix, whiteBalance, greyscale, sepia, invert, threshold, posterize, blur, sharpen, denoise, median, despeckle, deblock, undither, pixelate, resize, scale2x, scale3x, rotate: rotateAny, rotate90: rotate, flip, crop, trimBox, canvasSize, makeClear, flatten, copy, canvasOf };
})();

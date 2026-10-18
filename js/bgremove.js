/* ImageCraft background remover (window.BGREMOVE; its own copy of the Craft background remover).
   The background is flooded in from the picture's edges (or from a point you click), so only background that touches
   the outside goes: white eyes inside a white-background drawing stay. It follows small colour steps, so shadows,
   gradients and darker corners on a photo's backdrop go too, while the object's edge (a bigger step) stops it.
   remove(src, { mode: 'auto' | 'off' | 'ai' (the AI cut-out, CRAFTAI), actions: [{ t: 'wand', u, v } | { t: 'erase' | 'keep', r (0–1 of the width), pts: [[u, v], …] } | { t: 'lasso', keep: true (trim to inside) | false (cut inside out), pts } | { t: 'invert' } | { t: 'pick', keep: true (keep only that object) | false (take it out), pts: [[u, v, 1 | 0], …] } (AI object picking)], view: 'mask' (also return the picture with the removal shown in red), tolerance: 5–160, max })
   Touch-ups, in order: magic wand clicks (remove the connected area of a similar colour), eraser and restore strokes.
   Magic wand: each click removes the area connected to it whose colour is close to the colour clicked.
   → Promise<{ url (PNG with the background see-through), canvas, colour, removed (0–1) }> */
(function () {
  'use strict';
  const load = (src) => new Promise((res, rej) => { if (src instanceof HTMLImageElement || src instanceof HTMLCanvasElement) return res(src); const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That picture could not be read.')); i.src = src; });

  // the background colour: the most common colour round the edges
  function edgeColour(D, W, H) {
    const bins = new Map(), add = (i) => { if (D[i + 3] < 128) return; const k = (D[i] >> 4) << 8 | (D[i + 1] >> 4) << 4 | (D[i + 2] >> 4); const b = bins.get(k) || [0, 0, 0, 0]; b[0] += D[i]; b[1] += D[i + 1]; b[2] += D[i + 2]; b[3]++; bins.set(k, b); };
    for (let x = 0; x < W; x++) { add(x * 4); add(((H - 1) * W + x) * 4); }
    for (let y = 0; y < H; y++) { add(y * W * 4); add((y * W + W - 1) * 4); }
    let best = null; bins.forEach((b) => { if (!best || b[3] > best[3]) best = b; });
    return best ? [best[0] / best[3], best[1] / best[3], best[2] / best[3]] : null;
  }

  async function remove(src, o = {}) {
    const img = await load(src), max = o.max || 1600;
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, k = Math.min(1, max / Math.max(iw, ih));
    const W = Math.max(1, Math.round(iw * k)), H = Math.max(1, Math.round(ih * k));
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, W, H);
    const id = x.getImageData(0, 0, W, H), D = id.data;
    const orig = new Uint8ClampedArray(D);
    const actions = o.actions || [];
    const tol = o.tolerance ?? 40, step = Math.max(5, Math.min(18, tol * 0.35));
    let bg = edgeColour(D, W, H) || [255, 255, 255];
    // flood from the edges (and the clicked point): a neighbour joins if it is close to the background colour, or only a
    // small step from the pixel it was reached from and still not far from the background (shadows and gradients)
    const seen = new Uint8Array(W * H), q = new Int32Array(W * H); let qh = 0, qt = 0;
    const dist = (i, r, g, b) => Math.hypot(D[i] - r, D[i + 1] - g, D[i + 2] - b);
    const tryAdd = (p, from) => {
      if (seen[p]) return; const i = p * 4;
      if (D[i + 3] < 128) { seen[p] = 1; q[qt++] = p; return; }
      const dBg = dist(i, bg[0], bg[1], bg[2]);
      if (dBg < tol || (from >= 0 && dist(i, D[from * 4], D[from * 4 + 1], D[from * 4 + 2]) < step && dBg < tol * 1.6)) { seen[p] = 1; q[qt++] = p; }
    };
    const spread = () => { while (qh < qt) { const p = q[qh++], px = p % W, py = (p / W) | 0; if (px > 0) tryAdd(p - 1, p); if (px < W - 1) tryAdd(p + 1, p); if (py > 0) tryAdd(p - W, p); if (py < H - 1) tryAdd(p + W, p); } };
    // a model's mask (W2 × H2, 0–255) read at this picture's size
    const maskAt = (m) => { const out = new Uint8Array(W * H); for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) out[yy * W + xx] = m.a[Math.min(m.H - 1, Math.floor(((yy + 0.5) * m.H) / H)) * m.W + Math.min(m.W - 1, Math.floor(((xx + 0.5) * m.W) / W))]; return out; };
    if (o.mode === 'ai') {
      // the AI cut-out: the model's soft mask is the starting point (touch-ups follow as usual)
      const m = maskAt(await CRAFTAI.cutout(src));
      for (let p = 0; p < W * H; p++) D[p * 4 + 3] = Math.min(D[p * 4 + 3], m[p]);
    } else if (o.mode !== 'off') {
      for (let xx = 0; xx < W; xx++) { tryAdd(xx, -1); tryAdd((H - 1) * W + xx, -1); }
      for (let yy = 0; yy < H; yy++) { tryAdd(yy * W, -1); tryAdd(yy * W + W - 1, -1); }
      spread();
    }
    // the automatic removal, with a one-pixel soft edge so cut-outs are not jagged
    if (o.mode !== 'ai') for (let p = 0; p < W * H; p++) if (seen[p]) D[p * 4 + 3] = 0;
    if (o.mode !== 'ai') for (let yy = 1; yy < H - 1; yy++) for (let xx = 1; xx < W - 1; xx++) {
      const p = yy * W + xx; if (seen[p]) continue;
      const n = seen[p - 1] + seen[p + 1] + seen[p - W] + seen[p + W]; if (n) D[p * 4 + 3] = Math.min(D[p * 4 + 3], 255 - n * 45);
    }
    // then every touch-up in the order it was done (so Invert flips everything before it)
    let sc = null, sx2 = null;
    const shapeMask = (a) => {
      if (!sc) { sc = document.createElement('canvas'); sc.width = W; sc.height = H; sx2 = sc.getContext('2d', { willReadFrequently: true }); }
      sx2.clearRect(0, 0, W, H); sx2.strokeStyle = sx2.fillStyle = '#fff'; sx2.lineWidth = Math.max(1, (a.r || 0) * W * 2); sx2.lineCap = sx2.lineJoin = 'round';
      sx2.beginPath(); a.pts.forEach(([u, v], i) => (i ? sx2.lineTo(u * W, v * H) : sx2.moveTo(u * W, v * H)));
      if (a.t === 'lasso') { sx2.closePath(); sx2.fill(); }
      else if (a.pts.length === 1) { sx2.arc(a.pts[0][0] * W, a.pts[0][1] * H, a.r * W, 0, Math.PI * 2); sx2.fill(); } else sx2.stroke();
      return sx2.getImageData(0, 0, W, H).data;
    };
    for (const a of actions) {
      if (a.t === 'invert') { for (let p = 0; p < W * H; p++) D[p * 4 + 3] = orig[p * 4 + 3] - D[p * 4 + 3]; continue; }
      if (a.t === 'pick') {
        // AI object picking: the object under the clicks (green points), not the red ones; keep just it, or take it out
        const m = maskAt(await CRAFTAI.pick(src, a.pts));
        for (let p = 0; p < W * H; p++) { const k2 = m[p] / 255; D[p * 4 + 3] = Math.round(D[p * 4 + 3] * (a.keep ? k2 : 1 - k2)); }
        continue;
      }
      if (a.t === 'wand') {
        // the colour under the click, spread to the connected area close to that colour (in the picture as it was)
        seen.fill(0); qh = qt = 0;
        const sx = Math.min(W - 1, Math.max(0, Math.round(a.u * W))), sy = Math.min(H - 1, Math.max(0, Math.round(a.v * H))), p0 = sy * W + sx;
        bg = [orig[p0 * 4], orig[p0 * 4 + 1], orig[p0 * 4 + 2]];
        const keepA = D.slice(); for (let p = 0; p < W * H; p++) D[p * 4 + 3] = orig[p * 4 + 3]; // flood on the picture, not on what is already see-through
        seen[p0] = 1; q[qt++] = p0; spread();
        for (let p = 0; p < W * H; p++) D[p * 4 + 3] = seen[p] ? 0 : keepA[p * 4 + 3];
        continue;
      }
      const mk = shapeMask(a);
      // the lasso: trim keeps only the inside (everything outside goes); cut takes the inside out
      if (a.t === 'lasso') { for (let p = 0; p < W * H; p++) { const inside = mk[p * 4 + 3] / 255; D[p * 4 + 3] = Math.round(D[p * 4 + 3] * (a.keep ? inside : 1 - inside)); } continue; }
      for (let p = 0; p < W * H; p++) { const k2 = mk[p * 4 + 3] / 255; if (!k2) continue; D[p * 4 + 3] = a.t === 'erase' ? Math.round(D[p * 4 + 3] * (1 - k2)) : Math.round(D[p * 4 + 3] + (orig[p * 4 + 3] - D[p * 4 + 3]) * k2); }
    }
    let removed = 0; for (let p = 0; p < W * H; p++) if (D[p * 4 + 3] < 128) removed++;
    // the mask view: the picture with what is taken out shown in red
    if (o.view === 'mask') {
      const mv = new Uint8ClampedArray(orig);
      for (let p = 0; p < W * H; p++) { const k3 = 1 - D[p * 4 + 3] / Math.max(1, orig[p * 4 + 3]); mv[p * 4] = orig[p * 4] * (1 - k3 * 0.6) + 230 * k3 * 0.6; mv[p * 4 + 1] = orig[p * 4 + 1] * (1 - k3 * 0.6) + 40 * k3 * 0.6; mv[p * 4 + 2] = orig[p * 4 + 2] * (1 - k3 * 0.6) + 60 * k3 * 0.6; mv[p * 4 + 3] = 255; }
      const vc = document.createElement('canvas'); vc.width = W; vc.height = H; vc.getContext('2d').putImageData(new ImageData(mv, W, H), 0, 0);
      x.putImageData(id, 0, 0);
      return { url: c.toDataURL('image/png'), canvas: c, view: vc.toDataURL('image/png'), colour: bg, removed: removed / (W * H) };
    }
    x.putImageData(id, 0, 0);
    return { url: c.toDataURL('image/png'), canvas: c, colour: bg, removed: removed / (W * H) };
  }
  window.BGREMOVE = { remove };
})();

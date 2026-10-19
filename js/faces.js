/* ImageCraft faces (IC.faces): faces found with MediaPipe Face Landmarker (Google, Apache-2.0; 478 points a face, eyes,
   irises, lips, brows and outline), turned into maps of each part. Nothing is redrawn or invented: the parts are only
   found, so each can be treated as itself (skin smoothed, eyes cleared, eye whites and teeth used as a grey card).
     detect(img) → Promise<[{ box, points: [[x, y]…478] }]>   (remembered per picture; small faces in group photos are
                    also looked for in overlapping tiles, enlarged)
     partMask(img, faces, part) → Float32Array 0–1   parts: face, skin, eyes, irises, eyewhites, lips, mouth, brows
     greyCard(img, faces) → [r, g, b] | null   the average of the eye whites and teeth (the brighter part of them)
   The library (lib/craft-face-libs.js, 150 KB) loads when first needed; its WebAssembly files and the 4 MB model come
   from jsDelivr and Google's model store the first time and are cached by the browser. */
(function () {
  'use strict';
  const IC = (window.IC = window.IC || {});
  const VER = '1.0.1', WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}/wasm`, MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
  let libP = null, lmP = null;
  const log = (lv, m, d) => { if (window.ICLOG) ICLOG.add(lv, m, d); };
  function lib() {
    if (window.CraftFace) return Promise.resolve(window.CraftFace);
    if (!libP) libP = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'lib/craft-face-libs.js'; s.onload = () => res(window.CraftFace); s.onerror = () => { libP = null; rej(new Error('The face library (lib/craft-face-libs.js) is missing from the ImageCraft folder.')); }; document.head.append(s); });
    return libP;
  }
  function landmarker() {
    if (!lmP) lmP = (async () => {
      const F = await lib(), files = await F.FilesetResolver.forVisionTasks(WASM);
      const opts = (delegate) => ({ baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: 'IMAGE', numFaces: 12, minFaceDetectionConfidence: 0.3, minFacePresenceConfidence: 0.3, minTrackingConfidence: 0.3 });
      try { return await F.FaceLandmarker.createFromOptions(files, opts('GPU')); }
      catch (e) { log('warn', 'Face finder: the graphics card could not be used, the processor is used instead', e); return F.FaceLandmarker.createFromOptions(files, opts('CPU')); }
    })().catch((e) => { lmP = null; throw e; });
    return lmP;
  }
  const canvasOf = (img) => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').putImageData(img, 0, 0); return c; };
  // one look at a canvas: faces with their points in the canvas's pixels
  function look(lm, c) { const r = lm.detect(c); return (r.faceLandmarks || []).map((pts) => pts.map((p) => [p.x * c.width, p.y * c.height])); }
  const boxOf = (pts) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of pts) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; } return [x0, y0, x1, y1]; };
  const iou = (a, b) => { const ix = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])), iy = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1])), i = ix * iy, u = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - i; return u > 0 ? i / u : 0; };
  const memo = new WeakMap();
  // The face finder is made for faces that fill a good part of the frame, so a group photo is also searched in
  // overlapping tiles, each enlarged to about 640 pixels; the same face found twice is kept once.
  // The face finder is made for faces that fill a good part of the frame and for modern contrast, so the picture is
  // also searched with its contrast brought up, and in overlapping tiles (2 × 2 up to 4 × 4), each enlarged to about
  // 640 pixels. A face counts when it is found at least twice (in different tiles, sizes or copies) or in the whole
  // picture: real faces are found again and again, a face-like pattern on a shirt rarely is.
  function detect(img) {
    if (memo.has(img)) return memo.get(img);
    const p = (async () => {
      const lm = await landmarker(), W = img.width, H = img.height, X = IC.filters;
      const copies = [canvasOf(img)];
      try { const e = IC.restore && IC.restore.clahe ? IC.restore.clahe(X.autoLevels(img, { clip: 0.5, perChannel: false }), { clip: 3, amount: 100 }) : X.autoLevels(img); copies.push(canvasOf(e)); } catch (err) { /* only the original */ }
      const hits = []; // { box, points, n, whole }
      const add = (list, whole) => list.forEach((pts) => { const bx = boxOf(pts); if (bx[2] - bx[0] < 8) return; const h = hits.find((f) => iou(f.box, bx) > 0.3); if (h) { h.n++; h.whole = h.whole || whole; if (bx[2] - bx[0] > h.box[2] - h.box[0]) { h.box = bx; h.points = pts; } } else hits.push({ box: bx, points: pts, n: 1, whole }); });
      for (const src of copies) {
        add(look(lm, src), true);
        for (const n of [2, 3, 4]) {
          if (Math.min(W, H) / n < 60) continue;
          const tw = Math.min(W, (W / n) * 1.5), th = Math.min(H, (H / n) * 1.5);
          for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
            const x0 = Math.max(0, Math.min(W - tw, (i * W) / n - tw / 6)), y0 = Math.max(0, Math.min(H - th, (j * H) / n - th / 6)), k = 640 / Math.max(tw, th);
            const c = document.createElement('canvas'); c.width = Math.round(tw * k); c.height = Math.round(th * k); const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(src, x0, y0, tw, th, 0, 0, c.width, c.height);
            add(look(lm, c).map((pts) => pts.map(([px, py]) => [x0 + px / k, y0 + py / k])), false);
            await new Promise((r) => setTimeout(r, 0));
          }
        }
      }
      const faces = hits.filter((h) => h.n >= 2 || h.whole).map(({ box, points, n }) => ({ box, points, seen: n }));
      log('info', `Faces found: ${faces.length} (of ${hits.length} candidates)`);
      return faces;
    })();
    memo.set(img, p); p.catch(() => memo.delete(img));
    return p;
  }
  const done = new WeakMap(); // the found faces, once known (for the maps, which are worked out at once)
  const known = (img) => done.get(img) || null;
  async function ensure(img) { const f = await detect(img); done.set(img, f); return f; }

  // connection lists (pairs) → closed loops of point numbers (a list can hold several loops: lips outer and inner)
  function loops(conns) {
    const next = new Map(); conns.forEach(({ start, end }) => { if (!next.has(start)) next.set(start, []); next.get(start).push(end); });
    const used = new Set(), out = [];
    for (const { start } of conns) {
      if (used.has(start)) continue; const loop = [start]; used.add(start); let cur = start;
      for (let k = 0; k < 600; k++) { const nx = (next.get(cur) || []).find((v) => !used.has(v)); if (nx == null) break; loop.push(nx); used.add(nx); cur = nx; }
      if (loop.length > 2) out.push(loop);
    }
    return out;
  }
  const area = (poly) => { let a = 0; for (let i = 0; i < poly.length; i++) { const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length]; a += x1 * y2 - x2 * y1; } return Math.abs(a) / 2; };
  let L = null; // the connection lists, once the library is loaded
  const lists = () => { const F = window.CraftFace.FaceLandmarker; return L || (L = { oval: F.FACE_LANDMARKS_FACE_OVAL, leye: F.FACE_LANDMARKS_LEFT_EYE, reye: F.FACE_LANDMARKS_RIGHT_EYE, liris: F.FACE_LANDMARKS_LEFT_IRIS, riris: F.FACE_LANDMARKS_RIGHT_IRIS, lips: F.FACE_LANDMARKS_LIPS, lbrow: F.FACE_LANDMARKS_LEFT_EYEBROW, rbrow: F.FACE_LANDMARKS_RIGHT_EYEBROW }); };
  // a part of every face drawn as a soft-edged mask
  function partMask(img, faces, part) {
    const W = img.width, H = img.height, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    if (!faces || !faces.length || !window.CraftFace) return new Float32Array(W * H);
    const C = lists();
    const fillLoops = (pts, conns, which = 'all', color = '#fff') => { let ls = loops(conns).map((l) => l.map((i) => pts[i])); if (which !== 'all') { ls.sort((a, b) => area(b) - area(a)); ls = which === 'outer' ? ls.slice(0, 1) : ls.slice(1, 2); } x.fillStyle = color; ls.forEach((poly) => { x.beginPath(); poly.forEach(([px, py], k) => (k ? x.lineTo(px, py) : x.moveTo(px, py))); x.closePath(); x.fill(); }); };
    const iris = (pts, conns, color = '#fff') => { const ids = [...new Set(conns.flatMap((e) => [e.start, e.end]))], P = ids.map((i) => pts[i]), cx = P.reduce((t, p) => t + p[0], 0) / P.length, cy = P.reduce((t, p) => t + p[1], 0) / P.length, r = P.reduce((t, p) => t + Math.hypot(p[0] - cx, p[1] - cy), 0) / P.length; x.fillStyle = color; x.beginPath(); x.arc(cx, cy, r * 1.05, 0, Math.PI * 2); x.fill(); };
    for (const f of faces) {
      const p = f.points;
      if (part === 'face' || part === 'skin') fillLoops(p, C.oval);
      if (part === 'skin') { x.globalCompositeOperation = 'destination-out'; [C.leye, C.reye, C.lbrow, C.rbrow].forEach((cn) => fillLoops(p, cn)); fillLoops(p, C.lips, 'outer'); x.globalCompositeOperation = 'source-over'; }
      if (part === 'eyes' || part === 'eyewhites') { fillLoops(p, C.leye); fillLoops(p, C.reye); }
      if (part === 'eyewhites') { x.globalCompositeOperation = 'destination-out'; iris(p, C.liris); iris(p, C.riris); x.globalCompositeOperation = 'source-over'; }
      if (part === 'irises') { // only the part of each iris inside the eye opening
        x.save(); const eye = new Path2D(); [C.leye, C.reye].forEach((cn) => loops(cn).forEach((l) => { l.forEach((i, k) => (k ? eye.lineTo(...p[i]) : eye.moveTo(...p[i]))); eye.closePath(); })); x.clip(eye); iris(p, C.liris); iris(p, C.riris); x.restore(); }
      if (part === 'lips') { fillLoops(p, C.lips, 'outer'); x.globalCompositeOperation = 'destination-out'; fillLoops(p, C.lips, 'inner'); x.globalCompositeOperation = 'source-over'; }
      if (part === 'mouth') fillLoops(p, C.lips, 'inner');
      if (part === 'brows') { fillLoops(p, C.lbrow); fillLoops(p, C.rbrow); }
    }
    // soft edges: a little blur, scaled to the face size
    const fs = Math.max(...faces.map((f) => f.box[2] - f.box[0])), r = Math.max(1, Math.round(fs * (part === 'skin' || part === 'face' ? 0.02 : 0.008)));
    const c2 = document.createElement('canvas'); c2.width = W; c2.height = H; const x2 = c2.getContext('2d'); x2.filter = `blur(${r}px)`; x2.drawImage(c, 0, 0);
    const d = x2.getImageData(0, 0, W, H).data, o = new Float32Array(W * H); for (let i = 0; i < o.length; i++) o[i] = d[i * 4 + 3] / 255;
    return o;
  }
  // the colour cast as eye whites and teeth show it: their brighter half, averaged (they are near-neutral in life)
  function greyCard(img, faces) {
    if (!faces || !faces.length) return null;
    const a = partMask(img, faces, 'eyewhites'), b = partMask(img, faces, 'mouth'), d = img.data, px = [];
    for (let i = 0; i < a.length; i++) if (a[i] > 0.6 || b[i] > 0.6) px.push([d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]);
    if (px.length < 12) return null;
    px.sort((u, v) => v[0] + v[1] + v[2] - (u[0] + u[1] + u[2])); const top = px.slice(0, Math.max(6, Math.floor(px.length * 0.45)));
    return [0, 1, 2].map((c) => top.reduce((t, p) => t + p[c], 0) / top.length);
  }
  IC.faces = { detect, ensure, known, partMask, greyCard, PARTS: [['face', 'Faces'], ['skin', 'Face skin'], ['eyes', 'Eyes'], ['irises', 'Irises'], ['eyewhites', 'Eye whites'], ['lips', 'Lips'], ['mouth', 'Mouth and teeth'], ['brows', 'Eyebrows']] };
})();

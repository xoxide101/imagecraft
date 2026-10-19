/* ImageCraft: the window. Pictures open into a list (several at once for batch work); each picture keeps its steps, so
   every change can be undone or compared with the original. Tools open in the right-hand panel with a live preview,
   and Apply makes them a step. Nothing touches the file on disk until Save as. */
(function () {
  'use strict';
  const IC = window.IC, F = IC.formats, C = IC.colour, X = IC.filters, A = IC.ascii;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const I = window.CraftIcons;
  const fmtN = (n) => n.toLocaleString('en-GB');
  const kb = (b) => (b < 1024 ? `${b} bytes` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(2)} MB`);
  const hexOf = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ribbon icons (24 × 24; parts with class "fill" take the tab's colour)
  const IK = {
    resize: '<rect x="3" y="9" width="12" height="12" rx="1.5" class="fill"/><path d="M13 3h8v8M21 3l-8 8"/>',
    crop: '<path d="M6 2v16h16"/><path d="M2 6h16v16"/><rect x="9" y="9" width="6" height="6" class="fill" stroke="none"/>',
    canvas: '<rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="3 2"/><rect x="7" y="7" width="10" height="10" rx="1" class="fill"/>',
    straighten: '<path d="M3 17 21 7"/><path d="M3 20h18"/><circle cx="12" cy="12" r="2.2" class="fill"/>',
    flipH: '<path d="M12 3v18" stroke-dasharray="2 2"/><path d="M9 7 3 17h6Z" class="fill"/><path d="M15 7l6 10h-6Z"/>',
    flipV: '<path d="M3 12h18" stroke-dasharray="2 2"/><path d="M7 9 17 3v6Z" class="fill"/><path d="M7 15l10 6v-6Z"/>',
    light: '<circle cx="12" cy="12" r="4.5" class="fill"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    colour: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" class="fill"/>',
    auto: '<path d="m4 20 10-10"/><path d="m12 8 4 4"/><path d="M17 3l.8 2.2L20 6l-2.2.8L17 9l-.8-2.2L14 6l2.2-.8Z" class="fill"/><path d="M6 4l.5 1.5L8 6l-1.5.5L6 8l-.5-1.5L4 6l1.5-.5Z"/>',
    balance: '<path d="M12 3v18M5 21h14M4 8h16"/><path d="M4 8l-2 6a3 3 0 0 0 4 0Z" class="fill"/><path d="M20 8l-2 6a3 3 0 0 0 4 0Z"/>',
    grey: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18Z" class="fill"/>',
    sepia: '<rect x="3" y="5" width="18" height="14" rx="2" class="fill"/><path d="m6 16 4-5 3 3 2-2 3 4"/>',
    invert: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 21 21 3v18Z" class="fill"/>',
    threshold: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 3v18h8V3" class="fill"/>',
    posterize: '<rect x="3" y="4" width="6" height="16" rx="1" class="fill"/><rect x="9" y="4" width="6" height="16" rx="1"/><rect x="15" y="4" width="6" height="16" rx="1" class="fill" opacity=".5"/>',
    blur: '<circle cx="12" cy="12" r="8" class="fill" opacity=".35"/><circle cx="12" cy="12" r="5" class="fill" opacity=".6"/><circle cx="12" cy="12" r="2.5" class="fill"/>',
    sharpen: '<path d="M12 3 21 20H3Z" class="fill"/><path d="M12 9v6M12 18h.01"/>',
    depth: '<rect x="3" y="3" width="8" height="8" rx="1.5" class="fill"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5" class="fill" opacity=".5"/>',
    retro: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M6 8h3v3H6zM9 11h3v3H9zM12 8h3v3h-3z" class="fill" stroke="none"/>',
    palette: '<path d="M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-1.5 2-1.5h2a4 4 0 0 0 4-4c0-4.5-4-8-9-8Z"/><circle cx="7.5" cy="11" r="1.5" class="fill"/><circle cx="10" cy="7" r="1.5" class="fill"/><circle cx="15" cy="7.5" r="1.5" class="fill"/>',
    denoise: '<path d="M3 15c3-4 5 4 9 0s6 4 9 0" /><circle cx="6" cy="7" r="1" class="fill"/><circle cx="12" cy="5" r="1" class="fill"/><circle cx="17" cy="8" r="1" class="fill"/>',
    dust: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="9" r="1.2" class="fill"/><circle cx="15" cy="14" r="1.2" class="fill"/><path d="m14 5-3 6" />',
    jpeg: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18" opacity=".6"/><rect x="9" y="9" width="6" height="6" class="fill" stroke="none"/>',
    undither: '<path d="M4 4h2v2H4zM8 4h2v2H8zM6 6h2v2H6zM4 8h2v2H4zM8 8h2v2H8z" class="fill" stroke="none"/><path d="M12 7h3l2 2"/><rect x="14" y="11" width="7" height="9" rx="2" class="fill"/>',
    cutout: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8 16 18 4M16 16 6 4"/><circle cx="12" cy="7" r="2" class="fill"/>',
    clearC: '<rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="3 2"/><path d="m14 4 6 6-8 8H8v-4Z" class="fill"/>',
    upscale: '<rect x="3" y="13" width="8" height="8" rx="1" class="fill"/><path d="M13 3h8v8"/><path d="M21 3 13 11"/><path d="M3 9V3h6" opacity=".5"/>',
    modern: '<path d="M4 20 15 9"/><path d="M14 3l1.2 3L18 7l-2.8 1L14 11l-1-3-3-1 3-1Z" class="fill"/><path d="M19 12l.7 1.7L21.5 14.5l-1.8.7L19 17l-.7-1.8L16.5 14.5l1.8-.8Z"/>',
    svg: '<path d="M4 20c4-12 12-12 16-16"/><circle cx="4" cy="20" r="2" class="fill"/><circle cx="20" cy="4" r="2" class="fill"/><path d="M8 8h4v4"/>',
    pixels: '<path d="M4 4h5v5H4zM9 9h5v5H9zM14 4h5v5h-5zM4 14h5v5H4zM14 14h5v5h-5z" class="fill" stroke="none"/>',
    ascii: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 9h2M10 9h1M13 9h3M6 13h4M12 13h2M6 17h1M9 17h5" class="fill"/>',
    batch: '<rect x="7" y="3" width="14" height="11" rx="1.5"/><rect x="5" y="6" width="14" height="11" rx="1.5"/><rect x="3" y="9" width="14" height="11" rx="1.5" class="fill"/>',
    ai: '<rect x="5" y="5" width="14" height="14" rx="3" class="fill"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/><path d="M9.5 15 12 9l2.5 6M10.4 13h3.2"/>',
    compare: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 2v20"/><path d="M3 4h9v16H3Z" class="fill" opacity=".6"/>',
    grid: '<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>',
    pixelate: '<path d="M3 3h6v6H3zM15 3h6v6h-6zM9 9h6v6H9zM3 15h6v6H3zM15 15h6v6h-6z" class="fill" stroke="none"/>',
    revert: '<path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.5"/><path d="M4 3v5.5h5.5"/><circle cx="12" cy="12" r="2" class="fill"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  };
  const LOGO = `<svg viewBox="0 0 40 40" aria-hidden="true"><defs><linearGradient id="ic-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3fb5ff"/><stop offset=".5" stop-color="#6a5cff"/><stop offset="1" stop-color="#b44be1"/></linearGradient></defs><rect x="1" y="1" width="38" height="38" rx="11" fill="url(#ic-g)"/><rect x="8" y="10" width="24" height="20" rx="3" fill="none" stroke="#fff" stroke-width="2.4"/><path d="m11 27 6-7 4 4 3-3 5 6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="25.5" cy="15.5" r="2.2" fill="#ffe066"/><path d="M8 18h3v3H8zM11 21h3v3h-3z" fill="#fff" opacity=".85"/></svg>`;

  // ------------------------------------------------------------------ messages
  const toastEl = $('toast'); let toastT;
  function toast(m) { if (window.ICLOG) ICLOG.add(/error|not |cannot|could not|failed|missing/i.test(m) ? 'warn' : 'info', 'Message shown: ' + m); toastEl.textContent = m; toastEl.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { toastEl.hidden = true; }, 3600); }
  function info(title, html) { $('info-title').textContent = title; $('info-body').innerHTML = html; $('info').hidden = false; $('info-close').focus(); }
  $('info-close').onclick = () => { $('info').hidden = true; };
  function ask(title, body, yes = 'OK') {
    return new Promise((res) => {
      $('ask-title').textContent = title; $('ask-body').textContent = body; $('ask-yes').textContent = yes; $('ask').hidden = false; $('ask-yes').focus();
      const done = (v) => { $('ask').hidden = true; res(v); };
      $('ask-yes').onclick = () => done(true); $('ask-no').onclick = () => done(false);
    });
  }
  let busyT = null;
  function busy(msg) { clearTimeout(busyT); if (!msg) { $('busy').hidden = true; return; } busyT = setTimeout(() => { $('busy').textContent = msg; $('busy').hidden = false; }, 250); }
  const busyNow = (msg) => { clearTimeout(busyT); $('busy').textContent = msg; $('busy').hidden = false; };
  function download(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  // a dialog made on the spot (batch convert and other one-off windows)
  function dialog(title, body, buttons) {
    const back = document.createElement('div'); back.className = 'backdrop';
    back.innerHTML = `<div class="dialog wide" role="dialog" aria-modal="true"><h2>${esc(title)}</h2><div class="dialog-body"></div><div class="dialog-actions"></div></div>`;
    back.querySelector('.dialog-body').append(body);
    const close = () => back.remove(), acts = back.querySelector('.dialog-actions');
    buttons.forEach((b) => { const e = document.createElement('button'); e.className = 'btn' + (b.primary ? ' primary' : ''); e.textContent = b.label; e.onclick = () => (b.run ? b.run(close, e) : close()); acts.append(e); });
    back.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    document.body.append(back); return { back, close, acts };
  }

  // ------------------------------------------------------------------ pictures and their steps
  const pics = []; let cur = -1;
  const pic = () => pics[cur];
  const now = () => (pic() ? pic().steps[pic().at].img : null);
  const baseName = (n) => (n || 'picture').replace(/\.[a-z0-9]+$/i, '');
  const MAX_STEPS = 24;
  function addPic(name, img, info, size) {
    pics.push({ name, info: info || {}, size: size || 0, steps: [{ label: `Opened (${info && info.format ? info.format : 'picture'})`, img }], at: 0, dirty: false });
    select(pics.length - 1, true);
  }
  function select(i, fresh) {
    if (tool) closeTool(true); if (mapView) { mapView = null; $('mapbar').hidden = true; }
    cur = i; view.fit = true; renderPics(); renderHist(); renderProps(); show(); fitView(); status();
    $('welcome').hidden = !!pic(); $('stage').hidden = !pic();
    if (fresh) colourCount();
  }
  function push(label, img) {
    const p = pic(); p.steps.length = p.at + 1; p.steps.push({ label, img });
    if (p.steps.length > MAX_STEPS) p.steps.splice(1, 1);
    p.at = p.steps.length - 1; p.dirty = true; afterChange();
  }
  function afterChange() { if (mapView) { mapView = null; $('mapbar').hidden = true; } renderPics(); renderHist(); renderProps(); show(); if (view.fit) fitView(); status(); colourCount(); }
  const canUndo = () => !!pic() && pic().at > 0 && !tool;
  const canRedo = () => !!pic() && pic().at < pic().steps.length - 1 && !tool;
  function undo() { if (tool) { closeTool(); return; } if (canUndo()) { pic().at--; afterChange(); } }
  function redo() { if (canRedo()) { pic().at++; afterChange(); } }
  function goStep(i) { if (tool) closeTool(true); pic().at = i; afterChange(); }
  async function closePic(i) {
    if (pics[i].dirty && !(await ask('Close this picture?', `“${pics[i].name}” has changes that are not saved. Close it anyway?`, 'Close'))) return;
    if (tool && i === cur) closeTool(true);
    pics.splice(i, 1); select(Math.min(cur, pics.length - 1));
    if (!pics.length) { cur = -1; $('welcome').hidden = false; $('stage').hidden = true; renderProps(); status(); }
  }

  // how many colours (counted after each change, without holding things up)
  let countT = null;
  function colourCount() {
    clearTimeout(countT); const st = pic() && pic().steps[pic().at]; if (!st || st.colours != null) { status(); return; }
    countT = setTimeout(() => { if (st.img.width * st.img.height > 6e6) { st.colours = -1; } else st.colours = F.countColours(st.img); status(); if (!tool) renderProps(); }, 60);
  }

  // ------------------------------------------------------------------ opening
  async function openFiles(files) {
    const list = [...files].filter(Boolean); let n = 0;
    for (const f of list) {
      busyNow(`Opening ${f.name}…`);
      const t0 = performance.now();
      try { const r = await F.read(f); addPic(f.name, r.img, r.info, f.size); n++; ICLOG.info(`Opened ${f.name}: ${r.info.format}, ${r.img.width} × ${r.img.height}, ${kb(f.size || 0)} (${Math.round(performance.now() - t0)} ms)`); }
      catch (e) { ICLOG.error(`Could not open ${f.name}`, e); toast(`${f.name}: ${e.message || 'could not be read'}`); }
    }
    busy(null);
    if (n > 1) toast(`${n} pictures opened. Batch convert (Convert tab) saves them all at once.`);
  }
  const openInput = $('open-input'); openInput.accept = F.ACCEPT;
  const pickFiles = () => { openInput.value = ''; openInput.click(); };
  openInput.onchange = () => openFiles(openInput.files);
  $('welcome-open').onclick = pickFiles; $('pics-open').onclick = pickFiles;
  ['dragenter', 'dragover'].forEach((t) => $('desk').addEventListener(t, (e) => { e.preventDefault(); $('desk').classList.add('over'); }));
  ['dragleave', 'drop'].forEach((t) => $('desk').addEventListener(t, (e) => { e.preventDefault(); if (t === 'drop' || e.target === $('desk')) $('desk').classList.remove('over'); }));
  $('desk').addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer.files.length) openFiles(e.dataTransfer.files); });
  document.addEventListener('paste', (e) => {
    if (/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    const files = [...(e.clipboardData ? e.clipboardData.files : [])]; if (!files.length) return;
    e.preventDefault(); openFiles(files.map((f, i) => (f.name && f.name !== 'image.png' ? f : new File([f], `Pasted picture ${i + 1}.png`, { type: f.type }))));
  });
  async function copyPicture() {
    if (!now()) return;
    try { const b = await F.write(now(), 'png', { bits: 32 }); await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]); toast('Picture copied. Paste it into another program.'); }
    catch (e) { toast('This browser would not copy the picture (it may need the page to be open in a tab with focus).'); }
  }

  // ------------------------------------------------------------------ the view: zoom, pan, compare
  const view = { zoom: 1, x: 0, y: 0, fit: true, bg: 'check', compare: false, split: 0.5, grid: false };
  let mapView = null; // { id, mode: 'heat' | 'grey', img }
  const shown = () => (mapView && mapView.img) || (tool && tool.preview) || now();
  function show() {
    const img = shown(); if (!img) return;
    const v = $('view'); if (v.width !== img.width || v.height !== img.height) { v.width = img.width; v.height = img.height; }
    v.getContext('2d').putImageData(img, 0, 0);
    const b = compareBase(), v0 = $('view0');
    if (view.compare && b) { if (v0.width !== b.width || v0.height !== b.height) { v0.width = b.width; v0.height = b.height; } v0.getContext('2d').putImageData(b, 0, 0); }
    layout();
  }
  // the picture compared against: before the open tool, or else the original
  const compareBase = () => (tool && tool.preview ? tool.base : pic() ? pic().steps[0].img : null);
  function layout() {
    const img = shown(); if (!img) return;
    const st = $('stage'), W = img.width * view.zoom, H = img.height * view.zoom;
    st.style.width = W + 'px'; st.style.height = H + 'px'; st.style.transform = `translate(${Math.round(view.x)}px, ${Math.round(view.y)}px)`;
    st.className = `stage ${view.bg}${view.zoom >= 2 ? ' pixels' : ''}`;
    const cmp = view.compare && !!compareBase();
    $('before').hidden = !cmp; $('split').hidden = !cmp; $('tag-before').hidden = !cmp; $('tag-after').hidden = !cmp;
    if (cmp) { $('before').style.width = view.split * W + 'px'; const v0 = $('view0'); v0.style.width = W + 'px'; v0.style.height = H + 'px'; $('split').style.left = view.split * W - 1 + 'px'; $('tag-before').textContent = tool && tool.preview ? 'Before' : 'Original'; }
    const g = $('gridlines'); g.hidden = !(view.grid && view.zoom >= 6);
    if (!g.hidden) { g.width = Math.min(4096, W); g.height = Math.min(4096, H); g.style.width = W + 'px'; g.style.height = H + 'px'; const x = g.getContext('2d'); x.clearRect(0, 0, g.width, g.height); x.strokeStyle = 'rgba(128,128,128,.55)'; x.lineWidth = 1; x.beginPath(); for (let i = 1; i < img.width; i++) { const p = Math.round(i * view.zoom * (g.width / W)) + 0.5; x.moveTo(p, 0); x.lineTo(p, g.height); } for (let j = 1; j < img.height; j++) { const p = Math.round(j * view.zoom * (g.height / H)) + 0.5; x.moveTo(0, p); x.lineTo(g.width, p); } x.stroke(); }
    if (tool && tool.def.id === 'crop') placeCrop();
    zoomUI();
  }
  function fitView() {
    const img = shown(); if (!img) return; const r = $('desk').getBoundingClientRect();
    let z = Math.min((r.width - 40) / img.width, (r.height - 40) / img.height);
    if (z > 1) z = Math.min(16, Math.floor(z)); // small pictures grow by whole steps, so pixels stay square
    view.zoom = Math.max(0.02, z); view.x = (r.width - img.width * view.zoom) / 2; view.y = (r.height - img.height * view.zoom) / 2; view.fit = true; layout();
  }
  function setZoom(z, cx, cy) {
    const img = shown(); if (!img) return; const r = $('desk').getBoundingClientRect();
    if (cx == null) { cx = r.width / 2; cy = r.height / 2; }
    z = Math.max(0.02, Math.min(64, z)); view.x = cx - ((cx - view.x) * z) / view.zoom; view.y = cy - ((cy - view.y) * z) / view.zoom; view.zoom = z; view.fit = false; layout();
  }
  const zoomBy = (k) => setZoom(view.zoom * k);
  const actual = () => setZoom(1);
  new ResizeObserver(() => { if (view.fit) fitView(); else layout(); }).observe($('desk'));
  $('desk').addEventListener('wheel', (e) => { if (!shown()) return; e.preventDefault(); const r = $('desk').getBoundingClientRect(); setZoom(view.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  // where a pointer is on the picture (in picture pixels)
  const atPic = (e) => { const r = $('desk').getBoundingClientRect(); return [(e.clientX - r.left - view.x) / view.zoom, (e.clientY - r.top - view.y) / view.zoom]; };
  let drag = null;
  $('desk').addEventListener('pointerdown', (e) => {
    if (!shown() || e.target.closest('.welcome') || e.target.closest('.cropbox')) return;
    if (e.target === $('split')) { drag = { kind: 'split' }; $('desk').setPointerCapture(e.pointerId); return; }
    const [px, py] = atPic(e), img = shown();
    if (e.button === 0 && tool && tool.def.pick && px >= 0 && py >= 0 && px < img.width && py < img.height) { const i = ((py | 0) * img.width + (px | 0)) * 4, d = (tool.base || img).data; tool.def.pick(tool.s, [d[i], d[i + 1], d[i + 2]], px / img.width, py / img.height); renderProps(); schedule(0); return; }
    if (e.button === 0 && tool && tool.def.id === 'crop' && px >= 0 && py >= 0 && px < img.width && py < img.height) { drag = { kind: 'newcrop', x0: px, y0: py }; $('desk').setPointerCapture(e.pointerId); return; }
    if (e.button === 0 || e.button === 1) { e.preventDefault(); drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }; $('desk').classList.add('panning'); $('desk').setPointerCapture(e.pointerId); }
  });
  $('desk').addEventListener('pointermove', (e) => {
    const img = shown();
    if (img && !drag) { const [px, py] = atPic(e); hover = px >= 0 && py >= 0 && px < img.width && py < img.height ? [px | 0, py | 0] : null; statusHover(); }
    if (!drag) return;
    if (drag.kind === 'pan') { view.x = drag.vx + e.clientX - drag.sx; view.y = drag.vy + e.clientY - drag.sy; view.fit = false; layout(); }
    else if (drag.kind === 'split') { const r = $('stage').getBoundingClientRect(); view.split = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); layout(); }
    else if (drag.kind === 'newcrop') { const [px, py] = atPic(e), s = tool.s; s.x = Math.max(0, Math.min(drag.x0, px)); s.y = Math.max(0, Math.min(drag.y0, py)); s.w = Math.min(img.width, Math.max(drag.x0, px)) - s.x; s.h = Math.min(img.height, Math.max(drag.y0, py)) - s.y; cropRatio(s, 'se'); placeCrop(); syncCropFields(); }
  });
  $('desk').addEventListener('pointerup', () => { if (drag && drag.kind === 'newcrop') renderProps(); drag = null; $('desk').classList.remove('panning'); });
  $('desk').addEventListener('pointerleave', () => { hover = null; statusHover(); });
  $('desk').addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });

  // ------------------------------------------------------------------ crop box
  function placeCrop() {
    const s = tool.s, b = $('cropbox'); b.hidden = false;
    b.style.left = s.x * view.zoom + 'px'; b.style.top = s.y * view.zoom + 'px'; b.style.width = s.w * view.zoom + 'px'; b.style.height = s.h * view.zoom + 'px';
  }
  const RATIOS = { free: 0, '1:1': 1, '4:3': 4 / 3, '3:2': 3 / 2, '16:9': 16 / 9, '3:4': 3 / 4, '2:3': 2 / 3, '9:16': 9 / 16 };
  function cropRatio(s, h) {
    const r = RATIOS[s.ratio]; const img = tool.base; if (!r) return;
    if (/[ns]/.test(h) && !/[ew]/.test(h)) s.w = s.h * r; else s.h = s.w / r;
    if (s.x + s.w > img.width) { s.w = img.width - s.x; s.h = s.w / r; } if (s.y + s.h > img.height) { s.h = img.height - s.y; s.w = s.h * r; }
  }
  function syncCropFields() { ['x', 'y', 'w', 'h'].forEach((k) => { const el = document.querySelector(`#props [data-k="${k}"]`); if (el) el.value = Math.round(tool.s[k]); }); }
  $('cropbox').addEventListener('pointerdown', (e) => {
    e.stopPropagation(); e.preventDefault(); const h = e.target.dataset.h || 'move', s = tool.s, img = tool.base, st = { ...s }, [sx, sy] = atPic(e);
    const move = (ev) => {
      const [px, py] = atPic(ev), dx = px - sx, dy = py - sy;
      if (h === 'move') { s.x = Math.max(0, Math.min(img.width - s.w, st.x + dx)); s.y = Math.max(0, Math.min(img.height - s.h, st.y + dy)); }
      else {
        if (/w/.test(h)) { s.x = Math.max(0, Math.min(st.x + st.w - 2, st.x + dx)); s.w = st.x + st.w - s.x; }
        if (/e/.test(h)) s.w = Math.max(2, Math.min(img.width - st.x, st.w + dx));
        if (/n/.test(h)) { s.y = Math.max(0, Math.min(st.y + st.h - 2, st.y + dy)); s.h = st.y + st.h - s.y; }
        if (/s/.test(h)) s.h = Math.max(2, Math.min(img.height - st.y, st.h + dy));
        cropRatio(s, h);
      }
      placeCrop(); syncCropFields();
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  });

  // ------------------------------------------------------------------ the tools
  // A tool: title, settings (s), fields for the panel, run(img, s, say) → picture (or a promise of one).
  // live: false for slow tools (AI): they preview on request. pick(s, rgb, u, v): clicking the picture.
  const range = (k, label, min, max, step = 1, show) => ({ t: 'range', k, label, min, max, step, show });
  const sel = (k, label, options, show) => ({ t: 'select', k, label, options, show });
  const seg = (k, label, options, show) => ({ t: 'seg', k, label, options, show });
  const chk = (k, label, show) => ({ t: 'check', k, label, show });
  const note = (html, show) => ({ t: 'note', html, show });
  const DEPTHS = [['1', '1-bit · 2 colours'], ['2', '2-bit · 4 colours'], ['3', '3-bit · 8 colours'], ['4', '4-bit · 16 colours'], ['5', '5-bit · 32 colours'], ['6', '6-bit · 64 colours'], ['7', '7-bit · 128 colours'], ['8', '8-bit · 256 colours'], ['high15', '15-bit · 32,768 colours (high colour)'], ['high16', '16-bit · 65,536 colours (high colour)']];
  const LEVELS = [['0', 'Any colour (24-bit)'], ['8', 'Atari ST: from 512 colours'], ['16', 'Amiga / Atari STE: from 4,096'], ['4', 'EGA: from 64 colours'], ['64', 'VGA: from 262,144']];
  const PALS = [['adaptive', 'Best for this picture'], ...Object.entries(C.PALETTES).map(([k, p]) => [k, p.name])];
  const UPS = [['smooth', 'Best (automatic)'], ['splat', 'Splat (edge-following blobs)'], ['area', 'Pixel averaging (area)'], ['nohalo', 'Sharp, no halos'], ['lanczos', 'Lanczos (sharpest)'], ['cubic', 'Cubic'], ['mitchell', 'Soft (Mitchell)'], ['linear', 'Linear'], ['nearest', 'Square pixels (pixel art, exact)'], ['scale2x', 'Pixel art, rounded corners (Scale2x)'], ['scale3x', 'Pixel art ×3 (Scale3x)'], ['smoothpixel', 'Pixel art made smooth'], ['ai-esrgan', 'AI 4× Real-ESRGAN (real photos)'], ['ai-esrgan2', 'AI 2× Real-ESRGAN'], ['ai-sharp', 'AI 2× (clean pictures)'], ['ai-photo', 'AI 4× (old photos)'], ['ai-jpeg', 'AI 4× (JPEG clean-up)']];
  const ai = (k) => /^ai-/.test(k) ? k.slice(3) : null;
  async function upscaleWith(img, method, factor, say, linear = true) {
    const k = ai(method);
    if (!k) return X.resize(img, { width: img.width * factor, height: img.height * factor, method, linear });
    if (!window.CRAFTAI) throw new Error('The AI helpers are missing.');
    say && say(`Getting the AI model ready (the first time it downloads)…`);
    const c = await CRAFTAI.upscale(X.canvasOf(img), k, (n, t) => say && say(`AI upscaling… ${n} of ${t}`));
    let out = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    if (out.width !== img.width * factor) out = X.resize(out, { width: img.width * factor, height: img.height * factor });
    return out;
  }
  // AI result averaged with the classic no-halo enlargement, pixel by pixel in linear light: below 100% it tames the
  // AI's invented texture and keeps the original's look
  function blendLight(a, b, t) {
    const L = IC.resample.toLinear, o = new ImageData(a.width, a.height), d = o.data, x = a.data, y = b.data, g = 1 / 2.4;
    for (let i = 0; i < d.length; i += 4) {
      for (let c = 0; c < 3; c++) { const v = L[x[i + c]] * t + L[y[i + c]] * (1 - t); d[i + c] = 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, g) - 0.055); }
      d[i + 3] = x[i + 3] * t + y[i + 3] * (1 - t);
    }
    return o;
  }
  // settings worked out from the picture itself (so the tools start right and the sliders are only for fine-tuning)
  const clampN = (v) => Math.max(0, Math.min(100, Math.round(v)));
  const nlmFor = (n) => ({ luma: clampN((1.7 * n.luma - 2) / 0.35), chroma: clampN((1.7 * n.chroma - 2) / 0.5) });
  const kFor = (sigma) => clampN(33 * Math.log10(Math.max(1e-4, (3 * (sigma / 255) ** 2) / 1e-4)));
  const measureNote = (n) => `<p class="hint">Measured noise: grain <b>${n.luma.toFixed(1)}</b>, colour <b>${n.chroma.toFixed(1)}</b> grey levels${n.luma < 1.5 && n.chroma < 1.5 ? ' (very clean already)' : ''}.</p>`;
  const bgEdge = (img) => { const d = img.data; return [d[0], d[1], d[2]]; };
  const TOOLS = {
    resize: { title: 'Resize', icon: IK.resize, s: (img) => ({ w: img.width, h: img.height, keep: true, method: img.width * img.height < 90000 ? 'nearest' : 'smooth', linear: true, aa: 0 }),
      fields: [{ t: 'row', items: [{ t: 'num', k: 'w', label: 'Width (pixels)', min: 1, max: 20000 }, { t: 'num', k: 'h', label: 'Height (pixels)', min: 1, max: 20000 }] }, chk('keep', 'Keep its shape'),
        { t: 'btns', buttons: [['½', 0.5], ['¼', 0.25], ['2×', 2], ['3×', 3], ['4×', 4]].map(([l, k]) => ({ label: l, run: (s, b) => { s.w = Math.max(1, Math.round(b.width * k)); s.h = Math.max(1, Math.round(b.height * k)); } })) },
        sel('method', 'How', UPS.filter(([k]) => !ai(k))), range('aa', 'Smooth jagged edges (%)', 0, 100), chk('linear', 'Average in linear light (truer colours and edges)', (s) => s.method !== 'nearest'), note('Square pixels keeps pixel art exactly as it is; the pixel-art ways round off the steps on diagonals. For AI upscaling use Clean up › Make bigger.')],
      change: (s, k, img) => { if (!s.keep) return; if (k === 'w') s.h = Math.max(1, Math.round((s.w * img.height) / img.width)); if (k === 'h') s.w = Math.max(1, Math.round((s.h * img.width) / img.height)); },
      run: (img, s) => { const r = X.resize(img, { width: s.w, height: s.h, method: s.method, linear: s.linear !== false }); return +s.aa ? X.antialias(r, { amount: +s.aa }) : r; } },
    crop: { title: 'Crop', icon: IK.crop, live: false, s: (img) => ({ x: Math.round(img.width * 0.1), y: Math.round(img.height * 0.1), w: Math.round(img.width * 0.8), h: Math.round(img.height * 0.8), ratio: 'free' }),
      fields: [note('Drag the box or its handles, or drag out a new box on the picture.'), seg('ratio', 'Shape', Object.keys(RATIOS).map((k) => [k, k === 'free' ? 'Any' : k])),
        { t: 'row', items: [{ t: 'num', k: 'x', label: 'Left' }, { t: 'num', k: 'y', label: 'Top' }] }, { t: 'row', items: [{ t: 'num', k: 'w', label: 'Width' }, { t: 'num', k: 'h', label: 'Height' }] },
        { t: 'btns', buttons: [{ label: 'Trim plain borders', run: (s, b) => { const t = X.trimBox(b); if (!t) return toast('No plain border to trim.'); s.x = t.x; s.y = t.y; s.w = t.width; s.h = t.height; } }, { label: 'Everything', run: (s, b) => { s.x = 0; s.y = 0; s.w = b.width; s.h = b.height; } }] }],
      change: (s, k) => { if (k === 'ratio') cropRatio(s, 'se'); }, enter: () => placeCrop(), leave: () => { $('cropbox').hidden = true; },
      run: (img, s) => X.crop(img, { x: s.x, y: s.y, width: Math.max(1, Math.round(s.w)), height: Math.max(1, Math.round(s.h)) }) },
    canvas: { title: 'Canvas size', icon: IK.canvas, s: (img) => ({ w: img.width, h: img.height, anchor: 'c', fill: 'clear', colour: '#ffffff' }),
      fields: [{ t: 'row', items: [{ t: 'num', k: 'w', label: 'Width', min: 1, max: 20000 }, { t: 'num', k: 'h', label: 'Height', min: 1, max: 20000 }] },
        { t: 'btns', buttons: [['+10%', 1.1], ['+25%', 1.25], ['Square', 0]].map(([l, k]) => ({ label: l, run: (s, b) => { if (!k) { s.w = s.h = Math.max(b.width, b.height); } else { s.w = Math.round(b.width * k); s.h = Math.round(b.height * k); } } })) },
        seg('anchor', 'Picture sits', [['nw', '↖'], ['n', '↑'], ['ne', '↗'], ['w', '←'], ['c', '•'], ['e', '→'], ['sw', '↙'], ['s', '↓'], ['se', '↘']]),
        seg('fill', 'New space', [['clear', 'See-through'], ['colour', 'A colour']]), { t: 'colour', k: 'colour', label: 'Colour', show: (s) => s.fill === 'colour' }],
      run: (img, s) => X.canvasSize(img, { width: s.w, height: s.h, anchor: s.anchor, fill: s.fill === 'colour' ? s.colour : '' }) },
    aa: { title: 'Smooth jagged edges', icon: IK.straighten, s: { amount: 60, threshold: 32, show: 'result' },
      fields: [seg('show', 'Show', [['result', 'The result'], ['check', 'Edge check (map)']]), range('amount', 'Smoothing (%)', 0, 100), range('threshold', 'Only edges stronger than', 8, 120), { t: 'out' },
        note('Edge check marks slanted edges in red where they are hard steps (a staircase) and in green where they are already smooth. Smoothing works along each edge, never across it, so edges stay sharp.')],
      report: () => { const a = X.aliasCheck(tool.base), b = tool.after ? X.aliasCheck(tool.after) : null; return `<p class="hint">Jagged: <b>${Math.round(a.ratio * 100)}%</b> of slanted edges before${b ? `, <b>${Math.round(b.ratio * 100)}%</b> after` : ''}.</p>`; },
      run: (img, s) => { const r = X.antialias(img, s); tool.after = r; return s.show === 'check' ? X.aliasCheck(r).map : r; }, final: (img, s) => X.antialias(img, s) },
    straighten: { title: 'Straighten', icon: IK.straighten, s: { angle: 0, crop: true }, fields: [range('angle', 'Turn (degrees)', -45, 45, 0.1), chk('crop', 'Cut off the turned corners'), note('Line up the horizon or a wall with the edge of the picture.')],
      run: (img, s) => X.rotate(img, { angle: s.angle, crop: s.crop }) },
    light: { title: 'Brightness and contrast', icon: IK.light, s: { brightness: 0, contrast: 0, gamma: 1, shadows: 0, highlights: 0 },
      fields: [range('brightness', 'Brightness', -100, 100), range('contrast', 'Contrast', -100, 100), range('gamma', 'Midtones (gamma)', 0.2, 3, 0.01), range('shadows', 'Shadows', -100, 100), range('highlights', 'Highlights', -100, 100)],
      run: (img, s) => X.light(img, s) },
    colour: { title: 'Colour', icon: IK.colour, s: { saturation: 0, vibrance: 0, hue: 0, warmth: 0, tint: 0 },
      fields: [range('saturation', 'Saturation', -100, 100), range('vibrance', 'Vibrance (gentle)', -100, 100), range('hue', 'Hue (degrees)', -180, 180), range('warmth', 'Warmth (blue ↔ yellow)', -100, 100), range('tint', 'Tint (green ↔ magenta)', -100, 100)],
      run: (img, s) => X.colour(img, s) },
    autocolour: { title: 'Auto colour (faded prints)', icon: IK.colour, s: { strength: 100, keepTone: 'auto', saturation: true },
      fields: [range('strength', 'Strength', 0, 100), seg('keepTone', 'Toned pictures (sepia…)', [['auto', 'Notice them'], [true, 'Keep the tone'], [false, 'Make neutral']]), chk('saturation', 'Bring back faded colour'), { t: 'out' },
        note('Like a photo lab: each colour’s black and white points, the midtones made neutral with a curve, and faded colour brought back by how much is missing. A sepia or toned picture keeps its tone and only gets its contrast back.')],
      report: (img) => { const c = img.colourInfo; return c ? `<p class="hint">${c.toned ? 'Looks like a toned print (sepia or similar): tone kept, contrast fixed. If it is really a faded colour photo, choose Make neutral.' : c.graded < 1 ? `Partly toned or very faded: colour corrected ${Math.round(c.graded * 100)}%. ` : ''}${c.toned ? '' : `Colour curves ${c.gamma.join(' / ')} (red / green / blue)${c.boost ? `, faded colour +${Math.round(c.boost * 100)}%` : ''}${c.skinEase < 1 ? `; eased to ${Math.round(c.skinEase * 100)}% to keep skin natural` : ''}${c.leafEase < 1 ? `; eased to keep greenery green` : ''}.`}</p>` : ''; },
      run: (img, s) => X.autoColour(img, { strength: s.strength, keepTone: s.keepTone, saturation: s.saturation }) },
    dehaze: { title: 'Dehaze (lift the veil)', icon: IK.light, s: { strength: 70, keepSome: 0.1 },
      fields: [range('strength', 'Strength', 0, 100), range('keepSome', 'Keep a little distance haze', 0, 1, 0.05), { t: 'out' },
        note('For a picture that looks seen through fog, or a print faded to a grey-white veil: how thick the veil is gets measured at every place (a clear photo always has something dark in each small area), and it is taken away.')],
      report: (img) => (img.haze ? `<p class="hint">Veil measured at ${Math.round(img.haze.level * 100)}% (a clear photo is under about 10%).</p>` : ''),
      run: (img, s) => X.dehaze(img, s) },
    curves: { title: 'Curves', icon: IK.light, s: { channel: 'lum', pts: { lum: [[0, 0], [255, 255]], rgb: [[0, 0], [255, 255]], r: [[0, 0], [255, 255]], g: [[0, 0], [255, 255]], b: [[0, 0], [255, 255]] } },
      fields: [seg('channel', 'Curve for', [['lum', 'Brightness'], ['rgb', 'RGB'], ['r', 'Red'], ['g', 'Green'], ['b', 'Blue']]), { t: 'curve' },
        { t: 'btns', buttons: [['S-curve', [[0, 0], [64, 52], [192, 204], [255, 255]]], ['Lift shadows', [[0, 0], [64, 92], [255, 255]]], ['Soft highlights', [[0, 0], [192, 176], [255, 245]]], ['Faded film', [[0, 28], [128, 132], [255, 235]]], ['Straight', [[0, 0], [255, 255]]]].map(([l, pts]) => ({ label: l, run: (s) => { s.pts[s.channel] = pts.map((p) => p.slice()); } })) },
        note('Click to add a point, drag to move it, double-click to take it away. Brightness changes light only (colours keep their hue); RGB changes all three; Red, Green and Blue each colour alone. With Where below, a curve works like a curves layer with a mask.')],
      run: (img, s) => { const T = {}; for (const k of ['lum', 'rgb', 'r', 'g', 'b']) { const p = s.pts[k]; if (p.length !== 2 || p[0][0] !== 0 || p[0][1] !== 0 || p[1][0] !== 255 || p[1][1] !== 255) T[k] = IC.detail.curve(p); } return IC.detail.applyCurves(img, T); } },
    equalizer: { title: 'Detail equaliser', icon: IK.sharpen, s: { g0: 120, g1: 130, g2: 120, g3: 100, g4: 100, protect: 0.12 },
      fields: [range('g0', 'Finest detail (1–2 px) %', 0, 300), range('g1', 'Small detail (2–4 px) %', 0, 300), range('g2', 'Medium detail (4–8 px) %', 0, 300), range('g3', 'Large detail (8–16 px) %', 0, 300), range('g4', 'Broad light and shade %', 0, 200), range('protect', 'Protect strong edges (smaller = more)', 0.03, 0.4, 0.01),
        { t: 'btns', buttons: [['Bring out texture', [130, 150, 130, 105, 100]], ['Local contrast', [100, 110, 130, 140, 100]], ['Soften texture', [70, 80, 90, 100, 100]], ['Flatten the lighting', [100, 100, 105, 110, 60]], ['Reset', [100, 100, 100, 100, 100]]].map(([l, g]) => ({ label: l, run: (s) => { g.forEach((v, i) => { s['g' + i] = v; }); } })) },
        note('The picture split into bands by the size of its detail, a curve on each, put back together: like separate curves layers for fine, small and large detail. Small changes are lifted more than strong edges, so no halos.')],
      run: (img, s) => IC.detail.equaliser(img, { gains: [s.g0, s.g1, s.g2, s.g3, s.g4], protect: s.protect }) },
    gradient: { title: 'Even the light, lift detail', icon: IK.light, live: (s) => !!tool && tool.base.width * tool.base.height <= 1500000, s: { strength: 50, detail: 50 },
      fields: [range('strength', 'Even out the light', 0, 100), range('detail', 'Lift faint detail', 0, 100), note('Gradient-domain: every change in brightness is measured; big jumps (bright window, deep shadow) are made smaller and faint ones bigger, then the picture is rebuilt from them by solving the Poisson equation. Detail comes up evenly everywhere and the light stays natural.')],
      run: (img, s, say) => { say && say('Solving for the new picture…'); return IC.detail.gradientLift(img, s); } },
    crisp: { title: 'Crisp edges', icon: IK.sharpen, s: { strength: 25, size: 1.2, wMap: 'edges', wLevel: 0.25, wSoft: 0.3, wFeather: 1 },
      fields: [range('strength', 'Strength', 0, 100), range('size', 'Edge softness to undo (pixels)', 0.6, 4, 0.1), note('A shock filter: a soft edge is pulled into a clean step, with nothing overshooting (no halos) and flat areas untouched. Best after enlarging; use Where › Edges to keep it to the outlines.')],
      run: (img, s) => IC.detail.crispEdges(img, s) },
    diffuse: { title: 'Edge-keeping smooth', icon: IK.denoise, s: { strength: 20, keepEdges: 70 },
      fields: [range('strength', 'Strength', 0, 100), range('keepEdges', 'Keep edges', 0, 100), note('Perona–Malik diffusion: grain and blotches flow together and even out, but the flow stops at edges, so outlines stay sharp. Smoother than Remove noise on skin and sky; use Where › Smooth areas for those alone.')],
      run: (img, s) => IC.detail.diffuse(img, s) },
    blendstep: { title: 'Blend a version', icon: IK.compare, s: () => ({ from: 'step', step: Math.max(0, pic().at - 1), other: pics.findIndex((p, i) => i !== cur), mode: 'normal', amount: 50 }),
      fields: [{ t: 'html', html: () => '<p class="hint">Mix an earlier version (a step in History) back into the picture, like stacking layers before committing.</p>' },
        seg('from', 'From', [['step', 'A step in History'], ['pic', 'Another open picture']]), { t: 'stepsel', k: 'step', label: 'Version', show: (s) => s.from === 'step' }, { t: 'picsel', k: 'other', label: 'Picture (a cut-out is placed by its solid parts)', show: (s) => s.from === 'pic' }, sel('mode', 'How', IC.detail.MODES.map((m) => [m, { normal: 'Normal (mix)', multiply: 'Multiply (darker)', screen: 'Screen (lighter)', overlay: 'Overlay (contrast)', softlight: 'Soft light', lighten: 'Lighten only', darken: 'Darken only', difference: 'Difference (shows changes)', luminosity: 'Its brightness, my colours', colour: 'Its colours, my brightness' }[m]])),
        range('amount', 'Amount %', 0, 100), note('Use Where to bring the version back only in some places: the sharper version on the texture, the smoother one on the sky.')],
      run: (img, s) => { const src = s.from === 'pic' ? pics[s.other] && pics[s.other].steps[pics[s.other].at].img : pic().steps[s.step] && pic().steps[s.step].img; if (!src) throw new Error(s.from === 'pic' ? 'Open another picture first (for example a cut-out you repaired).' : 'Choose a version.'); return IC.detail.blend(img, src, { mode: s.mode, amount: s.amount }); } },
    assess: { title: 'Ask AI what it needs', icon: IK.modern, viewOnly: true, s: {}, run: (img) => img,
      fields: [{ t: 'custom', render: (into, t) => assessPanel(into, t) }] },
    stack: { title: 'Combine photos', icon: IK.upscale, live: false, applyLabel: 'Make the combined picture',
      s: () => ({ use: pics.map((p, k) => k).filter((k) => k !== cur), mode: 'super', scale: '2', local: true }),
      fields: [note('Several shots of the same scene (a handheld burst, or the same scan done a few times) hold more than any one of them. They are lined up to a fraction of a pixel and merged: the noise averages away, and with Super, the tiny shifts between shots fill in detail between the pixels (how phones and DLSS-style upscalers do it).'),
        { t: 'picmulti', k: 'use', label: 'Shots to combine' },
        seg('mode', 'How', [['super', 'Super-resolution'], ['average', 'Average (less noise)'], ['median', 'Median (removes passers-by)']]),
        seg('scale', 'Size', [['1', 'Same size'], ['2', '2× bigger'], ['3', '3× bigger']], (s) => s.mode === 'super'),
        chk('local', 'Line up each part on its own (handheld, slight movement)'), { t: 'out' }, note('Press Preview. The result opens as a new picture.')],
      report: () => (tool && tool.shifts ? `<p class="hint">Lined up <b>${tool.shifts.length}</b> shots; moves found: ${tool.shifts.map(([x, y]) => `${x.toFixed(1)}, ${y.toFixed(1)}`).join(' · ')} pixels.</p>` : ''),
      run: async (img, s, say) => {
        const others = s.use.filter((k) => k !== cur && pics[k]).map((k) => pics[k].steps[pics[k].at].img);
        if (!others.length) throw new Error('Open at least one more shot of the same scene first (File › Open, several at once).');
        const shots = [img, ...others.map((o) => (o.width === img.width && o.height === img.height ? o : X.resize(o, { width: img.width, height: img.height })))];
        if (s.mode === 'super' && img.width * img.height * s.scale * s.scale > 40e6) throw new Error('That would be over 40 megapixels: choose a smaller size, or crop first.');
        const r = await IC.stack.combine(shots, { mode: s.mode, scale: s.mode === 'super' ? +s.scale : 1, local: s.local, onStep: (m) => say && say(m) });
        tool.shifts = r.shifts.slice(1); return r.img;
      } },
    facerefine: { title: 'Face refine', icon: IK.cutout, live: false, s: { skin: 30, eyes: 40, whites: 30, irises: 30, lips: 20, teeth: 20 },
      fields: [range('skin', 'Smooth the skin', 0, 100), range('eyes', 'Clear the eyes', 0, 100), range('whites', 'Brighter, neutral eye whites', 0, 100), range('irises', 'Iris contrast', 0, 100), range('lips', 'Lip colour', 0, 100), range('teeth', 'Whiter teeth', 0, 100), { t: 'out' },
        note('Each part of each face is found (478 points per face) and given its own treatment. Nothing is redrawn or invented: the eyes, mouth and skin stay the person’s own. The first use downloads the face finder (about 4 MB). Press Preview.')],
      report: () => (tool && tool.faces != null ? `<p class="hint"><b>${tool.faces}</b> face${tool.faces === 1 ? '' : 's'} found.</p>` : ''),
      run: async (img, s, say) => {
        say && say('Finding faces…'); const faces = await IC.faces.ensure(img); if (tool) tool.faces = faces.length; if (!faces.length) throw new Error('No faces found in this picture.');
        const M = IC.maps, part = (p) => IC.faces.partMask(img, faces, p); let o = img;
        const lumW = (m, im) => { const d = im.data, w = new Float32Array(m.length); for (let i = 0; i < m.length; i++) { const l = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255; w[i] = m[i] * Math.max(0, Math.min(1, (l - 0.25) / 0.35)); } return w; };
        say && say('Refining each part…');
        if (s.skin) o = M.apply(o, IC.detail.diffuse(o, { strength: s.skin * 0.6, keepEdges: 75 }), part('skin'));
        if (s.eyes) o = M.apply(o, X.sharpen(o, { amount: s.eyes * 2, radius: 1, threshold: 2 }), part('eyes'));
        if (s.irises) o = M.apply(o, X.light(o, { contrast: s.irises * 0.6 }), part('irises'));
        if (s.whites) { const w = lumW(part('eyewhites'), o), k = s.whites / 100; o = M.apply(o, X.light(X.colour(o, { saturation: -70 }), { brightness: 6 }), w.map((v) => v * k)); }
        if (s.lips) o = M.apply(o, X.colour(o, { vibrance: s.lips * 0.6 }), part('lips'));
        if (s.teeth) { const w = lumW(part('mouth'), o), k = s.teeth / 100; o = M.apply(o, X.light(X.colour(o, { saturation: -60 }), { brightness: 5 }), w.map((v) => v * k)); }
        return o;
      } },
    shadows: { title: 'Recover shadows', icon: IK.light, s: { shadows: 50, highlights: 20, detail: 10, maxGain: 3 },
      fields: [range('shadows', 'Lift the shadows', 0, 100), range('highlights', 'Hold back bright areas', 0, 100), range('detail', 'Detail', 0, 60), range('maxGain', 'Most a dark area may brighten (×)', 1.5, 6, 0.1),
        note('Brightens dark areas (an underexposed subject, deep shade) while keeping their texture and leaving the sky alone: the picture’s broad lighting is evened out, its detail kept. The limit stops noise in the shadows being blown up.')],
      run: (img, s) => X.shadowRecover(img, s) },
    clarity: { title: 'Clarity (local contrast)', icon: IK.sharpen, s: { amount: 35, radius: 0 },
      fields: [range('amount', 'Amount', 0, 100), range('radius', 'Size (0 = automatic)', 0, 80), note('Brings out texture and detail (faces, fabric, leaves) by strengthening local contrast in the midtones, without the hard edges of sharpening.')],
      run: (img, s) => X.clarity(img, s) },
    balance: { title: 'Fix a colour cast', icon: IK.balance, s: { method: 'auto', strength: 80, percent: 1, rgb: null },
      fields: [seg('method', 'How', [['auto', 'Greys to grey'], ['grey', 'Average to grey'], ['white', 'Brightest to white'], ['faces', 'Eye whites and teeth'], ['pick', 'Click something white']]),
        range('percent', 'Brightest part used (%)', 0.1, 10, 0.1, (s) => s.method === 'white'), { t: 'swatch', k: 'rgb', label: 'Picked colour (click the picture)', show: (s) => s.method === 'pick' && s.rgb }, note('Click something in the picture that should be white or grey: a shirt, paper, a wall, a cloud.', (s) => s.method === 'pick' && !s.rgb),
        range('strength', 'Strength', 0, 100),
        note('Greys to grey makes only the nearly-grey things neutral, so a sunset stays warm. Average to grey suits most old photos that went yellow, red or blue (it can turn a mostly-blue scene too warm). Brightest to white suits pictures with something white in them. Clicking a white thing is the most exact.')],
      pick: (s, rgb) => { s.method = 'pick'; s.rgb = rgb; }, live: (s) => s.method !== 'pick' || !!s.rgb,
      // eye whites and teeth are nearly neutral in life: a grey card that is already in the photo
      run: async (img, s, say) => { if (s.method !== 'faces') return X.whiteBalance(img, s); say && say('Finding faces…'); const f = await IC.faces.ensure(img), rgb = IC.faces.greyCard(img, f); if (!rgb) throw new Error(f.length ? 'The eye whites and teeth are too small or hidden to judge the colour from.' : 'No faces found in this picture.'); return X.whiteBalance(img, { method: 'pick', rgb, strength: s.strength }); } },
    threshold: { title: 'Black and white (threshold)', icon: IK.threshold, s: { level: 128 }, fields: [range('level', 'Light enough to be white', 1, 254)], run: (img, s) => X.threshold(img, s) },
    posterize: { title: 'Posterize', icon: IK.posterize, s: { levels: 4 }, fields: [range('levels', 'Steps for each colour', 2, 16)], run: (img, s) => X.posterize(img, s) },
    sepia: { title: 'Sepia (old photo)', icon: IK.sepia, s: { strength: 100 }, fields: [range('strength', 'Strength', 0, 100)], run: (img, s) => X.sepia(img, s) },
    blur: { title: 'Blur', icon: IK.blur, s: { radius: 2 }, fields: [range('radius', 'How much (pixels)', 1, 40)], run: (img, s) => X.blur(img, s) },
    sharpen: { title: 'Sharpen', icon: IK.sharpen, s: { how: 'smart', amount: 80, cas: 60, radius: 1, threshold: 2 }, fields: [seg('how', 'How', [['smart', 'Smart (CAS)'], ['classic', 'Classic (unsharp mask)']]), range('cas', 'Amount (%)', 0, 100, 1, (s) => s.how === 'smart'), range('amount', 'Amount (%)', 0, 300, 1, (s) => s.how !== 'smart'), range('radius', 'Radius', 1, 5, 1, (s) => s.how !== 'smart'), range('threshold', 'Leave smooth areas (threshold)', 0, 30, 1, (s) => s.how !== 'smart'), note('Smart sharpens each pixel by how much room it has (AMD’s contrast-adaptive sharpening, the FSR 1 sharpener): no halos, no clipping, flat areas left alone.')], run: (img, s) => (s.how === 'smart' ? X.cas(img, { amount: s.cas }) : X.sharpen(img, s)) },
    pixelate: { title: 'Pixelate', icon: IK.pixelate, s: { size: 8 }, fields: [range('size', 'Square size', 2, 64)], run: (img, s) => X.pixelate(img, s) },
    depth: { title: 'Colour depth', icon: IK.depth, s: { depth: '4', palette: 'adaptive', levels: '0', grey: false, dither: 'fs', amount: 100 },
      fields: [sel('depth', 'Colour depth', DEPTHS), chk('grey', 'Greys only'), sel('palette', 'Colours', PALS, (s) => !/high/.test(s.depth) && !s.grey), sel('levels', 'Chosen from', LEVELS, (s) => s.palette === 'adaptive' && !/high/.test(s.depth) && !s.grey),
        sel('dither', 'Dithering (dots that mix colours)', C.DITHERS), range('amount', 'Dither strength (%)', 0, 100, 1, (s) => s.dither !== 'none'), { t: 'out' }],
      run: (img, s) => C.reduce(img, { colours: /high/.test(s.depth) ? 0 : 1 << +s.depth, depth: /high/.test(s.depth) ? s.depth : undefined, palette: s.grey ? null : s.palette, levels: +s.levels || 0, grey: s.grey, dither: s.dither, amount: s.amount / 100 }),
      report: (img) => { const cs = C.colours(img, 257); return `<p class="hint">Now <b>${cs.length > 256 ? 'more than 256' : cs.length}</b> colours.</p>${cs.length <= 256 ? `<div class="swatches">${cs.map((c) => `<span title="${hexOf(c.rgb)}" style="background:${hexOf(c.rgb)}"></span>`).join('')}</div>` : ''}`; } },
    looks: { title: 'Old computer looks', icon: IK.retro, s: { look: 'st', keep: true, fit: 'cover', dither: '' },
      fields: [{ t: 'looks' }, seg('keep', 'Size', [[true, 'Keep my picture’s size'], [false, 'The real screen size']]), seg('fit', 'Fit', [['cover', 'Fill the screen'], ['contain', 'Whole picture']]), sel('dither', 'Dithering', [['', 'As that computer would'], ...C.DITHERS])],
      run: (img, s) => C.look(img, s.look, { keep: s.keep, fit: s.fit, dither: s.dither || undefined }) },
    denoise: { title: 'Smooth out noise', icon: IK.denoise, s: { strength: 40, radius: 2 }, fields: [range('strength', 'Strength', 0, 100), range('radius', 'Area', 1, 4), note('Evens out grain and noise but keeps edges sharp.')], run: (img, s) => X.denoise(img, s) },
    nlm: { title: 'Remove noise (smart)', icon: IK.denoise, s: (img) => { const n = IC.restore.noiseLevel(img); return { ...nlmFor(n), patch: 1, search: 5, n }; },
      fields: [{ t: 'html', html: (s) => measureNote(s.n) + '<p class="hint">Set from the noise measured in this picture; adjust if you like.</p>' }, range('luma', 'Grain (brightness noise)', 0, 100), range('chroma', 'Colour blotches (colour noise)', 0, 100), seg('patch', 'Compare', [[1, 'Fine detail'], [2, 'Bigger patches']]), seg('search', 'Look around', [[3, 'Near'], [5, 'Normal'], [7, 'Far (slower)']]),
        note('Non-local means: each pixel is averaged with others nearby whose surroundings look alike, so texture and edges stay while grain goes. Grain and colour blotches are handled separately.')],
      live: () => !!tool && tool.base.width * tool.base.height <= 700000, run: (img, s, say) => { say && say('Comparing patches…'); return IC.restore.nlm(img, { luma: s.luma, chroma: s.chroma, patch: +s.patch, search: +s.search }); } },
    deblur: { title: 'Restore sharpness (deblur)', icon: IK.sharpen, s: (img) => { const m = IC.restore.measure(img), n = IC.restore.noiseLevel(img); return { how: n.luma > 3 ? 'careful' : 'quick', kind: 'gauss', radius: m ? Math.round(m.radius * 10) / 10 : 1.5, length: 8, angle: 0, noise: kFor(n.luma), strength: 100, measured: !!m, sigma: n.luma }; },
      fields: [seg('how', 'Way', [['quick', 'Quick'], ['careful', 'Careful (noisy pictures)']]), seg('kind', 'What blurred it', [['gauss', 'Soft lens / scan'], ['disk', 'Out of focus'], ['motion', 'Camera shake']]),
        range('radius', 'Blur size (pixels)', 0.3, 12, 0.1, (s) => s.kind !== 'motion'), range('length', 'Shake length (pixels)', 2, 60, 1, (s) => s.kind === 'motion'), range('angle', 'Shake direction (degrees)', -90, 90, 1, (s) => s.kind === 'motion'),
        { t: 'btns', buttons: [{ label: 'Measure the blur', run: (st, b) => { const m = IC.restore.measure(b); if (!m) return toast('Not enough clear edges to measure the blur.'); st.kind = st.kind === 'motion' ? 'gauss' : st.kind; st.radius = Math.round(m.radius * 10) / 10; toast(`Edges take about ${m.width.toFixed(1)} pixels: blur size set to ${st.radius}.`); } }] },
        range('noise', 'Noise in the picture (more = gentler)', 0, 100, 1, (s) => s.how !== 'careful'), range('strength', 'Strength (%)', 0, 100), { t: 'out' },
        note('Careful takes turns undoing the blur and removing noise, a few rounds (plug-and-play restoration): cleaner on grainy pictures, but it takes a few seconds. Press Preview.', (s) => s.how === 'careful'),
        note('The blur size and noise were measured from this picture’s edges and flat areas.', (s) => s.measured), note('A blurred picture is the sharp one spread out by a blur, plus noise: <i>g = h ∗ f + n</i>. This undoes the blur <i>h</i> with a Wiener filter, held back where noise <i>n</i> would be blown up. Match the blur size to the picture: too big gives ripples beside edges. Remove noise first on grainy pictures.')],
      report: () => { const k = IC.restore.psf(tool.s), c = X.canvasOf(k); return `<p class="hint" style="display:flex;gap:8px;align-items:center"><img src="${c.toDataURL()}" width="${Math.min(64, k.width * 4)}" style="image-rendering:pixelated;border-radius:4px"> The blur being undone</p>`; },
      live: (s) => s.how !== 'careful', run: async (img, s, say) => { say && say('Undoing the blur…'); await wait(30); return s.how === 'careful' ? IC.restore.deblurCareful(img, s, say) : IC.restore.deblur(img, s); } },
    noisemap: { title: 'Where the noise is', icon: IK.denoise, s: {}, viewOnly: true, fields: [{ t: 'html', html: () => measureNote(IC.restore.noiseLevel(tool.base)) }, note('Yellow: noisy; blue: clean. Even noise means an untouched picture; clean flat areas with noisy edges mean it was already smoothed and sharpened (by a camera or a program).')], run: (img) => IC.restore.noiseMap(img) },
    clahe: { title: 'Bring back faded detail', icon: IK.light, s: { clip: 2, tiles: 8, amount: 70, stretch: true },
      fields: [chk('stretch', 'Stretch to full black and white first'), range('clip', 'Strength (contrast limit)', 1, 6, 0.1), range('tiles', 'Areas across', 2, 16), range('amount', 'Mix (%)', 0, 100), note('Adaptive histogram equalisation: each part of the picture gets its own contrast back, so faded and dark corners recover without the whole picture going harsh.')],
      // the whole range stretched first (faded photos rarely reach black or white), then each area's own contrast
      run: (img, s) => IC.restore.clahe(s.stretch ? X.autoLevels(img, { clip: 0.3, perChannel: false }) : img, s) },
    despeckle: { title: 'Dust and scratches', icon: IK.dust, s: { how: 'smart', threshold: 20, radius: 1 },
      fields: [seg('how', 'Way', [['smart', 'Smart (only the specks)'], ['simple', 'Simple']]), range('threshold', 'How much a speck stands out', 5, 120, 1), range('radius', 'Size of the specks', 1, 3, 1, (s) => s.how === 'simple'), { t: 'out' },
        note('Smart finds the specks first (dust, dropouts, salt-and-pepper dots), then repairs only those, each from the clean pixels around it; everything else stays exactly as it was.', (s) => s.how === 'smart')],
      report: (img) => (img.specks != null ? `<p class="hint"><b>${fmtN(img.specks)}</b> specks repaired.</p>` : ''),
      run: (img, s) => (s.how === 'smart' ? IC.restore.impulse(img, { threshold: s.threshold }) : X.despeckle(img, { radius: s.radius, threshold: s.threshold * 2 })) },
    deblock: { title: 'Remove JPEG blocks', icon: IK.jpeg, s: { strength: 50 }, fields: [range('strength', 'Strength', 0, 100), note('Smooths the 8 × 8 squares and smudges of a picture saved too small as JPEG. For bigger and cleaner, try Make bigger › AI 4× (JPEG clean-up).')], run: (img, s) => X.deblock(img, s) },
    undither: { title: 'Undither', icon: IK.undither, s: { strength: 60 }, fields: [range('strength', 'Strength', 0, 100), note('Blends the dots of a dithered picture (old GIFs, 16-colour screens) back into smooth colour.')], run: (img, s) => X.undither(img, s) },
    cutout: { title: 'Remove background', icon: IK.cutout, s: { mode: 'edges', tolerance: 40, points: [] },
      fields: [seg('mode', 'How', [['edges', 'By colour, from the edges'], ['ai', 'AI cut-out (photos)']]), range('tolerance', 'How different the background may be', 5, 160, 1, (s) => s.mode === 'edges'),
        note('Click any background left over to take that away too.', (s) => s.mode === 'edges'), note('Finds the main subject of a photo. The model downloads once (about 176 MB) and then works offline.', (s) => s.mode === 'ai'),
        { t: 'btns', buttons: [{ label: 'Start again', run: (s) => { s.points = []; } }, { label: 'Cut out to a new picture', run: () => { if (!tool.preview) return toast('Wait for the preview first.'); const o = tool.preview, nm = `${baseName(pic().name)} – cut-out.png`; setTimeout(() => { closeTool(true); addPic(nm, o, { format: 'Cut-out', bits: 32 }); toast('The cut-out is a picture of its own: repair it, then use Detail › Blend a version › Another open picture to put it back.'); }, 0); } }] }],
      live: (s) => s.mode === 'edges', pick: (s, rgb, u, v) => { s.points.push({ t: 'wand', u, v }); },
      run: async (img, s, say) => { say && say(s.mode === 'ai' ? 'Finding the subject…' : 'Taking the background away…'); const r = await BGREMOVE.remove(X.canvasOf(img), { mode: s.mode === 'ai' ? 'ai' : 'auto', tolerance: s.tolerance, actions: s.points, max: 1e5 }); return r.canvas.getContext('2d').getImageData(0, 0, r.canvas.width, r.canvas.height); } },
    clear: { title: 'Make a colour see-through', icon: IK.clearC, s: (img) => ({ rgb: bgEdge(img), tolerance: 10, soft: 0 }),
      fields: [{ t: 'swatch', k: 'rgb', label: 'Colour (click the picture to pick it)' }, range('tolerance', 'Close colours too', 0, 100), range('soft', 'Soft edge', 0, 60)],
      pick: (s, rgb) => { s.rgb = rgb; }, run: (img, s) => X.makeClear(img, s) },
    flatten: { title: 'Fill see-through parts', icon: IK.canvas, s: { colour: '#ffffff' }, fields: [{ t: 'colour', k: 'colour', label: 'Fill with' }], run: (img, s) => X.flatten(img, { fill: s.colour }) },
    upscale: { title: 'Make bigger', icon: IK.upscale, s: (img) => ({ method: img.width * img.height < 90000 ? 'scale2x' : 'smooth', factor: 2, linear: true, mix: 100, aa: 0 }),
      fields: [sel('method', 'How', UPS), seg('factor', 'Times', [[2, '2×'], [3, '3×'], [4, '4×']], (s) => !ai(s.method)),
        chk('linear', 'Average in linear light (truer colours and edges)', (s) => !ai(s.method) && s.method !== 'nearest'),
        range('mix', 'AI strength (%): less mixes in the classic enlargement', 0, 100, 5, (s) => !!ai(s.method)), range('aa', 'Smooth jagged edges (%)', 0, 100, 1, (s) => !ai(s.method)), { t: 'out' },
        note('<b>Best</b> sharpens edges without the light and dark halos sharp filters leave, and averages light the way the eye sees it. <b>Pixel averaging</b> counts every pixel by how much it covers: crisp, honest, no invented detail.', (s) => !ai(s.method)),
        note('The AI ways download a model once (10–70 MB) and work offline after that. On a graphics card they take about a second for each 160 × 160 square; on the processor much longer.', (s) => !!ai(s.method))],
      live: (s) => !ai(s.method) || !!(tool && tool.aiCache && tool.aiCache.k === s.method), report: (img) => `<p class="hint">Becomes <b>${img.width} × ${img.height}</b> pixels.</p>`,
      run: async (img, s, say) => {
        if (!ai(s.method)) { const u = await upscaleWith(img, s.method, +s.factor, say, s.linear); return +s.aa ? X.antialias(u, { amount: +s.aa }) : u; }
        // the AI result is kept, so moving the strength slider does not run the model again
        const t = tool; if (!t.aiCache || t.aiCache.k !== s.method) t.aiCache = { k: s.method, img: await upscaleWith(img, s.method, CRAFTAI.MODELS[ai(s.method)].scale, say) };
        const a = t.aiCache.img; if (+s.mix >= 100) return a;
        return blendLight(a, X.resize(img, { width: a.width, height: a.height, method: 'nohalo' }), +s.mix / 100);
      } },
    modern: { title: 'Modernise', icon: IK.modern, live: false, s: (img) => ({ kind: img.width * img.height < 90000 ? 'pixel' : 'photo', bigger: 2, useAi: false }),
      fields: [seg('kind', 'What kind of picture', [['pixel', 'Pixel art'], ['screen', 'Dithered screen'], ['photo', 'Old photo or scan'], ['jpeg', 'Blocky JPEG']]), seg('bigger', 'Make it bigger', [[1, 'No'], [2, '2×'], [4, '4×']]), chk('useAi', 'Use AI upscaling (slower; downloads a model once)', (s) => s.kind !== 'pixel' && +s.bigger > 1),
        note('Pixel art: grown with smooth, rounded edges. Dithered screen: dots blended to smooth colour. Old photo: dust, smart noise removal, a gentle deblur, colour cast, levels and faded detail. Blocky JPEG: blocks smoothed.'), note('Press Preview to see it first.')],
      run: async (img, s, say) => {
        const k = +s.bigger; let o = img;
        if (s.kind === 'pixel') { if (k > 1) o = X.resize(img, { width: img.width * k, height: img.height * k, method: 'smoothpixel' }); return X.sharpen(o, { amount: 30, radius: 1 }); }
        if (s.kind === 'screen') { say && say('Blending the dots…'); o = X.undither(o, { strength: 65 }); }
        // old photo, in the usual restoration order: dust, noise (grain and colour separately), a little deblur, then tone
        if (s.kind === 'photo') { say && say('Dust and noise…'); o = IC.restore.impulse(o, { threshold: 30 }); const n = IC.restore.noiseLevel(o); if (n.luma > 1 || n.chroma > 1) o = IC.restore.nlm(o, nlmFor(n)); say && say('Sharpness and tone…'); const m = IC.restore.measure(o); if (m && m.radius > 0.8) o = IC.restore.deblur(o, { kind: 'gauss', radius: Math.min(3, m.radius * 0.7), noise: kFor(IC.restore.noiseLevel(o).luma) + 20, strength: 60 }); const toned = X.isToned(o) || undefined, hz = X.hazeLevel(o); if (hz > 0.22) o = X.dehaze(o, { strength: Math.min(80, (hz - 0.15) * 300), keepSome: 0.15 }); o = X.clarity(X.autoColour(X.shadowRecover(o, { shadows: 40, highlights: 15, detail: 5, maxGain: 2.5 }), { strength: 100, keepTone: toned ? true : 'auto' }), { amount: 30 }); }
        if (s.kind === 'jpeg') { say && say('Smoothing the blocks…'); o = X.deblock(o, { strength: 60 }); }
        if (k > 1) o = s.useAi ? await upscaleWith(o, s.kind === 'jpeg' || s.kind === 'photo' ? (k === 2 ? 'ai-esrgan2' : 'ai-esrgan') : 'ai-sharp', k, say) : X.resize(o, { width: o.width * k, height: o.height * k });
        // a light finish (an old photo was sharpened by the deblur already)
        return s.kind === 'photo' ? X.colour(o, { vibrance: 6 }) : X.colour(X.sharpen(o, { amount: 50, radius: 1, threshold: 3 }), { vibrance: 12 });
      } },
    // Remaster shapes: the picture's shapes recognised as clean outlines (traced), drawn again crisply at the new size,
    // then blended with the (enlarged) original: everywhere, or only at the edges so the original's texture stays inside
    remaster: { title: 'Remaster shapes', icon: IK.svg, live: false, s: (img) => ({ scale: img.width * img.height < 200000 ? 4 : 2, colours: 'auto', detail: 9, smooth: 1, blend: 100, where: 'edges', perfect: true }),
      fields: [seg('scale', 'New size', [[1, 'Same'], [2, '2×'], [3, '3×'], [4, '4×']]), sel('colours', 'Colours', [['auto', 'Best match'], ...[2, 3, 4, 6, 8, 12, 16, 24, 32].map((n) => [String(n), `${n} colours`])]),
        range('detail', 'Detail', 1, 10), range('smooth', 'Smoothing of the outlines', 0, 5), chk('perfect', 'Make near-circles and ellipses perfect'), seg('where', 'Blend', [['edges', 'At the edges (keeps texture)'], ['all', 'Everywhere']]), range('blend', 'Remastered (%)', 0, 100), { t: 'out' },
        note('For logos, clip art, icons, pixel art and drawings with clear shapes: each shape is found and drawn again smoothly at the new size. Press Preview. Use Compare to see the difference.')],
      report: () => (tool && tool.shapes ? `<p class="hint"><b>${fmtN(tool.shapes.paths)}</b> shapes in <b>${tool.shapes.colors}</b> colours recognised${tool.shapes.snapped ? `; <b>${tool.shapes.snapped}</b> made into perfect circles or ellipses` : ''}.</p>` : ''),
      run: async (img, s, say) => {
        const k = +s.scale, W = img.width * k, H = img.height * k;
        say && say('Recognising the shapes…'); await wait(20);
        // the tracer looks at a smoothly enlarged copy (about 900 pixels across), so small pictures give true curves and keep their small parts
        const m = Math.max(1, Math.min(8, Math.floor(900 / Math.max(img.width, img.height)))), src = m > 1 ? X.resize(img, { width: img.width * m, height: img.height * m, method: img.width * img.height < 90000 ? 'smoothpixel' : 'auto' }) : img;
        const few = F.countColours(img, 17), tr = await CraftTracer.trace(X.canvasOf(src).toDataURL('image/png'), { colors: s.colours === 'auto' ? (few <= 16 ? few : 'auto') : +s.colours, detail: s.detail, smooth: s.smooth, max: Math.max(src.width, src.height) });
        // each traced colour set to the picture's own most common colour near it (the tracer's averages take in the soft
        // edge pixels and come out a shade off)
        { const hist = new Map(), d0 = img.data; for (let i = 0; i < d0.length; i += 4) { if (d0[i + 3] < 128) continue; const key = (d0[i] << 16) | (d0[i + 1] << 8) | d0[i + 2]; hist.set(key, (hist.get(key) || 0) + 1); }
          const top = [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4000);
          tr.svg = tr.svg.replace(/fill="rgb\((\d+),(\d+),(\d+)\)"/g, (m0, r0, g0, b0) => { let best = null, bs = -1; for (const [key, n] of top) { const dd = Math.hypot((key >> 16) - r0, ((key >> 8) & 255) - g0, (key & 255) - b0); if (dd < 40) { const sc = n / (1 + dd * dd * 0.05); if (sc > bs) { bs = sc; best = key; } } } return best == null ? m0 : `fill="rgb(${best >> 16},${(best >> 8) & 255},${best & 255})"`; }); }
        if (s.perfect) { const sn = snapShapes(tr.svg); tr.svg = sn.svg; tr.snapped = sn.snapped; }
        tool.shapes = tr;
        say && say('Drawing them again…');
        // drawn over the enlarged original: where a perfected shape is smaller than the hole left for it, the picture shows, not a gap
        const base = X.resize(img, { width: W, height: H, method: k > 1 && img.width * img.height < 90000 ? 'smoothpixel' : 'auto' }), vec = await svgToImg(tr.svg, W, H, base), b = +s.blend / 100;
        // where to use the redrawn shapes: their edges (a band), or everywhere; then the two pictures are joined band by
        // band (multi-band pyramid blending) so the change never shows a seam
        const v = vec.data, mk = new Float32Array(W * H);
        if (s.where === 'edges') {
          const at = (x, y) => { const j = (Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))) * 4; return v[j] * 0.3 + v[j + 1] * 0.59 + v[j + 2] * 0.11 + (255 - v[j + 3]); };
          const e = new ImageData(W, H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const g = Math.min(255, (Math.abs(at(x + 1, y) - at(x - 1, y)) + Math.abs(at(x, y + 1) - at(x, y - 1))) * 3), i = (y * W + x) * 4; e.data[i] = e.data[i + 1] = e.data[i + 2] = g; e.data[i + 3] = 255; }
          const eb = X.blur(e, { radius: Math.max(1, Math.round(k * 1.5)) }).data; for (let p = 0; p < W * H; p++) mk[p] = Math.min(1, eb[p * 4] / 50) * b;
        } else mk.fill(b);
        const o = X.pyramidBlend(base, vec, mk, 5);
        return o;
      } },
    trace: { title: 'To SVG outlines', icon: IK.svg, s: { how: 'outlines', colours: 'auto', detail: 6, smooth: 1, removeBg: false },
      fields: [seg('how', 'Kind', [['outlines', 'Smooth outlines'], ['pixels', 'Exact pixels (pixel art)']]), sel('colours', 'Colours', [['auto', 'Best match'], ...[2, 3, 4, 6, 8, 12, 16, 24, 32].map((n) => [String(n), `${n} colours`])], (s) => s.how === 'outlines'),
        range('detail', 'Detail', 1, 10, 1, (s) => s.how === 'outlines'), range('smooth', 'Smoothing', 0, 5, 1, (s) => s.how === 'outlines'), chk('removeBg', 'Leave out the background', (s) => s.how === 'outlines'), { t: 'out' },
        { t: 'btns', buttons: [{ label: 'Save SVG…', primary: true, run: () => saveTrace() }, { label: 'Copy SVG', run: () => copyTrace() }] }],
      applyLabel: 'Use as the picture',
      run: async (img, s, say) => { say && say('Tracing…'); const svg = s.how === 'pixels' ? pixelSVG(img) : (await CraftTracer.trace(X.canvasOf(img).toDataURL('image/png'), { colors: s.colours === 'auto' ? 'auto' : +s.colours, detail: s.detail, smooth: s.smooth, removeBg: s.removeBg })).svg; tool.svg = svg; return svgToImg(svg, img.width, img.height); },
      report: () => (tool && tool.svg ? `<p class="hint">SVG: <b>${kb(tool.svg.length)}</b>, ${fmtN((tool.svg.match(/<(path|rect)/g) || []).length)} shapes.</p>` : '') },
    text: { title: 'To text art (ASCII / ANSI)', icon: IK.ascii, s: { mode: 'chars', columns: 80, ramp: 'standard', colour: 'none', dark: true, contrast: 0 },
      fields: [seg('mode', 'Made of', [['chars', 'Characters'], ['shade', 'Shades ░▒▓'], ['halfblock', 'Half blocks ▀']]), range('columns', 'Characters across', 16, 240), sel('ramp', 'Characters', [['standard', 'Standard  .:-=+*#%@'], ['detailed', 'Detailed (70)'], ['simple', 'Simple  .oO@'], ['blocks', 'Blocks ░▒▓█'], ['dots', 'Braille dots ⣿']], (s) => s.mode === 'chars'),
        sel('colour', 'Colour', [['none', 'None (plain text)'], ['ansi16', 'ANSI 16 colours (DOS, BBS)'], ['ansi256', 'ANSI 256 colours'], ['true', 'True colour (today’s terminals)']]), seg('dark', 'For', [[true, 'A dark screen'], [false, 'White paper']]), range('contrast', 'Contrast', -100, 100),
        { t: 'btns', buttons: [{ label: 'Save text (.txt)', run: () => saveText('txt') }, { label: 'Save ANSI (.ans)', run: () => saveText('ans') }, { label: 'ANSI for terminals', run: () => saveText('ansutf8') }, { label: 'Save web page', run: () => saveText('html') }, { label: 'Copy text', run: () => saveText('copy') }] },
        note('Classic .ANS files use the DOS characters and 16 colours, with a SAUCE record, for ANSI viewers and BBSes. “ANSI for terminals” is UTF-8 with 256 or true colour, for showing with cat or type.')],
      applyLabel: 'Use as the picture',
      run: (img, s) => { const r = A.make(img, { columns: s.columns, mode: s.mode, ramp: s.ramp, colour: s.colour, dark: s.dark, contrast: s.contrast }); tool.art = r; const c = A.render(r); return c.getContext('2d').getImageData(0, 0, c.width, c.height); } },
  };
  Object.entries(TOOLS).forEach(([id, d]) => { d.id = id; });

  // pixel-exact SVG: one rectangle per run of the same colour in a row
  function pixelSVG(img) {
    if (img.width * img.height > 1048576) throw new Error('Exact pixels works for pictures up to about 1000 × 1000 (pixel art). Make it smaller first, or use Smooth outlines.');
    const W = img.width, H = img.height, d = img.data, byCol = new Map();
    for (let y = 0; y < H; y++) { let x = 0; while (x < W) { const i = (y * W + x) * 4; if (d[i + 3] < 128) { x++; continue; } const k = hexOf([d[i], d[i + 1], d[i + 2]]), a = d[i + 3]; let e = x + 1; while (e < W) { const j = (y * W + e) * 4; if (d[j + 3] !== a || hexOf([d[j], d[j + 1], d[j + 2]]) !== k) break; e++; } const key = a < 255 ? k + '/' + a : k; (byCol.get(key) || byCol.set(key, []).get(key)).push(`M${x} ${y}h${e - x}v1h${x - e}z`); x = e; } }
    const paths = [...byCol.entries()].map(([k, p]) => { const [c, a] = k.split('/'); return `<path fill="${c}"${a ? ` fill-opacity="${(a / 255).toFixed(3)}"` : ''} d="${p.join('')}"/>`; });
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">${paths.join('')}</svg>`;
  }
  // Shape recognition on traced outlines: a path whose points all lie close to one ellipse (fitted from their spread)
  // is replaced by that exact ellipse or circle. Paths with holes are left alone.
  function snapShapes(svg) {
    let snapped = 0;
    const out = svg.replace(/<path([^>]*?) d="([^"]+)"([^>]*)\/>/g, (whole, a1, d, a2) => {
      if ((d.match(/M/g) || []).length !== 1) return whole;
      const nums = d.replace(/[A-Za-z]/g, ' ').trim().split(/[\s,]+/).map(Number); if (nums.length < 16 || nums.some(isNaN)) return whole;
      const pts = []; for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
      // points evenly along the outline (by length), so long straight runs do not outweigh curves
      const even = []; let len = 0; const segs = pts.map((p, i) => { const q = pts[(i + 1) % pts.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]); len += l; return l; });
      const step = len / 64; let acc = 0; pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; for (let t = (step - acc) % step; t < segs[i]; t += step) even.push([p[0] + ((q[0] - p[0]) * t) / segs[i], p[1] + ((q[1] - p[1]) * t) / segs[i]]); acc = (acc + segs[i]) % step; });
      if (even.length < 12) return whole;
      const cx = even.reduce((t, p) => t + p[0], 0) / even.length, cy = even.reduce((t, p) => t + p[1], 0) / even.length;
      let sxx = 0, sxy = 0, syy = 0; even.forEach(([x, y]) => { sxx += (x - cx) ** 2; sxy += (x - cx) * (y - cy); syy += (y - cy) ** 2; }); sxx /= even.length; sxy /= even.length; syy /= even.length;
      const tr = sxx + syy, det = sxx * syy - sxy * sxy, l1 = tr / 2 + Math.sqrt(Math.max(0, (tr * tr) / 4 - det)), l2 = tr / 2 - Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
      const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy), ra = Math.sqrt(2 * l1), rb = Math.sqrt(2 * Math.max(1e-9, l2)); if (rb < 2) return whole;
      const ca = Math.cos(ang), sa = Math.sin(ang); let err = 0;
      even.forEach(([x, y]) => { const u = (x - cx) * ca + (y - cy) * sa, v = -(x - cx) * sa + (y - cy) * ca; err += Math.abs(Math.hypot(u / ra, v / rb) - 1); });
      if (err / even.length > 0.045) {
        // not an ellipse: maybe a polygon (few corners, straight sides): simplified (Douglas–Peucker) to its corners
        const tol = Math.max(1, Math.sqrt(l1) * 0.12), dp = (a, z) => { let mi = -1, md = 0; const [x1, y1] = even[a], [x2, y2] = even[z], L = Math.hypot(x2 - x1, y2 - y1) || 1; for (let i = a + 1; i < z; i++) { const dd = Math.abs((x2 - x1) * (y1 - even[i][1]) - (x1 - even[i][0]) * (y2 - y1)) / L; if (dd > md) { md = dd; mi = i; } } return md > tol ? [...dp(a, mi), ...dp(mi, z).slice(1)] : [a, z]; };
        // start from the point farthest from the middle (a corner), so the first side is not split
        let f0 = 0, fd = 0; even.forEach(([x, y], i) => { const dd = (x - cx) ** 2 + (y - cy) ** 2; if (dd > fd) { fd = dd; f0 = i; } });
        const rot = [...even.slice(f0), ...even.slice(0, f0), even[f0]]; even.length = 0; even.push(...rot);
        // a closed outline: split it at the point farthest from the start, then simplify each half
        let far = 0, fdd = 0; even.forEach(([x, y], i) => { const dd = (x - even[0][0]) ** 2 + (y - even[0][1]) ** 2; if (dd > fdd) { fdd = dd; far = i; } });
        const idx = [...dp(0, far), ...dp(far, even.length - 1).slice(1)].slice(0, -1);
        if (idx.length < 3 || idx.length > 8) return whole;
        // each side: the best straight line through all its points (not just its ends, which sit on the staircase's outer
        // corners); the corners are where neighbouring sides cross
        const lines = idx.map((st, j) => { const en = j + 1 < idx.length ? idx[j + 1] : even.length - 1, ps = even.slice(st, en + 1), mx = ps.reduce((t, q) => t + q[0], 0) / ps.length, my = ps.reduce((t, q) => t + q[1], 0) / ps.length; let a = 0, b = 0, c = 0; ps.forEach(([x, y]) => { a += (x - mx) ** 2; b += (x - mx) * (y - my); c += (y - my) ** 2; }); const th = 0.5 * Math.atan2(2 * b, a - c); return [mx, my, Math.cos(th), Math.sin(th)]; });
        const cross = (L1, L2) => { const d = L1[2] * L2[3] - L1[3] * L2[2]; if (Math.abs(d) < 1e-6) return null; const t = ((L2[0] - L1[0]) * L2[3] - (L2[1] - L1[1]) * L2[2]) / d; return [L1[0] + L1[2] * t, L1[1] + L1[3] * t]; };
        const corners = lines.map((L, j) => cross(lines[(j - 1 + lines.length) % lines.length], L) || even[idx[j]]);
        if (corners.some(([x, y]) => Math.hypot(x - cx, y - cy) > Math.sqrt(l1) * 4)) return whole; // a bad fit: keep the traced outline
        snapped++; return `<polygon${(a1 + a2).replace(/\s+$/, '')} points="${corners.map((q) => q.map((v) => v.toFixed(2)).join(',')).join(' ')}"/>`;
      }
      snapped++;
      const round = Math.abs(ra - rb) / ra < 0.04, attrs = (a1 + a2).replace(/\s+$/, '');
      return round ? `<circle${attrs} cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${((ra + rb) / 2).toFixed(2)}"/>` : `<ellipse${attrs} cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" rx="${ra.toFixed(2)}" ry="${rb.toFixed(2)}" transform="rotate(${((ang * 180) / Math.PI).toFixed(2)} ${cx.toFixed(2)} ${cy.toFixed(2)})"/>`;
    });
    return { svg: out, snapped };
  }
  const svgToImg = (svg, w, h, under) => new Promise((res, rej) => { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); if (under) x.drawImage(X.canvasOf(under), 0, 0); x.drawImage(i, 0, 0, w, h); res(x.getImageData(0, 0, w, h)); }; i.onerror = () => rej(new Error('The SVG could not be shown.')); i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
  function saveTrace() { if (!tool || !tool.svg) return toast('Wait for the preview first.'); download(new Blob([tool.svg], { type: 'image/svg+xml' }), baseName(pic().name) + '.svg'); }
  async function copyTrace() { if (!tool || !tool.svg) return; try { await navigator.clipboard.writeText(tool.svg); toast('SVG copied as text.'); } catch (e) { toast('The browser would not copy.'); } }
  async function saveText(kind) {
    const r = tool && tool.art; if (!r) return toast('Wait for the preview first.');
    const n = baseName(pic().name);
    if (kind === 'txt') download(new Blob([A.text(r)], { type: 'text/plain;charset=utf-8' }), n + '.txt');
    else if (kind === 'ans') download(new Blob([A.ansi(r, { dialect: 'cp437', sauce: { title: n, author: '' } })], { type: 'application/octet-stream' }), n + '.ans');
    else if (kind === 'ansutf8') download(new Blob([A.ansi(r, { dialect: 'utf8' })], { type: 'text/plain;charset=utf-8' }), n + '-terminal.ans');
    else if (kind === 'html') download(new Blob([A.html(r, { title: n })], { type: 'text/html;charset=utf-8' }), n + '.html');
    else { try { await navigator.clipboard.writeText(A.text(r)); toast('Text art copied.'); } catch (e) { toast('The browser would not copy.'); } }
  }

  // ------------------------------------------------------------------ running a tool
  let tool = null, token = 0, timer = null;
  // Where: any tool that keeps the picture's size can work only where a map says (a mask: white = apply, black = leave)
  const NO_MASK = new Set(['resize', 'crop', 'canvas', 'straighten', 'looks', 'text', 'trace', 'upscale', 'remaster', 'modern', 'depth', 'noisemap', 'stack']);
  const maskable = (def) => !NO_MASK.has(def.id) && !def.viewOnly;
  const MASK_FIELDS = [
    { t: 'html', html: () => '<h3 style="margin:10px 0 0">Where</h3>' },
    sel('wMap', 'Apply', [['', 'Everywhere'], ...IC.maps.LIST.map((m) => [m.id, `Only on: ${m.name}`])]),
    sel('wOp', 'Combined with a second map (Calculations)', [['', 'No'], ['multiply', 'Multiply: where both are'], ['add', 'Add: where either is'], ['subtract', 'Subtract: the first, not the second'], ['difference', 'Difference'], ['lighter', 'Lighter of the two'], ['darker', 'Darker of the two']], (s) => !!s.wMap),
    sel('wMap2', 'Second map', IC.maps.LIST.map((m) => [m.id, m.name]), (s) => !!s.wMap && !!s.wOp),
    chk('wInvert', 'Everywhere except there', (s) => !!s.wMap), range('wLevel', 'Starts at', 0, 1, 0.01, (s) => !!s.wMap), range('wSoft', 'Softness of the change', 0.02, 1, 0.01, (s) => !!s.wMap), range('wFeather', 'Feather the edges (pixels)', 0, 40, 1, (s) => !!s.wMap),
    { t: 'btns', show: (s) => !!s.wMap, buttons: [{ label: 'Show the mask / the result', run: () => { tool.showMask = !tool.showMask; } }] },
  ];
  const maskOf = (t) => IC.maps.mask(t.base, { map: t.s.wMap, map2: t.s.wOp ? t.s.wMap2 : '', op: t.s.wOp, invert: t.s.wInvert, level: t.s.wLevel, softness: t.s.wSoft, feather: t.s.wFeather });
  const masked = (t, r) => (t.s.wMap && r.width === t.base.width && r.height === t.base.height ? IC.maps.apply(t.base, r, maskOf(t)) : r);
  const isLive = (t) => (typeof t.def.live === 'function' ? t.def.live(t.s) : t.def.live !== false);
  function openTool(id, preset) {
    if (!pic()) { toast('Open a picture first.'); return; }
    if (tool) closeTool(true);
    const def = TOOLS[id], base = now();
    tool = { def, base, s: { ...JSON.parse(JSON.stringify(typeof def.s === 'function' ? def.s(base) : def.s)), ...(preset || {}) }, preview: null };
    if (maskable(def)) tool.s = { wMap: '', wOp: '', wMap2: 'skin', wInvert: false, wLevel: 0.35, wSoft: 0.3, wFeather: 2, ...tool.s };
    if (mapView) closeMap();
    showSide('right'); renderProps(); if (def.enter) def.enter();
    if (isLive(tool)) schedule(0); else show();
  }
  // Ask AI (Ollama): connect, choose a model, look, then run the ticked steps one by one (each a step in History)
  function assessPanel(into, t) {
    const O = IC.ollama, st = (t.oll = t.oll || { status: 'checking' }), el = document.createElement('div'); into.append(el);
    const again = () => { if (tool === t) renderProps(); };
    if (st.status === 'checking' && !st.started) { st.started = true; O.models().then((m) => { st.models = m; st.status = m.length ? 'ok' : 'none'; if (!O.cfg.model || !m.some((x) => x.name === O.cfg.model)) O.cfg.model = m.length ? m[0].name : ''; again(); }, (e) => { st.status = e.blocked ? 'blocked' : 'error'; st.err = e.message; again(); }); }
    const p = (h) => { const d = document.createElement('div'); d.innerHTML = h; el.append(d); return d; };
    p('<p class="hint">A vision model running in <b>Ollama</b> on this computer looks at the picture and says what it is and what is wrong with it. It only describes: ImageCraft’s own tools do the work, as steps you can undo. Nothing leaves this computer.</p>');
    if (st.status === 'checking') { p('<p class="hint">Looking for Ollama…</p>'); return; }
    if (st.status === 'blocked') { p(`<p class="hint"><b>Could not reach Ollama</b> at ${esc(O.cfg.url)}. If it is not running, start it. If it is running:</p><p class="hint">${O.ORIGIN_HELP}</p>`); }
    if (st.status === 'error') p(`<p class="hint"><b>Ollama:</b> ${esc(st.err)}</p>`);
    if (st.status === 'none') p('<p class="hint">Ollama is running, but none of its models can see pictures. In a command prompt: <code>ollama pull qwen3.5</code> (about 6.6 GB; good at counting faces and naming colours and materials) or <code>ollama pull gemma3</code> (3.3 GB, quicker).</p>');
    if (st.status === 'blocked' || st.status === 'error' || st.status === 'none') {
      const b = p('<div class="btns"><button class="btn outline" type="button">Try again</button></div>'); b.querySelector('button').onclick = () => { t.oll = { status: 'checking' }; again(); }; return;
    }
    const lab = document.createElement('label'); lab.className = 'field'; lab.innerHTML = '<span>Model</span>'; const sel = document.createElement('select'); sel.className = 'input';
    st.models.forEach((m) => sel.add(new Option(`${m.name} (${m.gb.toFixed(1)} GB)`, m.name))); sel.value = O.cfg.model; sel.onchange = () => { O.cfg.model = sel.value; O.save(); }; lab.append(sel); el.append(lab);
    const look = p('<div class="btns"><button class="btn primary" type="button">Look at the picture</button></div>').querySelector('button');
    look.onclick = async () => {
      const img = t.base; busyNow('Asking Ollama…');
      try { st.result = await O.assess(img, { model: sel.value, onStep: (m) => { if (tool === t) busyNow(m); } }); st.steps = O.recipe(st.result); ICLOG.add('info', `Ask AI: ${st.result.model} took ${st.result.seconds.toFixed(0)} s`); }
      catch (e) { ICLOG.error('Ask AI failed', e); toast(e.blocked ? 'Could not reach Ollama.' : e.message); if (e.blocked) st.status = 'blocked'; }
      busy(null); again();
    };
    const a = st.result; if (!a) { p('<p class="hint">The first look loads the model, which can take a minute; after that 10 to 30 seconds on a mid-range graphics card. qwen3.5 was the most truthful in tests; smaller models tend to list damage that is not there.</p>'); return; }
    const later = O.notYet(a);
    p(`<div class="hint" style="margin-top:8px"><b>${esc(a.subject)}</b><br>${esc(a.kind)}, ${esc(a.colour)}, ${esc(a.era)}${a.faces ? `, ${a.faces} face${a.faces === 1 ? '' : 's'}` : ''}.<br>Seen: ${a.problems.length ? a.problems.map(esc).join(', ') : 'no damage'}.<br><i>${esc(a.materials)}</i></div>`);
    if (st.steps.length) {
      const box = document.createElement('div'); box.className = 'field'; box.innerHTML = '<span>Steps to run (each one goes into History)</span>';
      st.steps.forEach((s0) => { const l = document.createElement('label'); l.className = 'check'; const c = document.createElement('input'); c.type = 'checkbox'; c.checked = s0.on; c.onchange = () => { s0.on = c.checked; }; l.append(c, document.createTextNode(` ${TOOLS[s0.id].title} — for ${s0.why}`)); box.append(l); });
      el.append(box);
      const go = p('<div class="btns"><button class="btn primary" type="button">Run the ticked steps</button></div>').querySelector('button');
      go.onclick = () => { const steps = st.steps.filter((s0) => s0.on); if (!steps.length) return toast('Tick at least one step.'); closeTool(true); runSteps(steps); };
    }
    if (later.length) p(`<p class="hint">Not mended yet: ${later.map(esc).join(', ')}. Repair tools are still to come.</p>`);
    if (a.problems.includes('low resolution')) p('<p class="hint">It looks small: try Make bigger after the clean-up.</p>');
    p(`<div class="field"><span>How it should look (to guide later steps)</span><p class="hint" style="user-select:text">${esc(a.description)}</p></div>`);
    const cp = p('<div class="btns"><button class="btn outline" type="button">Copy the description</button></div>').querySelector('button');
    cp.onclick = () => { navigator.clipboard.writeText(`${a.subject}. ${a.materials}. ${a.description}`).then(() => toast('Copied.'), () => toast('Could not copy.')); };
  }
  async function runSteps(steps) {
    for (const s0 of steps) {
      const def = TOOLS[s0.id], img = pic().steps[pic().at].img; busyNow(`${def.title}…`); await wait(0);
      try { const base = typeof def.s === 'function' ? def.s(img) : JSON.parse(JSON.stringify(def.s)); const out = await def.run(img, { ...base, ...s0.s }, (m) => busyNow(m)); push(def.title, out); }
      catch (e) { busy(null); ICLOG.error(`${def.title} failed`, e); toast(`${def.title}: ${e.message}`); return; }
    }
    busy(null); toast(`Done: ${steps.length} step${steps.length === 1 ? '' : 's'}. Each is in History; Undo goes back one at a time.`);
  }
  function closeTool(quiet) {
    if (!tool) return; const d = tool.def; tool = null; token++; clearTimeout(timer); busy(null);
    if (d.leave) d.leave(); if (!quiet) { renderProps(); show(); if (view.fit) fitView(); }
  }
  function schedule(ms) { clearTimeout(timer); const t = tool; if (!t) return; const big = t.base.width * t.base.height > 2e6; timer = setTimeout(() => runPreview(), ms ?? (big ? 320 : 140)); }
  async function runPreview() {
    const t = tool; if (!t) return; const my = ++token;
    busy(`${t.def.title}…`);
    try {
      await wait(0); const t0 = performance.now(); if (t.s.wMap) await IC.maps.prepare([t.s.wMap, t.s.wOp ? t.s.wMap2 : ''], t.base); const r0 = await t.def.run(t.base, t.s, (m) => { if (my === token) busyNow(m); }), r = masked(t, r0);
      if (my !== token || tool !== t) return;
      ICLOG.info(`${t.def.title}: ${t.base.width} × ${t.base.height} → ${r.width} × ${r.height} in ${Math.round(performance.now() - t0)} ms`, JSON.stringify(t.s).slice(0, 400));
      const sizeChanged = !t.preview ? r.width !== t.base.width || r.height !== t.base.height : r.width !== t.preview.width || r.height !== t.preview.height;
      t.out = r; t.preview = t.showMask && t.s.wMap ? IC.maps.grey(maskOf(t), t.base.width, t.base.height) : r; busy(null); show(); if (sizeChanged && view.fit) fitView(); renderOut();
    } catch (e) { ICLOG.error(`${t.def.title} failed`, e); if (my === token) { busy(null); toast(e.message || String(e)); } }
  }
  async function applyTool() {
    const t = tool; if (!t) return;
    if (t.def.viewOnly) { closeTool(); return; }
    if (t.def.final) { const r = masked(t, await t.def.final(t.base, t.s)); closeTool(true); push(t.def.title + (t.s.wMap ? ' (masked)' : ''), r); return; }
    if (t.def.id === 'crop' || !t.preview || t.stale) { await runPreview(); if (tool !== t || !t.preview) return; }
    if (t.def.id === 'stack') { const r = t.out || t.preview, nm = `${baseName(pic().name)} – combined.png`; closeTool(true); addPic(nm, r, { format: 'Combined', bits: 24 }); toast('The combined picture is open as a new picture.'); return; }
    const r = t.out || t.preview; closeTool(true); push(t.def.title + (t.s && t.s.wMap ? ' (masked)' : ''), r);
  }
  // a tool that needs no settings: done at once, as a step
  function quick(label, fn) {
    if (!pic()) { toast('Open a picture first.'); return; }
    if (tool) closeTool(true);
    busyNow(`${label}…`);
    setTimeout(async () => { const t0 = performance.now(); try { push(label, await fn(now())); ICLOG.info(`${label} in ${Math.round(performance.now() - t0)} ms`); } catch (e) { ICLOG.error(`${label} failed`, e); toast(e.message); } busy(null); }, 20);
  }

  // ------------------------------------------------------------------ the right-hand panel
  function renderProps() {
    const P = $('props'); P.innerHTML = '';
    if (!tool) { P.append(pictureInfo()); return; }
    const t = tool, d = t.def;
    const head = document.createElement('div'); head.className = 'tool-title'; head.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color:var(--accent)">${(d.icon || '').replace(/class="fill"/g, 'fill="currentColor" fill-opacity=".25"')}</svg><h2>${esc(d.title)}</h2>`;
    P.append(head);
    const sec = document.createElement('div'); sec.className = 'sec'; P.append(sec);
    const set = (k, v, rebuild) => { t.s[k] = v; if (d.change) d.change(t.s, k, t.base); t.stale = true; if (rebuild) renderProps(); else if (d.id === 'crop') { placeCrop(); syncCropFields(); } if (isLive(t)) schedule(); else if (d.id === 'crop') placeCrop(); };
    const build = (f, into) => {
      if (f.show && !f.show(t.s)) return;
      if (f.t === 'row') { const r = document.createElement('div'); r.className = 'row'; f.items.forEach((x) => build(x, r)); into.append(r); return; }
      if (f.t === 'html') { const d0 = document.createElement('div'); d0.innerHTML = f.html(t.s); into.append(d0); return; }
      if (f.t === 'note') { const p = document.createElement('p'); p.className = 'hint'; p.innerHTML = f.html; into.append(p); return; }
      if (f.t === 'out') { const o = document.createElement('div'); o.id = 'tool-out'; into.append(o); return; }
      if (f.t === 'btns' && f.show && !f.show(t.s)) return;
      if (f.t === 'btns') { const r = document.createElement('div'); r.className = 'btns'; f.buttons.forEach((b) => { const e = document.createElement('button'); e.className = 'btn ' + (b.primary ? 'primary' : 'outline'); e.type = 'button'; e.textContent = b.label; e.onclick = () => { b.run(t.s, t.base); t.stale = true; renderProps(); if (d.id === 'crop') placeCrop(); else if (isLive(t)) schedule(0); }; r.append(e); }); into.append(r); return; }
      if (f.t === 'looks') { into.append(looksTiles()); return; }
      if (f.t === 'custom') { f.render(into, t); return; }
      if (f.t === 'picmulti') { const box = document.createElement('div'); box.className = 'field'; box.innerHTML = `<span>${esc(f.label)}</span>`; pics.forEach((p, k) => { const l = document.createElement('label'); l.className = 'check'; const c = document.createElement('input'); c.type = 'checkbox'; c.checked = k === cur || t.s[f.k].includes(k); c.disabled = k === cur; c.onchange = () => { const v = t.s[f.k].filter((q) => q !== k); if (c.checked) v.push(k); set(f.k, v, true); }; l.append(c, document.createTextNode(' ' + p.name + (k === cur ? ' (the one to match)' : ''))); box.append(l); }); into.append(box); return; }
      if (f.t === 'picsel') { if (f.show && !f.show(t.s)) return; const lab = document.createElement('label'); lab.className = 'field'; lab.innerHTML = `<span>${esc(f.label)}</span>`; const i = document.createElement('select'); i.className = 'input'; pics.forEach((p, k) => { if (k !== cur) i.add(new Option(p.name, k)); }); if (!i.options.length) i.add(new Option('(open or make another picture first)', -1)); i.value = String(t.s[f.k]); i.onchange = () => set(f.k, +i.value, true); lab.append(i); into.append(lab); return; }
      if (f.t === 'stepsel') { if (f.show && !f.show(t.s)) return; const lab = document.createElement('label'); lab.className = 'field'; lab.innerHTML = `<span>${esc(f.label)}</span>`; const i = document.createElement('select'); i.className = 'input'; pic().steps.forEach((st, k) => { if (k !== pic().at) i.add(new Option(`${k}. ${st.label}`, k)); }); i.value = String(t.s[f.k]); i.onchange = () => set(f.k, +i.value, true); lab.append(i); into.append(lab); return; }
      if (f.t === 'curve') { into.append(curveEditor(t, set)); return; }
      const lab = document.createElement('label'); lab.className = f.t === 'check' ? 'check' : 'field';
      const v = t.s[f.k];
      if (f.t === 'check') { const i = document.createElement('input'); i.type = 'checkbox'; i.checked = !!v; i.onchange = () => set(f.k, i.checked, true); lab.append(i, document.createTextNode(' ' + f.label)); into.append(lab); return; }
      lab.innerHTML = `<span>${esc(f.label)}</span>`;
      if (f.t === 'range') { const i = document.createElement('input'); i.type = 'range'; i.min = f.min; i.max = f.max; i.step = f.step; i.value = v; i.setAttribute('aria-label', f.label); i.oninput = () => set(f.k, +i.value); lab.append(i); }
      else if (f.t === 'num') { const i = document.createElement('input'); i.type = 'number'; i.className = 'input'; i.dataset.k = f.k; if (f.min != null) i.min = f.min; if (f.max != null) i.max = f.max; i.value = Math.round(v); i.onchange = () => set(f.k, Math.max(f.min ?? 0, +i.value || 0), true); lab.append(i); }
      else if (f.t === 'select') { const i = document.createElement('select'); i.className = 'input'; f.options.forEach(([k, l]) => i.add(new Option(l, k))); i.value = String(v); i.onchange = () => set(f.k, i.value, true); lab.append(i); }
      else if (f.t === 'seg') { const g = document.createElement('div'); g.className = 'seg'; f.options.forEach(([k, l]) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = l; b.setAttribute('aria-pressed', String(String(v) === String(k))); b.onclick = () => set(f.k, k, true); g.append(b); }); lab.append(g); }
      else if (f.t === 'colour') { const i = document.createElement('input'); i.type = 'color'; i.className = 'input'; i.value = v; i.oninput = () => set(f.k, i.value); lab.append(i); }
      else if (f.t === 'swatch') { const r = document.createElement('div'); r.style.cssText = 'display:flex;gap:8px;align-items:center'; const i = document.createElement('input'); i.type = 'color'; i.className = 'input'; i.style.width = '64px'; i.value = hexOf(v); i.oninput = () => set(f.k, rgbOf(i.value)); r.append(i, Object.assign(document.createElement('span'), { className: 'hint', textContent: hexOf(v) })); lab.append(r); }
      into.append(lab);
    };
    (maskable(d) ? d.fields.concat(MASK_FIELDS) : d.fields).forEach((f) => build(f, sec));
    const acts = document.createElement('div'); acts.className = 'sec';
    const live = isLive(t);
    acts.innerHTML = `<div class="btns">${!live && d.id !== 'crop' ? '<button class="btn outline" data-a="preview">Preview</button>' : ''}${d.viewOnly ? '<button class="btn primary" data-a="cancel">Close</button>' : `<button class="btn" data-a="cancel">Cancel</button><button class="btn primary" data-a="apply">${esc(d.applyLabel || 'Apply')}</button>`}</div>
      <label class="check"><input type="checkbox" data-a="compare" ${view.compare ? 'checked' : ''}> Compare with before (drag the line)</label>`;
    acts.onclick = (e) => { const a = e.target.dataset.a; if (a === 'apply') applyTool(); else if (a === 'cancel') closeTool(); else if (a === 'preview') runPreview(); };
    acts.querySelector('[data-a="compare"]').onchange = (e) => { view.compare = e.target.checked; show(); };
    P.append(acts);
    renderOut();
  }
  function renderOut() { const o = document.getElementById('tool-out'); if (o && tool && tool.def.report) o.innerHTML = tool.preview ? tool.def.report(tool.preview) : '<p class="hint">Working it out…</p>'; }
  // the Curves editor: the channel's histogram, the curve, its points (click adds, drag moves, double-click removes)
  function curveEditor(t, set) {
    const box = document.createElement('div'); box.className = 'curvebox'; const c = document.createElement('canvas'); c.width = c.height = 256 * 2; box.append(c);
    const ch = () => t.s.channel, pts = () => t.s.pts[ch()];
    const hist = (() => { const h = new Float32Array(256), d = t.base.data, k = ch(); for (let i = 0; i < d.length; i += 4) { const v = k === 'r' ? d[i] : k === 'g' ? d[i + 1] : k === 'b' ? d[i + 2] : Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]); h[v]++; } const m = Math.max(...h.slice(2, 254)) || 1; return h.map((v) => Math.min(1, v / m)); })();
    const col = { lum: '#888', rgb: '#888', r: '#e5484d', g: '#30a46c', b: '#3e63dd' }[ch()];
    const draw = () => {
      const x = c.getContext('2d'), S = 2; x.clearRect(0, 0, c.width, c.height);
      x.fillStyle = col + '33'; for (let i = 0; i < 256; i++) x.fillRect(i * S, c.height - hist[i] * c.height * 0.9, S, hist[i] * c.height * 0.9);
      x.strokeStyle = 'rgba(128,128,128,.35)'; x.lineWidth = 1; for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo(i * 128, 0); x.lineTo(i * 128, c.height); x.moveTo(0, i * 128); x.lineTo(c.width, i * 128); x.stroke(); }
      x.beginPath(); x.moveTo(0, c.height); x.lineTo(c.width, 0); x.stroke();
      const T = IC.detail.curve(pts()); x.strokeStyle = ch() === 'lum' || ch() === 'rgb' ? getComputedStyle(document.body).color : col; x.lineWidth = 3; x.beginPath(); for (let i = 0; i < 256; i++) { const yy = c.height - T[i] * S; if (i) x.lineTo(i * S, yy); else x.moveTo(0, yy); } x.stroke();
      pts().forEach(([px, py]) => { x.fillStyle = '#fff'; x.strokeStyle = '#222'; x.lineWidth = 2; x.beginPath(); x.arc(px * S, c.height - py * S, 8, 0, Math.PI * 2); x.fill(); x.stroke(); });
    };
    const at = (e) => { const r = c.getBoundingClientRect(); return [Math.max(0, Math.min(255, ((e.clientX - r.left) / r.width) * 255)), Math.max(0, Math.min(255, (1 - (e.clientY - r.top) / r.height) * 255))]; };
    let drag = -1;
    c.onpointerdown = (e) => { const [x, y] = at(e), P = pts(); let k = P.findIndex(([px, py]) => Math.hypot(px - x, py - y) < 10); if (k < 0) { P.push([Math.round(x), Math.round(y)]); P.sort((a, b) => a[0] - b[0]); k = P.findIndex(([px, py]) => px === Math.round(x) && py === Math.round(y)); } drag = k; c.setPointerCapture(e.pointerId); draw(); set('pts', t.s.pts); };
    c.onpointermove = (e) => { if (drag < 0) return; const [x, y] = at(e), P = pts(), lo = drag > 0 ? P[drag - 1][0] + 1 : 0, hi = drag < P.length - 1 ? P[drag + 1][0] - 1 : 255; P[drag] = [Math.round(Math.max(lo, Math.min(hi, x))), Math.round(y)]; draw(); set('pts', t.s.pts); };
    c.onpointerup = () => { drag = -1; };
    c.ondblclick = (e) => { const [x, y] = at(e), P = pts(), k = P.findIndex(([px, py]) => Math.hypot(px - x, py - y) < 10); if (k > 0 && k < P.length - 1) { P.splice(k, 1); draw(); set('pts', t.s.pts); } };
    draw(); return box;
  }
  // the old computers, each as a little picture of how this picture would look
  function looksTiles() {
    const wrap = document.createElement('div'); wrap.className = 'tiles';
    const src = X.resize(tool.base, { width: Math.min(tool.base.width, 480), height: Math.round((Math.min(tool.base.width, 480) * tool.base.height) / tool.base.width) });
    const items = Object.entries(C.LOOKS).map(([k, L]) => { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-pressed', String(tool.s.look === k)); const c = document.createElement('canvas'); c.width = 160; c.height = 120; b.append(c, document.createTextNode(L.name)); b.onclick = () => { tool.s.look = k; wrap.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); schedule(0); }; wrap.append(b); return [k, c]; });
    const t = tool; (async () => { for (const [k, c] of items) { await wait(10); if (tool !== t) return; const r = C.look(src, k, { keep: false, fit: 'cover' }), x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(X.canvasOf(r), 0, 0, c.width, c.height); } })();
    return wrap;
  }
  function pictureInfo() {
    const box = document.createElement('div');
    if (!pic()) { box.innerHTML = `<div class="props-head">ImageCraft</div><div class="sec"><p class="hint">Open a picture to start: Home › Open, drop files on the middle, or paste one.</p><p class="hint">Then pick a tool from the ribbon. Each tool shows a live preview here; Apply makes it a step you can undo.</p></div>`; return box; }
    const p = pic(), st = p.steps[p.at], img = st.img, inf = p.info;
    const cs = st.colours != null && st.colours >= 0 && st.colours <= 256 ? C.colours(img, 256) : null;
    box.innerHTML = `<div class="props-head">Picture</div><div class="sec"><dl class="facts">
      <dt>Name</dt><dd>${esc(p.name)}</dd><dt>Size</dt><dd>${fmtN(img.width)} × ${fmtN(img.height)} pixels</dd>
      <dt>Opened as</dt><dd>${esc(inf.format || '')}${inf.bits ? ` · ${inf.bits}-bit` : ''}${inf.note ? ` · ${esc(inf.note)}` : ''}</dd>
      ${p.size ? `<dt>File</dt><dd>${kb(p.size)}</dd>` : ''}
      <dt>Colours</dt><dd>${st.colours == null ? 'counting…' : st.colours < 0 ? 'many (a big picture)' : fmtN(st.colours)}${F.hasClear(img) ? ' · has see-through parts' : ''}</dd>
      <dt>Steps</dt><dd>${p.at} change${p.at === 1 ? '' : 's'}${p.dirty ? ' (not saved)' : ''}</dd></dl>
      ${cs ? `<h3>Its colours</h3><div class="swatches">${cs.map((c) => `<span title="${hexOf(c.rgb)} · ${fmtN(c.n)} pixels" style="background:${hexOf(c.rgb)}"></span>`).join('')}</div>` : ''}</div>
      <div class="sec"><h3>Quick</h3><div class="btns"><button class="btn outline" data-q="save">Save as…</button><button class="btn outline" data-q="auto">Auto fix</button><button class="btn outline" data-q="depth">Colour depth</button><button class="btn outline" data-q="modern">Modernise</button></div></div>`;
    box.onclick = (e) => { const q = e.target.dataset.q; if (q === 'save') openSave(); else if (q === 'auto') quick('Auto fix', (i) => X.autoFix(i)); else if (q) openTool(q); };
    return box;
  }

  // ------------------------------------------------------------------ the left-hand panel
  function renderPics() {
    const L = $('pics'); L.innerHTML = '';
    pics.forEach((p, i) => {
      const b = document.createElement('div'); b.className = 'pic'; b.setAttribute('role', 'button'); b.tabIndex = 0; b.setAttribute('aria-current', String(i === cur));
      const img = p.steps[p.at].img, c = document.createElement('canvas'), k = Math.min(1, 112 / Math.max(img.width, img.height)); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
      const cx = c.getContext('2d'); cx.imageSmoothingQuality = 'high'; cx.drawImage(X.canvasOf(img), 0, 0, c.width, c.height);
      b.innerHTML = `<span></span><span><b>${esc(p.name)}${p.dirty ? ' •' : ''}</b><small>${img.width} × ${img.height}</small></span><button class="x" title="Close this picture" aria-label="Close ${esc(p.name)}">✕</button>`;
      b.firstChild.replaceWith(c);
      b.onclick = (e) => { if (e.target.closest('.x')) closePic(i); else if (i !== cur) select(i); };
      b.onkeydown = (e) => { if (e.key === 'Enter') select(i); };
      L.append(b);
    });
  }
  function renderHist() {
    const L = $('hist'); L.innerHTML = ''; const p = pic(); if (!p) return;
    p.steps.forEach((s, i) => { const li = document.createElement('li'), b = document.createElement('button'); b.innerHTML = `<span class="n">${i}</span>${esc(s.label)}`; b.setAttribute('aria-current', String(i === p.at)); if (i > p.at) b.className = 'undone'; b.onclick = () => goStep(i); li.append(b); L.append(li); });
  }
  const showTab = (name) => { document.querySelectorAll('.tab').forEach((x) => x.setAttribute('aria-selected', String(x.dataset.tab === name))); ['pics', 'hist', 'maps', 'debug'].forEach((k) => { $('tab-' + k).hidden = k !== name; }); if (name === 'debug') renderLog(); if (name === 'maps') renderMaps(); };
  // ------------------------------------------------------------------ maps (left panel, Maps tab; one shown at a time over the picture)
  let thumbFor = null, thumbSmall = null;
  function renderMaps() {
    const L = $('maplist'); if (!L || $('tab-maps').hidden) return;
    const img = now(); if (!img) { L.innerHTML = '<p class="hint">Open a picture first.</p>'; return; }
    L.innerHTML = ''; let group = null;
    IC.maps.LIST.forEach((m) => {
      const g = m.group || 'Measured'; if (g !== group) { group = g; L.insertAdjacentHTML('beforeend', `<h4>${esc(g)}</h4>`); }
      const b = document.createElement('button'); b.type = 'button'; b.dataset.map = m.id; b.title = m.what; b.setAttribute('aria-current', String(!!mapView && mapView.id === m.id));
      const c = document.createElement('canvas'); c.width = 112; c.height = 84; b.append(c); b.insertAdjacentHTML('beforeend', `<span><b>${esc(m.name)}</b><small>${esc(m.what)}</small></span>`);
      b.onclick = () => openMap(m.id); L.append(b);
    });
    // small pictures of each map, made from a small copy (quick), one at a time so the page stays responsive
    if (thumbFor !== img) { thumbFor = img; const k = Math.min(1, 240 / Math.max(img.width, img.height)); thumbSmall = X.resize(img, { width: img.width * k, height: img.height * k }); }
    const small = thumbSmall, list = [...L.querySelectorAll('button')];
    (async () => { for (const b of list) { await wait(5); if (thumbSmall !== small || !document.body.contains(b)) return; const m = IC.maps.LIST.find((x) => x.id === b.dataset.map); const map = IC.maps.make(m.id, small), v = m.grey ? IC.maps.grey(map, small.width, small.height) : IC.maps.heat(map, small), c = b.querySelector('canvas'), x = c.getContext('2d'); x.fillStyle = '#111'; x.fillRect(0, 0, c.width, c.height); const kk = Math.min(c.width / small.width, c.height / small.height); x.drawImage(X.canvasOf(v), (c.width - small.width * kk) / 2, (c.height - small.height * kk) / 2, small.width * kk, small.height * kk); } })();
  }
  function openMap(id, mode) {
    const img = now(); if (!img) return; if (tool) closeTool(true);
    const m = IC.maps.LIST.find((x) => x.id === id); mode = mode || (m.grey ? 'grey' : 'heat');
    busyNow(m.needsFaces && !IC.faces.known(img) ? 'Finding faces (the first time downloads the face finder)…' : `Measuring: ${m.name}…`);
    setTimeout(async () => {
      try { await IC.maps.prepare(id, img); } catch (e) { busy(null); ICLOG.error('Face finder failed', e); toast('The face finder could not start: ' + e.message); return; }
      const t0 = performance.now(), map = IC.maps.make(id, img);
      mapView = { id, mode, img: mode === 'grey' ? IC.maps.grey(map, img.width, img.height) : IC.maps.heat(map, img) };
      ICLOG.info(`Map ${m.name}: ${img.width} × ${img.height} in ${Math.round(performance.now() - t0)} ms`);
      busy(null); show(); renderMapBar(); renderMaps();
    }, 20);
  }
  function closeMap() { mapView = null; $('mapbar').hidden = true; show(); renderMaps(); }
  function renderMapBar() {
    const bar = $('mapbar'); if (!mapView) { bar.hidden = true; return; }
    const m = IC.maps.LIST.find((x) => x.id === mapView.id);
    bar.innerHTML = `<b>Map: ${esc(m.name)}</b><div class="seg"><button class="btn" data-m="heat" aria-pressed="${mapView.mode === 'heat'}">Heat</button><button class="btn" data-m="grey" aria-pressed="${mapView.mode === 'grey'}">Grey (mask)</button></div><button class="btn outline" data-a="open">Open as a picture</button><button class="btn outline" data-a="clear">Make see-through by it</button><button class="btn primary" data-a="back">Back to the picture</button>`;
    bar.hidden = false;
    bar.onclick = (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.m) { openMap(mapView.id, b.dataset.m); return; }
      const img = now(), map = IC.maps.make(mapView.id, img);
      if (b.dataset.a === 'back') closeMap();
      else if (b.dataset.a === 'open') { const g = IC.maps.grey(map, img.width, img.height); closeMap(); addPic(`${baseName(pic().name)} – ${m.name}.png`, g, { format: 'Map', bits: 8 }); toast(`${m.name} opened as a picture of its own.`); }
      else if (b.dataset.a === 'clear') { const o = new ImageData(new Uint8ClampedArray(img.data), img.width, img.height); for (let p = 0; p < map.length; p++) o.data[p * 4 + 3] = Math.round(o.data[p * 4 + 3] * map[p]); closeMap(); push(`See-through by ${m.name}`, o); }
    };
  }
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));
  const showSide = (side) => { if (matchMedia('(max-width: 980px)').matches) document.querySelector('.work').classList.add(side === 'right' ? 'show-right' : 'show-left'); };

  // ------------------------------------------------------------------ debug log (left panel, Debug tab)
  function renderLog() {
    const L = $('dbg-list'); if (!L || $('tab-debug').hidden) return;
    const only = $('dbg-errors').checked, items = ICLOG.entries().filter((e) => !only || e.level !== 'info').slice(-200).reverse();
    L.innerHTML = items.length ? items.map((e) => `<li class="${e.level}"><time>${ICLOG.time(e.t)}</time>${esc(e.msg)}${e.detail ? `<details><summary>details</summary><pre>${esc(e.detail)}</pre></details>` : ''}</li>`).join('') : '<li class="info">Nothing logged yet.</li>';
  }
  let logT = null;
  ICLOG.onChange(() => { clearTimeout(logT); logT = setTimeout(() => { renderLog(); status(); }, 150); });
  $('dbg-errors').onchange = renderLog;
  $('dbg-clear').onclick = () => { ICLOG.clear(); renderLog(); status(); };
  $('dbg-copy').onclick = async () => { try { await navigator.clipboard.writeText(ICLOG.text()); toast('Debug log copied. Paste it into a message.'); } catch (e) { toast('The browser would not copy; use Save instead.'); } };
  $('dbg-save').onclick = () => { const d = new Date(), p2 = (n) => String(n).padStart(2, '0'); download(new Blob([ICLOG.text()], { type: 'text/plain;charset=utf-8' }), `ImageCraft debug ${d.getFullYear()}.${p2(d.getMonth() + 1)}.${p2(d.getDate())}.${p2(d.getHours())}.${p2(d.getMinutes())}.txt`); };
  const openDebug = () => { showSide('left'); showTab('debug'); };

  // ------------------------------------------------------------------ status bar
  let hover = null;
  const statusEl = $('status');
  statusEl.innerHTML = `<button class="st-err" id="st-err" hidden title="Errors were logged: open the Debug tab"></button><span id="st-size"></span><span id="st-cols"></span><span id="st-at"></span><span class="grow"></span><span class="zoombox"><button class="btn" id="st-out" title="Zoom out" aria-label="Zoom out">−</button><input type="range" id="st-zoom" min="-100" max="100" value="0" aria-label="Zoom" data-rt-skip><button class="btn" id="st-in" title="Zoom in" aria-label="Zoom in">+</button><button class="btn" id="st-pct" title="Fit the picture (click) or 100% (double-click)">100%</button></span>`;
  // the zoom slider: 100% in the middle, 2% at the left, 6400% at the right
  const zToS = (z) => Math.round(z >= 1 ? (Math.log(z) / Math.log(64)) * 100 : (Math.log(z) / Math.log(50)) * 100), sToZ = (s) => (s >= 0 ? Math.pow(64, s / 100) : Math.pow(50, s / 100));
  $('st-zoom').oninput = (e) => setZoom(sToZ(+e.target.value));
  $('st-err').onclick = openDebug;
  $('st-in').onclick = () => zoomBy(1.25); $('st-out').onclick = () => zoomBy(0.8); $('st-pct').onclick = () => fitView(); $('st-pct').ondblclick = () => actual();
  function zoomUI() { $('st-pct').textContent = Math.round(view.zoom * 100) + '%'; if (document.activeElement !== $('st-zoom')) $('st-zoom').value = zToS(view.zoom); }
  function status() {
    const img = now(), st = pic() && pic().steps[pic().at];
    const ne = ICLOG.errors(); $('st-err').hidden = !ne; $('st-err').textContent = `⚠ ${ne} error${ne === 1 ? '' : 's'}`;
    $('st-size').innerHTML = img ? `<b>${fmtN(img.width)} × ${fmtN(img.height)}</b> pixels` : 'No picture open';
    $('st-cols').innerHTML = st && st.colours != null ? (st.colours < 0 ? 'Many colours' : `<b>${fmtN(st.colours)}</b> colour${st.colours === 1 ? '' : 's'}`) : '';
    statusHover();
  }
  function statusHover() {
    const img = shown(); if (!hover || !img) { $('st-at').textContent = ''; return; }
    const i = (hover[1] * img.width + hover[0]) * 4, d = img.data, c = [d[i], d[i + 1], d[i + 2]];
    $('st-at').innerHTML = `${hover[0]}, ${hover[1]} · <span class="sw" style="background:${hexOf(c)}"></span>${hexOf(c)}${d[i + 3] < 255 ? ` · ${Math.round((d[i + 3] / 255) * 100)}% solid` : ''}`;
  }

  // ------------------------------------------------------------------ Save as
  const DEPTH_NAME = { 1: '1-bit · 2 colours', 2: '2-bit · 4 colours', 3: '3-bit · 8 colours', 4: '4-bit · 16 colours', 5: '5-bit · 32 colours', 6: '6-bit · 64 colours', 7: '7-bit · 128 colours', 8: '8-bit · 256 colours', 16: '16-bit · 65,536 colours', 24: '24-bit · millions of colours', 32: '32-bit · millions, with see-through' };
  const NO_CLEAR = new Set(['jpg', 'pdf', 'pcx', 'bmp', 'ppm', 'pi1', 'pi2', 'pi3', 'neo', 'koa', 'scr', 'mac']);
  // formats (and depths) that cannot hold see-through: those parts are filled with a colour first
  const noClear = (fmt, bits) => (NO_CLEAR.has(fmt) && !(fmt === 'bmp' && bits === 32)) || (fmt === 'tga' && bits !== 32) || ((fmt === 'png' || fmt === 'tif') && bits === 24);
  const sv = { fmt: 'png', bits: 0, palette: 'adaptive', dither: 'fs', quality: 90, fit: 'cover', back: '#ffffff', name: '', aa: 0 };
  let saveTok = 0, saveBlob = null, savePrep = null;
  function openSave() {
    if (!now()) { toast('Open a picture first.'); return; }
    if (tool) closeTool();
    sv.name = baseName(pic().name); sv.bits = 0; $('savedlg').hidden = false; drawSaveOpts(); prepareSave();
  }
  function bitsFor(fmt) {
    const f = F.FORMATS[fmt], st = pic().steps[pic().at], n = st.colours ?? F.countColours(now(), 257), clear = F.hasClear(now());
    if (sv.bits && f.depths.includes(sv.bits)) return sv.bits;
    if (f.depths.length === 1) return f.depths[0];
    const fits = f.depths.filter((b) => b <= 8 && (1 << b) >= n && n > 0);
    if (fits.length) return fits[0];
    return clear && f.depths.includes(32) ? 32 : f.depths.includes(24) ? 24 : f.depths[f.depths.length - 1];
  }
  function drawSaveOpts() {
    const o = $('save-opts'), f = F.FORMATS[sv.fmt], bits = bitsFor(sv.fmt), groups = {};
    Object.entries(F.FORMATS).forEach(([k, x]) => (groups[x.group] = groups[x.group] || []).push([k, x]));
    const reducing = bits <= 8 || bits === 16 || f.fit;
    o.innerHTML = `<label class="field"><span>File name</span><input class="input" id="sv-name" value="${esc(sv.name)}"></label>
      <div class="field"><span>Format</span><div class="fmt-list" id="sv-fmts">${Object.entries(groups).map(([g, list]) => `<h4>${g}</h4>${list.map(([k, x]) => `<button type="button" data-f="${k}" aria-pressed="${k === sv.fmt}"><span>${esc(x.name)} <small>.${x.ext}</small></span><small>${esc(x.what)}</small></button>`).join('')}`).join('')}</div></div>
      ${f.depths.length > 1 ? `<label class="field"><span>Colour depth</span><select class="input" id="sv-bits">${f.depths.map((b) => `<option value="${b}" ${b === bits ? 'selected' : ''}>${DEPTH_NAME[b] || b + '-bit'}</option>`).join('')}</select></label>` : `<p class="hint">Colour depth: <b>${DEPTH_NAME[bits] || bits + '-bit'}</b></p>`}
      ${reducing && !f.cells && !(f.fit && f.palette) ? `<label class="field"><span>Colours</span><select class="input" id="sv-pal">${PALS.map(([k, l]) => `<option value="${k}" ${k === sv.palette ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>` : ''}
      ${reducing ? `<label class="field"><span>Dithering</span><select class="input" id="sv-dither">${C.DITHERS.map(([k, l]) => `<option value="${k}" ${k === sv.dither ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>` : ''}
      ${f.fit ? `<label class="field"><span>Fit to the ${f.fit[0]} × ${f.fit[1]} screen</span><select class="input" id="sv-fit"><option value="cover" ${sv.fit === 'cover' ? 'selected' : ''}>Fill the screen (edges cut off)</option><option value="contain" ${sv.fit === 'contain' ? 'selected' : ''}>Whole picture (black bars)</option><option value="stretch" ${sv.fit === 'stretch' ? 'selected' : ''}>Stretch</option></select></label>` : ''}
      ${f.quality ? `<label class="field"><span>Quality: <b id="sv-qv">${sv.quality}</b></span><input type="range" id="sv-q" min="10" max="100" value="${sv.quality}" data-rt-skip></label>` : ''}
      <label class="field"><span>Smooth jagged edges before saving</span><select class="input" id="sv-aa">${[[0, 'Off'], [35, 'Light'], [65, 'Medium'], [95, 'Strong']].map(([v, l]) => `<option value="${v}" ${+sv.aa === v ? 'selected' : ''}>${l}</option>`).join('')}</select><span class="hint" id="sv-edges"></span></label>
      ${noClear(sv.fmt, bits) && F.hasClear(now()) ? `<label class="field"><span>Behind see-through parts</span><input type="color" class="input" id="sv-back" value="${sv.back}"></label>` : ''}`;
    const on0 = o.querySelector(`[data-f="${sv.fmt}"]`); if (on0) on0.scrollIntoView({ block: 'nearest' });
    o.querySelector('#sv-fmts').onclick = (e) => { const b = e.target.closest('[data-f]'); if (!b) return; sv.fmt = b.dataset.f; sv.bits = 0; drawSaveOpts(); prepareSave(); };
    const on = (id, ev, fn) => { const el = o.querySelector(id); if (el) el.addEventListener(ev, fn); };
    on('#sv-name', 'input', (e) => { sv.name = e.target.value; });
    on('#sv-bits', 'change', (e) => { sv.bits = +e.target.value; drawSaveOpts(); prepareSave(); });
    on('#sv-pal', 'change', (e) => { sv.palette = e.target.value; prepareSave(); });
    on('#sv-dither', 'change', (e) => { sv.dither = e.target.value; prepareSave(); });
    on('#sv-fit', 'change', (e) => { sv.fit = e.target.value; prepareSave(); });
    on('#sv-q', 'input', (e) => { sv.quality = +e.target.value; o.querySelector('#sv-qv').textContent = sv.quality; prepareSave(); });
    on('#sv-back', 'input', (e) => { sv.back = e.target.value; prepareSave(); });
    on('#sv-aa', 'change', (e) => { sv.aa = +e.target.value; prepareSave(); });
  }
  // the picture as it will be in the file: fitted to an old screen, colours reduced, see-through filled
  function prepared(img, fmt, o) {
    const f = F.FORMATS[fmt], bits = o.bits;
    if (o.aa) img = X.antialias(img, { amount: o.aa });
    if (noClear(fmt, bits) && F.hasClear(img)) img = X.flatten(img, { fill: o.back || '#ffffff' });
    if (f.fit) {
      const [SW, SH] = f.fit, a = f.aspect || 1, c = document.createElement('canvas'); c.width = SW; c.height = SH; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.fillStyle = '#000'; x.fillRect(0, 0, SW, SH);
      const w0 = img.width, h0 = img.height / a; // tall pixels: the picture takes fewer rows
      if (o.fit === 'stretch') x.drawImage(X.canvasOf(img), 0, 0, SW, SH);
      else { const k = o.fit === 'contain' ? Math.min(SW / w0, SH / h0) : Math.max(SW / w0, SH / h0); x.drawImage(X.canvasOf(img), (SW - w0 * k) / 2, (SH - h0 * k) / 2, w0 * k, h0 * k); }
      img = x.getImageData(0, 0, SW, SH);
      const dither = o.dither, mode = fmt === 'pi3' || fmt === 'mac' ? { palette: 'bw', dither: dither === 'fs' ? 'atkinson' : dither } : f.cells ? { cells: f.cells, dither } : { colours: 1 << bits, levels: f.levels, palette: o.palette, dither };
      return C.reduce(img, mode);
    }
    // black and white or grey files: the picture made so first
    if (bits === 1 && (fmt === 'pcx' || fmt === 'ppm')) return C.reduce(img, { palette: 'bw', dither: o.dither });
    if (bits === 8 && fmt === 'ppm') return C.reduce(img, { grey: true, colours: 256, dither: 'none' });
    if (bits <= 8 && F.countColours(img, 1 << bits) > 1 << bits) return C.reduce(img, { colours: 1 << bits, palette: o.palette, dither: o.dither });
    if (bits <= 8 && o.palette !== 'adaptive') return C.reduce(img, { colours: 1 << bits, palette: o.palette, dither: o.dither });
    if (bits === 16 && (fmt === 'bmp' || fmt === 'tga')) return C.reduce(img, { depth: fmt === 'tga' ? 'high15' : 'high16', dither: o.dither });
    return img;
  }
  function prepareSave() {
    const my = ++saveTok; saveBlob = null; $('save-size').textContent = 'Working it out…'; $('save-go').disabled = true;
    setTimeout(async () => {
      if (my !== saveTok) return;
      try {
        const bits = bitsFor(sv.fmt), o = { ...sv, bits, quality: sv.quality / 100 }, img = prepared(now(), sv.fmt, o);
        const blob = await F.write(img, sv.fmt, o); if (my !== saveTok) return;
        saveBlob = blob; savePrep = img;
        const pv = $('save-prev'); pv.innerHTML = ''; pv.className = 'save-prev' + (img.width < 700 ? ' pixels' : '');
        const c = X.canvasOf(img); if (img.width < 400) { c.style.width = img.width * Math.min(3, Math.floor(600 / img.width)) + 'px'; } pv.append(c);
        $('save-facts').textContent = `${img.width} × ${img.height} pixels · ${F.countColours(img, 65536) > 65536 ? 'more than 65,536' : fmtN(F.countColours(img, 65536))} colours`;
        $('save-size').textContent = `About ${kb(blob.size)}`; $('save-go').disabled = false;
        // the edge check of what will be saved (small pixel art is meant to be stepped: no advice there)
        const ed = $('sv-edges'); if (ed) { if (img.width * img.height > 4e6) ed.textContent = ''; else { const a = X.aliasCheck(img); ed.textContent = a.slanted < 50 ? 'Edge check: few slanted edges.' : `Edge check: ${Math.round(a.ratio * 100)}% of slanted edges are jagged steps${a.ratio > 0.15 && sv.aa === 0 && img.width * img.height > 90000 ? ' — try Light or Medium.' : '.'}`; } }
      } catch (e) { ICLOG.warn(`Save as ${sv.fmt} could not be prepared`, e); if (my === saveTok) { $('save-size').textContent = e.message; } }
    }, 60);
  }
  $('save-cancel').onclick = () => { $('savedlg').hidden = true; };
  $('savedlg').addEventListener('keydown', (e) => { if (e.key === 'Escape') $('savedlg').hidden = true; });
  $('save-go').onclick = () => {
    if (!saveBlob) return; const f = F.FORMATS[sv.fmt], e = f.extFor ? f.extFor({ bits: bitsFor(sv.fmt) }) : f.ext;
    ICLOG.info(`Saved ${sv.name}.${e} (${F.FORMATS[sv.fmt].name}, ${kb(saveBlob.size)}${savePrep ? ', ' + savePrep.width + ' × ' + savePrep.height : ''})`);
    download(saveBlob, `${(sv.name || 'picture').replace(/[\\/:*?"<>|]+/g, '-')}.${e}`); pic().dirty = false; renderPics(); renderProps(); $('savedlg').hidden = true;
    toast(`Saved as ${f.name}.`);
  };

  // ------------------------------------------------------------------ Batch convert
  function openBatch() {
    if (!pics.length) { toast('Open some pictures first (you can pick several at once).'); return; }
    const body = document.createElement('div'); body.className = 'dialog-body';
    const fmts = Object.entries(F.FORMATS).filter(([, f]) => !f.fit);
    body.innerHTML = `<p class="hint">Each open picture is saved, as it is now (with its changes), into one ZIP file.</p>
      <div class="field"><span>Pictures</span>${pics.map((p, i) => `<label class="check"><input type="checkbox" data-i="${i}" checked> ${esc(p.name)} <span class="hint">${p.steps[p.at].img.width} × ${p.steps[p.at].img.height}</span></label>`).join('')}</div>
      <div class="row"><label class="field"><span>Format</span><select class="input" id="b-fmt">${fmts.map(([k, f]) => `<option value="${k}">${esc(f.name)}</option>`).join('')}</select></label>
      <label class="field"><span>Colour depth</span><select class="input" id="b-bits"></select></label></div>
      <div class="row"><label class="field"><span>Make the longest side at most</span><select class="input" id="b-size"><option value="0">Keep the size</option>${[3840, 2048, 1920, 1600, 1280, 1024, 800, 640, 512, 320, 256].map((n) => `<option value="${n}">${n} pixels</option>`).join('')}</select></label>
      <label class="field"><span>Dithering (when colours are reduced)</span><select class="input" id="b-dither">${C.DITHERS.map(([k, l]) => `<option value="${k}" ${k === 'fs' ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label></div>
      <label class="field"><span>Quality (JPEG, WebP, PDF): <b id="b-qv">90</b></span><input type="range" id="b-q" min="10" max="100" value="90" data-rt-skip></label>
      <div class="prog" id="b-prog" hidden><i></i></div><p class="hint" id="b-note"></p>`;
    const fillBits = () => { const f = F.FORMATS[body.querySelector('#b-fmt').value]; body.querySelector('#b-bits').innerHTML = `<option value="0">As each picture needs</option>` + f.depths.map((b) => `<option value="${b}">${DEPTH_NAME[b] || b + '-bit'}</option>`).join(''); };
    fillBits(); body.querySelector('#b-fmt').onchange = fillBits; body.querySelector('#b-q').oninput = (e) => { body.querySelector('#b-qv').textContent = e.target.value; };
    dialog('Batch convert', body, [{ label: 'Cancel' }, { label: 'Convert and save ZIP', primary: true, run: async (close, btn) => {
      btn.disabled = true; const fmt = body.querySelector('#b-fmt').value, f = F.FORMATS[fmt], want = +body.querySelector('#b-bits').value, max = +body.querySelector('#b-size').value, dither = body.querySelector('#b-dither').value, q = +body.querySelector('#b-q').value / 100;
      const chosen = [...body.querySelectorAll('[data-i]')].filter((x) => x.checked).map((x) => pics[+x.dataset.i]), files = [], names = new Set(), bar = body.querySelector('#b-prog'); bar.hidden = false;
      for (let n = 0; n < chosen.length; n++) {
        const p = chosen[n]; body.querySelector('#b-note').textContent = `${n + 1} of ${chosen.length}: ${p.name}`; bar.firstChild.style.width = `${(n / chosen.length) * 100}%`; await wait(10);
        try {
          let img = p.steps[p.at].img;
          if (max && Math.max(img.width, img.height) > max) { const k = max / Math.max(img.width, img.height); img = X.resize(img, { width: img.width * k, height: img.height * k }); }
          const cols = F.countColours(img, 257), clear = F.hasClear(img);
          let bits = want || (f.depths.length === 1 ? f.depths[0] : (f.depths.find((b) => b <= 8 && (1 << b) >= cols) || (clear && f.depths.includes(32) ? 32 : f.depths.includes(24) ? 24 : f.depths[f.depths.length - 1])));
          const o = { bits, quality: q, palette: 'adaptive', dither, back: '#ffffff' }; img = prepared(img, fmt, o);
          const blob = await F.write(img, fmt, o); let nm = `${baseName(p.name)}.${f.extFor ? f.extFor(o) : f.ext}`, k = 2; while (names.has(nm)) nm = `${baseName(p.name)} (${k++}).${f.ext}`; names.add(nm);
          files.push({ name: nm, bytes: new Uint8Array(await blob.arrayBuffer()) });
        } catch (e) { toast(`${p.name}: ${e.message}`); }
      }
      bar.firstChild.style.width = '100%';
      if (files.length) download(F.zip(files), `ImageCraft ${f.ext.toUpperCase()} pictures.zip`);
      toast(`${files.length} picture${files.length === 1 ? '' : 's'} converted.`); close();
    } }]);
  }

  // ------------------------------------------------------------------ sample pictures (made here, so they are ours)
  function sample(kind) {
    if (kind === 'sunset') {
      const W = 720, H = 480, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
      const sky = x.createLinearGradient(0, 0, 0, H * 0.7); sky.addColorStop(0, '#1d2b64'); sky.addColorStop(0.5, '#c0587e'); sky.addColorStop(1, '#fcb36b'); x.fillStyle = sky; x.fillRect(0, 0, W, H);
      const sun = x.createRadialGradient(W * 0.62, H * 0.6, 0, W * 0.62, H * 0.6, 160); sun.addColorStop(0, '#fff6d5'); sun.addColorStop(0.25, '#ffd27a'); sun.addColorStop(1, 'rgba(255,170,90,0)'); x.fillStyle = sun; x.fillRect(0, 0, W, H);
      [['#4b2b55', 0.62, 50], ['#2f1d3d', 0.72, 38], ['#1a1226', 0.84, 26]].forEach(([col, base, amp], j) => { x.fillStyle = col; x.beginPath(); x.moveTo(0, H); for (let i = 0; i <= W; i += 8) x.lineTo(i, H * base - Math.sin(i / (90 + j * 40) + j) * amp - Math.sin(i / 23 + j * 3) * amp * 0.15); x.lineTo(W, H); x.fill(); });
      const id = x.getImageData(0, 0, W, H), d = id.data; for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 34; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
      addPic('Sample sunset (noisy photo).png', id, { format: 'Sample', bits: 24 });
    } else if (kind === 'sprite') {
      const art = ['....kkkkkk....', '...kyyyyyyk...', '..kyyyyyyyyk..', '.kyykkyykkyyk.', '.kyykwyykwyyk.', '.kyyyyyyyyyyk.', '.kyyrryyrryyk.', '.kyyyrrrryyyk.', '..kyyyyyyyyk..', '...kkkkkkkk...', '..kbbkbbkbbk..', '.kbbbkbbkbbbk.', '.kkk......kkk.'];
      const P = { k: [30, 26, 40], y: [255, 205, 60], w: [255, 255, 255], r: [220, 70, 70], b: [70, 120, 220] }, W = art[0].length, H = art.length, id = new ImageData(W, H);
      art.forEach((row, y) => [...row].forEach((ch, xx) => { const i = (y * W + xx) * 4, c = P[ch]; if (c) { id.data[i] = c[0]; id.data[i + 1] = c[1]; id.data[i + 2] = c[2]; id.data[i + 3] = 255; } }));
      addPic('Sample sprite (pixel art).png', id, { format: 'Sample', bits: 8 });
    } else {
      sample('sunset'); const p = pic(), dith = C.look(p.steps[0].img, 'st', { keep: false, dither: 'bayer4' }); p.steps[0].img = dith; p.name = 'Sample screen (16 colours, dithered).png'; p.info = { format: 'Sample', bits: 4 }; select(cur, true);
    }
  }
  $('samples').innerHTML = '<span class="hint" style="align-self:center">Or try:</span><button class="btn outline" data-s="sunset">A noisy photo</button><button class="btn outline" data-s="sprite">Pixel art</button><button class="btn outline" data-s="screen">An old 16-colour screen</button>';
  $('samples').onclick = (e) => { const k = e.target.dataset.s; if (k) sample(k); };
  $('welcome-logo').innerHTML = LOGO;

  // ------------------------------------------------------------------ help
  const helpHtml = `<p>ImageCraft converts pictures between formats old and new, changes their colour depth, cleans up and modernises classic pictures, and turns pictures into SVG outlines or text art. Everything runs in this browser: nothing is uploaded.</p>
    <h3>Open</h3><p>Home › Open (Ctrl+O), drop files on the middle, or paste (Ctrl+V). Several pictures can be open at once (left panel); Convert › Batch convert saves them all at once.</p>
    <h3>Change</h3><p>Pick a tool on the ribbon. Its settings appear on the right with a live preview; tick <b>Compare</b> and drag the line to see before and after. <b>Apply</b> makes it a step. Every step is in History (left panel) and can be undone (Ctrl+Z).</p>
    <h3>Colour depth</h3><p>Colours › Colour depth reduces a picture to 2, 4, 16 or 256 colours (1, 2, 4 or 8 bits), or high colour (15 and 16 bits), with dithering to mix colours. Colours can come from a classic palette (EGA, C64, Game Boy…) or from an old computer's range (the Atari ST's 512, the Amiga's 4,096). <b>Old computer looks</b> does the whole thing at once, with the real screen size and each machine's rules (the ZX Spectrum's two colours in each square).</p>
    <h3>Clean up and modernise</h3><p>Smooth out noise, Dust and scratches, Remove JPEG blocks, Undither, and <b>Make bigger</b>: smooth, pixel-art (Scale2x) or AI upscaling. <b>Modernise</b> does the right steps for pixel art, a dithered screen, an old photo or a blocky JPEG. <b>Remove background</b> works by colour from the edges (click leftovers to take them too) or with an AI cut-out for photos.</p>
    <h3>AI helpers</h3><p>The AI tools (cut-out and upscaling) are small models that run in this browser, on the graphics card if there is one. Each downloads once and then works offline. Convert › AI helpers shows what this computer can do.</p>
    <h3>Save</h3><p>Home › Save as (Ctrl+S): pick the format and colour depth and see exactly what the file will look like and how big it is. Classic formats (Degas, NEOchrome, Koala, ZX Spectrum, MacPaint) fit the picture to that machine's screen and colours for you.</p>
    <h3>Text art and SVG</h3><p>Convert › Text art turns a picture into ASCII characters, shaded blocks or half blocks, plain or with ANSI colour; save it as text, a classic .ANS file, ANSI for terminals or a web page. Convert › To SVG makes smooth outlines, or exact squares for pixel art.</p>
    <h3>Keys</h3><p>Ctrl+O open · Ctrl+S save as · Ctrl+Z / Ctrl+Y undo and redo · Ctrl+C copy the picture · + and − zoom · 0 fit · 1 100% · Enter apply · Esc cancel · drag (or middle-drag) to move around · wheel to zoom.</p>`;
  const help = () => info('How to use ImageCraft', helpHtml);

  // ------------------------------------------------------------------ theme
  const THEME_KEY = 'imagecraft-theme';
  function setTheme(t) { if (t === 'system') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t; try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* ignore */ } }
  try { const t = localStorage.getItem(THEME_KEY); if (t) setTheme(t); } catch (e) { /* ignore */ }
  const themeIsDark = () => (document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);
  const THEME_BTN = document.createElement('button'); THEME_BTN.className = 'btn theme-btn'; THEME_BTN.type = 'button';
  const paintTheme = () => {
    const dark = themeIsDark(); THEME_BTN.title = dark ? 'Switch to light' : 'Switch to dark'; THEME_BTN.setAttribute('aria-label', THEME_BTN.title);
    THEME_BTN.innerHTML = dark ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.7 4.7l1.6 1.6M17.7 17.7l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.7 19.3l1.6-1.6M17.7 6.3l1.6-1.6"/></svg>' : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11z"/></svg>';
  };
  THEME_BTN.onclick = () => { setTheme(themeIsDark() ? 'light' : 'dark'); paintTheme(); };
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', paintTheme); paintTheme();

  // ------------------------------------------------------------------ ribbon, menus, title bar
  const T = (id) => () => openTool(id), has = () => !pic();
  const B = (label, icon, run, o = {}) => ({ label, icon, run, disabled: o.always ? undefined : has, ...o });
  const setBg = (b) => { view.bg = b; layout(); };
  const toggleCompare = () => { view.compare = !view.compare; show(); if (tool) renderProps(); };
  const toggleL = document.createElement('button'); toggleL.className = 'crb-small ic-toggle'; toggleL.textContent = 'Pictures'; toggleL.onclick = () => document.querySelector('.work').classList.toggle('show-left');
  const toggleR = document.createElement('button'); toggleR.className = 'crb-small ic-toggle'; toggleR.textContent = 'Settings'; toggleR.onclick = () => document.querySelector('.work').classList.toggle('show-right');
  const st = document.createElement('style'); st.textContent = '.crb .crb-small.ic-toggle { display: none; } @media (max-width: 980px) { .crb .crb-small.ic-toggle { display: inline-flex; } }'; document.head.append(st);
  const ribbon = window.CraftRibbon({
    mount: $('app'), storageKey: 'imagecraft', extraEls: [toggleL, toggleR],
    tabs: [
      { id: 'home', label: 'Home', hue: '#5b4bdb', groups: [
        ['File', [B('Open', I.folder, pickFiles, { big: true, always: true, key: 'Ctrl+O', title: 'Open pictures (several at once if you like)' }), B('Save as', I.save, openSave, { big: true, key: 'Ctrl+S', title: 'Save in any format and colour depth' }), { col: [B('Copy picture', I.copy, copyPicture), B('Close picture', I.close, () => closePic(cur))] }]],
        ['Edit', [{ col: [B('Undo', I.undo, undo, { key: 'Ctrl+Z', disabled: () => !canUndo() && !tool }), B('Redo', I.redo, redo, { key: 'Ctrl+Y', disabled: () => !canRedo() }), B('Back to the original', IK.revert, () => { if (pic().at) goStep(0); })] }]],
        ['Quick', [B('Auto fix', IK.auto, () => quick('Auto fix', (i) => X.autoFix(i)), { big: true, title: 'Levels, a little colour and sharpening, in one click' }), B('Modernise', IK.modern, T('modern'), { big: true, title: 'Clean up and enlarge pixel art, old screens, old photos or blocky JPEGs' }), B('Compare', IK.compare, toggleCompare, { big: true, pressed: () => view.compare, title: 'Before and after, side by side (drag the line)' })]],
        ['Help', [B('How to use', I.help, help, { big: true, always: true })]],
      ] },
      { id: 'image', label: 'Image', hue: '#2f7fdd', groups: [
        ['Size', [B('Resize', IK.resize, T('resize'), { big: true }), B('Crop', IK.crop, T('crop'), { big: true }), { col: [B('Smooth jagged edges', IK.straighten, T('aa')), B('Canvas size', IK.canvas, T('canvas')), B('Trim borders', IK.crop, () => quick('Trim borders', (i) => { const t = X.trimBox(i); if (!t) throw new Error('No plain border to trim.'); return X.crop(i, t); }))] }]],
        ['Turn', [{ col: [B('Turn left', I.rotL, () => quick('Turn left', (i) => X.rotate90(i, 270))), B('Turn right', I.rotR, () => quick('Turn right', (i) => X.rotate90(i, 90))), B('Turn upside down', I.rot180, () => quick('Turn upside down', (i) => X.rotate90(i, 180)))] },
          { col: [B('Flip across', IK.flipH, () => quick('Flip across', (i) => X.flip(i, true))), B('Flip up and down', IK.flipV, () => quick('Flip up and down', (i) => X.flip(i, false))), B('Straighten', IK.straighten, T('straighten'))] }]],
      ] },
      { id: 'adjust', label: 'Adjust', hue: '#e07a1f', groups: [
        ['Light', [B('Brightness', IK.light, T('light'), { big: true, title: 'Brightness, contrast, midtones, shadows and highlights' }), B('Recover shadows', IK.light, T('shadows'), { big: true, title: 'Lift dark areas with their detail, sky untouched' }), B('Dehaze', IK.light, T('dehaze'), { big: true, title: 'Take away a foggy or faded grey veil' }), { col: [B('Auto levels', IK.auto, () => quick('Auto levels', (i) => X.autoLevels(i))), B('Auto fix', IK.auto, () => quick('Auto fix', (i) => X.autoFix(i)))] }]],
        ['Colour', [B('Auto colour', IK.auto, T('autocolour'), { big: true, title: 'Correct a faded print: levels, neutral midtones and faded colour' }), B('Colour', IK.colour, T('colour'), { big: true, title: 'Saturation, vibrance, hue, warmth and tint' }), { col: [B('Fix a colour cast', IK.balance, T('balance')), B('Greyscale', IK.grey, () => quick('Greyscale', (i) => X.greyscale(i))), B('Sepia', IK.sepia, T('sepia'))] }, { col: [B('Invert', IK.invert, () => quick('Invert', (i) => X.invert(i))), B('Threshold', IK.threshold, T('threshold')), B('Posterize', IK.posterize, T('posterize'))] }]],
        ['Detail', [B('Clarity', IK.sharpen, T('clarity'), { big: true, title: 'Local contrast: texture and detail' }), { col: [B('Sharpen', IK.sharpen, T('sharpen')), B('Blur', IK.blur, T('blur')), B('Pixelate', IK.pixelate, T('pixelate'))] }]],
      ] },
      { id: 'detail', label: 'Detail', hue: '#c2410c', groups: [
        ['Curves', [B('Curves', IK.light, T('curves'), { big: true, title: 'Curves for brightness or each colour, with Where for curves layers' }), B('Blend a version', IK.compare, T('blendstep'), { big: true, title: 'Mix an earlier step back in (like layers), anywhere or through a map' })]],
        ['Detail', [B('Detail equaliser', IK.sharpen, T('equalizer'), { big: true, title: 'Fine, small, medium and large detail, each with its own amount' }), B('Even the light', IK.light, T('gradient'), { big: true, title: 'Gradient domain: big brightness jumps smaller, faint detail bigger' }), B('Crisp edges', IK.sharpen, T('crisp'), { big: true, title: 'Shock filter: soft edges made crisp without halos' }), B('Edge-keeping smooth', IK.denoise, T('diffuse'), { big: true, title: 'Perona–Malik diffusion: smooth, but never across an edge' })]],
        ['Faces', [B('Face refine', IK.cutout, T('facerefine'), { big: true, title: 'Find each face’s skin, eyes, irises, lips and teeth and treat each on its own (nothing redrawn)' })]],
        ['Maps', [B('Maps and channels', IK.grid, () => { showSide('left'); showTab('maps'); }, { big: true, title: 'See the picture measured into maps and channels' })]],
      ] },
      { id: 'colours', label: 'Colours', hue: '#b44be1', groups: [
        ['Depth', [B('Colour depth', IK.depth, T('depth'), { big: true, title: '1, 2, 4 or 8-bit colour, high colour, palettes and dithering' }), B('Computer looks', IK.retro, T('looks'), { big: true, title: 'Atari ST, Amiga, C64, ZX Spectrum, CGA, EGA, VGA, Macintosh, Game Boy…' })]],
        ['See-through', [{ col: [B('Make a colour see-through', IK.clearC, T('clear')), B('Fill see-through parts', IK.canvas, T('flatten')), B('Remove background', IK.cutout, T('cutout'))] }]],
      ] },
      { id: 'clean', label: 'Clean up', hue: '#1e9e8a', groups: [
        ['Old photo', [B('Restore old photo', IK.modern, () => openTool('modern', { kind: 'photo', bigger: 1 }), { big: true, title: 'Dust, noise, blur, colour cast and fading fixed in one go, measured from the picture' }), B('Ask AI what it needs', IK.modern, T('assess'), { big: true, title: 'A vision model in Ollama on this computer looks at the picture, says what it is and what is wrong, and ticks the tools to fix it' })]],
        ['Restore', [B('Remove noise', IK.denoise, T('nlm'), { big: true, title: 'Smart noise removal (non-local means): grain and colour blotches' }), B('Deblur', IK.sharpen, T('deblur'), { big: true, title: 'Undo soft focus, out of focus or camera shake (Wiener deconvolution)' }), B('Faded detail', IK.light, T('clahe'), { big: true, title: 'Adaptive contrast for faded photos (CLAHE)' }), { col: [B('Where the noise is', IK.grid, T('noisemap'))] }]],
        ['Clean', [B('Smooth out noise', IK.denoise, T('denoise'), { big: true }), B('Dust and scratches', IK.dust, T('despeckle'), { big: true }), B('JPEG blocks', IK.jpeg, T('deblock'), { big: true, title: 'Remove JPEG blocks and smudges' }), B('Undither', IK.undither, T('undither'), { big: true, title: 'Blend dithering dots back into smooth colour' })]],
        ['Background', [B('Remove background', IK.cutout, T('cutout'), { big: true })]],
        ['Bigger', [B('Make bigger', IK.upscale, T('upscale'), { big: true, title: 'Smooth, pixel-art or AI upscaling' }), B('Combine photos', IK.upscale, T('stack'), { big: true, title: 'Merge several shots of the same scene: less noise, and more detail than any one shot' }), B('Modernise', IK.modern, T('modern'), { big: true }), B('Remaster shapes', IK.svg, T('remaster'), { big: true, title: 'Recognise the shapes, draw them again crisply at the new size, and blend with the original' })]],
      ] },
      { id: 'convert', label: 'Convert', hue: '#138a9e', groups: [
        ['Save', [B('Save as', I.save, openSave, { big: true, key: 'Ctrl+S' }), B('Batch convert', IK.batch, openBatch, { big: true, title: 'Convert every open picture at once, into a ZIP' })]],
        ['Turn into', [B('SVG outlines', IK.svg, T('trace'), { big: true, title: 'Smooth vector outlines, or exact squares for pixel art' }), B('Text art', IK.ascii, T('text'), { big: true, title: 'ASCII and ANSI art' })]],
        ['AI', [B('AI helpers', IK.ai, () => CRAFTAI.openSettings(), { big: true, always: true, title: 'What this computer can do; download the models for offline use' })]],
      ] },
      { id: 'view', label: 'View', hue: '#566078', groups: [
        ['Zoom', [B('Fit', I.fit, fitView, { big: true, key: '0' }), B('100%', I.actual, actual, { big: true, key: '1' }), { col: [B('Zoom in', I.zoomIn, () => zoomBy(1.25), { key: '+' }), B('Zoom out', I.zoomOut, () => zoomBy(0.8), { key: '−' })] }]],
        ['Show', [B('Compare', IK.compare, toggleCompare, { big: true, pressed: () => view.compare }), B('Pixel grid', IK.grid, () => { view.grid = !view.grid; layout(); if (view.grid && view.zoom < 6) toast('The grid shows from 600% zoom.'); }, { big: true, pressed: () => view.grid })]],
        ['Debug', [B('Debug log', I.console, () => openDebug(), { big: true, always: true, title: 'Errors and what happened (also the Debug tab on the left)' })]],
        ['Behind see-through', [{ col: [B('Checks', IK.grid, () => setBg('check'), { pressed: () => view.bg === 'check' }), B('White', I.sun, () => setBg('white'), { pressed: () => view.bg === 'white' }), B('Black', I.moon, () => setBg('black'), { pressed: () => view.bg === 'black' })] }]],
      ] },
    ],
  });
  const MENUS = [
    ['File', [{ label: 'Open…', key: 'Ctrl+O', run: pickFiles }, { label: 'Save as…', key: 'Ctrl+S', run: openSave, disabled: has }, { label: 'Batch convert…', run: openBatch, disabled: () => !pics.length }, '-', { label: 'Copy picture', run: copyPicture, disabled: has }, { label: 'Close picture', run: () => closePic(cur), disabled: has }]],
    ['Edit', [{ label: 'Undo', key: 'Ctrl+Z', run: undo, disabled: () => !canUndo() }, { label: 'Redo', key: 'Ctrl+Y', run: redo, disabled: () => !canRedo() }, { label: 'Back to the original', run: () => goStep(0), disabled: () => !pic() || !pic().at }]],
    ['Image', [['Resize…', 'resize'], ['Crop…', 'crop'], ['Canvas size…', 'canvas'], ['Straighten…', 'straighten']].map(([l, k]) => ({ label: l, run: T(k), disabled: has })).concat([{ label: 'Turn left', run: () => quick('Turn left', (i) => X.rotate90(i, 270)), disabled: has }, { label: 'Turn right', run: () => quick('Turn right', (i) => X.rotate90(i, 90)), disabled: has }, { label: 'Flip across', run: () => quick('Flip across', (i) => X.flip(i, true)), disabled: has }])],
    ['Adjust', [{ label: 'Auto fix', run: () => quick('Auto fix', (i) => X.autoFix(i)), disabled: has }, ...[['Brightness and contrast…', 'light'], ['Colour…', 'colour'], ['Fix a colour cast…', 'balance'], ['Sharpen…', 'sharpen'], ['Blur…', 'blur'], ['Threshold…', 'threshold'], ['Posterize…', 'posterize']].map(([l, k]) => ({ label: l, run: T(k), disabled: has }))]],
    ['Colours', [['Colour depth…', 'depth'], ['Old computer looks…', 'looks'], ['Make a colour see-through…', 'clear'], ['Remove background…', 'cutout']].map(([l, k]) => ({ label: l, run: T(k), disabled: has }))],
    ['Clean up', [['Remove noise (smart)…', 'nlm'], ['Restore sharpness (deblur)…', 'deblur'], ['Bring back faded detail…', 'clahe'], ['Smooth out noise…', 'denoise'], ['Dust and scratches…', 'despeckle'], ['Remove JPEG blocks…', 'deblock'], ['Undither…', 'undither'], ['Make bigger…', 'upscale'], ['Modernise…', 'modern']].map(([l, k]) => ({ label: l, run: T(k), disabled: has }))],
    ['Convert', [{ label: 'SVG outlines…', run: T('trace'), disabled: has }, { label: 'Text art (ASCII / ANSI)…', run: T('text'), disabled: has }, { label: 'AI helpers…', run: () => CRAFTAI.openSettings() }]],
    ['Help', [{ label: 'How to use ImageCraft', run: help }, { label: 'Debug log', run: () => openDebug() }]],
  ];
  const tb = window.CraftTitlebar({
    appName: 'ImageCraft', storageKey: 'imagecraft', colors: ['#6a5cff', '#4a3cc8'], mount: $('app'), toast, logo: LOGO, menus: () => MENUS, ribbon,
    quick: [
      { icon: 'open', title: 'Open', key: 'Ctrl+O', run: pickFiles },
      { icon: 'save', title: 'Save as', key: 'Ctrl+S', run: openSave, disabled: has },
      { icon: 'undo', title: 'Undo', key: 'Ctrl+Z', run: undo, disabled: () => !canUndo() && !tool },
      { icon: 'redo', title: 'Redo', key: 'Ctrl+Y', run: redo, disabled: () => !canRedo() },
    ],
    getTitle: () => (pic() ? pic().name : 'ImageCraft'),
    getStatus: () => (pic() ? (pic().dirty ? { text: 'Changed, not saved yet', dirty: true } : { text: 'Not changed' }) : { text: '' }),
    getInfo: () => (pic() ? [{ text: pic().info.format || 'Picture', title: 'The format it was opened from' }, { text: `${now().width} × ${now().height}`, title: 'Size in pixels' }] : []),
    rightEls: [THEME_BTN], onHelp: help,
  });
  window.__tb = tb;
  const app = $('app'); app.prepend(ribbon.el); app.prepend(tb.el);
  const ic = document.createElement('link'); ic.rel = 'icon'; ic.href = 'data:image/svg+xml,' + encodeURIComponent(LOGO.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')); document.head.append(ic);

  // ------------------------------------------------------------------ keyboard
  document.addEventListener('keydown', (e) => {
    if (!$('info').hidden || !$('ask').hidden || !$('savedlg').hidden || document.querySelector('body > .backdrop:not([hidden]):not(#info):not(#ask):not(#savedlg)')) return;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && e.target.type !== 'range' && e.target.type !== 'checkbox';
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod && k === 'o') { e.preventDefault(); pickFiles(); return; }
    if (mod && k === 's') { e.preventDefault(); openSave(); return; }
    if (typing) { if (e.key === 'Enter' && tool) { e.target.blur(); } return; }
    if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && k === 'y') { e.preventDefault(); redo(); return; }
    if (mod && k === 'c' && !window.getSelection().toString()) { e.preventDefault(); copyPicture(); return; }
    if (mod) return;
    if (e.key === 'Enter' && tool) { e.preventDefault(); applyTool(); return; }
    if (e.key === 'Escape' && tool) { e.preventDefault(); closeTool(); return; }
    if (k === '+' || k === '=') zoomBy(1.25);
    else if (k === '-' || k === '_') zoomBy(0.8);
    else if (k === '0') fitView();
    else if (k === '1') actual();
  });
  window.addEventListener('beforeunload', (e) => { if (pics.some((p) => p.dirty)) { e.preventDefault(); e.returnValue = ''; } });

  renderProps(); status();
  // for testing and the command layer: the same things the buttons do
  window.ImageCraft = { snapShapes, openFiles, addPic, openTool, applyTool, closeTool, quick, openSave, openBatch, undo, redo, sample, pics: () => pics, current: () => pic(), tool: () => tool, view, prepared, TOOLS };
})();

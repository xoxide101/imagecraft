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
  // a tool saying what it needs ("No faces found", "Paint over the shadow first") is a note; a fault in the program
  // (TypeError and the like) is an error, counted in the red badge
  const logFail = (what, e) => (e && /^(TypeError|ReferenceError|RangeError|SyntaxError|InternalError)$/.test(e.name) ? ICLOG.error(what, e) : ICLOG.warn(what, e));
  const fmtTime = (sec) => (sec < 90 ? `${Math.max(1, Math.round(sec))} s` : sec < 5400 ? `${Math.round(sec / 60)} min` : `${(sec / 3600).toFixed(1)} hours`);
  const etaSay = (say) => { const t0 = performance.now(); return (m) => { const r = /(\d+) of (\d+)/.exec(m || ''); if (r && +r[1] > 0 && +r[2] > +r[1]) { const el = (performance.now() - t0) / 1000, left = (el / +r[1]) * (+r[2] - +r[1]); if (el > 1.5 && left > 2) m += ` · about ${fmtTime(left)} left`; } if (say) say(m); }; };
  // how fast this computer ran each AI model last time (ms for a 160-pixel square), for estimates before starting
  const SPEED_KEY = 'imagecraft-speed'; let speed = {}; try { speed = JSON.parse(localStorage.getItem(SPEED_KEY) || '{}'); } catch (e) { /* blocked storage */ }
  const noteSpeed = (k, ms) => { speed[k] = Math.round(ms); try { localStorage.setItem(SPEED_KEY, JSON.stringify(speed)); } catch (e) { /* blocked storage */ } };
  const baseName = (n) => (n || 'picture').replace(/\.[a-z0-9]+$/i, '');
  const MAX_STEPS = 24;
  function addPic(name, img, info, size, deep) {
    pics.push({ name, info: info || {}, size: size || 0, steps: [{ label: `Opened (${info && info.format ? info.format : 'picture'})`, img, deep: deep || undefined }], at: 0, dirty: false });
    select(pics.length - 1, true);
  }
  function select(i, fresh) {
    if (tool) closeTool(true); if (mapView) { mapView = null; $('mapbar').hidden = true; }
    cur = i; view.fit = true; renderPics(); renderHist(); renderProps(); show(); fitView(); status();
    $('welcome').hidden = !!pic(); $('stage').hidden = !pic();
    if (fresh) colourCount();
    renderInfo(); renderMaps(); // the Maps tab, if it is showing, follows the picture
  }
  // ------------------------------------------------------------------ local activity: what ran on this computer
  const localLog = [];
  const actThumb = (img) => { try { const k = Math.min(1, 200 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k)); const s = document.createElement('canvas'); s.width = img.width; s.height = img.height; s.getContext('2d').putImageData(img, 0, 0); c.getContext('2d').drawImage(s, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.8); } catch (e) { return ''; } };
  function noteStep(label, before, after, ms) { localLog.unshift({ kind: 'step', at: Date.now(), label, secs: ms && ms < 1e8 ? ms / 1000 : null, size: `${after.width} × ${after.height}`, before: before ? actThumb(before) : '', after: actThumb(after), state: 'done' }); if (localLog.length > 60) localLog.pop(); localChanged(); }
  function localChanged() {
    const el = $('st-local'); if (el) { const run = localLog.filter((e) => e.state === 'running').length; el.querySelector('b').textContent = localLog.length || ''; el.classList.toggle('sending', !!run); el.title = run ? `Running on this computer now: ${localLog.find((e) => e.state === 'running').model}… click to watch` : `Local activity: ${localLog.length} this session`; }
    if ($('locallog') && !$('locallog').hidden) drawLocalLog();
  }
  function openLocalLog() { let back = $('locallog'); if (!back) { back = document.createElement('div'); back.className = 'backdrop'; back.id = 'locallog'; document.body.append(back); back.onclick = (e) => { if (e.target === back || e.target.closest('[data-act=close]')) back.hidden = true; }; } back.hidden = false; drawLocalLog(); }
  function drawLocalLog() {
    const f = window.CRAFTAI && CRAFTAI.found();
    $('locallog').innerHTML = `<div class="dialog wide" role="dialog" aria-modal="true" aria-labelledby="ll-title"><h2 id="ll-title">Local activity</h2><p class="hint">Everything that ran on this computer this session, newest first: the built-in AI models (on the ${f && f.webgpu ? 'graphics card' : 'processor'}) and every step that changed a picture, with before and after. Nothing here was sent anywhere. Cloud calls are under the cloud button.</p>
      <div class="cl-list">${localLog.length ? localLog.map((e) => e.kind === 'ai' ? `<div class="ai-card cl-${e.state === 'running' ? 'sending' : e.state}"><h3>AI model · ${esc(e.model)} <span class="hint">${new Date(e.at).toLocaleTimeString()} · on the ${esc(e.device)} · ${e.state === 'running' ? 'running…' : `${e.secs.toFixed(1)} s · ${e.state === 'done' ? 'OK' : 'FAILED'}`}${e.first ? ' · downloaded or loaded first' : ''}</span></h3>${e.error ? `<p class="cl-err">${esc(e.error)}</p>` : ''}</div>`
        : `<div class="ai-card"><h3>Step · ${esc(e.label)} <span class="hint">${new Date(e.at).toLocaleTimeString()}${e.secs != null ? ` · ${e.secs.toFixed(1)} s` : ''} · ${esc(e.size)}</span></h3><div class="cl-pics">${e.before ? `<figure class="cl-pic"><img src="${e.before}" alt=""><figcaption>before</figcaption></figure>` : ''}<figure class="cl-pic"><img src="${e.after}" alt=""><figcaption>after</figcaption></figure></div></div>`).join('') : '<p class="hint"><b>Nothing has run yet.</b></p>'}</div>
      <div class="dialog-actions"><button class="btn primary" type="button" data-act="close">Close</button></div></div>`;
  }
  function push(label, img, deep, how) {
    const p = pic(); p.steps.length = p.at + 1; p.steps.push({ label, img, deep: deep || undefined, how: how || undefined });
    if (p.steps.length > MAX_STEPS) p.steps.splice(1, 1);
    p.steps.forEach((s, i) => { if (i > 0 && i < p.steps.length - DEEP_KEEP) delete s.deep; }); // older steps keep 8 bits (memory)
    p.at = p.steps.length - 1; p.dirty = true; afterChange();
  }
  // ------------------------------------------------------------------ deep colour: 16 bits per channel between steps
  // Each step can carry a 16-bit copy (Uint16Array RGBA, 0–65535); the 8-bit picture shown is made from it through an
  // ordered dither, so smooth skies do not band. A tool written for 8 bits is run 8 times on copies jittered by up to
  // one level (each pixel through all 8 offsets once) and the results are averaged: the fractions every tool rounds
  // away come back. Tested over 5 tone steps on a dark gradient: twice the levels in the sky and a third of the error.
  // A tool too slow for 8 runs (over about 3 s in all) carries the input's in-between levels through instead.
  const DEEP_K = 8, DEEP_KEEP = 6;
  const jitter = (i, k) => { const h = (Math.imul((i >> 2) + 1, 2654435761) >>> 0) % DEEP_K; return (((k + h + (i & 3) * 3) % DEEP_K + 0.5) / DEEP_K) * 2 - 1; };
  async function deepRun(fn, st, out8, ms, mask) {
    const inImg = st.img, W = inImg.width, H = inImg.height, N = W * H * 4, D = st.deep, s8 = inImg.data;
    const src = D ? (i) => D[i] / 257 : (i) => s8[i];
    let acc = null; const eta = etaSay((m) => busyNow(m));
    if (ms * DEEP_K < 3000) {
      for (let k = 0; k < DEEP_K; k++) {
        const im = new ImageData(W, H), d = im.data; for (let i = 0; i < N; i++) d[i] = (i & 3) === 3 ? Math.round(src(i)) : Math.round(src(i) + jitter(i, k));
        if (k > 0) eta(`16-bit pass ${k + 1} of ${DEEP_K}`); const o = await fn(im); if (!o || !o.data || o.width !== out8.width || o.height !== out8.height) return null;
        if (!acc) acc = new Float32Array(o.data.length); const od = o.data; for (let i = 0; i < od.length; i++) acc[i] += od[i];
        await wait(0);
      }
      for (let i = 0; i < acc.length; i++) acc[i] /= DEEP_K;
    } else if (D && out8.width === W && out8.height === H) { acc = new Float32Array(N); const od = out8.data; for (let i = 0; i < N; i++) acc[i] = (i & 3) === 3 ? od[i] : od[i] + (D[i] / 257 - s8[i]); }
    else return null;
    if (mask && acc.length === N) for (let p = 0, q = 0; p < N; p += 4, q++) { const m = mask[q]; for (let c = 0; c < 4; c++) acc[p + c] = src(p + c) + (acc[p + c] - src(p + c)) * m; }
    const deep = new Uint16Array(acc.length); for (let i = 0; i < acc.length; i++) deep[i] = Math.max(0, Math.min(65535, Math.round(acc[i] * 257)));
    return deep;
  }
  // a new step from a tool's 8-bit result, with its 16-bit copy worked out
  async function pushDeep(label, out8, fn, ms, mask, how) {
    const st = pic().steps[pic().at]; let deep = null; noteStep(label, st.img, out8, ms);
    if (fn && deepOn) { busyNow(`${label} (in 16 bits)…`); IC.cloud.hold = true; try { deep = await deepRun(fn, st, out8, ms, mask); } catch (e) { if (!e.cloudHold) ICLOG.warn(`${label}: the 16-bit pass was skipped`, e); } finally { IC.cloud.hold = false; } } // the 16-bit pass re-runs the step: never a second (paid) cloud call; a cloud step stays 8-bit
    push(label, deep ? F.down16(deep, out8.width, out8.height) : out8, deep, how);
  }
  let deepOn = true; try { deepOn = localStorage.getItem('imagecraft-deep') !== 'off'; } catch (e) { /* blocked storage */ }
  function afterChange() { if (mapView) { mapView = null; $('mapbar').hidden = true; } renderPics(); renderHist(); renderProps(); show(); if (view.fit) fitView(); status(); colourCount(); renderInfo(); }
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
    countT = setTimeout(() => { if (st.img.width * st.img.height > 6e6) { st.colours = -1; } else st.colours = F.countColours(st.img); status(); if (!tool) renderProps(); renderInfo(); }, 60);
  }

  // ------------------------------------------------------------------ opening
  async function openFiles(files) {
    const list = [...files].filter(Boolean); let n = 0;
    for (const f of list) {
      busyNow(`Opening ${f.name}…`);
      const t0 = performance.now();
      try { const r = await F.read(f); addPic(f.name, r.img, r.info, f.size, r.deep); n++; ICLOG.info(`Opened ${f.name}: ${r.info.format}, ${r.img.width} × ${r.img.height}, ${kb(f.size || 0)} (${Math.round(performance.now() - t0)} ms)`); }
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
  // the repair brush: paint marks damage (red over the picture), the right button or Alt takes it away
  let repairPaint = null;
  function paintAt(px, py, erase, more) {
    const t = tool, b = t.base, W = b.width, H = b.height; if (!repairPaint || repairPaint.length !== W * H) repairPaint = new Uint8Array(W * H);
    if (t.def.id === 'shadowlift') { const r = Math.max(1, t.s.brush / 2); for (let y = Math.max(0, Math.floor(py - r)); y <= Math.min(H - 1, Math.ceil(py + r)); y++) for (let x = Math.max(0, Math.floor(px - r)); x <= Math.min(W - 1, Math.ceil(px + r)); x++) if ((x - px) ** 2 + (y - py) ** 2 <= r * r) repairPaint[y * W + x] = erase ? 0 : 1; if (!more) { t.preview = markOver(b, repairPaint); t.stale = true; show(); } return; }
    const r = Math.max(1, t.s.brush / 2), x0 = Math.max(0, Math.floor(px - r)), x1 = Math.min(W - 1, Math.ceil(px + r)), y0 = Math.max(0, Math.floor(py - r)), y1 = Math.min(H - 1, Math.ceil(py + r));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if ((x - px) ** 2 + (y - py) ** 2 <= r * r) repairPaint[y * W + x] = erase ? 0 : 1;
    if (!more) { t.preview = markOver(b, repairDamage(b, t.s)); t.stale = true; show(); }
  }
  async function pickDamage(px, py, erase) {
    const t = tool, b = t.base, W = b.width, H = b.height; busyNow('Outlining it (the first time downloads the picker)…');
    try {
      const c = X.canvasOf(b), r = await CRAFTAI.pick(c, [[px / W, py / H, 1]]); if (tool !== t) return;
      if (!repairPaint || repairPaint.length !== W * H) repairPaint = new Uint8Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (r.a[Math.min(r.H - 1, Math.floor(((y + 0.5) * r.H) / H)) * r.W + Math.min(r.W - 1, Math.floor(((x + 0.5) * r.W) / W))] > 127) repairPaint[y * W + x] = erase ? 0 : 1;
      t.preview = markOver(b, repairDamage(b, t.s)); t.stale = true; show();
    } catch (e) { ICLOG.error('Picking failed', e); toast('Could not outline it: ' + e.message); }
    busy(null);
  }
  const scratchMemo = new WeakMap();
  const ensureScratches = async (img, s) => { if (s.scratches && !scratchMemo.has(img)) { busyNow('Looking for scratches (the first time downloads the finder, about 75 MB)…'); scratchMemo.set(img, await CRAFTAI.scratches(img)); } };
  let damageCache = null; // the found damage for one picture and setting, so painting stays quick
  const repairDamage = (img, s) => { const key = JSON.stringify([s.specks, s.flecks, s.stamp, s.level]); if (!damageCache || damageCache.img !== img || damageCache.key !== key) damageCache = { img, key, m: IC.maps.damage(img, s) }; let m = Float32Array.from(damageCache.m); const sc = s.scratches && scratchMemo.get(img); if (sc) { const th = 0.65 - (s.level / 100) * 0.5; m = m.map((v, i) => (sc[i] >= th ? 1 : v)); } if (repairPaint && repairPaint.length === m.length) m = m.map((v, i) => Math.max(v, repairPaint[i])); return IC.maps.grow(m, img.width, img.height, s.grow); };
  const markOver = (img, m) => { const o = new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), d = o.data; for (let p = 0; p < m.length; p++) if (m[p] > 0.5) { d[p * 4] = Math.round(d[p * 4] * 0.35 + 255 * 0.65); d[p * 4 + 1] = Math.round(d[p * 4 + 1] * 0.35); d[p * 4 + 2] = Math.round(d[p * 4 + 2] * 0.35 + 40); } return o; };
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
    // bars and boxes over the picture (the map bar, the busy note) take their own clicks: pressing them must not start moving the picture
    if (!shown() || e.target.closest('.welcome') || e.target.closest('.cropbox') || e.target.closest('.mapbar') || e.target.closest('.busy')) return;
    if (e.target === $('split')) { drag = { kind: 'split' }; $('desk').setPointerCapture(e.pointerId); return; }
    const [px, py] = atPic(e), img = shown();
    if (e.button === 0 && tool && tool.def.pick && px >= 0 && py >= 0 && px < img.width && py < img.height) { const i = ((py | 0) * img.width + (px | 0)) * 4, d = (tool.base || img).data; tool.def.pick(tool.s, [d[i], d[i + 1], d[i + 2]], px / img.width, py / img.height); renderProps(); schedule(0); return; }
    if ((e.button === 0 || e.button === 2) && mapView && mapEdit && !tool && px >= 0 && py >= 0 && px < img.width && py < img.height) { const er = e.button === 2 || e.altKey; if (mapEdit.mode === 'click' || mapEdit.mode === 'face') { mapClick(px, py, er); return; } drag = { kind: 'mappaint', erase: er || mapEdit.mode === 'remove', last: [px, py] }; mapPaint(px, py, drag.erase); $('desk').setPointerCapture(e.pointerId); return; }
    if ((e.button === 0 || e.button === 2) && tool && tool.def.paint && tool.s.mark === 'pick' && px >= 0 && py >= 0 && px < img.width && py < img.height) { pickDamage(px, py, e.button === 2 || e.altKey); return; }
    if ((e.button === 0 || e.button === 2) && tool && tool.def.paint && px >= 0 && py >= 0 && px < img.width && py < img.height) { drag = { kind: 'paint', erase: e.button === 2 || e.altKey, last: [px, py] }; paintAt(px, py, drag.erase); $('desk').setPointerCapture(e.pointerId); return; }
    if (e.button === 0 && tool && tool.def.id === 'crop' && px >= 0 && py >= 0 && px < img.width && py < img.height) { drag = { kind: 'newcrop', x0: px, y0: py }; $('desk').setPointerCapture(e.pointerId); return; }
    if (e.button === 0 || e.button === 1) { e.preventDefault(); drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }; $('desk').classList.add('panning'); $('desk').setPointerCapture(e.pointerId); }
  });
  $('desk').addEventListener('pointermove', (e) => {
    const img = shown();
    if (img && !drag) { const [px, py] = atPic(e); hover = px >= 0 && py >= 0 && px < img.width && py < img.height ? [px | 0, py | 0] : null; hoverAt = hover ? [e.clientX, e.clientY] : null; if (!hover && $('loupe')) $('loupe').hidden = true; statusHover(); }
    if (!drag) return;
    if (drag.kind === 'pan') { view.x = drag.vx + e.clientX - drag.sx; view.y = drag.vy + e.clientY - drag.sy; view.fit = false; layout(); }
    else if (drag.kind === 'paint' || drag.kind === 'mappaint') {
      const [px, py] = atPic(e), [lx, ly] = drag.last || [px, py], step = Math.max(1, ((drag.kind === 'paint' ? tool.s.brush : mapEdit.brush) || 10) / 4), n = Math.max(1, Math.ceil(Math.hypot(px - lx, py - ly) / step));
      for (let k = 1; k <= n; k++) { const x = lx + ((px - lx) * k) / n, y = ly + ((py - ly) * k) / n; if (drag.kind === 'paint') paintAt(x, y, drag.erase, k < n); else mapPaint(x, y, drag.erase, k < n); }
      drag.last = [px, py];
    }
    else if (drag.kind === 'split') { const r = $('stage').getBoundingClientRect(); view.split = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); layout(); }
    else if (drag.kind === 'newcrop') { const [px, py] = atPic(e), s = tool.s; s.x = Math.max(0, Math.min(drag.x0, px)); s.y = Math.max(0, Math.min(drag.y0, py)); s.w = Math.min(img.width, Math.max(drag.x0, px)) - s.x; s.h = Math.min(img.height, Math.max(drag.y0, py)) - s.y; cropRatio(s, 'se'); placeCrop(); syncCropFields(); }
  });
  $('desk').addEventListener('contextmenu', (e) => { if ((tool && tool.def.paint) || (mapView && mapEdit)) e.preventDefault(); });
  $('desk').addEventListener('pointerup', () => { if (drag && drag.kind === 'mappaint') { renderMaps(); renderMapBar(); } if (drag && drag.kind === 'paint') renderProps(); if (drag && drag.kind === 'newcrop') renderProps(); drag = null; $('desk').classList.remove('panning'); });
  $('desk').addEventListener('pointerleave', () => { hover = null; hoverAt = null; if ($('loupe')) $('loupe').hidden = true; }); // the last colour stays in the status bar, to click and copy
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
  const UPS = [['smooth', 'Best (automatic)'], ['splat', 'Splat (edge-following blobs)'], ['area', 'Pixel averaging (area)'], ['nohalo', 'Sharp, no halos'], ['lanczos', 'Lanczos (sharpest)'], ['cubic', 'Cubic'], ['mitchell', 'Soft (Mitchell)'], ['linear', 'Linear'], ['nearest', 'Square pixels (pixel art, exact)'], ['mmpx', 'Pixel art, style kept (MMPX)'], ['scale2x', 'Pixel art, rounded corners (Scale2x)'], ['scale3x', 'Pixel art ×3 (Scale3x)'], ['smoothpixel', 'Pixel art made smooth'], ['ai-esrgan3', 'AI 4× Real-ESRGAN compact (fast, noise control)'], ['ai-esrgan', 'AI 4× Real-ESRGAN (real photos)'], ['ai-esrgan2', 'AI 2× Real-ESRGAN'], ['ai-sharp', 'AI 2× (clean pictures)'], ['ai-photo', 'AI 4× (old photos)'], ['ai-jpeg', 'AI 4× (JPEG clean-up)']];
  const ai = (k) => /^ai-/.test(k) ? k.slice(3) : null, aiKey = (s) => s.method + (s.method === 'ai-esrgan3' ? ':' + s.denoise : '');
  async function upscaleWith(img, method, factor, say, linear = true, opts = {}) {
    const k = ai(method);
    if (!k) return X.resize(img, { width: img.width * factor, height: img.height * factor, method, linear });
    if (!window.CRAFTAI) throw new Error('The AI helpers are missing.');
    say && say(`Getting the AI model ready (the first time it downloads)…`);
    const t0 = performance.now(); let tiles = 1; const c = await CRAFTAI.upscale(X.canvasOf(img), k, (n, t) => { tiles = t; say && say(`AI upscaling… square ${n} of ${t}`); }, opts);
    noteSpeed(k, (performance.now() - t0) / tiles);
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
    process: { title: 'Process a photo', icon: IK.auto, viewOnly: true, s: {}, run: (img) => img, fields: [{ t: 'custom', render: (into, t) => processPanel(into, t) }] },
    compare: { title: 'Compare', icon: IK.compare, viewOnly: true, s: () => ({ mode: 'side', at: 50, gain: 4, slots: [`${cur}:0`, `${cur}:${pic().at}`, '', ''] }),
      fields: [{ t: 'custom', render: (into, t) => comparePanel(into, t) }, { t: 'out' }],
      report: () => (tool && tool.cmpInfo ? `<p class="hint">${tool.cmpInfo}</p>` : ''),
      run: (img, s) => compareView(s) },
    cloudkeys: { title: 'Cloud AI keys', icon: IK.modern, viewOnly: true, noPic: true, live: false, s: {}, run: (img) => img, fields: [{ t: 'custom', render: (into) => cloudKeysPanel(into) }] },
    regen: { title: 'Regenerate (cloud AI)', icon: IK.modern, live: false, toNew: 'regenerated', applyLabel: 'Open as a new picture', s: () => ({ provider: IC.cloud.has('gemini') ? 'gemini' : 'openai', model: '', colour: false, text: (lastDescription.get(pic()) && `${lastDescription.get(pic()).subject}. ${lastDescription.get(pic()).materials}`) || '' }),
      fields: [{ t: 'custom', render: (into, t) => regenPanel(into, t) }, { t: 'out' }],
      report: () => (tool && tool.regenInfo ? `<p class="hint">${esc(tool.regenInfo)}</p>` : ''),
      run: async (img, s, say) => {
        if (!cloudOK()) throw new Error('Cloud AI is switched off (status bar): choose Cloud AI or Both.'); if (!IC.cloud.has(s.provider)) throw new Error('Add a Gemini or OpenAI key first (AI settings › Cloud AI).'); if (!s.model) throw new Error('Choose a model first.');
        say && say(`Sending the picture to ${IC.cloud.NAMES[s.provider]}… (it usually takes 10 to 60 seconds)`); const t0 = performance.now();
        let o = await IC.cloud.regenerate(img, s.provider, s.model, s.text, { colour: s.colour });
        const back = `${o.width} × ${o.height}`; if (o.width !== img.width || o.height !== img.height) o = X.resize(o, { width: img.width, height: img.height }); // the same size as the original, so Blend a version can mix them
        if (tool) tool.regenInfo = `Redrawn by ${s.model} (${IC.cloud.NAMES[s.provider]}) in ${((performance.now() - t0) / 1000).toFixed(0)} s; it came back ${back} and was scaled to the original's ${img.width} × ${img.height}. Everything in it is redrawn: compare with the original, and use Detail › Blend a version to take only the parts you want.`;
        return o;
      } },
    assess: { title: 'Ask AI what it needs', icon: IK.modern, viewOnly: true, s: {}, run: (img) => img,
      fields: [{ t: 'custom', render: (into, t) => assessPanel(into, t) }] },
    split: { title: 'Split subject and background', icon: IK.cutout, live: false, applyLabel: 'Make the two pictures', s: { fill: true, grow: 2 },
      fields: [note('The main subject and the background become two pictures of their own (like layers): restore the subject with care and the background more freely, then put them back together with Detail › Blend a version › Another open picture (the subject is placed by its solid parts).'),
        chk('fill', 'Fill the gap in the background smoothly (a guess from around it, for colour hints)'), range('grow', 'Take a little more round the subject (pixels)', 0, 12), { t: 'out' }, note('Press Preview to see the subject. The first use downloads the cut-out AI.')],
      run: async (img, s, say) => {
        say && say('Finding the main subject…'); await IC.maps.prepare('subject', img);
        let m = IC.maps.make('subject', img); const W = img.width, H = img.height;
        const sub = new ImageData(new Uint8ClampedArray(img.data), W, H); for (let p = 0; p < W * H; p++) sub.data[p * 4 + 3] = Math.round(img.data[p * 4 + 3] * m[p]);
        let hole = m; if (s.grow > 0) { const g = IC.maps.box(m.map((v) => (v > 0.15 ? 1 : 0)), W, H, s.grow); hole = g.map((v, i) => Math.max(m[i], v > 0.02 ? 1 : 0)); }
        const bg = s.fill ? IC.maps.fillGap(img, hole) : new ImageData(new Uint8ClampedArray(img.data), W, H); if (!s.fill) for (let p = 0; p < W * H; p++) bg.data[p * 4 + 3] = Math.round(img.data[p * 4 + 3] * (1 - hole[p]));
        if (tool) tool.outputs = [['subject', sub, 32], ['background', bg, s.fill ? 24 : 32]]; return sub;
      } },
    chroma: { title: 'Rebuild colour detail', icon: IK.colour, s: { strength: 100, size: 4 },
      fields: [note('A JPEG keeps the brightness in full but the colour at half size, in 8 × 8 blocks; old prints and scans smear colour more than brightness too. Colour edges almost always sit on brightness edges, so the colour is made to follow the brightness detail that is really there. Nothing is invented and the brightness is not touched.'),
        range('size', 'Block size to smooth over', 2, 16), range('strength', 'Strength %', 0, 100), note('4 is best for most JPEGs (tested: colour error 2.2 dB lower on a heavily compressed one). Raise it when False colour shows big colour blocks.')],
      run: (img, s) => X.chromaRebuild(img, s) },
    repair: { title: 'Repair damage', icon: IK.dust, live: false, paint: true, s: { scratches: true, specks: true, flecks: false, stamp: false, level: 50, grow: 2, how: 'ai', mark: 'paint', brush: 14 },
      fields: [note('Marks the damage, then fills it in from what is around it. Specks are found by themselves; <b>mark tears, flaking and stains yourself</b>: paint over them with the left mouse button, or click one and the AI outlines it. The right button takes marks away; the middle button moves the picture. Red shows what will be filled.'),
        seg('mark', 'Mark by', [['paint', 'Painting'], ['pick', 'Clicking (AI outlines it)']]),
        chk('scratches', 'Scratches, cracks and dust (AI: the old-photo scratch finder, about 75 MB once)'), chk('specks', 'Specks and dust (found by themselves)'), chk('flecks', 'White or black flecks and thin scratches (can catch thin white things such as poles: check the red)'), chk('stamp', 'Date stamp (orange numbers near the bottom)'),
        range('level', 'Sensitivity', 0, 100), range('grow', 'Take a little more round each mark (pixels)', 0, 8), range('brush', 'Brush size (pixels)', 2, 80, 1, (s) => s.mark === 'paint'),
        { t: 'custom', render: (into, t) => { const opts = [['ai', 'AI on this computer (MI-GAN): small and medium damage'], ['smooth', 'Fill from the edges (Telea): specks, scratches, thin cracks'], ...(cloudOK() ? IC.cloud.engines('fill').map((p) => ['cloud-' + p, `Cloud: ${IC.cloud.NAMES[p]} (large tears and missing parts; the marked area is sent)`]) : [])]; if (!opts.some((o) => o[0] === t.s.how)) t.s.how = 'ai'; const d = document.createElement('div'); d.className = 'field'; d.innerHTML = `<span>Fill with</span>${opts.map(([k, l]) => `<label class="check"><input type="radio" name="rp-how" value="${k}" ${t.s.how === k ? 'checked' : ''}> ${esc(l)}</label>`).join('')}`; d.onchange = (e) => { t.s.how = e.target.value; t.stale = true; renderProps(); }; into.append(d); } },
        { t: 'btns', buttons: [{ label: 'Show what will be filled', run: () => { const t = tool; if (!t) return; ensureScratches(t.base, t.s).then(() => { busy(null); if (tool !== t) return; t.preview = markOver(t.base, repairDamage(t.base, t.s)); t.stale = true; show(); }, (e) => { busy(null); logFail('The scratch finder failed', e); toast(e.message); }); } }, { label: 'Clear the painting', run: () => { repairPaint = null; if (tool) { tool.preview = null; show(); } } }] },
        { t: 'out' }, note('The AI draws what is missing from what is around it; check faces closely. The first use downloads it (about 28 MB). Press Preview.')],
      report: () => (tool && tool.holePct != null ? `<p class="hint"><b>${tool.holePct < 0.1 ? tool.holePct.toFixed(2) : tool.holePct.toFixed(1)}%</b> of the picture filled.${tool.holePct > 15 && tool.s.how === 'ai' ? ' <b>That is a lot:</b> over large areas the AI invents what is there (it can draw odd things); it works best on specks, scratches and tears of moderate size. Check closely, or mark less.' : ''}</p>` : ''),
      run: async (img, s, say) => {
        await ensureScratches(img, s); const hole = repairDamage(img, s); let n = 0; for (let i = 0; i < hole.length; i++) n += hole[i] > 0.5; if (tool) tool.holePct = (100 * n) / hole.length;
        if (!n) throw new Error('Nothing is marked: paint over the damage or click it, or tick a kind of damage.');
        let out;
        if (s.how.startsWith('cloud-')) { const pv = s.how.slice(6); IC.cloud.task('Repair fill'); if (!cloudOK()) throw new Error('Cloud AI is switched off (status bar).'); say && say(`Sending the marked area to ${IC.cloud.NAMES[pv]}… (10 to 60 seconds)`); const ld = lastDescription.get(pic()); out = await IC.cloud.tryEach(IC.cloud.orderFrom('fill', pv), async (p2) => { say && say(`Sending the marked area to ${IC.cloud.NAMES[p2]}… (10 to 60 seconds)`); return IC.cloud.fill(img, IC.maps.grow(hole, img.width, img.height, 2), p2, await IC.cloud.drawModel(p2), ld ? ld.subject : ''); }); }
        else if (s.how === 'ai') { say && say('Filling in the damage (AI; the first time downloads it)…'); out = await CRAFTAI.inpaint(img, IC.maps.grow(hole, img.width, img.height, 2)); } // the model keeps a thin ring at a hole's edge, so it gets the hole 2 pixels wider
        else out = IC.maps.telea(img, hole, 3, 0.5); // fast marching (Telea): 38 dB on thin cracks against 36 for a plain smooth fill and 30 for the AI
        // only the marked parts change (feathered by a pixel), so the rest stays exactly the original
        const soft = IC.maps.box(hole, img.width, img.height, 1), o = new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), d = o.data, a = out.data;
        for (let p = 0; p < soft.length; p++) { const k = Math.max(hole[p], soft[p]); if (k > 0) for (let c = 0; c < 3; c++) d[p * 4 + c] = Math.round(d[p * 4 + c] + (a[p * 4 + c] - d[p * 4 + c]) * k); }
        return o;
      } },
    descreen: { title: 'Descreen (printing dots)', icon: IK.undither, s: { sensitivity: 50, cut: 0.7, sharpen: 60, strength: 100 },
      fields: [note('A photo printed in a newspaper, yearbook or magazine is a grid of dots. Their spacing is measured from the picture’s frequency spectrum (where a printing screen shows as sharp spikes), the dots are smoothed away by exactly that much, and the edges are sharpened back without bringing the dots back. A picture without a printing screen is left alone.'),
        range('sensitivity', 'How faint a screen to look for', 0, 100), range('cut', 'Smoothing (× the dot spacing)', 0.4, 1.4, 0.05), range('sharpen', 'Sharpen back (%)', 0, 100), { t: 'out' }],
      report: () => (tool && tool.out && tool.out.peaks != null ? `<p class="hint">${tool.out.peaks >= 4 ? `Printing screen found: dots every <b>${tool.out.period.toFixed(1)}</b> pixels.` : 'No printing screen found, so nothing was changed (raise the sensitivity if you can see dots).'}</p>` : ''),
      run: (img, s) => IC.restore.descreen(img, s) },
    facerestore: { title: 'Restore faces (AI, redrawn)', icon: IK.cutout, live: false, s: { model: 'codeformer', fidelity: 70, strength: 100 },
      fields: [note('<b>This redraws faces</b> from a model of faces (CodeFormer): small, blurred, grainy or damaged faces become clear, but the model draws what it expects, so a face can come out a little different from the person. The slider sets how closely it keeps to the original. Each face is straightened onto the model’s layout, restored, and laid back with a soft edge, so the rest of the picture is untouched.'),
        { t: 'custom', render: (into, t) => { const opts = [['codeformer', 'CodeFormer (closeness slider)'], ['gfpgan', 'GFPGAN 1.4 (natural)'], ...(cloudOK() ? IC.cloud.engines('face').map((p) => ['cloud-' + p, `Cloud: ${IC.cloud.NAMES[p].split(' ')[0]} (each face crop is sent)`]) : [])]; if (!opts.some((o) => o[0] === t.s.model)) t.s.model = 'codeformer'; const d = document.createElement('div'); d.className = 'field'; d.innerHTML = `<span>Model</span>${opts.map(([k, l]) => `<label class="check"><input type="radio" name="fr-m" value="${k}" ${t.s.model === k ? 'checked' : ''}> ${esc(l)}</label>`).join('')}`; d.onchange = (e) => { t.s.model = e.target.value; t.stale = true; renderProps(); }; into.append(d); } }, range('fidelity', 'Keep to the original (%): higher is more the person, lower is cleaner', 0, 100, 1, (s) => s.model !== 'gfpgan'), range('strength', 'Blend with the original (%)', 0, 100), { t: 'out' },
        note('The first use downloads the model once: CodeFormer about 377 MB, GFPGAN about 340 MB. Non-commercial use only. Press Preview.')],
      report: () => { const n = tool && tool.faces; if (n == null) return ''; return `<p class="hint"><b>${n}</b> face${n === 1 ? '' : 's'} restored${tool.secs ? ` in ${tool.secs.toFixed(1)} s` : ''}.</p>`; },
      run: async (img, s, say) => {
        say && say('Finding faces…'); const faces = await IC.faces.ensure(img); if (!faces.length) throw new Error('No faces found in this picture.');
        const t0 = performance.now(), mk = s.model.startsWith('cloud-') ? s.model : s.model === 'gfpgan' ? 'gfpgan' : 'codeformer', per = speed[mk]; if (mk.startsWith('cloud-') && !cloudOK()) throw new Error('Cloud AI is switched off (status bar).'); if (mk.startsWith('cloud-')) IC.cloud.task('Restore faces'); say && say(mk.startsWith('cloud-') ? `Sending ${faces.length} face crop${faces.length === 1 ? '' : 's'} to ${IC.cloud.NAMES[mk.slice(6)]}… (about 15 to 40 seconds each)` : per ? `Restoring ${faces.length} face${faces.length === 1 ? '' : 's'}: about ${fmtTime((faces.length * per) / 1000)} on this computer` : 'Getting the face model ready (the first time downloads it, about 350 MB; it can take a few minutes)…');
        const out = await IC.faces.restore(img, faces, { model: mk, fidelity: s.fidelity / 100, strength: s.strength / 100, onStep: (m) => say && say(m) });
        const secs = (performance.now() - t0) / 1000; noteSpeed(mk, (secs * 1000) / faces.length); if (tool) { tool.faces = faces.length; tool.secs = secs; }
        return out;
      } },
    colourise: { title: 'Colourise (AI, a guess)', icon: IK.colour, live: false, s: { engine: 'builtin', amount: 100, warm: 0 },
      fields: [note('Gives a black-and-white, sepia or badly faded photo likely colours (DDColor). <b>Only the colour is a guess</b>: the brightness and every detail stay the photo’s own. The model knows what skin, sky, grass, trees and clothes usually look like, but not what colour a particular dress or car really was.'),
        { t: 'custom', render: (into, t) => { const opts = [['builtin', 'On this computer (DDColor)'], ...(cloudOK() ? IC.cloud.engines('colour').map((p) => [p, `Cloud: ${IC.cloud.NAMES[p].split(' ')[0]} (only its colours are used; the picture is sent)`]) : [])]; if (!opts.some((o) => o[0] === t.s.engine)) t.s.engine = 'builtin'; if (opts.length < 2) return; const d = document.createElement('div'); d.className = 'field'; d.innerHTML = `<span>Engine</span>${opts.map(([k, l]) => `<label class="check"><input type="radio" name="cz-eng" value="${k}" ${t.s.engine === k ? 'checked' : ''}> ${esc(l)}</label>`).join('')}`; d.onchange = (e) => { t.s.engine = e.target.value; t.stale = true; renderProps(); }; into.append(d); } },
        range('amount', 'Colour strength (%)', 0, 150), range('warm', 'Cooler ↔ warmer', -50, 50, 1, (s) => s.engine === 'builtin'), { t: 'out' }, note('The first use downloads about 135 MB (once). It works best on the whole photo before other colour changes. Press Preview.')],
      report: () => (tool && tool.secs ? `<p class="hint">Took ${tool.secs.toFixed(1)} s.</p>` : ''),
      run: async (img, s, say) => { if (s.engine && s.engine !== 'builtin') { IC.cloud.task('Colourise'); if (!cloudOK()) throw new Error('Cloud AI is switched off (status bar).'); say && say(`Sending a copy to ${IC.cloud.NAMES[s.engine]}… (10 to 60 seconds)`); const t0 = performance.now(), ld = lastDescription.get(pic()), o = await IC.cloud.tryEach(IC.cloud.orderFrom('colour', s.engine), async (p2) => { say && say(`Sending a copy to ${IC.cloud.NAMES[p2]}… (10 to 60 seconds)`); return IC.cloud.colourise(img, p2, await IC.cloud.drawModel(p2), { amount: s.amount, text: ld ? `${ld.subject}. ${ld.materials}` : '' }); }); if (tool) tool.secs = (performance.now() - t0) / 1000; return o; }
        say && say(speed.colourise ? `Colourising: about ${fmtTime(speed.colourise / 1000)}` : 'Getting the colour model ready (the first time downloads about 135 MB)…'); const t0 = performance.now(); const o = await X.colourise(img, s); const ms = performance.now() - t0; noteSpeed('colourise', ms); if (tool) tool.secs = ms / 1000; return o; } },
    redeye: { title: 'Red eye', icon: IK.cutout, live: false, s: { strength: 100, level: 50 },
      fields: [note('The flash lit the back of the eye. The face finder finds each iris, and only there, where red is far above green and blue, the red is taken down to them: the pupil becomes dark again and the iris keeps its own colour.'),
        range('level', 'Sensitivity', 0, 100), range('strength', 'Strength %', 0, 100), { t: 'out' }, note('The first use downloads the face finder (about 4 MB). Press Preview.')],
      report: () => (tool && tool.redeye != null ? `<p class="hint"><b>${tool.redeye}</b> red pixel${tool.redeye === 1 ? '' : 's'} fixed in ${tool.faces} face${tool.faces === 1 ? '' : 's'}.</p>` : ''),
      run: async (img, s, say) => {
        say && say('Finding faces…'); const faces = await IC.faces.ensure(img); if (!faces.length) throw new Error('No faces found in this picture.');
        const m = IC.maps.grow(IC.faces.partMask(img, faces, 'irises'), img.width, img.height, 2), o = new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), d = o.data, ratio = 2 - s.level / 100, k = s.strength / 100; let n = 0;
        for (let p = 0; p < m.length; p++) { if (m[p] < 0.3) continue; const i = p * 4, r = d[i], g = d[i + 1], b = d[i + 2], gb = Math.max(g, b); if (r > 60 && r > ratio * gb) { d[i] = Math.round(r + (Math.min(r, (g + b) / 2) - r) * k * Math.min(1, m[p] * 1.5)); n++; } }
        if (tool) { tool.redeye = n; tool.faces = faces.length; } return o;
      } },
    shadowlift: { title: 'Lift a shadow', icon: IK.light, live: false, paint: true, s: { brush: 30, strength: 100, edge: 50 },
      fields: [note('For a hard shadow, such as a flash shadow on a wall behind someone. <b>Paint over the shadow</b> (the right button takes paint away). The light just outside it is compared with the shadow, colour by colour, and the shadow is brightened by that much, with its edge following the picture so no dark rim is left.'),
        range('brush', 'Brush size (pixels)', 4, 120), range('strength', 'Strength %', 0, 100), range('edge', 'Edge softness', 0, 100), { t: 'btns', buttons: [{ label: 'Clear the painting', run: () => { repairPaint = null; if (tool) { tool.preview = null; show(); } } }] }, { t: 'out' }, note('Press Preview.')],
      report: () => (tool && tool.gain ? `<p class="hint">Brightened ${tool.gain.map((g) => g.toFixed(2) + '×').join(', ')} (red, green, blue).</p>` : ''),
      run: (img, s) => {
        const W = img.width, H = img.height, n = W * H; if (!repairPaint || repairPaint.length !== n || !repairPaint.some((v) => v)) throw new Error('Paint over the shadow first.');
        const M = Float32Array.from(repairPaint), d = img.data, R = Math.max(4, Math.round(Math.max(W, H) / 80)), near = IC.maps.box(M, W, H, R * 2);
        // what is painted and a ring round it, split into dark and light (Otsu's method), so sloppy painting either way does
        // not matter: the shadow is the dark group, the lit wall the light one, and the gain is their ratio, colour by colour
        const lum = (p) => 0.299 * d[p * 4] + 0.587 * d[p * 4 + 1] + 0.114 * d[p * 4 + 2], hist = new Float64Array(256); let tot = 0;
        for (let p = 0; p < n; p += 2) if (near[p] > 0.02) { hist[Math.min(255, Math.round(lum(p)))]++; tot++; }
        let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i]; let sB = 0, wB = 0, best = -1, th = 128;
        for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; const wF = tot - wB; if (!wF) break; sB += t * hist[t]; const v = wB * wF * (sB / wB - (sum - sB) / wF) ** 2; if (v > best) { best = v; th = t; } }
        const med = (pick) => { const v = [[], [], [], []]; for (let p = 0; p < n; p += 2) if (pick(p)) { for (let c = 0; c < 3; c++) v[c].push(d[p * 4 + c]); v[3].push(lum(p)); } return v.map((a) => { a.sort((x, y) => x - y); return a.length ? a[a.length >> 1] : 0; }); };
        const sh = med((p) => M[p] > 0.5 && lum(p) <= th), lit = med((p) => near[p] > 0.02 && lum(p) > th);
        if (!lit[3] || !sh[3]) throw new Error('Could not tell the shadow from the light round it: paint a little past its edge.');
        const gain = sh.slice(0, 3).map((v, c) => Math.min(4, Math.max(1, (lit[c] + 1) / (v + 1)))), lo = sh[3], hi = lit[3];
        // the mask's edge made to follow the picture (guided by its brightness), then softened a little
        const L = new Float32Array(n); for (let p = 0; p < n; p++) L[p] = (0.299 * d[p * 4] + 0.587 * d[p * 4 + 1] + 0.114 * d[p * 4 + 2]) / 255;
        let m = X.guidedBy(L, IC.maps.box(M, W, H, 2), W, H, Math.max(2, Math.round(R * (0.3 + s.edge / 100))), 0.002); m = m.map((v) => Math.max(0, Math.min(1, v)));
        const o = new ImageData(new Uint8ClampedArray(d), W, H), od = o.data, k = s.strength / 100;
        // only what is dark gets lifted (painted wall that is already lit stays as it is)
        for (let p = 0; p < n; p++) { const w = m[p] * k * Math.max(0, Math.min(1, (hi - lum(p)) / Math.max(1, hi - lo))); if (w > 0.002) for (let c = 0; c < 3; c++) od[p * 4 + c] = Math.round(d[p * 4 + c] * (1 + (gain[c] - 1) * w)); }
        if (tool) tool.gain = gain; return o;
      } },
    falsecolour: { title: 'False colour', icon: IK.colour, toNew: 'false colour', applyLabel: 'Open as a new picture', s: { amount: 100 },
      fields: [note('Each colour separation (cyan, magenta, yellow) is stretched to its own full range and inked again, so differences of a few percent become strong colours. On a black-and-white or sepia print it shows stains, uneven toning, fading and retouching; on a faded colour print, which dye layer has gone. For looking and for masks: it is not the real colour.'), range('amount', 'Amount %', 0, 100), { t: 'out' }],
      report: () => (tool && tool.out && tool.out.ranges ? `<p class="hint">How much of each ink this picture really holds: ${['cyan', 'magenta', 'yellow'].map((n, i) => `${n} ${Math.round(tool.out.ranges[i][0] * 100)}–${Math.round(tool.out.ranges[i][1] * 100)}%`).join(', ')}.</p>` : ''),
      run: (img, s) => IC.maps.falseColour(img, s) },
    stack: { title: 'Combine photos', icon: IK.upscale, live: false, toNew: 'combined', applyLabel: 'Make the combined picture',
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
    deband: { title: 'Smooth out banding', icon: IK.undither, s: { threshold: 3, radius: 16 },
      fields: [note('Smooth gradients (skies, walls, shadows) that were rounded into stripes, from too few levels or from brightening a dark picture. Each pixel is compared with four others a little way off; where they are all within a level or two, it is a band edge and is smoothed. Edges and texture stay. The picture keeps 16 bits per colour afterwards, so the bands do not come back.'),
        range('threshold', 'How big a step counts as a band (levels)', 1, 10), range('radius', 'How wide the bands are (pixels)', 4, 48)],
      run: (img, s) => X.deband(img, s) },
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
    upscale: { title: 'Make bigger', icon: IK.upscale, s: (img) => ({ method: img.width * img.height < 90000 ? 'scale2x' : 'smooth', factor: 2, linear: true, mix: 100, aa: 0, denoise: 50 }),
      fields: [sel('method', 'How', UPS), seg('factor', 'Times', [[2, '2×'], [3, '3×'], [4, '4×']], (s) => !ai(s.method)),
        chk('linear', 'Average in linear light (truer colours and edges)', (s) => !ai(s.method) && s.method !== 'nearest'),
        range('denoise', 'Noise removal (%)', 0, 100, 5, (s) => s.method === 'ai-esrgan3'), range('mix', 'AI strength (%): less mixes in the classic enlargement', 0, 100, 5, (s) => !!ai(s.method)), range('aa', 'Smooth jagged edges (%)', 0, 100, 1, (s) => !ai(s.method)), { t: 'out' },
        note('<b>Best</b> sharpens edges without the light and dark halos sharp filters leave, and averages light the way the eye sees it. <b>Pixel averaging</b> counts every pixel by how much it covers: crisp, honest, no invented detail.', (s) => !ai(s.method)),
        note('The AI ways download a model once (10–70 MB) and work offline after that. On a graphics card they take about a second for each 160 × 160 square; on the processor much longer.', (s) => !!ai(s.method))],
      live: (s) => !ai(s.method) || !!(tool && tool.aiCache && tool.aiCache.k === aiKey(s)), report: (img) => { const s = tool && tool.s, k = s && ai(s.method), b = tool && tool.base; let est = ''; if (k && b) { const n = Math.ceil(b.width / 160) * Math.ceil(b.height / 160), ms = speed[k]; est = ms ? ` AI: ${n} squares, about <b>${fmtTime((n * ms) / 1000)}</b> on this computer.` : ` AI: ${n} squares; how long depends on the model and the graphics card (from a tenth of a second to ten seconds a square). It is timed the first time.`; } return `<p class="hint">Becomes <b>${img.width} × ${img.height}</b> pixels.${est}</p>`; },
      run: async (img, s, say) => {
        if (!ai(s.method)) { const u = await upscaleWith(img, s.method, +s.factor, say, s.linear); return +s.aa ? X.antialias(u, { amount: +s.aa }) : u; }
        // the AI result is kept, so moving the strength slider does not run the model again
        const t = tool || {}; if (!t.aiCache || t.aiCache.k !== aiKey(s)) t.aiCache = { k: aiKey(s), img: await upscaleWith(img, s.method, CRAFTAI.MODELS[ai(s.method)].scale, say, true, { strength: +s.denoise / 100 }) };
        const a = t.aiCache.img; if (+s.mix >= 100) return a;
        return blendLight(a, X.resize(img, { width: a.width, height: a.height, method: 'nohalo' }), +s.mix / 100);
      } },
    modern: { title: 'Modernise', icon: IK.modern, live: false, s: (img) => ({ kind: img.width * img.height < 90000 ? 'pixel' : 'photo', bigger: 2, useAi: false, colourise: false, faces: false }),
      fields: [seg('kind', 'What kind of picture', [['pixel', 'Pixel art'], ['screen', 'Dithered screen'], ['photo', 'Old photo or scan'], ['jpeg', 'Blocky JPEG']]), seg('bigger', 'Make it bigger', [[1, 'No'], [2, '2×'], [4, '4×']]), chk('useAi', 'Use AI upscaling (the compact Real-ESRGAN that comes with ImageCraft)', (s) => s.kind !== 'pixel' && +s.bigger > 1),
        chk('colourise', 'Colourise (AI: the colours are a guess; about 135 MB once, 10 s)', (s) => s.kind === 'photo'), chk('faces', 'Restore faces (AI: faces are redrawn; about 377 MB once; non-commercial)', (s) => s.kind === 'photo'),
        note('With colourising and face restoring, a full photo can take several minutes (one test: 6 minutes on the processor for a 1282 × 1613 group of seven, made 2× bigger). A graphics card is much quicker.', (s) => s.kind === 'photo' && (s.colourise || s.faces)),
        note('Pixel art: grown with smooth, rounded edges. Dithered screen: dots blended to smooth colour. Old photo: JPEG blocks (when there are any), dust, smart noise removal, a gentle deblur, colour cast, levels and faded detail. Blocky JPEG: blocks smoothed.'), note('Press Preview to see it first.')],
      run: async (img, s, say) => {
        const k = +s.bigger; let o = img;
        if (s.kind === 'pixel') { if (k > 1) o = X.resize(img, { width: img.width * k, height: img.height * k, method: 'smoothpixel' }); return X.sharpen(o, { amount: 30, radius: 1 }); }
        if (s.kind === 'screen') { say && say('Blending the dots…'); o = X.undither(o, { strength: 65 }); }
        // old photo, in the usual restoration order: dust, noise (grain and colour separately), a little deblur, then tone
        // JPEG blocks first (a photo passed round online is often heavily compressed): measured, so a clean scan is left alone
        if (s.kind === 'photo') { const bl = IC.restore.blockiness(o); if (bl.luma > 1.3) { say && say('Smoothing the JPEG blocks…'); o = X.deblock(o, { strength: 50 }); } if (bl.colour > 2) o = X.chromaRebuild(o, { size: 8 }); }
        if (s.kind === 'photo') { say && say('Dust and noise…'); o = IC.restore.impulse(o, { threshold: 30 }); const n = IC.restore.noiseLevel(o); if (n.luma > 1 || n.chroma > 1) o = IC.restore.nlm(o, nlmFor(n)); say && say('Sharpness and tone…'); const m = IC.restore.measure(o); if (m && m.radius > 0.8) o = IC.restore.deblur(o, { kind: 'gauss', radius: Math.min(3, m.radius * 0.7), noise: kFor(IC.restore.noiseLevel(o).luma) + 20, strength: 60 }); const toned = X.isToned(o) || undefined, hz = X.hazeLevel(o); if (hz > 0.22) o = X.dehaze(o, { strength: Math.min(80, (hz - 0.15) * 300), keepSome: 0.15 }); o = X.clarity(X.autoColour(X.shadowRecover(o, { shadows: 40, highlights: 15, detail: 5, maxGain: 2.5 }), { strength: 100, keepTone: toned ? true : 'auto' }), { amount: 30 }); }
        if (s.kind === 'jpeg') { say && say('Smoothing the blocks…'); o = X.deblock(o, { strength: 60 }); }
        if (s.kind === 'photo' && s.colourise) { if (aiMode === 'cloud' && IC.cloud.engines('colour').length) { IC.cloud.task('Modernise: colourise'); o = await IC.cloud.tryEach(IC.cloud.engines('colour'), async (p2) => { say && say(`Colourising: sending a copy to ${IC.cloud.NAMES[p2]}…`); return IC.cloud.colourise(o, p2, await IC.cloud.drawModel(p2), { amount: 80 }); }); } else { say && say('Colourising (AI, on this computer)…'); o = await X.colourise(o, { amount: 80 }); } } // a little under full strength: with the clean-up's own contrast, full colour came out too vivid
        if (s.kind === 'photo' && s.faces) { say && say('Finding faces…'); const f = await IC.faces.ensure(o); if (f.length) { const cl = aiMode === 'cloud' && IC.cloud.engines('face').length; if (cl) IC.cloud.task('Modernise: faces'); o = await IC.faces.restore(o, f, { model: cl ? 'cloud-' + IC.cloud.engines('face')[0] : 'codeformer', fidelity: 0.7, onStep: (m) => say && say(m) }); } }
        if (k > 1) o = s.useAi ? await upscaleWith(o, s.kind === 'jpeg' || s.kind === 'photo' ? 'ai-esrgan3' : 'ai-sharp', k, say, true, { strength: s.kind === 'jpeg' ? 0.8 : 0.5 }) : X.resize(o, { width: o.width * k, height: o.height * k });
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
  const NO_MASK = new Set(['resize', 'crop', 'canvas', 'straighten', 'looks', 'text', 'trace', 'upscale', 'remaster', 'modern', 'depth', 'noisemap', 'stack', 'split', 'falsecolour', 'assess', 'repair', 'redeye', 'shadowlift', 'facerestore', 'colourise', 'process', 'regen', 'cloudkeys', 'compare']);
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
  // With the switch on Cloud AI, the steps that have a cloud version use it (unless chosen otherwise in the panel);
  // on Local AI or Both they start on this computer. Used by the panels, Process a photo, Modernise and recipes.
  function cloudAuto(id, s) {
    if (aiMode !== 'cloud' || !s) return s; const CL = IC.cloud;
    if (id === 'repair' && !String(s.how).startsWith('cloud-') && CL.engines('fill').length) s.how = 'cloud-' + CL.engines('fill')[0];
    if (id === 'colourise' && (!s.engine || s.engine === 'builtin') && CL.engines('colour').length) s.engine = CL.engines('colour')[0];
    if (id === 'facerestore' && !String(s.model).startsWith('cloud-') && CL.engines('face').length) s.model = 'cloud-' + CL.engines('face')[0];
    return s;
  }
  // where a step will run, for the Process plan: the cloud service it will use, or this computer
  function whereTag(id) { const job = { repair: 'fill', colourise: 'colour', facerestore: 'face' }[id], eng = aiMode === 'cloud' && job && IC.cloud.engines(job)[0]; return eng ? `<span class="where cloud" title="Sent to ${esc(IC.cloud.NAMES[eng])} (the switch is on Cloud AI)">Cloud: ${esc(IC.cloud.NAMES[eng].split(' ')[0])}</span>` : `<span class="where" title="${job ? (aiMode === 'cloud' ? 'No cloud key that can do this: runs on this computer' : 'The switch is not on Cloud AI: runs on this computer') : 'No cloud version of this step: runs on this computer'}">This computer</span>`; }
  function openTool(id, preset) {
    if (!pic() && !(TOOLS[id] && TOOLS[id].noPic)) { toast('Open a picture first.'); return; }
    if (id === 'repair' || id === 'shadowlift') repairPaint = null; // a fresh painting each time
    if (tool) closeTool(true);
    const def = TOOLS[id], base = now();
    tool = { def, base, s: { ...cloudAuto(id, JSON.parse(JSON.stringify(typeof def.s === 'function' ? def.s(base) : def.s))), ...(preset || {}) }, preview: null };
    if (maskable(def)) tool.s = { wMap: '', wOp: '', wMap2: 'skin', wInvert: false, wLevel: 0.35, wSoft: 0.3, wFeather: 2, ...tool.s };
    if (mapView) closeMap();
    showSide('right'); renderProps(); if (def.enter) def.enter();
    if (isLive(tool)) schedule(0); else show();
  }
  // Ask AI (Ollama): connect, choose a model, look, then run the ticked steps one by one (each a step in History)
  // ------------------------------------------------------------------ compare: versions side by side
  // Each slot is "picture:step" (any open picture, any step in its History). They are drawn into one picture (side by
  // side, a grid, a split or the differences), so zooming and moving the view moves them all together.
  const slotImg = (k) => { if (!k) return null; const [i, j] = k.split(':').map(Number); const p = pics[i]; return p && p.steps[j] ? p.steps[j].img : null; };
  const slotName = (k) => { const [i, j] = k.split(':').map(Number), p = pics[i]; return p ? `${baseName(p.name)} · ${j === 0 ? 'original' : `${j}. ${p.steps[j].label}`}` : ''; };
  function compareView(s) {
    const ks = s.slots.filter((k) => slotImg(k)), n = s.mode === 'grid' ? Math.min(4, ks.length) : Math.min(2, ks.length); if (n < 1) throw new Error('Choose what to compare.');
    if (s.mode !== 'grid' && n < 2) throw new Error('Choose two versions to compare.');
    const a0 = slotImg(ks[0]), k = Math.min(1, Math.sqrt(4e6 / (a0.width * a0.height))), W = Math.max(1, Math.round(a0.width * k)), H = Math.max(1, Math.round(a0.height * k)); // each at most about 4 megapixels
    const fit = (im) => (im.width === W && im.height === H ? im : X.resize(im, { width: W, height: H }));
    const ims = ks.slice(0, n).map((q) => fit(slotImg(q))), lab = ks.slice(0, n).map(slotName);
    if (tool) tool.cmpInfo = a0.width !== W ? `Shown at ${W} × ${H} (scaled down to keep it quick).` : ims.some((im, i) => slotImg(ks[i]).width !== W) ? 'Versions of a different size are scaled to the first one’s size.' : '';
    const G = s.mode === 'side' ? 8 : 0, cols = s.mode === 'side' ? 2 : s.mode === 'grid' ? (n > 1 ? 2 : 1) : 1, rows = s.mode === 'grid' ? Math.ceil(n / 2) : 1;
    const c = document.createElement('canvas'); c.width = cols * W + (cols - 1) * (s.mode === 'grid' ? 8 : G); c.height = rows * H + (rows - 1) * (s.mode === 'grid' ? 8 : 0); const x = c.getContext('2d'); x.fillStyle = '#16171c'; x.fillRect(0, 0, c.width, c.height);
    const put = (im, dx, dy) => { const t = document.createElement('canvas'); t.width = W; t.height = H; t.getContext('2d').putImageData(im, 0, 0); x.drawImage(t, dx, dy); };
    const tag = (text, dx, dy) => { const f = Math.max(14, Math.round(Math.min(W, H) / 22)); x.font = `600 ${f}px system-ui, sans-serif`; const w = x.measureText(text).width + f; x.fillStyle = 'rgba(0,0,0,0.62)'; x.fillRect(dx + f / 2, dy + f / 2, w, f * 1.6); x.fillStyle = '#fff'; x.fillText(text, dx + f, dy + f * 1.55); };
    if (s.mode === 'side' || s.mode === 'grid') ims.forEach((im, i) => { const cx = (i % cols) * (W + 8), cy = Math.floor(i / cols) * (H + 8); put(im, cx, cy); tag(lab[i], cx, cy); });
    else if (s.mode === 'split') { put(ims[1], 0, 0); const cut = Math.round((W * s.at) / 100), t = document.createElement('canvas'); t.width = W; t.height = H; t.getContext('2d').putImageData(ims[0], 0, 0); x.drawImage(t, 0, 0, cut, H, 0, 0, cut, H); x.fillStyle = '#fff'; x.fillRect(cut - 1, 0, 2, H); tag(lab[0], 0, 0); const f = Math.max(14, Math.round(Math.min(W, H) / 22)); x.font = `600 ${f}px system-ui, sans-serif`; tag(lab[1], W - x.measureText(lab[1]).width - f * 2, 0); }
    else { // differences: how much each pixel changed, as heat over the first version (gain makes small changes visible)
      const a = ims[0].data, b = ims[1].data, m = new Float32Array(W * H); let sum = 0;
      for (let p = 0; p < W * H; p++) { const dd = (Math.abs(a[p * 4] - b[p * 4]) + Math.abs(a[p * 4 + 1] - b[p * 4 + 1]) + Math.abs(a[p * 4 + 2] - b[p * 4 + 2])) / 3; sum += dd; m[p] = Math.min(1, (dd * s.gain) / 255); }
      put(IC.maps.heat(m, ims[0]), 0, 0); tag(`Changes: ${lab[0]} → ${lab[1]}`, 0, 0); if (tool) tool.cmpInfo = `On average each pixel changed by ${(sum / (W * H)).toFixed(1)} levels (of 255). Bright = changed most.`;
    }
    return x.getImageData(0, 0, c.width, c.height);
  }
  function comparePanel(into, t) {
    const s = t.s, d = document.createElement('div'); into.append(d);
    const opts = pics.map((p, i) => p.steps.map((st, j) => `<option value="${i}:${j}">${esc(baseName(p.name))} · ${j === 0 ? 'original' : `${j}. ${esc(st.label)}`}</option>`).join('')).join('');
    const n = s.mode === 'grid' ? 4 : 2, names = s.mode === 'diff' ? ['Before', 'After'] : s.mode === 'split' ? ['Left', 'Right'] : s.mode === 'side' ? ['Left', 'Right'] : ['Top left', 'Top right', 'Bottom left', 'Bottom right'];
    d.innerHTML = `<p class="hint">Any versions together: the original, any step in History, or another open picture (use <b>Duplicate picture</b> to try a different set of steps on a copy). Zoom and move the view as usual: they all follow.</p>
      <div class="field"><span>How</span><div class="seg">${[['side', 'Side by side'], ['grid', 'Grid (up to 4)'], ['split', 'Split'], ['diff', 'Differences']].map(([k, l]) => `<button type="button" class="btn" data-cm="${k}" aria-pressed="${k === s.mode}">${l}</button>`).join('')}</div></div>
      ${names.slice(0, n).map((nm, i) => `<label class="field"><span>${nm}</span><select class="input" data-slot="${i}"><option value="">(none)</option>${opts}</select></label>`).join('')}
      ${s.mode === 'split' ? `<label class="field"><span>Where the line is (%)</span><input class="input" type="range" min="0" max="100" value="${s.at}" data-at></label>` : ''}
      ${s.mode === 'diff' ? `<label class="field"><span>Make small changes stand out (×${s.gain})</span><input class="input" type="range" min="1" max="20" value="${s.gain}" data-gain></label>` : ''}`;
    d.querySelectorAll('[data-slot]').forEach((sel) => { sel.value = s.slots[+sel.dataset.slot] || ''; });
    const redo = () => { t.stale = true; schedule(0); };
    d.onclick = (e) => { const b = e.target.closest('[data-cm]'); if (!b) return; s.mode = b.dataset.cm; renderProps(); redo(); };
    d.onchange = (e) => { if (e.target.dataset.slot != null) { s.slots[+e.target.dataset.slot] = e.target.value; redo(); } };
    d.oninput = (e) => { if (e.target.dataset.at != null) { s.at = +e.target.value; redo(); } if (e.target.dataset.gain != null) { s.gain = +e.target.value; e.target.previousElementSibling.textContent = `Make small changes stand out (×${s.gain})`; redo(); } };
  }
  // a copy of the picture as it is now, to try a different set of steps on (then Compare the two)
  function duplicatePic() { const p = pic(); if (!p) return toast('Open a picture first.'); const st = p.steps[p.at]; addPic(`${baseName(p.name)} (copy).png`, st.img, { ...p.info, format: `copy of ${p.info.format || 'picture'}` }, 0, st.deep); toast('A copy is open: try different steps on it, then View › Compare the two.'); }
  // ------------------------------------------------------------------ AI settings (the AI chip in the status bar)
  // which AI the cloud-capable steps may use: 'local' (nothing leaves this computer), 'cloud' or 'both'
  let aiMode = 'both'; try { aiMode = localStorage.getItem('imagecraft-aimode') || 'both'; } catch (e) { /* blocked storage */ }
  const cloudOK = () => aiMode !== 'local', localOK = () => aiMode !== 'cloud'; IC.aiMode = () => aiMode;
  function aiModeUI() { const el = $('st-aimode'); if (!el) return; el.innerHTML = [['local', 'Local AI'], ['both', 'Both'], ['cloud', 'Cloud AI']].map(([k, l]) => `<button type="button" class="btn" data-mode="${k}" aria-pressed="${aiMode === k}">${l}</button>`).join(''); aiChip(); }
  let ollamaSeen = null; // what Ollama said last time: null (not asked), { ok, n } or { blocked }
  async function aiChip() {
    const el = $('st-ai'); if (!el) return; const f = window.CRAFTAI && CRAFTAI.found(), cl = ['anthropic', 'gemini', 'openai'].filter((k) => IC.cloud.has(k)).map((k) => IC.cloud.NAMES[k].split(' ')[0]);
    if (ollamaSeen === null) { ollamaSeen = 'asking'; IC.ollama.models().then((m) => { ollamaSeen = { ok: true, n: m.length }; aiChip(); }, (e) => { ollamaSeen = { blocked: !!e.blocked }; aiChip(); }); }
    const parts = [f ? (f.webgpu ? 'graphics card' : 'processor') : 'built-in', ollamaSeen && ollamaSeen.ok ? 'Ollama ✓' : ollamaSeen && ollamaSeen.blocked ? 'Ollama ✗' : 'Ollama …', cl.length ? `Cloud: ${cl.join(', ')}` : 'no cloud keys'];
    el.textContent = `AI: ${parts.join(' · ')}`;
  }
  let aiTab = 'local';
  async function openAI(tab) {
    if (tab) aiTab = tab; let back = $('aisettings'); if (!back) { back = document.createElement('div'); back.className = 'backdrop'; back.id = 'aisettings'; document.body.append(back); }
    const f = (await CRAFTAI.probe()) || {}, O = IC.ollama, CL = IC.cloud;
    back.innerHTML = `<div class="dialog wide" role="dialog" aria-modal="true" aria-labelledby="ais-title"><h2 id="ais-title">AI settings</h2>
      <div class="ai-tabs" role="tablist"><button type="button" data-tab="local" aria-selected="${aiTab === 'local'}">Local AI (this computer)</button><button type="button" data-tab="cloud" aria-selected="${aiTab === 'cloud'}">Cloud AI (your keys)</button></div><div id="ais-body"></div>
      <div class="dialog-actions"><button class="btn primary" type="button" data-act="close">Close</button></div></div>`;
    const body = back.querySelector('#ais-body');
    if (aiTab === 'local') {
      body.innerHTML = `<div class="ai-card"><h3>Built-in AI (runs inside ImageCraft)</h3><p class="hint">Upscaling, cut-outs, repair, scratches, colourising, faces, finding things by name. Each model downloads once when first used, then works offline; nothing is sent anywhere. This computer: ${f.webgpu ? `graphics card <b>${esc(f.gpu || '')}</b>` : 'no graphics card the browser can use (the processor is used, slower)'}.</p><div class="btns"><button class="btn outline" type="button" data-act="models">Models: download, switch on or off…</button></div></div>
        <div class="ai-card"><h3>Ollama (AI models you run yourself)</h3><p class="hint" id="ais-oll">Looking for Ollama at ${esc(O.cfg.url)}…</p>
          <label class="check"><input type="checkbox" data-oc ${O.cfg.cloud ? 'checked' : ''}> Also offer Ollama’s cloud models in Ask AI (the picture is sent to Ollama’s servers)</label>
          <label class="field"><span>Address</span><input class="input" data-ou value="${esc(O.cfg.url)}"></label></div>`;
      O.models().then((m) => { ollamaSeen = { ok: true, n: m.length }; aiChip(); const el = body.querySelector('#ais-oll'); if (el) el.innerHTML = m.length ? `<b>Connected.</b> Models that can look at pictures: ${m.map((x) => esc(x.name) + (x.cloud ? ' (cloud)' : '')).join(', ')}. Ask AI (Clean up) uses them.` : '<b>Connected</b>, but none of its models can look at pictures. In a command prompt: <code>ollama pull qwen3.5</code>.'; }, (e) => { ollamaSeen = { blocked: !!e.blocked }; aiChip(); const el = body.querySelector('#ais-oll'); if (el) el.innerHTML = `<b>Not reachable.</b> If Ollama is not running, start it. If it is: ${O.ORIGIN_HELP}`; });
    } else cloudKeysPanel(body);
    back.hidden = false;
    back.onclick = (e) => {
      const tb = e.target.closest('[data-tab]'); if (tb) { openAI(tb.dataset.tab); return; }
      const a = e.target.closest('[data-act]'); if (!a) return;
      if (a.dataset.act === 'close') { back.hidden = true; aiChip(); if (tool && /assess|regen/.test(tool.def.id)) { if (tool.oll) tool.oll = { status: 'checking' }; renderProps(); } }
      if (a.dataset.act === 'models') { back.hidden = true; CRAFTAI.openSettings(); }
    };
    back.onchange = (e) => { if (e.target.matches('[data-oc]')) { O.cfg.cloud = e.target.checked; O.save(); } if (e.target.matches('[data-ou]')) { O.cfg.url = e.target.value.trim().replace(/\/+$/, '') || 'http://127.0.0.1:11434'; O.save(); ollamaSeen = null; openAI('local'); } };
  }
  const lastDescription = new WeakMap(); // picture → its last Ask AI description (Regenerate starts from it)
  function cloudKeysPanel(into) {
    const CL = IC.cloud, d = document.createElement('div'); into.append(d);
    d.innerHTML = `<p class="hint">Your own keys for Claude (Anthropic), Gemini (Google) and GPT (OpenAI). With them, <b>Ask AI</b> can have a cloud model look at a picture, and <b>Regenerate</b> can have Gemini or OpenAI redraw it. The keys are kept only in this browser on this computer and are sent only to their own company, with each request you make. Each use is billed to your account by that company.</p>
      ${['anthropic', 'gemini', 'openai'].map((k) => `<label class="field"><span>${CL.NAMES[k]}${CL.has(k) ? ' · saved' : ''}</span><input class="input" type="password" autocomplete="off" spellcheck="false" data-k="${k}" placeholder="${CL.has(k) ? '•••••••• (saved; type to replace)' : 'paste the key here'}"></label>${k === 'anthropic' ? `<label class="field"><span>Claude workspace ID (only if Anthropic asks for it)</span><input class="input" autocomplete="off" spellcheck="false" data-ws value="${esc(CL.cfg.workspace || '')}" placeholder="wrkspc_…"></label>` : ''}`).join('')}
      <div class="btns"><button class="btn primary" type="button" data-a="save">Save the keys</button><button class="btn outline" type="button" data-a="test">Test them</button><button class="btn outline" type="button" data-a="activity" title="Every call this session: what was sent and what came back">Cloud activity</button><button class="btn outline" type="button" data-a="trial" title="One small call of each cloud tool on the sample picture (a few cents in all): a report to copy">Try the cloud tools</button><button class="btn outline" type="button" data-a="forget">Forget all keys</button></div><div class="hint" id="ck-out"></div>`;
    d.onclick = async (e) => {
      const a = e.target.dataset.a; if (!a) return; const out = d.querySelector('#ck-out');
      if (a === 'save') { d.querySelectorAll('[data-k]').forEach((i) => { if (i.value.trim()) CL.cfg.keys[i.dataset.k] = i.value.trim(); i.value = ''; }); const ws = d.querySelector('[data-ws]'); if (ws) CL.cfg.workspace = ws.value.trim(); CL.save(); toast('Keys saved in this browser.'); aiChip(); if ($('aisettings') && !$('aisettings').hidden) openAI('cloud'); else renderProps(); }
      if (a === 'forget') { if (await ask('Forget the keys?', 'ImageCraft will forget all three keys in this browser. The keys themselves stay valid at each company.', 'Forget')) { CL.cfg.keys = { anthropic: '', gemini: '', openai: '' }; CL.save(); aiChip(); if ($('aisettings') && !$('aisettings').hidden) openAI('cloud'); else renderProps(); } }
      if (a === 'trial') { out.textContent = 'Trying each cloud tool on the sample picture (one call each; a minute or two)…'; const rep = await cloudTrial((m) => { out.textContent = m; }); out.innerHTML = `<pre style="white-space:pre-wrap;user-select:text;margin:6px 0">${esc(rep)}</pre><button class="btn outline" type="button" data-a="copyrep">Copy the report</button>`; out.dataset.rep = rep; }
      if (a === 'activity') openCloudLog();
      if (a === 'copyrep') navigator.clipboard.writeText(out.dataset.rep || '').then(() => toast('Report copied.'), () => toast('Could not copy.'));
      if (a === 'test') { out.textContent = 'Testing…'; const lines = []; for (const k of ['anthropic', 'gemini', 'openai']) { if (!CL.has(k)) continue; try { const m = await CL.models(k); lines.push(`${CL.NAMES[k]}: works · ${m.filter((x) => x.see).length} models can look at pictures${m.some((x) => x.draw) ? `, ${m.filter((x) => x.draw).length} can draw` : ''}`); } catch (err) { lines.push(err.message.startsWith(CL.NAMES[k]) ? err.message : `${CL.NAMES[k]}: ${err.message}`); } } out.innerHTML = lines.map(esc).join('<br>') || 'No keys saved yet.'; }
    };
  }
  // one small call of each cloud tool on a small copy of the sunset sample, timed; a report (no keys in it)
  // ------------------------------------------------------------------ Cloud activity: what was sent, what came back
  function openCloudLog() { let back = $('cloudlog'); if (!back) { back = document.createElement('div'); back.className = 'backdrop'; back.id = 'cloudlog'; document.body.append(back); back.onclick = (e) => { if (e.target === back || e.target.closest('[data-act=close]')) back.hidden = true; const v = e.target.closest('[data-view]'); if (v) { const w = window.open(); if (w) { w.document.title = 'Cloud picture'; w.document.body.style.cssText = 'margin:0;background:#222;display:grid;place-items:center;min-height:100vh'; const i = w.document.createElement('img'); i.src = v.dataset.view; i.style.maxWidth = '100%'; w.document.body.append(i); } } }; } back.hidden = false; drawCloudLog(); }
  function drawCloudLog() {
    const back = $('cloudlog'), L = IC.cloud.log, pic = (src, cap) => `<figure class="cl-pic"><img src="${esc(src)}" alt="" data-view="${esc(src)}" title="Click to see it full size"><figcaption>${esc(cap)}</figcaption></figure>`, kb = (n) => (n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1000)) + ' KB');
    back.innerHTML = `<div class="dialog wide" role="dialog" aria-modal="true" aria-labelledby="cl-title"><h2 id="cl-title">Cloud activity</h2><p class="hint">Every call to a cloud service this session, newest first: what was sent (the picture as the service got it, and the instructions) and what came back. Keys are never shown or kept here. ${L.length ? '' : '<b>Nothing has been sent yet.</b>'}</p>
      <div class="cl-list">${L.map((e) => `<div class="ai-card cl-${e.state}"><h3>${esc(e.task || 'Call')} · ${esc(IC.cloud.NAMES[e.who])}${e.model ? ` · <code>${esc(e.model)}</code>` : ''} <span class="hint">${new Date(e.at).toLocaleTimeString()} · ${e.state === 'sending' ? 'sending…' : `${e.secs.toFixed(1)} s · ${e.state === 'done' ? 'OK' : 'FAILED'}`} · sent ${kb(e.sent.bytes)}${e.backBytes ? `, back ${kb(e.backBytes)}` : ''}${e.usage ? ` · ${esc(Object.entries(e.usage).filter(([, v]) => typeof v === 'number').map(([k, v]) => `${k.replace(/_/g, ' ').replace(/Count$/, '')} ${v}`).join(', '))}` : ''}</span></h3>
        <div class="cl-row"><div><b>Sent</b><div class="cl-pics">${e.sent.pics.map((p, i) => pic(p.url || p, p.label === 'mask' ? 'mask (clear = change)' : `picture ${i + 1}`)).join('') || '<span class="hint">no picture</span>'}</div><details><summary>Instructions</summary><pre>${esc(e.sent.text || '(none)')}</pre></details></div>
        <div><b>Came back</b>${e.state === 'failed' ? `<p class="cl-err">${esc(e.error || '')}</p>` : e.back ? `<div class="cl-pics">${e.back.pics.map((p, i) => pic(p, `result ${i + 1}`)).join('')}</div>${e.back.text ? `<details${e.back.pics.length ? '' : ' open'}><summary>Answer</summary><pre>${esc(e.back.text.length > 6000 ? e.back.text.slice(0, 6000) + '…' : e.back.text)}</pre></details>` : ''}` : '<p class="hint">waiting…</p>'}</div></div></div>`).join('')}</div>
      <div class="dialog-actions"><button class="btn primary" type="button" data-act="close">Close</button></div></div>`;
  }
  // ------------------------------------------------------------------ comparing the built-in maps with the cloud's
  function openLayerCompare() {
    const p = pic(), img = now(); let back = $('layercmp'); if (!back) { back = document.createElement('div'); back.className = 'backdrop'; back.id = 'layercmp'; document.body.append(back); back.onclick = (e) => { if (e.target === back || e.target.closest('[data-act=close]')) back.hidden = true; const o = e.target.closest('[data-open]'); if (o) { back.hidden = true; openMap(o.dataset.open, 'heat'); } }; }
    const k = Math.min(1, 360 / Math.max(img.width, img.height)), sm = X.resize(img, { width: Math.round(img.width * k), height: Math.round(img.height * k) }), W = sm.width, H = sm.height;
    const scaleMap = (m) => { const o = new Float32Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) o[y * W + x] = m[Math.min(img.height - 1, Math.floor(((y + 0.5) * img.height) / H)) * img.width + Math.min(img.width - 1, Math.floor(((x + 0.5) * img.width) / W))]; return o; };
    const cv = (data) => { const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').putImageData(data, 0, 0); return c.toDataURL('image/jpeg', 0.85); };
    const cover = (m) => m ? (m.reduce((a, v) => a + (v > 0.5 ? 1 : 0), 0) / m.length * 100).toFixed(1) + '%' : '';
    // every layer at once, each in its own colour over the picture
    const COL = { sky: [80, 160, 255], skin: [255, 150, 110], green: [60, 200, 70], subject: [255, 220, 0], 'cl:hair': [150, 80, 40], 'cl:clothing': [200, 60, 220], 'cl:damage': [255, 0, 0] };
    const all = new ImageData(new Uint8ClampedArray(sm.data), W, H);
    const rows = CLOUD_LAYERS.map((l) => { const id = l[2], f = p.mapFix && p.mapFix[id], cloud = f && f.by ? scaleMap(IC.maps.make(id, img)) : null, rawFull = id.startsWith('cl:') ? null : IC.maps.makeRaw(id, img), raw = rawFull ? scaleMap(rawFull) : null;
      if (cloud && COL[id]) { const c = COL[id]; for (let i = 0; i < W * H; i++) if (cloud[i] > 0.5) { const d = all.data; d[i * 4] = d[i * 4] * 0.45 + c[0] * 0.55; d[i * 4 + 1] = d[i * 4 + 1] * 0.45 + c[1] * 0.55; d[i * 4 + 2] = d[i * 4 + 2] * 0.45 + c[2] * 0.55; } }
      let agree = ''; if (cloud && raw) { let a = 0, u = 0; for (let i = 0; i < W * H; i++) { const x = cloud[i] > 0.5, y = raw[i] > 0.5; if (x && y) a++; if (x || y) u++; } agree = u ? `${Math.round((a / u) * 100)}% the same` : ''; }
      const name = l[3] || { sky: 'Sky', skin: 'Skin', green: 'Greenery', subject: 'Main subject' }[l[0]];
      return `<div class="lc-row"><b>${esc(name)}</b><figure class="cl-pic"><img src="${raw ? cv(IC.maps.heat(raw, sm)) : ''}" alt="" ${raw ? '' : 'hidden'}>${raw ? '' : `<span class="hint">${id.startsWith('cl:') ? 'no built-in version: only the cloud maps this' : 'not measured built-in yet (open it in Maps first)'}</span>`}<figcaption>Built-in ${cover(raw)}</figcaption></figure><figure class="cl-pic"><img src="${cloud ? cv(IC.maps.heat(cloud, sm)) : ''}" alt="" ${cloud ? '' : 'hidden'}>${cloud ? '' : '<span class="hint">the cloud found none</span>'}<figcaption>Cloud ${cover(cloud)}</figcaption></figure><span class="hint">${agree}</span><button class="btn outline" type="button" data-open="${esc(id)}">Open, correct</button></div>`; });
    back.innerHTML = `<div class="dialog wide" role="dialog" aria-modal="true" aria-labelledby="lc-title"><h2 id="lc-title">Built-in and cloud layers</h2><p class="hint">Mapped by ${esc(IC.cloud.NAMES[p.cloudMapped.by])} in ${p.cloudMapped.secs.toFixed(0)} s. Left: what ImageCraft measured on its own; right: the cloud's layer, which every tool now uses. “The same” is how much the two agree. What was sent is in Cloud activity (☁ in the status bar).</p>
      <div class="lc-all"><img src="${cv(all)}" alt="All the cloud layers over the picture"><div class="hint">${Object.entries(COL).map(([id, c]) => `<span><i style="background:rgb(${c})"></i>${esc({ sky: 'Sky', skin: 'Skin', green: 'Greenery', subject: 'Main subject', 'cl:hair': 'Hair', 'cl:clothing': 'Clothing', 'cl:damage': 'Damage' }[id])}</span>`).join(' ')}</div></div>
      <div class="lc-list">${rows.join('')}</div><div class="dialog-actions"><button class="btn outline" type="button" onclick="document.getElementById('st-cloud').click()">Cloud activity</button><button class="btn primary" type="button" data-act="close">Close</button></div></div>`;
    back.hidden = false;
  }
  async function cloudTrial(say) {
    IC.cloud.task('Try the cloud tools');
    const CL = IC.cloud, lines = [`ImageCraft cloud trial ${new Date().toISOString().slice(0, 16)} · switch: ${aiMode}`], c = document.createElement('canvas'); c.width = 512; c.height = 340;
    const g = c.getContext('2d'), sky = g.createLinearGradient(0, 0, 0, 340); sky.addColorStop(0, '#1d2b64'); sky.addColorStop(0.6, '#f8b26a'); g.fillStyle = sky; g.fillRect(0, 0, 512, 340); g.fillStyle = '#fff3c4'; g.beginPath(); g.arc(300, 230, 40, 0, 7); g.fill(); g.fillStyle = '#3b2a4a'; g.beginPath(); g.moveTo(0, 260); g.bezierCurveTo(120, 200, 260, 300, 512, 240); g.lineTo(512, 340); g.lineTo(0, 340); g.fill();
    const img = g.getImageData(0, 0, 512, 340), grey = X.greyscale(img), hole = new Float32Array(512 * 340); for (let y = 150; y < 210; y++) for (let x = 80; x < 170; x++) hole[y * 512 + x] = 1;
    const run = async (label, fn) => { say(`${label}…`); const t0 = performance.now(); try { const r = await fn(); lines.push(`OK   ${label}: ${((performance.now() - t0) / 1000).toFixed(1)} s${r ? ' · ' + r : ''}`); } catch (e) { lines.push(`FAIL ${label}: ${((performance.now() - t0) / 1000).toFixed(1)} s · ${String(e.message || e).slice(0, 300)}`); } };
    for (const p of ['anthropic', 'gemini', 'openai'].filter((k) => CL.has(k))) await run(`describe (${p})`, async () => { const ms = (await CL.models(p)).filter((x) => x.see && !x.draw); const m = p === 'gemini' ? await CL.seeModel(p) : (ms.find((x) => /sonnet|gpt-4\.1|gpt-4o|gpt-5/.test(x.id)) || ms[0] || {}).id; const a = await CL.describe(img, p, m); return `${m}: "${String(a.subject).slice(0, 80)}"`; });
    for (const p of CL.engines('fill')) await run(`repair fill (${p})`, async () => { const m = await CL.drawModel(p), o = await CL.fill(img, hole, p, m), edge = IC.maps.grow(hole, 512, 340, 6); let d = 0, n = 0, out = 0; for (let i = 0; i < hole.length; i++) { const e = Math.abs(o.data[i * 4] - img.data[i * 4]) + Math.abs(o.data[i * 4 + 1] - img.data[i * 4 + 1]); if (hole[i]) { d += e; n++; } else if (!edge[i]) out += e; } return `${m}: inside changed ${(d / n).toFixed(0)}, beyond the soft edge ${out === 0 ? 'untouched' : 'CHANGED ' + out}`; });
    for (const p of CL.engines('colour')) await run(`colourise (${p})`, async () => { const m = await CL.drawModel(p), o = await CL.colourise(grey, p, m, {}); let s = 0; for (let i = 0; i < o.data.length; i += 4) s += Math.max(o.data[i], o.data[i + 1], o.data[i + 2]) - Math.min(o.data[i], o.data[i + 1], o.data[i + 2]); return `${m}: average colourfulness ${(s / (o.data.length / 4)).toFixed(0)}`; });
    if (CL.engines('masks').length) await run('find "the sun" (gemini masks)', async () => { const m = await CL.seeModel('gemini'), map = await CL.segment(img, 'the sun', m); let n = 0, cx = 0, cy = 0; for (let i = 0; i < map.length; i++) if (map[i] > 0.5) { n++; cx += i % 512; cy += (i / 512) | 0; } return `${m}: ${n} px at ${n ? Math.round(cx / n) + ',' + Math.round(cy / n) : '-'} (the sun is at 300,230)`; });
    lines.push('Paste this report to Claude. It contains no keys.');
    return lines.join('\n');
  }
  const regenModels = {}; // provider → the models that can draw (asked once)
  function regenPanel(into, t) {
    const CL = IC.cloud, s = t.s, d = document.createElement('div'); into.append(d);
    if (!cloudOK()) { d.innerHTML = '<p class="hint"><b>Cloud AI is switched off</b> (the Local AI / Cloud AI switch in the status bar). Regenerate sends the picture to Gemini or OpenAI, so it needs Cloud AI or Both.</p>'; return; }
    const provs = ['gemini', 'openai'].filter((k) => CL.has(k));
    if (!provs.length) { d.innerHTML = '<p class="hint">Regenerate sends the picture to Gemini or OpenAI and gets back a redrawn, restored version. It needs your own key: add one in <b>AI settings › Cloud AI</b> (the AI button in the status bar).</p>'; return; }
    if (!provs.includes(s.provider)) s.provider = provs[0];
    const ms = regenModels[s.provider];
    if (!ms) { regenModels[s.provider] = 'loading'; CL.models(s.provider).then((m) => { regenModels[s.provider] = m.filter((x) => x.draw); if (tool === t) renderProps(); }, (e) => { regenModels[s.provider] = { err: e.message }; if (tool === t) renderProps(); }); }
    const list = Array.isArray(ms) ? ms : []; if (list.length && !list.some((x) => x.id === s.model)) s.model = (list.find((x) => /flash-image|gpt-image-1\b/.test(x.id)) || list[0]).id;
    d.innerHTML = `<p class="hint"><b>The whole picture is redrawn</b> by a cloud image model, guided by a description: tears, scratches, blur and fading are fixed, and missing parts are drawn in. It can look far better than any careful repair, but <b>everything in it is drawn by the AI</b>: faces and details can change. It opens as a new picture, the same size as the original, to compare with it or to blend parts back (Detail › Blend a version). <b>The picture is sent to ${esc(CL.NAMES[s.provider])}</b> and billed to your key.</p>
      <div class="field"><span>Who redraws it</span><div class="seg">${provs.map((k) => `<button type="button" class="btn" data-rp="${k}" aria-pressed="${k === s.provider}">${CL.NAMES[k]}</button>`).join('')}</div></div>
      <label class="field"><span>Model</span><select class="input" data-rm>${ms === 'loading' || !ms ? '<option>Asking which models can draw…</option>' : ms.err ? `<option>${esc(ms.err)}</option>` : list.length ? list.map((x) => `<option value="${esc(x.id)}" ${x.id === s.model ? 'selected' : ''}>${esc(x.name)}</option>`).join('') : '<option>This key has no models that can draw</option>'}</select></label>
      <label class="field"><span>What it shows (helps it keep the right things; Ask AI fills this in)</span><textarea class="input" rows="3" data-rt>${esc(s.text)}</textarea></label>
      <label class="check"><input type="checkbox" data-rc ${s.colour ? 'checked' : ''}> Give it natural colour (for black and white or sepia)</label><p class="hint">Press Preview.</p>`;
    d.onclick = (e) => { const b = e.target.closest('[data-rp]'); if (b) { s.provider = b.dataset.rp; s.model = ''; renderProps(); } };
    d.onchange = (e) => { if (e.target.matches('[data-rm]')) s.model = e.target.value; if (e.target.matches('[data-rc]')) s.colour = e.target.checked; t.stale = true; };
    d.oninput = (e) => { if (e.target.matches('[data-rt]')) { s.text = e.target.value; t.stale = true; } };
  }
  function assessPanel(into, t) {
    const O = IC.ollama, CL = IC.cloud, st = (t.oll = t.oll || { status: 'checking' }), el = document.createElement('div'); into.append(el);
    const again = () => { if (tool === t) renderProps(); };
    const cloudKeys = cloudOK() ? ['anthropic', 'gemini', 'openai'].filter((k) => CL.has(k)) : [];
    let prov = O.cfg.provider && O.cfg.provider !== 'ollama' && cloudKeys.includes(O.cfg.provider) ? O.cfg.provider : 'ollama'; if (!localOK() && prov === 'ollama' && cloudKeys.length) prov = cloudKeys[0];
    if (cloudKeys.length) { const d = document.createElement('div'); d.className = 'field'; d.innerHTML = `<span>Who looks at it</span><div class="seg">${[...(localOK() || !cloudKeys.length ? [['ollama', 'Ollama']] : []), ...cloudKeys.map((k) => [k, CL.NAMES[k].split(' ')[0]])].map(([k, l]) => `<button type="button" class="btn" data-pv="${k}" aria-pressed="${k === prov}">${l}</button>`).join('')}</div>`; d.onclick = (e) => { const b = e.target.closest('[data-pv]'); if (!b) return; O.cfg.provider = b.dataset.pv; O.save(); t.oll = { status: 'checking' }; again(); }; el.append(d); }
    if (prov !== 'ollama') {
      // a cloud service: its own list of models that can see pictures
      if (st.status === 'checking' && !st.started) { st.started = true; CL.models(prov).then((m) => { st.models = m.filter((x) => x.see).map((x) => ({ name: x.id, label: x.name, cloud: true })); st.status = st.models.length ? 'ok' : 'none'; const want = CL.cfg.models[prov]; O.cfg.model = want && st.models.some((x) => x.name === want) ? want : (st.models.find((x) => /sonnet|flash|gpt-5|gpt-4o|4\.1/.test(x.name)) || st.models[0] || {}).name || ''; again(); }, (e) => { st.status = 'error'; st.err = e.message; again(); }); }
    }
    else if (st.status === 'checking' && !st.started) { st.started = true; O.models().then((m) => { st.models = m; st.status = m.length ? 'ok' : 'none'; if (!O.cfg.model || !m.some((x) => x.name === O.cfg.model)) O.cfg.model = m.length ? m[0].name : ''; again(); }, (e) => { st.status = e.blocked ? 'blocked' : 'error'; st.err = e.message; again(); }); }
    const p = (h) => { const d = document.createElement('div'); d.innerHTML = h; el.append(d); return d; };
    p(prov === 'ollama' ? '<p class="hint">A vision model running in <b>Ollama</b> on this computer looks at the picture and says what it is and what is wrong with it. It only describes: ImageCraft’s own tools do the work, as steps you can undo. Nothing leaves this computer (unless you allow Ollama’s cloud models).</p>' : `<p class="hint"><b>${esc(CL.NAMES[prov])}</b> looks at the picture and says what it is and what is wrong with it. <b>The picture is sent to ${esc(CL.NAMES[prov].replace(/.*\((.*)\)/, '$1'))}</b> with your key. It only describes: ImageCraft’s own tools do the work, as steps you can undo.</p>`);
    if (st.status === 'checking') { p('<p class="hint">Looking for Ollama…</p>'); return; }
    if (st.status === 'blocked') { p(`<p class="hint"><b>Could not reach Ollama</b> at ${esc(O.cfg.url)}. If it is not running, start it. If it is running:</p><p class="hint">${O.ORIGIN_HELP}</p>`); }
    if (st.status === 'error') p(`<p class="hint"><b>Ollama:</b> ${esc(st.err)}</p>`);
    if (st.status === 'none' && prov === 'ollama') p('<p class="hint">Ollama is running, but none of its models can see pictures. In a command prompt: <code>ollama pull qwen3.5</code> (about 6.6 GB; good at counting faces and naming colours and materials) or <code>ollama pull gemma3</code> (3.3 GB, quicker).</p>');
    if (prov !== 'ollama' && st.status === 'none') p('<p class="hint">That key has no models that can look at pictures.</p>');
    if (st.status === 'blocked' || st.status === 'error' || st.status === 'none') {
      const b = p('<div class="btns"><button class="btn outline" type="button">Try again</button></div>'); b.querySelector('button').onclick = () => { t.oll = { status: 'checking' }; again(); }; return;
    }
    const lab = document.createElement('label'); lab.className = 'field'; lab.innerHTML = '<span>Model</span>'; const sel = document.createElement('select'); sel.className = 'input';
    st.models.forEach((m) => sel.add(new Option(prov !== 'ollama' ? m.label || m.name : m.cloud ? `${m.name} (cloud: the picture is sent to Ollama)` : `${m.name} (${m.gb.toFixed(1)} GB)`, m.name))); sel.value = O.cfg.model; sel.onchange = () => { O.cfg.model = sel.value; if (prov !== 'ollama') { CL.cfg.models[prov] = sel.value; CL.save(); } O.save(); }; lab.append(sel); el.append(lab);
    const cl = prov !== 'ollama' || !cloudOK() ? null : p(`<label class="check"><input type="checkbox" ${O.cfg.cloud ? 'checked' : ''}> Allow cloud models (bigger and sharper-eyed, but <b>the picture is sent to Ollama’s servers</b>; your Ollama cloud plan)</label>`); if (cl) cl.querySelector('input').onchange = (e) => { O.cfg.cloud = e.target.checked; O.save(); t.oll = { status: 'checking' }; again(); };
    const look = p('<div class="btns"><button class="btn primary" type="button">Look at the picture</button></div>').querySelector('button');
    look.onclick = async () => {
      const img = t.base; busyNow('Asking Ollama…');
      try { if (prov !== 'ollama') busyNow(`${CL.NAMES[prov]} is looking at the picture…`); st.result = prov !== 'ollama' ? await CL.describe(img, prov, sel.value) : await O.assess(img, { model: sel.value, onStep: (m) => { if (tool === t) busyNow(m); } }); lastDescription.set(pic(), st.result); st.steps = O.recipe(st.result, img); ICLOG.add('info', `Ask AI: ${st.result.model} took ${st.result.seconds.toFixed(0)} s`); }
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
      try { const base = typeof def.s === 'function' ? def.s(img) : JSON.parse(JSON.stringify(def.s)); const t0 = performance.now(), sx = cloudAuto(s0.id, { ...base, ...s0.s }), out = await def.run(img, sx, (m) => busyNow(m)); await pushDeep(def.title, out, (im) => def.run(im, sx), performance.now() - t0, null, { id: s0.id, s: sx }); }
      catch (e) { busy(null); logFail(`${def.title} failed`, e); toast(`${def.title}: ${e.message}`); return; }
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
      await wait(0); const t0 = performance.now(); if (t.s.wMap) await IC.maps.prepare([t.s.wMap, t.s.wOp ? t.s.wMap2 : ''], t.base); const r0 = await t.def.run(t.base, t.s, etaSay((m) => { if (my === token) busyNow(m); })), r = masked(t, r0);
      if (my !== token || tool !== t) return;
      if (infoTab === 'working') setTimeout(renderInfo, 0);
      t.ms = performance.now() - t0; ICLOG.info(`${t.def.title}: ${t.base.width} × ${t.base.height} → ${r.width} × ${r.height} in ${Math.round(t.ms)} ms`, JSON.stringify(t.s).slice(0, 400));
      const sizeChanged = !t.preview ? r.width !== t.base.width || r.height !== t.base.height : r.width !== t.preview.width || r.height !== t.preview.height;
      t.out = r; t.preview = t.showMask && t.s.wMap ? IC.maps.grey(maskOf(t), t.base.width, t.base.height) : r; busy(null); show(); if (sizeChanged && view.fit) fitView(); renderOut();
    } catch (e) { logFail(`${t.def.title} failed`, e); if (my === token) { busy(null); toast(e.message || String(e)); } }
  }
  async function applyTool() {
    const t = tool; if (!t) return;
    if (t.def.viewOnly) { closeTool(); return; }
    if (t.def.final) { const r = masked(t, await t.def.final(t.base, t.s)); closeTool(true); push(t.def.title + (t.s.wMap ? ' (masked)' : ''), r); return; }
    if (t.def.id === 'crop' || !t.preview || t.stale) { await runPreview(); if (tool !== t || !t.preview) return; }
    if (t.def.id === 'split') { if (!t.outputs || t.stale) { await runPreview(); if (tool !== t || !t.outputs) return; } const nm = baseName(pic().name), outs = t.outputs; closeTool(true); outs.forEach(([k, im, bits]) => addPic(`${nm} – ${k}.png`, im, { format: k === 'subject' ? 'Subject (cut out)' : 'Background', bits })); toast('The subject and the background are open as two pictures: restore each, then put them back with Detail › Blend a version.'); return; }
    if (t.def.toNew) { if (!t.out && !t.preview) { await runPreview(); if (tool !== t) return; } const r = t.out || t.preview, nm = `${baseName(pic().name)} – ${t.def.toNew}.png`; closeTool(true); addPic(nm, r, { format: t.def.title, bits: 24 }); toast(`The ${t.def.toNew} picture is open as a new picture.`); return; }
    const r = t.out || t.preview, mk = t.s && t.s.wMap && r.width === t.base.width && r.height === t.base.height ? maskOf(t) : null, s0 = JSON.parse(JSON.stringify(t.s || {})); closeTool(true);
    await pushDeep(t.def.title + (t.s && t.s.wMap ? ' (masked)' : ''), r, (im) => t.def.run(im, s0), t.ms || 1e9, mk, t.def.paint || t.def.pick ? null : { id: t.def.id, s: s0 }); busy(null);
  }
  // a tool that needs no settings: done at once, as a step
  // the quick actions a recipe can name
  const QUICK = { 'Auto levels': (i) => X.autoLevels(i), 'Auto fix': (i) => X.autoFix(i), Greyscale: (i) => X.greyscale(i), Invert: (i) => X.invert(i), 'Turn left': (i) => X.rotate90(i, 270), 'Turn right': (i) => X.rotate90(i, 90), 'Turn upside down': (i) => X.rotate90(i, 180), 'Flip across': (i) => X.flip(i, true), 'Flip up and down': (i) => X.flip(i, false) };
  function quick(label, fn) {
    if (!pic()) { toast('Open a picture first.'); return; }
    if (tool) closeTool(true);
    busyNow(`${label}…`);
    setTimeout(async () => { const t0 = performance.now(); try { const out = await fn(now()), ms = performance.now() - t0; await pushDeep(label, out, fn, ms, null, QUICK[label] ? { quick: label } : null); ICLOG.info(`${label} in ${Math.round(ms)} ms`); } catch (e) { logFail(`${label} failed`, e); toast(e.message); } busy(null); }, 20);
  }

  // ------------------------------------------------------------------ the right-hand panel
  function renderProps() {
    if (infoTab === 'working') setTimeout(renderInfo, 0); // the Working tab shows the open tool
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
  // ------------------------------------------------------------------ recipes (the steps in History, saved and run again)
  // A recipe is the list of steps that made a picture, each a tool and its settings (or a quick action), saved as a
  // small .json file. It can be run on another picture, or on every open picture: the tools measure each picture
  // themselves (noise, blur, blocks), so one recipe suits a whole box of similar old photos.
  function recipeOf(p) {
    const steps = p.steps.slice(1, p.at + 1), list = steps.filter((st) => st.how).map((st) => ({ label: st.label, ...st.how })), skipped = steps.length - list.length;
    return { app: 'ImageCraft', kind: 'recipe', version: 1, made: new Date().toISOString().slice(0, 10), from: baseName(p.name), steps: list, skipped };
  }
  async function runRecipe(rec, say) {
    if (!rec || rec.kind !== 'recipe' || !Array.isArray(rec.steps)) throw new Error('That is not an ImageCraft recipe.');
    let n = 0;
    for (const st of rec.steps) {
      const img = now(); say && say(`${st.label} (${++n} of ${rec.steps.length})…`); await wait(0); const t0 = performance.now();
      if (st.quick) { const fn = QUICK[st.quick]; if (!fn) throw new Error(`Unknown quick action “${st.quick}”.`); const out = await fn(img); await pushDeep(st.label, out, fn, performance.now() - t0, null, { quick: st.quick }); continue; }
      const def = TOOLS[st.id]; if (!def || def.viewOnly) throw new Error(`Unknown tool “${st.id}”.`);
      const base = typeof def.s === 'function' ? def.s(img) : JSON.parse(JSON.stringify(def.s)), s = cloudAuto(st.id, { ...base, ...st.s });
      if (s.wMap) await IC.maps.prepare([s.wMap, s.wOp ? s.wMap2 : ''], img);
      const r0 = await def.run(img, s, (m) => say && say(`${st.label}: ${m}`)), mk = s.wMap && r0.width === img.width && r0.height === img.height ? IC.maps.mask(img, { map: s.wMap, map2: s.wOp ? s.wMap2 : '', op: s.wOp, invert: s.wInvert, level: s.wLevel, softness: s.wSoft, feather: s.wFeather }) : null;
      await pushDeep(st.label, mk ? IC.maps.apply(img, r0, mk) : r0, (im) => def.run(im, s), performance.now() - t0, mk, { id: st.id, s: st.s });
    }
  }
  function saveRecipe() {
    const p = pic(); if (!p) return; const rec = recipeOf(p); if (!rec.steps.length) return toast('There are no steps to save yet (painted repairs and clicked cut-outs cannot be repeated).');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(rec, null, 1)], { type: 'application/json' })); a.download = `${baseName(p.name)} recipe.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast(`Recipe saved: ${rec.steps.length} step${rec.steps.length === 1 ? '' : 's'}${rec.skipped ? ` (${rec.skipped} painted or clicked step${rec.skipped === 1 ? '' : 's'} left out)` : ''}.`);
  }
  async function useRecipe(rec, all) {
    const list = all ? pics.map((p, i) => i) : [cur]; let done = 0;
    for (const i of list) { if (all && pics[i] === rec.__from) continue; select(i); try { await runRecipe(rec, (m) => busyNow(`${pics[i].name}: ${m}`)); done++; } catch (e) { busy(null); ICLOG.error('Recipe failed', e); toast(e.message); return; } }
    busy(null); toast(`Recipe run on ${done} picture${done === 1 ? '' : 's'}. Each step is in its History.`);
  }
  function openRecipe(all) {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = async () => { const f = inp.files[0]; if (!f) return; try { const rec = JSON.parse(await f.text()); await useRecipe(rec, all); } catch (e) { toast(e.message.startsWith('That') ? e.message : 'That file could not be read as a recipe.'); } };
    inp.click();
  }
  // ------------------------------------------------------------------ the info box (bottom left): Original, Current, Saved, Working
  let infoTab = 'current', infoFolded = false; try { infoTab = localStorage.getItem('imagecraft-infotab') || 'current'; infoFolded = localStorage.getItem('imagecraft-infofold') === '1'; } catch (e) { /* blocked storage */ }
  const thumbOf = (img) => { const k = Math.min(1, 280 / img.width, 120 / img.height), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k)); const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(X.canvasOf(img), 0, 0, c.width, c.height); return c; };
  const savedAt = (p) => (p.saved && p.steps.includes(p.saved.step) ? p.steps.indexOf(p.saved.step) : -1); // -1: not saved (or what was saved has been undone past)
  function renderInfo() {
    const box = $('infobox'), p = pic(); if (!box) return; if (!p) { box.hidden = true; return; } box.hidden = false;
    const tabs = [['original', 'Original'], ['current', 'Current'], ['saved', 'Saved'], ['working', 'Working']];
    box.className = 'infobox' + (infoFolded ? ' folded' : '');
    box.innerHTML = `<div class="ib-tabs">${infoFolded ? '<button type="button" data-ib="unfold" title="Show the picture details">ⓘ Details</button>' : tabs.map(([k, l]) => `<button type="button" data-ib="${k}" aria-selected="${k === infoTab}">${l}</button>`).join('') + '<button type="button" class="ib-fold" data-ib="fold" title="Fold away">–</button>'}</div>${infoFolded ? '' : '<div class="ib-body"></div>'}`;
    box.onclick = (e) => { const b = e.target.closest('[data-ib]'); if (!b) return; const k = b.dataset.ib; if (k === 'fold' || k === 'unfold') infoFolded = k === 'fold'; else if (k === 'measure0' || k === 'measure') { measureFor(p, k === 'measure0'); return; } else infoTab = k; try { localStorage.setItem('imagecraft-infotab', infoTab); localStorage.setItem('imagecraft-infofold', infoFolded ? '1' : '0'); } catch (err) { /* blocked storage */ } renderInfo(); };
    if (infoFolded) return;
    const body = box.querySelector('.ib-body'), s0 = p.steps[0], st = p.steps[p.at], sa = savedAt(p), steps = (a, b) => p.steps.slice(a, b + 1).map((x) => `<li>${esc(x.label)}</li>`).join('');
    const findings = (list) => (list ? `<ul class="ib-findings">${list.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : '');
    if (infoTab === 'original') {
      body.append(thumbOf(s0.img)); body.insertAdjacentHTML('beforeend', `<dl><dt>File</dt><dd>${esc(p.name)}</dd><dt>Format</dt><dd>${esc(p.info.format || '')}${p.info.bits ? ` · ${p.info.bits}-bit` : ''}${s0.deep ? ' · 16 bits kept' : ''}</dd><dt>Size</dt><dd>${fmtN(s0.img.width)} × ${fmtN(s0.img.height)} px${p.size ? ` · ${kb(p.size)}` : ''}</dd>${s0.colours != null ? `<dt>Colours</dt><dd>${s0.colours < 0 ? 'many' : fmtN(s0.colours)}</dd>` : ''}</dl>${p.measured0 ? findings(p.measured0) : '<div class="btns" style="margin-top:6px"><button class="btn outline" type="button" data-ib="measure0">Measure the original</button></div>'}`);
    } else if (infoTab === 'current') {
      body.append(thumbOf(st.img)); body.insertAdjacentHTML('beforeend', `<dl><dt>Size</dt><dd>${fmtN(st.img.width)} × ${fmtN(st.img.height)} px</dd><dt>Colours</dt><dd>${st.colours == null ? 'counting…' : st.colours < 0 ? 'many' : fmtN(st.colours)}</dd><dt>Depth</dt><dd>${st.deep ? '16 bits per colour' : '8 bits per colour'}</dd><dt>Steps</dt><dd>${p.at} since the original${p.at < p.steps.length - 1 ? ` (${p.steps.length - 1 - p.at} undone)` : ''}</dd><dt>State</dt><dd>${p.dirty ? 'changed, not saved' : sa >= 0 ? 'saved' : 'as opened'}</dd></dl>${st.measured ? findings(st.measured) : '<div class="btns" style="margin-top:6px"><button class="btn outline" type="button" data-ib="measure">Measure it now</button></div>'}`);
    } else if (infoTab === 'saved') {
      body.innerHTML = sa < 0 ? `<p class="ib-note">${p.saved ? 'What was saved has since been undone.' : 'Not saved yet.'} Save as… keeps what is done so far; the steps that went into it are listed here.</p>` : `<dl><dt>Saved as</dt><dd>${esc(p.saved.name)}</dd><dt>When</dt><dd>${p.saved.when.toLocaleString()}</dd></dl><p class="ib-note">From the original to what was saved:</p><ol>${steps(1, sa) || '<li>(no changes: saved as opened)</li>'}</ol>`;
    } else {
      const from = Math.max(1, sa + 1), open = tool && !tool.def.viewOnly ? `<p class="ib-note"><b>Open now:</b> ${esc(tool.def.title)}${tool.preview ? ' (previewed, not applied yet: press Apply to keep it)' : ' (not applied yet)'}.</p>` : '';
      body.innerHTML = `${p.at >= from ? `<p class="ib-note">Done ${sa >= 0 ? 'since the last save' : 'so far'}, not in a file yet:</p><ol start="${from}">${steps(from, p.at)}</ol>` : `<p class="ib-note">${sa >= 0 ? 'Nothing changed since the last save.' : 'No changes yet.'}</p>`}${open}`;
    }
  }
  async function measureFor(p, original) {
    const st = original ? p.steps[0] : p.steps[p.at]; busyNow('Measuring…');
    try { const f = await IC.process.measure(st.img, { say: busyNow }); const lines = IC.process.describe(f); if (original) p.measured0 = lines; else st.measured = lines; } catch (e) { logFail('Measuring failed', e); toast(e.message); }
    busy(null); renderInfo();
  }
  // ------------------------------------------------------------------ Process a photo: goals → measured → a plan for this photo
  const processState = new WeakMap();
  function processPanel(into, t) {
    const p = pic(); let S = processState.get(p); if (!S) { S = { goals: { edits: false, bigger: false, colour: true, repair: true }, factor: 2, faces: false }; processState.set(p, S); }
    const el = document.createElement('div'); into.append(el); const add = (h) => { const d = document.createElement('div'); d.innerHTML = h; el.append(d); return d; };
    add('<p class="hint">Say what you are doing, and ImageCraft measures this photo (noise, blur, JPEG blocks, printing dots, light, colour cast, specks, and faces if you like) and lays out the steps in the order that works best: repair, clean, light and colour, your own edits, faces, make bigger, a final sharpen. Each step says why. Untick anything you do not want, open any step to adjust it, then run the ticked ones.</p>');
    const goals = [['repair', 'Repair (specks, tears, JPEG blocks, printing dots)'], ['colour', 'Colour correction (light, fading, casts)'], ['bigger', 'Make bigger'], ['edits', 'Edits (crop, straighten, curves, colour: your own touch)']];
    const g = add(`<div class="field"><span>What are you doing?</span>${goals.map(([k, l]) => `<label class="check"><input type="checkbox" data-g="${k}" ${S.goals[k] ? 'checked' : ''}> ${l}</label>`).join('')}</div>`);
    g.onchange = (e) => { const k = e.target.dataset.g; if (k) { S.goals[k] = e.target.checked; if (S.f) S.plan = IC.process.plan(S.f, S.goals, { factor: S.factor, speed }); renderProps(); } };
    if (S.goals.bigger) { const f2 = add(`<div class="field"><span>How much bigger</span><div class="seg">${[2, 4].map((k) => `<button type="button" class="btn" data-fac="${k}" aria-pressed="${S.factor === k}">${k}×</button>`).join('')}</div></div>`); f2.onclick = (e) => { const b = e.target.closest('[data-fac]'); if (b) { S.factor = +b.dataset.fac; if (S.f) S.plan = IC.process.plan(S.f, S.goals, { factor: S.factor, speed }); renderProps(); } }; }
    const fc = add(`<label class="check"><input type="checkbox" ${S.faces ? 'checked' : ''}> Look for faces too (the first time downloads the face finder, about 4 MB)</label>`); fc.querySelector('input').onchange = (e) => { S.faces = e.target.checked; };
    const look = add('<div class="btns"><button class="btn primary" type="button">Look at the photo</button></div>').querySelector('button');
    look.onclick = async () => { const img = t.base; busyNow('Measuring…'); try { S.f = await IC.process.measure(img, { faces: S.faces, say: busyNow }); S.lines = IC.process.describe(S.f); S.plan = IC.process.plan(S.f, S.goals, { factor: S.factor, speed }); } catch (e) { logFail('Measuring failed', e); toast(e.message); } busy(null); if (tool === t) renderProps(); };
    if (!S.f) return;
    add(`<div class="field"><span>What the photo needs</span><ul class="hint" style="margin:4px 0 0;padding-left:18px">${S.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></div>`);
    if (!S.plan.length) { add('<p class="hint">Nothing to do for these goals: tick another goal above.</p>'); return; }
    const auto = S.plan.filter((x) => !x.manual && x.on), total = auto.reduce((a, x) => a + (x.ms || 0), 0);
    const list = add(`<div class="field"><span>The plan (in this order)</span>${S.plan.map((x, i) => `<div class="plan-step"><input type="checkbox" data-i="${i}" ${x.on ? 'checked' : ''} ${x.manual ? 'disabled title="Done by you"' : ''}><div><b>${esc(x.label)}</b>${x.manual ? ' <span class="turn">your turn</span>' : ` ${whereTag(x.id)}`}<small>${esc(x.why)}${x.ms ? ` · about ${fmtTime(x.ms / 1000)}` : ''}</small></div><button class="btn outline" type="button" data-open="${i}" title="Open this tool to adjust it (the plan stays here: come back with Process a photo)">Open</button></div>`).join('')}</div>`);
    list.onchange = (e) => { const i = e.target.dataset.i; if (i != null) { S.plan[+i].on = e.target.checked; renderProps(); } };
    list.onclick = (e) => { const b = e.target.closest('[data-open]'); if (!b) return; const x = S.plan[+b.dataset.open]; closeTool(true); openTool(x.id, x.s); };
    add(`<p class="hint">${auto.length} automatic step${auto.length === 1 ? '' : 's'}, about <b>${fmtTime(total / 1000)}</b> in all on this computer${S.plan.some((x) => x.id === 'facerestore' || x.id === 'colourise') ? ' (AI steps download their models the first time)' : ''}. Your-turn steps are left for you: open them when the automatic ones are done.</p>`);
    const go = add('<div class="btns"><button class="btn primary" type="button">Run the ticked steps</button></div>').querySelector('button');
    go.onclick = () => { const steps = S.plan.filter((x) => !x.manual && x.on).map((x) => ({ id: x.id, s: x.s })); if (!steps.length) return toast('Tick at least one automatic step.'); closeTool(true); runSteps(steps).then(() => { S.f = null; renderInfo(); }); };
  }
  function renderHist() {
    const L = $('hist'); L.innerHTML = ''; const p = pic(); if (!p) return;
    const bar = document.createElement('li'); bar.className = 'recipe-bar'; bar.innerHTML = '<div class="btns" style="margin:0 0 6px;flex-wrap:wrap"><button class="btn outline" type="button" data-r="save" title="Save these steps (tools and settings) as a recipe file">Save as recipe…</button><button class="btn outline" type="button" data-r="open" title="Run a saved recipe on this picture">Run a recipe…</button>' + (pics.length > 1 ? '<button class="btn outline" type="button" data-r="all" title="Run these same steps on every other open picture">These steps on all open pictures</button>' : '') + '</div>';
    bar.onclick = (e) => { const r = e.target.closest('[data-r]'); if (!r) return; if (r.dataset.r === 'save') saveRecipe(); else if (r.dataset.r === 'open') openRecipe(false); else { const rec = recipeOf(p); if (!rec.steps.length) return toast('There are no steps to repeat yet.'); rec.__from = p; useRecipe(rec, true); } };
    L.append(bar);
    p.steps.forEach((s, i) => { const li = document.createElement('li'), b = document.createElement('button'); b.innerHTML = `<span class="n">${i}</span>${esc(s.label)}`; b.setAttribute('aria-current', String(i === p.at)); if (i > p.at) b.className = 'undone'; b.onclick = () => goStep(i); li.append(b); L.append(li); });
  }
  const showTab = (name) => { document.querySelectorAll('.tab').forEach((x) => x.setAttribute('aria-selected', String(x.dataset.tab === name))); ['pics', 'hist', 'maps'].forEach((k) => { $('tab-' + k).hidden = k !== name; }); if (name === 'maps') renderMaps(); };
  // ------------------------------------------------------------------ maps (left panel, Maps tab; one shown at a time over the picture)
  let thumbFor = null, thumbSmall = null;
  // ------------------------------------------------------------------ the cloud maps the photo once; every built-in tool then uses its layers
  // Each layer is saved as this picture's corrected map (p.mapFix), so Where, the maps, Process a photo and the face tools all use it, offline.
  const CLOUD_LAYERS = [['sky', 'the sky', 'sky'], ['skin', "people's skin (faces, necks, arms, hands)", 'skin'], ['green', 'grass, trees and plants', 'green'], ['subject', 'the main subject (the people or thing the photo is of)', 'subject'], ['hair', 'hair', 'cl:hair', 'Hair'], ['clothing', 'clothing', 'cl:clothing', 'Clothing'], ['damage', 'tears, scratches, stains and missing parts of the old print', 'cl:damage', 'Damage to the print']];
  CLOUD_LAYERS.forEach((l) => { if (l[3]) IC.maps.addLayer(l[2], l[3], `${l[3]}, as the cloud AI outlined it (Mapped by the cloud, in the Maps tab).`); });
  // the cloud outlines things: Gemini draws them; OpenAI or Claude say where, and the built-in outliner (SlimSAM) traces the edges
  async function cloudOutline(img, labels, engine, what) {
    const CL = IC.cloud, W = img.width, H = img.height;
    if (engine === 'gemini') { busyNow(`Gemini is outlining ${what}… (10 to 40 seconds; the picture is sent)`); return CL.segmentMany(img, labels, await CL.seeModel('gemini')); }
    busyNow(`${CL.NAMES[engine]} is finding ${what}… (10 to 40 seconds; the picture is sent)`);
    const found = await CL.locate(img, labels, engine, await CL.seeModel(engine)), got = {}; labels.forEach((l) => { got[l] = new Float32Array(W * H); });
    let n = 0;
    for (const f of found) {
      busyNow(`Tracing the edges on this computer (${++n} of ${found.length}; the first time downloads the outliner, about 30 MB)…`);
      const [ya, xa, yb, xb] = f.box_2d.map(Number), map = got[f.label];
      const pts = (f.points || []).filter((q) => q && q.length === 2).map(([y, x]) => [x / 1000, y / 1000, 1]); if (!pts.length) pts.push([(xa + xb) / 2000, (ya + yb) / 2000, 1]);
      const gx = (xb - xa) * 0.04, gy = (yb - ya) * 0.04, X0 = Math.max(0, Math.floor(((xa - gx) / 1000) * W)), X1 = Math.min(W, Math.ceil(((xb + gx) / 1000) * W)), Y0 = Math.max(0, Math.floor(((ya - gy) / 1000) * H)), Y1 = Math.min(H, Math.ceil(((yb + gy) / 1000) * H));
      let r = null; try { r = /tears|scratch|damage/.test(f.label) ? null : await CRAFTAI.pick(X.canvasOf(img), pts); } catch (e) { logFail('Outlining failed', e); }
      for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) { const v = r ? (r.a[Math.min(r.H - 1, Math.floor(((y + 0.5) * r.H) / H)) * r.W + Math.min(r.W - 1, Math.floor(((x + 0.5) * r.W) / W))] > 127 ? 1 : 0) : 1; if (v > map[y * W + x]) map[y * W + x] = v; }
    }
    return got;
  }
  // which services can outline, best first; a service whose account is unpaid or whose model is retired is passed over for the next
  const outliners = () => ['gemini', 'openai', 'anthropic'].filter((k) => IC.cloud.has(k));
  async function withOutliner(fn, first) {
    const list = outliners(); if (first) list.sort((a, b) => (b === first) - (a === first)); let last = null;
    for (const eng of list) { try { return await fn(eng); } catch (e) { last = e; if (!/paid credit|quota|no longer available|not found|could not be reached|did not answer/i.test(e.message)) throw e; ICLOG.add('info', `Cloud: ${IC.cloud.NAMES[eng]} could not do it (${e.message.slice(0, 120)}); trying the next service`); } }
    throw last || new Error('No cloud key that can outline: add one in AI settings › Cloud AI.');
  }
  // with the switch on Cloud AI, the maps that would download a built-in AI finder ask the cloud instead (once per picture and map)
  IC.maps.setCloudPrep(async (id, img, words) => {
    if (IC.aiMode() !== 'cloud') return false;
    if (!outliners().length) throw new Error('The switch is on Cloud AI, but no cloud key is saved: add one in AI settings › Cloud AI, or switch to Both or Local AI to use the built-in finder.');
    const p = pics.find((q) => q.steps.some((st) => st.img === img)) || pic(); p.mapFix = p.mapFix || {};
    IC.cloud.task(`Map: ${words}`);
    const r = await withOutliner((eng) => cloudOutline(img, [words], eng, `“${words}”`).then((m) => ({ m: m[words], eng })));
    p.mapFix[id] = { W: img.width, H: img.height, data: r.m, by: r.eng };
    if (id === 'subject' || id === 'background') { const o = id === 'subject' ? 'background' : 'subject'; if (!p.mapFix[o]) p.mapFix[o] = { W: img.width, H: img.height, data: r.m.map((v) => 1 - v), by: r.eng }; }
    return true;
  });
  async function cloudMapPhoto(engine) {
    const p = pic(), img = now(), CL = IC.cloud, t0 = performance.now(), W = img.width, H = img.height, got = {};
    const labels = CLOUD_LAYERS.map((l) => l[1]);
    IC.cloud.task('Map this photo');
    const r = await cloudOutline(img, labels, engine, 'the sky, skin, greenery, subject, hair, clothing and damage'); CLOUD_LAYERS.forEach((l) => { got[l[0]] = r[l[1]]; });
    if (!got.subject.some((v) => v > 0.5)) delete got.subject; else got.background = got.subject.map((v) => 1 - v);
    p.mapFix = p.mapFix || {}; const done = [];
    for (const [k, sid] of [['sky', 's_sky'], ['hair', 's_hair'], ['clothing', 's_clothes']]) if (got[k] && got[k].some((v) => v > 0.5)) p.mapFix[sid] = { W, H, data: got[k], by: engine };
    for (const l of CLOUD_LAYERS) { const m = got[l[0]]; if (!m) continue; const share = m.reduce((a, v) => a + (v > 0.5 ? 1 : 0), 0) / m.length; if (share <= 0) { if (p.mapFix[l[2]]) delete p.mapFix[l[2]]; continue; } p.mapFix[l[2]] = { W, H, data: m, by: engine }; done.push(`${l[3] || { sky: 'Sky', skin: 'Skin', green: 'Greenery', subject: 'Main subject' }[l[0]]} ${(share * 100).toFixed(share < 0.01 ? 1 : 0)}%`); }
    if (got.background) { p.mapFix.background = { W, H, data: got.background, by: engine }; }
    p.cloudMapped = { by: engine, when: Date.now(), secs: (performance.now() - t0) / 1000, layers: done };
    busy(null); ICLOG.info(`Cloud map (${engine}): ${done.join(', ')} in ${p.cloudMapped.secs.toFixed(0)} s`); renderMaps(); renderInfo && renderInfo();
    toast(done.length ? `Mapped: ${done.join(', ')}. Every tool now uses these layers; correct any of them in its map.` : 'The cloud found none of the layers in this picture.'); if (done.length) openLayerCompare();
  }
  function renderMaps() {
    const L = $('maplist'); if (!L || $('tab-maps').hidden) return;
    const img = now(); if (!img) { L.innerHTML = '<p class="hint">Open a picture first.</p>'; return; }
    L.innerHTML = ''; let group = null;
    const fb = document.createElement('form'); fb.className = 'row'; fb.style.cssText = 'gap:6px;margin:0 0 8px';
    const gem = cloudOK() && IC.cloud.has('gemini');
    fb.innerHTML = `<input class="input" name="q" placeholder="Find… (the motorbike, a tear, flowers)" style="flex:1;min-width:0" aria-label="Find something by name">${gem ? '<select class="input" name="eng" style="width:auto" title="Built-in: on this computer. Gemini: sharper outlines (the picture is sent to Google)."><option value="builtin">Built-in</option><option value="gemini">Gemini</option></select>' : ''}<button class="btn outline" type="submit">Find</button>`;
    fb.onsubmit = (e) => { e.preventDefault(); const id = IC.maps.addFind(fb.q.value, gem && fb.eng ? fb.eng.value : 'builtin'); if (id) openMap(id, 'heat'); };
    L.append(fb);
    const cm = cloudOK() ? ['gemini', 'openai', 'anthropic'].filter((k) => IC.cloud.has(k)) : [];
    if (cm.length) { const box = document.createElement('div'); box.className = 'row'; box.style.cssText = 'gap:6px;margin:0 0 8px;flex-wrap:wrap'; const done = pic().cloudMapped;
      box.innerHTML = `<button class="btn outline" type="button" data-cmap style="flex:1" title="The cloud AI outlines the sky, skin, greenery, main subject, hair, clothing and damage once. They are kept as this picture's maps, so every built-in tool uses them, offline. The picture is sent once.">${done ? 'Map it again with the cloud' : 'Let the cloud map this photo'}</button>${cm.length > 1 ? `<select class="input" data-cmeng style="width:auto" aria-label="Which cloud service maps it">${cm.map((k) => `<option value="${k}">${esc(IC.cloud.NAMES[k].split(' ')[0])}${k === 'gemini' ? ' (outlines)' : ' (+ built-in outliner)'}</option>`).join('')}</select>` : ''}${done ? `<small class="hint" style="flex-basis:100%">Mapped by ${esc(IC.cloud.NAMES[done.by].split(' ')[0])}: ${esc(done.layers.join(', '))}.</small><button class="btn outline" type="button" data-cmp style="flex:1">Compare built-in and cloud</button><button class="btn outline" type="button" data-clog>What was sent</button>` : ''}`;
      if (done) { box.querySelector('[data-cmp]').onclick = () => openLayerCompare(); box.querySelector('[data-clog]').onclick = () => openCloudLog(); }
      box.querySelector('[data-cmap]').onclick = async () => { const sel = box.querySelector('[data-cmeng]'), eng = sel ? sel.value : cm[0]; try { await withOutliner((e2) => cloudMapPhoto(e2), eng); } catch (e) { busy(null); logFail('Cloud mapping failed', e); toast(e.message); } };
      L.append(box); }
    if (IC.maps.colourBlind(img)) L.insertAdjacentHTML('beforeend', '<p class="hint">This picture’s colours all lean one way (sepia, toned or a strong cast), so the colour-based Skin, Greenery and Sky maps mark the wrong things. Use <b>Scene (AI)</b> and <b>Skin (learned from the faces)</b> instead.</p>');
    IC.maps.LIST.forEach((m) => {
      const g = m.group || 'Measured'; if (g !== group) { group = g; L.insertAdjacentHTML('beforeend', `<h4>${esc(g)}</h4>`); }
      const b = document.createElement('button'); b.type = 'button'; b.dataset.map = m.id; b.title = m.what; b.setAttribute('aria-current', String(!!mapView && mapView.id === m.id));
      const c = document.createElement('canvas'); c.width = 112; c.height = 84; b.append(c); b.insertAdjacentHTML('beforeend', `<span><b>${esc(m.name)}</b><small>${esc(m.what)}</small></span>`);
      b.onclick = () => openMap(m.id); L.append(b);
    });
    // small pictures of each map, made from a small copy (quick), one at a time so the page stays responsive
    if (thumbFor !== img) { thumbFor = img; const k = Math.min(1, 240 / Math.max(img.width, img.height)); thumbSmall = X.resize(img, { width: img.width * k, height: img.height * k }); }
    IC.maps.share(img, thumbSmall);
    const small = thumbSmall, list = [...L.querySelectorAll('button[data-map]')];
    (async () => { for (const b of list) { await wait(5); if (thumbSmall !== small || !document.body.contains(b)) return; const m = IC.maps.LIST.find((x) => x.id === b.dataset.map); const map = IC.maps.make(m.id, small), v = m.grey ? IC.maps.grey(map, small.width, small.height) : IC.maps.heat(map, small), c = b.querySelector('canvas'), x = c.getContext('2d'); x.fillStyle = '#111'; x.fillRect(0, 0, c.width, c.height); const kk = Math.min(c.width / small.width, c.height / small.height); x.drawImage(X.canvasOf(v), (c.width - small.width * kk) / 2, (c.height - small.height * kk) / 2, small.width * kk, small.height * kk); } })();
  }
  function openMap(id, mode) {
    const img = now(); if (!img) return; if (tool) closeTool(true);
    const m = IC.maps.LIST.find((x) => x.id === id); mode = mode || (m.grey ? 'grey' : 'heat');
    busyNow((m.needsFind || m.needsCut) && aiMode === 'cloud' && !IC.maps.known(id, img) ? 'Asking the cloud to outline it…' : m.needsCloud && !IC.maps.known(id, img) ? 'Asking Gemini to outline it…' : m.needsFaces && !IC.faces.known(img) ? 'Finding faces (the first time downloads the face finder)…' : m.needsFind && !IC.maps.known(id, img) ? 'Recognising what is in the picture (the first time downloads the finder, about 139 MB)…' : `Measuring: ${m.name}…`);
    setTimeout(async () => {
      try { await IC.maps.prepare(id, img); } catch (e) { busy(null); ICLOG.error(m.needsFind ? 'The finder failed' : 'Face finder failed', e); toast((m.needsFind ? 'The finder could not start: ' : 'The face finder could not start: ') + e.message); return; }
      const t0 = performance.now(), map = IC.maps.make(id, img);
      mapView = { id, mode, img: mode === 'grey' ? IC.maps.grey(map, img.width, img.height) : IC.maps.heat(map, img) };
      ICLOG.info(`Map ${m.name}: ${img.width} × ${img.height} in ${Math.round(performance.now() - t0)} ms`);
      busy(null); show(); renderMapBar(); renderMaps();
    }, 20);
  }
  function closeMap() { mapEdit = null; mapView = null; $('mapbar').hidden = true; show(); renderMaps(); }
  // ------------------------------------------------------------------ correcting a map (helping the AI see)
  // p.mapFix[id] = { W, H, data }: the person's own version of a map for this picture, painted or outlined by clicking.
  // Every tool's Where, the maps and the face tools use it in place of the measured or AI map (scaled if the size changed).
  IC.maps.setOverride((id, img) => {
    const p = pics.find((q) => q.steps.some((st) => st.img === img)) || pic(); const f = p && p.mapFix && p.mapFix[id]; if (!f) return null;
    if (f.W === img.width && f.H === img.height) return f.data;
    const o = new Float32Array(img.width * img.height); for (let y = 0; y < img.height; y++) { const sy = Math.min(f.H - 1, Math.floor(((y + 0.5) * f.H) / img.height)); for (let x = 0; x < img.width; x++) o[y * img.width + x] = f.data[sy * f.W + Math.min(f.W - 1, Math.floor(((x + 0.5) * f.W) / img.width))]; } return o;
  });
  let mapEdit = null; // { mode: 'add' | 'remove' | 'click' | 'face', brush }
  function mapFixOf(id) { const p = pic(), img = now(); p.mapFix = p.mapFix || {}; if (!p.mapFix[id]) p.mapFix[id] = { W: img.width, H: img.height, data: Float32Array.from(IC.maps.make(id, img)) }; return p.mapFix[id]; }
  function redrawMap() { const img = now(), map = IC.maps.make(mapView.id, img); mapView.img = mapView.mode === 'grey' ? IC.maps.grey(map, img.width, img.height) : IC.maps.heat(map, img); show(); }
  function mapPaint(px, py, erase, more) {
    const f = mapFixOf(mapView.id), r = Math.max(1, mapEdit.brush / 2);
    for (let y = Math.max(0, Math.floor(py - r - 2)); y <= Math.min(f.H - 1, Math.ceil(py + r + 2)); y++) for (let x = Math.max(0, Math.floor(px - r - 2)); x <= Math.min(f.W - 1, Math.ceil(px + r + 2)); x++) {
      const d = Math.hypot(x - px, y - py), w = Math.max(0, Math.min(1, r + 1.5 - d)); if (w <= 0) continue; const i = y * f.W + x; f.data[i] = erase ? Math.min(f.data[i], 1 - w) : Math.max(f.data[i], w);
    }
    if (!more) redrawMap();
  }
  async function mapClick(px, py, erase) {
    const img = now(), id = mapView.id;
    if (mapEdit.mode === 'face') {
      busyNow('Looking closely for a face there…');
      try { const r = await IC.faces.addAt(img, px, py); busy(null); toast(r === 'known' ? 'That face was already found.' : r ? 'Face found and added: the face maps and face tools now include it.' : 'No face found there: try clicking nearer its middle, or mark it with the brush.'); if (r && r !== 'known') { const p = pic(); if (p.mapFix) Object.keys(p.mapFix).filter((k) => k.startsWith('f_')).forEach((k) => delete p.mapFix[k]); renderMaps(); } redrawMap(); } catch (e) { busy(null); logFail('Face search failed', e); toast(e.message); }
      return;
    }
    busyNow('Outlining it (the first time downloads the picker)…');
    try {
      const r = await CRAFTAI.pick(X.canvasOf(img), [[px / img.width, py / img.height, 1]]), f = mapFixOf(id);
      for (let y = 0; y < f.H; y++) for (let x = 0; x < f.W; x++) if (r.a[Math.min(r.H - 1, Math.floor(((y + 0.5) * r.H) / f.H)) * r.W + Math.min(r.W - 1, Math.floor(((x + 0.5) * r.W) / f.W))] > 127) f.data[y * f.W + x] = erase ? 0 : 1;
      busy(null); redrawMap();
    } catch (e) { busy(null); logFail('Outlining failed', e); toast('Could not outline it: ' + e.message); }
  }
  function renderMapBar() {
    const bar = $('mapbar'); if (!mapView) { bar.hidden = true; return; }
    const m = IC.maps.LIST.find((x) => x.id === mapView.id);
    const blind = ['skin', 'green', 'sky'].includes(m.id) && IC.maps.colourBlind(now());
    bar.innerHTML = `<b>Map: ${esc(m.name)}</b>${blind ? '<span class="hint" title="This map judges by colour, and this picture’s colours all lean one way (sepia, toned or a strong cast), so it marks the wrong things. The Scene (AI) maps and Skin (learned from the faces) recognise things by what they are.">⚠ Colours too even to judge by: use Scene (AI)</span>' : ''}<div class="seg"><button class="btn" data-m="heat" aria-pressed="${mapView.mode === 'heat'}">Heat</button><button class="btn" data-m="grey" aria-pressed="${mapView.mode === 'grey'}">Grey (mask)</button></div><button class="btn outline" data-a="open">Open as a picture</button><button class="btn outline" data-a="clear">Make see-through by it</button><button class="btn primary" data-a="back">Back to the picture</button>`;
    const fixed = pic() && pic().mapFix && pic().mapFix[m.id], isFace = /^f_|skinface/.test(m.id);
    bar.insertAdjacentHTML('beforeend', mapEdit ? `<span class="seg">${[['add', 'Paint in'], ['remove', 'Paint out'], ['click', 'Click: AI outlines it'], ...(isFace ? [['face', 'Point at a missed face']] : [])].map(([k, l]) => `<button class="btn" data-fix="${k}" aria-pressed="${mapEdit.mode === k}">${l}</button>`).join('')}</span>${mapEdit.mode === 'add' || mapEdit.mode === 'remove' ? `<label class="hint">Brush <input type="range" min="2" max="160" value="${mapEdit.brush}" data-brush style="width:90px;vertical-align:middle"></label>` : ''}<span class="hint">${mapEdit.mode === 'face' ? 'Click the middle of a face it missed.' : 'Left button adds, right button takes away.'}</span><button class="btn outline" data-fix="reset" ${fixed ? '' : 'disabled'}>Back to measured</button><button class="btn primary" data-fix="done">Done</button>` : `<button class="btn outline" data-fix="on" title="Paint in or out, or click to have the AI outline something: your version of this map is used by every tool">${fixed ? 'Corrected ✓ · correct more' : 'Correct it'}</button>`);
    const br = bar.querySelector('[data-brush]'); if (br) br.oninput = () => { mapEdit.brush = +br.value; };
    bar.hidden = false;
    bar.onclick = (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.m) { openMap(mapView.id, b.dataset.m); return; }
      if (b.dataset.fix) { if (b.dataset.fix === 'on') mapEdit = { mode: 'add', brush: 24 }; else if (b.dataset.fix === 'done') mapEdit = null; else if (b.dataset.fix === 'reset') { const p = pic(); if (p.mapFix) delete p.mapFix[mapView.id]; redrawMap(); } else mapEdit.mode = b.dataset.fix; renderMapBar(); renderMaps(); return; }
      const img = now(), map = IC.maps.make(mapView.id, img);
      if (b.dataset.a === 'back') closeMap();
      else if (b.dataset.a === 'open') { const g = IC.maps.grey(map, img.width, img.height); closeMap(); addPic(`${baseName(pic().name)} – ${m.name}.png`, g, { format: 'Map', bits: 8 }); toast(`${m.name} opened as a picture of its own.`); }
      else if (b.dataset.a === 'clear') { const o = new ImageData(new Uint8ClampedArray(img.data), img.width, img.height); for (let p = 0; p < map.length; p++) o.data[p * 4 + 3] = Math.round(o.data[p * 4 + 3] * map[p]); closeMap(); push(`See-through by ${m.name}`, o); }
    };
  }
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));
  const showSide = (side) => { if (matchMedia('(max-width: 980px)').matches) document.querySelector('.work').classList.add(side === 'right' ? 'show-right' : 'show-left'); };

  // ------------------------------------------------------------------ debug log (a window: the bug button in the status bar)
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
  const openDebug = () => { $('tab-debug').hidden = false; renderLog(); };
  $('dbg-close').onclick = () => { $('tab-debug').hidden = true; };
  $('tab-debug').addEventListener('click', (e) => { if (e.target === $('tab-debug')) $('tab-debug').hidden = true; });

  // ------------------------------------------------------------------ status bar
  let hover = null;
  const statusEl = $('status');
  statusEl.innerHTML = `<button class="st-ai" id="st-ai" type="button" title="AI settings: the built-in models, Ollama, and your cloud keys">AI</button><span id="st-size"></span><span id="st-cols"></span><span id="st-at"></span><span class="grow"></span><button class="st-icon" id="st-local" type="button" title="Local activity: what ran on this computer (AI models and steps), how long, before and after" aria-label="Local activity"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg><b></b></button><span class="seg aimode" id="st-aimode" title="Which AI the steps that can use the cloud may use"></span><button class="st-icon" id="st-cloud" type="button" title="Cloud activity: every call, what was sent and what came back" aria-label="Cloud activity"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.1 9.3 4.4 4.4 0 0 0 7 18Z"/></svg><b></b></button><button class="st-icon" id="st-err" type="button" title="Debug log: errors and what happened" aria-label="Debug log"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="6" width="10" height="14" rx="5"/><path d="M12 10v10M7 12H3M21 12h-4M7 17l-3 2M17 17l3 2M7 8 4 6M17 8l3-2M9.5 6.5 8 3.5M14.5 6.5 16 3.5"/></svg><b></b></button><span class="zoombox"><button class="btn" id="st-out" title="Zoom out" aria-label="Zoom out">−</button><input type="range" id="st-zoom" min="-100" max="100" value="0" aria-label="Zoom" data-rt-skip><button class="btn" id="st-in" title="Zoom in" aria-label="Zoom in">+</button><button class="btn" id="st-pct" title="Fit the picture (click) or 100% (double-click)">100%</button></span>`;
  // the zoom slider: 100% in the middle, 2% at the left, 6400% at the right
  const zToS = (z) => Math.round(z >= 1 ? (Math.log(z) / Math.log(64)) * 100 : (Math.log(z) / Math.log(50)) * 100), sToZ = (s) => (s >= 0 ? Math.pow(64, s / 100) : Math.pow(50, s / 100));
  $('st-zoom').oninput = (e) => setZoom(sToZ(+e.target.value));
  $('st-err').onclick = openDebug;
  $('st-ai').onclick = () => openAI(); aiChip();
  $('st-cloud').onclick = () => openCloudLog();
  $('st-local').onclick = () => openLocalLog();
  CRAFTAI.onActivity((e) => { if (!localLog.includes(e)) { localLog.unshift(e); if (localLog.length > 60) localLog.pop(); } localChanged(); });
  IC.cloud.onLog((L) => { const el = $('st-cloud'), busyN = L.filter((e) => e.state === 'sending').length, fails = L.filter((e) => e.state === 'failed').length; el.querySelector('b').textContent = L.length || ''; el.title = busyN ? `Sending to the cloud now (${busyN})… click to watch` : `Cloud activity: ${L.length} call${L.length === 1 ? '' : 's'} this session${fails ? `, ${fails} failed` : ''}`; el.classList.toggle('sending', !!busyN); el.classList.toggle('bad', !busyN && !!fails && L[0].state === 'failed'); if ($('cloudlog') && !$('cloudlog').hidden) drawCloudLog(); });
  $('st-aimode').onclick = (e) => { const b = e.target.closest('[data-mode]'); if (!b) return; aiMode = b.dataset.mode; try { localStorage.setItem('imagecraft-aimode', aiMode); } catch (err) { /* blocked storage */ } aiModeUI(); if (tool && /assess|regen/.test(tool.def.id)) { if (tool.oll) tool.oll = { status: 'checking' }; renderProps(); } toast(aiMode === 'local' ? 'Local AI only: nothing is sent off this computer.' : aiMode === 'cloud' ? 'Cloud AI: Ask AI uses your cloud services, and Regenerate is on.' : 'Local and cloud AI: choose per tool.'); };
  aiModeUI();
  $('st-at').onclick = () => { const h = $('st-at').dataset.hex; if (h) navigator.clipboard.writeText(h).then(() => toast(`${h} copied.`), () => toast('Could not copy.')); };
  $('st-in').onclick = () => zoomBy(1.25); $('st-out').onclick = () => zoomBy(0.8); $('st-pct').title = 'Zoom: choose a size, or type one'; $('st-pct').onclick = (e) => { e.stopPropagation(); zoomMenu(); };
  // the zoom menu (click the percentage in the status bar): fit, the usual sizes, or type one
  function zoomMenu() {
    let m = $('zoommenu'); if (m) { m.remove(); return; }
    m = document.createElement('div'); m.id = 'zoommenu'; m.className = 'zoommenu';
    m.innerHTML = `<button type="button" data-z="fit">Fit</button>${[25, 50, 100, 200, 400, 800].map((z) => `<button type="button" data-z="${z}"${Math.round(view.zoom * 100) === z ? ' aria-pressed="true"' : ''}>${z}%</button>`).join('')}<label>Type <input type="number" min="1" max="6400" step="1" value="${Math.round(view.zoom * 100)}"> %</label>`;
    document.body.append(m); const b = $('st-pct').getBoundingClientRect(); m.style.left = Math.min(innerWidth - m.offsetWidth - 8, b.left) + 'px'; m.style.top = b.top - m.offsetHeight - 6 + 'px';
    const close = () => { m.remove(); document.removeEventListener('pointerdown', away, true); }, away = (e) => { if (!m.contains(e.target)) close(); };
    setTimeout(() => document.addEventListener('pointerdown', away, true), 0);
    m.onclick = (e) => { const z = e.target.closest('[data-z]'); if (!z) return; if (z.dataset.z === 'fit') fitView(); else setZoom(+z.dataset.z / 100); close(); };
    const inp = m.querySelector('input'); inp.onkeydown = (e) => { if (e.key === 'Enter') { const v = +inp.value; if (v > 0) setZoom(v / 100); close(); } if (e.key === 'Escape') close(); };
  }
  function zoomUI() { $('st-pct').textContent = Math.round(view.zoom * 100) + '%'; if (document.activeElement !== $('st-zoom')) $('st-zoom').value = zToS(view.zoom); }
  function status() {
    const img = now(), st = pic() && pic().steps[pic().at];
    const ne = ICLOG.errors(); $('st-err').classList.toggle('bad', !!ne); $('st-err').querySelector('b').textContent = ne ? ne : ''; $('st-err').title = ne ? `${ne} error${ne === 1 ? '' : 's'} this session: open the Debug log` : 'Debug log: errors and what happened';
    $('st-size').innerHTML = img ? `<b>${fmtN(img.width)} × ${fmtN(img.height)}</b> pixels${st && st.deep ? ' · <b title="This step keeps 16 bits per colour: smooth gradients, no banding. Save as PNG or TIFF 48/64-bit to keep them.">16-bit</b>' : ''}` : 'No picture open';
    $('st-cols').innerHTML = st && st.colours != null ? (st.colours < 0 ? 'Many colours' : `<b>${fmtN(st.colours)}</b> colour${st.colours === 1 ? '' : 's'}`) : '';
    statusHover();
  }
  // the colour under the mouse, as a colour cell: HEX, RGB, CMYK, HSL, Lab and the nearest CSS colour name (Pantone's
  // values are licensed, so no Pantone table can come with ImageCraft; the Lab values match any swatch book). Click copies.
  let hoverAt = null; try { view.loupe = localStorage.getItem('imagecraft-loupe') !== 'off'; } catch (e) { view.loupe = true; }
  const CSS_NAMES = 'aliceblue:f0f8ff,antiquewhite:faebd7,aquamarine:7fffd4,azure:f0ffff,beige:f5f5dc,bisque:ffe4c4,black:000000,blanchedalmond:ffebcd,blue:0000ff,blueviolet:8a2be2,brown:a52a2a,burlywood:deb887,cadetblue:5f9ea0,chartreuse:7fff00,chocolate:d2691e,coral:ff7f50,cornflowerblue:6495ed,cornsilk:fff8dc,crimson:dc143c,cyan:00ffff,darkblue:00008b,darkcyan:008b8b,darkgoldenrod:b8860b,darkgray:a9a9a9,darkgreen:006400,darkkhaki:bdb76b,darkmagenta:8b008b,darkolivegreen:556b2f,darkorange:ff8c00,darkorchid:9932cc,darkred:8b0000,darksalmon:e9967a,darkseagreen:8fbc8f,darkslateblue:483d8b,darkslategray:2f4f4f,darkturquoise:00ced1,darkviolet:9400d3,deeppink:ff1493,deepskyblue:00bfff,dimgray:696969,dodgerblue:1e90ff,firebrick:b22222,floralwhite:fffaf0,forestgreen:228b22,gainsboro:dcdcdc,ghostwhite:f8f8ff,gold:ffd700,goldenrod:daa520,gray:808080,green:008000,greenyellow:adff2f,honeydew:f0fff0,hotpink:ff69b4,indianred:cd5c5c,indigo:4b0082,ivory:fffff0,khaki:f0e68c,lavender:e6e6fa,lavenderblush:fff0f5,lawngreen:7cfc00,lemonchiffon:fffacd,lightblue:add8e6,lightcoral:f08080,lightcyan:e0ffff,lightgoldenrodyellow:fafad2,lightgray:d3d3d3,lightgreen:90ee90,lightpink:ffb6c1,lightsalmon:ffa07a,lightseagreen:20b2aa,lightskyblue:87cefa,lightslategray:778899,lightsteelblue:b0c4de,lightyellow:ffffe0,lime:00ff00,limegreen:32cd32,linen:faf0e6,magenta:ff00ff,maroon:800000,mediumaquamarine:66cdaa,mediumblue:0000cd,mediumorchid:ba55d3,mediumpurple:9370db,mediumseagreen:3cb371,mediumslateblue:7b68ee,mediumspringgreen:00fa9a,mediumturquoise:48d1cc,mediumvioletred:c71585,midnightblue:191970,mintcream:f5fffa,mistyrose:ffe4e1,moccasin:ffe4b5,navajowhite:ffdead,navy:000080,oldlace:fdf5e6,olive:808000,olivedrab:6b8e23,orange:ffa500,orangered:ff4500,orchid:da70d6,palegoldenrod:eee8aa,palegreen:98fb98,paleturquoise:afeeee,palevioletred:db7093,papayawhip:ffefd5,peachpuff:ffdab9,peru:cd853f,pink:ffc0cb,plum:dda0dd,powderblue:b0e0e6,purple:800080,rebeccapurple:663399,red:ff0000,rosybrown:bc8f8f,royalblue:4169e1,saddlebrown:8b4513,salmon:fa8072,sandybrown:f4a460,seagreen:2e8b57,seashell:fff5ee,sienna:a0522d,silver:c0c0c0,skyblue:87ceeb,slateblue:6a5acd,slategray:708090,snow:fffafa,springgreen:00ff7f,steelblue:4682b4,tan:d2b48c,teal:008080,thistle:d8bfd8,tomato:ff6347,turquoise:40e0d0,violet:ee82ee,wheat:f5deb3,white:ffffff,whitesmoke:f5f5f5,yellow:ffff00,yellowgreen:9acd32'.split(',').map((e) => { const [n, h] = e.split(':'); return [n, parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4), 16)]; });
  const labOf = (r, g, b) => { const L = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }, R = L(r), G = L(g), B = L(b), f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116), X = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047), Y = f(0.2126 * R + 0.7152 * G + 0.0722 * B), Z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883); return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)]; };
  const CSS_LAB = CSS_NAMES.map(([n, r, g, b]) => [n, labOf(r, g, b)]);
  function colourFacts(r, g, b) {
    const hex = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase(), k = 1 - Math.max(r, g, b) / 255, cm = (v) => (k >= 1 ? 0 : Math.round(((1 - v / 255 - k) / (1 - k)) * 100));
    const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, l = (mx + mn) / 2, dl = mx - mn, sat = dl ? dl / (1 - Math.abs(2 * l - 1)) : 0; let h = 0; if (dl) { const R = r / 255, G = g / 255, B = b / 255; h = mx === R ? ((G - B) / dl) % 6 : mx === G ? (B - R) / dl + 2 : (R - G) / dl + 4; h = Math.round(h * 60); if (h < 0) h += 360; }
    const lab = labOf(r, g, b); let best = null, bd = 1e9; for (const [n, q] of CSS_LAB) { const dd = (q[0] - lab[0]) ** 2 + (q[1] - lab[1]) ** 2 + (q[2] - lab[2]) ** 2; if (dd < bd) { bd = dd; best = n; } }
    return { hex, rgb: `${r}, ${g}, ${b}`, cmyk: `${cm(r)}, ${cm(g)}, ${cm(b)}, ${Math.round(k * 100)}%`, hsl: `${h}°, ${Math.round(sat * 100)}%, ${Math.round(l * 100)}%`, lab: lab.map((v) => Math.round(v)).join(', '), name: best, near: Math.sqrt(bd) < 3 };
  }
  function statusHover() {
    const img = shown(), el = $('st-at'); if (!img) { el.textContent = ''; return; } if (!hover) return;
    const i = (hover[1] * img.width + hover[0]) * 4, d = img.data, f = colourFacts(d[i], d[i + 1], d[i + 2]);
    el.innerHTML = `${hover[0]}, ${hover[1]} <span class="ccell" title="RGB ${f.rgb} · CMYK ${f.cmyk} · HSL ${f.hsl} · Lab ${f.lab} · ${f.name}. Click to copy ${f.hex}"><span class="sw" style="background:${f.hex}"></span><b>${f.hex}</b> · ${f.name}</span>${d[i + 3] < 255 ? ` · ${Math.round((d[i + 3] / 255) * 100)}% solid` : ''}`;
    el.dataset.hex = f.hex;
    // the colour table beside the mouse
    const lp = $('loupe'); if (!lp) return; if (!view.loupe || !hoverAt) { lp.hidden = true; return; }
    lp.innerHTML = `<div class="lp-sw" style="background:${f.hex}"></div><table><tr><th>HEX</th><td>${f.hex}</td></tr><tr><th>RGB</th><td>${f.rgb}</td></tr><tr><th>CMYK</th><td>${f.cmyk}</td></tr><tr><th>HSL</th><td>${f.hsl}</td></tr><tr><th>Lab</th><td>${f.lab}</td></tr><tr><th>Name</th><td>${f.near ? '' : '≈ '}${f.name}</td></tr>${d[i + 3] < 255 ? `<tr><th>Solid</th><td>${Math.round((d[i + 3] / 255) * 100)}%</td></tr>` : ''}</table>`;
    lp.hidden = false; const dr = $('desk').getBoundingClientRect(), w = lp.offsetWidth, h = lp.offsetHeight; let x = hoverAt[0] - dr.left + 18, y = hoverAt[1] - dr.top + 18; if (x + w > dr.width - 6) x = hoverAt[0] - dr.left - w - 14; if (y + h > dr.height - 6) y = hoverAt[1] - dr.top - h - 14; lp.style.left = x + 'px'; lp.style.top = y + 'px';
  }

  // ------------------------------------------------------------------ Save as
  const DEPTH_NAME = { 1: '1-bit · 2 colours', 2: '2-bit · 4 colours', 3: '3-bit · 8 colours', 4: '4-bit · 16 colours', 5: '5-bit · 32 colours', 6: '6-bit · 64 colours', 7: '7-bit · 128 colours', 8: '8-bit · 256 colours', 16: '16-bit · 65,536 colours', 24: '24-bit · millions of colours', 32: '32-bit · millions, with see-through', 48: '48-bit · 16 bits per colour (deep)', 64: '64-bit · 16 bits per colour, with see-through' };
  const NO_CLEAR = new Set(['jpg', 'pdf', 'pcx', 'bmp', 'ppm', 'pi1', 'pi2', 'pi3', 'neo', 'koa', 'scr', 'mac']);
  // formats (and depths) that cannot hold see-through: those parts are filled with a colour first
  const noClear = (fmt, bits) => (NO_CLEAR.has(fmt) && !(fmt === 'bmp' && bits === 32)) || (fmt === 'tga' && bits !== 32) || ((fmt === 'png' || fmt === 'tif') && (bits === 24 || bits === 48));
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
    if (st.deep && f.depths.includes(48)) return clear ? 64 : 48; // a 16-bit step saves as 16 bits per colour
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
        const bits = bitsFor(sv.fmt), o = { ...sv, bits, quality: sv.quality / 100 }, img = prepared(now(), sv.fmt, o); if (img === now() && pic().steps[pic().at].deep) o.deep = pic().steps[pic().at].deep;
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
    download(saveBlob, `${(sv.name || 'picture').replace(/[\\/:*?"<>|]+/g, '-')}.${e}`); pic().saved = { at: pic().at, step: pic().steps[pic().at], name: `${sv.name || 'picture'}.${e}`, when: new Date() }; pic().dirty = false; renderPics(); renderProps(); $('savedlg').hidden = true;
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
          const o = { bits, quality: q, palette: 'adaptive', dither, back: '#ffffff' }, img0 = img; img = prepared(img, fmt, o); if (img === img0 && img0 === p.steps[p.at].img && p.steps[p.at].deep) o.deep = p.steps[p.at].deep;
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
        ['Plan', [B('Process a photo', IK.auto, T('process'), { big: true, title: 'Say what you are doing (edits, bigger, colour, repair); the photo is measured and a plan made for it' })]],
        ['Quick', [B('Auto fix', IK.auto, () => quick('Auto fix', (i) => X.autoFix(i)), { big: true, title: 'Levels, a little colour and sharpening, in one click' }), B('Modernise', IK.modern, T('modern'), { big: true, title: 'Clean up and enlarge pixel art, old screens, old photos or blocky JPEGs' }), B('Compare', IK.compare, toggleCompare, { big: true, pressed: () => view.compare, title: 'Before and after, side by side (drag the line)' })]],
        ['Help', [B('How to use', I.help, help, { big: true, always: true })]],
      ] },
      { id: 'image', label: 'Image', hue: '#2f7fdd', groups: [
        ['Size', [B('Resize', IK.resize, T('resize'), { big: true }), B('Crop', IK.crop, T('crop'), { big: true }), { col: [B('Smooth jagged edges', IK.straighten, T('aa')), B('Canvas size', IK.canvas, T('canvas')), B('Trim borders', IK.crop, () => quick('Trim borders', (i) => { const t = X.trimBox(i); if (!t) throw new Error('No plain border to trim.'); return X.crop(i, t); }))] }]],
        ['Turn', [{ col: [B('Turn left', I.rotL, () => quick('Turn left', (i) => X.rotate90(i, 270))), B('Turn right', I.rotR, () => quick('Turn right', (i) => X.rotate90(i, 90))), B('Turn upside down', I.rot180, () => quick('Turn upside down', (i) => X.rotate90(i, 180)))] },
          { col: [B('Flip across', IK.flipH, () => quick('Flip across', (i) => X.flip(i, true))), B('Flip up and down', IK.flipV, () => quick('Flip up and down', (i) => X.flip(i, false))), B('Straighten', IK.straighten, T('straighten'))] }]],
      ] },
      { id: 'adjust', label: 'Adjust', hue: '#e07a1f', groups: [
        ['Light', [B('Brightness', IK.light, T('light'), { big: true, title: 'Brightness, contrast, midtones, shadows and highlights' }), B('Recover shadows', IK.light, T('shadows'), { big: true, title: 'Lift dark areas with their detail, sky untouched' }), B('Dehaze', IK.light, T('dehaze'), { big: true, title: 'Take away a foggy or faded grey veil' }), B('Lift a shadow', IK.light, T('shadowlift'), { big: true, title: 'Paint over a hard shadow (a flash shadow on a wall) and brighten it to match the light around it' }), { col: [B('Auto levels', IK.auto, () => quick('Auto levels', (i) => X.autoLevels(i))), B('Auto fix', IK.auto, () => quick('Auto fix', (i) => X.autoFix(i)))] }]],
        ['Colour', [B('Auto colour', IK.auto, T('autocolour'), { big: true, title: 'Correct a faded print: levels, neutral midtones and faded colour' }), B('Colour', IK.colour, T('colour'), { big: true, title: 'Saturation, vibrance, hue, warmth and tint' }), { col: [B('Fix a colour cast', IK.balance, T('balance')), B('Greyscale', IK.grey, () => quick('Greyscale', (i) => X.greyscale(i))), B('Sepia', IK.sepia, T('sepia'))] }, { col: [B('Invert', IK.invert, () => quick('Invert', (i) => X.invert(i))), B('Threshold', IK.threshold, T('threshold')), B('Posterize', IK.posterize, T('posterize'))] }]],
        ['Detail', [B('Clarity', IK.sharpen, T('clarity'), { big: true, title: 'Local contrast: texture and detail' }), { col: [B('Sharpen', IK.sharpen, T('sharpen')), B('Blur', IK.blur, T('blur')), B('Pixelate', IK.pixelate, T('pixelate'))] }]],
      ] },
      { id: 'detail', label: 'Detail', hue: '#c2410c', groups: [
        ['Curves', [B('Curves', IK.light, T('curves'), { big: true, title: 'Curves for brightness or each colour, with Where for curves layers' }), B('Blend a version', IK.compare, T('blendstep'), { big: true, title: 'Mix an earlier step back in (like layers), anywhere or through a map' })]],
        ['Detail', [B('Detail equaliser', IK.sharpen, T('equalizer'), { big: true, title: 'Fine, small, medium and large detail, each with its own amount' }), B('Even the light', IK.light, T('gradient'), { big: true, title: 'Gradient domain: big brightness jumps smaller, faint detail bigger' }), B('Crisp edges', IK.sharpen, T('crisp'), { big: true, title: 'Shock filter: soft edges made crisp without halos' }), B('Edge-keeping smooth', IK.denoise, T('diffuse'), { big: true, title: 'Perona–Malik diffusion: smooth, but never across an edge' })]],
        ['Faces', [B('Face refine', IK.cutout, T('facerefine'), { big: true, title: 'Find each face’s skin, eyes, irises, lips and teeth and treat each on its own (nothing redrawn)' }), B('Red eye', IK.cutout, T('redeye'), { big: true, title: 'Take the flash’s red out of the pupils (found by the face finder)' }), B('Restore faces', IK.cutout, T('facerestore'), { big: true, title: 'AI redraws small, blurred or damaged faces (CodeFormer; large download; non-commercial)' })]],
        ['Maps', [B('Maps and channels', IK.grid, () => { showSide('left'); showTab('maps'); }, { big: true, title: 'See the picture measured into maps and channels' }), B('False colour', IK.colour, T('falsecolour'), { big: true, title: 'Stretch the faint colour differences to full strength: stains, toning and fading show' })]],
      ] },
      { id: 'colours', label: 'Colours', hue: '#b44be1', groups: [
        ['Depth', [B('Colour depth', IK.depth, T('depth'), { big: true, title: '1, 2, 4 or 8-bit colour, high colour, palettes and dithering' }), B('Computer looks', IK.retro, T('looks'), { big: true, title: 'Atari ST, Amiga, C64, ZX Spectrum, CGA, EGA, VGA, Macintosh, Game Boy…' })]],
        ['See-through', [{ col: [B('Make a colour see-through', IK.clearC, T('clear')), B('Fill see-through parts', IK.canvas, T('flatten')), B('Remove background', IK.cutout, T('cutout'))] }]],
      ] },
      { id: 'clean', label: 'Clean up', hue: '#1e9e8a', groups: [
        ['Colour', [B('Colourise', IK.colour, T('colourise'), { big: true, title: 'AI gives a black-and-white or faded photo likely colours (only the colour is guessed)' })]],
        ['Cloud', [B('Regenerate', IK.modern, T('regen'), { big: true, title: 'Gemini or OpenAI redraws the photo, restored (your key; the picture is sent to them)' })]],
        ['Repair', [B('Repair damage', IK.dust, T('repair'), { big: true, title: 'Find specks, scratches, tears and stamps (or paint over damage) and fill them in from around them' })]],
        ['Old photo', [B('Restore old photo', IK.modern, () => openTool('modern', { kind: 'photo', bigger: 1 }), { big: true, title: 'Dust, noise, blur, colour cast and fading fixed in one go, measured from the picture' }), B('Split subject and background', IK.cutout, T('split'), { big: true, title: 'The main subject and the background as two pictures (layers), each restored its own way' }), B('Ask AI what it needs', IK.modern, T('assess'), { big: true, title: 'A vision model in Ollama on this computer looks at the picture, says what it is and what is wrong, and ticks the tools to fix it' })]],
        ['Restore', [B('Remove noise', IK.denoise, T('nlm'), { big: true, title: 'Smart noise removal (non-local means): grain and colour blotches' }), B('Deblur', IK.sharpen, T('deblur'), { big: true, title: 'Undo soft focus, out of focus or camera shake (Wiener deconvolution)' }), B('Faded detail', IK.light, T('clahe'), { big: true, title: 'Adaptive contrast for faded photos (CLAHE)' }), { col: [B('Where the noise is', IK.grid, T('noisemap')), B('Rebuild colour detail', IK.colour, T('chroma'), { title: 'Colour blocks and smears (JPEG, old scans) made to follow the real brightness detail' })] }]],
        ['Clean', [B('Smooth out noise', IK.denoise, T('denoise'), { big: true }), B('Dust and scratches', IK.dust, T('despeckle'), { big: true }), B('JPEG blocks', IK.jpeg, T('deblock'), { big: true, title: 'Remove JPEG blocks and smudges' }), B('Undither', IK.undither, T('undither'), { big: true, title: 'Blend dithering dots back into smooth colour' }), B('Banding', IK.undither, T('deband'), { big: true, title: 'Smooth out stripes in skies and shadows (banding)' }), B('Descreen', IK.undither, T('descreen'), { big: true, title: 'Printing dots (newspaper, yearbook, magazine) measured and smoothed away' })]],
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
        ['Show', [B('Compare', IK.compare, () => openTool('compare'), { big: true, title: 'Versions together: side by side, a grid of up to four, a split, or the differences (any picture, any step)' }), B('Before / after', IK.compare, toggleCompare, { pressed: () => view.compare, title: 'The dragging line between the picture and its original (or before the open tool)' }), B('Duplicate picture', I.folder, duplicatePic, { title: 'A copy of the picture as it is now, to try different steps on' }), B('Colour info', IK.colour, () => { view.loupe = !view.loupe; try { localStorage.setItem('imagecraft-loupe', view.loupe ? 'on' : 'off'); } catch (e) { /* blocked storage */ } if (!view.loupe && $('loupe')) $('loupe').hidden = true; }, { pressed: () => view.loupe, title: 'A small table beside the mouse: the colour under it in HEX, RGB, CMYK, HSL, Lab and its nearest name' }), B('Pixel grid', IK.grid, () => { view.grid = !view.grid; layout(); if (view.grid && view.zoom < 6) toast('The grid shows from 600% zoom.'); }, { big: true, pressed: () => view.grid })]],
        ['AI', [B('AI settings', IK.modern, () => openAI(), { big: true, always: true, title: 'Built-in AI models, Ollama, and your own Claude, Gemini and OpenAI keys (also the AI button in the status bar)' })]],
        ['Debug', [B('Debug log', I.console, () => openDebug(), { big: true, always: true, title: 'Errors and what happened (also the bug button in the status bar)' })]],
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
  window.ImageCraft = { recipeOf: () => pic() && recipeOf(pic()), runRecipe: (rec) => runRecipe(rec), snapShapes, openFiles, addPic, openTool, applyTool, closeTool, quick, openSave, openBatch, undo, redo, sample, pics: () => pics, current: () => pic(), tool: () => tool, view, prepared, TOOLS };
})();

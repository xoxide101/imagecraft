/* Craft barcode (window.CraftBarcode): barcodes for every Craft app, from BarcodeCraft. Each app keeps its own copy of
   this file and of lib/bwip-js-min.js (bwip-js, MIT: every symbology of Barcode Writer in Pure PostScript).
   Barcodes are made as SVG in real units (millimetres), so they print sharp at any size; a PNG is drawn from that at the
   DPI asked for (whole pixels per module where it can).
     CraftBarcode.TYPES                         the barcode types: { id, name, sample, kind: linear | 2d | postal, bcid, group }
     CraftBarcode.make({ type, value, wmm, hmm, text: true, fg, ecc, cols, logo, logoPct }) → { svg, wmm, hmm, type, value }
       logo: a picture in the middle of a QR code (a data: URL, kept in the barcode itself), logoPct: its width (% of the code)
     CraftBarcode.png(made, dpi) → Promise<Blob>         CraftBarcode.dataUrl(made, dpi) → Promise<string>
     CraftBarcode.vcard({ name, phone, email, org, title }) → the text of a contact card (for a QR code)
     CraftBarcode.contents.list / build(id, fields) / parse(text) → { id, v }   what a 2D code is for: website, email, phone,
       text message, WhatsApp, Wi-Fi, contact (vCard, MeCard), calendar event, place or address on a map, plain text
     CraftBarcode.addSource(name, () => [{ label, value, type?, group? }])   information this app offers to the window
     CraftBarcode.library() / save(entry) / remove(id)   saved barcodes (this browser; logged in: your account too)
     CraftBarcode.open({ app, value, type, content: 'vcard', onInsert(made) })   the Insert › Barcode window (content: what
       the QR code is for at first, e.g. 'wifi', 'vcard', 'event', 'url') */
(function () {
  'use strict';
  const TYPES = [
    { id: 'CODE128', name: 'Code 128', sample: 'ABC-12345', kind: 'linear', bcid: 'code128', group: 'Linear' },
    { id: 'GS1_128', name: 'GS1-128', sample: '(01)09501101530003', kind: 'linear', bcid: 'gs1-128', group: 'Linear' },
    { id: 'CODE39', name: 'Code 39', sample: 'ABC-123', kind: 'linear', bcid: 'code39', group: 'Linear' },
    { id: 'CODE39EXT', name: 'Code 39 Extended', sample: 'abc-123', kind: 'linear', bcid: 'code39ext', group: 'Linear' },
    { id: 'CODE93', name: 'Code 93', sample: 'ABC-123', kind: 'linear', bcid: 'code93', group: 'Linear' },
    { id: 'CODE93EXT', name: 'Code 93 Extended', sample: 'abc-123', kind: 'linear', bcid: 'code93ext', group: 'Linear' },
    { id: 'CODE11', name: 'Code 11', sample: '123-45', kind: 'linear', bcid: 'code11', group: 'Linear' },
    { id: 'CODABAR', name: 'Codabar', sample: 'A12345B', kind: 'linear', bcid: 'rationalizedCodabar', group: 'Linear' },
    { id: 'CODE2OF5', name: 'Code 2 of 5', sample: '12345670', kind: 'linear', bcid: 'code2of5', group: 'Linear' },
    { id: 'INTERLEAVED2OF5', name: 'Interleaved 2 of 5', sample: '1234567890', kind: 'linear', bcid: 'interleaved2of5', group: 'Linear' },
    { id: 'IATA2OF5', name: 'IATA 2 of 5', sample: '1234567890', kind: 'linear', bcid: 'iata2of5', group: 'Linear' },
    { id: 'MATRIX2OF5', name: 'Matrix 2 of 5', sample: '1234567890', kind: 'linear', bcid: 'matrix2of5', group: 'Linear' },
    { id: 'ITF14', name: 'ITF-14', sample: '15400141288763', kind: 'linear', bcid: 'itf14', group: 'Linear' },
    { id: 'EAN13', name: 'EAN-13', sample: '5901234123457', kind: 'linear', bcid: 'ean13', group: 'Linear' },
    { id: 'EAN8', name: 'EAN-8', sample: '96385074', kind: 'linear', bcid: 'ean8', group: 'Linear' },
    { id: 'EAN2', name: 'EAN-2', sample: '12', kind: 'linear', bcid: 'ean2', group: 'Linear' },
    { id: 'EAN5', name: 'EAN-5', sample: '12345', kind: 'linear', bcid: 'ean5', group: 'Linear' },
    { id: 'ISBN', name: 'ISBN', sample: '978-0-306-40615-7', kind: 'linear', bcid: 'isbn', group: 'Linear' },
    { id: 'ISMN', name: 'ISMN', sample: '979-0-2306-7118-7', kind: 'linear', bcid: 'ismn', group: 'Linear' },
    { id: 'ISSN', name: 'ISSN', sample: '1234-5679', kind: 'linear', bcid: 'issn', group: 'Linear' },
    { id: 'UPCA', name: 'UPC-A', sample: '036000291452', kind: 'linear', bcid: 'upca', group: 'Linear' },
    { id: 'UPCE', name: 'UPC-E', sample: '01234565', kind: 'linear', bcid: 'upce', group: 'Linear' },
    { id: 'MSI', name: 'MSI', sample: '1234567', kind: 'linear', bcid: 'msi', group: 'Linear' },
    { id: 'PHARMACODE', name: 'Pharmacode', sample: '1234', kind: 'linear', bcid: 'pharmacode', group: 'Linear' },
    { id: 'PHARMACODE2', name: 'Pharmacode Two-Track', sample: '1234', kind: 'linear', bcid: 'pharmacode2', group: 'Linear' },
    { id: 'PLESSEY', name: 'Plessey', sample: 'ABCDEF', kind: 'linear', bcid: 'plessey', group: 'Linear' },
    { id: 'TELEPEN', name: 'Telepen', sample: '12345678', kind: 'linear', bcid: 'telepen', group: 'Linear' },
    { id: 'TELEPENNUMERIC', name: 'Telepen Numeric', sample: '12345678', kind: 'linear', bcid: 'telepennumeric', group: 'Linear' },
    { id: 'POSICODE', name: 'PosiCode', sample: '1234567890', kind: 'linear', bcid: 'posicode', group: 'Linear' },
    { id: 'BC412', name: 'BC412', sample: '1234567890', kind: 'linear', bcid: 'bc412', group: 'Linear' },
    { id: 'CODE16K', name: 'Code 16K', sample: '1234567890', kind: 'linear', bcid: 'code16k', group: 'Linear' },
    { id: 'CODE49', name: 'Code 49', sample: '1234567890', kind: 'linear', bcid: 'code49', group: 'Linear' },
    { id: 'CHANNELCODE', name: 'Channel Code', sample: '12345', kind: 'linear', bcid: 'channelcode', group: 'Linear' },
    { id: 'DAFT', name: 'DAFT', sample: 'DAFT', kind: 'linear', bcid: 'daft', group: 'Linear' },
    { id: 'PZN', name: 'PZN', sample: '123456', kind: 'linear', bcid: 'pzn', group: 'Linear' },
    { id: 'LEITCODE', name: 'Leitcode', sample: '1234567890123', kind: 'linear', bcid: 'leitcode', group: 'Linear' },
    { id: 'IDENTCODE', name: 'Identcode', sample: '12345678901', kind: 'linear', bcid: 'identcode', group: 'Linear' },
    { id: 'FLATTERMARKEN', name: 'Flattermarken', sample: '12345678', kind: 'linear', bcid: 'flattermarken', group: 'Linear' },
    { id: 'QRCODE', name: 'QR code', sample: 'https://example.com', kind: '2d', bcid: 'qrcode', group: '2D & QR' },
    { id: 'MICROQRCODE', name: 'Micro QR code', sample: '1234567890', kind: '2d', bcid: 'microqrcode', group: '2D & QR' },
    { id: 'PDF417', name: 'PDF417', sample: 'BarCraft PDF417 sample', kind: '2d', bcid: 'pdf417', group: '2D & QR' },
    { id: 'MICROPDF417', name: 'Micro PDF417', sample: 'BC-000123', kind: '2d', bcid: 'micropdf417', group: '2D & QR' },
    { id: 'PDF417COMPACT', name: 'PDF417 Compact', sample: 'BarCraft PDF417 sample', kind: '2d', bcid: 'pdf417compact', group: '2D & QR' },
    { id: 'DATAMATRIX', name: 'Data Matrix', sample: 'BC-000123-A14', kind: '2d', bcid: 'datamatrix', group: '2D & QR' },
    { id: 'DATAMATRIXRECTANGULAR', name: 'Data Matrix Rectangular', sample: 'BC-000123-A14', kind: '2d', bcid: 'datamatrixrectangular', group: '2D & QR' },
    { id: 'DATAMATRIXRECTANGULAREXTENSION', name: 'Data Matrix Rect Extension', sample: 'BC-000123-A14', kind: '2d', bcid: 'datamatrixrectangularextension', group: '2D & QR' },
    { id: 'AZTEC', name: 'Aztec', sample: 'https://example.com', kind: '2d', bcid: 'azteccode', group: '2D & QR' },
    { id: 'AZTECCOMPACT', name: 'Aztec Compact', sample: 'https://example.com', kind: '2d', bcid: 'azteccodecompact', group: '2D & QR' },
    { id: 'AZTECRUNE', name: 'Aztec Rune', sample: '123', kind: '2d', bcid: 'aztecrune', group: '2D & QR' },
    { id: 'MAXICODE', name: 'MaxiCode', sample: '152382802000000', kind: '2d', bcid: 'maxicode', group: '2D & QR' },
    { id: 'HANXIN', name: 'Han Xin', sample: '1234567890', kind: '2d', bcid: 'hanxin', group: '2D & QR' },
    { id: 'DOTCODE', name: 'DotCode', sample: '1234567890', kind: '2d', bcid: 'dotcode', group: '2D & QR' },
    { id: 'CODEONE', name: 'Code One', sample: '1234567890', kind: '2d', bcid: 'codeone', group: '2D & QR' },
    { id: 'ULTRACODE', name: 'UltraCode', sample: '1234567890', kind: '2d', bcid: 'ultracode', group: '2D & QR' },
    { id: 'CODABLOCKF', name: 'Codablock F', sample: '1234567890', kind: '2d', bcid: 'codablockf', group: '2D & QR' },
    { id: 'GS1QRCODE', name: 'GS1 QR Code', sample: '(01)09501101530003', kind: '2d', bcid: 'gs1qrcode', group: '2D & QR' },
    { id: 'GS1DATAMATRIX', name: 'GS1 Data Matrix', sample: '(01)09501101530003', kind: '2d', bcid: 'gs1datamatrix', group: '2D & QR' },
    { id: 'POSTNET', name: 'Postnet', sample: '123456789', kind: 'postal', bcid: 'postnet', group: 'Postal' },
    { id: 'PLANET', name: 'PLANET', sample: '12345678901', kind: 'postal', bcid: 'planet', group: 'Postal' },
    { id: 'ONECODE', name: 'OneCode (Intelligent Mail)', sample: '01234567094987654321', kind: 'postal', bcid: 'onecode', group: 'Postal' },
    { id: 'ROYALMAIL', name: 'Royal Mail', sample: '1234567890', kind: 'postal', bcid: 'royalmail', group: 'Postal' },
    { id: 'KIX', name: 'KIX', sample: '1234567890', kind: 'postal', bcid: 'kix', group: 'Postal' },
    { id: 'JAPANPOST', name: 'Japan Post', sample: '1234567890', kind: 'postal', bcid: 'japanpost', group: 'Postal' },
    { id: 'HIBCCode128', name: 'HIBC Code 128', sample: 'A123BJC5H17', kind: 'linear', bcid: 'hibccode128', group: 'HIBC' },
    { id: 'HIBCCode39', name: 'HIBC Code 39', sample: 'A123BJC5H17', kind: 'linear', bcid: 'hibccode39', group: 'HIBC' },
    { id: 'HIBCCodablockF', name: 'HIBC Codablock F', sample: 'A123BJC5H17', kind: '2d', bcid: 'hibccodablockf', group: 'HIBC' },
    { id: 'HIBCAztec', name: 'HIBC Aztec', sample: 'A123BJC5H17', kind: '2d', bcid: 'hibcazteccode', group: 'HIBC' },
    { id: 'HIBCDataMatrix', name: 'HIBC Data Matrix', sample: 'A123BJC5H17', kind: '2d', bcid: 'hibcdatamatrix', group: 'HIBC' },
    { id: 'HIBCMicroPDF417', name: 'HIBC Micro PDF417', sample: 'A123BJC5H17', kind: '2d', bcid: 'hibcmicropdf417', group: 'HIBC' },
    { id: 'HIBCQRCode', name: 'HIBC QR Code', sample: 'A123BJC5H17', kind: '2d', bcid: 'hibcqrcode', group: 'HIBC' },
    { id: 'HIBCPDF417', name: 'HIBC PDF417', sample: 'A123BJC5H17', kind: '2d', bcid: 'hibcpdf417', group: 'HIBC' }
  ];
  const BCID = Object.fromEntries(TYPES.map((t) => [t.id, t.bcid]));
  const typeOf = (id) => TYPES.find((t) => t.id === id) || TYPES[0];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n) => +(+n).toFixed(3);

  // ------------------------------------------------------------------ making one
  function make(o) {
    const t = typeOf(o.type), lin = t.kind !== '2d';
    o = { value: t.sample, wmm: lin ? 50 : 30, hmm: lin ? 20 : 30, text: lin, fg: '#000000', bg: '#ffffff', quiet: true, ecc: 'M', cols: 0, ...o, type: t.id };
    let vb, vw, vh, shapes, u = lin ? 1 : 2;   // (u: bwip-js draws a module as 1 unit in linear codes, 2 in 2D ones)
    if (t.id === 'QRCODE' && typeof window.qrcode === 'function') {
      // QR codes: qrcode-generator (Kazuhiko Arase, MIT) in UTF-8, which every phone reads (bwip-js's QR codes with accented
      // letters did not read back); one unit a module
      const Q = window.qrcode; if (Q.stringToBytesFuncs && Q.stringToBytesFuncs['UTF-8']) Q.stringToBytes = Q.stringToBytesFuncs['UTF-8'];
      let q; try { q = Q(0, o.ecc || 'M'); q.addData(String(o.value || ' '), 'Byte'); q.make(); } catch (e) { throw new Error('That is too much for a QR code: make it shorter, or choose a lower error correction.'); }
      const n = q.getModuleCount(); let d = '';
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
      vb = [0, 0, n, n]; vw = vh = n; u = 1; shapes = `<path d="${d}" fill="${esc(o.fg)}"/>`;
    } else {
      if (!window.bwipjs) throw new Error('The barcode library (bwip-js) did not load.');
      // 2D codes carry text as UTF-8 (what phones expect): the UTF-8 bytes go in, each as it is (binarytext)
      const utf8 = (x) => Array.from(new TextEncoder().encode(x), (b) => String.fromCharCode(b)).join('');
      const nonAscii = t.kind === '2d' && /[^\x00-\x7f]/.test(String(o.value));
      const opts = { bcid: BCID[t.id] || t.id.toLowerCase(), text: nonAscii ? utf8(String(o.value)) : String(o.value || ' '), scale: 1, includetext: false, barcolor: String(o.fg).replace('#', '') };
      if (nonAscii) opts.binarytext = true;
      if (t.id === 'PDF417' && o.cols) opts.columns = +o.cols;
      let inner;
      try { inner = window.bwipjs.toSVG(opts); }
      catch (e) { throw new Error(String(e.message || e).replace(/^bwipp\.\w+#\d+:\s*/, '').replace(/^\w/, (c) => c.toUpperCase())); }
      const d = new DOMParser().parseFromString(inner, 'image/svg+xml').documentElement;
      vb = (d.getAttribute('viewBox') || `0 0 ${d.getAttribute('width')} ${d.getAttribute('height')}`).split(/[\s,]+/).map(Number); vw = vb[2] || 1; vh = vb[3] || 1;
      shapes = [...d.children].map((n) => new XMLSerializer().serializeToString(n)).join('');
    }
    // linear and postal: the bars stretched to the size given, the text under them; 2D: square modules, the width given
    // the quiet zone scanners need (inside the size given): 10 modules each side of linear codes, 4 round 2D ones
    const q = (lin ? 10 : 4) * u;
    const W = +o.wmm, padX = o.quiet ? W * q / (vw + 2 * q) : 0, iw = W - 2 * padX, padY = o.quiet && !lin ? padX : 0;
    const textH = lin && o.text ? Math.min(+o.hmm * 0.3, 4) : 0, barsH = lin ? +o.hmm - textH : vh * iw / vw, H = lin ? +o.hmm : barsH + 2 * padY;
    const font = Math.min(textH * 0.82, iw / Math.max(4, String(o.value).length) * 1.6);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${num(W)}mm" height="${num(H)}mm" viewBox="0 0 ${num(W)} ${num(H)}">`
      + (o.bg && o.bg !== 'none' ? `<rect width="${num(W)}" height="${num(H)}" fill="${esc(o.bg)}"/>` : '')
      + `<g transform="translate(${num(padX)} ${num(padY)}) scale(${num(iw / vw)} ${num(barsH / vh)}) translate(${-vb[0]} ${-vb[1]})" shape-rendering="crispEdges">${shapes}</g>`
      + (o.logo && t.id === 'QRCODE' && /^data:image\//.test(o.logo) ? logoSvg(o.logo, padX, padY, iw, barsH, o.logoPct, o.bg) : '')
      + (textH ? `<text x="${num(W / 2)}" y="${num(barsH + textH * 0.86)}" font-family="'Courier New', Consolas, monospace" font-size="${num(font)}" text-anchor="middle" fill="${esc(o.fg)}">${esc(o.value)}</text>` : '')
      + '</svg>';
    return { svg, wmm: num(W), hmm: num(H), type: t.id, value: String(o.value), text: !!o.text, fg: o.fg, bg: o.bg, ecc: o.ecc, cols: o.cols, ...(o.logo && t.id === 'QRCODE' ? { logo: o.logo, logoPct: o.logoPct || 22, logoName: o.logoName || '' } : {}) };
  }
  // the picture in the middle: on a plain patch (the code's background), its share of the code's width (at most 30%, so
  // a phone still reads it: use error correction H with a picture)
  function logoSvg(src, x0, y0, w, h, pct, bg) {
    const k = Math.min(30, Math.max(8, +pct || 22)) / 100, s = w * k, pad = s * 0.12, cx = x0 + w / 2, cy = y0 + h / 2;
    return `<rect x="${num(cx - s / 2 - pad)}" y="${num(cy - s / 2 - pad)}" width="${num(s + 2 * pad)}" height="${num(s + 2 * pad)}" rx="${num(pad)}" fill="${esc(bg && bg !== 'none' ? bg : '#ffffff')}"/>`
      + `<image x="${num(cx - s / 2)}" y="${num(cy - s / 2)}" width="${num(s)}" height="${num(s)}" preserveAspectRatio="xMidYMid meet" href="${esc(src)}"/>`;
  }
  // a picture made into data for a barcode: an SVG as it is when small, else a PNG at most 512 pixels across
  async function logoData(file) {
    if (/svg/.test(file.type) && file.size < 80000) { const t = await file.text(); return 'data:image/svg+xml;base64,' + btoa(Array.from(new TextEncoder().encode(t), (b) => String.fromCharCode(b)).join('')); }
    const url = URL.createObjectURL(file);
    try { const img = new Image(); img.src = url; await img.decode(); const n = Math.max(img.naturalWidth, img.naturalHeight) || 512, k = Math.min(1, 512 / n), c = document.createElement('canvas'); c.width = Math.max(1, Math.round((img.naturalWidth || 512) * k)); c.height = Math.max(1, Math.round((img.naturalHeight || 512) * k)); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c.toDataURL('image/png'); }
    finally { URL.revokeObjectURL(url); }
  }
  async function canvasOf(m, dpi = 300) {
    const W = Math.max(1, Math.round(m.wmm / 25.4 * dpi)), H = Math.max(1, Math.round(m.hmm / 25.4 * dpi));
    const url = URL.createObjectURL(new Blob([m.svg], { type: 'image/svg+xml' }));
    try {
      const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('The barcode could not be drawn.')); i.src = url; });
      const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
      g.imageSmoothingEnabled = !!m.logo; g.drawImage(img, 0, 0, W, H); return c;
    } finally { URL.revokeObjectURL(url); }
  }
  const png = async (m, dpi) => new Promise(async (ok) => (await canvasOf(m, dpi)).toBlob(ok, 'image/png'));
  const dataUrl = async (m, dpi) => (await canvasOf(m, dpi)).toDataURL('image/png');
  function vcard(p) {
    const e = (t) => String(t || '').replace(/([\\;,])/g, '\\$1').replace(/\r?\n/g, '\\n');
    const parts = String(p.name || '').trim().split(/\s+/), last = parts.length > 1 ? parts.pop() : '', first = parts.join(' ');
    return ['BEGIN:VCARD', 'VERSION:3.0', `N:${e(last)};${e(first)};;;`, `FN:${e(p.name)}`, p.org ? `ORG:${e(p.org)}` : '', p.title ? `TITLE:${e(p.title)}` : '',
      p.phone ? `TEL;TYPE=CELL:${e(p.phone)}` : '', p.email ? `EMAIL;TYPE=INTERNET:${e(p.email)}` : '', p.url ? `URL:${e(p.url)}` : '', 'END:VCARD'].filter(Boolean).join('\r\n');
  }

  // ------------------------------------------------------------------ what the app offers, and the library
  const sources = [];
  function addSource(name, list) { const i = sources.findIndex((s) => s.name === name); if (i >= 0) sources.splice(i, 1); sources.push({ name, list }); }
  const LIB = 'craft-barcodes';
  const library = () => { try { return JSON.parse(localStorage.getItem(LIB) || '[]'); } catch (e) { return []; } };
  const acct = () => (window.CraftAccount && CraftAccount.user() ? CraftAccount : null);
  function keep(list) { try { localStorage.setItem(LIB, JSON.stringify(list)); } catch (e) { /* full */ } const A = acct(); if (A) A.put('craft', 'barcodes', list).catch(() => {}); window.dispatchEvent(new CustomEvent('craft-barcodes')); }
  function save(entry) { const list = library().filter((x) => x.id !== entry.id); const e = { id: entry.id || 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: entry.name || entry.value, type: entry.type, value: entry.value, wmm: entry.wmm, hmm: entry.hmm, text: entry.text, fg: entry.fg, ecc: entry.ecc, ...(entry.logo ? { logo: entry.logo, logoPct: entry.logoPct, logoName: entry.logoName } : {}), saved: new Date().toISOString() }; list.unshift(e); keep(list); return e; }
  function remove(id) { keep(library().filter((x) => x.id !== id)); }
  // logged in: the account's library and this browser's are put together (newest of each kept)
  async function pull() { const A = acct(); if (!A) return; try { const got = (await A.get('craft', 'barcodes')) || []; const all = new Map(); [...got, ...library()].forEach((x) => { const o = all.get(x.id); if (!o || (x.saved || '') > (o.saved || '')) all.set(x.id, x); }); const list = [...all.values()].sort((a, b) => (b.saved || '').localeCompare(a.saved || '')); try { localStorage.setItem(LIB, JSON.stringify(list)); } catch (e) { /* full */ } if (list.length !== got.length) A.put('craft', 'barcodes', list).catch(() => {}); } catch (e) { /* later */ } }
  window.addEventListener('craft-account', pull);


  // ------------------------------------------------------------------ what a barcode is for (the helpers)
  // A QR code (and the other 2D codes) can hold a website, an email, a phone call, a text message, a Wi-Fi network, a
  // contact card, a calendar event, a place on a map…: each in the standard form phones understand. Each kind has a small
  // form; build() makes the text, parse() reads it back (to change a saved one).
  const lines = (a) => a.filter((x) => x !== null && x !== undefined && x !== false && x !== '').join('\r\n');
  const eV = (t) => String(t || '').replace(/([\\;,])/g, '\\$1').replace(/\r?\n/g, '\\n');          // vCard / iCal text
  const eW = (t) => String(t || '').replace(/([\\;,":])/g, '\\$1');                                // Wi-Fi, MeCard
  const uV = (t) => String(t || '').replace(/\\n/gi, '\n').replace(/\\([\\;,":])/g, '$1');
  const field = (s, k) => { const m = new RegExp('(?:^|\\r?\\n)' + k + '(?:;[^:\\r\\n]*)?:([^\\r\\n]*)', 'i').exec(s); return m ? uV(m[1]) : ''; };
  const meField = (s, k) => { const m = new RegExp('[:;]' + k + ':((?:\\\\.|[^;\\\\])*)', 'i').exec(s); return m ? uV(m[1]) : ''; };
  const icalWhen = (v, allDay) => { if (!v) return ''; const d = v.replace(/[-:]/g, ''); return allDay ? d.slice(0, 8) : (d.length === 13 ? d + '00' : d.slice(0, 15)); };
  const fromIcal = (v) => { const m = /^(\d{4})(\d\d)(\d\d)(?:T(\d\d)(\d\d))?/.exec(v || ''); return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4] || '09'}:${m[5] || '00'}` : ''; };
  const nextDay = (d) => { const t = new Date(d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8) + 1); return `${t.getFullYear()}${String(t.getMonth() + 1).padStart(2, '0')}${String(t.getDate()).padStart(2, '0')}`; };
  const CONTENTS = [
    { id: 'text', label: 'Plain text', f: [['text', 'Text', 'area']], build: (v) => v.text || '', parse: (s) => ({ text: s }) },
    { id: 'url', label: 'Website', hint: 'Opens the page when scanned.', f: [['url', 'Web address', 'url', 'example.com/page']],
      build: (v) => { const u = (v.url || '').trim(); return !u ? '' : /^[a-z][\w+.-]*:/i.test(u) ? u : 'https://' + u; }, parse: (s) => (/^https?:\/\/\S+$/i.test(s.trim()) ? { url: s.trim() } : null) },
    { id: 'email', label: 'Email', hint: 'Opens a new email, ready to send.', f: [['to', 'To', 'email', 'name@example.com'], ['subject', 'Subject'], ['body', 'Message', 'area']],
      build: (v) => { const q = [v.subject && 'subject=' + encodeURIComponent(v.subject), v.body && 'body=' + encodeURIComponent(v.body)].filter(Boolean).join('&'); return 'mailto:' + (v.to || '').trim() + (q ? '?' + q : ''); },
      parse: (s) => { const m = /^mailto:([^?]*)(?:\?([\s\S]*))?$/i.exec(s.trim()); if (!m) return null; const p = new URLSearchParams((m[2] || '').replace(/\+/g, '%2B')); return { to: decodeURIComponent(m[1]), subject: p.get('subject') || '', body: p.get('body') || '' }; } },
    { id: 'phone', label: 'Phone call', hint: 'Dials the number when scanned.', f: [['number', 'Phone number', 'tel', '+1 555 010 0100']],
      build: (v) => 'tel:' + (v.number || '').replace(/[^\d+*#,;]/g, ''), parse: (s) => (/^tel:/i.test(s.trim()) ? { number: s.trim().slice(4) } : null) },
    { id: 'sms', label: 'Text message (SMS)', hint: 'Opens a text message to the number, with the message filled in.', f: [['number', 'Phone number', 'tel', '+1 555 010 0100'], ['message', 'Message', 'area']],
      build: (v) => 'SMSTO:' + (v.number || '').replace(/[^\d+]/g, '') + ':' + (v.message || ''),
      parse: (s) => { let m = /^SMSTO:([^:]*):?([\s\S]*)$/i.exec(s); if (m) return { number: m[1], message: m[2] }; m = /^sms:([^?]*)(?:\?body=([\s\S]*))?$/i.exec(s); return m ? { number: m[1], message: decodeURIComponent(m[2] || '') } : null; } },
    { id: 'whatsapp', label: 'WhatsApp message', hint: 'Opens a WhatsApp chat with the number (country code first, no 00 or +).', f: [['number', 'Phone number with country code', 'tel', '+1 555 010 0100'], ['message', 'Message', 'area']],
      build: (v) => 'https://wa.me/' + (v.number || '').replace(/\D/g, '') + (v.message ? '?text=' + encodeURIComponent(v.message) : ''),
      parse: (s) => { const m = /^https:\/\/wa\.me\/(\d*)(?:\?text=([\s\S]*))?$/i.exec(s.trim()); return m ? { number: '+' + m[1], message: decodeURIComponent(m[2] || '') } : null; } },
    { id: 'wifi', label: 'Wi-Fi network', hint: 'Phones join the network when scanned (no typing the password).', f: [['ssid', 'Network name (SSID)'], ['password', 'Password'], ['sec', 'Security', 'select', [['WPA', 'WPA / WPA2'], ['SAE', 'WPA3'], ['WEP', 'WEP (old)'], ['nopass', 'None (open network)']]], ['hidden', 'Hidden network', 'check']],
      build: (v) => { const sec = v.sec || 'WPA'; return `WIFI:T:${sec};S:${eW(v.ssid)};${sec === 'nopass' ? '' : `P:${eW(v.password)};`}${v.hidden ? 'H:true;' : ''};`; },
      parse: (s) => (/^WIFI:/i.test(s) ? { ssid: meField(s, 'S'), password: meField(s, 'P'), sec: meField(s, 'T') || 'nopass', hidden: /[:;]H:true/i.test(s) } : null) },
    { id: 'vcard', label: 'Contact card (vCard)', hint: 'Phones offer to save the contact.', f: [['first', 'First name'], ['last', 'Last name'], ['org', 'Company'], ['title', 'Job title'], ['mobile', 'Mobile', 'tel'], ['work', 'Work phone', 'tel'], ['email', 'Email', 'email'], ['url', 'Website', 'url'], ['street', 'Street'], ['city', 'City'], ['region', 'State / region'], ['zip', 'Postcode / ZIP'], ['country', 'Country'], ['note', 'Note', 'area']],
      build: (v) => lines(['BEGIN:VCARD', 'VERSION:3.0', `N:${eV(v.last)};${eV(v.first)};;;`, `FN:${eV([v.first, v.last].filter(Boolean).join(' ') || v.org)}`, v.org && `ORG:${eV(v.org)}`, v.title && `TITLE:${eV(v.title)}`,
        v.mobile && `TEL;TYPE=CELL:${eV(v.mobile)}`, v.work && `TEL;TYPE=WORK,VOICE:${eV(v.work)}`, v.email && `EMAIL;TYPE=INTERNET:${eV(v.email)}`, v.url && `URL:${eV(v.url)}`,
        (v.street || v.city || v.region || v.zip || v.country) && `ADR;TYPE=WORK:;;${eV(v.street)};${eV(v.city)};${eV(v.region)};${eV(v.zip)};${eV(v.country)}`, v.note && `NOTE:${eV(v.note)}`, 'END:VCARD']),
      parse: (s) => { if (!/^BEGIN:VCARD/i.test(s.trim())) return null; const n = field(s, 'N').split(/(?<!\\);/), a = field(s, 'ADR').split(/(?<!\\);/), tel = (k) => { const m = new RegExp('(?:^|\\n)TEL[^:\\n]*' + k + '[^:\\n]*:([^\\r\\n]*)', 'i').exec(s); return m ? uV(m[1]) : ''; };
        const fn = field(s, 'FN'); return { first: n[1] || (n.length < 2 ? fn.split(' ').slice(0, -1).join(' ') : ''), last: n[0] || '', org: field(s, 'ORG').replace(/;$/, ''), title: field(s, 'TITLE'), mobile: tel('CELL') || field(s, 'TEL'), work: tel('WORK'), email: field(s, 'EMAIL'), url: field(s, 'URL'), street: a[2] || '', city: a[3] || '', region: a[4] || '', zip: a[5] || '', country: a[6] || '', note: field(s, 'NOTE') }; } },
    { id: 'mecard', label: 'Contact card, short (MeCard)', hint: 'A smaller contact code than a vCard (fewer squares, easier to scan small).', f: [['name', 'Name'], ['phone', 'Phone', 'tel'], ['email', 'Email', 'email'], ['url', 'Website', 'url'], ['address', 'Address'], ['note', 'Note']],
      build: (v) => `MECARD:N:${eW(v.name)};${v.phone ? `TEL:${eW(v.phone)};` : ''}${v.email ? `EMAIL:${eW(v.email)};` : ''}${v.url ? `URL:${eW(v.url)};` : ''}${v.address ? `ADR:${eW(v.address)};` : ''}${v.note ? `NOTE:${eW(v.note)};` : ''};`,
      parse: (s) => (/^MECARD:/i.test(s) ? { name: meField(s, 'N'), phone: meField(s, 'TEL'), email: meField(s, 'EMAIL'), url: meField(s, 'URL'), address: meField(s, 'ADR'), note: meField(s, 'NOTE') } : null) },
    { id: 'event', label: 'Calendar event', hint: 'Phones offer to add the event to the calendar.', f: [['title', 'What'], ['start', 'Starts', 'datetime-local'], ['end', 'Ends', 'datetime-local'], ['allday', 'All day', 'check'], ['where', 'Where'], ['notes', 'Notes', 'area']],
      build: (v) => { const s0 = icalWhen(v.start, v.allday), e0 = icalWhen(v.end || v.start, v.allday); return lines(['BEGIN:VEVENT', `SUMMARY:${eV(v.title)}`, s0 && (v.allday ? `DTSTART;VALUE=DATE:${s0}` : `DTSTART:${s0}`), e0 && (v.allday ? `DTEND;VALUE=DATE:${nextDay(e0)}` : `DTEND:${e0}`), v.where && `LOCATION:${eV(v.where)}`, v.notes && `DESCRIPTION:${eV(v.notes)}`, 'END:VEVENT']); },
      parse: (s) => { if (!/BEGIN:VEVENT/i.test(s)) return null; const ds = field(s, 'DTSTART'), de = field(s, 'DTEND'), all = /DTSTART;VALUE=DATE/i.test(s); return { title: field(s, 'SUMMARY'), start: fromIcal(ds), end: all && de ? fromIcal(String(Number(de) - 1)) : fromIcal(de), allday: all, where: field(s, 'LOCATION'), notes: field(s, 'DESCRIPTION') }; } },
    { id: 'geo', label: 'Place on a map (latitude, longitude)', hint: 'Opens the place in the phone’s map app.', f: [['lat', 'Latitude', 'text', '40.7128'], ['lng', 'Longitude', 'text', '-74.0060'], ['label', 'Name of the place']],
      build: (v) => { const p = `${(v.lat || '').trim()},${(v.lng || '').trim()}`; return `geo:${p}${v.label ? `?q=${p}(${encodeURIComponent(v.label)})` : ''}`; },
      parse: (s) => { const m = /^geo:([-\d.]+),([-\d.]+)(?:\?q=[^(]*\(([^)]*)\))?/i.exec(s.trim()); return m ? { lat: m[1], lng: m[2], label: decodeURIComponent(m[3] || '') } : null; } },
    { id: 'maps', label: 'Address on a map', hint: 'Opens a map search for the address (works on every phone).', f: [['address', 'Address', 'area']],
      build: (v) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent((v.address || '').trim()),
      parse: (s) => { const m = /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=(.*)$/i.exec(s.trim()); return m ? { address: decodeURIComponent(m[1]) } : null; } },
  ];
  const CONTENT_ORDER = ['wifi', 'vcard', 'mecard', 'event', 'email', 'phone', 'sms', 'whatsapp', 'maps', 'geo', 'url', 'text'];
  // the 2D codes that hold any text (not the GS1 / HIBC ones, Aztec Rune or MaxiCode, which hold set numbers)
  const TAKES_CONTENT = ['QRCODE', 'MICROQRCODE', 'AZTEC', 'AZTECCOMPACT', 'DATAMATRIX', 'DATAMATRIXRECTANGULAR', 'DATAMATRIXRECTANGULAREXTENSION', 'PDF417', 'MICROPDF417', 'PDF417COMPACT', 'DOTCODE', 'HANXIN', 'CODEONE', 'ULTRACODE', 'CODABLOCKF'];
  const contentOf = (id) => CONTENTS.find((c) => c.id === id) || CONTENTS[0];
  function parseContent(s) { s = String(s || ''); for (const id of CONTENT_ORDER) { const c = contentOf(id); let v = null; try { v = c.parse(s); } catch (e) { v = null; } if (v) return { id, v }; } return { id: 'text', v: { text: s } }; }
  const buildContent = (id, v) => contentOf(id).build(v || {});
  // what each kind of barcode is for, and what goes in it (from BarCraft)
  const HINTS = {
    CODE128: ['General use', 'Any letters, digits and signs: the usual barcode for labels, stock and shipping.'],
    CODE39: ['General use', 'Capital letters A–Z, digits and - . $ / + % and space. Many older scanners read only this.'],
    GS1_128: ['Supply chain / GS1', 'Application Identifiers in parentheses, e.g. (01)09501101530003.'],
    ITF14: ['Shipping carton', 'A GTIN-14 carton number: 13 digits plus a check digit.'],
    EAN13: ['Retail / EAN', '12 or 13 digits (the check digit is added if needed).'], EAN8: ['Retail / EAN', '7 or 8 digits (the check digit is added if needed).'],
    EAN2: ['Retail / EAN add-on', '2 digits for an issue or supplement.'], EAN5: ['Retail / EAN add-on', '5 digits, usually a price.'],
    UPCA: ['Retail / UPC', 'US retail number: 11 or 12 digits (the check digit is added if needed).'], UPCE: ['Retail / UPC', 'Compressed US retail number: 7 or 8 digits.'],
    ISBN: ['Books', 'ISBN: 10 or 13 digits, hyphens optional.'], ISMN: ['Music', 'ISMN: 13 digits.'], ISSN: ['Serials', 'ISSN: 7 or 8 digits.'],
    PZN: ['Pharmacy / Germany', 'PZN product number: 7 digits.'], LEITCODE: ['Postal / Germany', 'Leitcode routing code: 13 digits.'], IDENTCODE: ['Postal / Germany', 'Identcode tracking code: 11 digits.'],
    PHARMACODE: ['Pharmaceutical', 'A pack number, usually 3–131070.'], PHARMACODE2: ['Pharmaceutical', 'A pack number on two tracks.'],
    POSTNET: ['Postal / USPS', 'ZIP (5), ZIP+4 (9) or delivery point (11) digits.'], PLANET: ['Postal / USPS', 'Tracking: 11 digits.'], ONECODE: ['Postal / USPS', 'Intelligent Mail: 20, 25, 29 or 31 digits.'],
    ROYALMAIL: ['Postal / UK', '4-state code: 8 or 9 letters and digits.'], KIX: ['Postal / Netherlands', 'KIX postal code: 11 characters.'], JAPANPOST: ['Postal / Japan', '7-digit postal code.'],
    MAXICODE: ['Shipping / UPS', 'Postal code, country code and service class, e.g. 152382802000000.'], AZTECRUNE: ['Compact number', 'A small number from 0 to 255.'],
    GS1QRCODE: ['Supply chain / GS1', 'Application Identifiers in parentheses, e.g. (01)09501101530003.'], GS1DATAMATRIX: ['Supply chain / GS1', 'Application Identifiers in parentheses, e.g. (01)09501101530003.'],
    MICROQRCODE: ['Small 2D', 'Up to about 35 digits or 21 letters: for tiny labels.'],
  };
  const hintFor = (id) => { if (HINTS[id]) return HINTS[id]; if (/^HIBC/.test(id)) return ['Healthcare / HIBC', 'A supplier label number, e.g. A123BJC5H17.']; if (TAKES_CONTENT.includes(id)) return ['2D', 'Anything: a website, contact, Wi-Fi, event… (choose what it is for above).']; return null; };
  // sizes people use (mm)
  const SIZES_2D = [[15, 'Tiny: 15 mm'], [20, 'Business card: 20 mm'], [25, 'Label: 25 mm'], [30, 'Flyer: 30 mm'], [40, 'Table tent / menu: 40 mm'], [60, 'Poster (A4 / Letter): 60 mm'], [100, 'Window or banner: 100 mm']];
  const SIZES_LIN = [['37.3x25.9', 'Retail EAN / UPC, 100%: 37.3 × 25.9 mm'], ['30x13', 'Small label: 30 × 13 mm'], ['50x20', 'Asset or shelf tag: 50 × 20 mm'], ['80x25', 'Shipping label (4 × 6 in): 80 × 25 mm'], ['100x30', 'Carton: 100 × 30 mm']];

  // ------------------------------------------------------------------ the window
  function css() {
    if (document.getElementById('cbc-css')) return;
    const s = document.createElement('style'); s.id = 'cbc-css'; s.textContent = `
.cbc-back{position:fixed;inset:0;background:rgba(0,0,0,.5);display:grid;place-items:center;z-index:9999;padding:16px;overscroll-behavior:contain}
.cbc{background:var(--panel,#1f2129);color:var(--text,var(--fg,#e8e9ee));border:1px solid var(--line,#3a3e4c);border-radius:12px;width:min(900px,100%);max-height:92vh;max-height:92dvh;min-height:0;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.5);font:14px/1.45 "Segoe UI",system-ui,sans-serif}
.cbc header{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--line,#3a3e4c)}.cbc header b{font-size:16px}
.cbc .body{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:14px 16px;overflow:auto;min-height:0;flex:1 1 auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y}@media(max-width:700px){.cbc .body{grid-template-columns:minmax(0,1fr)}}
@media(max-width:520px){.cbc-back{padding:6px}.cbc{border-radius:10px;max-height:98vh;max-height:98dvh}.cbc header,.cbc footer{padding:10px 12px}.cbc .body{padding:10px 12px;gap:10px}.cbc .prev{min-height:120px}.cbc footer button{flex:1 1 auto}.cbc input,.cbc select,.cbc textarea{font-size:16px}}
@media(pointer:coarse){.cbc button,.cbc select,.cbc input{min-height:40px}}
.cbc label{display:grid;gap:3px;margin:0 0 9px}.cbc .two{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.cbc input,.cbc select,.cbc textarea{padding:6px 8px;border-radius:7px;border:1px solid var(--line,#3a3e4c);background:var(--panel-2,var(--bg,#2a2d38));color:inherit;font:inherit;width:100%;box-sizing:border-box}
.cbc button{padding:6px 12px;border-radius:7px;border:1px solid var(--line,#3a3e4c);background:var(--panel-2,transparent);color:inherit;font:inherit;cursor:pointer}
.cbc button.main{background:var(--accent,#2f6fdd);border-color:var(--accent,#2f6fdd);color:#fff}
.cbc .prev{background:#fff;border-radius:8px;min-height:180px;display:grid;place-items:center;padding:12px}.cbc .prev img{max-width:100%;max-height:260px}
.cbc .err{color:#f87171;min-height:1.4em}.cbc .dim{color:var(--muted,var(--dim,#9aa0b0));font-size:12.5px}
.cbc .lib{display:flex;flex-direction:column;gap:4px;max-height:160px;overflow:auto;margin-top:6px;overscroll-behavior:contain;touch-action:pan-y}.cbc .lib button{text-align:left;display:flex;justify-content:space-between;gap:8px}
.cbc .cf2{display:grid;grid-template-columns:1fr 1fr;gap:0 8px;padding:8px 10px 0;margin:0 0 9px;border:1px solid var(--line,#3a3e4c);border-radius:8px;background:color-mix(in srgb,var(--accent,#2f6fdd) 6%,transparent)}.cbc .cf2 label{margin:0 0 7px}.cbc .cf2 .wide{grid-column:1/-1}.cbc .cf2 .ck{display:flex;gap:6px;align-items:center}.cbc .cf2 .ck input{width:auto}@media(max-width:520px){.cbc .cf2{grid-template-columns:minmax(0,1fr)}}.cbc .hint{margin:-5px 0 9px}
.cbc footer{display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;border-top:1px solid var(--line,#3a3e4c);flex-wrap:wrap}`; document.head.append(s);
  }
  function open({ app = 'Craft', value, type, entry, content, onInsert, title = 'Insert a barcode', insertLabel = 'Insert' } = {}) {
    css(); pull();
    document.querySelectorAll('.cbc-back').forEach((x) => x.remove());
    let cur = { type: type || 'QRCODE', value: value != null ? String(value) : '' };
    if (entry) cur = { ...entry };   // (an entry from the library, to change)
    const t0 = typeOf(cur.type); if (!cur.value) cur.value = t0.sample;
    const back = document.createElement('div'); back.className = 'cbc-back';
    const groups = [...new Set(TYPES.map((t) => t.group))];
    back.innerHTML = `<div class="cbc" role="dialog" aria-label="${esc(title)}"><header><b>${esc(title)}</b><span class="dim">${esc(app)} · BarcodeCraft</span></header>
      <div class="body"><div>
        <label><span>Kind of barcode</span><select data-f="type">${groups.map((g) => `<optgroup label="${esc(g)}">${TYPES.filter((t) => t.group === g).map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</optgroup>`).join('')}</select></label>
        ${sources.length ? `<label><span>From ${esc(app)}</span><select data-f="src"><option value="">Choose…</option>${sources.map((s, i) => { let items = []; try { items = s.list() || []; } catch (e) { items = []; } return `<optgroup label="${esc(s.name)}">${items.map((it, j) => `<option value="${i}:${j}">${esc(it.label)}</option>`).join('')}</optgroup>`; }).join('')}</select></label>` : ''}
        <label data-only="fmt"><span>What it is for</span><select data-f="fmt">${CONTENTS.map((c) => `<option value="${c.id}">${esc(c.label)}</option>`).join('')}</select></label>
        <div class="cf2" data-f="form" data-only="fmt"></div>
        <label><span>What it holds</span><textarea data-f="value" rows="3" spellcheck="false"></textarea></label>
        <div class="dim hint" data-f="hint"></div>
        <label><span>Size</span><select data-f="preset"></select></label>
        <div class="two"><label><span>Width (mm)</span><input data-f="wmm" type="number" min="5" max="500" step="0.5"></label><label data-only="lin"><span>Height (mm)</span><input data-f="hmm" type="number" min="3" max="300" step="0.5"></label></div>
        <div class="two"><label data-only="lin" style="display:flex;gap:6px;align-items:center"><input data-f="text" type="checkbox" style="width:auto"> Text under the bars</label><label><span>Colour</span><input data-f="fg" type="color" value="#000000" style="height:34px;padding:2px"></label></div>
        <label data-only="qr"><span>Error correction (QR)</span><select data-f="ecc"><option value="L">L: 7% (smallest)</option><option value="M" selected>M: 15%</option><option value="Q">Q: 25%</option><option value="H">H: 30% (survives damage, logos)</option></select></label>
        <div data-only="qr" style="display:grid;gap:3px;margin:0 0 9px"><span>Picture in the middle</span><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><span data-f="logoName" class="dim">None</span>${window.CraftClipartPicker ? '<button type="button" data-a="logoClip">Clip art…</button>' : ''}<button type="button" data-a="logoFile">Picture file…</button><button type="button" data-a="logoOff" hidden>Remove</button><select data-f="logoPct" title="Its size" hidden><option value="15">Small</option><option value="22" selected>Medium</option><option value="28">Large</option></select></div></div>
      </div><div>
        <div class="prev" data-f="prev"></div><div class="err" data-f="err"></div>
        <div class="dim">Saved barcodes (every Craft app${acct() ? ', and your account' : ''})</div><div class="lib" data-f="lib"></div>
      </div></div>
      <footer><button type="button" data-a="save" style="margin-right:auto">Save to the library</button><button type="button" data-a="close">Cancel</button><button type="button" class="main" data-a="insert">${esc(insertLabel)}</button></footer></div>`;
    document.body.append(back);
    const f = (k) => back.querySelector(`[data-f=${k}]`), close = () => back.remove();
    const sizeFor = (t) => (t.kind === '2d' ? { wmm: 30, hmm: 30 } : { wmm: 50, hmm: 20 });
    const fill = () => { const t = typeOf(cur.type), sz = sizeFor(t); f('type').value = t.id; f('type').dataset.was = t.id; f('value').value = cur.value; f('wmm').value = cur.wmm || sz.wmm; f('hmm').value = cur.hmm || sz.hmm; f('text').checked = cur.text ?? t.kind !== '2d'; f('fg').value = cur.fg || '#000000'; f('ecc').value = cur.ecc || 'M'; logo = cur.logo || ''; logoName = cur.logo ? cur.logoName || 'A picture' : ''; f('logoPct').value = String(cur.logoPct || 22); logoShow(); shows(); const pc = parseContent(cur.value); f('fmt').value = pc.id; formDraw(pc.v); };
    // the helper's form: what it is for → its fields → the text in the barcode
    const formDraw = (v = {}) => { const c = contentOf(f('fmt').value); f('form').innerHTML = c.f.map(([k, label, kind, ph]) => kind === 'check' ? `<label class="ck"><input type="checkbox" data-cf="${k}" ${v[k] ? 'checked' : ''}> ${esc(label)}</label>` : kind === 'select' ? `<label><span>${esc(label)}</span><select data-cf="${k}">${ph.map(([o, n]) => `<option value="${o}" ${v[k] === o ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>` : kind === 'area' ? `<label class="wide"><span>${esc(label)}</span><textarea data-cf="${k}" rows="2">${esc(v[k] || '')}</textarea></label>` : `<label${c.f.length === 1 ? ' class="wide"' : ''}><span>${esc(label)}</span><input data-cf="${k}" type="${kind || 'text'}" value="${esc(v[k] || '')}" placeholder="${esc(ph || '')}"></label>`).join('') + (c.hint ? `<div class="dim wide" style="margin:-2px 0 8px">${esc(c.hint)}</div>` : ''); };
    const formRead = () => { const v = {}; f('form').querySelectorAll('[data-cf]').forEach((x) => { v[x.dataset.cf] = x.type === 'checkbox' ? x.checked : x.value; }); return v; };
    const fromForm = () => { f('value').value = buildContent(f('fmt').value, formRead()); };
    const presets = () => { const t = typeOf(f('type').value), list = t.kind === '2d' ? SIZES_2D : SIZES_LIN, now = t.kind === '2d' ? String(+f('wmm').value) : `${+f('wmm').value}x${+f('hmm').value}`; f('preset').innerHTML = `<option value="">${list.some(([k]) => String(k) === now) ? 'Your own size' : 'Your own size (' + now.replace('x', ' × ') + ' mm)'}</option>` + list.map(([k, n]) => `<option value="${k}" ${String(k) === now ? 'selected' : ''}>${esc(n)}</option>`).join(''); };
    const hintDraw = () => { const h = hintFor(f('type').value); f('hint').textContent = h ? `${h[0]}: ${h[1]}` : ''; };
    const shows = () => { const t = typeOf(f('type').value); back.querySelectorAll('[data-only=fmt]').forEach((x) => { x.style.display = TAKES_CONTENT.includes(t.id) ? '' : 'none'; }); hintDraw(); presets(); back.querySelectorAll('[data-only=lin]').forEach((x) => { x.style.display = t.kind === '2d' ? 'none' : ''; }); back.querySelectorAll('[data-only=qr]').forEach((x) => { x.style.display = t.id === 'QRCODE' ? '' : 'none'; }); };
    const read = () => ({ type: f('type').value, value: f('value').value, wmm: +f('wmm').value, hmm: +f('hmm').value, text: f('text').checked, fg: f('fg').value, ecc: f('ecc').value, ...(logo ? { logo, logoPct: +f('logoPct').value, logoName } : {}) });
    // the picture in the middle (kept in the barcode as data): error correction goes to H, so phones still read it
    let logo = '', logoName = '';
    const logoShow = () => { f('logoName').textContent = logo ? logoName || 'A picture' : 'None'; back.querySelector('[data-a=logoOff]').hidden = !logo; f('logoPct').hidden = !logo; };
    const logoSet = async (file, name) => { try { logo = await logoData(file); logoName = name || file.name.replace(/\.\w+$/, ''); if (f('ecc').value !== 'H') f('ecc').value = 'H'; logoShow(); draw(); } catch (e) { f('err').textContent = 'That picture could not be read.'; } };
    let made = null, tmr = 0;
    const draw = () => { clearTimeout(tmr); tmr = setTimeout(() => { try { made = make(read()); f('prev').innerHTML = `<img alt="Barcode preview" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(made.svg)}">`; f('err').textContent = ''; } catch (e) { made = null; f('prev').innerHTML = ''; f('err').textContent = e.message; } }, 120); };
    const libDraw = () => { const L = library(); f('lib').innerHTML = L.length ? L.slice(0, 60).map((x) => `<button type="button" data-lib="${esc(x.id)}" title="${esc(x.value)}"><span>${esc(x.name)}</span><span class="dim">${esc(typeOf(x.type).name)}</span></button>`).join('') : '<span class="dim">Nothing saved yet.</span>'; };
    back.addEventListener('input', (e) => {
      if (e.target.dataset.cf) fromForm();
      if (e.target.dataset.f === 'fmt') { const pc = parseContent(f('value').value); formDraw(pc.id === f('fmt').value ? pc.v : {}); fromForm(); }
      if (e.target.dataset.f === 'value') { const pc = parseContent(f('value').value); if (pc.id === f('fmt').value) { const was = document.activeElement; formDraw(pc.v); was && was.focus(); } }
      if (e.target.dataset.f === 'preset' && e.target.value) { const [w, h] = e.target.value.split('x'); f('wmm').value = w; if (h) f('hmm').value = h; else f('hmm').value = w; }
      if (e.target.dataset.f === 'wmm' || e.target.dataset.f === 'hmm') presets();
      if (e.target.dataset.f === 'type') { const t = typeOf(e.target.value), sz = sizeFor(t); if (!f('value').value.trim() || TYPES.some((x) => x.sample === f('value').value) || TAKES_CONTENT.includes(t.id) !== TAKES_CONTENT.includes(f('type').dataset.was || 'QRCODE')) f('value').value = t.sample; f('type').dataset.was = t.id; f('wmm').value = sz.wmm; f('hmm').value = sz.hmm; f('text').checked = t.kind !== '2d'; shows(); } draw(); });
    back.addEventListener('change', (e) => {
      if (e.target.dataset.f !== 'src' || !e.target.value) return;
      const [i, j] = e.target.value.split(':').map(Number), it = sources[i].list()[j];
      if (it.type) { f('type').value = it.type; const t = typeOf(it.type), sz = sizeFor(t); f('wmm').value = sz.wmm; f('hmm').value = sz.hmm; f('text').checked = t.kind !== '2d'; shows(); }
      f('value').value = it.value; const pc = parseContent(it.value); f('fmt').value = pc.id; formDraw(pc.v); draw();
    });
    back.addEventListener('click', async (e) => {
      if (e.target === back) return close();
      const lb = e.target.closest('[data-lib]'); if (lb) { const x = library().find((y) => y.id === lb.dataset.lib); if (x) { cur = { ...x }; fill(); draw(); } return; }
      const a = e.target.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'save' || a.dataset.a === 'insert') { clearTimeout(tmr); try { made = make(read()); f('err').textContent = ''; } catch (err) { made = null; f('err').textContent = err.message; } }
      if (a.dataset.a === 'close') close();
      if (a.dataset.a === 'logoClip') window.CraftClipartPicker.open({ app, svg: true, onPick: (p) => logoSet(p.file, p.name) });
      if (a.dataset.a === 'logoFile') { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = () => i.files[0] && logoSet(i.files[0]); i.click(); }
      if (a.dataset.a === 'logoOff') { logo = ''; logoName = ''; logoShow(); draw(); }
      if (a.dataset.a === 'save' && made) { const name = prompt('A name for this barcode in the library:', made.value.split(/\r?\n/).find((l) => /^FN:/.test(l))?.slice(3) || made.value.slice(0, 40)); if (name != null) { save({ ...made, name: name.trim() || made.value }); libDraw(); } }
      if (a.dataset.a === 'insert' && made) { close(); if (onInsert) onInsert(entry ? { ...made, id: entry.id, name: entry.name } : made); }
    });
    document.addEventListener('keydown', function k(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', k); } });
    window.addEventListener('craft-barcodes', function again() { if (!document.body.contains(back)) return window.removeEventListener('craft-barcodes', again); libDraw(); });
    fill(); if (content && !entry && value == null && TAKES_CONTENT.includes(f('type').value)) { f('fmt').value = contentOf(content).id; formDraw({}); fromForm(); }
    libDraw(); draw(); setTimeout(() => { const first = content && f('form').querySelector('[data-cf]'); (first || f('value')).focus(); }, 0);
    return { close };
  }

  window.CraftBarcode = { contents: { list: CONTENTS, build: buildContent, parse: parseContent, takes: (id) => TAKES_CONTENT.includes(id) }, hintFor, logoData, TYPES, make, png, dataUrl, canvas: canvasOf, vcard, addSource, library, save, remove, open };
})();

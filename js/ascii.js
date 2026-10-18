/* ImageCraft text art (IC.ascii): a picture made of characters, as plain ASCII, or ANSI art with colours (the BBS and
   DOS kind, or for today's terminals).
     make(img, opts) → { cols, rows, cells: [{ ch, fg: [r,g,b], bg: [r,g,b] | null }] }
       opts.columns   characters across (default 80)
       opts.mode      'chars' (brightness → a character), 'halfblock' (▀ with two colours: two pixels in each character),
                      'shade' (░ ▒ ▓ █ with a fore- and background colour, classic ANSI art)
       opts.ramp      'standard' | 'detailed' | 'simple' | 'blocks' | 'dots' or your own characters (light to dense)
       opts.colour    'none' | 'ansi16' | 'ansi256' | 'true'
       opts.dark      true: for a dark screen (light parts get dense characters); false: for white paper
       opts.contrast  −100…100, opts.aspect (character width ÷ height, 0.5 for most fonts)
     text(r), ansi(r, { dialect: 'utf8' | 'cp437', colour, sauce: { title, author } }) → Uint8Array, html(r), render(r) → canvas */
(function () {
  'use strict';
  const IC = (window.IC = window.IC || {});
  const RAMPS = {
    standard: ' .:-=+*#%@',
    detailed: ' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$',
    simple: ' .oO@',
    blocks: ' ░▒▓█',
    dots: ' ⠁⠃⠇⡇⣇⣧⣷⣿',
  };
  // the 16 colours of a DOS / VGA text screen, in ANSI order (black, red, green, yellow, blue, magenta, cyan, white; then bright)
  const ANSI16 = [[0, 0, 0], [170, 0, 0], [0, 170, 0], [170, 85, 0], [0, 0, 170], [170, 0, 170], [0, 170, 170], [170, 170, 170], [85, 85, 85], [255, 85, 85], [85, 255, 85], [255, 255, 85], [85, 85, 255], [255, 85, 255], [85, 255, 255], [255, 255, 255]];
  const CUBE = [0, 95, 135, 175, 215, 255];
  const ANSI256 = (() => { const p = ANSI16.slice(); for (let r = 0; r < 6; r++) for (let g = 0; g < 6; g++) for (let b = 0; b < 6; b++) p.push([CUBE[r], CUBE[g], CUBE[b]]); for (let i = 0; i < 24; i++) { const v = 8 + i * 10; p.push([v, v, v]); } return p; })();
  const d2 = (a, b) => (a[0] - b[0]) ** 2 * 2 + (a[1] - b[1]) ** 2 * 4 + (a[2] - b[2]) ** 2 * 3;
  const nearest = (pal, c, n = pal.length) => { let bi = 0, bd = Infinity; for (let i = 0; i < n; i++) { const e = d2(pal[i], c); if (e < bd) { bd = e; bi = i; } } return bi; };
  const BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const lum = (c) => c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114;

  // the picture shrunk to a grid (smooth), with see-through as the background colour
  function grid(img, w, h, back) {
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').putImageData(img, 0, 0);
    const g = document.createElement('canvas'); g.width = w; g.height = h; const x = g.getContext('2d', { willReadFrequently: true });
    x.fillStyle = back; x.fillRect(0, 0, w, h); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data, out = []; for (let i = 0; i < d.length; i += 4) out.push([d[i], d[i + 1], d[i + 2]]); return out;
  }
  const palFor = (colour) => (colour === 'ansi16' ? ANSI16 : colour === 'ansi256' ? ANSI256 : null);
  const snapC = (c, colour, n) => { const p = palFor(colour); return p ? p[nearest(p, c, n)] : c.map(Math.round); };

  function make(img, o = {}) {
    const cols = Math.max(8, Math.min(400, o.columns || 80)), aspect = o.aspect || 0.5, mode = o.mode || 'chars', colour = o.colour || 'none', dark = o.dark !== false;
    const back = dark ? '#000000' : '#ffffff', k = 1 + (o.contrast || 0) / 100;
    const contrast = (c) => c.map((v) => Math.max(0, Math.min(255, (v - 128) * k + 128)));
    if (mode === 'halfblock') {
      // two square pixels in each character: the top one is the character's colour (▀), the bottom one its background
      const rows = Math.max(1, Math.round((img.height / img.width) * cols * aspect)), px = grid(img, cols, rows * 2, back).map(contrast), cells = [];
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const t = px[y * 2 * cols + x], b = px[(y * 2 + 1) * cols + x];
        if (colour === 'none') { const lt = lum(t) >= 128, lb = lum(b) >= 128, on = dark ? [lt, lb] : [!lt, !lb]; cells.push({ ch: on[0] && on[1] ? '█' : on[0] ? '▀' : on[1] ? '▄' : ' ', fg: null, bg: null }); continue; }
        cells.push({ ch: '▀', fg: snapC(t, colour), bg: snapC(b, colour) });
      }
      return { cols, rows, cells, mode, colour, dark };
    }
    const rows = Math.max(1, Math.round((img.height / img.width) * cols * aspect)), px = grid(img, cols, rows, back).map(contrast), cells = [];
    if (mode === 'shade') {
      // each character: a foreground (16) and background (8, as on DOS) colour and how much of the foreground shows
      const SH = [[' ', 0], ['░', 0.25], ['▒', 0.5], ['▓', 0.75], ['█', 1]], fgPal = colour === 'none' ? [[255, 255, 255]] : ANSI16, bgN = colour === 'none' ? 1 : 8;
      const pairs = []; for (let f = 0; f < fgPal.length; f++) for (let b = 0; b < bgN; b++) for (const [ch, a] of SH) { const bc = colour === 'none' ? [0, 0, 0] : ANSI16[b], fc = fgPal[f]; pairs.push({ ch, f: fc, b: bc, mix: [0, 1, 2].map((q) => fc[q] * a + bc[q] * (1 - a)) }); }
      for (const c of px) {
        const t = colour === 'none' ? (dark ? c : c.map((v) => 255 - v)) : c; let best = pairs[0], bd = Infinity;
        for (const p of pairs) { const e = d2(p.mix, colour === 'none' ? [lum(t), lum(t), lum(t)] : t); if (e < bd) { bd = e; best = p; } }
        cells.push({ ch: best.ch, fg: colour === 'none' ? null : best.f, bg: colour === 'none' ? null : best.b });
      }
      return { cols, rows, cells, mode, colour, dark };
    }
    const ramp = [...(RAMPS[o.ramp] || o.ramp || RAMPS.standard)];
    for (const c of px) {
      let v = lum(c) / 255; if (!dark) v = 1 - v;
      const ch = ramp[Math.min(ramp.length - 1, Math.floor(v * ramp.length))];
      // in colour, the character takes the picture's colour, brightened so dim characters still show it
      let fg = null; if (colour !== 'none') { const m = Math.max(1, ...c), lift = Math.min(2.2, 255 / m); fg = snapC(dark ? c.map((x) => x * (0.55 + 0.45 * lift)) .map((x) => Math.min(255, x)) : c, colour); }
      cells.push({ ch, fg, bg: null });
    }
    return { cols, rows, cells, mode, colour, dark };
  }

  const text = (r) => { let s = ''; for (let y = 0; y < r.rows; y++) { for (let x = 0; x < r.cols; x++) s += r.cells[y * r.cols + x].ch; s = s.replace(/ +$/, '') + '\n'; } return s; };

  // ANSI escape codes. dialect 'cp437': a classic .ANS file (DOS characters, 16 colours with bold for bright, an
  // optional SAUCE record); 'utf8': for today's terminals (16, 256 or true colour)
  const CP437 = { '░': 176, '▒': 177, '▓': 178, '█': 219, '▀': 223, '▄': 220, '⠁': 46, '⠃': 58, '⠇': 58, '⡇': 105, '⣇': 73, '⣧': 35, '⣷': 35, '⣿': 219 };
  function ansi(r, { dialect = 'utf8', sauce } = {}) {
    const classic = dialect === 'cp437', colour = classic && r.colour !== 'none' ? 'ansi16' : r.colour, out = [];
    let s = classic ? '\x1b[0m\x1b[2J\x1b[H' : '\x1b[0m', last = '';
    const fgCode = (c) => {
      if (colour === 'true') return `38;2;${c[0]};${c[1]};${c[2]}`;
      if (colour === 'ansi256') return `38;5;${nearest(ANSI256, c)}`;
      const i = nearest(ANSI16, c); return classic ? `${i >= 8 ? '1' : '22'};${30 + (i & 7)}` : i >= 8 ? `${90 + (i & 7)}` : `${30 + i}`;
    };
    const bgCode = (c) => {
      if (colour === 'true') return `48;2;${c[0]};${c[1]};${c[2]}`;
      if (colour === 'ansi256') return `48;5;${nearest(ANSI256, c)}`;
      const i = nearest(ANSI16, c, classic ? 8 : 16); return i >= 8 ? `${100 + (i & 7)}` : `${40 + i}`;
    };
    for (let y = 0; y < r.rows; y++) {
      for (let x = 0; x < r.cols; x++) {
        const c = r.cells[y * r.cols + x];
        if (r.colour !== 'none') { const code = [c.fg ? fgCode(c.fg) : '39', c.bg ? bgCode(c.bg) : '49'].join(';'); if (code !== last) { s += `\x1b[${code}m`; last = code; } }
        s += c.ch;
      }
      if (r.colour !== 'none') { s += '\x1b[0m'; last = ''; }
      if (!(classic && r.cols === 80)) s += classic ? '\r\n' : '\n';
    }
    s += '\x1b[0m';
    if (!classic) return new TextEncoder().encode(s);
    for (const ch of s) { const cp = ch.codePointAt(0); out.push(cp < 128 ? cp : CP437[ch] || 63); }
    if (sauce) {
      const pad = (t, n) => { const a = new Array(n).fill(32); [...(t || '')].slice(0, n).forEach((c, i) => { a[i] = c.charCodeAt(0) < 128 ? c.charCodeAt(0) : 63; }); return a; };
      const dt = new Date(), date = `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getDate()).padStart(2, '0')}`, size = out.length;
      out.push(26, ...pad('SAUCE00', 7), ...pad(sauce.title, 35), ...pad(sauce.author, 20), ...pad('', 20), ...pad(date, 8), size & 255, (size >> 8) & 255, (size >> 16) & 255, (size >>> 24) & 255, 1, 1, r.cols & 255, r.cols >> 8, r.rows & 255, r.rows >> 8, 0, 0, 0, 0, 0, 1, ...new Array(22).fill(0));
    }
    return Uint8Array.from(out);
  }
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  const css = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
  function html(r, { title = 'Text art' } = {}) {
    let body = '';
    for (let y = 0; y < r.rows; y++) {
      let run = null, buf = '';
      const flush = () => { if (!buf) return; body += run ? `<span style="${run}">${esc(buf)}</span>` : esc(buf); buf = ''; };
      for (let x = 0; x < r.cols; x++) { const c = r.cells[y * r.cols + x], st = c.fg || c.bg ? `${c.fg ? 'color:' + css(c.fg) + ';' : ''}${c.bg ? 'background:' + css(c.bg) : ''}` : null; if (st !== run) { flush(); run = st; } buf += c.ch; }
      flush(); body += '\n';
    }
    const bg = r.dark ? '#000' : '#fff', fg = r.dark ? '#ddd' : '#111';
    return `<!doctype html>\n<html><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{margin:0;background:${bg}}pre{margin:16px;font:14px/1 "Cascadia Mono",Consolas,"DejaVu Sans Mono",monospace;color:${fg};letter-spacing:0}</style></head><body><pre>${body}</pre></body></html>\n`;
  }
  // a picture of the text art (each character cell 8 × 16, like a VGA text screen)
  function render(r, { cell = [8, 16] } = {}) {
    const [cw, ch] = cell, c = document.createElement('canvas'); c.width = r.cols * cw; c.height = r.rows * ch; const x = c.getContext('2d');
    x.fillStyle = r.dark ? '#000' : '#fff'; x.fillRect(0, 0, c.width, c.height);
    x.font = `${ch - 1}px "Cascadia Mono", Consolas, "DejaVu Sans Mono", monospace`; x.textBaseline = 'top'; x.textAlign = 'center';
    const block = { '█': [0, 1], '▀': [0, 0.5], '▄': [0.5, 1] };
    for (let y = 0; y < r.rows; y++) for (let xx = 0; xx < r.cols; xx++) {
      const cl = r.cells[y * r.cols + xx], px = xx * cw, py = y * ch;
      if (cl.bg) { x.fillStyle = css(cl.bg); x.fillRect(px, py, cw, ch); }
      if (cl.ch === ' ') continue;
      x.fillStyle = cl.fg ? css(cl.fg) : r.dark ? '#ddd' : '#111';
      // block characters drawn as blocks, so they meet exactly
      const b = block[cl.ch]; if (b) { x.fillRect(px, py + b[0] * ch, cw, (b[1] - b[0]) * ch); continue; }
      const sh = { '░': 0.25, '▒': 0.5, '▓': 0.75 }[cl.ch];
      if (sh) { for (let yy = 0; yy < ch; yy++) for (let q = 0; q < cw; q++) if ((BAYER4[yy & 3][q & 3] + 0.5) / 16 < sh) x.fillRect(px + q, py + yy, 1, 1); continue; }
      x.fillText(cl.ch, px + cw / 2, py + 1);
    }
    return c;
  }

  IC.ascii = { make, text, ansi, html, render, RAMPS, ANSI16 };
})();

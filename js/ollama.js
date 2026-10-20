/* ImageCraft – Ask AI (IC.ollama): a vision model running in Ollama on this computer looks at the picture and says
   what it is and what is wrong with it. That choice of tools is shown as ticked steps to run. Nothing leaves this
   computer, and nothing is redrawn: the model only describes; ImageCraft's own measured tools do the work.
     IC.ollama.models() → [{ name, gb }] (vision models only, best first)   assess(img, { model, onStep }) → assessment
     recipe(assessment) → [{ id, why, on, s }]   ORIGIN_HELP: how to let this page talk to Ollama
   A page opened from a file has no web address ("null"), which Ollama refuses until OLLAMA_ORIGINS allows it. */
(function () {
  const IC = (window.IC = window.IC || {});
  const KEY = 'imagecraft-ollama';
  const cfg = { url: 'http://127.0.0.1:11434', model: '' };
  try { Object.assign(cfg, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* blocked storage */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) { /* blocked storage */ } };

  // vision models, the ones that described the test photos best first (qwen3.5 counted 7 of 7 faces and saw only real
  // damage; gemma3 and gemma4 listed creases and stains on a clean picture)
  const PREF = [/^qwen3\.5/, /^qwen3-vl|^qwen2\.5vl/, /^gemma3:(12|27)b/, /^gemma3/, /^llama3\.2-vision/, /^minicpm-v/, /^llava/, /^gemma4/];
  const rank = (n) => { const i = PREF.findIndex((r) => r.test(n)); return i < 0 ? PREF.length : i; };

  async function api(path, body) {
    let r;
    try { r = await fetch(cfg.url + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}); }
    catch (e) { const err = new Error('Could not reach Ollama'); err.blocked = true; throw err; }
    if (!r.ok) throw new Error(`Ollama said ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return r.json();
  }
  async function models() {
    const tags = await api('/api/tags'), list = [];
    for (const m of tags.models || []) {
      if (/:cloud$/.test(m.name) || !m.size) continue; // cloud models would send the picture away
      let caps = []; try { caps = (await api('/api/show', { model: m.name })).capabilities || []; } catch (e) { /* skip */ }
      if (caps.includes('vision')) list.push({ name: m.name, gb: m.size / 1e9 });
    }
    return list.sort((a, b) => rank(a.name) - rank(b.name) || a.gb - b.gb);
  }

  const PROBLEMS = ['noise or grain', 'blur', 'jpeg blocks', 'dust and specks', 'scratches', 'tears or missing parts', 'faded', 'colour cast', 'haze', 'too dark', 'too bright', 'low resolution', 'halftone dots', 'creases', 'stains'];
  const SCHEMA = { type: 'object', required: ['subject', 'era', 'kind', 'colour', 'problems', 'faces', 'materials', 'description'], properties: {
    subject: { type: 'string', description: 'what the picture shows, in one sentence' }, era: { type: 'string', description: 'the likely decade it was made' },
    kind: { type: 'string', enum: ['photo', 'scanned print', 'painting', 'drawing', 'pixel art', 'screenshot', 'logo or graphic'] },
    colour: { type: 'string', enum: ['full colour', 'faded colour', 'sepia or toned', 'black and white'] },
    problems: { type: 'array', items: { type: 'string', enum: PROBLEMS } }, faces: { type: 'integer' },
    materials: { type: 'string', description: 'the clothing, surfaces and objects with their materials and colours' }, description: { type: 'string', description: 'how it should look when restored' } } };
  // the instructions are in plain sentences (and in the form's own descriptions): a prompt written like the form
  // ("subject: one line") was copied back word for word instead of answered
  const PROMPT = 'Look closely at this picture: someone wants to restore it. Fill in the form about what you really see, '
    + 'naming the real things, materials and colours in the picture. List only damage you can actually see. '
    + 'In the last part, say in two or three sentences how the picture should look once restored, faithful to what is there.';

  // the picture goes as a JPEG about 900 pixels across (what the models look at anyway)
  function jpegOf(img, max = 896) {
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').putImageData(img, 0, 0);
    const k = Math.min(1, max / Math.max(img.width, img.height)), o = document.createElement('canvas');
    o.width = Math.max(1, Math.round(img.width * k)); o.height = Math.max(1, Math.round(img.height * k));
    const x = o.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, o.width, o.height); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, o.width, o.height);
    return o.toDataURL('image/jpeg', 0.9).split(',')[1];
  }
  async function assess(img, { model = cfg.model, onStep } = {}) {
    if (!model) throw new Error('Choose a model first.');
    cfg.model = model; save();
    const t0 = performance.now(), tick = setInterval(() => onStep && onStep(`${model} is looking at the picture… ${Math.round((performance.now() - t0) / 1000)} s (the first time loads the model)`), 1000);
    try {
      // a short context keeps the model on the graphics card (Ollama's default for qwen3.5 is 262k, which spills to the processor)
      const r = await api('/api/chat', { model, stream: false, format: SCHEMA, think: false, keep_alive: '10m', options: { temperature: 0.2, num_ctx: 8192 },
        messages: [{ role: 'user', content: PROMPT, images: [jpegOf(img)] }] });
      const txt = (r.message && r.message.content) || '';
      let a; try { a = JSON.parse(txt); } catch (e) { const m = txt.match(/\{[\s\S]*\}/); if (!m) throw new Error('The model did not answer in the expected form.'); a = JSON.parse(m[0]); }
      a.problems = (a.problems || []).filter((p) => PROBLEMS.includes(p)); a.seconds = (performance.now() - t0) / 1000; a.model = model;
      if (/^one (line|sentence)$/i.test(a.subject || '')) throw new Error(`${model} answered without looking at the picture. Try another model.`);
      return a;
    } finally { clearInterval(tick); }
  }

  // what to do about it: ImageCraft's own tools, in the order a restorer would use them
  function recipe(a, img) {
    const has = (p) => a.problems.includes(p), toned = a.colour === 'sepia or toned' || a.colour === 'black and white', photo = /photo|print/.test(a.kind), out = [];
    const add = (id, why, on = true, s = {}) => out.push({ id, why, on, s });
    if (has('dust and specks')) add('despeckle', 'dust and specks');
    // blocks are measured too (models rarely notice them)
    const bl = img && IC.restore ? IC.restore.blockiness(img) : null;
    if (has('jpeg blocks') || (bl && bl.luma > 1.3)) add('deblock', bl && bl.luma > 1.3 ? `JPEG blocks (measured ${bl.luma.toFixed(1)}× at the block edges)` : 'JPEG blocks');
    if (bl && bl.colour > 2) add('chroma', `blocky colour (measured ${bl.colour.toFixed(1)}×)`, true, { size: 8 });
    if (has('noise or grain')) add('nlm', 'noise or grain');
    if (has('blur')) add('deblur', 'blur');
    if (has('haze')) add('dehaze', 'haze');
    if (has('too dark')) add('shadows', 'too dark');
    if (has('too bright')) add('light', 'too bright', true, { brightness: -12 });
    if (has('faded') || a.colour === 'faded colour') add('autocolour', toned ? 'faded (the tone is kept)' : 'faded colour');
    if (has('colour cast') && !toned) add('balance', 'colour cast');
    if (has('faded')) add('clahe', 'faded detail', false);
    if (a.faces > 0 && photo) add('facerefine', `${a.faces} face${a.faces === 1 ? '' : 's'}`, false);
    if (!out.length && photo) add('autocolour', 'a general freshen-up', false);
    return out;
  }
  // damage the tools cannot mend yet (repair is still to come)
  const notYet = (a) => a.problems.filter((p) => ['scratches', 'tears or missing parts', 'creases', 'stains', 'halftone dots'].includes(p));

  const ORIGIN_HELP = 'Ollama only answers pages it trusts. A page opened from a file has no web address, so Ollama refuses it until it is told to allow it. In a Windows command prompt:<br><code>setx OLLAMA_ORIGINS *</code><br>then quit Ollama (its icon by the clock › Quit) and start it again. <b>*</b> lets any page use Ollama, including websites, so you may prefer to set it only while using ImageCraft.';
  IC.ollama = { cfg, save, models, assess, recipe, notYet, PROBLEMS, ORIGIN_HELP };
})();

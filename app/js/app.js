// Skogsinventering – offline-PWA för naturvärdesinventerare.
import { db, uid } from './db.js';
import { toSweref99TM, polygonAreaM2, formatArea, distanceM, GpsTracker } from './geo.js';
import { createMap, BASES, SKS_LAYERS, downloadSksLayers, downloadTiles, countTiles } from './map.js';
import { toGeoJSON, toCSV, makeZip, readZip, shareOrDownload, objectProps, objectsCSV, reportHTML, protectedAppendixHTML, protectionKm, NON_BREEDING } from './export.js';

const MODEL_URL = new URL('../model/bioclip_visual_int8.onnx', import.meta.url).href;
const EMB_URL = new URL('../data/text_emb.bin', import.meta.url).href;
const SPECIES_URL = new URL('../data/species.json', import.meta.url).href;
const WASM_URL = new URL('../vendor/ort-wasm-simd-threaded.wasm', import.meta.url).href;
const MODEL_CACHE = 'skog-model-v1';

const GROUPS = [
  { id: 'alla', label: 'Allt' },
  { id: 'trad', label: 'Träd' },
  { id: 'karlvaxt', label: 'Kärlväxter', short: 'Kärlv.' },
  { id: 'mossa', label: 'Mossor' },
  { id: 'lav', label: 'Lavar' },
  { id: 'svamp', label: 'Svampar' },
  { id: 'fagel', label: 'Fåglar' },
  { id: 'insekt', label: 'Insekter' },
];
const GROUP_LABEL = { trad: 'Träd', karlvaxt: 'Kärlväxt', mossa: 'Mossa', lav: 'Lav', svamp: 'Svamp', fagel: 'Fågel', insekt: 'Insekt', punkt: 'Anteckning' };
const RL_LABEL = { RE: 'Nationellt utdöd', CR: 'Akut hotad', EN: 'Starkt hotad', VU: 'Sårbar', NT: 'Nära hotad', DD: 'Kunskapsbrist' };
const METHODS = ['', 'Okulärt i fält', 'Lupp', 'Kemiskt test (K/C/P/UV)', 'Mikroskop', 'Belägg insamlat', 'Expertverifierad', 'Endast AI-förslag'];
// Substrat som snabbval (fungerar med handskar) – sparas strukturerat och som text
const SUB = {
  tree: { label: 'Trädslag', opts: ['Gran', 'Tall', 'Björk', 'Asp', 'Sälg', 'Al', 'Rönn', 'Ek', 'Bok', 'Ask', 'Alm', 'Lind', 'Lönn', 'Hassel', 'En', 'Idegran', 'Lärk', 'Okänt löv', 'Okänt barr'] },
  type: { label: 'Typ', opts: ['Levande träd', 'Döende träd', 'Torraka', 'Högstubbe', 'Stubbe', 'Låga', 'Rotvälta', 'Gren/kvist', 'Brandstubbe', 'Mark/förna', 'Sten/block', 'Häll/lodyta', 'Annan svamp', 'Annat'] },
  diam: { label: 'Diameter (cm)', opts: ['<10', '10–20', '20–40', '40–60', '>60'] },
  decay: { label: 'Nedbrytning (död ved)', opts: ['1 Hård', '2 Något mjuk', '3 Mjuk', '4 Mycket mjuk'] },
};
const AMOUNT = ['Enstaka', 'Fåtal', 'Riklig'];
// Fåglar: aktivitet avgör om ett skyddsklassat fynd kan indikera häckning (H)
const BIRD_ACTIVITY = ['Sång/spel', 'Bo/bohål', 'Ungar/föda till ungar', 'Varnande/oroad', 'Par i lämplig miljö', 'Födosökande', 'Förbiflygande/sträckande'];
function substrateText(s) {
  if (!s) return '';
  return [s.type, s.tree, s.diam ? `⌀${s.diam} cm` : '', s.decay ? `nedbr. ${s.decay}` : ''].filter(Boolean).join(', ');
}
// Strukturer och värdeelement (grupperade), påverkan, biotoper och Natura 2000-naturtyper
const STRUCTURE_GROUPS = {
  'Död ved': ['Grova lågor (>40 cm)', 'Lågor i flera nedbrytningsstadier', 'Rikligt med död ved', 'Torrakor', 'Kelor (tall)', 'Högstubbar', 'Solexponerad död ved', 'Brandstubbar'],
  'Träd': ['Jätteträd/mycket grova träd', 'Gamla träd', 'Hålträd med mulm', 'Vidkroniga träd', 'Hamlade/kulturträd', 'Grova aspar', 'Grova sälgar', 'Överståndare', 'Döende träd', 'Brandljud', 'Barkskador/sår', 'Senvuxna träd'],
  'Skogsstruktur': ['Olikåldrig/flerskiktad', 'Luckighet', 'Naturlig föryngring', 'Lövsuccession efter brand', 'Lövinslag i barrskog', 'Ädellövinslag', 'Hassel'],
  'Spår av organismer': ['Hackspettshål/bohål', 'Ringbarkning', 'Kläckhål/gnag av vedinsekter', 'Myrstackar'],
  'Fysiska miljöer': ['Bäckravin', 'Källa/källpåverkan', 'Översilning', 'Sumpstråk', 'Strandzon', 'Block/blockmark', 'Hällar', 'Bergbrant', 'Rasbrant', 'Lodytor/överhäng', 'Kalkpåverkan'],
  'Hävd och kultur': ['Skogsbete', 'Hagmarksrester', 'Stengärdsgårdar', 'Kolbottnar', 'Odlingsrösen'],
};
const PAVERKAN = ['Avverkningsspår/stubbar', 'Plockhuggning', 'Gallring', 'Dikning', 'Körskador', 'Invasiva arter', 'Tät ungskog', 'Betestryck från vilt', 'Igenväxning', 'Opåverkad/svag påverkan'];
const BIOTOPES = ['', 'Barrnaturskog, gran', 'Barrnaturskog, tall', 'Brandpräglad tallskog', 'Örtrik/högörtsgranskog', 'Kalkbarrskog', 'Fjällnära skog',
  'Lövnaturskog, asp', 'Lövnaturskog, björk', 'Lövnaturskog, al', 'Lövbränna', 'Ädellövskog, ek', 'Ädellövskog, bok', 'Ädellövnaturskog', 'Hassellund',
  'Barrsumpskog', 'Lövsumpskog', 'Alsumpskog', 'Källmiljö', 'Bäckravin/bäckdal', 'Strandskog/svämskog', 'Bergbrant/rasbrant', 'Hällmarkstallskog',
  'Myrholme/myrkant', 'Trädklädd betesmark/hagmark', 'Skogsbete', 'Lövängsrest', 'Allé/parkmiljö', 'Annat'];
const NATURA2000 = ['', 'Ingen', '9010 Västlig taiga', '9020 Nordlig ädellövskog', '9030 Landhöjningsskog', '9050 Näringsrik granskog', '9060 Åsbarrskog',
  '9070 Trädklädd betesmark', '9080 Lövsumpskog', '9110 Näringsfattig bokskog', '9130 Näringsrik bokskog', '9160 Näringsrik ekskog',
  '9180 Ädellövskog i branter', '9190 Näringsfattig ekskog', '91D0 Skogbevuxen myr', '91E0 Svämlövskog'];
const ADDONS = ['Naturvärdesklass 4', 'Fördjupad artinventering', 'Detaljerad redovisning av artförekomst', 'Generellt biotopskydd', 'Värdefulla träd'];
// Räknas som naturvårdsart i objektet: signal-/E-art eller rödlistad (ej DD/RE), och bestämningen är inte osäker
function isNvArt(sp) { return !!sp && !sp.syn && (!!sp.sig || (!!sp.rl && sp.rl !== 'DD' && sp.rl !== 'RE')); }
function countsAsNv(o) { return !o.unsure && isNvArt(state.species[o.speciesId]); }
const VARDEN = ['', 'obetydligt', 'visst', 'påtagligt', 'högt'];
// Bedömningsmatris (artvärde x biotopvärde -> naturvärdesklass). Förslag – kontrollera mot SS 199000.
const MATRIX = {
  'högt': { 'obetydligt': 2, 'visst': 2, 'påtagligt': 1, 'högt': 1 },
  'påtagligt': { 'obetydligt': 3, 'visst': 3, 'påtagligt': 2, 'högt': 1 },
  'visst': { 'obetydligt': 4, 'visst': 4, 'påtagligt': 3, 'högt': 2 },
  'obetydligt': { 'obetydligt': null, 'visst': 4, 'påtagligt': 3, 'högt': 2 },
};
const KLASS_LABEL = { 1: 'Klass 1 – Högsta naturvärde', 2: 'Klass 2 – Högt naturvärde', 3: 'Klass 3 – Påtagligt naturvärde', 4: 'Klass 4 – Visst naturvärde' };
const LOW_SIM = 0.22; // under detta liknar bilden ingen art i listan särskilt väl

const state = {
  species: [], view: 'id', group: 'alla', list: 'urval', photos: [], result: null, chosen: null,
  observations: [], objects: [], settings: { protect: true, accurate: false, theme: 'auto' }, modelReady: false,
  project: { name: '', client: '', inventors: '', standard: 'SS 199000:2023', level: 'Detalj', addons: [] },
  activeObjectId: null, lastSub: {}, recording: null, lastBackup: null,
};
const gps = new GpsTracker();
const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------------- AI-arbetaren ----------------
let worker = null, reqId = 0;
const pending = new Map();
function callWorker(type, payload, transfer) {
  if (!worker) {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ev => {
      const { id, ok, result, error } = ev.data;
      const p = pending.get(id); pending.delete(id);
      if (p) ok ? p.resolve(result) : p.reject(new Error(error));
    };
  }
  return new Promise((resolve, reject) => {
    const id = ++reqId;
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, type, payload }, transfer || []);
  });
}
let initPromise = null;
function ensureModel() {
  if (!initPromise) {
    initPromise = callWorker('init', { modelUrl: MODEL_URL, embUrl: EMB_URL, wasmUrl: WASM_URL, count: state.species.length })
      .catch(e => { initPromise = null; throw e; });
  }
  return initPromise;
}

// ---------------- Offline-cache för modellen ----------------
async function modelCached() {
  if (!('caches' in window)) return false;
  const [m, w] = await Promise.all([caches.match(MODEL_URL), caches.match(WASM_URL)]);
  return !!(m && w);
}
async function downloadModel(onProgress) {
  const cache = await caches.open(MODEL_CACHE);
  // text_emb.bin hör till artdatan och ligger i appskalets cache (uppdateras tillsammans med species.json)
  const files = [MODEL_URL, WASM_URL];
  const sizes = [87278673, 14239897];
  const total = sizes.reduce((a, b) => a + b, 0);
  let done = 0;
  for (let i = 0; i < files.length; i++) {
    if (await cache.match(files[i])) { done += sizes[i]; onProgress(done / total); continue; }
    const res = await fetch(files[i], { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Kunde inte hämta ${files[i]} (${res.status})`);
    const reader = res.body.getReader();
    const chunks = [];
    for (;;) {
      const { done: d, value } = await reader.read();
      if (d) break;
      chunks.push(value); done += value.length; onProgress(Math.min(done / total, 0.999));
    }
    await cache.put(files[i], new Response(new Blob(chunks), { headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/octet-stream' } }));
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
  onProgress(1);
}

// Nedladdningen körs en gång oavsett vilken vy som visas (förlopp lagras i state)
function startModelDownload(btn, bar) {
  const show = () => document.querySelectorAll('.dl-progress-target').forEach(() => {});
  if (!state.download) {
    if (navigator.connection && navigator.connection.type === 'cellular' && !confirm('Du verkar använda mobildata. Ladda ner ca 105 MB ändå?')) return;
    state.download = { p: 0 };
    state.download.promise = downloadModel(f => {
      state.download.p = f;
      document.querySelectorAll('.progress span').forEach(s => { s.style.width = (f * 100).toFixed(1) + '%'; });
      document.querySelectorAll('#btn-dl, #btn-dl-start').forEach(b => { b.disabled = true; b.textContent = `Laddar ner … ${Math.round(f * 100)} %`; });
      document.querySelectorAll('.progress').forEach(p => { p.hidden = false; });
    }).then(() => {
      state.modelReady = true; state.download = null; buzz(30);
      toast('✅ Klar för fält – testa gärna med en bild nu.'); render(); ensureModel().catch(() => {});
    }).catch(e => { state.download = null; toast('Nedladdningen misslyckades: ' + e.message); render(); });
  }
  if (btn) { btn.disabled = true; btn.textContent = `Laddar ner … ${Math.round((state.download?.p || 0) * 100)} %`; }
  if (bar) bar.hidden = false;
  show();
}

// ---------------- Bildhantering ----------------
async function loadBitmap(file) {
  try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { return await createImageBitmap(file); }
}
async function makePhoto(file) {
  const bmp = await loadBitmap(file);
  const max = 1600;
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
  const thumb = document.createElement('canvas');
  const ts = 160 / Math.max(c.width, c.height);
  thumb.width = Math.round(c.width * ts); thumb.height = Math.round(c.height * ts);
  thumb.getContext('2d').drawImage(c, 0, 0, thumb.width, thumb.height);
  return { id: uid('p'), blob, url: URL.createObjectURL(blob), canvas: c, w: c.width, h: c.height,
    crop: defaultCrop(c.width, c.height), thumb: thumb.toDataURL('image/jpeg', 0.7) };
}
function defaultCrop(w, h) { const m = Math.min(w, h); return { x: (w - m) / 2 / w, y: (h - m) / 2 / h, s: 1 }; }
function cropToImageData(photo, flip = false, zoom = 1) {
  const m = Math.min(photo.w, photo.h) * photo.crop.s / zoom;
  const cx = photo.crop.x * photo.w + Math.min(photo.w, photo.h) * photo.crop.s / 2;
  const cy = photo.crop.y * photo.h + Math.min(photo.w, photo.h) * photo.crop.s / 2;
  const c = document.createElement('canvas'); c.width = c.height = 224;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  if (flip) { ctx.translate(224, 0); ctx.scale(-1, 1); }
  ctx.drawImage(photo.canvas, cx - m / 2, cy - m / 2, m, m, 0, 0, 224, 224);
  return ctx.getImageData(0, 0, 224, 224);
}

function candidateIds() {
  // Nationellt utdöda arter (RE) föreslås aldrig.
  return state.species.filter(s => !s.syn && s.rl !== 'RE' && (state.list === 'alla' || s.sel) && (state.group === 'alla' || s.grp === state.group)).map(s => s.id);
}

// Fotots inbäddning beror bara på beskärning och analysläge -> cachas per foto.
function photoKey(p) { return `${p.crop.x.toFixed(4)},${p.crop.y.toFixed(4)},${p.crop.s.toFixed(4)}|${state.settings.accurate ? 1 : 0}`; }
let embedChain = Promise.resolve();
function embedPhoto(p) {
  const key = photoKey(p);
  if (p.embKey === key && p.embP) return p.embP;
  p.embKey = key;
  const images = [cropToImageData(p)];
  if (state.settings.accurate) { images.push(cropToImageData(p, true)); images.push(cropToImageData(p, false, 1.25)); }
  // en inbäddning i taget – inga köer av inaktuella analyser
  p.embP = embedChain = embedChain.catch(() => {}).then(() => callWorker('embed', { images }));
  p.embP.catch(() => { if (p.embKey === key) { p.embKey = null; p.embP = null; } });
  return p.embP;
}
// Vad resultatet gäller: visas bara om det matchar nuvarande foton, grupp och lista.
function resultSig() { return `${state.group}|${state.list}|${state.photos.map(p => p.id + ':' + photoKey(p)).join(',')}`; }

let analyzeSeq = 0;
async function analyze() {
  const my = ++analyzeSeq; // ignorera resultat från äldre analyser (t.ex. vid snabbt gruppbyte)
  const out = $('#results');
  if (!state.photos.length) { if (out) out.innerHTML = ''; return; }
  const sig = resultSig();
  if (state.result && state.result.sig === sig) { renderResults(); return; }
  if (out) out.innerHTML = `<div class="card center"><div class="spinner"></div><p>Analyserar ${state.photos.length > 1 ? state.photos.length + ' bilder' : 'bilden'} …</p><p class="muted small">Körs helt på telefonen – ingen uppkoppling behövs.</p></div>`;
  try {
    await ensureModel();
    const embs = await Promise.all(state.photos.map(embedPhoto));
    if (my !== analyzeSeq) return;
    const cands = candidateIds();
    const res = await callWorker('rank', { vectors: embs.map(e => e.vec), candidates: cands, topK: 10 });
    if (my !== analyzeSeq) return;
    state.result = { ...res, sig, nCands: cands.length, ms: embs.reduce((a, e) => a + e.ms, 0) };
    renderResults();
  } catch (e) {
    if (my !== analyzeSeq) return;
    const o = $('#results');
    if (o) o.innerHTML = `<div class="card warn"><b>Kunde inte analysera.</b><p>${esc(e.message)}</p>${!state.modelReady ? '<p>AI-modellen är inte nedladdad ännu. Gå till <b>Mer</b> och ladda ner den när du har nät.</p>' : ''}</div>`;
  }
}

function badges(sp) {
  let h = '';
  if (sp.rl) h += `<span class="badge rl rl-${sp.rl}" title="${RL_LABEL[sp.rl]}">${sp.rl}</span>`;
  if (sp.sig === 'S') h += `<span class="badge sig" title="Signalart enligt Skogsstyrelsens lista 2023-1">Signalart</span>`;
  else if (sp.sig === 'E') h += `<span class="badge sig" title="Ekologisk ståndortsindikator enligt Skogsstyrelsens lista 2023-1">E-art</span>`;
  if (sp.sk) h += `<span class="badge sk" title="Skyddsklassad av SLU Artdatabanken – exakt läge döljs vid export (${sp.sk} km-ruta)${sp.skR ? ': ' + esc(sp.skR) : ''}">Skyddsklassad</span>`;
  return h;
}
function spName(sp) {
  return `<span class="sv">${esc(sp.sv || sp.sci)}</span> <i class="sci">${esc(sp.sci)}</i>`;
}

let showAllResults = false, lastRenderedSig = null;
function renderResults() {
  const r = state.result;
  if (!$('#results')) return;
  if (!r || r.sig !== resultSig()) { if (!state.photos.length) $('#results').innerHTML = ''; return; }
  const top = r.top;
  const groupLabel = GROUPS.find(g => g.id === state.group).label;
  const genus = {};
  for (const a of r.all) { const g = state.species[a.id].sci.split(' ')[0]; genus[g] = (genus[g] || 0) + a.p; }
  const [bestGenus, bestGenusP] = Object.entries(genus).sort((a, b) => b[1] - a[1])[0] || [];
  const p0 = top[0].p;
  let verdict;
  if (r.maxSim < LOW_SIM) verdict = `<div class="note warn">Bilden liknar ingen art i listan särskilt väl. Arten kan saknas i listan, eller så är bilden otydlig. Prova en närbild, välj rätt artgrupp eller byt till <b>Alla rödlistade</b>.</div>`;
  else if (p0 >= 0.8) verdict = `<div class="note ok">Starkt förslag. Bekräfta alltid med egna karaktärer.</div>`;
  else if (p0 >= 0.45) verdict = `<div class="note">Möjligt förslag. Jämför med alternativen nedan.</div>`;
  else verdict = `<div class="note warn">Osäkert – bestäm själv. Ta fler bilder (närbild + översikt) eller använd lupp/expert.</div>`;
  const sp0 = state.species[top[0].id];
  if (sp0.rl || sp0.sig) verdict += `<div class="note warn">${esc(cap(sp0.sv || sp0.sci))} är ${sp0.rl ? 'rödlistad' : 'signalart'} – kräver verifiering med karaktärer innan fyndet räknas.</div>`;
  const genusNote = p0 < 0.7 && bestGenusP >= 0.7 && bestGenus ? `<div class="note">Släktet <i>${esc(bestGenus)}</i> är troligt (${pct(bestGenusP)} %).</div>` : '';
  const shown = showAllResults ? top : top.slice(0, 3);
  $('#results').innerHTML = `
    <div class="card" id="results-card">
      <div class="row between"><h3>Förslag</h3><span class="muted small" data-g="${state.group}">${esc(groupLabel)} · ${r.nCands} arter · ${(r.ms / 1000).toLocaleString('sv-SE', { maximumFractionDigits: 1 })} s</span></div>
      ${verdict}${genusNote}
      <ol class="results">
        ${shown.map((a, i) => {
          const sp = state.species[a.id];
          const p = a.p * 100;
          return `<li class="res ${i === 0 ? 'first' : ''}" data-id="${sp.id}" data-p="${a.p}" role="button" tabindex="0" aria-label="Välj ${esc(sp.sv || sp.sci)}, ${p >= 1 ? Math.round(p) : 'under 1'} procent">
            <div class="pct">${p >= 1 ? Math.round(p) : '<1'} %</div>
            <div class="info"><div>${spName(sp)}</div><div class="meta">${GROUP_LABEL[sp.grp] || ''} ${badges(sp)}</div>
              <div class="bar"><span style="width:${Math.max(1, p).toFixed(1)}%"></span></div></div>
            <button class="quick" data-id="${sp.id}" data-p="${a.p}" aria-label="Spara ${esc(sp.sv || sp.sci)} direkt" title="Spara direkt">⚡</button>
          </li>`;
        }).join('')}
      </ol>
      <div class="row gap wrap">${top.length > 3 ? `<button class="btn ghost grow" id="btn-more-res">${showAllResults ? 'Visa färre' : `Visa ${top.length - 3} till`}</button>` : ''}
        <button class="btn ghost grow" id="btn-other">Ingen stämmer – sök art</button></div>
      <button class="btn full" id="btn-indet">Spara som obestämd (bestäm senare)</button>
    </div>`;
  $('#results').querySelectorAll('li.res').forEach(li => {
    const go = () => openSaveSheet(+li.dataset.id, +li.dataset.p);
    li.onclick = e => { if (e.target.closest('.quick')) return; go(); }; li.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
  });
  $('#results').querySelectorAll('.quick').forEach(b => b.onclick = () => quickSaveObs(+b.dataset.id, { status: 'ai', prob: +b.dataset.p, withPhotos: true }));
  const more = $('#btn-more-res'); if (more) more.onclick = () => { showAllResults = !showAllResults; renderResults(); };
  $('#btn-other').onclick = () => openSpeciesSearch(id => openSaveSheet(id, null));
  $('#btn-indet').onclick = () => openSaveSheet(indetFor(state.group), null);
  if (lastRenderedSig !== r.sig) { lastRenderedSig = r.sig; buzz(20); $('#results-card').scrollIntoView({ block: 'start', behavior: 'smooth' }); }
}
const cap = t => t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
const pct = p => Math.round(p * 100);

// Spara ett fynd direkt med förval (senaste substrat, aktivt objekt om du är innanför) – med ångra
async function quickSaveObs(speciesId, { status = 'sure', prob = null, withPhotos = false } = {}) {
  const sp = state.species[speciesId];
  const pos = posForSave();
  const def = defaultObjectFor(pos);
  const nv = isNvArt(sp);
  const obs = { id: uid('o'), time: Date.now(), speciesId, sci: sp.sci, pos, objectId: def.id,
    method: status === 'ai' ? 'Endast AI-förslag' : 'Okulärt i fält', status, confirmed: status === 'sure', unsure: status === 'ai' && nv,
    amount: '', count: '', unit: '', sub: {}, substrate: '', notes: '', photoIds: [], source: status === 'ai' ? 'snabbspara-ai' : 'snabbregistrering',
    ai: withPhotos && state.result ? state.result.top.slice(0, 5).map(a => ({ id: a.id, sci: state.species[a.id].sci, p: +a.p.toFixed(4) })) : [], aiProbChosen: prob };
  const ops = [];
  if (withPhotos) { for (const ph of state.photos) ops.push({ store: 'photos', value: { id: ph.id, obsId: obs.id, blob: ph.blob, crop: ph.crop, thumb: ph.thumb } }); obs.photoIds = state.photos.map(ph => ph.id); }
  ops.push({ store: 'observations', value: obs });
  await db.atomic(ops);
  if (withPhotos) { state.photos = []; state.result = null; }
  await reload(); render(); buzz(pos ? 30 : [60, 40, 60]);
  const obName = state.objects.find(x => x.id === obs.objectId)?.name;
  toast(`Sparat: ${cap(sp.sv || sp.sci)}${obName ? ' · ' + obName : ''}${pos ? ` · ±${pos.acc} m` : ' · utan GPS!'}`, async () => {
    await db.atomic([...obs.photoIds.map(pid => ({ store: 'photos', del: true, key: pid })), { store: 'observations', del: true, key: obs.id }]);
    await reload(); render(); toast('Ångrat');
  });
  return obs;
}

// ---------------- Korta förklaringar (ⓘ) ----------------
const INFO = {
  art: ['Art', 'För arter du känner igen. Sök eller tryck på arten – den registreras direkt här med GPS-position (okulärt i fält). Tryck en gång till på samma art för mängd, substrat, foto eller osäker bestämning.'],
  foto: ['Foto', 'För arter du inte känner igen. Ta en eller flera bilder (närbild + översikt). Om AI-artbestämning är nedladdad får du förslag med procent. Annars – eller om inget förslag stämmer – spara som obestämd och bestäm arten senare under Lista.'],
  objekt: ['Objekt', 'Ett naturvärdesobjekt (en avgränsad yta). Avgränsa genom att gå gränsen med GPS eller rita på kartan. Fynd du gör inne i objektet kopplas automatiskt till det.'],
  punkt: ['Punkt', 'En anteckning med position och gärna foto – t.ex. en grov låga, ett hålträd, en kulturlämning eller något du vill hitta igen. Räknas inte som artfynd.'],
  here: ['Du är i …', 'Visar vilket naturvärdesobjekt din GPS-position ligger i. Nya fynd kopplas till det objektet. Tryck för att öppna objektkortet.'],
  senast: ['Senast', 'Arter du registrerat nyligen. Ett tryck registrerar arten igen på din nuvarande position. Håll fingret kvar för att fylla i detaljer först.'],
  osaker: ['Osäker bestämning', 'Kryssa i om du inte är säker på arten. Fyndet sparas men räknas inte när objektets artvärde och antal naturvårdsarter summeras. Fynd som bara bygger på AI-förslag räknas inte heller förrän du valt en kontrollmetod.'],
  objkort: ['Objektkortet', 'Fältläge visar bara det som behövs ute: avgränsning, biotop, strukturer, foton, anteckningar och preliminär klass. Kontorsläget visar alla rapportfält (motiveringar, Natura 2000, biotopskydd, skötsel och bedömningsmatrisen). Allt sparas automatiskt.'],
  avgr: ['Avgränsning', '"Gå gränsen" spelar in din GPS-position medan du går runt objektet – du kan registrera arter under tiden. "Rita på kartan" låter dig trycka ut hörnen och dra dem rätt. Fynd kopplas om automatiskt när avgränsningen ändras.'],
  karta: ['Kartan', '▤ = bakgrundskarta, Skogsstyrelsens lager och nedladdning för offline. ⌖ = centrera på dig. ⤢ = visa alla fynd och objekt. Tryck på en punkt eller ett objekt för att öppna det. Röd ring = rödlistad art eller signalart.'],
  lager: ['Kartlager', 'OpenStreetMap kräver nät. Lantmäteriets terrängkarta kräver en gratis API-nyckel men kan laddas ner för offline. Skogsstyrelsens lager (nyckelbiotoper m.m.) visas online för hela landet och kan laddas ner för det område som syns.'],
  backup: ['Säkerhetskopia', 'Allt du registrerar finns bara på telefonen. En säkerhetskopia är en ZIP-fil med alla fynd, objekt och foton som kan återställas om telefonen går sönder eller webbläsardata rensas. Spara den varje kväll, t.ex. i Filer eller iCloud Drive.'],
  leverans: ['Leverans', 'Paket till beställaren: GeoJSON för GIS, fynd- och objektprotokoll för Excel, rapportunderlag och foton. Skyddsklassade arter redovisas generaliserat (rutor, år) enligt SLU Artdatabanken.'],
  kontor: ['Kontorsläge', 'Av: objektkortet visar bara fältuppgifter. På: alla rapportfält visas, för när du sammanställer inventeringen vid datorn eller i bilen.'],
  ai: ['AI-artbestämning', 'Valfri. En bildmodell (BioCLIP, ≈105 MB) som körs helt på telefonen utan nät och ger artförslag med procent. Den är ett stöd – rödlistade arter och signalarter ska alltid verifieras.'],
};
const info = k => `<button type="button" class="info-btn" data-info="${k}" aria-label="Förklaring: ${esc(INFO[k][0])}">i</button>`;
document.addEventListener('click', e => {
  const b = e.target.closest('.info-btn'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  const [t, txt] = INFO[b.dataset.info] || ['', ''];
  const sh = openSheet(`<h3>${esc(t)}</h3><p class="info-text">${esc(txt)}</p><button class="btn primary full" id="info-ok">OK</button>`, { sub: sheets.length > 0 });
  $('#info-ok', sh.m).onclick = () => closeSheet(sh);
}, true);

// ---------------- Fältvyn: Art · Foto · Objekt · Punkt ----------------
function recentSpecies(n = 8) {
  const seen = new Set(), out = [];
  const pool = [...state.observations].sort((a, b) => b.time - a.time);
  for (const o of pool) { const sp = state.species[o.speciesId]; if (!sp || sp.syn) continue; if (!seen.has(o.speciesId)) { seen.add(o.speciesId); out.push(o.speciesId); } if (out.length >= n) break; }
  return out;
}
function renderIdView() {
  const v = $('#view-id');
  const hasPhotos = state.photos.length > 0;
  const recent = recentSpecies();
  if (hasPhotos) {
    v.innerHTML = `
      <div class="card">
        <div class="row between"><h3>Okänd art</h3><button class="linkbtn" id="btn-clear">✕ Avbryt</button></div>
        <div class="photo-row">
          <div class="thumbs" id="thumbs">${state.photos.map((p, i) => `<div class="thumb"><img src="${p.thumb}" data-i="${i}" alt="Foto ${i + 1}, tryck för att beskära"><button class="x" data-i="${i}" aria-label="Ta bort foto ${i + 1}">×</button></div>`).join('')}</div>
          <label class="btn add-photo"><input type="file" accept="image/*" capture="environment" id="cam" hidden>＋ Foto</label>
        </div>
        <div class="small muted">Vilken grupp? (ger säkrare förslag)</div>
        <div class="group-grid" id="group-chips" role="group" aria-label="Artgrupp">${GROUPS.map(g => `<button class="chip ${state.group === g.id ? 'on' : ''}" aria-pressed="${state.group === g.id}" data-g="${g.id}">${g.short || g.label}</button>`).join('')}</div>
      </div>
      <div id="results"></div>`;
  } else {
    v.innerHTML = `
      <div class="card here-card row"><div id="here" class="grow">${hereText()}</div>${info('here')}</div>
      <div class="action-grid">
        <div class="tile"><button class="btn primary bigtile" id="act-art"><span aria-hidden="true">✓</span>Art<small>känd art</small></button>${info('art')}</div>
        <div class="tile"><label class="btn bigtile"><input type="file" accept="image/*" capture="environment" id="cam" hidden><span aria-hidden="true">📷</span>Foto<small>okänd art</small></label>${info('foto')}</div>
        <div class="tile"><button class="btn bigtile" id="act-obj"><span aria-hidden="true">▣</span>Objekt<small>ny avgränsning</small></button>${info('objekt')}</div>
        <div class="tile"><button class="btn bigtile" id="act-note"><span aria-hidden="true">✎</span>Punkt<small>anteckning/foto</small></button>${info('punkt')}</div>
      </div>
      ${recent.length ? `<div class="card"><div class="row between"><h3>Senast</h3>${info('senast')}</div><p class="muted small">Ett tryck = nytt fynd här. Håll inne för detaljer.</p>
        <div class="recent">${recent.map(id => { const sp = state.species[id]; return `<button class="chip recent-chip" data-id="${id}">${esc(cap(sp.sv || sp.sci))}</button>`; }).join('')}</div></div>` : ''}`;
  }
  v.querySelectorAll('#group-chips .chip').forEach(b => b.onclick = () => { state.group = b.dataset.g; state.settings.group = state.group; db.setKV('settings', state.settings); renderIdView(); analyze(); });
  const onFiles = async files => {
    if (!files.length) return;
    for (const f of files) state.photos.push(await makePhoto(f));
    state.photos = state.photos.slice(-4);
    renderIdView();
    if (!state.modelReady) { renderNoModel(); return; }
    analyze();
  };
  $('#cam').onchange = e => onFiles([...e.target.files]);
  v.querySelectorAll('.thumb img').forEach(img => img.onclick = () => openCropper(state.photos[+img.dataset.i]));
  v.querySelectorAll('.thumb .x').forEach(b => b.onclick = () => {
    const i = +b.dataset.i; const removed = state.photos.splice(i, 1)[0]; state.result = null; renderIdView(); if (state.photos.length) analyze();
    toast('Fotot borttaget', () => { state.photos.splice(i, 0, removed); renderIdView(); analyze(); });
  });
  const clr = $('#btn-clear'); if (clr) clr.onclick = () => { analyzeSeq++; state.photos = []; state.result = null; renderIdView(); };
  const art = $('#act-art'); if (art) art.onclick = () => openArtSheet(objectAt(gps.fresh(30000))?.id || null);
  const ao = $('#act-obj'); if (ao) ao.onclick = () => newObject();
  const an = $('#act-note'); if (an) an.onclick = () => openNoteSheet();
  v.querySelectorAll('.recent-chip').forEach(c => {
    let held = false, timer = null;
    c.onpointerdown = () => { held = false; timer = setTimeout(() => { held = true; buzz(15); state.result = null; openSaveSheet(+c.dataset.id, null); }, 550); };
    c.onpointerup = c.onpointerleave = () => clearTimeout(timer);
    c.oncontextmenu = e => e.preventDefault();
    c.onclick = () => { if (held) return; state.result = null; quickSaveObs(+c.dataset.id, { status: 'sure' }); };
  });
  if (hasPhotos) { if (!state.modelReady) renderNoModel(); else renderResults(); }
}
function renderNoModel() {
  const r = $('#results'); if (!r) return;
  r.innerHTML = `<div class="card"><p><b>AI-artbestämning är inte nedladdad.</b> Spara fotot som obestämt och bestäm arten senare, eller välj art själv.</p>
    <button class="btn primary full" id="btn-indet">Spara som obestämd</button>
    <button class="btn full" id="btn-noai-search">🔍 Välj art själv</button>
    <p class="muted small">AI-bestämning kan laddas ner under Mer (≈105 MB).</p></div>`;
  $('#btn-indet').onclick = () => openSaveSheet(indetFor(state.group), null);
  $('#btn-noai-search').onclick = () => openSpeciesSearch(id => openSaveSheet(id, null));
}

// ---------------- Beskärning ----------------
function openCropper(photo) {
  const m = modal(`<h3>Beskär</h3><p class="muted small">Dra rutan över arten. Mindre ruta = mer detaljer.</p>
    <div class="crop-wrap"><img src="${photo.url}" id="crop-img" alt=""><div class="crop-box" id="crop-box"></div></div>
    <div class="field">Storlek<div class="row gap"><button class="btn grow" id="crop-minus" aria-label="Mindre ruta, mer detaljer">－ Närmare</button><button class="btn grow" id="crop-plus" aria-label="Större ruta">＋ Mer</button></div>
      <input type="range" id="crop-size" min="15" max="100" value="${Math.round(photo.crop.s * 100)}" aria-label="Rutans storlek"></div>
    <div class="row gap"><button class="btn grow" id="crop-reset">Återställ</button><button class="btn primary grow" id="crop-ok">Använd</button></div>`);
  const img = $('#crop-img', m), box = $('#crop-box', m), size = $('#crop-size', m);
  const crop = { ...photo.crop };
  const minD = Math.min(photo.w, photo.h);
  const draw = () => {
    const sc = img.clientWidth / photo.w;
    const side = minD * crop.s * sc;
    box.style.width = box.style.height = side + 'px';
    box.style.left = crop.x * photo.w * sc + 'px'; box.style.top = crop.y * photo.h * sc + 'px';
  };
  const clamp = () => {
    const sw = minD * crop.s / photo.w, sh = minD * crop.s / photo.h;
    crop.x = Math.min(Math.max(0, crop.x), 1 - sw); crop.y = Math.min(Math.max(0, crop.y), 1 - sh);
  };
  img.onload = draw; if (img.complete) setTimeout(draw, 0);
  size.oninput = () => {
    const cx = crop.x + minD * crop.s / photo.w / 2, cy = crop.y + minD * crop.s / photo.h / 2;
    crop.s = size.value / 100;
    crop.x = cx - minD * crop.s / photo.w / 2; crop.y = cy - minD * crop.s / photo.h / 2; clamp(); draw();
  };
  let drag = null;
  box.onpointerdown = e => { drag = { x: e.clientX, y: e.clientY, cx: crop.x, cy: crop.y }; box.setPointerCapture(e.pointerId); };
  box.onpointermove = e => {
    if (!drag) return;
    const sc = img.clientWidth / photo.w;
    crop.x = drag.cx + (e.clientX - drag.x) / sc / photo.w; crop.y = drag.cy + (e.clientY - drag.y) / sc / photo.h; clamp(); draw();
  };
  box.onpointerup = () => { drag = null; };
  $('#crop-minus', m).onclick = () => { size.value = Math.max(15, +size.value - 10); size.oninput(); };
  $('#crop-plus', m).onclick = () => { size.value = Math.min(100, +size.value + 10); size.oninput(); };
  $('#crop-reset', m).onclick = () => { Object.assign(crop, defaultCrop(photo.w, photo.h)); size.value = 100; draw(); };
  $('#crop-ok', m).onclick = () => { photo.crop = crop; closeModal(); analyze(); };
}

// ---------------- Modal / ark ----------------
// Ark i en stack. Formulärark stängs inte av tryck utanför, frågar innan osparade ändringar kastas,
// och Androids bakåtknapp stänger det översta arket (History API) i stället för att lämna appen.
const sheets = [];
let ignorePop = 0, histEntry = false; // en enda historikpost medan något ark är öppet
let tabEntry = false; // historikpost när annan flik än Fält visas: bakåt leder då till Fält i stället för att lämna appen
function openSheet(html, { form = false, sub = false, onClose = null } = {}) {
  if (!sub) closeModal();
  const bg = document.createElement('div');
  bg.className = 'modal-bg' + (sub ? ' sub' : '');
  bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}<button class="modal-close" aria-label="Stäng">×</button></div>`;
  const m = bg.querySelector('.modal');
  const h = m.querySelector('h3');
  if (h) { h.id = uid('t'); h.tabIndex = -1; m.setAttribute('aria-labelledby', h.id); }
  document.body.appendChild(bg);
  const sheet = { bg, m, form, dirty: false, onClose, prevFocus: document.activeElement };
  sheets.push(sheet);
  if (!histEntry) { history.pushState({ sheet: true }, ''); histEntry = true; }
  if (form) {
    m.addEventListener('input', () => { sheet.dirty = true; });
    m.addEventListener('click', e => { if (e.target.closest('.chip, .seg button')) sheet.dirty = true; });
  }
  m.querySelector('.modal-close').onclick = () => requestClose(sheet);
  bg.onclick = e => { if (e.target === bg && !form) requestClose(sheet); };
  setTimeout(() => (h || m).focus?.({ preventScroll: true }), 30);
  m._sheet = sheet;
  return sheet;
}
function requestClose(sheet) {
  if (sheet.form && sheet.dirty && !confirm('Kasta ändringarna?')) return false;
  closeSheet(sheet);
  return true;
}
function closeSheet(sheet, viaPop = false) {
  const i = sheets.indexOf(sheet);
  if (i < 0) return;
  const removed = sheets.splice(i);
  for (const s of removed.reverse()) { s.bg.remove(); try { s.onClose && s.onClose(); } catch { /* ignorera */ } }
  if (viaPop && sheets.length) { history.pushState({ sheet: true }, ''); histEntry = true; }
  // Stängdes sista arket i koden: ta bort historikposten – men först efter att ev. nytt ark hunnit öppnas
  if (!viaPop && !sheets.length) setTimeout(() => { if (!sheets.length && histEntry) { histEntry = false; ignorePop++; history.back(); } }, 0);
  const f = removed[removed.length - 1].prevFocus;
  if (f && document.contains(f)) f.focus?.({ preventScroll: true });
}
window.addEventListener('popstate', () => {
  if (ignorePop > 0) { ignorePop--; return; }
  if (!sheets.length) { // ingen öppen dialog: bakåt från en annan flik går till Fält
    if (tabEntry) { tabEntry = false; state.view = 'id'; render(); window.scrollTo(0, 0); }
    return;
  }
  histEntry = false;
  const top = sheets[sheets.length - 1];
  if (!top) return;
  if (top.form && top.dirty && !confirm('Kasta ändringarna?')) { history.pushState({ sheet: true }, ''); histEntry = true; return; }
  closeSheet(top, true);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheets.length) requestClose(sheets[sheets.length - 1]); });
// Bakåtkompatibla hjälpare
function modal(html, opts) { return openSheet(html, opts).m; }
function closeModal() { if (sheets.length) closeSheet(sheets[0]); }
function subModal(html, opts = {}) { const sh = openSheet(html, { ...opts, sub: true }); return { m: sh.m, close: () => closeSheet(sh) }; }
function markClean(m) { if (m && m._sheet) m._sheet.dirty = false; }

function toast(msg, undo, ms) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status');
  t.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button class="toast-undo">Ångra</button>' : ''}`;
  document.body.appendChild(t);
  document.body.classList.add('has-toast');
  const remove = () => { t.remove(); if (!document.querySelector('.toast')) document.body.classList.remove('has-toast'); };
  if (undo) t.querySelector('.toast-undo').onclick = () => { remove(); undo(); };
  setTimeout(remove, ms || (undo ? 8000 : 4000));
}
const buzz = pattern => { try { if (state.settings.vibrate !== false) navigator.vibrate?.(pattern); } catch { /* ignorera */ } };
// En rad med snabbval (ett val i taget, tryck igen för att avmarkera)
function chipRow(name, opts, selected) {
  return `<div class="chips wrap chip-row" data-row="${name}" role="group">${opts.map(o => `<button type="button" class="chip ${selected === o ? 'on' : ''}" aria-pressed="${selected === o}" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
}
function bindChipRows(root) {
  root.querySelectorAll('.chip-row').forEach(row => row.querySelectorAll('.chip').forEach(c => c.onclick = () => {
    const was = c.classList.contains('on');
    row.querySelectorAll('.chip').forEach(x => { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); });
    if (!was) { c.classList.add('on'); c.setAttribute('aria-pressed', 'true'); }
  }));
}
function chipValue(root, name) { const c = root.querySelector(`.chip-row[data-row="${name}"] .chip.on`); return c ? c.dataset.v : ''; }

// ---------------- Artsök ----------------
function openSpeciesSearch(onPick, opts = {}) {
  const sh = openSheet(`<h3>Sök art</h3><input type="search" id="sp-q" class="input" placeholder="Svenskt eller vetenskapligt namn" autofocus>
    <ul class="sp-list" id="sp-list"></ul>`, { sub: !!opts.sub });
  const m = sh.m;
  const q = $('#sp-q', m), list = $('#sp-list', m);
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const render = () => {
    const t = norm(q.value.trim());
    let hits = state.species.filter(s => !s.syn);
    if (t) {
      hits = hits.map(s => {
        const a = norm((s.sv || '') + (s.alt ? ' ' + s.alt : '')), b = norm(s.sci);
        const score = a.startsWith(t) || b.startsWith(t) ? 0 : (a.includes(t) || b.includes(t) ? 1 : 9);
        return { s, score };
      }).filter(x => x.score < 9).sort((x, y) => x.score - y.score || y.s.sel - x.s.sel).map(x => x.s);
    } else hits = hits.filter(s => s.sel);
    list.innerHTML = hits.slice(0, 40).map(s => `<li data-id="${s.id}">${spName(s)} <span class="meta">${GROUP_LABEL[s.grp] || ''} ${badges(s)}</span></li>`).join('')
      || '<li class="muted">Inga träffar</li>';
    list.querySelectorAll('li[data-id]').forEach(li => li.onclick = () => { closeSheet(sh); onPick(+li.dataset.id); });
  };
  q.oninput = render; render(); setTimeout(() => q.focus(), 50);
}

// ---------------- Spara fynd ----------------
// Position för ett nytt fynd: senaste GPS-läget med ålder i sekunder (äldre än 2 min räknas inte).
function posForSave() {
  const p = gps.fresh(120000);
  return p ? { ...p, age: Math.round((Date.now() - p.t) / 1000) } : null;
}
function posQuality(p) {
  if (!p) return 'none';
  const age = p.age ?? (Date.now() - p.t) / 1000;
  return age > 10 || p.acc > 20 ? 'weak' : 'good';
}
function gpsLabel(p, saved = false) {
  if (!p) return gps.error ? `GPS: ${esc(gps.error)}` : '<span class="gps bad">Väntar på GPS …</span>';
  const sw = toSweref99TM(p.lat, p.lon);
  const age = saved ? p.age : Math.round((Date.now() - p.t) / 1000);
  const cls = p.acc <= 10 && !(age > 10) ? 'ok' : p.acc <= 30 && !(age > 30) ? '' : 'bad';
  const warn = !saved && (age > 10 || p.acc > 20) ? '<br><span class="gps-warn">Väntar på bättre position … stå still en stund eller spara ändå.</span>' : '';
  return `<span class="gps ${cls}">±${p.acc} m${age != null && age > 2 ? ` · ${age} s gammal` : ''}</span> N ${sw.N} E ${sw.E} <span class="muted small">(SWEREF 99 TM)</span>${warn}`;
}

// ---------------- Aktivt objekt ----------------
function pointInPolygonM(pt, poly) { // i SWEREF 99 TM-meter
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.N > pt.N) !== (b.N > pt.N) && pt.E < (b.E - a.E) * (pt.N - a.N) / (b.N - a.N) + a.E) inside = !inside;
  }
  return inside;
}
function distToPolygonM(pt, poly) {
  let d = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j], b = poly[i];
    const dx = b.E - a.E, dy = b.N - a.N, L = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((pt.E - a.E) * dx + (pt.N - a.N) * dy) / L));
    d = Math.min(d, Math.hypot(pt.E - (a.E + t * dx), pt.N - (a.N + t * dy)));
  }
  return d;
}
// 'inside' | 'near' (inom 25 m) | 'outside' | 'unknown' (ingen position eller ingen avgränsning)
function relationToObject(ob, p) {
  if (!ob || !p || !ob.polygon || ob.polygon.length < 3) return 'unknown';
  const poly = ob.polygon.map(q => toSweref99TM(q.lat, q.lon));
  const pt = toSweref99TM(p.lat, p.lon);
  if (pointInPolygonM(pt, poly)) return 'inside';
  return distToPolygonM(pt, poly) <= 25 ? 'near' : 'outside';
}
// Fynd kopplas till det objekt de ligger i (minsta objektet om flera överlappar). Ingen manuell "aktivt objekt"-hantering.
function objectAt(p) {
  if (!p) return null;
  const hits = state.objects.filter(ob => relationToObject(ob, p) === 'inside');
  hits.sort((a, b) => polygonAreaM2(a.polygon) - polygonAreaM2(b.polygon));
  return hits[0] || null;
}
const activeObject = () => objectAt(gps.fresh(30000));
function setActiveObject() { /* ersatt av rumslig koppling */ }
function defaultObjectFor(p) { const ob = objectAt(p); return { id: ob ? ob.id : null, note: '' }; }
function renderActiveBar() { const el = $('#here'); if (el) el.innerHTML = hereText(); }
document.addEventListener('click', e => { if (e.target.closest('#here')) { const ob = objectAt(gps.fresh(30000)); if (ob) openObjectEditor(ob); } });
function hereText() {
  const p = gps.fresh(30000);
  const ob = objectAt(p);
  if (!p) return '📍 Väntar på GPS …';
  return ob ? `📍 Du är i <b>${esc(ob.name)}</b> <span class="here-open">Objektkort ›</span>` : '📍 Utanför objekt';
}
// Koppla om fynd efter ändrad avgränsning (fynd där användaren själv valt objekt lämnas)
async function relinkObservations() {
  const ops = [];
  for (const o of state.observations) {
    if (!o.pos || o.manualObject) continue;
    const cur = o.objectId && state.objects.find(x => x.id === o.objectId);
    if (cur && !(cur.polygon && cur.polygon.length >= 3)) continue;
    const id = objectAt(o.pos)?.id || null;
    if (id !== (o.objectId || null)) ops.push({ store: 'observations', value: { ...o, objectId: id } });
  }
  if (ops.length) { await db.atomic(ops); await reload(); }
  return ops.length;
}
const indetFor = grp => state.species.find(s => s.syn === 'indet' && s.grp === (grp === 'alla' ? 'lav' : grp))?.id;
const noteSpecies = () => state.species.find(s => s.syn === 'note')?.id;

// ---------------- Gränsinspelning (global, fortsätter i alla vyer) ----------------
let recOff = null, wakeLock = null;
const recListeners = new Set();
async function requestWakeLock() {
  try { if ('wakeLock' in navigator && document.visibilityState === 'visible') wakeLock = await navigator.wakeLock.request('screen'); } catch { /* stöds ej */ }
}
document.addEventListener('visibilitychange', () => { if (state.recording && document.visibilityState === 'visible') requestWakeLock(); });
async function startRecording(obId) {
  if (state.recording) stopRecording(true);
  state.recording = { obId, lastPointAt: Date.now(), gaps: 0 };
  await db.setKV('recording', { obId });
  requestWakeLock();
  recOff = gps.on(async p => {
    const r = state.recording; if (!r || !p || p.acc > 30) return;
    const ob = await db.get('objects', r.obId); if (!ob) return stopRecording(); // färsk kopia – andra vyer kan ha ändrat objektet
    ob.polygon ||= [];
    const last = ob.polygon[ob.polygon.length - 1];
    if (last && distanceM(last, p) < 5) return;
    if (Date.now() - r.lastPointAt > 30000) r.gaps++;
    r.lastPointAt = Date.now();
    ob.polygon.push({ lat: p.lat, lon: p.lon, acc: p.acc });
    await db.put('objects', ob);
    const i = state.objects.findIndex(o => o.id === ob.id); if (i >= 0) state.objects[i] = ob;
    renderRecBar(); renderActiveBar(); recListeners.forEach(fn => fn(ob));
  });
  renderRecBar();
  toast('Inspelning startad – gå längs gränsen. Du kan registrera arter under tiden.');
}
function stopRecording(silent = false) {
  if (recOff) { recOff(); recOff = null; }
  const r = state.recording; state.recording = null;
  db.setKV('recording', null);
  try { wakeLock && wakeLock.release(); } catch { /* ignorera */ } wakeLock = null;
  renderRecBar();
  if (r && !silent) {
    const ob = state.objects.find(o => o.id === r.obId);
    if (ob) { buzz(30); toast(`Gränsen sparad: ${ob.polygon.length} punkter · ${formatArea(polygonAreaM2(ob.polygon))}`); recListeners.forEach(fn => fn(ob)); reload().then(relinkObservations); }
  }
}
function renderRecBar() {
  const el = $('#rec-bar'); if (!el) return;
  const r = state.recording;
  if (!r) { el.hidden = true; document.body.classList.remove('recording'); return; }
  const ob = state.objects.find(o => o.id === r.obId);
  const n = ob?.polygon?.length || 0;
  el.hidden = false; document.body.classList.add('recording');
  const stale = Date.now() - r.lastPointAt > 30000;
  el.innerHTML = `<span class="rec-dot" aria-hidden="true"></span><span class="rec-txt">Spelar in gräns: ${esc(ob?.name || '')} · ${n} p · ${formatArea(polygonAreaM2(ob?.polygon || []))}${stale ? ' · <b>ingen ny punkt på ' + Math.round((Date.now() - r.lastPointAt) / 1000) + ' s</b>' : ''}</span><button id="rec-stop" class="rec-stop">■ Stoppa</button>`;
  $('#rec-stop').onclick = () => stopRecording();
}
setInterval(() => { if (state.recording) renderRecBar(); renderActiveBar(); }, 10000);

const ID_METHODS = ['Okulärt i fält', 'Lupp', 'Kemiskt test', 'Mikroskop', 'Belägg insamlat', 'Expertverifierad'];
const UNITS = ['st', 'ex', 'fruktkroppar', 'bålar', 'träd/substrat', 'skott', 'kolonier', 'dm²', 'm²', 'lokaler'];
// Status för bestämningen: 'sure' (kontrollerad), 'unsure' (osäker), 'ai' (bara AI-förslag)
function statusOf(o) { return o.method === 'Endast AI-förslag' ? 'ai' : o.unsure ? 'unsure' : o.confirmed ? 'sure' : (o.method ? 'sure' : ''); }

// existing = befintligt fynd; draft = ifyllda värden för ett NYTT fynd (t.ex. efter "Byt art")
function openSaveSheet(speciesId, prob, existing, draft) {
  const sp = state.species[speciesId];
  const isNew = !existing;
  const o = existing || draft || {};
  const sub = existing ? { ...(o.sub || {}), legacy: !o.sub && !!o.substrate } : (draft ? { ...(draft.sub || {}) } : { ...state.lastSub });
  const pos = isNew ? posForSave() : o.pos;
  const def = isNew ? (draft && 'objectId' in draft ? { id: draft.objectId, note: '' } : defaultObjectFor(pos)) : { id: o.objectId, note: '' };
  const status0 = o.status || (existing ? statusOf(o) : (prob != null ? 'ai' : 'sure'));
  const nv = isNvArt(sp);
  const moreOpen = !!(sub.diam || sub.decay || o.count || o.notes);
  const sheet = openSheet(`<h3>${spName(sp)}</h3>
    <div class="meta">${GROUP_LABEL[sp.grp] || ''} ${badges(sp)} ${prob != null ? `<span class="muted small">AI ${Math.round(prob * 100)} %</span>` : ''}
      <button class="btn small ghost" id="sv-change">Byt art</button></div>
    ${sp.sk ? `<div class="note warn small"><b>Skyddsklassad</b> – exakt läge, datum och kommentarer döljs i leveransen (${sp.sk} km-ruta).${sp.skR && sp.skR !== 'H' ? ' ' + esc(sp.skR) : ''}</div>` : ''}
    <label class="check big-check"><input type="checkbox" id="sv-unsure" ${status0 === 'unsure' ? 'checked' : ''}> <span class="grow"><b>Osäker bestämning</b> <span class="muted small">– räknas inte i objektets artvärde</span></span>${info('osaker')}</label>
    <div class="small" id="sv-status-note"></div>
    ${sp.grp === 'fagel' ? `<div class="field">Aktivitet${chipRow('activity', BIRD_ACTIVITY, o.activity)}</div>` : ''}
    <div class="field">Mängd${chipRow('amount', AMOUNT, o.amount)}</div>
    ${sub.legacy ? `<div class="small muted">Tidigare substrat: ${esc(o.substrate)}</div>` : ''}
    <div class="field">${SUB.type.label}${chipRow('sub-type', SUB.type.opts, sub.type)}</div>
    <div class="field">${SUB.tree.label}${chipRow('sub-tree', SUB.tree.opts, sub.tree)}</div>
    <details class="more" ${moreOpen ? 'open' : ''}><summary>Fler detaljer (metod, diameter, nedbrytning, antal, kommentar)</summary>
      <div class="field" id="sv-method-row">Metod${chipRow('method', ID_METHODS, o.method && o.method !== 'Endast AI-förslag' ? o.method : '')}</div>
      <div class="field">${SUB.diam.label}${chipRow('sub-diam', SUB.diam.opts, sub.diam)}</div>
      <div class="field">${SUB.decay.label}${chipRow('sub-decay', SUB.decay.opts, sub.decay)}</div>
      <div class="row gap"><label class="field grow">Antal<input type="number" inputmode="decimal" id="sv-count" class="input" value="${esc(o.count ?? '')}"></label>
        <label class="field grow">Enhet<select id="sv-unit" class="input">${UNITS.map(u => `<option ${o.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select></label></div>
      <label class="field">Kommentar<textarea id="sv-notes" class="input" rows="2">${esc(o.notes || '')}</textarea></label>
    </details>
    <label class="field">Naturvärdesobjekt <span class="muted small">(väljs efter läget)</span><select id="sv-obj" class="input"><option value="">– inget –</option>${state.objects.map(ob => `<option value="${ob.id}" ${def.id === ob.id ? 'selected' : ''}>${esc(ob.name)}</option>`).join('')}</select></label>
    ${def.note ? `<div class="small gps-warn">${esc(def.note)}</div>` : ''}
    <div class="small" id="sv-gps">${isNew ? gpsLabel(gps.fresh(120000)) : (o.pos ? gpsLabel(o.pos, true) : 'Ingen position')}</div>
    ${existing ? '<label class="check"><input type="checkbox" id="sv-repos"> Uppdatera position till nuvarande GPS</label>' : ''}
    <div class="row gap actions"><button class="btn grow" id="sv-cancel">Avbryt</button><button class="btn primary grow big" id="sv-save">Spara</button></div>`, { form: true });
  const m = sheet.m;
  bindChipRows(m);
  // Status: osäker om rutan är ikryssad; annars "bara AI" om fyndet kom från AI-förslag utan angiven metod
  const statusNow = () => $('#sv-unsure', m).checked ? 'unsure' : chipValue(m, 'method') ? 'sure' : (prob != null && isNew) || (!isNew && status0 === 'ai') ? 'ai' : 'sure';
  const noteStatus = () => {
    const st = statusNow();
    $('#sv-status-note', m).innerHTML = st === 'ai' && nv ? '<span class="gps-warn">AI-förslag: räknas inte som naturvårdsart förrän du kontrollerat arten (välj metod under Fler detaljer).</span>' : '';
  };
  m.addEventListener('click', () => setTimeout(noteStatus, 0)); $('#sv-unsure', m).onchange = noteStatus; noteStatus();
  const obj0 = def.id || '';
  const collect = () => {
    const sb = {};
    for (const k of Object.keys(SUB)) { const v = chipValue(m, 'sub-' + k); if (v) sb[k] = v; }
    const status = statusNow();
    const method = status === 'ai' ? 'Endast AI-förslag' : (chipValue(m, 'method') || 'Okulärt i fält');
    const objSel = $('#sv-obj', m).value;
    return {
      count: $('#sv-count', m).value, unit: $('#sv-unit', m).value, amount: chipValue(m, 'amount'), activity: chipValue(m, 'activity'),
      sub: sb, substrate: substrateText(sb) || (sub.legacy ? o.substrate : ''),
      objectId: objSel || null, manualObject: objSel !== obj0 ? true : !!o.manualObject, notes: $('#sv-notes', m).value,
      method, status, confirmed: status === 'sure', unsure: status === 'unsure' || (status === 'ai' && nv),
    };
  };
  const off = gps.on(p => { const el = $('#sv-gps', m); if (el && isNew) el.innerHTML = gpsLabel(p); });
  sheet.onClose = off;
  // Byt art: sökningen öppnas ovanpå, och allt ifyllt följer med till den nya arten
  $('#sv-change', m).onclick = () => openSpeciesSearch(id => {
    const d = collect();
    markClean(m); closeSheet(sheet);
    const p2 = state.result?.top.find(a => a.id === id)?.p ?? null;
    openSaveSheet(id, p2, existing ? { ...o, ...d } : null, existing ? null : d);
  }, { sub: true });
  $('#sv-cancel', m).onclick = () => requestClose(sheet);
  $('#sv-save', m).onclick = async () => {
    if ($('#sv-save', m).disabled) return; // skydd mot dubbeltryck
    $('#sv-save', m).disabled = true;
    const base = collect();
    if (Object.keys(base.sub).length) { state.lastSub = base.sub; db.setKV('lastSub', base.sub); }
    if (existing) {
      const upd = { ...existing, ...base, speciesId, sci: sp.sci };
      if ($('#sv-repos', m) && $('#sv-repos', m).checked && posForSave()) upd.pos = posForSave();
      await db.put('observations', upd);
      markClean(m); closeModal(); await reload(); render();
      toast('Fyndet uppdaterat');
    } else {
      const p = posForSave();
      const obs = {
        id: uid('o'), time: Date.now(), speciesId, sci: sp.sci, pos: p, ...base,
        ai: state.result ? state.result.top.slice(0, 5).map(a => ({ id: a.id, sci: state.species[a.id].sci, p: +a.p.toFixed(4) })) : [],
        aiProbChosen: prob, aiCorrected: state.result ? state.result.top[0].id !== speciesId : false,
        aiList: state.list, aiGroup: state.group, photoIds: [],
      };
      const ops = state.photos.map(ph => ({ store: 'photos', value: { id: ph.id, obsId: obs.id, blob: ph.blob, crop: ph.crop, thumb: ph.thumb } }));
      obs.photoIds = state.photos.map(ph => ph.id);
      ops.push({ store: 'observations', value: obs });
      await db.atomic(ops);
      state.photos = []; state.result = null;
      markClean(m); closeModal(); await reload(); render();
      buzz(p ? 30 : [60, 40, 60]);
      const obName = state.objects.find(x => x.id === obs.objectId)?.name;
      toast(`Sparat: ${cap(sp.sv || sp.sci)}${obName ? ' · ' + obName : ''}${p ? ` · ±${p.acc} m` : ' · utan GPS!'}`, async () => {
        await db.atomic([...obs.photoIds.map(pid => ({ store: 'photos', del: true, key: pid })), { store: 'observations', del: true, key: obs.id }]);
        await reload(); render(); toast('Fyndet ångrat');
      });
    }
  };
  return sheet;
}

// ---------------- Fyndlistan ----------------
let obsFilter = 'alla';
function renderObsView() {
  const v = $('#view-obs');
  let list = [...state.observations].sort((a, b) => b.time - a.time);
  if (obsFilter === 'rl') list = list.filter(o => state.species[o.speciesId]?.rl);
  if (obsFilter === 'sig') list = list.filter(o => state.species[o.speciesId]?.sig);
  const nRl = new Set(state.observations.filter(o => countsAsNv(o) && state.species[o.speciesId].rl && state.species[o.speciesId].rl !== 'DD').map(o => o.speciesId)).size;
  const nSig = new Set(state.observations.filter(o => countsAsNv(o) && state.species[o.speciesId].sig).map(o => o.speciesId)).size;
  const byDay = {};
  const dayLabel = t => {
    const d = new Date(t), today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.round((today - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
    return diff === 0 ? 'I dag' : diff === 1 ? 'I går' : d.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
  };
  for (const o of list) { const d = dayLabel(o.time); (byDay[d] = byDay[d] || []).push(o); }
  v.innerHTML = `
    <div class="card">
      <div class="stats"><div><b>${state.observations.length}</b><span>fynd</span></div><div><b>${new Set(state.observations.filter(o => !state.species[o.speciesId]?.syn).map(o => o.speciesId)).size}</b><span>arter</span></div>
        <div><b>${nRl}</b><span>rödlistade</span></div><div><b>${nSig}</b><span>signal-/E-arter</span></div></div>
      <div class="seg">${[['alla', 'Alla'], ['rl', 'Rödlistade'], ['sig', 'Signalarter']].map(([k, l]) => `<button data-f="${k}" class="${obsFilter === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    </div>
    ${Object.entries(byDay).map(([d, os]) => `<h4 class="day">${d}</h4><div class="card list">${os.map(o => {
      const sp = state.species[o.speciesId] || { sci: '?', sv: '' };
      return `<div class="obs" data-id="${o.id}"><div class="obs-thumb" data-pid="${o.photoIds?.[0] || ''}"></div>
        <div class="grow"><div>${sp.syn === 'note' ? `✎ ${esc((o.notes || 'Anteckning').slice(0, 60))}` : spName(sp)}</div><div class="meta">${new Date(o.time).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
        ${o.count ? `· ${esc(o.count)} ${esc(o.unit || '')}` : ''}${o.amount ? ` · ${esc(o.amount)}` : ''} ${badges(sp)} ${o.pos ? '' : '<span class="badge bad">Ingen GPS</span>'} ${sp.syn === 'indet' ? '<span class="badge bad">Obestämd</span>' : o.confirmed || sp.syn ? '' : '<span class="badge">Okontrollerad</span>'} ${o.unsure ? '<span class="badge bad">Osäker</span>' : ''}</div></div></div>`;
    }).join('')}</div>`).join('') || '<div class="card muted center">Inga fynd ännu.</div>'}`;
  v.querySelectorAll('.seg button').forEach(b => b.onclick = () => { obsFilter = b.dataset.f; renderObsView(); });
  v.querySelectorAll('.obs').forEach(el => el.onclick = () => openObsDetail(el.dataset.id));
  v.querySelectorAll('.obs-thumb[data-pid]').forEach(async el => {
    if (!el.dataset.pid) return;
    const p = await db.get('photos', el.dataset.pid);
    if (p) el.style.backgroundImage = `url(${p.thumb})`;
  });
}

async function addEvidencePhotos(o, files) {
  if (!files.length) return;
  const ops = [];
  const ids = [];
  for (const f of files) { const p = await makePhoto(f); ops.push({ store: 'photos', value: { id: p.id, obsId: o.id, blob: p.blob, crop: p.crop, thumb: p.thumb } }); ids.push(p.id); }
  ops.push({ store: 'observations', value: { ...o, photoIds: [...(o.photoIds || []), ...ids] } });
  await db.atomic(ops); buzz(20); toast(`${ids.length} foto sparat som belägg`);
}
async function openObsDetail(id) {
  const o = state.observations.find(x => x.id === id);
  if (!o) return;
  const sp = state.species[o.speciesId];
  const photos = await Promise.all((o.photoIds || []).map(pid => db.get('photos', pid)));
  const urls = photos.filter(Boolean).map(p => URL.createObjectURL(p.blob));
  const sw = o.pos ? toSweref99TM(o.pos.lat, o.pos.lon) : null;
  const m = modal(`<h3>${spName(sp)}</h3><div class="meta">${GROUP_LABEL[sp.grp] || ''} ${badges(sp)}</div>
    <div class="gallery">${urls.map(u => `<img src="${u}" alt="">`).join('')}</div>
    <table class="kv">
      <tr><th>Tid</th><td>${new Date(o.time).toLocaleString('sv-SE')}</td></tr>
      <tr><th>Position</th><td>${o.pos ? `N ${sw.N} E ${sw.E} (±${o.pos.acc} m${o.pos.age > 10 ? `, ${o.pos.age} s gammal` : ''})<br><span class="muted small">${o.pos.lat.toFixed(6)}, ${o.pos.lon.toFixed(6)}</span>` : 'Saknas'}</td></tr>
      ${o.count ? `<tr><th>Antal</th><td>${esc(o.count)} ${esc(o.unit || '')}</td></tr>` : ''}
      ${o.amount ? `<tr><th>Mängd</th><td>${esc(o.amount)}</td></tr>` : ''}
      ${o.substrate ? `<tr><th>Substrat</th><td>${esc(o.substrate)}</td></tr>` : ''}
      ${o.method ? `<tr><th>Metod</th><td>${esc(o.method)}${o.unsure ? ' · <b>osäker bestämning</b>' : ''}</td></tr>` : ''}
      ${o.objectId ? `<tr><th>Objekt</th><td>${esc(state.objects.find(x => x.id === o.objectId)?.name || '')}</td></tr>` : ''}
      ${o.notes ? `<tr><th>Kommentar</th><td>${esc(o.notes)}</td></tr>` : ''}
      ${o.ai?.length ? `<tr><th>AI-förslag</th><td>${o.ai.slice(0, 3).map(a => `${Math.round(a.p * 100)} % <i>${esc(state.species[a.id]?.sci)}</i>`).join('<br>')}</td></tr>` : ''}
    </table>
    ${sp.syn === 'indet' ? '<button class="btn primary full" id="od-det">🔍 Bestäm arten</button>' : ''}
    <div class="row gap"><label class="btn grow"><input type="file" accept="image/*" capture="environment" id="od-photo" hidden>📷 Lägg till belägg</label><button class="btn primary grow" id="od-edit">Redigera</button></div>
    <button class="linkbtn danger" id="od-del">Radera fyndet</button>`);
  $('#od-edit', m).onclick = () => sp.syn === 'note' ? openNoteSheet(o) : openSaveSheet(o.speciesId, o.aiProbChosen, o);
  const det = $('#od-det', m); if (det) det.onclick = () => openSpeciesSearch(id => openSaveSheet(id, null, o), { sub: true });
  $('#od-photo', m).onchange = async e => { await addEvidencePhotos(o, [...e.target.files]); closeModal(); await reload(); render(); openObsDetail(o.id); };
  $('#od-del', m).onclick = async () => {
    await db.atomic([...(o.photoIds || []).map(pid => ({ store: 'photos', del: true, key: pid })), { store: 'observations', del: true, key: o.id }]);
    closeModal(); await reload(); render();
    toast(`${cap(sp.sv || sp.sci)} raderat`, async () => { await db.atomic([...photos.filter(Boolean).map(p => ({ store: 'photos', value: p })), { store: 'observations', value: o }]); await reload(); render(); });
  };
}

// ---------------- Uppdrag ----------------
function openProjectEditor() {
  const p = state.project;
  const m = modal(`<h3>Uppdrag</h3>
    <label class="field">Uppdragsnamn<input id="pr-name" class="input" value="${esc(p.name)}"></label>
    <label class="field">Beställare<input id="pr-client" class="input" value="${esc(p.client)}"></label>
    <label class="field">Inventerare<input id="pr-inv" class="input" value="${esc(p.inventors)}" placeholder="Namn, namn"></label>
    <label class="field">Standard<select id="pr-std" class="input">${['SS 199000:2023', 'SS 199000:2014'].map(s => `<option ${p.standard === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
    <div class="field">Detaljeringsgrad${chipRow('level', ['Översikt', 'Detalj'], p.level)}</div>
    <div class="field">Tillägg som ingår<div class="chips wrap">${ADDONS.map(a => `<button type="button" class="chip ${p.addons.includes(a) ? 'on' : ''}" data-a="${esc(a)}">${a}</button>`).join('')}</div></div>
    <div class="row gap actions"><button class="btn grow" id="pr-cancel">Avbryt</button><button class="btn primary grow" id="pr-save">Spara</button></div>`, { form: true });
  bindChipRows(m);
  const addons = new Set(p.addons);
  m.querySelectorAll('.chip[data-a]').forEach(c => c.onclick = () => { const a = c.dataset.a; addons.has(a) ? addons.delete(a) : addons.add(a); c.classList.toggle('on'); });
  $('#pr-cancel', m).onclick = () => requestClose(m._sheet);
  $('#pr-save', m).onclick = async () => {
    state.project = { name: $('#pr-name', m).value, client: $('#pr-client', m).value, inventors: $('#pr-inv', m).value,
      standard: $('#pr-std', m).value, level: chipValue(m, 'level') || 'Detalj', addons: [...addons] };
    await db.setKV('project', state.project); markClean(m); closeModal(); render(); toast('Uppdraget sparat');
  };
}
const klass4Included = () => state.project.addons.includes('Naturvärdesklass 4');

// ---------------- Naturvärdesobjekt ----------------
function nvSummary(obId) {
  const linked = state.observations.filter(o => o.objectId === obId);
  const nv = linked.filter(countsAsNv);
  const sp = id => state.species[id];
  const rlCats = {};
  for (const id of new Set(nv.filter(o => sp(o.speciesId).rl).map(o => o.speciesId))) { const c = sp(id).rl; if (c !== 'DD') rlCats[c] = (rlCats[c] || 0) + 1; }
  return {
    linked, nv,
    nRl: Object.values(rlCats).reduce((a, b) => a + b, 0), rlCats,
    nS: new Set(nv.filter(o => sp(o.speciesId).sig === 'S').map(o => o.speciesId)).size,
    nE: new Set(nv.filter(o => sp(o.speciesId).sig === 'E').map(o => o.speciesId)).size,
    nUnsure: linked.filter(o => o.unsure && isNvArt(sp(o.speciesId))).length,
  };
}
function nvSummaryText(s) {
  const cats = ['CR', 'EN', 'VU', 'NT'].filter(c => s.rlCats[c]).map(c => `${s.rlCats[c]} ${c}`).join(', ');
  return `${s.nRl} rödlistade${cats ? ` (${cats})` : ''} · ${s.nS} signalarter · ${s.nE} E-arter`
    + (s.nUnsure ? ` · <span class="badge bad">${s.nUnsure} osäkra räknas inte</span>` : '');
}

function renderObjectsView() {
  const v = $('#view-objects');
  const p = state.project;
  const hereOb = objectAt(gps.fresh(30000));
  v.innerHTML = `
    <div class="card"><button class="btn primary full" id="btn-newobj">+ Nytt naturvärdesobjekt</button></div>
    ${state.objects.length ? `<div class="obj-list">${state.objects.map(ob => {
      const pr = objectProps(ob, state.observations, state.species);
      const s = nvSummary(ob.id);
      return `<div class="obj-card ${hereOb?.id === ob.id ? 'active-obj' : ''}">
        <div class="row gap"><div class="klass k${ob.klass || 0}" ${ob.klass ? '' : 'title="Ej klassad"'}>${ob.klass || '<small>Ej<br>klass</small>'}</div>
        <div class="grow"><b>${esc(ob.name)}</b>${hereOb?.id === ob.id ? ' <span class="badge sig">Du är här</span>' : ''}
          <div class="meta">${esc(ob.biotop || 'Biotop ej angiven')} · ${formatArea(pr.area_m2)} · ${pr.antal_fynd} fynd · ${s.nRl + s.nS + s.nE} naturvårdsarter</div></div></div>
        <div class="row gap obj-actions"><button class="btn grow" data-open="${ob.id}">Objektkort</button><button class="btn primary grow" data-cl="${ob.id}">✓ Arter</button></div></div>`;
    }).join('')}</div>` : ''}`;
  $('#btn-newobj').onclick = () => openObjectEditor(null);
  v.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openObjectEditor(state.objects.find(o => o.id === b.dataset.open)));
  v.querySelectorAll('[data-cl]').forEach(b => b.onclick = () => openChecklist(b.dataset.cl));
}

// Objektprotokoll i tre steg (Avgränsa · Beskriv · Bedöm) med autosparning
const KLASS_CHIPS = { '1 Högsta': 1, '2 Högt': 2, '3 Påtagligt': 3, '4 Visst': 4 };
function openObjectEditor(existing, startTab = null) {
  const ob = existing ? JSON.parse(JSON.stringify(existing))
    : { id: uid('n'), created: Date.now(), name: `Objekt ${state.objects.length + 1}`, polygon: [], structures: [], paverkan: [], photoIds: [] };
  ob.structures ||= []; ob.paverkan ||= []; ob.photoIds ||= [];
  const original = existing ? JSON.parse(JSON.stringify(existing)) : null;
  const addedPhotos = []; let saved = !!existing, lastSaved = null;
  const tab0 = startTab || (!existing ? 'avgr' : (ob.polygon.length < 3 ? 'avgr' : !ob.biotop ? 'beskr' : 'bedom'));
  const s = nvSummary(ob.id);
  const klassChip = Object.keys(KLASS_CHIPS).find(k => KLASS_CHIPS[k] === +ob.klass) || '';
  const office = !!state.settings.office;
  const sheet = openSheet(`<h3 class="sr-only">Naturvärdesobjekt</h3>
    <input id="ob-name" class="input title-input" value="${esc(ob.name)}" aria-label="Objektets namn eller ID">
    <div class="seg tabs3" id="ob-tabs" role="tablist">
      <button role="tab" data-t="avgr">Avgränsa <span class="tabmark" id="tm-avgr"></span></button>
      <button role="tab" data-t="beskr">Beskriv <span class="tabmark" id="tm-beskr"></span></button>
      <button role="tab" data-t="bedom">Bedöm <span class="tabmark" id="tm-bedom"></span></button>
    </div>

    <section data-tab="avgr">
      <div class="row between"><div class="small"><b id="ob-area"></b></div>${info('avgr')}</div>
      <svg class="mini-map" id="ob-map" viewBox="0 0 100 60" role="img" aria-label="Avgränsning"></svg>
      <div class="row gap"><button class="btn primary grow" id="ob-track"></button><button class="btn grow" id="ob-drawmap">✎ Rita på kartan</button></div>
      <p class="muted small">Inspelningen fortsätter i bakgrunden medan du registrerar arter. Skärmen hålls vaken.</p>
      <details class="more"><summary>Hörn för hörn med GPS</summary>
        <div class="row gap wrap"><button class="btn grow" id="ob-add">+ Hörn här</button><button class="btn grow" id="ob-undo">Ångra punkt</button><button class="btn ghost" id="ob-clear">Rensa</button></div>
        <div class="small" id="ob-gps">${gpsLabel(gps.fresh())}</div></details>
    </section>

    <section data-tab="beskr" hidden>
      <label class="field">Biotop<select id="ob-biotop" class="input">${BIOTOPES.map(b => `<option ${ob.biotop === b ? 'selected' : ''}>${b}</option>`).join('')}</select></label>
      <label class="field office">Natura 2000-naturtyp<select id="ob-n2k" class="input">${NATURA2000.map(b => `<option ${ob.natura2000 === b ? 'selected' : ''}>${b}</option>`).join('')}</select></label>
      <div class="field office">Generellt biotopskydd${chipRow('gbs', ['Ja', 'Nej', 'Osäkert'], ob.biotopskydd)}</div>
      <div class="field office">Nyckelbiotop (känd)${chipRow('nbk', ['Ja', 'Nej', 'Okänt'], ob.nyckelbiotop)}</div>
      <div class="field">Strukturer och värdeelement</div>
      ${Object.entries(STRUCTURE_GROUPS).map(([g, items]) => `<details class="grp"><summary>${g} <span class="cnt" data-g="${esc(g)}"></span></summary>
        <div class="chips wrap">${items.map(x => `<button type="button" class="chip ${ob.structures.includes(x) ? 'on' : ''}" aria-pressed="${ob.structures.includes(x)}" data-s="${esc(x)}" data-grp="${esc(g)}">${x}</button>`).join('')}</div></details>`).join('')}
      <details class="grp office"><summary>Påverkan <span class="cnt" data-g="__p"></span></summary>
        <div class="chips wrap">${PAVERKAN.map(x => `<button type="button" class="chip ${ob.paverkan.includes(x) ? 'on' : ''}" aria-pressed="${ob.paverkan.includes(x)}" data-p="${esc(x)}">${x}</button>`).join('')}</div></details>
      <div class="field">Foton på objektet</div>
      <div class="thumbs" id="ob-photos"></div>
      <label class="btn"><input type="file" accept="image/*" capture="environment" id="ob-cam" hidden>📷 Lägg till foto</label>
      <label class="field">Anteckningar/beskrivning<textarea id="ob-desc" class="input" rows="3" placeholder="Tips: tryck på mikrofonen på tangentbordet för att diktera">${esc(ob.description || '')}</textarea></label>
      <label class="field office">Skötselbehov/hot<textarea id="ob-skot" class="input" rows="2">${esc(ob.skotsel || '')}</textarea></label>
      ${existing ? '<button class="linkbtn danger" id="ob-del">Radera objektet …</button>' : ''}
    </section>

    <section data-tab="bedom" hidden>
      <div class="card inset"><div class="small"><b>Underlag:</b> ${nvSummaryText(s)} <span class="muted">(${s.linked.length} fynd)</span></div>
        <button class="btn full" id="ob-checklist">✓ Registrera arter i objektet</button></div>
      <div class="field office">Biotopvärde${chipRow('bv', VARDEN.filter(Boolean), ob.biotopvarde)}</div>
      <label class="field office">Motivering biotopvärde<textarea id="ob-bvm" class="input" rows="2" placeholder="T.ex. rikligt med grova granlågor i olika nedbrytningsstadier">${esc(ob.bvMotiv || '')}</textarea></label>
      <div class="field office">Artvärde <span class="muted small">(bedöm enligt ${esc(state.project.standard)})</span>${chipRow('av', VARDEN.filter(Boolean), ob.artvarde)}</div>
      <label class="field office">Motivering artvärde<textarea id="ob-avm" class="input" rows="2">${esc(ob.avMotiv || '')}</textarea></label>
      <div class="suggest office" id="ob-suggest"></div>
      <div class="field">Naturvärdesklass${office ? '' : ' <span class="muted small">(preliminär)</span>'}${chipRow('klass', Object.keys(KLASS_CHIPS), klassChip)}</div>
      <div class="field office">Osäkerhet i klassningen${chipRow('osak', ['Låg', 'Medel', 'Hög'], ob.osakerhet)}</div>
    </section>

    <div class="row"><button class="linkbtn grow" id="ob-office">${office ? 'Fältläge: dölj rapportfälten' : 'Kontorsläge: visa alla rapportfält (motiveringar, Natura 2000 …)'}</button>${info('objkort')}</div>
    <div class="row gap actions"><span class="small muted grow" id="ob-saved">${existing ? 'Ändringar sparas automatiskt' : 'Sparas automatiskt när du börjar fylla i'}</span>
      <button class="btn" id="ob-revert" hidden>Ångra ändringar</button><button class="btn primary" id="ob-done">Klar</button></div>`);
  const m = sheet.m;
  m.classList.add('obj-sheet');
  if (!office) m.classList.add('field-mode');
  bindChipRows(m);
  // klass 4 kan bara väljas om tillägget ingår
  if (!klass4Included()) { const c4 = m.querySelector('.chip-row[data-row=klass] .chip[data-v="4 Visst"]'); if (c4) { c4.disabled = true; c4.title = 'Tillägget Naturvärdesklass 4 ingår inte i uppdraget'; } }

  const showTab = t => {
    if (!office) { m.querySelectorAll('section[data-tab]').forEach(sec => { sec.hidden = false; }); return; }
    m.querySelectorAll('#ob-tabs button').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    m.querySelectorAll('section[data-tab]').forEach(sec => { sec.hidden = sec.dataset.tab !== t; });
    m.scrollTop = 0;
  };
  m.querySelectorAll('#ob-tabs button').forEach(b => b.onclick = () => showTab(b.dataset.t));
  const marks = () => {
    const set = (id, ok) => { const el = $('#' + id, m); el.textContent = ok ? '✓' : '•'; el.className = 'tabmark ' + (ok ? 'ok' : 'todo'); };
    set('tm-avgr', ob.polygon.length >= 3); set('tm-beskr', !!ob.biotop); set('tm-bedom', !!ob.klass || (ob.biotopvarde && ob.artvarde && MATRIX[ob.artvarde][ob.biotopvarde] == null));
    m.querySelectorAll('.cnt').forEach(c => {
      const n = c.dataset.g === '__p' ? ob.paverkan.length : ob.structures.filter(x => STRUCTURE_GROUPS[c.dataset.g]?.includes(x)).length;
      c.textContent = n ? `(${n} valda)` : '';
    });
  };
  const drawMap = () => {
    const svg = $('#ob-map', m);
    $('#ob-area', m).textContent = ob.polygon.length >= 3 ? `${ob.polygon.length} punkter · ${formatArea(polygonAreaM2(ob.polygon))}` : `${ob.polygon.length} punkter – minst 3 behövs`;
    if (!ob.polygon.length) { svg.innerHTML = '<text x="50" y="32" text-anchor="middle" font-size="5" fill="currentColor" opacity=".6">Ingen avgränsning ännu</text>'; return; }
    const p = ob.polygon.map(q => toSweref99TM(q.lat, q.lon));
    const minE = Math.min(...p.map(q => q.E)), maxE = Math.max(...p.map(q => q.E)), minN = Math.min(...p.map(q => q.N)), maxN = Math.max(...p.map(q => q.N));
    const sc = Math.min(90 / Math.max(maxE - minE, 1), 50 / Math.max(maxN - minN, 1));
    const pts = p.map(q => [5 + (q.E - minE) * sc, 55 - (q.N - minN) * sc]);
    svg.innerHTML = `<polygon points="${pts.map(q => q.join(',')).join(' ')}" fill="var(--accent)" fill-opacity=".2" stroke="var(--accent)" stroke-width=".8"/>`
      + pts.map(q => `<circle cx="${q[0]}" cy="${q[1]}" r="1.4" fill="var(--accent)"/>`).join('');
  };
  const drawPhotos = async () => {
    const photos = (await Promise.all(ob.photoIds.map(id => db.get('photos', id)))).filter(Boolean);
    $('#ob-photos', m).innerHTML = photos.map(p => `<div class="thumb"><img src="${p.thumb}" alt="Foto på objektet"><button class="x" data-pid="${p.id}" aria-label="Ta bort foto">×</button></div>`).join('') || '<span class="muted small">Inga foton.</span>';
    m.querySelectorAll('#ob-photos .x').forEach(b => b.onclick = async () => {
      const pid = b.dataset.pid; const photo = await db.get('photos', pid);
      ob.photoIds = ob.photoIds.filter(x => x !== pid);
      if (state.recording?.obId === ob.id) { const fresh = await db.get('objects', ob.id); if (fresh) ob.polygon = fresh.polygon; }
      await db.atomic([{ store: 'photos', del: true, key: pid }, { store: 'objects', value: ob }]); drawPhotos();
      toast('Fotot borttaget', async () => { ob.photoIds.push(pid); await db.atomic([{ store: 'photos', value: photo }, { store: 'objects', value: ob }]); drawPhotos(); });
    });
  };
  const suggest = () => {
    const bv = ob.biotopvarde, av = ob.artvarde;
    const k = bv && av ? MATRIX[av][bv] : undefined;
    const no4 = k === 4 && !klass4Included();
    const el = $('#ob-suggest', m);
    el.className = 'suggest' + (k ? ' has' : '');
    el.innerHTML = k === undefined ? '<span class="muted">Välj biotop- och artvärde för att få ett förslag på naturvärdesklass.</span>'
      : k === null ? 'Enligt bedömningsmatrisen: <b>inget naturvärdesobjekt</b>.'
        : no4 ? 'Matrisen ger klass 4 – men tillägget <i>Naturvärdesklass 4</i> ingår inte i uppdraget, så det blir <b>inget naturvärdesobjekt</b>.'
          : `<div>Förslag enligt matrisen</div><div class="sug-k">${KLASS_LABEL[k]}</div><button class="btn primary" id="ob-apply">Använd</button><div class="muted small">Kontrollera alltid mot ${esc(state.project.standard)}.</div>`;
    const ap = $('#ob-apply', m);
    if (ap) ap.onclick = () => {
      const key = Object.keys(KLASS_CHIPS).find(x => KLASS_CHIPS[x] === k);
      m.querySelectorAll('.chip-row[data-row=klass] .chip').forEach(c => { const on = c.dataset.v === key; c.classList.toggle('on', on); c.setAttribute('aria-pressed', on); });
      changed();
    };
  };
  // Läs formuläret till objektet och spara (debounce)
  const collect = () => {
    Object.assign(ob, {
      name: $('#ob-name', m).value || ob.name, biotop: $('#ob-biotop', m).value, natura2000: $('#ob-n2k', m).value,
      biotopskydd: chipValue(m, 'gbs'), nyckelbiotop: chipValue(m, 'nbk'),
      biotopvarde: chipValue(m, 'bv'), bvMotiv: $('#ob-bvm', m).value, artvarde: chipValue(m, 'av'), avMotiv: $('#ob-avm', m).value,
      klass: KLASS_CHIPS[chipValue(m, 'klass')] || null, osakerhet: chipValue(m, 'osak'),
      description: $('#ob-desc', m).value, skotsel: $('#ob-skot', m).value,
      inventerare: ob.inventerare || state.project.inventors, updated: Date.now(),
    });
  };
  let timer = null;
  const saveNow = async () => {
    clearTimeout(timer); collect();
    if (state.recording?.obId === ob.id) { const fresh = await db.get('objects', ob.id); if (fresh) ob.polygon = fresh.polygon; }
    const polyChanged = JSON.stringify(state.objects.find(x => x.id === ob.id)?.polygon || []) !== JSON.stringify(ob.polygon);
    await db.put('objects', ob); saved = true; lastSaved = new Date();
    if (polyChanged && ob.polygon.length >= 3) { await reload(); await relinkObservations(); }
    $('#ob-saved', m).textContent = `Sparat ${lastSaved.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`;
    $('#ob-revert', m).hidden = false;
    await reload(); marks();
  };
  const changed = () => { collect(); marks(); suggest(); clearTimeout(timer); timer = setTimeout(saveNow, 500); };
  m.addEventListener('input', changed);
  m.addEventListener('click', e => { if (e.target.closest('.chip-row .chip')) setTimeout(changed, 0); });
  const toggleIn = (arr, x, c) => { const i = arr.indexOf(x); i >= 0 ? arr.splice(i, 1) : arr.push(x); c.classList.toggle('on'); c.setAttribute('aria-pressed', c.classList.contains('on')); changed(); };
  m.querySelectorAll('.chip[data-s]').forEach(c => c.onclick = () => toggleIn(ob.structures, c.dataset.s, c));
  m.querySelectorAll('.chip[data-p]').forEach(c => c.onclick = () => toggleIn(ob.paverkan, c.dataset.p, c));
  $('#ob-cam', m).onchange = async e => {
    collect();
    if (state.recording?.obId === ob.id) { const fresh = await db.get('objects', ob.id); if (fresh) ob.polygon = fresh.polygon; }
    for (const f of e.target.files) { const p = await makePhoto(f); ob.photoIds.push(p.id); addedPhotos.push(p.id);
      await db.atomic([{ store: 'photos', value: { id: p.id, objId: ob.id, obsId: null, blob: p.blob, thumb: p.thumb } }, { store: 'objects', value: ob }]); }
    saved = true; drawPhotos(); saveNow();
  };
  // Avgränsning
  const addPoint = p => { if (!p) return toast('Ingen färsk GPS-position – vänta en stund'); ob.polygon.push({ lat: p.lat, lon: p.lon, acc: p.acc }); drawMap(); buzz(20); changed(); };
  $('#ob-add', m).onclick = () => addPoint(gps.fresh(10000));
  $('#ob-undo', m).onclick = () => { ob.polygon.pop(); drawMap(); changed(); };
  $('#ob-clear', m).onclick = () => { const prev = ob.polygon; ob.polygon = []; drawMap(); changed(); toast('Avgränsningen rensad', () => { ob.polygon = prev; drawMap(); changed(); }); };
  const trackBtn = () => { $('#ob-track', m).textContent = state.recording?.obId === ob.id ? '■ Stoppa inspelningen' : '● Gå gränsen (spela in)'; };
  $('#ob-track', m).onclick = async () => {
    if (state.recording?.obId === ob.id) { stopRecording(); trackBtn(); return; }
    await saveNow(); setActiveObject(ob.id); await startRecording(ob.id);
    closeSheet(sheet); render();
  };
  const onRec = upd => { if (upd.id === ob.id) { ob.polygon = upd.polygon.slice(); drawMap(); marks(); } };
  recListeners.add(onRec);
  const offGps = gps.on(p => { const el = $('#ob-gps', m); if (el) el.innerHTML = gpsLabel(p); });
  sheet.onClose = () => { offGps(); recListeners.delete(onRec); if (timer) { clearTimeout(timer); saveNow(); } render(); };
  $('#ob-checklist', m).onclick = async () => { await saveNow(); setActiveObject(ob.id); closeSheet(sheet); openChecklist(ob.id); };
  $('#ob-done', m).onclick = async () => { if (timer || !saved) { collect(); if (saved || ob.polygon.length || ob.biotop) await saveNow(); } closeSheet(sheet); };
  $('#ob-revert', m).onclick = async () => {
    clearTimeout(timer); timer = null;
    const ops = addedPhotos.map(id => ({ store: 'photos', del: true, key: id }));
    ops.push(original ? { store: 'objects', value: original } : { store: 'objects', del: true, key: ob.id });
    await db.atomic(ops); await reload(); closeSheet(sheet);
    toast(original ? 'Ändringarna ångrade' : 'Objektet togs bort');
  };
  $('#ob-office', m).onclick = async () => {
    state.settings.office = !office; db.setKV('settings', state.settings);
    if (timer || !saved) { collect(); if (saved || ob.polygon.length || ob.biotop) await saveNow(); }
    const keep = state.objects.find(x => x.id === ob.id);
    closeSheet(sheet); setTimeout(() => openObjectEditor(keep || null), 0);
  };
  $('#ob-drawmap', m).onclick = async () => {
    collect(); await saveNow(); closeSheet(sheet);
    state.view = 'map'; if (!tabEntry) { history.pushState({ tab: true }, ''); tabEntry = true; } render(); mapDrawObject(ob.id);
  };
  const del = $('#ob-del', m);
  if (del) del.onclick = async () => {
    if (!confirm('Radera objektet och dess foton? Kopplade fynd behålls.')) return;
    clearTimeout(timer); timer = null;
    const linked = state.observations.filter(o => o.objectId === ob.id);
    await db.atomic([
      ...linked.map(o => ({ store: 'observations', value: { ...o, objectId: null } })),
      ...ob.photoIds.map(id => ({ store: 'photos', del: true, key: id })),
      { store: 'objects', del: true, key: ob.id },
    ]);
    if (state.recording?.obId === ob.id) stopRecording(true);
    if (state.activeObjectId === ob.id) setActiveObject(null);
    await reload(); closeSheet(sheet); toast('Objektet raderat');
  };
  trackBtn(); drawMap(); drawPhotos(); suggest(); marks(); showTab(tab0);
}

// ---------------- Checklista per objekt ----------------
// Snabb registrering på artkännedom: ett tryck = arten finns i objektet (med GPS-position).
// Art-arket: obId = objektet (från objektkortet) eller null (fynd kopplas efter läget)
function openArtSheet(obId) { return openChecklist(obId, { spatial: true }); }
function openChecklist(obId, { spatial = false } = {}) {
  const ob = obId ? state.objects.find(o => o.id === obId) : null;
  if (obId && !ob) return;
  const manual = !!ob && !spatial;
  const dayStart = new Date().setHours(0, 0, 0, 0);
  let grp = 'alla', mode = ob ? 'nv' : 'all', q = '', limit = 60;
  const sheet = openSheet(`<h3>✓ ${ob ? esc(ob.name) : 'Registrera art'}</h3>
    <div class="small muted">Ett tryck = arten registrerad här (okulärt, GPS sparas${ob ? '' : ', objekt efter läget'}). Tryck igen för mängd, substrat och foto.</div>
    <div class="group-grid" id="cl-groups">${GROUPS.map(g => `<button class="chip ${g.id === grp ? 'on' : ''}" data-g="${g.id}">${g.label}</button>`).join('')}</div>
    <div class="seg" id="cl-mode"><button data-m="nv" class="${mode === 'nv' ? 'on' : ''}">Naturvårdsarter</button><button data-m="all" class="${mode === 'all' ? 'on' : ''}">Alla</button><button data-m="reg">${ob ? 'Registrerade' : 'I dag'}</button></div>
    <input type="search" id="cl-q" class="input" placeholder="Sök art (svenskt eller vetenskapligt namn)">
    <div class="small" id="cl-sum"></div>
    <div id="cl-recent"></div>
    <div class="cl-grid" id="cl-list"></div>
    <button class="btn full" id="cl-more" hidden>Visa fler</button>`, { onClose: () => render() });
  const m = sheet.m;
  m.classList.add('full');
  const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const regs = () => {
    const r = new Map();
    for (const o of state.observations) if (ob ? o.objectId === obId : o.time >= dayStart) { if (!r.has(o.speciesId)) r.set(o.speciesId, []); r.get(o.speciesId).push(o); }
    return r;
  };
  const draw = () => {
    const r = regs();
    const t = norm(q.trim());
    // Sökning gäller alla grupper; utan sökord filtreras på vald grupp
    let list = state.species.filter(s => !s.syn && s.rl !== 'RE' && (t || grp === 'alla' || s.grp === grp));
    if (t) list = list.filter(s => norm(s.sv + ' ' + (s.alt || '')).includes(t) || norm(s.sci).includes(t));
    else if (mode === 'nv') list = list.filter(s => (s.sel && isNvArt(s)) || r.has(s.id));
    else if (mode === 'all') list = list.filter(s => s.sel || r.has(s.id));
    if (mode === 'reg') list = list.filter(s => r.has(s.id));
    list.sort((a, b) => (r.has(b.id) - r.has(a.id)) || (a.sv || a.sci).localeCompare(b.sv || b.sci, 'sv'));
    const shown = list.slice(0, limit);
    $('#cl-sum', m).innerHTML = ob ? nvSummaryText(nvSummary(obId)) : `<span class="muted">${hereText()}</span>`;
    // Senast registrerade i uppdraget (andra objekt) – ofta samma arter i nästa objekt
    const rec = !t && mode !== 'reg' ? recentSpecies(10).filter(id => !r.has(id) && (grp === 'alla' || state.species[id].grp === grp)).slice(0, 6) : [];
    $('#cl-recent', m).innerHTML = rec.length ? `<div class="small muted">Senast i uppdraget</div><div class="recent">${rec.map(id => `<button class="chip cl-rec" data-id="${id}">${esc(cap(state.species[id].sv || state.species[id].sci))}</button>`).join('')}</div>` : '';
    m.querySelectorAll('.cl-rec').forEach(b => b.onclick = () => quickRegister(+b.dataset.id));
    $('#cl-more', m).hidden = list.length <= shown.length;
    $('#cl-more', m).textContent = `Visa fler (${list.length - shown.length} till)`;
    $('#cl-list', m).innerHTML = shown.map(s => {
      const os = r.get(s.id) || [];
      const amount = os.map(o => o.amount).filter(Boolean).pop();
      return `<button class="cl-item ${os.length ? 'on' : ''}" data-id="${s.id}">
        <span class="cl-name">${esc(s.sv || s.sci)}</span><i class="sci">${esc(s.sci)}</i>
        <span class="meta">${badges(s)} ${os.length ? `<span class="badge">✓ ${os.length}${amount ? ' · ' + esc(amount) : ''}</span>` : ''}${os.some(o => o.unsure) ? '<span class="badge bad">Osäker</span>' : ''}</span></button>`;
    }).join('') || '<div class="muted center">Inga arter.</div>';
    m.querySelectorAll('.cl-item').forEach(b => b.onclick = () => {
      const id = +b.dataset.id; const os = regs().get(id);
      if (os && os.length) openRegistration(os[os.length - 1], draw); else quickRegister(id);
    });
  };
  const quickRegister = async id => {
    const sp = state.species[id];
    const pos = posForSave();
    const obs = { id: uid('o'), time: Date.now(), speciesId: id, sci: sp.sci, pos, objectId: manual ? obId : (objectAt(pos)?.id || obId || null), manualObject: manual,
      method: 'Okulärt i fält', confirmed: true, unsure: false, amount: '', count: '', unit: '', sub: {}, substrate: '',
      notes: '', ai: [], photoIds: [], source: 'checklista' };
    await db.put('observations', obs);
    buzz(pos ? 30 : [60, 40, 60]);
    if (q) { q = ''; const qi = $('#cl-q', m); qi.value = ''; qi.blur(); }
    await reload(); draw();
    toast(`✓ ${cap(sp.sv || sp.sci)}${pos ? (posQuality(pos) === 'weak' ? ` (osäker position ±${pos.acc} m, ${pos.age} s)` : '') : ' (utan GPS)'}`, async () => { await db.del('observations', obs.id); await reload(); draw(); });
  };
  m.querySelectorAll('#cl-groups .chip').forEach(c => c.onclick = () => { grp = c.dataset.g; m.querySelectorAll('#cl-groups .chip').forEach(x => x.classList.toggle('on', x === c)); draw(); });
  m.querySelectorAll('#cl-mode button').forEach(c => c.onclick = () => { mode = c.dataset.m; m.querySelectorAll('#cl-mode button').forEach(x => x.classList.toggle('on', x === c)); draw(); });
  $('#cl-q', m).oninput = e => { q = e.target.value; limit = 60; draw(); };
  $('#cl-more', m).onclick = () => { limit += 60; draw(); };
  draw();
}

// ---------------- Punkt: fri anteckning med foto ----------------
const POINT_FAV = ['Grov låga', 'Hålträd', 'Jätteträd', 'Torraka', 'Högstubbe', 'Brandstubbe', 'Grov asp', 'Grov sälg', 'Hackspettshål', 'Källa', 'Block', 'Kulturlämning'];
function openNoteSheet(existing) {
  const o = existing || {};
  const photos = [];
  const sheet = openSheet(`<h3>✎ ${existing ? 'Anteckning' : 'Ny punkt'}</h3>
    <div class="small muted">Strukturer, värdeträd, kulturlämningar, hänsyn eller annat du vill hitta igen. Sparas med GPS${existing ? '' : ' och kopplas till objektet du står i'}.</div>
    <div class="chips wrap" id="pt-fav">${POINT_FAV.map(x => `<button type="button" class="chip" data-v="${esc(x)}">${x}</button>`).join('')}</div>
    <label class="field">Anteckning<textarea id="pt-text" class="input" rows="3" placeholder="Tips: tryck på mikrofonen på tangentbordet för att diktera">${esc(o.notes || '')}</textarea></label>
    <div class="thumbs" id="pt-thumbs"></div>
    <label class="btn full"><input type="file" accept="image/*" capture="environment" id="pt-cam" hidden>📷 Foto</label>
    <div class="small" id="pt-gps">${existing ? (o.pos ? gpsLabel(o.pos, true) : 'Ingen position') : gpsLabel(gps.fresh(120000))}</div>
    ${existing ? '<button class="linkbtn danger" id="pt-del">Radera punkten</button>' : ''}
    <div class="row gap actions"><button class="btn grow" id="pt-cancel">Avbryt</button><button class="btn primary grow big" id="pt-save">Spara</button></div>`, { form: true });
  const m = sheet.m;
  const txt = $('#pt-text', m);
  m.querySelectorAll('#pt-fav .chip').forEach(c => c.onclick = () => { txt.value = txt.value ? `${txt.value.replace(/\s+$/, '')}, ${c.dataset.v.toLowerCase()}` : c.dataset.v; sheet.dirty = true; });
  const drawThumbs = () => { $('#pt-thumbs', m).innerHTML = photos.map(p => `<div class="thumb"><img src="${p.thumb}" alt="Foto"></div>`).join(''); };
  $('#pt-cam', m).onchange = async e => { for (const f of e.target.files) photos.push(await makePhoto(f)); sheet.dirty = true; drawThumbs(); };
  const off = existing ? () => {} : gps.on(p => { const el = $('#pt-gps', m); if (el) el.innerHTML = gpsLabel(p); });
  sheet.onClose = off;
  $('#pt-cancel', m).onclick = () => requestClose(sheet);
  const del = $('#pt-del', m);
  if (del) del.onclick = async () => {
    await db.atomic([...(o.photoIds || []).map(pid => ({ store: 'photos', del: true, key: pid })), { store: 'observations', del: true, key: o.id }]);
    markClean(m); closeSheet(sheet); await reload(); render(); toast('Punkten raderad');
  };
  $('#pt-save', m).onclick = async () => {
    if (!txt.value.trim() && !photos.length) return toast('Skriv en anteckning eller ta ett foto');
    const ops = [];
    let obs;
    if (existing) obs = { ...existing, notes: txt.value, photoIds: [...(existing.photoIds || []), ...photos.map(p => p.id)] };
    else {
      const pos = posForSave(); const sid = noteSpecies();
      obs = { id: uid('o'), time: Date.now(), speciesId: sid, sci: state.species[sid].sci, pos, objectId: objectAt(pos)?.id || null,
        notes: txt.value, method: '', confirmed: true, unsure: false, sub: {}, substrate: '', ai: [], photoIds: photos.map(p => p.id), source: 'punkt' };
    }
    for (const ph of photos) ops.push({ store: 'photos', value: { id: ph.id, obsId: obs.id, blob: ph.blob, crop: ph.crop, thumb: ph.thumb } });
    ops.push({ store: 'observations', value: obs });
    await db.atomic(ops);
    markClean(m); closeSheet(sheet); await reload(); render(); buzz(obs.pos ? 30 : [60, 40, 60]);
    toast(existing ? 'Punkten uppdaterad' : `Punkt sparad${obs.pos ? ` · ±${obs.pos.acc} m` : ' · utan GPS!'}`);
  };
}
function newObject() { openObjectEditor(null); }

// Snabbredigering av en registrering ovanpå checklistan
function openRegistration(o, onChange) {
  const sp = state.species[o.speciesId];
  const sub = { ...(o.sub || {}) };
  const { m, close } = subModal(`<h3>${spName(sp)}</h3><div class="meta">${badges(sp)} · registrerad ${new Date(o.time).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}${o.pos ? ` · ±${o.pos.acc} m` : ' · ingen GPS'}</div>
    ${sp.grp === 'fagel' ? `<div class="field">Aktivitet${chipRow('activity', BIRD_ACTIVITY, o.activity)}</div>` : ''}
    <div class="field">Mängd${chipRow('amount', AMOUNT, o.amount)}</div>
    ${Object.entries(SUB).map(([k, d]) => `<div class="field">${d.label}${chipRow('sub-' + k, d.opts, sub[k])}</div>`).join('')}
    <label class="check big-check"><input type="checkbox" id="rg-unsure" ${o.unsure ? 'checked' : ''}> <b>Osäker bestämning</b></label>
    <label class="btn full"><input type="file" accept="image/*" capture="environment" id="rg-photo" hidden>📷 Lägg till belägg (foto)${(o.photoIds || []).length ? ` · ${o.photoIds.length} st` : ''}</label>
    <button class="btn full" id="rg-new">＋ Nytt fynd av arten här (ny plats)</button>
    <button class="linkbtn danger" id="rg-del">Ta bort registreringen</button>
    <div class="row gap actions"><button class="btn grow" id="rg-cancel">Avbryt</button><button class="btn primary grow" id="rg-save">Spara</button></div>`, { form: true });
  bindChipRows(m);
  $('#rg-cancel', m).onclick = () => requestClose(m._sheet);
  $('#rg-photo', m).onchange = async e => { await addEvidencePhotos(o, [...e.target.files]); markClean(m); close(); await reload(); onChange(); };
  $('#rg-save', m).onclick = async () => {
    const s = {}; for (const k of Object.keys(SUB)) { const v = chipValue(m, 'sub-' + k); if (v) s[k] = v; }
    if (Object.keys(s).length) { state.lastSub = s; db.setKV('lastSub', s); }
    await db.put('observations', { ...o, amount: chipValue(m, 'amount'), activity: chipValue(m, 'activity'), sub: s, substrate: substrateText(s), unsure: $('#rg-unsure', m).checked });
    markClean(m); close(); await reload(); onChange(); buzz(20);
  };
  $('#rg-del', m).onclick = async () => {
    const photos = (await Promise.all((o.photoIds || []).map(pid => db.get('photos', pid)))).filter(Boolean);
    await db.atomic([...(o.photoIds || []).map(pid => ({ store: 'photos', del: true, key: pid })), { store: 'observations', del: true, key: o.id }]);
    markClean(m); close(); await reload(); onChange();
    toast('Registreringen borttagen', async () => { await db.atomic([...photos.map(p => ({ store: 'photos', value: p })), { store: 'observations', value: o }]); await reload(); onChange(); });
  };
  $('#rg-new', m).onclick = async () => {
    const pos = posForSave();
    const n = { ...o, id: uid('o'), time: Date.now(), pos, amount: '', photoIds: [], objectId: o.manualObject ? o.objectId : (objectAt(pos)?.id || null) };
    await db.put('observations', n);
    markClean(m); close(); await reload(); onChange(); buzz(30);
    toast('Nytt fynd registrerat', async () => { await db.del('observations', n.id); await reload(); onChange(); });
  };
}

// ---------------- Karta (Leaflet) ----------------
const GROUP_COLOR = { trad: '#2e7d32', karlvaxt: '#7cb342', mossa: '#33691e', lav: '#c0ca33', svamp: '#8d6e63', fagel: '#1565c0', insekt: '#f9a825', punkt: '#546e7a' };
let mapApi = null, mapFitted = false, sksVectors = null;
const mapSet = () => ({ base: 'osm', overlays: [], lmKey: '', customTiles: '', showTrack: false, ...(state.settings.map || {}) });
function saveMapSet(ms) { state.settings.map = ms; db.setKV('settings', state.settings); }
async function loadVectors() { if (!sksVectors) sksVectors = await db.getKV('sksVectors') || {}; return sksVectors; }
// Online visas Skogsstyrelsens lager som kartbild (hela landet); offline används nedladdade lager.
async function applyMapSettings() {
  if (!mapApi) return;
  const ms = mapSet();
  if (!mapApi.setBase(ms.base, ms)) mapApi.setBase('osm', ms);
  mapApi.setOverlays(ms.overlays, navigator.onLine ? {} : await loadVectors());
  mapApi.showTrack(ms.showTrack);
  mapNote();
}
function mapNote() {
  const el = $('#mp-note'); if (!el) return;
  const ms = mapSet();
  let t = '';
  if (ms.base === 'osm' && !navigator.onLine) t = 'Offline: OpenStreetMap kräver nät. Fynd och objekt visas ändå. För karta offline – välj Lantmäteriet under ▤ och ladda ner området.';
  else if (ms.base === 'lmtopo' && !ms.lmKey) t = 'Ange din API-nyckel från Lantmäteriet under ▤.';
  else if (!navigator.onLine && ms.overlays.length && !Object.keys(sksVectors || {}).length) t = 'Offline: Skogsstyrelsens lager visas bara för nedladdade områden.';
  el.textContent = t; el.hidden = !t;
}
function drawMapData() {
  if (!mapApi) return;
  const here = objectAt(gps.fresh(30000));
  mapApi.drawData({ observations: state.observations, objects: state.objects, species: state.species,
    colorOf: sp => GROUP_COLOR[sp.grp] || '#777', track: state.track, activeObjectId: here?.id });
  mapApi.setMe(gps.fresh(120000));
}
async function renderMapView() {
  const v = $('#view-map');
  if (!window.L) { v.innerHTML = '<div class="card">Kartmodulen kunde inte laddas. Starta om appen.</div>'; return; }
  if (!mapApi) {
    v.innerHTML = `<div class="map-wrap">
      <div id="map-el" class="map-el" role="application" aria-label="Karta med fynd och objekt"></div>
      <div class="map-tools">
        <button class="mapbtn" id="mp-layers" aria-label="Kartlager och nedladdning">▤</button>
        <button class="mapbtn" id="mp-me" aria-label="Centrera på min position">⌖</button>
        <button class="mapbtn" id="mp-fit" aria-label="Visa alla fynd och objekt">⤢</button>
        <button class="mapbtn mapinfo info-btn" data-info="karta" aria-label="Förklaring: kartan">i</button>
      </div>
      <div class="map-note" id="mp-note" role="status" hidden></div>
      <div class="draw-bar" id="mp-draw" hidden></div>
    </div>`;
    mapApi = createMap($('#map-el'), {
      onObsClick: id => openObsDetail(id),
      onObjectClick: id => openObjectEditor(state.objects.find(o => o.id === id)),
    });
    $('#mp-me').onclick = () => { const p = gps.fresh(120000); if (p) mapApi.center(p, 17); else toast('Ingen GPS-position ännu'); };
    $('#mp-fit').onclick = () => mapApi.fit(state.objects, state.observations, gps.fresh(120000));
    $('#mp-layers').onclick = openLayerSheet;
    let last = 0;
    gps.on(p => { if (mapApi && state.view === 'map' && Date.now() - last > 2000) { last = Date.now(); mapApi.setMe(p); } });
    await loadVectors();
    await applyMapSettings();
  }
  mapApi.invalidate();
  drawMapData();
  mapNote();
  if (!mapFitted) { mapFitted = true; setTimeout(() => mapApi.fit(state.objects, state.observations, gps.fresh(120000)), 80); }
}
function openLayerSheet() {
  const ms = mapSet();
  const sh = openSheet(`<div class="row between"><h3>Kartlager</h3>${info('lager')}</div>
    <div class="field">Bakgrund
      ${Object.entries(BASES).map(([k, d]) => `<label class="check"><input type="radio" name="ly-base" value="${k}" ${ms.base === k ? 'checked' : ''}> ${d.name}</label>`).join('')}</div>
    <label class="field" id="ly-key-row">API-nyckel för Lantmäteriets topografiska webbkarta
      <input id="ly-key" class="input" value="${esc(ms.lmKey)}" autocomplete="off" spellcheck="false" placeholder="Klistra in nyckeln">
      <span class="small muted">Gratis konto på Lantmäteriets geotorget (öppna data, CC BY). Nyckeln sparas bara på telefonen.</span></label>
    <label class="field" id="ly-custom-row">Egen plattadress
      <input id="ly-custom" class="input" value="${esc(ms.customTiles)}" placeholder="https://…/{z}/{x}/{y}.png" spellcheck="false"></label>
    <div class="field">Skogsstyrelsens lager <span class="muted small">(öppna data)</span>
      ${SKS_LAYERS.map(d => `<label class="check"><input type="checkbox" class="ly-ov" value="${d.id}" ${ms.overlays.includes(d.id) ? 'checked' : ''}> <span class="swatch" style="background:${d.color}"></span>${d.name}</label>`).join('')}</div>
    <label class="check"><input type="checkbox" id="ly-track" ${ms.showTrack ? 'checked' : ''}> Visa mitt spår (senaste dygnet)</label>
    <div class="card inset"><b>Offline</b>
      <p class="small">Laddar ner det område som syns på kartan just nu: valda lager från Skogsstyrelsen och – om du valt Lantmäteriet eller egen adress – bakgrundskartan. OpenStreetMap tillåter inte nedladdning för offlinebruk.</p>
      <button class="btn primary full" id="ly-dl">⬇ Ladda ner området som syns</button>
      <div class="progress" id="ly-prog" hidden><span></span></div><div class="small" id="ly-status"></div>
      <button class="linkbtn" id="ly-clear">Rensa nedladdade kartor</button></div>`);
  const m = sh.m;
  const rows = () => { const b = m.querySelector('input[name=ly-base]:checked').value; $('#ly-key-row', m).hidden = b !== 'lmtopo'; $('#ly-custom-row', m).hidden = b !== 'custom'; };
  const save = () => {
    const n = { ...mapSet(), base: m.querySelector('input[name=ly-base]:checked').value, lmKey: $('#ly-key', m).value.trim(), customTiles: $('#ly-custom', m).value.trim(),
      overlays: [...m.querySelectorAll('.ly-ov:checked')].map(c => c.value), showTrack: $('#ly-track', m).checked };
    saveMapSet(n); rows(); applyMapSettings();
  };
  m.addEventListener('change', save);
  rows();
  $('#ly-dl', m).onclick = () => downloadMapArea(m);
  $('#ly-clear', m).onclick = async () => {
    await caches.delete('skog-tiles-v1'); sksVectors = {}; await db.setKV('sksVectors', {});
    $('#ly-status', m).textContent = 'Nedladdade kartor borttagna.'; applyMapSettings();
  };
}
async function downloadMapArea(m) {
  if (!mapApi) { $('#ly-status', m).textContent = 'Öppna kartan och zooma till området först.'; return; }
  if (!navigator.onLine) { $('#ly-status', m).textContent = 'Kräver nät.'; return; }
  const ms = mapSet();
  const bb = mapApi.map.getBounds();
  const bounds = [[bb.getSouth(), bb.getWest()], [bb.getNorth(), bb.getEast()]];
  const widthKm = distanceM({ lat: bb.getSouth(), lon: bb.getWest() }, { lat: bb.getSouth(), lon: bb.getEast() }) / 1000;
  const heightKm = distanceM({ lat: bb.getSouth(), lon: bb.getWest() }, { lat: bb.getNorth(), lon: bb.getWest() }) / 1000;
  const st = $('#ly-status', m), prog = $('#ly-prog', m), bar = prog.querySelector('span');
  if (widthKm * heightKm > 400) { st.textContent = `Området är ${Math.round(widthKm)} × ${Math.round(heightKm)} km. Zooma in till högst ca 20 × 20 km.`; return; }
  const btn = $('#ly-dl', m); btn.disabled = true; prog.hidden = false;
  try {
    if (ms.overlays.length) {
      st.textContent = 'Hämtar Skogsstyrelsens lager …';
      const got = await downloadSksLayers(bounds, ms.overlays, (f, name, n) => { bar.style.width = `${Math.round(f * 30)}%`; st.textContent = `${name}: ${n} objekt`; });
      const cur = await loadVectors();
      for (const [id, fc] of Object.entries(got)) {
        const old = cur[id]?.features || [];
        const key = f => f.id ?? JSON.stringify(f.geometry).slice(0, 200);
        const seen = new Set(fc.features.map(key));
        cur[id] = { type: 'FeatureCollection', features: [...fc.features, ...old.filter(f => !seen.has(key(f)))], fetched: Date.now() };
      }
      sksVectors = cur; await db.setKV('sksVectors', cur);
    }
    const def = BASES[ms.base]; const tpl = def && def.offline && def.url(ms);
    if (tpl) {
      const z0 = Math.max(6, Math.min(mapApi.map.getZoom(), 12) - 4), z1 = Math.min(def.maxZoom, 16);
      const n = countTiles(bounds, z0, z1);
      if (n > 12000) { st.textContent = `Bakgrundskartan blir ${n} plattor – zooma in mer.`; }
      else {
        const res = await downloadTiles(tpl, bounds, z0, z1, (f, bytes) => { bar.style.width = `${30 + Math.round(f * 70)}%`; st.textContent = `Bakgrundskarta: ${Math.round(f * 100)} % · ${(bytes / 1e6).toFixed(1)} MB`; });
        st.textContent = `Klart: ${res.total - res.failed} plattor (${(res.bytes / 1e6).toFixed(1)} MB)${res.failed ? `, ${res.failed} misslyckades – kontrollera nyckeln` : ''}.`;
      }
    } else st.textContent = ms.overlays.length ? 'Klart. Lagren finns nu offline för området. (Bakgrunden OpenStreetMap kan inte laddas ner.)' : 'Välj Lantmäteriet eller minst ett lager för att ladda ner.';
    bar.style.width = '100%';
  } catch (e) { st.textContent = 'Nedladdningen misslyckades: ' + e.message; }
  btn.disabled = false;
}
// Rita/justera ett objekts avgränsning direkt på kartan
function mapDrawObject(obId) {
  const ob = state.objects.find(o => o.id === obId);
  if (!ob || !mapApi) return;
  const bar = $('#mp-draw');
  const upd = pts => { bar.querySelector('.dr-info').textContent = pts.length >= 3 ? `${pts.length} hörn · ${formatArea(polygonAreaM2(pts))}` : `${pts.length} hörn – tryck på kartan`; };
  bar.innerHTML = `<div class="dr-info"></div><div class="row gap"><button class="btn" id="dr-undo">Ångra</button><button class="btn" id="dr-cancel">Avbryt</button><button class="btn primary" id="dr-save">Spara</button></div>`;
  bar.hidden = false;
  const d = mapApi.startDraw(ob.polygon || [], upd);
  if (!ob.polygon?.length) { const p = gps.fresh(120000); if (p) mapApi.center(p, 17); }
  const end = () => { mapApi.stopDraw(); bar.hidden = true; drawMapData(); };
  $('#dr-undo').onclick = () => d.undo();
  $('#dr-cancel').onclick = end;
  $('#dr-save').onclick = async () => {
    const pts = d.pts.slice();
    if (pts.length && pts.length < 3) return toast('Minst 3 hörn behövs');
    const fresh = await db.get('objects', ob.id) || ob;
    await db.put('objects', { ...fresh, polygon: pts.map(p => ({ lat: p.lat, lon: p.lon, acc: null, drawn: true })), updated: Date.now() });
    end(); await reload(); const n = await relinkObservations(); drawMapData();
    toast(`Avgränsningen sparad${pts.length ? ' · ' + formatArea(polygonAreaM2(pts)) : ''}${n ? ` · ${n} fynd omkopplade` : ''}`);
  };
}

// ---------------- Lista: fynd och objekt ----------------
let listTab = 'fynd';
function renderListView() {
  const v = $('#view-list');
  const nPts = state.observations.length;
  v.innerHTML = `<div class="seg list-seg" role="tablist">
      <button role="tab" data-l="fynd" class="${listTab === 'fynd' ? 'on' : ''}" aria-selected="${listTab === 'fynd'}">Fynd (${nPts})</button>
      <button role="tab" data-l="obj" class="${listTab === 'obj' ? 'on' : ''}" aria-selected="${listTab === 'obj'}">Objekt (${state.objects.length})</button></div>
    <div id="view-obs" ${listTab === 'fynd' ? '' : 'hidden'}></div><div id="view-objects" ${listTab === 'obj' ? '' : 'hidden'}></div>`;
  v.querySelectorAll('.list-seg button').forEach(b => b.onclick = () => { listTab = b.dataset.l; renderListView(); });
  if (listTab === 'fynd') renderObsView(); else renderObjectsView();
}

// ---------------- Mer: offline, export, inställningar ----------------
async function renderMoreView() {
  const v = $('#view-more');
  const est = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
  const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : false;
  const photos = await db.all('photos');
  const pr = state.project;
  const ms = mapSet();
  const backupOld = !state.lastBackup || Date.now() - state.lastBackup > 86400000;
  v.innerHTML = `
    <div class="card ${backupOld && state.observations.length ? 'warn-card' : ''}"><div class="row between"><h3>💾 Säkerhetskopia</h3>${info('backup')}</div>
      <p class="small" id="backup-age"></p>
      <button class="btn primary full big" id="ex-zip">💾 Spara säkerhetskopia</button>
      <p class="muted small">Fynden finns bara på telefonen. Spara en kopia varje kväll (t.ex. till Filer, Drive eller mejl till dig själv). Kopian innehåller exakta lägen – skicka den inte till beställaren.</p>
      <label class="btn full ghost"><input type="file" accept=".zip" id="im-zip" hidden>Återställ från säkerhetskopia …</label>
    </div>
    <div class="card"><div class="row between"><h3>📦 Leverans</h3>${info('leverans')}</div>
      <button class="btn primary full big" id="ex-delivery">📦 Leverans till beställare (ZIP${state.settings.protect !== false ? ', skyddad' : ''})</button>
      <p class="small muted">GeoJSON, fynd- och objektprotokoll (CSV), rapportunderlag och foton. ${state.observations.filter(o => protectionKm(o, state.species[o.speciesId])).length} skyddsklassade fynd redovisas generaliserat.</p>
      <details class="more-files"><summary>Enskilda filer och inställningar</summary><div class="col gap">
      <label class="check"><input type="checkbox" id="set-prot" ${state.settings.protect !== false ? 'checked' : ''}> <span><b>Skydda skyddsklassade arter</b> (rekommenderas). Enligt SLU Artdatabankens lista: position som 5/25/50 km-ruta, datum som år, kommentar/substrat/objekt döljs, arterna namnges inte per objekt.</span></label>
        <button class="btn full" id="ex-geo">GeoJSON (QGIS, ArcGIS, kartappar)</button>
        <button class="btn full" id="ex-csv">Fynd (CSV för Excel), med SWEREF 99 TM</button>
        <button class="btn full" id="ex-obj">Objektprotokoll (CSV)</button>
        <button class="btn full" id="ex-rep">Rapportunderlag (HTML – skriv ut/spara som PDF)</button>
        <button class="btn full internal-btn" id="ex-app">🔒 Konfidentiell bilaga: skyddsklassade fynd (exakta lägen)</button>
      </div></details>
    </div>
    <div class="card"><div class="row between"><h3>Uppdrag</h3><button class="btn small" id="btn-project">Ändra</button></div>
      ${pr.name || pr.client ? `<div><b>${esc(pr.name || 'Namnlöst uppdrag')}</b>${pr.client ? ` · ${esc(pr.client)}` : ''}</div>` : '<div class="muted small">Inget uppdrag angivet.</div>'}
      <div class="meta">${esc(pr.standard)} · ${esc(pr.level)}${pr.addons.length ? ' · Tillägg: ' + pr.addons.map(esc).join(', ') : ' · inga tillägg'}${pr.inventors ? ' · ' + esc(pr.inventors) : ''}</div>
      <label class="check"><input type="checkbox" id="set-office" ${state.settings.office ? 'checked' : ''}> <span class="grow"><b>Kontorsläge</b> – visa alla rapportfält i objektkortet (motiveringar, Natura 2000, biotopskydd, skötsel). Av = fältläge med bara det som behövs ute.</span>${info('kontor')}</label>
    </div>
    <div class="card"><h3>🗺️ Karta</h3>
      <p class="small">Bakgrund: <b>${esc(BASES[ms.base]?.name || '')}</b>${ms.overlays.length ? ` · ${ms.overlays.length} lager från Skogsstyrelsen` : ''}</p>
      <button class="btn full" id="btn-maplayers">Kartlager, Lantmäteriet-nyckel och nedladdning</button>
      <p class="muted small">OpenStreetMap fungerar direkt men kräver nät. För karta offline: skaffa en gratis nyckel hos Lantmäteriet, välj terrängkartan och ladda ner området innan du åker ut.</p>
    </div>
    <div class="card"><div class="row between"><h3>🤖 AI-artbestämning <span class="muted small">(valfri)</span></h3>${info('ai')}</div>
      <p class="small">${state.modelReady ? '✅ Nedladdad – fungerar offline.' : 'Inte nedladdad. Utan AI kan du ändå registrera arter, spara foton som obestämda och bestämma dem senare.'}</p>
      ${state.modelReady ? '' : '<button class="btn full" id="btn-dl">Ladda ner AI (≈105 MB, wifi rekommenderas)</button><div class="progress" hidden id="dl-prog"><span></span></div>'}
      <label class="check"><input type="checkbox" id="set-acc" ${state.settings.accurate ? 'checked' : ''}> Noggrann analys (tre vyer per bild, ≈3× långsammare)</label>
    </div>
    <div class="card"><h3>Inställningar</h3>
      <label class="check"><input type="checkbox" id="set-vib" ${state.settings.vibrate !== false ? 'checked' : ''}> Vibrera vid registrering och sparning</label>
      <label class="field">Tema<select id="set-theme" class="input">${[['auto', 'Följ telefonen'], ['light', 'Ljust (bäst i solljus)'], ['dark', 'Mörkt']].map(([k, l]) => `<option value="${k}" ${state.settings.theme === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <p class="muted small">Lagring: ${est ? `${(est.usage / 1e6).toFixed(0)} MB använt` : 'okänt'} · ${persisted ? 'skyddad mot automatisk rensning' : 'ej skyddad (webbläsaren kan rensa vid lågt lagringsutrymme)'} · ${photos.length} foton</p>
      <p class="small">GPS: ${gpsLabel(gps.fresh())}</p>
    </div>
    <div class="card small"><h3>Om appen</h3>
      <p><b>Artigenkänning:</b> BioCLIP (Imageomics, MIT-licens), tränad på TreeOfLife-10M. Modellen körs lokalt på telefonen. Procenten är modellens sannolikhetsfördelning över arterna i vald lista – inte en garanti. Mossor, lavar och skorplavar kräver ofta lupp eller mikroskop.</p>
      <p><b>Artdata:</b> Rödlistan 2025 och Dyntaxa (SLU Artdatabanken, CC0) via GBIF. Signalarter (S) och ekologiska ståndortsindikatorer (E) enligt Skogsstyrelsens fullständiga förteckning, version 2023-1, importerad maskinellt.</p>
      <p><b>Arter i databasen:</b> ${state.species.filter(s => !s.syn).length} (${state.species.filter(s => s.sel).length} i skogsurvalet).</p>
      <p class="muted">Version ${document.documentElement.dataset.version}</p>
    </div>`;
  const dl = $('#btn-dl');
  if (dl) { dl.onclick = () => startModelDownload(dl, $('#dl-prog')); if (state.download) startModelDownload(dl, $('#dl-prog')); }
  const saveSettings = () => db.setKV('settings', state.settings);
  $('#set-prot').onchange = e => { state.settings.protect = e.target.checked; saveSettings(); if (!e.target.checked) toast('OBS: exporterna innehåller nu exakta lägen för skyddsklassade arter'); };
  $('#set-office').onchange = e => { state.settings.office = e.target.checked; saveSettings(); };
  $('#btn-project').onclick = openProjectEditor;
  $('#btn-maplayers').onclick = openLayerSheet;
  $('#set-acc').onchange = e => { state.settings.accurate = e.target.checked; saveSettings(); };
  $('#set-vib').onchange = e => { state.settings.vibrate = e.target.checked; saveSettings(); };
  $('#set-theme').onchange = e => { state.settings.theme = e.target.value; applyTheme(); saveSettings(); };
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '');
  const opts = () => ({ protect: state.settings.protect !== false });
  $('#ex-geo').onclick = () => shareOrDownload(new Blob([toGeoJSON(state.observations, state.objects, state.species, opts())], { type: 'application/geo+json' }), `inventering_${stamp}.geojson`);
  $('#ex-csv').onclick = () => shareOrDownload(new Blob([toCSV(state.observations, state.objects, state.species, opts())], { type: 'text/csv' }), `fynd_${stamp}.csv`);
  $('#ex-obj').onclick = () => shareOrDownload(new Blob([objectsCSV(state.objects, state.observations, state.species, opts())], { type: 'text/csv' }), `objekt_${stamp}.csv`);
  $('#ex-rep').onclick = () => shareOrDownload(new Blob([reportHTML(state.project, state.objects, state.observations, state.species, opts())], { type: 'text/html' }), `rapportunderlag_${stamp}.html`);
  $('#ex-app').onclick = () => shareOrDownload(new Blob([protectedAppendixHTML(state.project, state.objects, state.observations, state.species)], { type: 'text/html' }), `KONFIDENTIELL_skyddsklassade_${stamp}.html`);
  const safe = t => (t || 'okand').replace(/[^\p{L}\p{N}_-]+/gu, '_');
  // Leverans: allt som beställaren behöver, med skydd enligt inställningen. Foton på skyddade fynd utelämnas.
  $('#ex-delivery').onclick = async () => {
    const o = opts();
    const photos = await db.all('photos');
    const files = [
      { name: 'inventering.geojson', data: toGeoJSON(state.observations, state.objects, state.species, o) },
      { name: 'fynd.csv', data: toCSV(state.observations, state.objects, state.species, o) },
      { name: 'objekt.csv', data: objectsCSV(state.objects, state.observations, state.species, o) },
      { name: 'rapportunderlag.html', data: reportHTML(state.project, state.objects, state.observations, state.species, o) }];
    for (const p of photos) {
      if (p.objId) { files.push({ name: `foton/objekt/${safe(state.objects.find(x => x.id === p.objId)?.name)}/${p.id}.jpg`, data: p.blob }); continue; }
      const ob = state.observations.find(x => x.id === p.obsId);
      if (!ob || (o.protect && protectionKm(ob, state.species[ob.speciesId]))) continue;
      files.push({ name: `foton/fynd/${safe(state.species[ob.speciesId]?.sci)}/${p.id}.jpg`, data: p.blob });
    }
    shareOrDownload(await makeZip(files), `leverans_${safe(state.project.name || 'inventering')}_${stamp}.zip`);
  };
  // Säkerhetskopia: bara det som behövs för återställning (inga färdiga GIS-/Excel-filer som kan skickas vidare av misstag)
  $('#ex-zip').onclick = async () => {
    const photos = await db.all('photos');
    const meta = { app: 'skogsinventering', version: 2, exported: new Date().toISOString(), project: state.project, observations: state.observations, objects: state.objects,
      species_ref: state.observations.map(o => ({ obs: o.id, sci: state.species[o.speciesId]?.sci })) };
    const files = [{ name: 'INTERNT_innehaller_exakta_lagen.txt', data: 'Säkerhetskopia från Skogsinventering. Innehåller exakta lägen för skyddsklassade arter. Sprid inte.\n' },
      { name: 'data.json', data: JSON.stringify(meta) }];
    for (const p of photos) {
      if (p.objId) { files.push({ name: `foton/objekt/${safe(state.objects.find(x => x.id === p.objId)?.name)}/${p.id}.jpg`, data: p.blob }); continue; }
      const ob = state.observations.find(x => x.id === p.obsId);
      files.push({ name: `foton/${safe(ob && state.species[ob.speciesId]?.sci)}/${p.id}.jpg`, data: p.blob });
    }
    await shareOrDownload(await makeZip(files), `sakerhetskopia_INTERN_${stamp}.zip`);
    await db.setKV('lastBackup', Date.now()); state.lastBackup = Date.now(); updateBackupAge(); updateBackupPill();
  };
  updateBackupAge();
  $('#im-zip').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const files = await readZip(f);
      const meta = JSON.parse(new TextDecoder().decode(files['data.json']));
      const bySci = Object.fromEntries(state.species.map(s => [s.sci, s.id]));
      const refs = Object.fromEntries((meta.species_ref || []).map(r => [r.obs, r.sci]));
      if (meta.project) { state.project = { ...state.project, ...meta.project }; await db.setKV('project', state.project); }
      for (const ob of meta.objects) await db.put('objects', ob);
      for (const o of meta.observations) {
        if (refs[o.id] && bySci[refs[o.id]] !== undefined) o.speciesId = bySci[refs[o.id]];
        await db.put('observations', o);
      }
      for (const [name, data] of Object.entries(files)) {
        const mm = name.match(/^foton\/(?:objekt\/)?([^/]+)\/(.+)\.jpg$/); if (!mm) continue;
        const o = meta.observations.find(x => (x.photoIds || []).includes(mm[2]));
        const ob = meta.objects.find(x => (x.photoIds || []).includes(mm[2]));
        if (!o && !ob) continue;
        const blob = new Blob([data], { type: 'image/jpeg' });
        await db.put('photos', { id: mm[2], obsId: o ? o.id : null, objId: ob && !o ? ob.id : undefined, blob, thumb: await thumbFromBlob(blob) });
      }
      await reload(); render(); toast(`Återställde ${meta.observations.length} fynd och ${meta.objects.length} objekt`);
    } catch (err) { toast('Kunde inte läsa filen: ' + err.message); }
  };
}
function backupAgeText() {
  if (!state.lastBackup) return 'Ingen säkerhetskopia gjord ännu.';
  const h = (Date.now() - state.lastBackup) / 3600000;
  return `Senaste säkerhetskopia: ${h < 1 ? 'nyss' : h < 24 ? Math.round(h) + ' h sedan' : Math.round(h / 24) + ' dygn sedan'}`;
}
function updateBackupAge() {
  const el = $('#backup-age'); if (el) el.innerHTML = (state.lastBackup && Date.now() - state.lastBackup < 86400000 ? '' : '⚠️ ') + backupAgeText();
}
async function thumbFromBlob(blob) {
  const bmp = await createImageBitmap(blob);
  const c = document.createElement('canvas'); const s = 160 / Math.max(bmp.width, bmp.height);
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.7);
}

// ---------------- Ramverk ----------------
function applyTheme() {
  const t = state.settings.theme;
  if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
}
async function reload() {
  state.observations = await db.all('observations');
  state.objects = await db.all('objects');
  if (state.activeObjectId && !state.objects.some(o => o.id === state.activeObjectId)) state.activeObjectId = null;
  // Artdatabasen kan ha uppdaterats sedan fyndet sparades: koppla om via vetenskapligt namn.
  const bySci = new Map(state.species.map(s => [s.sci, s.id]));
  for (const o of state.observations) {
    if (o.sci && state.species[o.speciesId]?.sci !== o.sci && bySci.has(o.sci)) {
      o.speciesId = bySci.get(o.sci);
      for (const a of o.ai || []) if (a.sci && bySci.has(a.sci)) a.id = bySci.get(a.sci);
      await db.put('observations', o);
    }
  }
}
function render() {
  document.querySelectorAll('.view').forEach(v => { v.hidden = v.id !== `view-${state.view}`; });
  document.querySelectorAll('nav.tabs button').forEach(b => { const on = b.dataset.view === state.view; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'page' : 'false'); });
  renderActiveBar();
  document.body.classList.toggle('on-map', state.view === 'map');
  ({ id: renderIdView, map: renderMapView, list: renderListView, more: renderMoreView })[state.view]();
}
function updateGpsPill(p) {
  const el = $('#gps-pill');
  if (!el) return;
  el.className = 'pill ' + (!p ? 'bad' : p.acc <= 10 ? 'ok' : p.acc <= 30 ? '' : 'bad');
  el.textContent = p ? `GPS ±${p.acc} m` : 'GPS …';
}
setInterval(() => { // visa när positionen blir gammal (t.ex. under tät granskärm)
  const p = gps.last, el = $('#gps-pill'); if (!el || !p) return;
  const age = Math.round((Date.now() - p.t) / 1000);
  if (age > 10) { el.textContent = `GPS ±${p.acc} m · ${age} s`; el.className = 'pill ' + (age > 30 ? 'bad' : ''); }
}, 3000);
function updateNetPill() { // appen fungerar offline – visa bara en diskret ikon när nätet saknas
  const el = $('#net-pill');
  el.textContent = navigator.onLine ? '' : '✈︎';
  el.hidden = navigator.onLine;
  el.setAttribute('aria-label', navigator.onLine ? 'Online' : 'Offline – appen fungerar ändå');
  el.className = 'pill net';
}
function updateBackupPill() {
  const el = $('#backup-pill'); if (!el) return;
  const has = state.observations.length > 0;
  const h = state.lastBackup ? (Date.now() - state.lastBackup) / 3600000 : Infinity;
  el.hidden = !has;
  el.textContent = '💾 ' + (h === Infinity ? '–' : h < 24 ? 'idag' : Math.floor(h / 24) + ' d');
  el.className = 'pill ' + (h > 24 ? 'warnpill' : '');
  el.title = backupAgeText();
}

// Spårlogg: var du har gått det senaste dygnet (för att se täckningen på kartan)
let trackSaved = 0;
function logTrack(p) {
  if (!p || p.acc > 30) return;
  const t = state.track || (state.track = []);
  const last = t[t.length - 1];
  if (last && distanceM(last, p) < 10) return;
  t.push({ lat: +p.lat.toFixed(6), lon: +p.lon.toFixed(6), t: Date.now() });
  while (t.length > 6000 || (t.length && Date.now() - t[0].t > 86400000)) t.shift();
  if (Date.now() - trackSaved > 30000) { trackSaved = Date.now(); db.setKV('track', t); if (state.view === 'map') drawMapData(); }
}

// Kartans yta mäts från verklig rubrik- och menyhöjd (robust mot iOS-avvikelser i 100vh/dvh)
function measureChrome() {
  const h = document.querySelector('header.top'), n = document.querySelector('nav.tabs');
  if (h) document.documentElement.style.setProperty('--header-h', h.getBoundingClientRect().bottom + 'px');
  if (n) document.documentElement.style.setProperty('--nav-h', (window.innerHeight - n.getBoundingClientRect().top) + 'px');
  if (mapApi) mapApi.invalidate();
}
window.addEventListener('resize', measureChrome); window.addEventListener('orientationchange', () => setTimeout(measureChrome, 300));

async function main() {
  state.settings = { ...state.settings, ...(await db.getKV('settings') || {}) };
  delete state.settings.generalize; // ersatt av skydd enligt Artdatabankens skyddsklassning
  state.project = { ...state.project, ...(await db.getKV('project') || {}) };
  state.activeObjectId = await db.getKV('activeObject') || null;
  state.lastSub = await db.getKV('lastSub') || {};
  state.lastBackup = await db.getKV('lastBackup') || null;
  state.track = (await db.getKV('track') || []).filter(p => Date.now() - p.t < 86400000);
  if (state.settings.group) state.group = state.settings.group;
  applyTheme();
  state.species = await fetch(SPECIES_URL).then(r => r.json());
  await reload();
  state.modelReady = await modelCached();
  document.querySelectorAll('nav.tabs button').forEach(b => b.onclick = () => {
    const to = b.dataset.view;
    if (to !== 'id' && !tabEntry && !sheets.length) { history.pushState({ tab: true }, ''); tabEntry = true; }
    if (to === 'id' && tabEntry && !sheets.length) { tabEntry = false; ignorePop++; history.back(); }
    state.view = to; render(); window.scrollTo(0, 0);
  });
  gps.start();
  gps.on(updateGpsPill);
  let lastBar = 0;
  gps.on(p => { if (Date.now() - lastBar > 4000) { lastBar = Date.now(); renderActiveBar(); } logTrack(p); });
  window.addEventListener('online', applyMapSettings); window.addEventListener('offline', applyMapSettings);
  window.addEventListener('online', updateNetPill); window.addEventListener('offline', updateNetPill); updateNetPill();
  updateBackupPill(); setInterval(updateBackupPill, 600000);
  render(); renderActiveBar(); measureChrome(); setTimeout(measureChrome, 500);
  const rec = await db.getKV('recording');  // återuppta en gränsinspelning som pågick när appen stängdes
  if (rec && rec.obId && state.objects.some(o => o.id === rec.obId)) { await startRecording(rec.obId); toast('Gränsinspelningen fortsätter'); }
  if (state.modelReady) ensureModel().catch(() => {}); // värm upp modellen i bakgrunden
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}
main();

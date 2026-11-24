// Export/import: GeoJSON (QGIS m.fl.), CSV (Excel), samt full säkerhetskopia som ZIP med foton.
import { toSweref99TM, polygonAreaM2, generalizeToGrid } from './geo.js';

// ---------- Minimal ZIP (okomprimerad "store") ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

export async function makeZip(files) { // files: [{name, data: Uint8Array|string|Blob}]
  const enc = new TextEncoder();
  const parts = [], central = [];
  let offset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  for (const f of files) {
    let data = f.data;
    if (typeof data === 'string') data = enc.encode(data);
    else if (data instanceof Blob) data = new Uint8Array(await data.arrayBuffer());
    const name = enc.encode(f.name);
    const crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint16(10, dosTime, true); h.setUint16(12, dosDate, true); h.setUint32(14, crc, true);
    h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
    parts.push(new Uint8Array(h.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true); c.setUint16(12, dosTime, true); c.setUint16(14, dosDate, true); c.setUint32(16, crc, true);
    c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    central.push(new Uint8Array(c.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const cdSize = central.reduce((s, p) => s + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
}

export async function readZip(blob) { // läser okomprimerade zip-filer (som appen själv skapar)
  const buf = new Uint8Array(await blob.arrayBuffer());
  const dv = new DataView(buf.buffer);
  let e = buf.length - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('Ogiltig zip-fil');
  const count = dv.getUint16(e + 10, true);
  let p = dv.getUint32(e + 16, true);
  const dec = new TextDecoder();
  const out = {};
  for (let i = 0; i < count; i++) {
    const method = dv.getUint16(p + 10, true);
    const size = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nlen));
    if (method !== 0) throw new Error('Komprimerade zip-filer stöds inte – använd en säkerhetskopia från appen');
    const lnlen = dv.getUint16(local + 26, true), lxlen = dv.getUint16(local + 28, true);
    const start = local + 30 + lnlen + lxlen;
    out[name] = buf.slice(start, start + size);
    p += 46 + nlen + xlen + clen;
  }
  return out;
}

// ---------- Hjälpare ----------
// ---------- Skyddsklassade arter (SLU Artdatabanken) ----------
// Exakt läge, datum och kringuppgifter döljs; positionen generaliseras till en ruta på 5, 25 eller 50 km i SWEREF 99 TM.
// För fåglar gäller skyddet fynd som kan indikera häckning – bara uttryckligen förbiflygande/sträckande fåglar undantas.
export const NON_BREEDING = 'Förbiflygande/sträckande';
export function protectionKm(o, sp) {
  if (!sp || !sp.sk) return 0;
  if (sp.skH && o.activity === NON_BREEDING) return 0;
  return sp.sk;
}
const isProtected = (o, species, opts) => !!(opts && opts.protect && protectionKm(o, species[o.speciesId]));

function coordsFor(o, species, opts = {}) {
  if (!o.pos) return null;
  const km = opts.protect ? protectionKm(o, species[o.speciesId]) : 0;
  if (!km) { const sw = toSweref99TM(o.pos.lat, o.pos.lon); return { lat: o.pos.lat, lon: o.pos.lon, N: sw.N, E: sw.E, km: 0 }; }
  const g = generalizeToGrid(o.pos.lat, o.pos.lon, km);
  return { lat: g.center.lat, lon: g.center.lon, N: g.N, E: g.E, km, cell: g.corners };
}

export function obsProps(o, species, objects, opts = {}) {
  const sp = species[o.speciesId] || {};
  const obj = objects.find(x => x.id === o.objectId);
  const hide = isProtected(o, species, opts);
  const props = {
    id: o.id,
    tid: new Date(o.time).toISOString(),
    svenskt_namn: sp.sv || '',
    vetenskapligt_namn: sp.sci || o.freeName || '',
    artgrupp: sp.grp || '',
    rodlista_2025: sp.rl || '',
    signalart_sks_2023: sp.sig || '',
    dyntaxa_id: sp.dyntaxa || '',
    mangd: o.amount || '',
    antal: o.count || '',
    enhet: o.unit || '',
    substrat: o.substrate || '',
    substrat_typ: o.sub?.type || '',
    substrat_tradslag: o.sub?.tree || '',
    substrat_diameter_cm: o.sub?.diam || '',
    substrat_nedbrytning: o.sub?.decay || '',
    registrerad_via: o.source === 'checklista' ? 'checklista' : (o.ai?.length ? 'foto/AI' : 'formulär'),
    kommentar: o.notes || '',
    ai_forslag: (o.ai || []).slice(0, 3).map(a => `${(species[a.id] || {}).sci} ${(a.p * 100).toFixed(0)}%`).join('; '),
    ai_sakerhet_vald_art: o.aiProbChosen != null ? Math.round(o.aiProbChosen * 100) : '',
    bekraftad_av_inventerare: o.confirmed ? 'ja' : 'nej',
    bestamningsmetod: o.method || '',
    osaker_bestamning: o.unsure ? 'ja' : 'nej',
    noggrannhet_m: o.pos ? o.pos.acc : '',
    naturvardesobjekt: obj ? obj.name : '',
    antal_foton: (o.photoIds || []).length,
    aktivitet: o.activity || '',
    skyddsklassad_art_km: sp.sk || '',
    skyddsklass_villkor: sp.skR || '',
  };
  if (hide) { // Artdatabankens princip: exakt läge, datum och kringuppgifter döljs
    Object.assign(props, { id: '', tid: String(new Date(o.time).getFullYear()), kommentar: '', substrat: '', substrat_typ: '', substrat_tradslag: '',
      substrat_diameter_cm: '', substrat_nedbrytning: '', naturvardesobjekt: '', noggrannhet_m: '', antal_foton: '', ai_forslag: '' });
  }
  return props;
}

export function toGeoJSON(observations, objects, species, opts = {}) {
  const features = [];
  for (const o of observations) {
    const c = coordsFor(o, species, opts);
    if (!c) continue;
    const props = obsProps(o, species, objects, opts);
    if (c.km) {
      props.koordinat_generaliserad = `${c.km} km-ruta (SWEREF 99 TM)`;
      features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [c.cell.map(p => [+p.lon.toFixed(6), +p.lat.toFixed(6)])] }, properties: { typ: 'fynd', ...props } });
    } else features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [c.lon, c.lat] }, properties: { typ: 'fynd', ...props } });
  }
  for (const ob of objects) {
    const pts = (ob.polygon || []).map(p => [p.lon, p.lat]);
    let geometry = null;
    if (pts.length >= 3) geometry = { type: 'Polygon', coordinates: [[...pts, pts[0]]] };
    else if (pts.length) geometry = { type: 'Point', coordinates: pts[0] };
    if (!geometry) continue;
    features.push({ type: 'Feature', geometry, properties: objectProps(ob, observations, species, opts) });
  }
  return JSON.stringify({ type: 'FeatureCollection', name: 'naturvardesinventering', features }, null, 1);
}

// Naturvårdsart i objektet: signal-/E-art eller rödlistad (ej DD/RE) och inte osäkert bestämd
const nvOk = (o, species) => { const sp = species[o.speciesId]; return !o.unsure && !!sp && (!!sp.sig || (!!sp.rl && sp.rl !== 'DD' && sp.rl !== 'RE')); };

export function objectProps(ob, observations, species, opts = {}) {
  const linked = observations.filter(o => o.objectId === ob.id);
  const nvAll = linked.filter(o => nvOk(o, species));
  // Skyddsklassade arter namnges inte per objekt (objektets läge skulle avslöja fyndplatsen)
  const nv = nvAll.filter(o => !isProtected(o, species, opts));
  const nProt = new Set(nvAll.concat(linked).filter(o => isProtected(o, species, opts)).map(o => o.speciesId)).size;
  const names = arr => [...new Set(arr.map(o => species[o.speciesId].sci))].join('; ');
  const rl = nv.filter(o => species[o.speciesId].rl && species[o.speciesId].rl !== 'DD');
  return {
    typ: 'naturvardesobjekt', id: ob.id, namn: ob.name, naturvardesklass: ob.klass || '',
    biotopvarde: ob.biotopvarde || '', motivering_biotopvarde: ob.bvMotiv || '',
    artvarde: ob.artvarde || '', motivering_artvarde: ob.avMotiv || '',
    osakerhet_klassning: ob.osakerhet || '',
    biotop: ob.biotop || '', natura2000: ob.natura2000 || '',
    generellt_biotopskydd: ob.biotopskydd || '', nyckelbiotop: ob.nyckelbiotop || '',
    strukturer: (ob.structures || []).join('; '), paverkan: (ob.paverkan || []).join('; '),
    beskrivning: ob.description || '', skotselbehov_hot: ob.skotsel || '',
    area_m2: Math.round(polygonAreaM2(ob.polygon)), antal_fynd: linked.length,
    rodlistade_arter: rl.map(o => `${species[o.speciesId].sci} (${species[o.speciesId].rl})`).filter((v, i, a) => a.indexOf(v) === i).join('; '),
    signalarter_S: names(nv.filter(o => species[o.speciesId].sig === 'S')),
    e_arter: names(nv.filter(o => species[o.speciesId].sig === 'E')),
    osakra_naturvardsarter_ej_medraknade: names(linked.filter(o => o.unsure && !isProtected(o, species, opts) && species[o.speciesId] && (species[o.speciesId].sig || species[o.speciesId].rl))),
    skyddsklassade_arter_antal: opts.protect ? nProt : '',
    antal_foton_objekt: (ob.photoIds || []).length,
    inventerare: ob.inventerare || '',
    skapad: new Date(ob.created).toISOString(),
  };
}

export function objectsCSV(objects, observations, species, opts = {}) {
  const rows = objects.map(ob => {
    const pr = objectProps(ob, observations, species, opts);
    const c = (ob.polygon || []).length ? ob.polygon.reduce((a, p) => ({ lat: a.lat + p.lat / ob.polygon.length, lon: a.lon + p.lon / ob.polygon.length }), { lat: 0, lon: 0 }) : null;
    const sw = c ? toSweref99TM(c.lat, c.lon) : {};
    return { ...pr, mittpunkt_N_sweref99tm: sw.N ?? '', mittpunkt_E_sweref99tm: sw.E ?? '' };
  });
  if (!rows.length) return '\ufeff';
  const cols = Object.keys(rows[0]);
  return '\ufeff' + [cols.join(';'), ...rows.map(r => cols.map(k => csvEscape(r[k])).join(';'))].join('\r\n');
}

// Rapportunderlag till beställaren: utskriftsvänlig HTML (kan sparas som PDF från webbläsaren)
export function reportHTML(project, objects, observations, species, opts = {}) {
  const e = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const area = ob => { const a = polygonAreaM2(ob.polygon); return a >= 10000 ? (a / 10000).toFixed(2) + ' ha' : Math.round(a) + ' m²'; };
  const klassName = { 1: 'Högsta naturvärde', 2: 'Högt naturvärde', 3: 'Påtagligt naturvärde', 4: 'Visst naturvärde' };
  const sorted = [...objects].sort((a, b) => (a.klass || 9) - (b.klass || 9) || a.name.localeCompare(b.name, 'sv'));
  const spRow = o => { const sp = species[o.speciesId] || {}; return { sv: sp.sv || '', sci: sp.sci || '', rl: sp.rl || '', sig: sp.sig || '' }; };
  const objSection = ob => {
    const pr = objectProps(ob, observations, species, opts);
    const linked = observations.filter(o => o.objectId === ob.id && !isProtected(o, species, opts));
    const bySp = new Map();
    for (const o of linked) { const k = o.speciesId; if (!bySp.has(k)) bySp.set(k, []); bySp.get(k).push(o); }
    const spRows = [...bySp.values()].map(os => ({ ...spRow(os[0]), n: os.length, amount: os.map(o => o.amount).filter(Boolean).pop() || '',
      sub: [...new Set(os.map(o => o.substrate).filter(Boolean))].join('; '), unsure: os.some(o => o.unsure) }))
      .sort((a, b) => (!!b.rl - !!a.rl) || (!!b.sig - !!a.sig) || a.sv.localeCompare(b.sv, 'sv'));
    return `<section><h2>${e(ob.name)} – ${ob.klass ? `klass ${ob.klass}, ${klassName[ob.klass]}` : 'ej klassad'}</h2>
      <table class="kv"><tr><th>Biotop</th><td>${e(pr.biotop)}</td><th>Natura 2000</th><td>${e(pr.natura2000)}</td></tr>
      <tr><th>Area</th><td>${area(ob)}</td><th>Osäkerhet i klassning</th><td>${e(pr.osakerhet_klassning)}</td></tr>
      <tr><th>Biotopvärde</th><td>${e(pr.biotopvarde)}</td><th>Artvärde</th><td>${e(pr.artvarde)}</td></tr>
      <tr><th>Generellt biotopskydd</th><td>${e(pr.generellt_biotopskydd)}</td><th>Nyckelbiotop</th><td>${e(pr.nyckelbiotop)}</td></tr></table>
      ${pr.beskrivning ? `<h3>Beskrivning</h3><p>${e(pr.beskrivning)}</p>` : ''}
      ${pr.motivering_biotopvarde ? `<h3>Motivering biotopvärde</h3><p>${e(pr.motivering_biotopvarde)}</p>` : ''}
      ${pr.motivering_artvarde ? `<h3>Motivering artvärde</h3><p>${e(pr.motivering_artvarde)}</p>` : ''}
      ${pr.strukturer ? `<p><b>Strukturer och värdeelement:</b> ${e(pr.strukturer)}</p>` : ''}
      ${pr.paverkan ? `<p><b>Påverkan:</b> ${e(pr.paverkan)}</p>` : ''}
      ${pr.skotselbehov_hot ? `<p><b>Skötselbehov/hot:</b> ${e(pr.skotselbehov_hot)}</p>` : ''}
      ${pr.skyddsklassade_arter_antal ? `<p><b>Skyddsklassade arter:</b> ${pr.skyddsklassade_arter_antal} st – redovisas i separat konfidentiell bilaga.</p>` : ''}
      <h3>Arter (${spRows.length})</h3>${spRows.length ? `<table><tr><th>Art</th><th>Rödlista 2025</th><th>Signalart</th><th>Mängd</th><th>Substrat</th><th>Reg.</th></tr>
      ${spRows.map(r => `<tr><td>${e(r.sv)} <i>${e(r.sci)}</i>${r.unsure ? ' <b>(osäker)</b>' : ''}</td><td>${e(r.rl)}</td><td>${e(r.sig)}</td><td>${e(r.amount)}</td><td>${e(r.sub)}</td><td>${r.n}</td></tr>`).join('')}</table>` : '<p>Inga arter registrerade.</p>'}
    </section>`;
  };
  return `<!doctype html><html lang="sv"><head><meta charset="utf-8"><title>Rapportunderlag – ${e(project.name || 'Naturvärdesinventering')}</title>
  <style>body{font:14px/1.45 system-ui,sans-serif;margin:24px;color:#111}h1{font-size:22px}h2{font-size:17px;border-top:2px solid #1f6b35;padding-top:10px;margin-top:28px}
  h3{font-size:14px;margin:12px 0 4px}table{border-collapse:collapse;width:100%;margin:6px 0}th,td{border:1px solid #ccc;padding:4px 6px;text-align:left;vertical-align:top}
  th{background:#eef3ec}.kv th{width:18%}section{page-break-inside:avoid}.note{color:#555;font-size:12px}</style></head><body>
  <h1>Rapportunderlag – ${e(project.name || 'Naturvärdesinventering')}</h1>
  <table class="kv"><tr><th>Beställare</th><td>${e(project.client)}</td><th>Inventerare</th><td>${e(project.inventors)}</td></tr>
  <tr><th>Standard</th><td>${e(project.standard)}</td><th>Detaljeringsgrad</th><td>${e(project.level)}</td></tr>
  <tr><th>Tillägg</th><td colspan="3">${e((project.addons || []).join(', ') || 'Inga')}</td></tr>
  <tr><th>Fältdatum</th><td colspan="3">${e([...new Set(observations.map(o => new Date(o.time).toLocaleDateString('sv-SE')))].sort().join(', '))}</td></tr></table>
  <h2>Sammanställning</h2><table><tr><th>Objekt</th><th>Klass</th><th>Biotop</th><th>Area</th><th>Rödlistade</th><th>Signalarter</th></tr>
  ${sorted.map(ob => { const pr = objectProps(ob, observations, species, opts); return `<tr><td>${e(ob.name)}</td><td>${ob.klass || '–'}</td><td>${e(pr.biotop)}</td><td>${area(ob)}</td><td>${e(pr.rodlistade_arter)}</td><td>${e(pr.signalarter_S)}</td></tr>`; }).join('')}</table>
  ${sorted.map(objSection).join('')}
  <p class="note">Rödlistekategorier: Rödlistan 2025 (SLU Artdatabanken). Signalarter (S) och ekologiska ståndortsindikatorer (E): Skogsstyrelsens förteckning 2023-1.
  Osäkert bestämda arter räknas inte som naturvårdsarter. ${opts.protect ? 'Skyddsklassade arter (SLU Artdatabanken) namnges inte per objekt i detta underlag utan redovisas i en separat konfidentiell bilaga.' : '<b>OBS: underlaget innehåller skyddsklassade arter med objektskoppling och ska inte spridas öppet.</b>'} Underlaget är genererat av fältappen och ska granskas av inventeraren.</p>
  </body></html>`;
}

// Konfidentiell bilaga: skyddsklassade fynd med exakta uppgifter, till beställare/myndighet som har rätt att ta del av dem
export function protectedAppendixHTML(project, objects, observations, species) {
  const e = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rows = observations.filter(o => protectionKm(o, species[o.speciesId])).sort((a, b) => a.time - b.time);
  return `<!doctype html><html lang="sv"><head><meta charset="utf-8"><title>KONFIDENTIELL bilaga – skyddsklassade arter</title>
  <style>body{font:13px/1.4 system-ui,sans-serif;margin:24px}h1{font-size:20px;color:#b3261e}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:4px 6px;text-align:left;vertical-align:top}th{background:#fbe9e7}</style></head><body>
  <h1>KONFIDENTIELLT – skyddsklassade arter</h1>
  <p>${e(project.name || 'Naturvärdesinventering')}${project.client ? ' · ' + e(project.client) : ''}. Fynd av arter som är skyddsklassade av SLU Artdatabanken.
  Exakta lägen får inte spridas öppet; hantera enligt Artdatabankens riktlinjer för skyddsklassade artuppgifter. Rapportera fynden till Artportalen, där de skyddas automatiskt.</p>
  <table><tr><th>Art</th><th>Generalisering</th><th>Villkor</th><th>Datum</th><th>N / E (SWEREF 99 TM)</th><th>±m</th><th>Objekt</th><th>Aktivitet</th><th>Mängd/antal</th><th>Substrat</th><th>Kommentar</th></tr>
  ${rows.map(o => { const sp = species[o.speciesId]; const sw = o.pos ? toSweref99TM(o.pos.lat, o.pos.lon) : null; const ob = objects.find(x => x.id === o.objectId);
    return `<tr><td>${e(sp.sv)} <i>${e(sp.sci)}</i></td><td>${sp.sk} km</td><td>${e(sp.skR || '')}</td><td>${new Date(o.time).toLocaleString('sv-SE')}</td>
    <td>${sw ? `${sw.N} / ${sw.E}` : 'saknas'}</td><td>${o.pos ? o.pos.acc : ''}</td><td>${e(ob ? ob.name : '')}</td><td>${e(o.activity || '')}</td>
    <td>${e([o.amount, o.count && (o.count + ' ' + (o.unit || ''))].filter(Boolean).join(', '))}</td><td>${e(o.substrate || '')}</td><td>${e(o.notes || '')}</td></tr>`; }).join('') || '<tr><td colspan="11">Inga skyddsklassade fynd.</td></tr>'}
  </table></body></html>`;
}

function csvEscape(v) {
  const s = String(v ?? '');
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(observations, objects, species, opts = {}) {
  const rows = [];
  for (const o of observations) {
    const c = coordsFor(o, species, opts);
    rows.push({ ...obsProps(o, species, objects, opts), lat_wgs84: c ? c.lat.toFixed(6) : '', lon_wgs84: c ? c.lon.toFixed(6) : '',
      N_sweref99tm: c ? c.N : '', E_sweref99tm: c ? c.E : '', koordinat_generaliserad: c && c.km ? `${c.km} km-ruta, mittpunkt` : '' });
  }
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  // BOM + semikolon så att svenska Excel öppnar filen rätt
  return '﻿' + [cols.join(';'), ...rows.map(r => cols.map(k => csvEscape(r[k])).join(';'))].join('\r\n');
}

export function download(blobOrText, filename, type = 'application/octet-stream') {
  const blob = blobOrText instanceof Blob ? blobOrText : new Blob([blobOrText], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}

export async function shareOrDownload(blob, filename) {
  const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  download(blob, filename);
}

// Slumpmässig användarsimulering ("monkey test") av appen i en riktig webbläsare.
// Kör N handlingar (fota, spara, redigera, radera, objekt, GPS-förflyttning, offline, omladdning, export …)
// och kontrollerar efter varje steg att inga JavaScript-fel uppstår och att data är konsistent.
//
//   cd skogsapp/app && python3 -m http.server 8080 &
//   node tools/simulate_ui.js [antal=10000] [bildmapp=tools/cache/eval_images] [frö=12345]
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const N = +(process.argv[2] || 10000);
const IMG_DIR = process.argv[3] || path.join(__dirname, 'cache', 'eval_images');
const URL = 'http://localhost:8080/';
const SEED = +(process.argv[4] || 12345);
const OUT = path.join(__dirname, 'cache', `sim_ui_results_${SEED}.json`);

let seed = SEED;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = a => a[Math.floor(rnd() * a.length)];
const images = fs.readdirSync(IMG_DIR).filter(f => f.endsWith('.jpg')).slice(0, 60).map(f => path.join(IMG_DIR, f));
const QUERIES = ['lung', 'gran', 'ticka', 'mossa', 'Lobaria', 'tall', 'hackspett', 'lav', 'xyz', 'ö', 'Phellinus', 'sk', 'a', ''];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['Pixel 7'], geolocation: { latitude: 62.39, longitude: 17.30, accuracy: 8 }, permissions: ['geolocation'], acceptDownloads: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(5000);
  const stats = { actions: {}, errors: [], invariantFailures: [], analysisMs: [], exports: 0, reloads: 0, saved: 0, deleted: 0, objects: 0 };
  let current = 'start';
  page.on('pageerror', e => stats.errors.push({ action: current, msg: 'pageerror: ' + e.message }));
  page.on('console', m => { if (m.type() === 'error') stats.errors.push({ action: current, msg: m.text() }); });
  page.on('dialog', d => (rnd() < 0.7 ? d.accept() : d.dismiss()).catch(() => {}));
  let pos = { lat: 62.39, lon: 17.30 }, online = true;

  await page.goto(URL);
  await page.waitForSelector('nav.tabs');
  // Ladda ner modellen (förutsättning för fältbruk)
  await page.click('nav.tabs button[data-view=more]');
  if (await page.$('#btn-dl')) { await page.click('#btn-dl'); await page.waitForSelector('text=Nedladdad – fungerar offline', { timeout: 300000 }); }

  const has = async sel => !!(await page.$(sel));
  // Bakåt från startfliken lämnar appen (som på Android) – starta om den då
  const ensureInApp = async () => { if (!page.url().startsWith(URL)) { stats.leftApp = (stats.leftApp || 0) + 1; await page.goto(URL); await page.waitForSelector('nav.tabs'); } };
  const tap = async sel => {
    const el = await page.$(sel);
    if (el && await el.isVisible()) {
      await el.evaluate(e => e.scrollIntoView({ block: 'center' })).catch(() => {});
      await el.click({ timeout: 3000 }).catch(() => {}); return true;
    }
    return false;
  };
  const tab = v => tap(`nav.tabs button[data-view=${v}]`);
  const list = async l => { await tab('list'); await tap(`.list-seg button[data-l=${l}]`); };
  const closeModal = async () => { if (await has('.modal-close')) await tap('.modal-close'); };

  async function dbState() {
    return page.evaluate(() => new Promise(res => {
      const r = indexedDB.open('skogsinventering');
      r.onsuccess = () => {
        const db = r.result; const t = db.transaction(['observations', 'photos', 'objects'], 'readonly');
        const out = {};
        let n = 0;
        for (const s of ['observations', 'photos', 'objects']) {
          const q = t.objectStore(s).getAll();
          q.onsuccess = () => { out[s] = q.result.map(x => ({ id: x.id, obsId: x.obsId, objId: x.objId, photoIds: x.photoIds, objectId: x.objectId, speciesId: x.speciesId, polygon: x.polygon, pos: x.pos })); if (++n === 3) res(out); };
        }
      };
    }));
  }
  async function drawOnMap() {
    const el = await page.$('#map-el'); if (!el || !(await has('#dr-save'))) return;
    const bb = await el.boundingBox(); if (!bb) return;
    const n = Math.floor(rnd() * 6);
    for (let k = 0; k < n; k++) await page.mouse.click(bb.x + 60 + rnd() * (bb.width - 120), bb.y + 80 + rnd() * (bb.height - 200)).catch(() => {});
    if (rnd() < 0.2) await tap('#dr-undo');
    await tap(rnd() < 0.85 ? '#dr-save' : '#dr-cancel'); stats.drawn = (stats.drawn || 0) + 1;
  }
  async function checkInvariants(label) {
    const s = await dbState();
    const obsIds = new Set(s.observations.map(o => o.id));
    const photoIds = new Set(s.photos.map(p => p.id));
    const objIds = new Set(s.objects.map(o => o.id));
    const fail = m => stats.invariantFailures.push({ at: label, msg: m });
    for (const o of s.observations) {
      for (const pid of o.photoIds || []) if (!photoIds.has(pid)) fail(`fynd ${o.id} saknar foto ${pid}`);
      if (o.objectId && !objIds.has(o.objectId)) fail(`fynd ${o.id} pekar på raderat objekt`);
      if (o.speciesId == null || o.speciesId < 0) fail(`fynd ${o.id} saknar art`);
      if (o.pos && !(isFinite(o.pos.lat) && isFinite(o.pos.lon))) fail(`fynd ${o.id} ogiltig position`);
    }
    for (const p of s.photos) if (!obsIds.has(p.obsId) && !objIds.has(p.objId)) fail(`föräldralöst foto ${p.id}`);
    for (const ob of s.objects) for (const pid of ob.photoIds || []) if (!photoIds.has(pid)) fail(`objekt ${ob.id} saknar foto ${pid}`);
    return s;
  }
  // Visat resultat måste gälla vald artgrupp (fångar inaktuella resultat efter gruppbyte)
  async function checkResultLabel(label) {
    const r = await page.evaluate(() => {
      const v = document.querySelector('#view-id'); const h = document.querySelector('#results .row.between [data-g]');
      const chip = document.querySelector('#group-chips .chip.on');
      if (!v || v.hidden || !h || !chip) return null;
      return { header: h.textContent, hg: h.dataset.g, chip: chip.dataset.g };
    }).catch(() => null);
    if (r && r.hg !== r.chip) stats.invariantFailures.push({ at: label, msg: `resultat för fel grupp visas: "${r.header}" men vald grupp är ${r.chip}` });
  }

  const actions = [
    [20, 'byt flik', async () => tab(pick(['id', 'list', 'map', 'more']))],
    [8, 'välj artgrupp', async () => { await tab('id'); await tap(`.chip[data-g=${pick(['alla', 'trad', 'karlvaxt', 'mossa', 'lav', 'svamp', 'fagel'])}]`); }],
    [3, 'byt lista', async () => { await tab('id'); await tap(`#list-seg button[data-l=${pick(['urval', 'alla'])}]`); }],
    [6, 'fota', async () => {
      await closeModal(); if (await has('.modal-bg')) await page.goBack().catch(() => {});
      await tab('id'); if (await has('.modal-bg')) return; // ett formulär med osparade ändringar ligger kvar
      const t0 = Date.now();
      await page.setInputFiles('#cam', pick(images));
      const r = await page.waitForSelector('ol.results, #results .warn', { timeout: 60000 }).catch(() => null);
      if (r) stats.analysisMs.push(Date.now() - t0); else stats.errors.push({ action: current, msg: 'analys tog > 60 s' });
    }],
    [5, 'spara föreslagen art', async () => {
      await tab('id'); if (!(await has('ol.results li.res'))) return;
      const btns = await page.$$('ol.results li.res'); const b = btns[Math.floor(rnd() * Math.min(btns.length, 3))];
      await b.evaluate(e => e.scrollIntoView({ block: 'center' }));
      if (rnd() < 0.25) { const q = await b.$('.quick'); if (q) { await q.click().catch(() => {}); stats.saved++; return; } }
      await b.click().catch(() => {});
      if (rnd() < 0.3) await tap('#sv-unsure');
      if (rnd() < 0.3) { await page.$eval('details.more', d => { d.open = true; }).catch(() => {}); await tap(`.chip-row[data-row=method] .chip[data-v="${pick(['Lupp', 'Okulärt i fält'])}"]`); }
      if (rnd() < 0.5) await tap(`.chip-row[data-row=sub-type] .chip[data-v="${pick(['Låga', 'Levande träd', 'Torraka'])}"]`);
      if (rnd() < 0.3) { await page.$eval('details.more', d => { d.open = true; }).catch(() => {}); await page.fill('#sv-count', String(Math.floor(rnd() * 50))).catch(() => {}); }
      if (rnd() < 0.15) { await tap('#sv-change'); await page.fill('#sp-q', pick(QUERIES)).catch(() => {}); await tap('#sp-list li[data-id]'); }
      if (rnd() < 0.5) await page.selectOption('#sv-obj', { index: Math.floor(rnd() * 3) }).catch(() => {});
      if (rnd() < 0.3) await page.$eval('details.more', d => { d.open = true; }).catch(() => {});
      if (rnd() < 0.3) await page.fill('#sv-notes', pick(['På låga', 'Riklig', '<script>alert(1)</script>', 'Åäö "citat"; semikolon', '']));
      if (rnd() < 0.9) { await tap('#sv-save'); stats.saved++; } else await tap('#sv-cancel');
    }],
    [2, 'beskär', async () => {
      if (!(await has('.thumb img'))) return;
      await tap('.thumb img'); await page.waitForSelector('#crop-box', { timeout: 3000 }).catch(() => {});
      const b = await page.$('#crop-box'); if (!b) return;
      await page.fill('#crop-size', String(15 + Math.floor(rnd() * 85))).catch(() => {});
      await page.$eval('#crop-size', el => el.dispatchEvent(new Event('input'))).catch(() => {});
      const bb = await b.boundingBox();
      if (bb) { await page.mouse.move(bb.x + 5, bb.y + 5); await page.mouse.down(); await page.mouse.move(bb.x + 5 + (rnd() - .5) * 300, bb.y + 5 + (rnd() - .5) * 300, { steps: 4 }); await page.mouse.up(); }
      await tap(rnd() < .8 ? '#crop-ok' : '#crop-reset');
    }],
    [2, 'ta bort foto', async () => tap('.thumb .x')],
    [2, 'börja om', async () => tap('#btn-clear')],
    [5, 'snabbfynd via sök', async () => {
      await closeModal(); await tab('id'); if (!(await tap('#act-art'))) return;
      await page.fill('#cl-q', pick(QUERIES)).catch(() => {});
      const it = await page.$$('.cl-item');
      if (it.length && rnd() < 0.85) { await pick(it.slice(0, 8)).click().catch(() => {}); stats.saved++; if (await has('.modal-bg.sub')) await tap('#rg-save'); }
      await closeModal();
    }],
    [5, 'öppna fynd', async () => {
      await list('fynd'); await closeModal(); const items = await page.$$('#view-obs .obs'); if (!items.length) return;
      await pick(items).click().catch(() => {}); await page.waitForTimeout(100);
      const u = rnd();
      if (u < 0.35) { if (await tap('#od-edit')) { if (rnd() < .3) await tap('#sv-repos'); if (!(await tap('#sv-save'))) await tap('#pt-save'); } }
      else if (u < 0.42) { if (await tap('#od-det')) { await page.fill('#sp-q', pick(QUERIES)).catch(() => {}); if (await tap('#sp-list li[data-id]')) await tap('#sv-save'); } }
      else if (u < 0.55) { if (await tap('#od-del')) stats.deleted++; }
      else await closeModal();
    }],
    [3, 'filtrera fynd', async () => { await list('fynd'); await tap(`.seg button[data-f=${pick(['alla', 'rl', 'sig'])}]`); }],
    [6, 'gå i skogen (GPS)', async () => {
      pos = { lat: pos.lat + (rnd() - .5) * 0.0008, lon: pos.lon + (rnd() - .5) * 0.0016 };
      await ctx.setGeolocation({ latitude: pos.lat, longitude: pos.lon, accuracy: pick([3, 5, 8, 15, 40, 120]) });
    }],
    [3, 'nytt/ändra objekt', async () => {
      await closeModal();
      let items = [];
      if (rnd() < 0.5) { await list('obj'); items = await page.$$('[data-open]'); } else { await tab('id'); if (!(await tap('#act-obj'))) return; }
      if (items.length && rnd() < 0.4) await pick(items).click().catch(() => {}); else if (items.length && !(await tap('#btn-newobj'))) return;
      if (rnd() < 0.1) { await tap('#ob-office'); await page.waitForTimeout(100); }
      if (!(await has('#ob-done'))) return;
      await tap('#ob-tabs button[data-t=avgr]');
      if (rnd() < 0.15) { await tap('#ob-track'); return; }
      if (rnd() < 0.15) { await tap('#ob-drawmap'); await page.waitForTimeout(400); await drawOnMap(); return; }
      await page.$$eval('details.more', ds => ds.forEach(d => { d.open = true; })).catch(() => {});
      for (let k = 0; k < 2 + Math.floor(rnd() * 6); k++) {
        pos = { lat: pos.lat + (rnd() - .5) * 0.0006, lon: pos.lon + (rnd() - .5) * 0.0012 };
        await ctx.setGeolocation({ latitude: pos.lat, longitude: pos.lon, accuracy: pick([4, 6, 10]) });
        await page.waitForTimeout(60); await tap('#ob-add');
      }
      if (rnd() < 0.2) await tap('#ob-undo');
      await tap('#ob-tabs button[data-t=beskr]');
      if (rnd() < 0.2) await page.setInputFiles('#ob-cam', pick(images)).catch(() => {});
      if (rnd() < 0.3) await page.selectOption('#ob-n2k', { index: Math.floor(rnd() * 8) }).catch(() => {});
      if (rnd() < 0.5) await page.selectOption('#ob-biotop', { index: Math.floor(rnd() * 10) }).catch(() => {});
      await page.$$eval('details.grp', ds => ds.forEach(d => { d.open = true; })).catch(() => {});
      for (const c of (await page.$$('.chip[data-s]')).filter(() => rnd() < 0.1)) await c.click().catch(() => {});
      await tap('#ob-tabs button[data-t=bedom]');
      await tap(`.chip-row[data-row=bv] .chip[data-v="${pick(['obetydligt', 'visst', 'påtagligt', 'högt'])}"]`);
      await tap(`.chip-row[data-row=av] .chip[data-v="${pick(['obetydligt', 'visst', 'påtagligt', 'högt'])}"]`);
      if (rnd() < 0.5) await tap('#ob-apply');
      await page.waitForTimeout(600);
      const u = rnd();
      if (u < 0.75) { await tap('#ob-done'); stats.objects++; }
      else if (u < 0.85) await tap('#ob-revert');
      else if (u < 0.92) { await tap('#ob-tabs button[data-t=beskr]'); await tap('#ob-' + 'del'); }
      else await page.goBack();
    }],
    [5, 'checklista', async () => {
      await closeModal();
      if (rnd() < 0.5) { await list('obj'); const b = await page.$$('[data-cl]'); if (!b.length) return; await pick(b).click().catch(() => {}); }
      else { await tab('id'); if (!(await tap('#act-art'))) return; } await page.waitForSelector('.cl-item', { timeout: 3000 }).catch(() => {});
      for (let k = 0; k < 1 + Math.floor(rnd() * 5); k++) {
        const u = rnd();
        if (u < 0.2) await tap(`#cl-groups .chip[data-g=${pick(['alla', 'mossa', 'lav', 'svamp', 'insekt', 'karlvaxt'])}]`);
        else if (u < 0.3) await tap(`#cl-mode button[data-m=${pick(['nv', 'all', 'reg'])}]`);
        else if (u < 0.4) await page.fill('#cl-q', pick(QUERIES)).catch(() => {});
        else {
          const items = await page.$$('.cl-item'); if (!items.length) continue;
          await pick(items.slice(0, 12)).click().catch(() => {});
          if (await has('.modal-bg.sub')) {
            if (rnd() < .5) await tap(`.modal-bg.sub .chip-row[data-row=amount] .chip[data-v="${pick(['Enstaka', 'Fåtal', 'Riklig'])}"]`);
            if (rnd() < .5) await tap(`.modal-bg.sub .chip-row[data-row=sub-tree] .chip[data-v="${pick(['Gran', 'Tall', 'Asp'])}"]`);
            await tap(pick(['#rg-save', '#rg-save', '#rg-new', '#rg-' + 'del', '.modal-bg.sub .modal-close']));
          } else if (rnd() < 0.15) await tap('.toast-undo');
        }
      }
      await closeModal();
    }],
    [1, 'ändra uppdrag', async () => {
      await closeModal(); await tab('more'); if (!(await tap('#btn-project'))) return;
      await page.fill('#pr-name', pick(['NVI Granåsen', 'Detaljplan Norr', ''])).catch(() => {});
      await tap('.chip[data-a="Naturvärdesklass 4"]'); await tap(rnd() < .8 ? '#pr-save' : '.modal-close');
    }],
    [3, 'bakåtknapp', async () => { await page.goBack().catch(() => {}); await page.waitForTimeout(150); await ensureInApp(); }],
    [2, 'senast registrerat', async () => { await closeModal(); await tab('id'); const c = await page.$$('.recent-chip'); if (c.length) { await pick(c).click().catch(() => {}); stats.saved++; } }],
    [1, 'stoppa inspelning', async () => tap('#rec-stop')],
    [3, 'punkt/anteckning', async () => {
      await closeModal(); await tab('id'); if (!(await tap('#act-note'))) return;
      if (rnd() < 0.7) await tap('#pt-fav .chip'); if (rnd() < 0.4) await page.fill('#pt-text', pick(['Grov låga', '<b>x</b>', 'Åäö; "citat"', ''])).catch(() => {});
      if (rnd() < 0.2) await page.setInputFiles('#pt-cam', pick(images)).catch(() => {});
      await page.waitForTimeout(150); if (rnd() < 0.85) { await tap('#pt-save'); stats.saved++; } else await tap('#pt-cancel');
    }],
    [2, 'spara obestämd', async () => { if (await tap('#btn-indet')) { await tap('#sv-save'); stats.saved++; } }],
    [1, 'du är i → objektkort', async () => { await closeModal(); await tab('id'); await tap('#here'); await page.waitForTimeout(100); await tap('#ob-done'); }],
    [2, 'tryck på kartan', async () => {
      await closeModal(); await tab('map'); await page.waitForTimeout(150);
      const pts = await page.$$('#map-el path.leaflet-interactive'); if (pts.length) { await pick(pts).click({ force: true }).catch(() => {}); await page.waitForTimeout(100); await closeModal(); }
      if (rnd() < 0.3) await tap(pick(['#mp-me', '#mp-fit']));
    }],
    [1, 'kartlager', async () => {
      await closeModal(); await tab('map'); if (!(await tap('#mp-layers'))) return;
      if (rnd() < 0.5) await tap(`input[name=ly-base][value=${pick(['osm', 'none', 'lmtopo', 'osm'])}]`);
      if (rnd() < 0.5) await tap('.ly-ov'); if (rnd() < 0.3) await tap('#ly-track');
      await closeModal();
    }],
    [2, 'inställningar', async () => { await tab('more'); await page.$eval('details.more-files', d => { d.open = true; }).catch(() => {}); await tap(pick(['#set-prot', '#set-acc', '#set-office'])); if (rnd() < .3) await page.selectOption('#set-theme', pick(['auto', 'light', 'dark'])).catch(() => {}); }],
    [2, 'export + kontroll', async () => {
      await closeModal(); await tab('more'); await page.waitForSelector('#ex-delivery');
      const protectOn = await page.$eval('#set-prot', e => e.checked).catch(() => true);
      const which = pick(['#ex-delivery', '#ex-geo', '#ex-csv', '#ex-zip', '#ex-obj', '#ex-rep']);
      await page.$eval('details.more-files', d => { d.open = true; }).catch(() => {});
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), tap(which)]);
      const file = await dl.path(); stats.exports++;
      const s = await checkInvariants('export');
      if (which === '#ex-geo') {
        const gj = JSON.parse(fs.readFileSync(file, 'utf8'));
        const nObs = gj.features.filter(f => f.properties.typ === 'fynd').length;
        const expect = s.observations.filter(o => o.pos).length;
        if (nObs !== expect) stats.invariantFailures.push({ at: 'geojson', msg: `GeoJSON har ${nObs} fynd, databasen ${expect}` });
        for (const f of gj.features) {
          if (f.properties.typ === 'naturvardesobjekt' && f.geometry.type === 'Polygon' && !(f.properties.area_m2 >= 0)) stats.invariantFailures.push({ at: 'geojson', msg: 'ogiltig area' });
          // Skyddsklassade fynd får aldrig exporteras som exakt punkt när skyddet är på (standard)
          const p = f.properties;
          if (p.typ === 'fynd' && p.skyddsklassad_art_km && p.aktivitet !== 'Förbiflygande/sträckande' && protectOn && f.geometry.type === 'Point')
            stats.invariantFailures.push({ at: 'geojson', msg: `skyddsklassad art ${p.vetenskapligt_namn} exporterad med exakt position` });
        }
      } else if (which === '#ex-csv') {
        const txt = fs.readFileSync(file, 'utf8');
        const rows = txt ? txt.split('\r\n').length - 1 : 0;
        if (rows !== s.observations.length) stats.invariantFailures.push({ at: 'csv', msg: `CSV har ${rows} rader, databasen ${s.observations.length}` });
      } else {
        fs.copyFileSync(file, path.join(__dirname, 'cache', `sim_backup_${SEED}.zip`));
      }
    }],
    [0.4, 'återställ säkerhetskopia', async () => {
      const zip = path.join(__dirname, 'cache', `sim_backup_${SEED}.zip`); if (!fs.existsSync(zip)) return;
      await tab('more'); const before = await dbState();
      await page.setInputFiles('#im-zip', zip); await page.waitForTimeout(1500);
      const after = await dbState();
      if (after.observations.length < before.observations.length) stats.invariantFailures.push({ at: 'import', msg: 'fynd försvann vid återställning' });
    }],
    [2, 'offline/online', async () => { online = !online; await ctx.setOffline(!online); }],
    [1, 'ladda om appen', async () => { await page.reload(); await page.waitForSelector('nav.tabs', { timeout: 30000 }); stats.reloads++; }],
    [3, 'stäng dialog', async () => { if (rnd() < .5) await closeModal(); else await page.mouse.click(200, 60); }],
    [5, 'slumpmässigt tryck', async () => { await page.mouse.click(rnd() * 412, rnd() * 915); await page.waitForTimeout(30); }],
  ];
  const total = actions.reduce((s, a) => s + a[0], 0);
  const t0 = Date.now();
  for (let i = 1; i <= N; i++) {
    let u = rnd() * total, a = actions[0];
    for (const x of actions) { u -= x[0]; if (u <= 0) { a = x; break; } }
    current = `#${i} ${a[1]}`;
    stats.actions[a[1]] = (stats.actions[a[1]] || 0) + 1;
    const ta = Date.now();
    try { await a[2](); await ensureInApp(); } catch (e) { stats.errors.push({ action: current, msg: 'simulator: ' + e.message.split('\n')[0] }); await closeModal().catch(() => {}); }
    if (process.env.VERBOSE) console.log(current, Date.now() - ta, "ms");
    await checkResultLabel(current);
    if (i % 250 === 0) {
      await checkInvariants(`#${i}`);
      const el = (Date.now() - t0) / 1000;
      console.log(`${i}/${N}  ${(el / 60).toFixed(1)} min  fel: ${stats.errors.length}  invariantbrott: ${stats.invariantFailures.length}  sparade: ${stats.saved}`);
      fs.writeFileSync(OUT, JSON.stringify(stats));
    }
  }
  await ctx.setOffline(false);
  const final = await checkInvariants('slut');
  stats.final = { observations: final.observations.length, photos: final.photos.length, objects: final.objects.length };
  stats.minutes = (Date.now() - t0) / 60000;
  fs.writeFileSync(OUT, JSON.stringify(stats, null, 1));
  console.log(JSON.stringify({ ...stats, analysisMs: undefined, errors: stats.errors.slice(0, 30), invariantFailures: stats.invariantFailures.slice(0, 30) }, null, 1));
  await browser.close();
})();

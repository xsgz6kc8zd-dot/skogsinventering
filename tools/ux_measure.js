// Mäter tryckytor och textkontrast i alla vyer (ljust + mörkt). Ändrar inget i projektet.
const { chromium, devices } = require('playwright');
const E2E = process.env.TEST_IMAGES || (__dirname + '/test_images/'); // mapp med testfoton (jpg)
const OUT = (process.env.OUT_DIR || require('os').tmpdir()) + '/measure_';

const probe = () => {
  const sel = 'button, a, input, select, textarea, label.btn, label.linkbtn, .chip, .obs, .sp-list li[data-id], .cl-item, circle.pt, g.pt, [role=button]';
  const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !el.closest('[hidden]'); };
  const targets = [];
  for (const el of document.querySelectorAll(sel)) {
    if (!vis(el)) continue;
    let tgt = el;
    if (el.tagName === 'INPUT' && (el.type === 'file') ) continue;
    if (el.tagName === 'INPUT' && el.type === 'checkbox') { const l = el.closest('label'); }
    const r = tgt.getBoundingClientRect();
    const label = (el.getAttribute('aria-label') || el.textContent || el.id || el.className.baseVal || el.className || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
    targets.push({ tag: el.tagName.toLowerCase(), cls: (typeof el.className === 'string' ? el.className : ''), id: el.id, label, w: Math.round(r.width), h: Math.round(r.height) });
  }
  // kontrast
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; };
  const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const blend = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
  const bgOf = el => { const stack = []; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { stack.push(c); if (c.a >= 1) break; } } let b = { r: 255, g: 255, b: 255, a: 1 }; for (let i = stack.length - 1; i >= 0; i--) b = blend(stack[i], b); return b; };
  const issues = [];
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const t = walker.currentNode; if (!t.textContent.trim()) continue;
    const el = t.parentElement; if (!vis(el) || el.closest('svg')) continue;
    const s = getComputedStyle(el); let fg = parse(s.color); const bg = bgOf(el); fg = blend(fg, bg);
    const op = parseFloat(s.opacity);
    const L1 = lum(fg), L2 = lum(bg); const cr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const size = parseFloat(s.fontSize), bold = +s.fontWeight >= 700;
    const large = size >= 24 || (bold && size >= 18.66);
    const need = large ? 3 : 4.5;
    const key = el.className + '|' + s.color + '|' + `${bg.r},${bg.g},${bg.b}`;
    if (cr < need && !seen.has(key)) { seen.add(key); issues.push({ text: t.textContent.trim().slice(0, 30), cls: typeof el.className === 'string' ? el.className : '', fg: s.color, bg: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`, cr: +cr.toFixed(2), size }); }
  }
  return { targets, issues };
};

async function run(scheme) {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['Pixel 7'], colorScheme: scheme, geolocation: { latitude: 62.39, longitude: 17.306, accuracy: 6 }, permissions: ['geolocation'] });
  const page = await ctx.newPage();
  const res = {};
  const take = async name => { res[name] = await page.evaluate(probe); };
  await page.goto('http://localhost:8080/'); await page.waitForSelector('nav.tabs'); await page.waitForTimeout(1000);
  await take('start');
  await page.click('nav.tabs button[data-view=more]'); await page.waitForTimeout(300); await take('mer');
  await page.click('#btn-dl'); await page.waitForSelector('text=AI-modell och artdatabas finns på enheten', { timeout: 300000 });
  await page.click('nav.tabs button[data-view=objects]');
  await page.click('#btn-newobj'); await page.fill('.title-input', 'Obj 1');
  for (const [la, lo] of [[62.390, 17.306], [62.3906, 17.306], [62.3906, 17.3075]]) { await ctx.setGeolocation({ latitude: la, longitude: lo, accuracy: 6 }); await page.waitForTimeout(1100); await page.click('#ob-add'); }
  await take('objekt_redigera');
  await page.click('#ob-tabs button[data-t=beskr]'); await take('objekt_beskriv');
  await page.click('#ob-tabs button[data-t=bedom]'); await take('objekt_bedom');
  await page.click('#ob-checklist'); await page.waitForSelector('.cl-item');
  await page.click('.cl-item'); await page.waitForTimeout(300);
  await take('checklista');
  await page.click('.cl-item.on'); await page.waitForTimeout(300); await take('registrering');
  await page.click('.modal-bg.sub .modal-close'); await page.waitForTimeout(200); await page.click('.modal-close');
  await page.waitForTimeout(5200);
  await page.click('nav.tabs button[data-view=objects]'); await take('objektlista');
  await page.click('nav.tabs button[data-view=id]'); await page.click('.chip[data-g=lav]');
  await take('falt');
  await page.setInputFiles('#cam', E2E + 'Lobaria_pulmonaria.jpg');
  await page.waitForSelector('ol.results', { timeout: 60000 }); await page.waitForTimeout(600); await take('resultat');
  await page.click('.thumb img'); await page.waitForTimeout(400); await take('beskar'); await page.click('#crop-ok');
  await page.waitForSelector('ol.results', { timeout: 60000 });
  await page.click('ol.results li.first'); await page.waitForTimeout(300); await take('spara');
  const formH = await page.$eval('.modal', m => ({ scroll: m.scrollHeight, client: m.clientHeight }));
  res.formH = formH;
  await page.click('#sv-save'); await page.waitForTimeout(400);
  await page.click('nav.tabs button[data-view=obs]'); await page.waitForTimeout(300); await take('fyndlista');
  await page.click('nav.tabs button[data-view=id]'); await page.click('#btn-known'); await page.fill('#sp-q', 'tjä'); await page.waitForTimeout(200); await take('artsok');
  await page.click('#sp-list li[data-id]'); await page.waitForTimeout(200); await take('spara_fagel');
  await page.click('#sv-save'); await page.waitForTimeout(300);
  await page.click('nav.tabs button[data-view=obs]'); await page.waitForTimeout(200);
  await page.click('#view-obs .obs'); await page.waitForTimeout(300); await take('fynddetalj'); await page.click('.modal-close');
  await page.click('nav.tabs button[data-view=map]'); await page.waitForTimeout(300); await take('karta');
  // fokusindikator och tangentbord
  res.focus = await page.evaluate(() => { const b = document.querySelector('nav.tabs button'); b.focus(); const s = getComputedStyle(b); return { outline: s.outlineStyle + ' ' + s.outlineWidth, ariaCurrent: b.getAttribute('aria-current'), ariaSelected: b.getAttribute('aria-selected') }; });
  await b.close();
  return res;
}
(async () => {
  const all = {};
  for (const s of ['light', 'dark']) all[s] = await run(s);
  require('fs').writeFileSync(OUT + 'raw.json', JSON.stringify(all, null, 1));
  // sammanfattning
  for (const s of ['light']) {
    const uniq = new Map();
    for (const [view, r] of Object.entries(all[s])) { if (!r.targets) continue; for (const t of r.targets) { const min = Math.min(t.w, t.h); const k = view + '|' + t.cls + '|' + t.label; if (!uniq.has(k)) uniq.set(k, { view, ...t, min }); } }
    const u = [...uniq.values()];
    console.log('Unika tryckytor (vy+klass+etikett):', u.length, '<44:', u.filter(t => t.min < 44).length, '<48:', u.filter(t => t.min < 48).length);
    const byCls = {};
    for (const t of u.filter(t => t.min < 48)) { const k = t.tag + '.' + t.cls.split(' ').slice(0, 3).join('.'); (byCls[k] ||= { n: 0, ex: new Set(), sizes: new Set(), views: new Set() }); byCls[k].n++; byCls[k].ex.add(t.label); byCls[k].sizes.add(t.w + 'x' + t.h); byCls[k].views.add(t.view); }
    for (const [k, v] of Object.entries(byCls).sort((a, b) => b[1].n - a[1].n)) console.log(k, v.n, [...v.views].join(','), '|', [...v.sizes].slice(0, 6).join(' '), '|', [...v.ex].slice(0, 5).join(' / '));
  }
  for (const s of ['light', 'dark']) {
    console.log('\n== Kontrast', s);
    const seen = new Set();
    for (const [view, r] of Object.entries(all[s])) { if (!r.issues) continue; for (const i of r.issues) { const k = i.cls + i.fg + i.bg; if (seen.has(k)) continue; seen.add(k); console.log(view, '|', i.text, '|', i.cls, '|', i.fg, 'på', i.bg, '|', i.cr, '|', i.size + 'px'); } }
  }
  console.log('\nformH', JSON.stringify(all.light.formH), 'focus', JSON.stringify(all.light.focus));
})();

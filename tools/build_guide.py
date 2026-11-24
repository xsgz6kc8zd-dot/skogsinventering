"""Bygger fältguiden: app/data/guide.json och app/data/guide/<id>.jpg

För varje art i skogsurvalet (sel=1) som är signalart, E-art eller rödlistad (ej RE):
  * ett fältfoto från Sverige med fri licens (CC0/CC BY) via GBIF, med fotograf och licens
  * antal fynd i Sverige och vilka månader arten oftast rapporteras (GBIF, mest Artportalen)
  * förväxlingsarter: andra arter i samma släkte i databasen
  * kort beskrivning från svenska Wikipedia (CC BY-SA 4.0) om den går att hämta

Allt mellanlagras i tools/cache/guide/ så att skriptet kan köras om (t.ex. när Wikipedia
inte begränsar anropen) utan att hämta allt igen.

    python3 tools/build_guide.py [--no-wiki] [--no-img]
"""
import io, json, os, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, 'tools', 'cache', 'guide')
OUT_JSON = os.path.join(ROOT, 'app', 'data', 'guide.json')
OUT_IMG = os.path.join(ROOT, 'app', 'data', 'guide')
UA = 'skogsinventering-build/1.0 (https://github.com/xsgz6kc8zd-dot/skogsinventering)'
os.makedirs(CACHE, exist_ok=True); os.makedirs(OUT_IMG, exist_ok=True)


def get(url, binary=False, tries=4):
    for k in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=40) as r:
                b = r.read()
                return b if binary else json.loads(b.decode('utf-8'))
        except Exception as e:  # noqa: BLE001
            if k == tries - 1:
                raise
            time.sleep(2 + 4 * k)


def cached(name, fn):
    p = os.path.join(CACHE, name)
    if os.path.exists(p):
        return json.load(open(p))
    v = fn()
    json.dump(v, open(p, 'w'))
    return v


def gbif_facts(sp):
    def fetch():
        m = get('https://api.gbif.org/v1/species/match?' + urllib.parse.urlencode({'name': sp['sci'], 'strict': 'true'}))
        key = m.get('usageKey') if m.get('matchType') in ('EXACT', 'FUZZY') else None
        if not key:
            return {'key': None}
        if m.get('acceptedUsageKey'):
            key = m['acceptedUsageKey']
        f = get(f'https://api.gbif.org/v1/occurrence/search?taxonKey={key}&country=SE&limit=0&facet=month&facetLimit=12')
        months = [0] * 12
        for c in (f.get('facets') or [{}])[0].get('counts', []):
            months[int(c['name']) - 1] = c['count']
        media = []
        for lic in ('CC0_1_0', 'CC_BY_4_0'):
            r = get(f'https://api.gbif.org/v1/occurrence/search?taxonKey={key}&country=SE&mediaType=StillImage&license={lic}&limit=8')
            for o in r.get('results', []):
                for mm in o.get('media', []):
                    if mm.get('type') == 'StillImage' and mm.get('identifier'):
                        media.append({'url': mm['identifier'], 'by': mm.get('rightsHolder') or mm.get('creator') or o.get('recordedBy') or '',
                                      'lic': 'CC0' if lic == 'CC0_1_0' else 'CC BY 4.0', 'src': f"https://www.gbif.org/occurrence/{o['key']}"})
                        break
            if len(media) >= 3:
                break
        return {'key': key, 'n': f.get('count', 0), 'months': months, 'media': media[:4]}
    return cached(f"gbif_{sp['id']}.json", fetch)


def save_image(sp, media):
    from PIL import Image
    dst = os.path.join(OUT_IMG, f"{sp['id']}.jpg")
    meta = os.path.join(CACHE, f"img_{sp['id']}.json")
    if os.path.exists(dst):
        return json.load(open(meta)) if os.path.exists(meta) else None
    for m in media:
        try:
            b = get(m['url'], binary=True, tries=1)
            im = Image.open(io.BytesIO(b)).convert('RGB')
            im.thumbnail((420, 420))
            im.save(dst, 'JPEG', quality=68, optimize=True, progressive=True)
            json.dump(m, open(meta, 'w'))
            return m
        except Exception:  # noqa: BLE001
            continue
    return None


def wiki(batch):
    """Hämtar inledningen ur svenska Wikipedia för upp till 20 vetenskapliga namn."""
    q = urllib.parse.urlencode({'action': 'query', 'format': 'json', 'prop': 'extracts|info', 'inprop': 'url', 'exintro': 1,
                                'explaintext': 1, 'exlimit': 20, 'redirects': 1, 'titles': '|'.join(s['sci'] for s in batch)})
    r = get('https://sv.wikipedia.org/w/api.php?' + q, tries=2)
    norm = {n['to']: n['from'] for n in r.get('query', {}).get('normalized', [])}
    redir = {}
    for d in r.get('query', {}).get('redirects', []):
        redir[d['to']] = norm.get(d['from'], d['from'])
    out = {}
    for p in r.get('query', {}).get('pages', {}).values():
        if 'missing' in p or not p.get('extract'):
            continue
        src = redir.get(p['title'], norm.get(p['title'], p['title']))
        txt = p['extract'].strip()
        if 'kan syfta på' in txt[:200] or len(txt) < 40:
            continue
        if len(txt) > 700:  # korta vid meningsslut
            cut = txt[:700].rfind('. ')
            txt = txt[:cut + 1] if cut > 200 else txt[:700] + ' …'
        out[src] = {'t': txt, 'url': p.get('fullurl', ''), 'title': p['title']}
    return out


def main():
    species = json.load(open(os.path.join(ROOT, 'app', 'data', 'species.json')))
    target = [s for s in species if s.get('sel') and not s.get('syn') and (s.get('sig') or (s.get('rl') and s['rl'] != 'RE'))]
    print(len(target), 'arter i fältguiden')
    by_genus = {}
    for s in species:
        if not s.get('syn') and s.get('tax'):
            by_genus.setdefault(s['tax'][-1], []).append(s)
    guide = {}
    from concurrent.futures import ThreadPoolExecutor
    def facts(sp):
        try:
            g = gbif_facts(sp)
            return g, (save_image(sp, g['media']) if g.get('key') else None)
        except Exception as ex:  # noqa: BLE001
            print('GBIF-fel', sp['sci'], str(ex)[:80]); return {}, None
    pre = {}
    if '--no-img' not in sys.argv:
        with ThreadPoolExecutor(8) as ex:
            for k, (sp, r) in enumerate(zip(target, ex.map(facts, target))):
                pre[sp['id']] = r
                if k % 50 == 0:
                    print(k, sp['sci']); sys.stdout.flush()
    for i, sp in enumerate(target):
        e = {}
        if sp['id'] in pre:
            g, m = pre[sp['id']]
            if g.get('key'):
                e['n'] = g['n']; e['m'] = g['months']; e['gbif'] = g['key']
                if m:
                    e['img'] = {'by': m['by'][:80], 'lic': m['lic'], 'src': m['src']}
        sib = [x for x in by_genus.get(sp['tax'][-1] if sp.get('tax') else '', []) if x['id'] != sp['id']]
        sib.sort(key=lambda x: (-x.get('sel', 0), not (x.get('sig') or x.get('rl')), x.get('sv') or x['sci']))
        if sib:
            e['lik'] = [x['id'] for x in sib[:5]]
        guide[sp['id']] = e
    if '--no-wiki' not in sys.argv:
        wcache = os.path.join(CACHE, 'wiki.json')
        wc = json.load(open(wcache)) if os.path.exists(wcache) else {}
        todo = [s for s in target if s['sci'] not in wc]
        for k in range(0, len(todo), 20):
            batch = todo[k:k + 20]
            try:
                got = wiki(batch)
            except Exception as ex:  # noqa: BLE001
                print('Wikipedia gick inte att nå:', str(ex)[:80], '– fortsätter utan'); break
            for s in batch:
                wc[s['sci']] = got.get(s['sci'])
            json.dump(wc, open(wcache, 'w'), ensure_ascii=False)
            time.sleep(1.5)
        for s in target:
            w = wc.get(s['sci'])
            if w:
                guide[s['id']]['wiki'] = w
    json.dump(guide, open(OUT_JSON, 'w'), ensure_ascii=False, separators=(',', ':'))
    n_img = sum(1 for e in guide.values() if e.get('img')); n_w = sum(1 for e in guide.values() if e.get('wiki'))
    size = sum(os.path.getsize(os.path.join(OUT_IMG, f)) for f in os.listdir(OUT_IMG) if f.endswith('.jpg'))
    print(f'Klart: {len(guide)} arter, {n_img} bilder ({size / 1e6:.1f} MB), {n_w} Wikipedia-texter')


if __name__ == '__main__':
    main()

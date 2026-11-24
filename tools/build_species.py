#!/usr/bin/env python3
"""Bygger artdatabasen (app/data/species.json).

Källor (öppna data via GBIF:s API):
  * Rödlistan 2025, SLU Artdatabanken (CC0)      dataset 87e639cc-30a9-4007-bd2c-b0cab60326b9
  * Dyntaxa, svensk taxonomisk databas (CC0)      dataset de8934f4-a136-481c-a87a-b0b202b80a31
  * GBIF Backbone Taxonomy (engelska namn + klassificering för AI-modellens textbeskrivningar)
  * Skogsstyrelsens signalarter, version 2023-1 (tools/signalarter_2023_1.csv, se fetch_signalarter.py)
  * SLU Artdatabankens nationellt skyddsklassade arter (tools/skyddsklassade_arter.csv, se fetch_skyddsklass.py)

Användning:
  python3 tools/fetch_redlist.py            # hämtar tools/cache/redlist2025.json
  python3 tools/fetch_signalarter.py        # hämtar tools/signalarter_2023_1.csv
  python3 tools/build_species.py            # skriver app/data/species.json
"""
import csv, json, os, re, subprocess, sys, urllib.parse
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache")
OUT = os.path.join(HERE, "..", "app", "data", "species.json")
DYNTAXA = "de8934f4-a136-481c-a87a-b0b202b80a31"
API = "https://api.gbif.org/v1"

RL_CODE = {"REGIONALLY_EXTINCT": "RE", "CRITICALLY_ENDANGERED": "CR", "ENDANGERED": "EN",
           "VULNERABLE": "VU", "NEAR_THREATENED": "NT", "DATA_DEFICIENT": "DD"}
LICHEN_CLASSES = {"Lecanoromycetes", "Arthoniomycetes", "Lichinomycetes", "Coniocybomycetes",
                  "Candelariomycetes"}
LICHEN_ORDERS = {"Verrucariales", "Pyrenulales"}
SKS_GROUP = {"Insekter": "insekt", "Kärlväxter": "karlvaxt", "Mossor": "mossa", "Lavar": "lav", "Svampar": "svamp"}
EXCLUDED_PHYLA = {"Rhodophyta", "Chlorophyta", "Charophyta", "Ochrophyta", "Gyrista", "Cyanobacteria"}


def get(path, **params):
    os.makedirs(os.path.join(CACHE, "http"), exist_ok=True)
    url = f"{API}/{path}?{urllib.parse.urlencode(params)}"
    key = os.path.join(CACHE, "http", urllib.parse.quote(url, safe="")[-200:] + ".json")
    if os.path.exists(key):
        return json.load(open(key))
    for _ in range(4):
        r = subprocess.run(["curl", "-s", "-m", "60", url], capture_output=True, text=True)
        try:
            data = json.loads(r.stdout)
            json.dump(data, open(key, "w"))
            return data
        except Exception:
            continue
    raise RuntimeError(f"misslyckades: {url}")


def pick_name(names, ascii_only=True):
    """Väljer det vanligaste rimliga namnet (källor i GBIF innehåller koder och felstavningar)."""
    from collections import Counter
    ok = [n.strip() for n in names if len(n.strip()) > 3 and not n.isupper()
          and (not ascii_only or n.isascii()) and not re.search(r"[0-9.;]", n)]
    if not ok:
        return ""
    c = Counter(n.lower() for n in ok)
    best = c.most_common(1)[0][0]
    return next(n for n in ok if n.lower() == best)


def group_for(rec):
    if rec.get("phylum") in ("Bryophyta", "Marchantiophyta", "Anthocerotophyta"):
        return "mossa"
    if rec.get("phylum") == "Tracheophyta":
        return "karlvaxt"
    if rec.get("kingdom") == "Fungi":
        if rec.get("cls") in LICHEN_CLASSES or rec.get("order") in LICHEN_ORDERS:
            return "lav"
        return "svamp"
    if rec.get("cls") == "Aves":
        return "fagel"
    return None


def resolve(row):
    grp, sci, sig, sv_override = row
    m = get("species/match", name=sci, strict="true")
    if m.get("matchType") == "NONE":
        m = get("species/match", name=sci)
    tax = [m.get(k, "") for k in ("kingdom", "phylum", "class", "order", "family", "genus")]
    en, sv_backbone = "", ""
    key = m.get("speciesKey") or m.get("usageKey")
    if key:
        vn = get(f"species/{key}/vernacularNames", limit=300).get("results", [])
        en = pick_name([v["vernacularName"] for v in vn if v.get("language") == "eng"])
        sv_backbone = pick_name([v["vernacularName"] for v in vn if v.get("language") == "swe"],
                                ascii_only=False).lower()
    # Svenskt namn + accepterat namn från Dyntaxa
    sv, dyn, accepted, dyntaxa_tax = "", "", sci, None
    d = get("species", datasetKey=DYNTAXA, name=sci).get("results", [])
    d = [x for x in d if x.get("rank") == "SPECIES"] or d
    d.sort(key=lambda x: x.get("taxonomicStatus") != "ACCEPTED")  # accepterat namn först
    if d:
        rec = d[0]
        is_syn = rec.get("synonym") or "SYNONYM" in str(rec.get("taxonomicStatus", ""))
        if is_syn and rec.get("acceptedKey"):
            rec = get(f"species/{rec['acceptedKey']}")
        accepted = rec.get("canonicalName", sci)
        dyntaxa_tax = [rec.get(k, "") for k in ("kingdom", "phylum", "class", "order", "family", "genus")]
        dyn = rec.get("taxonID", "")
        vn = get(f"species/{rec['key']}/vernacularNames").get("results", [])
        swe = [v for v in vn if v.get("language") == "swe"]
        swe.sort(key=lambda v: not v.get("preferred"))
        sv = swe[0]["vernacularName"] if swe else ""
    if not tax[5]:
        tax = dyntaxa_tax or tax
    tax[5] = accepted.split()[0]
    return dict(sci=accepted, input=sci, sv=sv_override or sv or sv_backbone, grp=grp, sig=sig, tax=tax, en=en, dyntaxa=dyn,
                match=m.get("matchType"), sel=1)


def main():
    rows = []
    for line in open(os.path.join(HERE, "species_input.csv"), encoding="utf-8"):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        g, s, *sv = line.split(";")
        rows.append((g, s.strip(), False, sv[0].strip() if sv else ""))
    # Skogsstyrelsens signalarter (S/E), matchas på Dyntaxas taxon-ID
    sks = [r for r in csv.DictReader(open(os.path.join(HERE, "signalarter_2023_1.csv"), encoding="utf-8"), delimiter=";")
           if r["sci"]]
    sig_by_tid = {int(r["taxon_id"]): r for r in sks}
    sig_by_name = {r["sci"]: r for r in sks}
    have = {r[1] for r in rows}
    for r in sks:  # alla officiella signalarter ingår i skogsurvalet
        if r["sci"] not in have:
            rows.append((SKS_GROUP[r["grupp"]], r["sci"], False, ""))
    with ThreadPoolExecutor(8) as ex:
        curated = list(ex.map(resolve, rows))
    for c in curated:
        m = re.search(r"dyntaxa\.se:Taxon:(\d+)$", c["dyntaxa"] or "")
        r = sig_by_tid.get(int(m.group(1))) if m else None
        r = r or sig_by_name.get(c["sci"]) or sig_by_name.get(c["input"])
        c["sig"] = r["typ"] if r else ""
        if r:
            old = [x.strip() for x in r["pdf_text"].split("|")][-1]
            valid_old = old and old != "-" and not re.search(r"[A-Z]", old)
            if not c["sv"]:
                c["sv"] = r["sv"] or (old if valid_old else "")
            elif valid_old and old != c["sv"]:
                c["alt"] = old  # Skogsstyrelsens namn 2019–2023, används som sökord

    redlist = json.load(open(os.path.join(CACHE, "redlist2025.json"), encoding="utf-8"))
    rl_by_name = {r["sci"]: r for r in redlist}

    species, seen = [], set()
    for c in curated:
        r = rl_by_name.get(c["sci"]) or rl_by_name.get(c["input"])
        c["rl"] = RL_CODE.get(r["status"], "") if r else ""
        if r and not c["sv"]:
            c["sv"] = r["sv"]
        if c["match"] == "NONE":
            print("Hittade inte:", c["input"], file=sys.stderr)
        if c["sci"] in seen:
            continue
        seen.add(c["sci"])
        species.append(c)

    # Utökad lista: alla rödlistade växter, svampar, lavar och fåglar
    for r in redlist:
        if r["sci"] in seen or r.get("phylum") in EXCLUDED_PHYLA:
            continue
        g = group_for(r)
        if not g:
            continue
        seen.add(r["sci"])
        species.append(dict(sci=r["sci"], sv=r["sv"], grp=g, sig="", rl=RL_CODE[r["status"]],
                            tax=[r.get(k) or "" for k in ("kingdom", "phylum", "cls", "order", "family", "genus")],
                            en="", dyntaxa=r.get("dyntaxa", ""), sel=0))

    # Skyddsklassade arter (Artdatabanken): generaliseringsnivå i km, häckningsvillkor för fåglar, regionala undantag
    sk_rows = list(csv.DictReader(open(os.path.join(HERE, "skyddsklassade_arter.csv"), encoding="utf-8"), delimiter=";"))
    sk_by_tid = {int(r["taxon_id"]): r for r in sk_rows}
    sk_by_name = {r["sci"]: r for r in sk_rows}
    SK_GROUP = {"Aves": "fagel", "Insecta": "insekt", "Liliopsida": "karlvaxt", "Magnoliopsida": "karlvaxt",
                "Polypodiopsida": "karlvaxt", "Psilotopsida": "karlvaxt", "Agaricomycetes": "svamp", "Pezizomycetes": "svamp",
                "Lecanoromycetes": "lav", "Eurotiomycetes": "lav"}
    seen_tid = set()
    for sp in species:
        m = re.search(r"dyntaxa\.se:Taxon:(\d+)$", sp.get("dyntaxa") or "")
        r = (sk_by_tid.get(int(m.group(1))) if m else None) or sk_by_name.get(sp["sci"])
        if m: seen_tid.add(int(m.group(1)))
        if r:
            sp["sk"] = int(r["km"])
            if r["endast_hackning"] == "True": sp["skH"] = 1
            if r["regional"] == "True" or r["begransning"]: sp["skR"] = r["begransning"]
    for r in sk_rows:  # skyddsklassade arter som saknas läggs till i den utökade listan
        g = SK_GROUP.get(r["klass_class"])
        if not g or r["rank"] != "species" or int(r["taxon_id"]) in seen_tid or r["sci"] in seen:
            continue
        seen.add(r["sci"])
        rec = get("species", datasetKey=DYNTAXA, sourceId=f"urn:lsid:dyntaxa.se:Taxon:{r['taxon_id']}").get("results", [{}])
        rec = rec[0] if rec else {}
        sp = dict(sci=r["sci"], sv=r["sv"], grp=g, sig="", rl="", en="", dyntaxa=f"urn:lsid:dyntaxa.se:Taxon:{r['taxon_id']}", sel=0,
                  tax=[rec.get(k, "") for k in ("kingdom", "phylum", "class", "order", "family")] + [r["sci"].split()[0]], sk=int(r["km"]))
        if r["endast_hackning"] == "True": sp["skH"] = 1
        if r["regional"] == "True" or r["begransning"]: sp["skR"] = r["begransning"]
        species.append(sp)

    for i, s in enumerate(species):
        s["id"] = i
        s.pop("input", None)
        s.pop("match", None)
    json.dump(species, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    from collections import Counter
    print(len(species), "arter;", sum(s["sel"] for s in species), "i skogsurvalet;", sum(1 for s in species if s.get("sk")), "skyddsklassade")
    print(Counter((s["grp"], s["sel"]) for s in species))


if __name__ == "__main__":
    main()

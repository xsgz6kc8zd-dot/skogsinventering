#!/usr/bin/env python3
"""Importerar Skogsstyrelsens officiella signalartslista (version 2023-1) maskinellt.

Källa: Skogsstyrelsen 2023. Komplett förteckning över Skogsstyrelsens signalarter, version 2023-1.
https://www.skogsstyrelsen.se/globalassets/miljo-och-klimat/nyckelbitoper/skogsstyrelsens-signalarter---version2023-1.pdf

Listan innehåller S-arter (signalarter) och E-arter (ekologiska ståndortsindikatorer). Rödlistade arter
ingår INTE i listan (de är naturvårdsarter via rödlistan). Varje rad har Dyntaxas taxon-ID, som används
för exakt matchning. Namn och klassificering hämtas från Dyntaxa via GBIF.

  python3 tools/fetch_signalarter.py    # -> tools/signalarter_2023_1.csv
Kräver pdftotext (poppler-utils).
"""
import csv, json, os, re, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache"); os.makedirs(CACHE, exist_ok=True)
URL = ("https://www.skogsstyrelsen.se/globalassets/miljo-och-klimat/nyckelbitoper/"
       "skogsstyrelsens-signalarter---version2023-1.pdf")
PDF = os.path.join(CACHE, "signalarter_2023_1.pdf")
OUT = os.path.join(HERE, "signalarter_2023_1.csv")
DYNTAXA = "de8934f4-a136-481c-a87a-b0b202b80a31"
# Skogsstyrelsens webbplats avvisar klienter utan webbläsaridentitet
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"


def curl(url, out=None):
    args = ["curl", "-sL", "-m", "120", "-A", UA, url] + (["-o", out] if out else [])
    return subprocess.run(args, capture_output=True, text=out is None, check=True).stdout


def parse(pdf):
    txt = subprocess.run(["pdftotext", "-layout", pdf, "-"], capture_output=True, text=True, check=True).stdout
    group, rows, seen = None, [], set()
    for line in txt.splitlines():
        m = re.search(r"Grupp (Insekter|Kärlväxter|Mossor|Lavar|Svampar)", line)
        if m:
            group = m.group(1); continue
        m = re.match(r"^\s*(\d+)\s+(.*?)\s+(S|E)\s+(\S+)\s*$", line)
        if m and group and int(m.group(1)) not in seen:
            seen.add(int(m.group(1)))
            rows.append(dict(taxon_id=int(m.group(1)), grupp=group, typ=m.group(3), rl2020=m.group(4),
                             pdf_text=re.sub(r"\s{2,}", " | ", m.group(2))))
    return rows


def dyntaxa(tid):
    path = os.path.join(CACHE, "http", f"dyntaxa_{tid}.json")
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        d = curl(f"https://api.gbif.org/v1/species?datasetKey={DYNTAXA}&sourceId=urn:lsid:dyntaxa.se:Taxon:{tid}")
        open(path, "w").write(d)
    res = json.load(open(path)).get("results", [])
    if not res:
        return {}
    r = res[0]
    vn_path = os.path.join(CACHE, "http", f"dyntaxa_vn_{tid}.json")
    if not os.path.exists(vn_path):
        open(vn_path, "w").write(curl(f"https://api.gbif.org/v1/species/{r['key']}/vernacularNames"))
    swe = [v for v in json.load(open(vn_path)).get("results", []) if v.get("language") == "swe"]
    swe.sort(key=lambda v: not v.get("preferred"))
    return dict(sci=r.get("canonicalName", ""), sv=swe[0]["vernacularName"] if swe else "",
                kingdom=r.get("kingdom", ""), phylum=r.get("phylum", ""), klass=r.get("class", ""),
                order=r.get("order", ""), family=r.get("family", ""), genus=r.get("genus", ""), rank=r.get("rank", ""))


if __name__ == "__main__":
    if not os.path.exists(PDF):
        curl(URL, PDF)
    rows = parse(PDF)
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(8) as ex:
        info = list(ex.map(lambda r: dyntaxa(r["taxon_id"]), rows))
    cols = ["taxon_id", "grupp", "typ", "rl2020", "sci", "sv", "rank", "kingdom", "phylum", "klass", "order", "family", "genus", "pdf_text"]
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, delimiter=";")
        w.writeheader()
        for r, i in zip(rows, info):
            w.writerow({**r, **i})
    missing = [r["taxon_id"] for r, i in zip(rows, info) if not i]
    print(f"{len(rows)} arter ({sum(r['typ'] == 'S' for r in rows)} S, {sum(r['typ'] == 'E' for r in rows)} E); "
          f"saknas i Dyntaxa/GBIF: {missing}")

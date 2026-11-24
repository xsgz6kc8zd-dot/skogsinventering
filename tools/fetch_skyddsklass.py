#!/usr/bin/env python3
"""Importerar SLU Artdatabankens lista över nationellt skyddsklassade arter.

Källor:
  * "List of Restricted Access Species In Sweden" (SLU Artdatabanken, CC0), Darwin Core-arkiv via GBIF Sverige:
    https://www.gbif.se/ipt/archive.do?r=sensitivespecies  -> Dyntaxa taxon-ID + generaliseringsnivå (5/25/50 km)
  * "Nationellt skyddsklassade arter" (SLU Artdatabanken 2023-06-12, uppdaterad 2024-04-25), PDF:
    https://www.slu.se/globalassets/artdatabanken/dokument/lista-nationellt-skyddsklassade-arter-20230612-uppdat-20240425.pdf
    -> skyddsklass (3/4/5) och artvisa begränsningar/tillägg (t.ex. "H" = gäller fynd som kan indikera häckning)

  python3 tools/fetch_skyddsklass.py   # -> tools/skyddsklassade_arter.csv
Kräver pdftotext (poppler-utils).
"""
import csv, io, os, re, subprocess, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache"); os.makedirs(CACHE, exist_ok=True)
DWCA = "https://www.gbif.se/ipt/archive.do?r=sensitivespecies"
PDF_URL = ("https://www.slu.se/globalassets/artdatabanken/dokument/"
           "lista-nationellt-skyddsklassade-arter-20230612-uppdat-20240425.pdf")
OUT = os.path.join(HERE, "skyddsklassade_arter.csv")
KM_TO_CLASS = {5: 3, 25: 4, 50: 5}


def fetch(url, path):
    if not os.path.exists(path):
        subprocess.run(["curl", "-sL", "-m", "120", "-o", path, url], check=True)
    return path


def parse_pdf(path):
    txt = subprocess.run(["pdftotext", "-layout", path, "-"], capture_output=True, text=True, check=True).stdout
    main = txt.split("Revideringar av skyddsklass")[0]
    rows, group = {}, ""
    for line in main.splitlines():
        if re.fullmatch(r"\s{20,}(Fåglar|Däggdjur|Groddjur|Kräldjur|Fiskar|Insekter|Spindeldjur|Blötdjur|Kärlväxter|Mossor|Lavar|Storsvampar|[A-ZÅÄÖ][a-zåäö]+)\s*", line):
            group = line.strip(); continue
        m = re.match(r"^(?P<sci>[A-Z][\w.×-]*(?: [\w.×-]+)*)\s{2,}(?P<mid>.*?)\s+(?P<rl>\S+)\s+(?P<km>\d+) x \d+ km\s+[\d,]+\s*$", line)
        if not m:
            continue
        mid = m.group("mid")
        c = re.search(r"(?:^|\s)(\d)(\*)?(?:/(\d))?(?:\s{2,}|\s*$)", mid)
        if not c:
            continue
        sv = mid[:c.start()].strip()
        note = mid[c.end():].strip()
        rows[m.group("sci")] = dict(klass=int(c.group(1)), regional=bool(c.group(3)), sv_pdf=sv,
                                    begransning=note, rl2020=m.group("rl"), grupp=group)
    return rows


if __name__ == "__main__":
    z = zipfile.ZipFile(fetch(DWCA, os.path.join(CACHE, "sensitivespecies_dwca.zip")))
    taxa = list(csv.DictReader(io.StringIO(z.read("taxon.txt").decode("utf-8")), delimiter="\t"))
    pdf = parse_pdf(fetch(PDF_URL, os.path.join(CACHE, "skyddsklassade_arter.pdf")))
    out = []
    for t in taxa:
        km = int(re.match(r"(\d+)", t["taxonRemarks"]).group(1))
        p = pdf.get(t["scientificName"], {})
        out.append(dict(taxon_id=int(t["taxonID"].rsplit(":", 1)[1]), sci=t["scientificName"], sv=t["vernacularName"],
                        rank=t["taxonRank"], klass=p.get("klass", KM_TO_CLASS.get(km, "")), km=km,
                        endast_hackning=t["class"] == "Aves" and p.get("begransning", "H").startswith("H"),
                        regional=p.get("regional", False), begransning=p.get("begransning", ""),
                        klass_class=t["class"], grupp=p.get("grupp", "")))
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(out[0].keys()), delimiter=";")
        w.writeheader(); w.writerows(out)
    matched = sum(1 for t in taxa if t["scientificName"] in pdf)
    print(f"{len(out)} taxa ({sum(o['km'] == 5 for o in out)} × 5 km, {sum(o['km'] == 25 for o in out)} × 25 km, "
          f"{sum(o['km'] == 50 for o in out)} × 50 km); {matched} med begränsningstext från PDF:en; {len(pdf)} rader i PDF:en")

#!/usr/bin/env python3
"""Hämtar Rödlistan 2025 (SLU Artdatabanken, CC0) från GBIF -> tools/cache/redlist2025.json.
Hämtar per rike/klass (växter, svampar inkl. lavar, fåglar) för att undvika djup paginering."""
import json, os, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache"); os.makedirs(CACHE, exist_ok=True)
DATASET = "87e639cc-30a9-4007-bd2c-b0cab60326b9"
HIGHER = {"Plantae": 320316269, "Fungi": 320316264, "Aves": 320317087}
out = {}
for name, key in HIGHER.items():
    off = 0
    while True:
        url = (f"https://api.gbif.org/v1/species/search?datasetKey={DATASET}"
               f"&highertaxon_key={key}&limit=1000&offset={off}")
        d = json.loads(subprocess.run(["curl", "-s", "-m", "120", "--retry", "3", url],
                                      capture_output=True, text=True).stdout)
        for r in d["results"]:
            if not r.get("threatStatuses") or r.get("rank") != "SPECIES":
                continue
            sv = [v["vernacularName"] for v in r.get("vernacularNames", []) if v.get("language") == "swe"]
            out[r["canonicalName"]] = dict(sci=r["canonicalName"], status=r["threatStatuses"][0],
                sv=sv[0] if sv else "", kingdom=r.get("kingdom"), phylum=r.get("phylum"), cls=r.get("class"),
                order=r.get("order"), family=r.get("family"), genus=r.get("genus"), dyntaxa=r.get("taxonID"))
        print(name, off, len(out))
        off += 1000
        if d.get("endOfRecords") or not d["results"]:
            break
json.dump(list(out.values()), open(os.path.join(CACHE, "redlist2025.json"), "w"), ensure_ascii=False)

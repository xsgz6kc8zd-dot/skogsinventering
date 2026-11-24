#!/usr/bin/env python3
"""Lägger till de syntetiska posterna (obestämd per grupp + anteckning) i en befintlig species.json/text_emb.bin
utan att bygga om hela databasen. build_species.py + build_embeddings.py gör samma sak vid full ombyggnad."""
import json, os, sys, numpy as np, torch, open_clip
sys.path.insert(0, os.path.dirname(__file__))
from build_species import SYNTHETIC
from build_embeddings import TEMPLATES, class_text
from export_model import load_model
APP = os.path.join(os.path.dirname(__file__), "..", "app", "data")
sp = json.load(open(os.path.join(APP, "species.json"), encoding="utf-8"))
emb = np.fromfile(os.path.join(APP, "text_emb.bin"), dtype=np.float16).reshape(len(sp), -1)
if any(s.get("syn") for s in sp): sys.exit("redan tillagda")
new = []
for g, sci, sv, tax in SYNTHETIC:
    new.append(dict(sci=sci, sv=sv, grp=g, sig="", rl="", en="", dyntaxa="", sel=0, tax=tax, syn="note" if g == "punkt" else "indet", id=len(sp) + len(new)))
m = load_model(); tok = open_clip.get_tokenizer("ViT-B-16")
with torch.no_grad():
    f = m.encode_text(tok([t.format(class_text(s)) for s in new for t in TEMPLATES])).float()
    f = f / f.norm(dim=-1, keepdim=True); f = f.reshape(len(new), len(TEMPLATES), -1).mean(1); f = f / f.norm(dim=-1, keepdim=True)
json.dump(sp + new, open(os.path.join(APP, "species.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
np.concatenate([emb, f.numpy().astype(np.float16)]).tofile(os.path.join(APP, "text_emb.bin"))
print(len(sp) + len(new), "arter")

#!/usr/bin/env python3
"""Utvärderar artigenkänningen på färska svenska fältfoton från GBIF (2024-2025),
dvs. bilder som BioCLIP inte kan ha tränats på. Kör exakt samma int8-modell och
samma förbehandling som appen.

  python3 tools/evaluate.py [antal_arter_per_grupp=10] [bilder_per_art=2]
"""
import hashlib, io, json, os, random, subprocess, sys
import numpy as np, onnxruntime as ort
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, "..", "app")
IMG = os.path.join(HERE, "cache", "eval_images")
MEAN = np.array([0.48145466, 0.4578275, 0.40821073], dtype=np.float32)
STD = np.array([0.26862954, 0.26130258, 0.27577711], dtype=np.float32)


def preprocess(im):
    """Samma som appen: kortaste sidan -> 224, centrerad 224x224-beskärning."""
    im = im.convert("RGB")
    w, h = im.size
    s = 224 / min(w, h)
    im = im.resize((max(224, round(w * s)), max(224, round(h * s))), Image.BILINEAR)
    w, h = im.size
    l, t = (w - 224) // 2, (h - 224) // 2
    a = (np.asarray(im.crop((l, t, l + 224, t + 224)), dtype=np.float32) / 255 - MEAN) / STD
    return a.transpose(2, 0, 1)[None]


def curl_json(url):
    import time
    for attempt in range(4):
        out = subprocess.run(["curl", "-s", "-m", "60", url], capture_output=True, text=True).stdout
        try:
            return json.loads(out)
        except json.JSONDecodeError:
            time.sleep(3 * (attempt + 1))
    return {}


def fetch_images(sci, n):
    os.makedirs(IMG, exist_ok=True)
    q = sci.replace(" ", "%20")
    d = curl_json(f"https://api.gbif.org/v1/occurrence/search?scientificName={q}&mediaType=StillImage"
                  f"&country=SE&year=2024,2025&limit=20")
    out = []
    for r in d.get("results", []):
        if r.get("species") != sci and r.get("acceptedScientificName", "").split(" ")[:2] != sci.split():
            continue
        media = [m for m in r.get("media", []) if m.get("identifier")]
        if not media:
            continue
        ident = media[0]["identifier"]
        path = os.path.join(IMG, f"{r['key']}.jpg")
        if not os.path.exists(path):
            md5 = hashlib.md5(ident.encode()).hexdigest()
            url = f"https://api.gbif.org/v1/image/cache/occurrence/{r['key']}/media/{md5}"
            subprocess.run(["curl", "-s", "-m", "60", "-o", path, url])
        try:
            Image.open(path).verify()
            out.append(path)
        except Exception:
            os.path.exists(path) and os.remove(path)
        if len(out) >= n:
            break
    return out


def main():
    per_group = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    per_species = int(sys.argv[2]) if len(sys.argv) > 2 else 2
    species = json.load(open(os.path.join(APP, "data", "species.json"), encoding="utf-8"))
    emb = np.fromfile(os.path.join(APP, "data", "text_emb.bin"), dtype=np.float16).astype(np.float32)
    emb = emb.reshape(len(species), -1)
    sess = ort.InferenceSession(os.path.join(APP, "model", "bioclip_visual_int8.onnx"))
    sel = np.array([s["sel"] == 1 for s in species])
    grp = np.array([s["grp"] for s in species])
    random.seed(0)
    groups = [g for g in sorted(set(grp[sel])) if not os.environ.get("GROUPS") or g in os.environ["GROUPS"].split(",")]
    stats = {}
    records = []  # (true_id, embedding) för kalibrering
    for g in groups:
        cands = [s for s in species if s["sel"] and s["grp"] == g]
        for s in random.sample(cands, min(per_group, len(cands))):
            for path in fetch_images(s["sci"], per_species):
                x = sess.run(None, {"pixel_values": preprocess(Image.open(path))})[0][0]
                records.append((s["id"], x))
                sims = emb @ x * 55  # samma kalibrerade skala som appen
                for mode, mask in [("grupp", sel & (grp == g)), ("skogsurval", sel), ("utökad", np.ones_like(sel))]:
                    idx = np.where(mask)[0]
                    p = np.exp(sims[idx] - sims[idx].max()); p /= p.sum()
                    order = idx[np.argsort(-p)]
                    rank = list(order).index(s["id"])
                    st = stats.setdefault((g, mode), [0, 0, 0])
                    st[0] += 1; st[1] += rank == 0; st[2] += rank < 5
                    if mode == "grupp":
                        top = p[np.argsort(-p)][0]
                        best = species[order[0]]
                        print(f"{g:9s} {s['sci']:32s} -> {best['sci']:32s} {top*100:5.1f}%  rank {rank+1}")
    np.savez(os.path.join(HERE, "cache", "eval_results.npz"), ids=np.array([r[0] for r in records]),
             emb=np.stack([r[1] for r in records]))
    print("\nTräffsäkerhet (topp-1 / topp-5):")
    for (g, mode), (n, t1, t5) in sorted(stats.items()):
        print(f"  {g:9s} {mode:11s} n={n:3d}  topp-1 {t1/n*100:5.1f}%  topp-5 {t5/n*100:5.1f}%")


if __name__ == "__main__":
    main()

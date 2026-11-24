#!/usr/bin/env python3
"""Kalibrerar temperaturen (logit-skalan) så att procenten i appen motsvarar verklig träffsäkerhet.
Kör efter evaluate.py. Skriver förslag på LOGIT_SCALE och visar kalibreringstabell + likhetströsklar."""
import json, os, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, "..", "app")
species = json.load(open(os.path.join(APP, "data", "species.json"), encoding="utf-8"))
emb = np.fromfile(os.path.join(APP, "data", "text_emb.bin"), dtype=np.float16).astype(np.float32).reshape(len(species), -1)
r = np.load(os.path.join(HERE, "cache", "eval_results.npz"))
ids, X = r["ids"], r["emb"]
sel = np.array([s["sel"] == 1 for s in species]); grp = np.array([s["grp"] for s in species])

def run(scale, mode):
    nll, rows = 0, []
    for t, x in zip(ids, X):
        mask = sel & (grp == grp[t]) if mode == "grupp" else (sel if mode == "skogsurval" else np.ones_like(sel))
        idx = np.where(mask)[0]; z = emb[idx] @ x * scale
        p = np.exp(z - z.max()); p /= p.sum()
        j = int(np.where(idx == t)[0][0]); nll -= np.log(p[j] + 1e-12)
        rows.append((p.max(), idx[p.argmax()] == t, (emb[idx] @ x).max()))
    return nll / len(ids), rows

for mode in ["grupp", "skogsurval", "utökad"]:
    best = min(((run(s, mode)[0], s) for s in np.arange(20, 101, 2.5)))
    print(f"{mode:11s} bästa skala {best[1]:5.1f}  (NLL {best[0]:.3f}, vid 100: {run(100, mode)[0]:.3f})")

scale = min(((run(s, "grupp")[0], s) for s in np.arange(20, 101, 2.5)))[1]
for sc in (100, scale):
    _, rows = run(sc, "grupp")
    print(f"\nKalibrering vid skala {sc} (grupp-läge): visad sannolikhet -> faktisk träffandel")
    for lo, hi in [(0, .3), (.3, .5), (.5, .7), (.7, .9), (.9, 1.01)]:
        b = [ok for p, ok, _ in rows if lo <= p < hi]
        if b: print(f"  {lo*100:3.0f}-{min(hi,1)*100:3.0f} %: n={len(b):3d} träff {np.mean(b)*100:5.1f} %")
_, rows = run(scale, "grupp")
sims = np.array([m for _, _, m in rows]); oks = np.array([ok for _, ok, _ in rows])
print("\nMax-likhet: rätt", np.percentile(sims[oks], [5, 50]).round(3), " fel", np.percentile(sims[~oks], [5, 50]).round(3) if (~oks).any() else "")

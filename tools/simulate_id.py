#!/usr/bin/env python3
"""Monte Carlo-simulering av artbestämning i fält.

Varje simulering = en inventerare som fotar en art. Riktiga svenska fältfoton (2024-2025, från GBIF)
förvanskas slumpmässigt som i verkligheten (skakig hand, oskärpa, mörker/motljus, låg upplösning,
skymmande grenar, snett beskuret, regn/brus), och användaren beter sig realistiskt (väljer ibland fel
artgrupp eller "Allt", tar ibland två foton). Samma int8-modell, förbehandling och kalibrerade skala
som appen.

  python3 tools/simulate_id.py [antal=10000]
Kräver att tools/evaluate.py har körts (fotona cachas i tools/cache/eval_images).
"""
import json, os, random, sys, time
from collections import defaultdict
import numpy as np, onnxruntime as ort
from PIL import Image, ImageEnhance, ImageFilter, ImageDraw
import io
from evaluate import fetch_images, APP, HERE, MEAN, STD

LOGIT_SCALE = 55
LOW_SIM = 0.22
GROUPS = ["trad", "karlvaxt", "mossa", "lav", "svamp", "fagel", "insekt"]


def manifest(per_group=25, per_species=2):
    path = os.path.join(HERE, "cache", "eval_manifest.json")
    if os.path.exists(path):
        return json.load(open(path))
    species = json.load(open(os.path.join(APP, "data", "species.json"), encoding="utf-8"))
    random.seed(0)  # samma urval som evaluate.py
    out = []
    for g in sorted(set(s["grp"] for s in species if s["sel"])):
        cands = [s for s in species if s["sel"] and s["grp"] == g]
        for s in random.sample(cands, min(per_group, len(cands))):
            for p in fetch_images(s["sci"], per_species):
                out.append({"id": s["id"], "path": p})
    json.dump(out, open(path, "w"))
    return out


def degrade(im, rng, log):
    """Simulerar fältförhållanden. log samlar vilka störningar som användes."""
    im = im.convert("RGB")
    w, h = im.size
    # Inramning: användaren håller kameran olika nära och lite snett
    s = rng.uniform(0.45, 1.0) * min(w, h)
    if s < 0.7 * min(w, h): log.append("tight_crop")
    x = rng.uniform(0, w - s); y = rng.uniform(0, h - s)
    im = im.crop((int(x), int(y), int(x + s), int(y + s)))
    if rng.random() < 0.35:
        im = im.rotate(rng.uniform(-25, 25), resample=Image.BILINEAR, expand=False); log.append("rotation")
    if rng.random() < 0.35:
        im = im.filter(ImageFilter.GaussianBlur(rng.uniform(1.0, 4.0) * im.size[0] / 600)); log.append("blur")
    if rng.random() < 0.5:
        b = rng.uniform(0.4, 1.45)
        im = ImageEnhance.Brightness(im).enhance(b); log.append("dark" if b < 0.75 else "light")
        im = ImageEnhance.Contrast(im).enhance(rng.uniform(0.6, 1.3))
    if rng.random() < 0.3:  # färgstick: skugga/skymning/blåton i snö
        arr = np.asarray(im, dtype=np.float32) * np.array([rng.uniform(.8, 1.15), rng.uniform(.9, 1.1), rng.uniform(.85, 1.25)])
        im = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)); log.append("color_cast")
    if rng.random() < 0.2:  # grenar/löv/finger i bild
        d = ImageDraw.Draw(im); W = im.size[0]
        for _ in range(rng.randint(1, 4)):
            x0, y0 = rng.uniform(0, W), rng.uniform(0, W)
            d.line([x0, y0, x0 + rng.uniform(-W, W) / 2, y0 + rng.uniform(-W, W) / 2],
                   fill=tuple(rng.randint(20, 90) for _ in range(3)), width=int(W * rng.uniform(.02, .08)))
        log.append("occlusion")
    if rng.random() < 0.25:
        arr = np.asarray(im, dtype=np.float32) + np.random.default_rng(rng.randint(0, 1 << 30)).normal(0, rng.uniform(6, 22), (*im.size[::-1], 3))
        im = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)); log.append("noise")
    if rng.random() < 0.25:
        r = rng.randint(96, 200); im = im.resize((r, r), Image.BILINEAR); log.append("low_res")
    if rng.random() < 0.3:
        buf = io.BytesIO(); im.save(buf, "JPEG", quality=rng.randint(12, 55)); buf.seek(0); im = Image.open(buf); log.append("jpeg")
    im = im.convert("RGB").resize((224, 224), Image.BILINEAR)
    a = (np.asarray(im, dtype=np.float32) / 255 - MEAN) / STD
    return a.transpose(2, 0, 1)[None]


def main():
    N = int(sys.argv[1]) if len(sys.argv) > 1 else 10000
    species = json.load(open(os.path.join(APP, "data", "species.json"), encoding="utf-8"))
    emb = np.fromfile(os.path.join(APP, "data", "text_emb.bin"), dtype=np.float16).astype(np.float32).reshape(len(species), -1)
    sel = np.array([s["sel"] == 1 for s in species]); grp = np.array([s["grp"] for s in species])
    rl = np.array([bool(s["rl"]) and s["rl"] != "DD" for s in species])
    man = manifest()
    by_species = defaultdict(list)
    for m in man: by_species[m["id"]].append(m["path"])
    imgs = {}
    for m in man:
        im = Image.open(m["path"]).convert("RGB"); im.thumbnail((900, 900)); imgs[m["path"]] = im
    so = ort.SessionOptions(); so.intra_op_num_threads = 2
    sess = ort.InferenceSession(os.path.join(APP, "model", "bioclip_visual_int8.onnx"), so)
    rng = random.Random(42)
    rows = []
    t0 = time.time()
    for i in range(N):
        m = rng.choice(man); true = m["id"]; g = species[true]["grp"]
        u = rng.random()
        choice = "rätt grupp" if u < 0.75 else ("Allt" if u < 0.90 else "fel grupp")
        chosen_g = g if choice == "rätt grupp" else ("alla" if choice == "Allt" else rng.choice([x for x in GROUPS if x != g]))
        lst = "utökad" if rng.random() < 0.2 else "skogsurval"
        mask = (sel if lst == "skogsurval" else np.ones_like(sel)) & ((grp == chosen_g) if chosen_g != "alla" else True)
        n_photos = 2 if rng.random() < 0.3 else 1
        paths = [m["path"]]
        if n_photos == 2:
            others = [p for p in by_species[true] if p != m["path"]]
            paths.append(rng.choice(others) if others else m["path"])
        log, v = [], np.zeros(emb.shape[1], np.float32)
        for p in paths:
            v += sess.run(None, {"pixel_values": degrade(imgs[p], rng, log)})[0][0]
        v /= np.linalg.norm(v)
        idx = np.where(mask)[0]
        sims = emb[idx] @ v
        z = sims * LOGIT_SCALE; p = np.exp(z - z.max()); p /= p.sum()
        order = np.argsort(-p)
        top = idx[order[0]]
        in_list = true in set(idx)
        rank = int(np.where(idx[order] == true)[0][0]) + 1 if in_list else None
        rows.append(dict(group=g, choice=choice, list=lst, photos=n_photos, degr=sorted(set(log)), in_list=in_list,
                         rank=rank, p_top=float(p[order[0]]), p_true=float(p[np.where(idx == true)[0][0]]) if in_list else 0.0,
                         top_rl=bool(rl[top]), true_rl=bool(rl[true]), max_sim=float(sims.max()), top=int(top), true=int(true)))
        if (i + 1) % 500 == 0:
            el = time.time() - t0
            print(f"{i+1}/{N}  {el/60:.1f} min  (≈{el/(i+1)*(N-i-1)/60:.0f} min kvar)", flush=True)
    json.dump(rows, open(os.path.join(HERE, "cache", "sim_id_results.json"), "w"))
    report(rows)


def pct(a): return f"{100*np.mean(a):5.1f} %" if len(a) else "   – "


def report(rows):
    out = []
    P = out.append
    ok = lambda r: r["rank"] == 1
    t5 = lambda r: r["rank"] is not None and r["rank"] <= 5
    P(f"# Simulering: {len(rows)} artbestämningar i fältförhållanden\n")
    P("## Totalt\n")
    P("| Scenario | n | Rätt som förslag 1 | Rätt bland topp 5 |\n|---|---|---|---|")
    for name, f in [("Alla simuleringar", lambda r: True), ("Rätt artgrupp vald", lambda r: r["choice"] == "rätt grupp"),
                    ("\"Allt\" valt", lambda r: r["choice"] == "Allt"), ("Fel artgrupp vald", lambda r: r["choice"] == "fel grupp"),
                    ("1 foto (rätt grupp)", lambda r: r["choice"] == "rätt grupp" and r["photos"] == 1),
                    ("2 foton (rätt grupp)", lambda r: r["choice"] == "rätt grupp" and r["photos"] == 2)]:
        s = [r for r in rows if f(r)]
        P(f"| {name} | {len(s)} | {pct([ok(r) for r in s])} | {pct([t5(r) for r in s])} |")
    P("\n## Per artgrupp (rätt grupp vald, skogsurval)\n")
    P("| Grupp | n | Förslag 1 | Topp 5 |\n|---|---|---|---|")
    for g in GROUPS:
        s = [r for r in rows if r["group"] == g and r["choice"] == "rätt grupp" and r["list"] == "skogsurval"]
        P(f"| {g} | {len(s)} | {pct([ok(r) for r in s])} | {pct([t5(r) for r in s])} |")
    P("\n## Effekt av fältstörningar (rätt grupp vald, 1 foto)\n")
    P("| Störning | n | Förslag 1 |\n|---|---|---|")
    base = [r for r in rows if r["choice"] == "rätt grupp" and r["photos"] == 1]
    P(f"| (ingen av nedan) | {len([r for r in base if not set(r['degr']) - {'light'}])} | {pct([ok(r) for r in base if not set(r['degr']) - {'light'}])} |")
    for d in ["tight_crop", "rotation", "blur", "dark", "color_cast", "occlusion", "noise", "low_res", "jpeg"]:
        s = [r for r in base if d in r["degr"]]
        P(f"| {d} | {len(s)} | {pct([ok(r) for r in s])} |")
    P("\n## Kalibrering: stämmer procenten? (alla fall där arten fanns i listan)\n")
    P("| Visad sannolikhet förslag 1 | n | Faktiskt rätt |\n|---|---|---|")
    s = [r for r in rows if r["in_list"]]
    for lo, hi in [(0, .3), (.3, .5), (.5, .7), (.7, .8), (.8, .9), (.9, 1.01)]:
        b = [r for r in s if lo <= r["p_top"] < hi]
        P(f"| {lo*100:.0f}–{min(hi,1)*100:.0f} % | {len(b)} | {pct([ok(r) for r in b])} |")
    P("\n## Risker\n")
    sure = [r for r in rows if r["p_top"] >= 0.8]
    wrong_sure = [r for r in sure if not ok(r)]
    P(f"- Appen säger \"Säker träff\" (≥ 80 %) i {pct([r['p_top']>=.8 for r in rows])} av fallen; av dessa är {pct([not ok(r) for r in sure])} fel.")
    fp_rl = [r for r in rows if r["top_rl"] and not ok(r)]
    P(f"- Falskt rödlistad (förslag 1 är en rödlistad art men fel art): {len(fp_rl)} fall = {pct([r['top_rl'] and not ok(r) for r in rows])}; med ≥ 80 %: {len([r for r in fp_rl if r['p_top']>=.8])} fall.")
    miss_rl = [r for r in rows if r["true_rl"] and r["in_list"]]
    P(f"- Rödlistad art fotad: hittades som förslag 1 i {pct([ok(r) for r in miss_rl])}, bland topp 5 i {pct([t5(r) for r in miss_rl])} (n = {len(miss_rl)}).")
    wg = [r for r in rows if r["choice"] == "fel grupp"]
    P(f"- Fel artgrupp vald (arten kan inte hittas): varning om låg likhet visades i {pct([r['max_sim'] < LOW_SIM for r in wg])}; appen visade ändå ≥ 80 % i {pct([r['p_top'] >= .8 for r in wg])} av fallen.")
    rg = [r for r in rows if r["choice"] == "rätt grupp"]
    P(f"- Rätt grupp: varning om låg likhet (falsklarm) i {pct([r['max_sim'] < LOW_SIM for r in rg])}.")
    text = "\n".join(out)
    open(os.path.join(HERE, "SIMULATION_ID.md"), "w").write(text + "\n")
    print(text)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "report":
        report(json.load(open(os.path.join(HERE, "cache", "sim_id_results.json"))))
    else:
        main()

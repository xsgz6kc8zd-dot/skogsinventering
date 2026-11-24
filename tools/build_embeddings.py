#!/usr/bin/env python3
"""Beräknar BioCLIP-textinbäddningar för alla arter i app/data/species.json.
Resultat: app/data/text_emb.bin (float16, N x 512, samma ordning som species.json).
Appen jämför fotots bildinbäddning mot dessa (cosinuslikhet * 100 -> softmax -> procent)."""
import json, os, numpy as np, torch, open_clip
from export_model import load_model

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "app", "data")
TEMPLATES = ["a photo of {}.", "a close-up photo of {}.", "a good photo of {}.",
             "a photo of the {}, a type of organism.", "a field photo of {} in the forest."]


def class_text(s):
    tax = " ".join([t for t in s["tax"][:5] if t] + [s["sci"]])
    return f"{tax} with common name {s['en']}" if s.get("en") else tax


if __name__ == "__main__":
    species = json.load(open(os.path.join(DATA, "species.json"), encoding="utf-8"))
    m = load_model()
    tok = open_clip.get_tokenizer("ViT-B-16")
    embs = []
    with torch.no_grad():
        for i in range(0, len(species), 64):
            batch = species[i:i + 64]
            texts = [t.format(class_text(s)) for s in batch for t in TEMPLATES]
            f = m.encode_text(tok(texts)).float()
            f = f / f.norm(dim=-1, keepdim=True)
            f = f.reshape(len(batch), len(TEMPLATES), -1).mean(1)
            embs.append(f / f.norm(dim=-1, keepdim=True))
            print(i, end=" ", flush=True)
    e = torch.cat(embs).numpy().astype(np.float16)
    e.tofile(os.path.join(DATA, "text_emb.bin"))
    print("\n", e.shape, "logit_scale", m.logit_scale.exp().item())

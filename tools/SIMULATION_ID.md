# Simulering: 10000 artbestämningar i fältförhållanden

## Totalt

| Scenario | n | Rätt som förslag 1 | Rätt bland topp 5 |
|---|---|---|---|
| Alla simuleringar | 10000 |  35.4 % |  58.2 % |
| Rätt artgrupp vald | 7534 |  39.8 % |  65.6 % |
| "Allt" valt | 1452 |  37.4 % |  60.2 % |
| Fel artgrupp vald | 1014 |   0.0 % |   0.0 % |
| 1 foto (rätt grupp) | 5221 |  35.7 % |  62.0 % |
| 2 foton (rätt grupp) | 2313 |  49.0 % |  74.0 % |

## Per artgrupp (rätt grupp vald, skogsurval)

| Grupp | n | Förslag 1 | Topp 5 |
|---|---|---|---|
| trad | 1210 |  47.6 % |  79.6 % |
| karlvaxt | 929 |  60.1 % |  84.0 % |
| mossa | 702 |  27.8 % |  54.0 % |
| lav | 908 |  26.1 % |  59.4 % |
| svamp | 1003 |  41.2 % |  66.9 % |
| fagel | 1271 |  38.6 % |  56.4 % |

## Effekt av fältstörningar (rätt grupp vald, 1 foto)

| Störning | n | Förslag 1 |
|---|---|---|
| (ingen av nedan) | 254 |  51.2 % |
| tight_crop | 2377 |  30.6 % |
| rotation | 1818 |  34.9 % |
| blur | 1854 |  28.6 % |
| dark | 834 |  27.9 % |
| color_cast | 1565 |  33.7 % |
| occlusion | 1075 |  30.0 % |
| noise | 1258 |  32.0 % |
| low_res | 1272 |  26.6 % |
| jpeg | 1546 |  31.7 % |

## Kalibrering: stämmer procenten? (alla fall där arten fanns i listan)

| Visad sannolikhet förslag 1 | n | Faktiskt rätt |
|---|---|---|
| 0–30 % | 3703 |  13.0 % |
| 30–50 % | 2230 |  36.1 % |
| 50–70 % | 1373 |  57.8 % |
| 70–80 % | 541 |  75.4 % |
| 80–90 % | 470 |  87.2 % |
| 90–100 % | 669 |  96.3 % |

## Risker

- Appen säger "Säker träff" (≥ 80 %) i  11.5 % av fallen; av dessa är   8.1 % fel.
- Falskt rödlistad (förslag 1 är en rödlistad art men fel art): 1409 fall =  14.1 %; med ≥ 80 %: 20 fall.
- Rödlistad art fotad: hittades som förslag 1 i  37.4 %, bland topp 5 i  62.3 % (n = 1187).
- Fel artgrupp vald (arten kan inte hittas): varning om låg likhet visades i  60.9 %; appen visade ändå ≥ 80 % i   0.8 % av fallen.
- Rätt grupp: varning om låg likhet (falsklarm) i   7.8 %.

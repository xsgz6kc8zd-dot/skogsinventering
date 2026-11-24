# Utvärdering av artigenkänningen

**Testdata:** 249 fältfoton av 125 slumpvis valda arter ur skogsurvalet (25 per artgrupp, 2 foton per art), från
svenska observationer **2024–2025** på GBIF (främst iNaturalist och Artportalen). BioCLIP tränades på data
fram till 2023, så fotona är nya för modellen. Samma int8-modell och samma förbehandling som i appen
(`tools/evaluate.py 25 2`).

Fotona är inte handplockade. Vissa visar bara spår, substrat eller en avlägsen fågel, så siffrorna är
snarare pessimistiska för en inventerare som tar en tydlig bild.

## Träffsäkerhet (topp 1 / topp 5)

| Artgrupp | Grupp vald i appen | Skogsurval, alla grupper | Utökad lista (+ alla rödlistade) |
|---|---|---|---|
| Kärlväxter | **80 % / 95 %** | 74 % / 92 % | 62 % / 85 % |
| Träd och buskar | **64 % / 94 %** | 54 % / 84 % | 48 % / 82 % |
| Mossor | **60 % / 80 %** | 60 % / 73 % | 53 % / 70 % |
| Fåglar | **56 % / 76 %** | 56 % / 76 % | 50 % / 66 % |
| Svampar | **52 % / 76 %** | 50 % / 74 % | 45 % / 69 % |
| Lavar | **47 % / 84 %** | 45 % / 84 % | 40 % / 74 % |

**Slutsats:** välj alltid artgrupp, eftersom det ger bäst resultat. Rätt art finns bland topp 5 i 76–95 % av fallen.

## Kalibrering av procenten

BioCLIP:s egen temperatur (logit-skala 100) gav för säkra procent: av de bilder som visades som "90–100 %" var
bara 84 % rätt. Efter temperaturskalning (`tools/calibrate.py`, skala 55 i `app/js/worker.js`):

| Visad sannolikhet för förslag 1 | Andel rätt |
|---|---|
| 90–100 % | 98 % (n = 42) |
| 70–90 % | 87 % (n = 38) |
| 50–70 % | 68 % (n = 50) |
| 30–50 % | 44 % (n = 64) |
| under 30 % | 24 % (n = 55) |

Skalan är anpassad på samma testdata (en enda parameter, så risken för överanpassning är liten). Kör om
`evaluate.py` och `calibrate.py` när arter läggs till eller modellen byts.

# Skogsinventering – offline-app för naturvärdesinventering

En webbapp (PWA) för skoglig naturvärdesinventering som fungerar **helt offline** ute i fält.
Du fotograferar en växt, mossa, lav, svamp, fågel eller ett träd, och appen svarar direkt på telefonen,
till exempel:

> **82 %** aspfjädermossa *Neckera pennata* `VU` `Signalart`
> **9 %** platt fjädermossa *Alleniella complanata* …

Fynden sparas med GPS-position (WGS84 + SWEREF 99 TM), foton, antal och substrat, och kan
kopplas till naturvärdesobjekt. Allt exporteras till GeoJSON (QGIS/ArcGIS), CSV (Excel) och en full säkerhetskopia.

## Så är appen upplagd (version 2.0)

Fyra flikar: **Fält · Karta · Lista · Mer**. Upplägget bygger på en granskning av en fältexpert med bakgrund som virkesköpare, skogstekniker och biolog, se [`FALTEXPERT.md`](FALTEXPERT.md).

- **Fält** (startsida): raden "Du är i *objekt*" och fyra knappar.
  - **Art**: känd art med ett tryck.
  - **Foto**: okänd art. AI-förslag om AI är nedladdad, annars sparas fotot som obestämt och bestäms senare.
  - **Objekt**: ny avgränsning genom att gå gränsen eller rita på kartan.
  - **Punkt**: anteckning eller foto, till exempel grov låga, hålträd eller kulturlämning.
- **Fynd kopplas automatiskt** till objektet de ligger i. När en avgränsning ändras kopplas fynden om, utom de du själv har kopplat.
- **Objektkortet** visar i **fältläge** bara det som behövs ute: avgränsning, biotop, strukturer, foton, anteckningar och preliminär klass. **Kontorsläget** visar alla rapportfält: motiveringar, Natura 2000, biotopskydd, skötsel och bedömningsmatris.
- **Karta** (Leaflet):
  - OpenStreetMap när du har nät.
  - Lantmäteriets topografiska webbkarta med egen gratis API-nyckel, som kan laddas ner per område för offline.
  - Skogsstyrelsens öppna lager: nyckelbiotoper, naturvärden, sumpskog, avverkningsanmälningar, biotopskydd, naturvårdsavtal och skoghistoria. Lagren hämtas som kartbild online och kan laddas ner som vektordata för offline.
  - Rita och justera objekt direkt på kartan, och se ditt spår från det senaste dygnet.
- **AI-artbestämning är valfri** (Mer → AI, ≈105 MB).
- **Fältguide (📖)** för signalarter, E-arter och rödlistade arter i skogsurvalet: foto, när arten rapporteras i Sverige, antal fynd i Sverige, förväxlingsarter i samma släkte och länk till Artfakta. 📖 finns vid arterna överallt i appen och fungerar offline.
- **Leveranskontroll** innan leverans. Den visar fel, varningar och tips, till exempel objekt utan avgränsning eller motivering, klass som avviker från matrisen, obestämda och osäkra fynd, rödlistade arter utan foto och saknad säkerhetskopia.

## Funktioner

| | |
|---|---|
| **AI-artigenkänning offline** | BioCLIP (ViT-B/16, int8, 87 MB) körs på telefonen via onnxruntime-web. Topp-10 med procent, släktessammanfattning, varning när bilden inte liknar någon art i listan. |
| **Flera foton per fynd** | Närbild och översikt vägs ihop till ett säkrare svar. Bilderna kan beskäras. |
| **Artdatabas** | 3 659 arter: ett skogsurval på 756 (alla Skogsstyrelsens signalarter och E-arter plus vanliga förväxlingsarter) och alla rödlistade växter, mossor, lavar, svampar och fåglar. Rödlistan 2025 och svenska namn från Dyntaxa (SLU Artdatabanken). Signalarter enligt **Skogsstyrelsens förteckning 2023-1, importerad maskinellt** och matchad på Dyntaxas taxon-ID. |
| **Artgruppsfilter** | Väljer du "Mossor" jämförs bara mossor, vilket ger bättre träffsäkerhet och rimligare procent. |
| **Fynd** | GPS med noggrannhet, SWEREF 99 TM, mängdklass, antal/enhet, substrat som snabbval (trädslag, typ, diameter, nedbrytning – senaste val förvalt), bestämningsmetod, osäker bestämning, objektkoppling efter läget (det objekt du står i). AI-förslagen och eventuella rättelser sparas också. |
| **Uppdrag** | Beställare, inventerare, SS 199000:2023/2014, detaljeringsgrad och tillägg. Klass 4 föreslås bara när tillägget ingår. |
| **Art / checklista** | Stora knappar med objektets naturvårdsarter. Ett tryck registrerar arten med GPS ("okulärt i fält"), och det går att ångra direkt. Ett tryck till öppnar mängd, substrat och ny lokal. Sökningen täcker alla arter. |
| **Naturvärdesobjekt** | Avgränsning genom att gå runt objektet (GPS-hörn eller automatisk spårinspelning), area, strukturer/värdeelement, biotop- och artvärde med förslag på naturvärdesklass enligt bedömningsmatrisen (SS 199000). |
| **Karta** | OpenStreetMap (online), Lantmäteriets topografiska karta med egen nyckel (kan laddas ner för offline), Skogsstyrelsens lager, ritning av objekt, spårlogg. Fynd och objekt syns även utan bakgrund. |
| **Objektprotokoll** | Natura 2000-naturtyp, generellt biotopskydd, nyckelbiotop, grupperade strukturer, påverkan, foton på objektet, motivering av biotop- och artvärde, osäkerhet i klassningen, skötselbehov/hot. Osäkra fynd och DD-arter räknas inte som naturvårdsarter. |
| **Export** | GeoJSON, fynd-CSV och objektprotokoll-CSV (SWEREF 99 TM, semikolon + BOM för svensk Excel), **rapportunderlag** (HTML att skriva ut eller spara som PDF) och ZIP med allt inklusive foton (kan återställas). Skyddsklassade arter skyddas, se nedan. |
| **Skyddsklassade arter** | Enligt SLU Artdatabankens lista över nationellt skyddsklassade arter (2023, importerad maskinellt): i exporter visas positionen som 5/25/50 km-ruta i SWEREF 99 TM, datum som år, och kommentar, substrat och objekt döljs. Arterna namnges inte per objekt eller i rapporten utan redovisas i en separat **konfidentiell bilaga**. För fåglar gäller skyddet fynd som kan indikera häckning (H). Bara fynd med aktiviteten "förbiflygande/sträckande" undantas, så fynd utan angiven aktivitet skyddas också. Regionala villkor (t.ex. guckusko) visas men tillämpas försiktigt, alltså alltid. |
| **Offline** | Service worker + Cache Storage. Data i IndexedDB på enheten. |

## Hur bra är artigenkänningen?

Mätt med `tools/evaluate.py` på **färska svenska fältfoton från 2024–2025** (GBIF/iNaturalist/Artportalen),
alltså bilder som modellen inte har tränats på. Artgruppen är vald i appen. Se tabellen i
[`tools/EVALUATION.md`](tools/EVALUATION.md).

Kort sagt: rätt art finns oftast bland topp 5. **Lavar, svampar och mossor är svårast.** Där är förslag 1
ofta fel, även om rätt art finns bland alternativen. Använd appen som
beslutsstöd och bekräfta med lupp, karaktärer eller expert. Det gäller i synnerhet skorplavar och levermossor.

| Artgrupp (vald i appen) | Topp 1 | Topp 5 |
|---|---|---|
| Kärlväxter | 80 % | 95 % |
| Träd och buskar | 64 % | 94 % |
| Mossor | 60 % | 80 % |
| Fåglar | 56 % | 76 % |
| Svampar | 52 % | 76 % |
| Lavar | 47 % | 84 % |
| Insekter (24 bilder, mest skalbaggar) | 83 % | 96 % |

Procenten är **kalibrerade** på ett litet testurval (249 bilder). Av förslagen som appen visade med 90–100 % var
98 % rätt, och 96 % i simuleringen med 10 000 försämrade fältbilder (se `tools/SIMULATION_ID.md`). Det gäller *inom den valda
listan* och för testbilder som är jämnt fördelade mellan arterna. För sällsynta arter i fält är sannolikheten lägre,
eftersom vanliga förväxlingsarter är så mycket vanligare. Rödlistade arter och signalarter markeras därför alltid
"kräver verifiering". En art som inte finns i listan kan aldrig föreslås.

## Dokument

- [`PUBLICERA-OCH-TESTA.md`](PUBLICERA-OCH-TESTA.md): publicera (Netlify Drop / GitHub Pages), installera på telefonen och testplan för fältdag.
- [`FALTEXPERT.md`](FALTEXPERT.md): fältexpertens förenklingsförslag (virkesköpare, skogstekniker, biolog), som ligger till grund för version 2.0.
- [`EXPERTGRANSKNING.md`](EXPERTGRANSKNING.md): granskning av en skoglig naturvärdesinventerare.
- [`UX-GRANSKNING.md`](UX-GRANSKNING.md) och [`UX-ATGARDER.md`](UX-ATGARDER.md): granskning av användbarheten i fält och vad som har åtgärdats, med mätvärden före och efter.
- [`tools/SIMULATION_ID.md`](tools/SIMULATION_ID.md) och [`tools/SIMULATION_UI.md`](tools/SIMULATION_UI.md): simuleringar.

## Använda appen

Appen måste serveras över **HTTPS**. Det krävs för kamera, GPS och offlineläge.

1. Lägg mappen `app/` på valfri statisk webbhost, till exempel GitHub Pages, Netlify eller en egen server.
2. Öppna sidan i mobilen. Lägg till på hemskärmen (iOS: *Dela → Lägg till på hemskärmen*, Android: *Installera app*).
3. Valfritt: **Mer → AI-artbestämning → Ladda ner** när du har wifi (≈105 MB). Ladda också ner kartan för området (Karta → ▤) om du vill ha bakgrundskarta offline.
4. Klart. Appen fungerar sedan utan täckning.

Lokalt för test (localhost räknas som säkert):

```bash
cd app && python3 -m http.server 8080
```

## Uppdatera eller utöka artdatabasen

```bash
pip install torch open_clip_torch onnx onnxruntime onnxscript pillow
python3 tools/fetch_redlist.py       # Rödlistan 2025 från GBIF
python3 tools/fetch_signalarter.py   # Skogsstyrelsens signalarter 2023-1 (PDF -> tools/signalarter_2023_1.csv)
python3 tools/fetch_skyddsklass.py   # SLU Artdatabankens skyddsklassade arter (-> tools/skyddsklassade_arter.csv)
python3 tools/build_species.py       # app/data/species.json (lägg till arter i tools/species_input.csv)
python3 tools/export_model.py        # app/model/bioclip_visual_int8.onnx (behövs bara en gång)
python3 tools/build_embeddings.py    # app/data/text_emb.bin
python3 tools/build_guide.py         # fältguiden: app/data/guide.json och foton (GBIF/iNaturalist)
python3 tools/evaluate.py 25 2       # mät träffsäkerhet på färska svenska fältfoton
python3 tools/calibrate.py           # föreslår LOGIT_SCALE för app/js/worker.js
```

Att lägga till en art kräver **ingen omträning**. Raden i `species_input.csv` räcker, eftersom modellen
jämför bilden mot en textbeskrivning av artens taxonomi. Kör om `build_species.py` och `build_embeddings.py`
och höj `VERSION` i `app/sw.js`.

## Vägen till högre träffsäkerhet (mossor/lavar)

1. **Samla verifierade fältfoton.** Varje sparat fynd innehåller foton, AI-förslag och den art inventeraren
   valde. ZIP-exporten sorterar foton per art. Det blir träningsdata.
2. **Finjustera** BioCLIP (eller en linjär klassificerare ovanpå bildinbäddningarna) på svenska foton från
   Artportalen/GBIF plus egna verifierade bilder, med fokus på signalarter. Några hundra bilder per art ger
   stor förbättring.
3. Fåglar: komplettera med **ljudigenkänning** (t.ex. BirdNET), som ofta är säkrare än foto i skog.

## Viktigt att veta

- **Signalarter** importeras från Skogsstyrelsens officiella förteckning (version 2023-1). Den innehåller 334 S-arter och 12 E-arter, och
  rödlistade arter ingår per definition inte. Många arter som tidigare kallades signalarter (t.ex. allémossa,
  skriftlav och svavelticka) finns inte längre med. Rödlistekategorierna kommer från Rödlistan 2025. Kör om
  `fetch_signalarter.py` när Skogsstyrelsen publicerar en ny version.
- **Bedömningsmatrisen** för naturvärdesklass är ett förslag. Kontrollera alltid mot SS 199000.
- Data lagras bara på enheten. Exportera eller säkerhetskopiera regelbundet. Appen ber webbläsaren om
  beständig lagring, men rensad webbläsardata raderar fynden.
- Skyddsklassade arter skyddas i exporterna när inställningen är på, vilket är standard. Säkerhetskopian (ZIP) och den konfidentiella
  bilagan innehåller exakta uppgifter och ska hanteras därefter. Rapportera fynden till Artportalen, där de skyddas
  automatiskt.

## Källor och licenser

- BioCLIP, Imageomics Institute, MIT-licens: <https://huggingface.co/imageomics/bioclip>
- Rödlistan 2025, SLU Artdatabanken, CC0 (via GBIF, dataset `87e639cc-30a9-4007-bd2c-b0cab60326b9`)
- Dyntaxa, SLU Artdatabanken, CC0 (via GBIF, dataset `de8934f4-a136-481c-a87a-b0b202b80a31`)
- GBIF Backbone Taxonomy (engelska namn/klassificering för modellens textbeskrivningar)
- Skogsstyrelsen 2023. Komplett förteckning över Skogsstyrelsens signalarter, version 2023-1
- SLU Artdatabanken: List of Restricted Access Species In Sweden (CC0, via GBIF Sverige) och "Nationellt skyddsklassade arter" (2023-06-12, uppdaterad 2024-04-25)
- onnxruntime-web 1.30.0, Microsoft, MIT-licens
- Leaflet 1.9.4, BSD-2-licens
- Kartdata © OpenStreetMap-bidragsgivare (ODbL); Lantmäteriets topografiska webbkarta (CC BY 4.0, egen nyckel); Skogsstyrelsens geodata (öppna data)

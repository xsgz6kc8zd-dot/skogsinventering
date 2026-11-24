# Expertgranskning: Skogsinventering (PWA för naturvärdesinventerare)

Granskare: skoglig naturvärdesinventerare (jägmästare, NVI enligt SS 199000, NBI, signalartsmetodik, artinventering).
Underlag: README, tools/EVALUATION.md, app/js/app.js, app/js/export.js, tools/species_input.csv, app/data/species.json (analyserad med python) och skärmbilderna 03, 04 och 06.

**Säkerhetsnivåer i texten**
- **[V]** = verifierat i denna granskning, mot projektets egen data eller en extern källa.
- **[K-hög]**, **[K-medel]** och **[K-låg]** = bygger på min egen fackkunskap, med angiven säkerhet.

**Källäget.** Jag kunde inte ladda ner Skogsstyrelsens signalartslista (skogsstyrelsen.se är blockerad i nätverket). Webbsökning bekräftade bara följande om listan:

- Den aktuella förteckningen är *"Skogsstyrelsens signalarter – en komplett förteckning", version 2023-1, daterad 2023-03-29*.
- Varje art markeras **S** (signalart) eller **E** (ekologisk ståndortsindikator) och har rödlistekategori enligt 2020.
- Listan omfattar även **insekter**, främst skalbaggar.
- *Phellinus populicola* (stor aspticka) står med som S.

Alla andra bedömningar av enskilda signalarter nedan bygger på min kunskap. De bör stämmas av rad för rad mot PDF:en eller Excel-versionen innan de förs in.

---

## 1. Helhetsomdöme

Grunden är tekniskt imponerande:
- Appen fungerar helt offline.
- Positioner anges i SWEREF 99 TM.
- Export till CSV är anpassad för svensk Excel.
- AI-förslagen sparas tillsammans med inventerarens val.
- Avgränsning av objekt med GPS finns.
- Kalibreringen redovisas ärligt.

Appen är ändå i dag byggd som en **artbestämningsapp med ett naturvärdesformulär påhängt**. En yrkesinventerare behöver det omvända: ett snabbt **fält- och objektprotokoll** för SS 199000, där artbestämningen är ett hjälpmedel. Vi känner igen 90–95 % av arterna utan foto. Det vi behöver är att snabbt bocka av naturvårdsarter per objekt, att registrera strukturer, substrat och död ved på ett standardiserat sätt, och att få ut ett rapportunderlag till beställaren.

Fackdatan har dessutom **systematiska fel**. Flera rödlistade arter i skogsurvalet saknar rödlistestatus på grund av synonymer. Ett par svenska namn är fel. Rutan "kontrollerad av mig" är förvald. Felen gör att appen i dag kan ge fel underlag för just de arter som avgör naturvärdesklassen.

- **Fältnytta idag: 4/10.** Användbar som anteckningsblock med GPS och som "andra åsikt" om kärlväxter och vanliga makrolavar. Inte användbar som huvudverktyg i ett NVI-uppdrag.
- **Potential: 8/10.** Med checklisteläge, ett riktigt objektprotokoll, rättad artdata, bakgrundskarta offline och export till Artportalen kan den bli bättre än det vi använder i dag: papper plus Collector/QField plus Excel.

---

## 2. Fel i fakta som måste rättas

### 2.1 Synonymfel: rödlistade arter i skogsurvalet saknar status [V, kontrollerat i species.json]

Skogsurvalet använder delvis andra vetenskapliga namn än Rödlistan 2025 och Dyntaxa. Därför finns arten **två gånger** i databasen:
- en gång i skogsurvalet, **utan** rödlistekategori;
- en gång utanför urvalet, **med** rätt kategori.

Följderna:
1. Badgen för rödlistad art visas inte.
2. Fynden räknas inte som rödlistade i objektet eller i statistiken.
3. **Koordinaterna generaliseras inte vid export.** Långskägg (EN) exporteras alltså med exakt position.
4. AI:n och sökningen kan ge två poster med samma svenska namn.

| Skogsurvalet (sel=1, rl tom) | Dubblett i databasen med kategori | Åtgärd |
|---|---|---|
| *Dolichousnea longissima* långskägg | *Usnea longissima* **EN** | Använd Dyntaxas namn, ta bort dubbletten |
| *Degelia plumbea* blylav | *Pectenia plumbea* **EN** | dito |
| *Ricasolia amplissima* jättelav | *Lobaria amplissima* **CR** (sv. "jättelavskorall" i datat, kontrollera namnet) | dito |
| *Cyphelium karelicum* liten sotlav | *Acolium karelicum* **VU** | dito |
| *Lobarina scrobiculata* skrovellav | *Lobaria scrobiculata* **NT** | dito |
| *Arthonia leucopellaea* kattfotslav | *Felipes leucopellaeus* **NT** | dito |
| *Rhodofomes roseus* rosenticka | *Fomitopsis rosea* **NT** | dito |
| *Phlebia centrifuga* rynkskinn | *Hermanssonia centrifuga* **NT** | dito |
| *Bankera violascens* grantaggsvamp | *Phellodon violascens* **NT** | dito |
| *Anastrophyllum hellerianum* vedtrappmossa | *Crossocalyx hellerianus* **NT** | dito |
| *Festuca altissima* skogssvingel | *Drymochloa sylvatica* **NT** | dito |
| *Accipiter gentilis* duvhök | *Astur gentilis* **NT** | dito (duvhök är också skyddsklassad) |

**Grundorsak:** `build_species.py` matchar på namnsträng i stället för på **Dyntaxa taxon-ID**. Matcha urvalet mot Dyntaxa, slå upp det accepterade namnet och knyt rödlistan till taxon-ID. Lägg till ett test som failar när två poster delar svenskt namn eller taxon-ID.

### 2.2 Fel svenska namn [V för dubbletterna/felen i datat, K-hög för rätt namn]

| Art (rad i species_input.csv) | I appen | Ska vara |
|---|---|---|
| *Ranunculus lapponicus* | "ranunkelväxter" (familjenamnet!) | **lappranunkel** |
| *Bromus benekenii* | "strävlosta" (samma som *Bromopsis ramosa*) | **skogslosta**. Strävlosta är *Bromopsis/Bromus ramosus* |
| *Anomodon longifolius* (`mossa;Anomodon longifolius;1;långfliksmossa`) | "långfliksmossa" (handinlagt, krockar med *Nowellia curvifolia*) | **liten baronmossa** [K-hög]. Ta bort den manuella namnkolumnen |
| *Fomes fomentarius* | "fnösk-ticka" | fnöskticka (kosmetiskt) |
| *Listera ovata* | gammalt släktnamn, medan *Neottia cordata* har det nya | *Neottia ovata* tvåblad. Var konsekvent |
| README, exempel: "trubbfjädermossa *Neckera complanata*" | – | *Neckera complanata* = **platt fjädermossa** (*Alleniella complanata*). Trubbfjädermossa/grov fjädermossa är *N. crispa*. Rätta exemplet |

466 arter i databasen saknar svenskt namn [V]. Det är acceptabelt i den utökade listan, men i urvalet saknas namn för *Hypnum pallescens* och *Fuscopannaria ignobilis*.

### 2.3 Rödlistekategorier att kontrollera [K-medel]

- ~~***Ilex aquifolium* (järnek) visas som CR.** Det ser ut som ett matchningsfel.~~ **Tillbakadraget.** Källfilen (SLU, "The Swedish Red List 2025" på GBIF) anger CR. Min uppgift byggde på äldre listor. Se avsnitt 7.
- ***Luzula sylvatica* VU och *Polystichum braunii* CR** är rimliga för sällsynta västliga eller sydliga arter, men bör stickprovas mot Artfakta.
- **73 arter i kategori RE** ligger i den utökade listan och kan föreslås av AI:n. De bör tas bort ur kandidatlistan för artigenkänning eller ges mycket låg prior.

### 2.4 Signalartsflaggor (species_input.csv)

Notera först en strukturell brist: Skogsstyrelsens lista 2023-1 skiljer på **S** och **E** [V]. Appen har bara en boolesk flagga. Inför `sig = "S" | "E" | ""`.

**Sannolikt felaktigt flaggade som signalart (1 → 0):**

| Art | Bedömning | Säkerhet |
|---|---|---|
| *Phellinus tremulae* aspticka | Finns på nästan varje äldre asp. Det är *P. populicola* (stor aspticka) som är signalart [V för populicola]. | K-medel/hög |
| *Pseudoscleropodium purum* pösmossa | Vanlig i södra Sverige på kulturpåverkad mark. Ingen signalart. | K-hög |
| *Helodium blandowii* kärrkammossa | Rikkärrsart, inte skoglig signalart. | K-medel |
| *Tricholoma matsutake* goliatmusseron | Rödlistad (VU), men jag känner inte igen den som Skogsstyrelsens signalart. | K-låg, kontrollera |
| *Daphne mezereum* tibast och *Pyrola chlorantha* grönpyrola | Troligen med, men eventuellt som E och inte S. | K-låg, kontrollera |

**Sannolikt saknade signalarter (0 → 1, eller lägg till arten):**

| Art | Kommentar | Säkerhet |
|---|---|---|
| *Ilex aquifolium* järnek | Signalart i västsvensk lövskog enligt min erfarenhet. | K-medel |
| *Conocephalum conicum* s.l. rutlungmossa | Fuktig skog, bäckraviner. | K-medel |
| *Rhizomnium punctatum* bäckrundmossa | Fuktindikator i bäckmiljöer. | K-låg/medel |
| *Hypogymnia vittata* skuggblåslav (NT) | Västlig fuktskog. | K-låg/medel |
| *Hydnellum ferrugineum* m.fl. taggsvampar | Flera taggsvampar är signalarter i tallskog. Kontrollera dropptaggsvamp och orange taggsvamp. | K-låg |
| *Pseudographis pinicola* gammelgransskål (NT) | Saknas helt. En av de viktigaste kontinuitetsindikatorerna i granskog. | K-hög |
| Insekter, t.ex. raggbock, reliktbock och jättesvampmal (spår) | Saknas helt. Skalbaggar finns på listan 2023-1 [V att insekter ingår]. | K-medel för enskilda arter |

**Fåglar:** alla har flaggan 0. Det är i sak rätt eftersom fåglar inte är signalarter i Skogsstyrelsens mening [K-medel]. Men fåglar som tjäder, tretåig hackspett och spillkråka är **naturvårdsarter** enligt SS 199000 genom fågeldirektivets bilaga 1 och/eller rödlistan. Appen saknar ett begrepp för det (se 2.6).

Mina markeringar av de övriga ~150 signalartsflaggorna överensstämmer med min erfarenhet [K-medel]. Hela kolumnen bör ändå ersättas genom en **maskinell import av Skogsstyrelsens Excel-lista**, inte genom handpåläggning. README säger att flaggan "satts manuellt efter Skogsstyrelsens lista". Den sattes ur minnet av en AI, och det bör framgå tills listan är importerad.

### 2.5 Bedömningsmatrisen (MATRIX)

```
              Biotopvärde: obetydligt  visst  påtagligt  högt
Artvärde högt                   2         2       1        1
Artvärde påtagligt              3         3       2        1
Artvärde visst                  4         4       3        2
Artvärde obetydligt             –         4       3        2
```

- Matrisen stämmer **med min kunskap om figuren i SS 199000:2014** [K-hög]. Hörnen och diagonalen bekräftas av publicerade NVI-rapporter som citerar standarden [V, delvis]: högt+högt ger klass 1, påtagligt+påtagligt ger klass 2, visst+visst ger klass 4. Jag ser inget cellfel.
- **SS 199000:2014 har ersatts av SS 199000:2023** [V]. Appen måste ange vilken utgåva den följer, och matrisen och terminologin ska stämmas av mot 2023-utgåvan [K-låg om eventuella ändringar].
- **Klass 4 är ett tillägg.** Cellerna som ger 4 ska bara visas som "klass 4" när tillägget *Naturvärdesklass 4* ingår i uppdraget. Annars ska appen säga "inget naturvärdesobjekt (klass 4 ingår ej)".
- Appen ger **inget stöd för att bedöma artvärde och biotopvärde**. Där görs det verkliga bedömningsarbetet. Appen räknar redan rödlistade arter och signalarter per objekt. Lägg till två saker:
  - en hjälptext med standardens kriterier för artvärde, det vill säga antal naturvårdsarter, rödlistade och hotade (VU/EN/CR), samt arter med särskild betydelse;
  - separata fält för **motivering av biotopvärde** och **motivering av artvärde**, som beställare kräver.
- Fältet "Kontinuitet" bland strukturerna är en bedömning, inte en struktur (se 5.2).

### 2.6 Naturvårdsart är mer än rödlistad eller signalart [K-hög]

Enligt SS 199000 omfattar naturvårdsarter även:
- **fridlysta arter** (artskyddsförordningen), t.ex. alla orkidéer, guckusko och norna;
- arter i **habitatdirektivets bilagor**, t.ex. grön sköldmossa och läderbagge;
- arter i **fågeldirektivets bilaga 1**;
- **typiska arter** för Natura 2000-naturtyper;
- ansvarsarter.

Lägg till fälten `fridlyst`, `hd_bilaga`, `fd_bilaga1` och `skyddsklass`. Ett fält `naturvardsart` ska härledas ur dem och vara det som räknas i objektet.

### 2.7 Skyddsklassade arter och generalisering vid export [V i koden, K-hög i sak]

- Koordinaterna generaliseras efter rödlistekategori (CR/EN/VU). Det är fel kriterium. Rätt underlag är **Artdatabankens lista över skyddsklassade arter**: kungsörn (NT), duvhök, berguv, lappuggla och flera orkidéer skyddsklassas utan att vara VU eller högre. Samtidigt behöver många VU-arter inte döljas.
- Polygonerna exporteras exakt, och fältet `rodlistade_arter` per objekt röjer alltså läget ändå.
- Synonymfelet i 2.1 gör att långskägg (EN) inte generaliseras alls.

### 2.8 "Artbestämningen är kontrollerad av mig" är förvald [V i koden, app.js rad 344, `o.confirmed !== false`, syns i skärmbild 04]

Varje AI-förslag sparas som "bekräftad av inventerare" om man inte aktivt bockar ur. Det gör flaggan värdelös och kan få overifierade AI-bestämningar av rödlistade arter att se kvalitetssäkrade ut i exporten. Gör rutan **avbockad som standard** och ersätt den med fältet **Bestämningsmetod**: fält/okulärt, lupp, kemiskt test (K/C/P/UV), mikroskop, belägg insamlat, expertverifierad, endast AI-förslag. Lägg till fältet **Osäker bestämning** (ja/nej), som finns i Artportalen.

---

## 3. Topp 10 förbättringar (prioriterade)

| # | Förbättring | Varför (fältverklighet) | Insats |
|---|---|---|---|
| 1 | **Rätta artdatan:** importera Dyntaxa-ID, rödlista, Skogsstyrelsens S/E-lista, fridlysning, direktivsbilagor och skyddsklass maskinellt. Ta bort synonymdubbletter. | Fel status för EN/CR-arter ger fel artvärde och läcker skyddsklassade lägen. Det går inte att lämna ut till en beställare så. | Mellan (skript), måste göras först |
| 2 | **Checklisteläge per objekt:** en lista över naturvårdsarter med stora knappar, där ett tryck lägger till arten, långtryck anger mängd (enstaka/fåtal/riklig eller antal substrat), och arten kopplas automatiskt till aktivt objekt och GPS. | Fältinventerare fotograferar inte varje lunglav. 95 % av registreringarna sker på artkännedom. Foto och AI ska vara undantaget. | Mellan |
| 3 | **Bakgrundskarta offline:** ortofoto och terrängkarta (Lantmäteriets öppna data, OSM) samt import av inventeringsområde, nyckelbiotoper, Natura 2000 och tidigare objekt (GeoJSON/GeoPackage). Rita och justera polygoner på kartan. | En karta utan underlag går inte att navigera eller avgränsa i. Att gå runt ett objekt i blockig granskog med GPS ±15–30 m ger sämre gräns än att rita på ortofoto. | Stort |
| 4 | **Objektprotokoll enligt SS 199000:** objekt-ID, naturtyp/biotop (inkl. Natura 2000-kod), beskrivning, motivering av biotopvärde och artvärde, påverkan, osäkerhet i klassningen, foton på objektet, inventerare, datum, detaljeringsgrad, vilka tillägg som ingår, generellt biotopskydd och nyckelbiotopsstatus. | Detta är leveransen till beställaren. I dag finns bara namn, biotop, chips, två värden och ett fritextfält. | Mellan |
| 5 | **Rätta tillitsflödet för AI:** "kontrollerad" avbockad som standard, bestämningsmetod, osäker bestämning, nya formuleringar (se 6.5), och krav på aktiv bekräftelse med karaktärschecklista för rödlistade arter och signalarter. | Annars hamnar AI-gissningar på rödlistade arter i rapporter och i Artportalen som verifierade. | Snabbt |
| 6 | **Strukturerat substrat:** trädslag, typ (levande, torraka, högstubbe, låga, stubbe, gren, rotvälta), del (bark/ved), diameterklass, nedbrytningsklass och exponering, som separata snabbval. | Substratet är halva ekologin för en kryptogamfynd ("lunglav på grov asp", "gränsticka på låga i nedbrytningsklass 3, >40 cm"). En platt lista med 17 värden räcker inte. | Snabbt till mellan |
| 7 | **Export till Artportalen** (importmall i Excel/CSV med deras kolumnnamn och Dyntaxa-ID), plus **GeoPackage/Shape i SWEREF 99 TM** och ett **rapportunderlag** (objektstabell, artlista per objekt och foton som docx/pdf). | Rapportering till Artportalen ingår i nästan alla uppdrag. Beställare (kommun, Trafikverket, länsstyrelse) vill ha GIS-skikt med fasta attribut. | Mellan |
| 8 | **Punktobjekt för särskilt värdefulla träd och strukturer** (tillägget *Värdefulla träd*): trädslag, diameter i brösthöjd, hålighet, mulm, vidkronighet, döende, foto. | Jätteträd, hålträd och grova aspar registreras som punkter i nästan varje skogs-NVI. | Mellan |
| 9 | **Gränssnitt för regn och handskar:** större träffytor, inga rullgardinsmenyer i snabbflödet, röstanteckning (offline), senaste substrat och objekt förvalt, ångra i stället för bekräftelsedialog, lägen för hög kontrast och en hand, tydlig GPS-medelvärdesbildning (t.ex. 10 s) med ±-värde vid sparning. | Med blöta handskar träffar man inte en `<select>` och skriver ingen kommentar. Ett felsparat fynd måste vara lätt att ångra. | Mellan |
| 10 | **Regional och habitatbaserad filtrering av kandidater** för AI och sökning: landskap eller biogeografisk region samt landskapstyp skog enligt Artfakta. Ta bort RE-arter. | Den utökade listan innehåller glasört, backsippa och RE-arter. Det ger brus och fler felaktiga förslag på sällsynta arter. En region-prior höjer träffsäkerheten utan omträning. | Snabbt till mellan |

Utanför topp 10 men viktigt:
- automatisk påminnelse om säkerhetskopiering, eller synk mot molnet eller beställarens server, eftersom data i IndexedDB är en stor risk;
- flera inventerare i samma uppdrag, med sammanslagning;
- **ljudigenkänning av fåglar** (BirdNET offline) i stället för foto.

---

## 4. Arter att lägga till eller ta bort i skogsurvalet

### 4.1 Lägg till

Säkerhet [K-medel] om inget annat anges. Kontrollera namnen mot Dyntaxa.

**Lavar**
- *Pseudographis pinicola* gammelgransskål (svamp i Artportalen, men inventeras som "lav")
- *Cetrelia olivetorum* (olivbräm/lappar)
- *Collema furfuraceum*, *C. subflaccidum*, *C. nigrescens* (gelélavar på asp)
- *Leptogium lichenoides*
- *Lecanographa amylacea* (ek)
- *Cliostomum corrugatum*
- *Calicium quercinum*
- *Sclerophora pallida* och *S. farinacea*
- *Chaenotheca hispidula*
- *Nephroma helveticum*
- *Hertelidea botryosa* (brandstubbar)
- *Xylopsora friesii*
- förväxlingsarter: *Bryoria implexa*, *Peltigera britannica*

**Mossor**
- *Scapania apiculata*
- *Cephalozia catenulata*
- *Liochlaena lanceolata*
- *Plagiothecium latebricola*
- *Lophozia ascendens* (vedlevande)
- förväxlingsarter till *Nowellia*: *Cephalozia bicuspidata*, *C. lunulifolia*
- *Thamnobryum alopecurum*
- *Neckera pumila*
- *Orthotrichum gymnostomum* (asp)

**Svampar**
- *Fomitiporia robusta* ekticka
- *Haploporus odorus* doftticka
- *Inonotus hispidus*
- *Oxyporus populinus*
- *Hapalopilus croceus* saffransticka
- *Antrodiella citrinella* citronticka
- *Gloeophyllum abietinum* granmussling (NT)
- taggsvampar: *Hydnellum aurantiacum*, *H. peckii*
- förväxlingsarter: *Phellinus nigricans*, *P. laevigatus*, *Heterobasidion* (rotticka), *Ischnoderma benzoinum*, *Antrodia serialis*

**Kärlväxter**
- *Cardamine bulbifera* tandrot
- *Polygonatum verticillatum* kransrams
- *Lunaria rediviva* månviol
- *Campanula latifolia* hässleklocka
- *Allium ursinum* ramslök
- *Elymus caninus* lundelm
- *Brachypodium sylvaticum* lundskafting
- *Stachys sylvatica* stinksyska
- *Cephalanthera rubra* och *C. longifolia*
- *Corydalis intermedia*
- *Lappula deflexa*

**Ny grupp: insekter och spår.** Detta är prioriterat, eftersom insekter finns på signalartslistan [V].
- *Tragosoma depsarium* raggbock (kläckhål)
- *Nothorhina muricata* reliktbock (gångar i solexponerad tallbark)
- *Scardia boletella* jättesvampmal (kläckhål i fnöskticka)
- *Osmoderma eremita* läderbagge (mulm, fragment)
- *Lucanus cervus* ekoxe
- *Upis ceramboides*
- *Peltis grossa*
- *Microbregma emarginatum*

Spåren ska också registreras som "art" eller struktur: ringbarkning av tretåig hackspett, bohål av spillkråka, födosökshack (spillkråka i myrstack eller stubbe) och gnag.

**Fåglar.** Lägg till *Dendrocopos leucotos*, som redan finns, med varning för förväxling med större hackspett.

### 4.2 Ta bort eller tona ned
- **Matsvampar utan indikatorvärde:** *Boletus edulis*, *Leccinum versipelle*, *Amanita muscaria*/*virosa*, *Gyromitra esculenta*, *Lactarius deterrimus*, *Cantharellus cibarius*. Behåll dem bara om de är viktiga förväxlingsarter för AI:n, men dölj dem i checklistan.
- **Kärlväxter som inte är skogsarter:** *Primula veris*, *Menyanthes*, *Drosera*, *Eriophorum*, *Andromeda*. De är rimliga i en sumpskog, men flytta dem till en "myr/kant"-lista.
- **Odlade trädslag:** *Larix decidua* och *Pinus contorta* behövs som trädslag för substrat, men inte i AI-listan.
- **Fotoigenkänning av fåglar:** korsnäbbar (*Loxia curvirostra*/*pytyopsittacus*) och mesar på foto är meningslöst (skärmbild 04: "mindre korsnäbb 70 %"). Skilj artlista från AI-kandidater.
- **RE-arter** (73 st) bort ur AI-kandidaterna.

---

## 5. Förslag på nya listvärden

### 5.1 Substrat: dela upp i snabbval i stället för en lista

1. **Trädslag:** gran, tall, björk, asp, sälg, al (klibb/grå), rönn, ek, bok, ask, alm, lind, lönn, avenbok, hassel, en, idegran, lärk, okänt löv, okänt barr.
2. **Typ:** levande träd, döende träd, torraka, högstubbe, stubbe (avverkning/naturlig), låga, rotvälta, gren/kvist (på marken/i kronan), rot, brandstubbe, bävergnagt.
3. **Del:** bark, barkfri ved, kärnved/mulm, hålighet, rothals, bas, krona, sårved/brandljud.
4. **Diameter** (i brösthöjd eller vid fyndet): <10, 10–20, 20–40, 40–60, >60 cm.
5. **Nedbrytningsklass för död ved:** fyrgradig (hård, något mjuk, mjuk, mycket mjuk/formlös), alternativt Riksskogstaxeringens eller Stoklands skala. Ange vilken.
6. **Mikromiljö:** solexponerad, halvskugga, skuggad, fuktig/bäcknära, i vatten.
7. **Icke-ved:** mark/förna, mineraljord, kalkhaltig mark, mossa, sten/block (silikat/kalk), lodyta/överhäng, häll, källa/översilning, bäck, sumpmark, annan svamp (t.ex. fnöskticka), annat.

För fåglar ersätts substrat med **observationstyp**: sång, lockläte, födosökande, bo/bohål, spår, ungar, förbiflygande. Använd Artportalens häckningskriterier.

### 5.2 Strukturer och värdeelement (ersätt och komplettera)

- **Död ved:** grova lågor (>40 cm), lågor i flera nedbrytningsstadier, rikligt med död ved (≥20 m³/ha), torrakor av tall (kelor), solexponerad död ved, brandstubbar.
- **Träd:** jätteträd/mycket grova träd, gamla träd (anges i stället för "Gamla träd" + "Senvuxna"), hålträd med mulm, vidkroniga träd, hamlade eller kulturpåverkade träd, grova aspar, grova sälgar, överståndare, döende träd, träd med brandljud, barkskador och sår.
- **Skogsstruktur:** olikåldrig/flerskiktad, luckighet, naturlig föryngring, lövsuccession efter brand, lövinslag (barrskog), kontinuitet i trädskiktet (som *bedömning* i motiveringen, inte som chip).
- **Spår av organismer:** hackspettshål/bohål, ringbarkning, kläckhål/gnag av vedinsekter, myrstackar.
- **Fysiska miljöer:** bäckravin, källa/källpåverkan, översilning, sumpstråk, strandzon, block/blockmark, hällar, bergbrant, rasbrant/talus, lodytor och överhäng, kalkpåverkan.
- **Hävd och kultur:** skogsbete, hagmarksrester, stengärdsgårdar, kolbottnar, odlingsrösen.
- **Påverkan** (behövs för biotopvärdet): spår av avverkning/stubbar, plockhuggning, gallring, dikning, körskador, invasiva arter, tät ungskog, betestryck från vilt.

### 5.3 Biotoper/naturtyper

Lägg till **Natura 2000-naturtyp** som eget fält:
- 9010 Västlig taiga
- 9020 Nordlig ädellövskog
- 9030 Landhöjningsskog
- 9050 Näringsrik granskog
- 9060 Åsbarrskog
- 9070 Trädklädd betesmark
- 9080 Lövsumpskog
- 9110 Näringsfattig bokskog
- 9130 Näringsrik bokskog
- 9160 Näringsrik ekskog
- 9180 Ädellövskog i branter
- 9190 Näringsfattig ekskog
- 91D0 Skogbevuxen myr
- 91E0 Svämlövskog
- "ingen"

Biotoplistan bör spegla Skogsstyrelsens nyckelbiotopstyper och verkliga NVI-objekt:
- barrnaturskog (gran respektive tall)
- brandpräglad tallskog
- örtrik/högörtsgranskog
- kalkbarrskog
- fjällnära skog
- lövnaturskog (asp-, björk-, alskog)
- lövbränna
- ädellövskog (ek, bok, ädellövnaturskog)
- hassellund
- barrsumpskog
- lövsumpskog
- alsumpskog
- källmiljö
- bäckravin/bäckdal
- strandskog/svämskog
- bergbrant/rasbrant
- hällmarkstallskog
- myrholme/myrkant
- trädklädd betesmark/hagmark
- skogsbete
- lövängsrest
- alléer/parkmiljö (för tätortsnära NVI)
- annat

---

## 6. Övrigt

### 6.1 Fältflödet i praktiken (regn, blockig granskog, handskar)

- **Snabbflödet** (foto → 1 s → välj → formulär → spara) fungerar bra i torrt väder. Formuläret har två `<select>`, en textarea och en kryssruta. Med blöta handskar är det i praktiken 6–10 felträffar per fynd.
  - Förvälj senaste substrat och objekt.
  - Gör antal till +/– knappar.
  - Inför ett "spara direkt"-läge.
- **Gruppchipsen** rullar horisontellt. "Lavar" är avklippt och "Svampar" och "Fåglar" syns inte alls (skärmbild 03). Använd två rader eller ikoner.
- **Resultatlistan** med 10 förslag är lång att skrolla. Visa topp 3 och "visa fler". Visa **karaktärer att kontrollera** för förväxlingsparet, till exempel:
  - lunglav eller näverlav: rygg med upphöjda åsar, undersida;
  - violettgrå tagellav eller manlav: pseudocyfeller, färg vid basen.
- **GPS i tät granskog:** spara medelvärdet av flera positioner, visa ± vid sparning och varna över 20 m. Gör det möjligt att flytta punkten på kartan.
- **Avgränsning genom att gå runt objektet:** i blockterräng eller brant går man inte gränsen. Komplettera med ritning på karta eller ortofoto, och med "buffra punkt/linje" för små objekt och linjeobjekt (bäckravin).
- **Fynd utan foto** finns, vilket är bra, men det är tre klick in. Gör det till huvudknappen i checklisteläget.
- **Datasäkerhet:** att all data bara finns i webbläsarens IndexedDB är en verklig risk med många dagars fältarbete på en enda telefon. Påminn om export varje kväll, eller synka.

### 6.2 Uppdragsnivå som saknas helt

Uppdraget behöver egna fält:
- beställare och uppdragsnamn
- inventeringsområde (polygon)
- inventerare
- datum och väder
- utgåva av SS 199000
- **detaljeringsgrad** (översikt eller detalj, med minsta karteringsenhet; jag minns 0,1 ha respektive 0,01 ha [K-medel])
- valda **tillägg**: naturvärdesklass 4, fördjupad artinventering, detaljerad redovisning av artförekomst, generellt biotopskydd, värdefulla träd m.fl.

Rapporten ska redovisa detta, och appen ska anpassa vad som är obligatoriskt.

### 6.3 Kartan

En karta utan bakgrund går att använda för kontroll men inte för arbete. Vill man undvika större nedladdningar räcker en lättviktig lösning: MBTiles eller PMTiles för ett uppdragsområde laddas ner i förväg, med ortofoto eller terrängkarta.

### 6.4 Export, detaljer

- GeoJSON i WGS84 är korrekt enligt specifikationen. Men beställare vill ofta ha **SWEREF 99 TM i GeoPackage eller Shape** med fasta attributnamn för objekt och fynd.
- Exportera **foton på objekt**, inte bara på fynd.
- Exportfält som saknas: bestämningsmetod, osäker bestämning, belägg, stadium, mängdklass och observatör.
- Generaliseringen är bara avrundning till ett fast rutnät. Följ Artdatabankens regler för skyddsklass och generalisera även objektets artlista.

### 6.5 AI-artigenkänningen: tolkning och formulering

**Hur siffrorna ska läsas av en yrkesinventerare**

- **Lavar ger rätt art som förslag 1 i under hälften av fallen (47 %).** Mossor och svampar ligger på 52–60 %. Att "topp 5" ligger på 76–95 % betyder att rätt art oftast finns *bland* fem förslag. Det är bara till nytta för den som redan kan skilja dem åt.
- **Testet är litet:** 50 bilder per grupp. Konfidensintervallet för 47 % är ungefär ±14 procentenheter. Skillnaden mellan grupperna är alltså osäker.
- **Kalibreringen gjordes på samma 249 bilder som utvärderingen.** "98 % rätt vid 90–100 %" bygger på n = 42 och är en anpassning i samma urval. Det sanna värdet kan mycket väl ligga runt 85–95 %. Kalibreringen gäller dessutom alla grupper ihop. För lavar och mossor är 90 % sannolikt mindre värt än för kärlväxter.
- **Testdatan har jämn fördelning mellan arterna (2 foton per art), men naturen har det inte.** I fält är vanliga förväxlingsarter tiotals gånger vanligare än den rödlistade arten. Om modellen säger "70 % *Chaenotheca subroscida*" är sannolikheten i verkligheten lägre, eftersom de vanliga nållavarna är så mycket vanligare (basfrekvensproblemet). Felen drabbar just de **sällsynta arter som avgör artvärdet**.
- **Sluten lista:** procenten gäller *givet att arten finns i listan*. En skorplav som inte finns i urvalet får ändå "90 %" på något som finns där. Tröskeln `LOW_SIM` fångar bara de grövsta fallen.
- **Möjligt läckage:** iNaturalist-foton från 2024–25 kan visa samma individer och träd (kända lunglavsträd, samma fotografer) som träningsdatan fram till 2023. Bestämningarna av lavar och mossor på iNaturalist och GBIF har dessutom själva en betydande felfrekvens.
- **Grupper som inte kan bestämmas på foto:** många signalarter kräver lupp, kemiska tester eller mikroskop. Det gäller t.ex. *Chaenotheca*, *Calicium*, *Bryoria* (PD/K), *Peltigera*, levermossor som *Nowellia*/*Cephalozia* och *Calypogeia*, samt *Skeletocutis* (porer, lukt). För dem ska appen säga det **i förväg**, oavsett procent.

**Risker**
1. En inventerare under tidspress accepterar ett förslag om en rödlistad art som AI:n ger som "Säker träff" eller "Trolig träff". Den förvalda bekräftelserutan gör sedan fyndet "kontrollerat". Det leder till fel artvärde, fel naturvärdesklass och ett felaktigt fynd i Artportalen som påverkar framtida bedömningar och rödlistning.
2. Det omvända: en verklig rödlistad art missas eftersom AI:n föreslog den vanliga arten med hög procent.

**Formulering i appen**
- Ta bort ordet **"Säker"**. Använd t.ex.:
  - ≥80 %: **"Starkt förslag"**
  - 45–80 %: **"Möjligt förslag"**
  - lägre: **"Osäkert, bestäm själv"**
- Visa gruppens egen siffra: *"I test var förslag 1 rätt i ungefär 5 av 10 lavbilder."*
- För **rödlistade arter, signalarter och skyddsklassade arter**:
  - Visa alltid "Kräver verifiering" och en kort lista med karaktärer att kontrollera, plus de vanligaste förväxlingsarterna.
  - Tillåt inte bestämningsmetoden "endast AI" utan att fyndet markeras som osäker bestämning.
- I exporten ska AI-förslaget och sannolikheten följa med, men **"bestämd av"** och **"metod"** ska alltid komma från människan.
- Byt den statiska texten "Procenten är kalibrerade" i README mot: *"Kalibrerad på ett litet testurval (249 bilder). Gäller arter i listan och jämnt fördelade testbilder. Sannolikheten är lägre för sällsynta arter i fält."*

**Förbättringar av själva AI:n**
- Prior per region och habitat (se topp 10, punkt 10).
- Gruppvis kalibrering med en separat valideringsmängd.
- Ett "vet ej"-alternativ (open set).
- Ljud för fåglar.
- Finjustering på verifierade svenska belägg från Artportalen. Prioritera förväxlingsparen, inte bara signalarterna.

### 6.6 Smått

- `Listera ovata` står i listan medan `Neottia cordata` har det nya namnet: var konsekvent och följ Dyntaxa.
- Enhetslistan saknar "fruktkroppar", "bålar", "substrat/träd med arten", "kolonier", "skott" och **mängdklass** (enstaka/fåtal/riklig), som används i NBI och NVI.
- Det behövs ett fält "ej återfunnen" för uppföljning av kända lokaler, där appen kan importera tidigare fynd.
- Kommentarsfält för objektets **skötselbehov** och hot (ofta efterfrågat av kommuner).
- Om-sidan säger "Signalarter enligt Skogsstyrelsens lista (urval)". Ange versionen (2023-1) och att importen är maskinell när den väl är det.

---

### Källor som användes vid verifiering
- Skogsstyrelsen: *Skogsstyrelsens signalarter – version 2023-1* (endast metadata och utdrag via sökning; PDF:en gick inte att hämta): https://www.skogsstyrelsen.se/globalassets/miljo-och-klimat/nyckelbitoper/skogsstyrelsens-signalarter---version2023-1.pdf
- Skogsstyrelsen: *Ett urval av naturvårdsarter* (2023): https://www.skogsstyrelsen.se/globalassets/miljo-och-klimat/nyckelbitoper/ett-urval-av-naturvardsarter.pdf
- SIS: SS 199000:2014, ersatt av SS 199000:2023: https://www.sis.se/en/produkter/mathematics-natural-sciences/biology-botany-zoology/ss1990002014/
- NVI-rapporter som återger bedömningsgrunderna (bl.a. Ronneby 2023, Jönköping 2022): https://infonyaronneby.ronneby.se/download/18.2510019c18da51bbb47958e8/1708326680228/Naturv%C3%A4rdesinventering%20Hoby%2019_1%20Ronneby%20kommun%2020231116.pdf, https://www.jonkoping.se/download/18.6ee7976518311c203e8831bb/1664808558760/Naturinventering%202022.pdf
- Projektets egen app/data/species.json, för alla [V]-påståenden om dubbletter, saknade kategorier och felaktiga namn.

Domänerna skogsstyrelsen.se och sv.wikipedia.org är inte tillåtna i sessionens nätverk. De behöver öppnas för att signalartskolumnen ska kunna verifieras rad för rad.

---

## 7. Kommentar till simuleringarna

**Underlag:**
- tools/SIMULATION_ID.md och tools/simulate_id.py;
- en egen omräkning av tools/cache/sim_id_results.json, märkt **[V-sim]**;
- kontroll av de åtgärdade punkterna i app.js, export.js och species.json, märkt **[V]**.

Webbläsarsimuleringen av användarhandlingar har jag inte sett några data från. Jag kommenterar den bara kort i 7.6.

### 7.1 Vad betyder siffrorna för en yrkesinventerare?

**Läs siffrorna med två förbehåll.**
- De 10 000 körningarna bygger på **samma ungefär 250 foton av 127 arter** som utvärderingen och kalibreringen. Varje foto försämras på nytt omkring 40 gånger. Den effektiva urvalsstorleken är alltså arterna, inte 10 000. Bara **17 av arterna är rödlistade** [V-sim].
- Kalibreringen gjordes på samma foton. Kalibreringstabellen är därför fortfarande i stor utsträckning en kontroll inom samma urval.

**Huvudresultatet.** Med rätt grupp vald och fältstörningar blir förslag 1 rätt i:

| Grupp | Förslag 1 rätt |
|---|---|
| Lavar | 26 % |
| Mossor | 28 % |
| Fåglar | 39 % |
| Svampar | 41 % |
| Träd | 48 % |
| Kärlväxter | 60 % |

Det är 20–30 procentenheter lägre än i EVALUATION.md. För de kryptogamer som avgör artvärdet i en skogs-NVI är förslag 1 alltså **fel i ungefär tre fall av fyra**. Rätt art finns bland topp 5 bara i 54–59 % av fallen.

**Spridningen mellan arter är större än medelvärdena antyder** [V-sim]:
- Medianarten blir rätt som förslag 1 i 40 % av fallen.
- En fjärdedel av arterna blir rätt i högst 17 % av fallen.
- **7 av 127 arter blir aldrig rätt.**

Medelvärdet döljer alltså att vissa arter i praktiken inte kan bestämmas på foto av den här modellen.

**Ett andra foto hjälper mycket:** +13 procentenheter för förslag 1 (36 till 49 %). Effekten är troligen överskattad. Simulatorn tar det andra fotot från en *annan* observation, alltså en annan individ i annat ljus. I fält är två foton av samma individ starkt korrelerade.

**Fel grupp vald (10 % av fallen):**
- Rätt art kan då aldrig hittas.
- Varningen för låg likhet visas bara i 61 % av dessa fall.
- I 39 % av fallen får användaren alltså en lista med fel arter utan någon varning.

**Kalibreringen totalt** håller hyggligt: 96 % rätt vid 90–100 % och 87 % vid 80–90 %. **Per grupp brister den** [V-sim], räknat på förslag med minst 80 %:

| Grupp | Andel rätt | n |
|---|---|---|
| Lavar | **66 %** | 38 |
| Träd | 88 % | 284 |
| Mossor | 90 % | 52 |
| Svampar | 93 % | 195 |
| Fåglar | 95 % | 295 |
| Kärlväxter | 98 % | 275 |

Ett "Starkt förslag" om en lav är alltså fel ungefär var tredje gång.

**Slutsats för yrkesbruk:**
- **Kärlväxter och träd:** ett användbart andra utlåtande.
- **Svampar och fåglar:** en lista över arter att jämföra med.
- **Lavar och mossor:** högst en påminnelse om vilka arter man ska jämföra med. Inget bestämningsverktyg.

Det stärker min huvudpoäng: appens värde ligger i protokollet, och AI-funktionen är ett tillägg.

### 7.2 Är försämringarna realistiska för skogsfält?

**Realistiska och relevanta:**
- mörker under granskärm;
- oskärpa när man håller kameran i handen i svagt ljus;
- grenar eller fingrar i bild;
- sned eller för snäv inramning, som skär bort diagnostiska delar som bålkanter, undersida eller porer;
- färgstick från skymning och skugga.

**Orealistiska eller överdrivna:**
- **JPEG-kvalitet 12–55 och 96–200 px upplösning.** En modern mobil ger inte detta, och appen sparar själv 1 600 px med kvalitet 0,85. Det förekommer bara vid kraftig digital zoom, t.ex. av en fågel i trädkronan. Dessa två störningar drar ned resultatet mer än vad som är rimligt för kryptogamer.
- **Störningarna läggs på oberoende av varandra.** I verkligheten hänger de ihop: mörker ger brus, oskärpa och färgstick samtidigt. Kombinationen 15 % mörker och JPEG-kvalitet 20 är däremot osannolik.
- **Utgångsbilderna är redan bra.** Foton från iNaturalist och Artportalen är utvalda och ofta beskurna av fotografen. Simuleringen försämrar därför "bra foton". Den saknar de typiska felen som uppstår redan när bilden tas.

**Det som saknas, i ungefärlig ordning efter hur stor betydelse det har i skogen:**
1. **Fokus på fel plan.** Autofokus väljer barken eller bakgrunden och missar en liten skorplav, en nållav eller en levermossa. Det är det vanligaste felet vid närbilder i fält. Gaussisk oskärpa på hela bilden fångar det inte.
2. **Fuktigt eller torrt tillstånd.** Lavar och mossor byter färg och form helt. Lunglav är grön när den är våt och brungrå när den är torr. Mossor krullar ihop sig när de torkar. Det är en verklig förskjutning i data, inte brus.
3. **Regndroppar eller imma på linsen och vattenfilm på objektet:** lokal oskärpa och reflexer.
4. **Motljus och stort kontrastomfång:** solfläckar under krontaket, en fågel i siluett mot himlen, utfrätta högdagrar.
5. **Blixt eller ficklampa:** platt ljus, spegling på blöta ytor, ändrad färgton. Det används ofta i mörk granskog.
6. **Snö, frost och is:** vinterinventering av tickor och hänglavar, frostade fruktkroppar.
7. **Flera arter i samma bild:** lavmosaik på bark, mosstäcke på en låga. Modellen vet inte vilken art som avses.
8. **Säsong och utvecklingsstadium:** sterila exemplar, gamla eller vittrade fruktkroppar, kärlväxter utan blommor.
9. **Rörelseoskärpa** på fåglar, och fåglar som syns delvis bakom grenar.
10. **Ingen storleksreferens.** Små och stora arter ser likadana ut på bild.

Sammantaget är simuleringen **pessimistisk när det gäller bildkvalitet** (JPEG och låg upplösning) men **optimistisk när det gäller ekologiska och fotografiska svårigheter** (fokus, fukt, mosaik, säsong). Den senare bristen väger tyngre för just signalarter. Jag bedömer att verklig träffsäkerhet för lavar och mossor i fält inte är bättre än simuleringens 26–28 %.

### 7.3 Vad säger risktabellen om att lita på appen för rödlistade arter?

Min egen omräkning av resultatfilen [V-sim]:

- **När förslag 1 är en rödlistad art är det rätt art i bara 24 % av fallen** (444 av 1 853).

  | Del av resultatet | Andel rätt |
  |---|---|
  | Lavar | 12 % |
  | Utökad lista | 12 % |
  | Skogsurvalet | 32 % |

- **Falska rödlistade förslag (1 409) är fler än alla foton av rödlistade arter (1 187).** Testet har dessutom en hög andel rödlistade arter. I fält är rödlistade arter mycket ovanligare än sina vanliga förväxlingsarter, så precisionen blir **ännu lägre** än 24 %.
- **Andelen rätt per visad sannolikhet, när förslag 1 är rödlistat:**

  | Visad sannolikhet | Andel rätt | n |
  |---|---|---|
  | under 50 % | 12 % | 1 399 |
  | 50–80 % | 47 % | 303 |
  | 80–90 % | 74 % | 57 |
  | ≥ 90 % | 95 % | 94 |

  Inte ens 80–90 % är tillräckligt för att ett fynd ska påverka naturvärdesklassen utan kontroll.
- **Appen missar ofta rödlistade arter.** En fotograferad rödlistad art hamnar som förslag 1 i bara 37 % av fallen och bland topp 5 i 62 %. I 38 % av fallen finns den rödlistade arten inte ens bland de fem förslagen. Appen går alltså **inte heller att använda för att leta efter rödlistade arter**.

**Slutsats:** ett AI-förslag om en rödlistad art eller en signalart ska behandlas som **"undersök detta"**, aldrig som ett fynd. Det får inte påverka artvärdet förrän en människa har bestämt arten med en angiven metod. Att appen nu gör det obligatoriskt är rätt och nödvändigt. Kontrollen måste dock också gälla de **räkneverk** som matar artvärdet (se 7.5).

### 7.4 Vilka av mina topp 10 påverkas?

- **Punkt 5, tillitsflödet: blir viktigare.** Delvis genomförd. Bör kompletteras enligt 7.5.
- **Punkt 10, filtrering på region och habitat: höjs i prioritet.** Den utökade listan ger 12 % rätt för rödlistade förslag. Varje irrelevant kandidat, som en havsstrandsart eller en sydlig art i Norrland, blir ett potentiellt falskt rödlistat förslag. Detta är den billigaste åtgärden mot risken i 7.3.
- **Punkt 2, checklisteläge: förstärks.** Med 26–28 % rätt för kryptogamer kan foto och AI inte vara huvudflödet. Checklistan över naturvårdsarter är det som faktiskt sparar tid.
- **Punkt 9, gränssnitt för fältbruk: utökas med fotostöd.** Oskärpa, mörker och låg upplösning kostar 20–25 procentenheter, och ett andra foto ger +13. Appen bör:
  - be om ett andra foto när förslaget är under 80 %;
  - upptäcka oskärpa och mörker och varna direkt ("ta om bilden, använd lampa eller blixt");
  - avråda från digital zoom;
  - ge vägledning om närbild med en storleksreferens.
- **Ny delpunkt till punkt 9: fel grupp.** Vid låg likhet eller låg toppsannolikhet ska appen automatiskt köra en analys mot alla grupper och fråga om det kan vara en annan grupp (t.ex. svamp eller lav). Det tar bort den tysta felvägen i 39 % av fallen med fel grupp.
- **Punkterna 1, 3, 4, 6, 7 och 8 påverkas inte** av simuleringarna.

### 7.5 Är åtgärderna i punkt 3 tillräckliga?

**Kontrollerat i koden och datan [V]:**

| Åtgärd | Bedömning |
|---|---|
| Synonymer: långskägg (*Usnea longissima*) EN, duvhök (*Astur gentilis*) NT, inga dubbletter av mina 12 | Bra |
| Lappranunkel (*Coptidium lapponicum*), skogslosta och liten baronmossa | Bra |
| "Kontrollerad" är inte förvald | Bra |
| Bestämningsmetod och osäker bestämning finns och exporteras | Bra |
| "Starkt förslag" ersätter "Säker träff", och "kräver verifiering" visas | Bra |
| RE-arter är borttagna ur kandidaterna (app.js rad 142) | Bra |

**Järnek:** jag accepterar källan och har dragit tillbaka påståendet i 2.3.

**Det som fortfarande saknas eller är fel:**

1. **Kryphål i regeln för osäker bestämning** (app.js rad 367–381).
   - Metoden förväljs till "Endast AI-förslag". Men om användaren kryssar i "Jag har själv kontrollerat" sparas fyndet **inte** som osäkert, trots att metoden fortfarande är "Endast AI-förslag". Det ger en motsägelsefull post där AI-bestämningen ser kontrollerad ut.
   - **Åtgärd:** för rödlistade arter och signalarter ska spara-knappen vara låst tills användaren valt en annan metod än "Endast AI-förslag" eller markerat fyndet som osäkert. Kryssrutan ska inte kunna ersätta metoden. Slå gärna ihop dem till ett enda val.
2. **Osäkra fynd räknas fortfarande i objektet.** `objectProps` (export.js) och objektredigeraren (app.js rad 493–494) räknar alla kopplade fynd av rödlistade arter och signalarter, även de som är markerade som osäkra. Exporten `rodlistade_arter` per objekt, och därmed underlaget för artvärdet, innehåller alltså fortfarande AI-gissningar.
   - **Åtgärd:** räkna osäkra fynd separat, t.ex. "2 rödlistade (+1 osäker)", och utelämna dem ur fältet för rödlistade arter i exporten.
   - Räkna inte heller **DD** som rödlistad i artvärdet. DD räknas i dag med eftersom koden bara kontrollerar att kategorin inte är tom.
3. **Varningen visas bara för förslag 1.** Om förslag 1 är en vanlig art och en rödlistad art eller signalart finns bland topp 5 ska appen visa "möjlig rödlistad förväxlingsart: kontrollera X". 38 % av de rödlistade fotona hamnar utanför topp 5 och 25 % hamnar på plats 2–5, så varningen behövs.
4. **"Starkt förslag" bör ha gränser per grupp.** För lavar är förslag med minst 80 % rätt i bara 66 % av fallen. Höj gränsen eller ta bort etiketten för lavar och sannolikt mossor. Gör kalibreringen per grupp, med en separat valideringsmängd som inte används för utvärderingen.
5. **Generaliseringen vid export är oförändrad** (export.js rad 71: CR/EN/VU).
   - Duvhök (NT, skyddsklassad) exporteras fortfarande exakt. Nu syns dessutom NT-badgen.
   - Objektpolygoner med artlistor generaliseras inte.
   - Detta är den åtgärd jag saknar mest bland de genomförda.
6. **Signalartsflaggorna är inte granskade.** Aspticka och pösmossa har fortfarande sig = 1. Skillnaden mellan S och E och importen av Skogsstyrelsens lista 2023-1 återstår.
7. **Kvarvarande namndubbletter** [V]:
   - "svart taggsvamp" finns fyra gånger, eftersom *Phellodon niger* har delats upp i flera arter. Lägg *P. niger* i skogsurvalet som "s. lat./artgrupp" med en tydlig text om att det krävs mikroskop.
   - "trubbig rävsvansmossa" finns två gånger (*Thamnobryum subserratum* och *T. neckeroides*). Kontrollera mot Dyntaxa.

### 7.6 Simuleringen av användarhandlingar (kort)

De fyra felen var allvarliga för fältbruk. Fel gruppetikett över ett gammalt resultat är i praktiken samma risk som en felbestämning. Att de är åtgärdade och att ingen dataförlust eller integritetsläcka hittades är bra.

Jag vill dock påpeka att testet av integritet i exporterna bara kan visa att generaliseringen gör det den är **programmerad** att göra. Det fångar inte felet i 7.5, punkt 5, eftersom kriteriet för generalisering är fel i sak.

Inför omgången med 10 000 handlingar föreslår jag att följande testas:
- att appen stängs eller kraschar mitt i en spårinspelning av gräns;
- att GPS saknas eller hoppar (±50 m) när man sparar;
- återställning av en säkerhetskopia på en enhet som redan har data, alltså dubbletter och konflikter;
- att lagringen blir full mitt i fältsäsongen;
- dubbeltryck och "spöktryck" från en blöt skärm, simulerade som slumpvisa tryck i närheten av knappen;
- att man byter art efter sparning och att AI-fälten då uppdateras konsekvent.

### 7.7 Ändras betyget?

- **Fältnytta idag: 4 → 5/10.**
  - Rättningarna av artdata och tillitsflöde tar bort de allvarligaste felen.
  - Simuleringen visar samtidigt att AI-delen är svagare i fält än utvärderingen antydde, särskilt för lavar och mossor.
  - Nettoeffekten blir +1.
  - Kryphålet i regeln för osäker bestämning, räkneverken i objektet och generaliseringen gör att jag inte går högre ännu.
- **Potential: oförändrad 8/10.** Potentialen ligger i protokollet, checklistan, kartan och exporten, inte i bildigenkänningen. Simuleringen sänker mina förväntningar på AI-delen som bestämningsverktyg, ungefär 6/10 med regionprior och finjustering. Den sänker inte förväntningarna på appen som helhet.

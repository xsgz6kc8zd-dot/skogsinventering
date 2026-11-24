# Fältexpertens rekommendation: gör appen mindre, inte större

Granskare: virkesköpare, skogstekniker/planerare och biolog (NVI enligt SS 199000, nyckelbiotoper, signalarter).
Underlag: README, `app/js/app.js` (version 1.7.0), EXPERTGRANSKNING, UX-GRANSKNING/-ÅTGÄRDER och 24 skärmbilder (ljust och mörkt tema).

**Säkerhet i texten:** **[Vet]** = jag är säker eller har kontrollerat det i koden. **[Tror-hög/medel/låg]** = min bedömning med angiven säkerhet. Uppgifter om licenser och tjänster bör kontrolleras innan de byggs in, eftersom de ändras ofta.

---

## 0. Ärligt helhetsomdöme

Användaren har rätt: appen känns stor. Det beror inte på för många skärmar, utan på att **varje skärm frågar om allt samtidigt**. Exempel från koden och skärmbilderna:

- Startsidan börjar med "Ladda ner AI-modellen (105 MB)", åtta artgruppschips och två stora knappar. Det första en inventerare möter är alltså AI, inte området man ska jobba i.
- Spara fynd har Säker/Osäker/Bara AI, sex metodchips, mängd, 19 trädslag, 14 substrattyper, 5 diameterklasser, 4 nedbrytningsklasser, antal, 10 enheter och kommentar.
- Objektprotokollet har 28 biotoper, 15 Natura 2000-koder, generellt biotopskydd, känd nyckelbiotop, **47 strukturchips** i sex grupper, 10 påverkanstyper, biotopvärde, artvärde, två motiveringar, klass och osäkerhet.
- Kartan är en svart ruta med en grön polygon.

Allt detta är fackmässigt korrekt. Det är också nästan exakt rapportmallen för SS 199000. **Men rapportmallen fylls i vid skrivbordet, inte i en granbrant i regn.** Appen försöker göra både fältjobbet och kontorsjobbet på en telefon, och då blir fältjobbet långsamt.

Det viktigaste som saknas är inte en funktion till, utan **en karta man kan orientera sig i**. Utan bakgrundskarta vet man inte var man är i förhållande till bäcken, branten, fastighetsgränsen eller den kända nyckelbiotopen. Då är appen ett anteckningsblock med GPS och inte ett fältverktyg. I dag skulle jag ha Field Maps eller QField öppet bredvid. Då har appen förlorat.

---

## 1. Vem är appen för, och vilket jobb ska den göra?

### Tre tänkbara målgrupper

| Målgrupp | Vad de gör i fält | Passar appen? |
|---|---|---|
| **A. Virkesköpare/planerare** inför avverkning | Går trakten på 1–3 timmar, markerar hänsynsytor, högstubbar, kantzoner, kulturlämningar, blöta partier och körvägar. Flaggar "här finns något, kalla på biolog". | Dåligt. De bestämmer inte arter med AI, fyller aldrig i biotopvärde/artvärde och använder redan bolagets planeringsapp, som är kopplad till traktdirektivet. Den marknaden är upptagen. |
| **B. NVI-inventerare** (konsult, kommun, länsstyrelse, skogsbolagens naturvårdsbiologer) | Går ett område, hittar och avgränsar värdekärnor, noterar naturvårdsarter och strukturer, tar foton och bedömer preliminär klass. Skriver rapporten vid skrivbordet. | **Bäst.** Appen är redan byggd kring SS 199000, checklistan och skyddsklassningen. Ingen bra mobilapp gör just detta i dag. Folk kör papper + Field Maps/QField + Excel [Tror-hög]. |
| **C. Intresserad markägare/allmänhet** | Vill veta vad som växer i skogen. | Där är AI-bestämningen kärnan, men Artportalen, iNaturalist och Skogens pärlor finns redan. Objektprotokollet är obegripligt för dem. |

### Rekommendation

**Målgrupp: B, NVI-inventeraren i skog.** Planeraren (A) kan använda samma app för en enklare "naturvärdesbedömning inför åtgärd" om fältkortet hålls kort, men appen ska inte byggas för den användaren.

**Kärnuppgift i en mening:** *"Gå ett område med karta, avgränsa värdekärnor och belägg dem snabbt med naturvårdsarter, strukturer, foton och anteckningar, så att rapporten kan skrivas hemma."*

### Vad valet betyder för innehållet

1. **Kartan och området blir navet**, inte kameran. Allt registreras *på en plats*, och objektet följer av var man står.
2. **Registrering ska ta 1–3 tryck.** En erfaren inventerare känner igen 90–95 % av arterna utan foto (samma sak sägs i EXPERTGRANSKNING). Checklista och sök är huvudvägen, AI är en reserv.
3. **Bedömningen sker i två steg:** en snabb preliminär klass i fält och den fullständiga matrisen (biotopvärde, artvärde, motiveringar, osäkerhet, Natura 2000) vid skrivbordet.
4. **Leverans och skyddsklassning stannar**, men hamnar i ett eget läge, inte i fältvyn.

---

## 2. Vad behövs verkligen i fält?

### Används varje fältdag (7 saker)

1. **Karta med bakgrund, min position och områdesgränsen.** Den används hela tiden, för att orientera sig, hitta tillbaka och se vad som är gjort.
2. **Snabb registrering av känd art på platsen.** Ett tryck från objektets lista eller från "senaste arter", med GPS. Det är 80 % av alla registreringar.
3. **Fri punkt med foto och text.** "Grov asp med hål", "kolbotten", "körskada", "kontrollera hemma". Används oftare än något artfält. **Saknas i dag** (se avsnitt 7).
4. **Avgränsa ett objekt**: rita på ortofoto, justera i fält och gå gränsen bara där den är otydlig.
5. **Kort objektkort**: biotop, ett tiotal viktiga strukturer, preliminär klass och en fri anteckning (diktering).
6. **Foton**, både på arter och på objektet som helhet.
7. **Säkerhetskopia vid dagens slut.** En knapp, eller automatiskt.

### Används ibland

- AI-bestämning från foto: några gånger om dagen för en okänd lav eller svamp, och resultatet kontrolleras ändå hemma.
- Substrat på vedlevande arter: trädslag och typ (låga, torraka, levande träd).
- Mängd i tre klasser.
- Osäker-markering på en art.
- Fynddetaljen: rätta en art eller ett felaktigt substrat.

### Används sällan eller aldrig i fält

- Uppdragsuppgifter (beställare, standard, detaljeringsgrad, tillägg). Sätts en gång, hemma.
- Natura 2000-naturtyp, generellt biotopskydd och "känd nyckelbiotop".
- Biotopvärde, artvärde, motiveringar och osäkerhet i klassningen.
- Bestämningsmetod (lupp, kemiskt test, mikroskop). Mikroskopet står hemma, så metoden sätts där.
- Diameterklass, nedbrytningsklass, antal och enhet. De behövs för vissa uppdrag (värdefulla träd, fördjupad artinventering), men inte i vanlig NVI.
- Statistikrutan "4 fynd · 3 arter · 3 rödlistade · 0 signalarter".
- Exportval, konfidentiell bilaga, återställning, "noggrann analys", tema.

---

## 3. Vad ska bort, gömmas eller flyttas?

Princip: **Fält** = det som bara kan göras på plats. **Kontor** = det som kräver eftertanke, kartor eller mikroskop. **Avancerat** = det som vissa uppdrag kräver och som man slår på per projekt.

### 3.1 Startsidan och fältvyn

| Element i dag | Åtgärd | Varför |
|---|---|---|
| "Kom igång – ladda ner AI-modellen (105 MB)" överst | **Flytta till Mer/Inställningar** som valfritt tillval. Visa en diskret rad bara när man trycker på Foto första gången. | Signalerar att appen är en AI-app. Inventeraren behöver kartpaketet för området först, inte modellen. |
| Åtta artgruppschips (Allt/Träd/Kärlv./…) på fältvyn | **Bort från huvudvyn.** Visa dem i AI-resultatet som filter: "Fel grupp? Lav · Mossa · Svamp …" och kör om. | De används bara för AI. Ingen väljer artgrupp innan hen vet vad hen ska fota. |
| "Fota okänd art" som stor grön huvudknapp | **Gör till ett av fyra val under "+"**. | Fel prioritet: kameran är reserven, inte huvudvägen. |
| "Checklista" och "Känd art (utan foto)" som två olika ingångar | **Slå ihop** till "Art": en sökruta med objektets naturvårdsarter och dagens senaste arter under. | Det är samma uppgift: "jag ser en art jag känner igen". |
| "Välj bild från galleriet" | Lägg i fotomenyn. | Används hemma, inte i skogen. |
| Tipstexter | Bort efter första dagen, eller till en hjälpsida. | |
| Aktivt objekt-raden med "vid gränsen" och Checklista | **Behåll.** Den är bra. | Det är rätt idé. Kompletteras med automatisk rumslig koppling (3.3). |

### 3.2 Registrering av fynd (spara-arket)

| I dag | Förslag |
|---|---|
| Tre lägen Säker / Osäker / Bara AI + sex metodchips + varningstext | **En växel: "Osäker ?" (av som standard).** Om fyndet kommer från AI utan att man ändrat något sätts "AI, ej kontrollerad" **automatiskt** av appen (källan finns redan i `source`). Metod flyttas till kontoret: standard är "Okulärt i fält", och lupp/mikroskop/belägg sätts vid skrivbordet. |
| Mängd (3 chips) | Behåll, på en rad. |
| Typ (14 chips) + Trädslag (19 chips) | **Visa bara för vedlevande grupper** (lav, mossa, svamp, insekt). Visa 6 vanligaste per kategori + "fler…": Gran, Tall, Björk, Asp, Ek, Sälg respektive Levande, Låga, Torraka, Högstubbe, Stubbe, Mark. Förval = senaste (finns redan, bra). |
| Diameter, nedbrytning, antal, enhet | **Avancerat**, påslaget per projekt (t.ex. vid tillägget "Värdefulla träd" eller "Fördjupad artinventering"). |
| Fågelaktivitet | Behåll **bara för fåglar** (som i dag). Den styr skyddsklassningen, så den är motiverad. Korta ner till 4 val: Häckningstecken · Revir/sång · Födosök · Förbiflygande. |
| Kommentar | Behåll, men som ett stort textfält där telefonens diktering fungerar. |

Målet: **känd art = 1 tryck (spara direkt, ångra i toasten), med detaljer = 3–4 tryck utan scroll.** Snabbsparningen finns redan via ⚡ och checklistan, så gör den till standard och formuläret till undantag.

### 3.3 Objektprotokollet: från rapportmall till fältkort

**I fält (fältkortet, en skärm, ingen flik):**

- Namn (automatiskt "Obj 3", ändras hemma).
- Avgränsning: **rita på kartan** (standard), gå gränsen (som i dag) eller ange punkt med radie för små objekt.
- **Biotop**: de 8–10 vanligaste som chips (Barrnaturskog gran/tall, Lövrik barrskog, Lövnaturskog asp/björk, Ädellövskog, Sumpskog, Bäckravin/källa, Brant/hällmark, Hagmark), "Annat…" öppnar hela listan med 28.
- **Strukturer**: 12 favoriter i stället för 47 chips i sex grupper, till exempel grova lågor, lågor i olika nedbrytningsstadier, torrakor, högstubbar/kelor, gamla/grova träd, hålträd, grova aspar/sälgar, brandspår, olikåldrig/flerskiktad, bäck/källa/översilning, block/branter/lodytor, spår av hävd. Resten under "fler…". Låt användaren själv välja favoriter per projekt.
- **Preliminär klass** 1–4 (eller "inget objekt"). En rad.
- **Anteckning** (diktering) och **foton** med riktning.
- Underlaget: "3 rödlistade · 2 signalarter" räknas automatiskt från fynden **inom polygonen** (rumslig koppling, inte "aktivt objekt"). Det är både enklare och färre fel: då behövs ingen varning om "fel objekt".

**Till kontoret (ett skrivbordsläge eller rapportverktyget):**

| Fält | Var | Kommentar |
|---|---|---|
| Natura 2000-naturtyp (15 koder) | Kontor | Kräver kartbild och bedömning av hela beståndet. Kan föreslås automatiskt från biotopen. |
| Generellt biotopskydd | Kontor/Avancerat | Bara när tillägget ingår. Juridisk bedömning, görs inte stående i bäcken. |
| Nyckelbiotop (känd) | **Automatiskt** | Läses från Skogsstyrelsens lager. Att fråga användaren är fel: hen vet inte, appen kan veta. |
| Påverkan (10 chips) | Fält som 4 chips + anteckning | Dikning, avverkningsspår, körskador, igenväxning. Resten i anteckningen. |
| Biotopvärde, artvärde + två motiveringar | Kontor | Artvärdet kan **föreslås automatiskt** från registrerade naturvårdsarter. Motiveringen skrivs bättre vid tangentbord. |
| Matrisen och slutlig klass | Kontor | Fält visar bara den preliminära klassen. |
| Osäkerhet i klassningen | Kontor | |
| Uppdrag: beställare, standard, detaljeringsgrad, tillägg | Projektinställning, en gång | Tilläggen styr vilka avancerade fält som visas, vilket är bra. |

**Var kontorsdelen ska ligga:** samma app i en surfplatta eller dator (det är en PWA, så den fungerar i webbläsaren), som en egen vy "Bearbeta objekt" med samma data. Eller så exporteras ett objekt-CSV/GeoPackage som tas vidare i QGIS och Word. Jag rekommenderar det första för klassningen och det andra för rapporten.

### 3.4 Övrigt som ska bort eller flyttas

- **Fynd-fliken med statistikrutan och tre filter:** slå ihop med Objekt till en "Lista"-flik (per objekt → fynd). Statistiken hör hemma i objektkortet.
- **Kartans legend med sju gruppfärger:** ersätt med två klasser: naturvårdsart (röd/orange med ring) och övriga (grå). Artgruppen syns när man trycker på punkten. I fält är frågan "var var den rödlistade?", inte "var var mossorna?".
- **Mer-sidan:** Leverans högst upp, med en enda knapp. Skyddsklassning på som standard, och förklaringen bakom ett "i". Den röda Internt-sektionen ska vara hopfälld. "Noggrann analys (3× långsammare)" ska bort, för ingen slår på den i fält. "Om appen" längst ned.
- **"Lagring: … ej skyddad"** är en riktig risk som ska lösas, inte visas (se topp 10, punkt 3).

---

## 4. Kartan

### 4.1 Ska kartan vara startsidan?

**Ja [Vet, av erfarenhet].** I Field Maps, QField och bolagens planeringsappar är kartan alltid startsidan. Man öppnar telefonen för att se var man är och vad som finns runt omkring, och registrerar *därifrån*. Allt annat (lista, export, inställningar) är sekundärt.

### 4.2 Bakgrundskartor, i prioritetsordning

| # | Bakgrund | Varför i fält | Källa jag känner till | Säkerhet |
|---|---|---|---|---|
| 1 | **Ortofoto** | Det man avgränsar på: lövinslag, luckor, gamla hyggeskanter, myrkanter, bäckar. Bäst för att rita polygoner. | Lantmäteriet, Ortofoto (visnings- och nedladdningstjänster). Öppna data. | Att den finns och används: [Vet]. Exakta villkor för offline-cachning av tiles: [Tror-medel], kontrollera villkoren. |
| 2 | **Terrängkarta/topografisk karta** | Höjdkurvor, bäckar, vägar, kraftledningar, ägoslag. Orientering när ortofotot är otydligt. | Lantmäteriet, Topografisk webbkarta (öppna data); alternativt OpenStreetMap-baserad vektorkarta. | Lantmäteriets karta som öppna data: [Tror-hög]. OSM: [Vet] att man **inte** får massladda tiles från tile.openstreetmap.org för offline. Bygg i så fall ett eget utdrag (t.ex. Protomaps/PMTiles). |
| 3 | **Höjdskuggning (laserdata)** | Ser bäckraviner, branter, block, gamla diken, kolbottnar och körvägar som inte syns på ortofoto. Mycket värdefull, mest vid förberedelsen men även i fält i tät skog. | Lantmäteriets markhöjdmodell (öppna data, 1–2 m grid) som man skuggar själv. Skogsstyrelsen har även färdiga terrängskuggningar i sina karttjänster. | Höjdmodell som öppna data: [Tror-hög]. Färdiga skuggningstjänster från Skogsstyrelsen: [Tror-medel]. |
| 4 | **Fastighetsgränser** | Avgörande när området följer en fastighet, och vid avverkningstrakter. Mindre viktigt för ren NVI. | Lantmäteriet, fastighetsindelning. Har enligt min kunskap blivit öppna data som en del av EU:s värdefulla datamängder (HVD) under 2025. | [Tror-medel]. Kontrollera licens och om registrering eller API-nyckel krävs. |

Ytterligare ett lager värt att nämna: **markfuktighetskartan (SLU/Skogsstyrelsen)**. Den visar blöta stråk, sumpskog och källpåverkan och är guld värd både för naturvärden och körskador [Tror-hög att den finns som öppna data, medel på formatet].

### 4.3 Tematiska lager, i prioritetsordning

| # | Lager | Varför | Källa | Säkerhet |
|---|---|---|---|---|
| 1 | **Nyckelbiotoper och objekt med naturvärden** | Det första man kontrollerar. Sätter också "känd nyckelbiotop" automatiskt. | Skogsstyrelsens geodata (nedladdning + WMS/karttjänst). | Att de finns som öppna data: [Vet/Tror-hög]. Licens och exakta adresser: kontrollera. |
| 2 | **Skyddade områden**: naturreservat, Natura 2000, biotopskyddsområden, naturvårdsavtal | Avgör om området redan är skyddat och vilka gränser som gäller. | Naturvårdsverket (Skyddade områden, öppna data) och Skogsstyrelsen (biotopskydd, naturvårdsavtal). | [Tror-hög]. |
| 3 | **Sumpskog** | Skogsstyrelsens sumpskogskartering, ger snabbt fuktiga värdekärnor. | Skogsstyrelsen. | [Tror-hög]. |
| 4 | **Fornlämningar och kulturlämningar** | Hänsyn och kulturvärden (kolbottnar, fäbodar, gränsmärken). | Riksantikvarieämbetets Fornsök/Kulturmiljöregistret (öppna data/API) och Skogsstyrelsens "Skog och historia". | RAÄ öppna data: [Tror-hög]. Skog och historia som nedladdning: [Tror-medel]. |
| 5 | **Vattendrag och sjöar** | Kantzoner, bäckmiljöer. Finns oftast redan i terrängkartan. | Lantmäteriets hydrografi, SMHI:s SVAR. | [Tror-hög]. |
| 6 | **Avverkningsanmälningar och utförda avverkningar** | Visar vad som hotas, vad som är avverkat sedan ortofotot togs och var det är bråttom. | Skogsstyrelsen. | [Tror-hög]. |
| 7 | Egna tidigare objekt och områdesgränsen från beställaren | Den viktigaste av alla, egentligen: områdesgränsen. | Import av GeoJSON/GeoPackage/Shape. | [Vet] att det är vad beställare skickar. |

**Inte** som lager: Artportalens fynd. Känsliga arter är skyddade, data kräver avtal och API-nyckel, och det lockar till att "leta efter kända fynd" i stället för att inventera [Tror-medel]. Kan läggas till senare för den som har behörighet.

### 4.4 Offline: vad som krävs och vad som är realistiskt

- **Krav [Vet]:** allt måste fungera utan täckning hela dagen. Täckningen är dålig i bäckraviner och norrländska inland. Kartan får inte vara beroende av nätet.
- **Realistiskt upplägg:** ett **områdespaket per projekt**. Man ritar eller importerar områdesgränsen, och appen (eller ett litet skrivbordsverktyg) laddar ner:
  - ortofoto och terrängkarta inom området + 500 m buffert, zoomnivå 12–18, som en PMTiles/MBTiles-fil;
  - tematiska lager klippta till samma yta, som GeoJSON (några hundra kB);
  - eventuellt höjdskuggning som rasterlager.
- **Storlek, grov uppskattning [Tror-medel]:** ortofoto ner till ca 0,5 m/pixel tar några MB per km². Ett normalt NVI-område på 1–20 km² blir alltså ca 10–100 MB. Det är rimligt jämfört med AI-modellens 105 MB.
- **Teknik [Tror-hög]:** MapLibre GL JS med PMTiles-protokollet fungerar offline i en PWA och klarar både raster och vektor. Den egna SVG-kartan i `app.js` räcker inte för bakgrundskartor och bör ersättas, inte byggas ut.
- **Juridik:** kontrollera för varje tjänst om offline-cachning är tillåten och om API-nyckel krävs (Lantmäteriet kräver i regel registrering även för öppna data, [Tror-medel]). Ange källor i appen.
- **Fallback:** om inget paket finns, visa åtminstone OSM-baserad bakgrund från ett eget utdrag, aldrig en svart ruta. En svart karta gör att appen upplevs som trasig.

---

## 5. Förslag till förenklad app

### 5.1 Struktur: tre flikar + en plusknapp

```
 Karta  ·  Lista  ·  Mer
```

- **Karta** (start): bakgrund, lager, jag, objekt och fynd. Plusknappen ligger här.
- **Lista**: projektets objekt, och under varje objekt dess fynd. Filter rödlistade/signalarter. Fynd utanför objekt i en egen grupp.
- **Mer**: projekt och områdespaket, leverans/export, säkerhetskopia, AI-modell (valfri), inställningar, kontorsläge.

Fem flikar blir tre. Fält och Karta smälter samman. Fynd och Objekt smälter samman.

### 5.2 Huvudskärmen (karta)

```
┌─────────────────────────────────────┐
│ Projekt Ödmården   GPS ±5 m   ●Spår │
├─────────────────────────────────────┤
│ ▣ Obj 3 · Granbranten · innanför  ✕ │  ← aktivt objekt (automatiskt)
├─────────────────────────────────────┤
│  [ortofoto]                    [⊕]  │  ← zoom/centrera
│      ╱‾‾‾‾‾‾‾‾╲  NB (Skogsst.)  [≡] │  ← lagerväljare
│     │ Obj 3   ●   │               │
│     │   ●  ◉ du   │                  │
│      ╲________╱    ～～ bäck         │
│   ┄┄┄┄ områdesgräns ┄┄┄┄             │
│                                     │
│                              ( + )  │  ← stor plusknapp
├─────────────────────────────────────┤
│   Karta        Lista        Mer     │
└─────────────────────────────────────┘
● = naturvårdsart   · = övrigt fynd   ◉ = du
```

Plusknappen öppnar fyra stora val:

```
┌───────────────┬───────────────┐
│  ✓  Art       │  📷 Foto      │
│  (känd)       │  (okänd art)  │
├───────────────┼───────────────┤
│  ▣  Objekt    │  ✎ Punkt/     │
│  (ny gräns)   │   anteckning  │
└───────────────┴───────────────┘
```

### 5.3 Flöde 1: morgonen (en gång per område)

1. Hemma eller på kontoret med wifi: **Mer → Nytt projekt → importera områdesgräns** (GeoJSON/Shape från beställaren) eller rita den.
2. **"Ladda ner området för offline"**: ortofoto, terrängkarta, lager (nyckelbiotoper, naturvärden, sumpskog, skyddade områden, fornlämningar, avverkningsanmälningar). Visa storleken.
3. Valfritt: AI-modellen.
4. I skogen: öppna appen → kartan, med jaget mitt i området. Spårlogg startar automatiskt.

### 5.4 Flöde 2: registrera känd art (huvudflödet, 2–3 tryck)

```
┌─────────────────────────────────────┐
│ Art · i Obj 3 Granbranten         ✕ │
│ ┌─────────────────────────────────┐ │
│ │ 🔍 Sök art …                    │ │
│ └─────────────────────────────────┘ │
│ SENAST I DAG                        │
│ [Lunglav NT ✓2] [Gränsticka VU ✓1]  │
│ [Kattfotslav  ] [Ullticka     ]     │
│ NATURVÅRDSARTER I BIOTOPEN          │
│ [Rosenticka NT] [Vedtrappmossa NT]  │
│ [Gammelgranslav] [Garnlav NT  ]     │
│ …                                   │
└─────────────────────────────────────┘
```

1. **+ → Art.**
2. **Tryck på arten** → sparad med GPS i objektet (rumsligt). Toast: "Lunglav sparad · Detaljer · Ångra".
3. (Valfritt) **Detaljer** → mängd, substrat, osäker, kommentar på en skärm utan scroll → Spara.

### 5.5 Flöde 3: okänd art

1. **+ → Foto** → ta 1–2 bilder.
2. Visa 3–5 förslag. Rad för artgrupp: "Fel grupp? Lav · Mossa · Svamp …".
3. Tryck på förslaget → sparad som **"AI, ej kontrollerad"** (automatiskt).
4. **Eller "Spara som obestämd"**: foto + position + gruppen, bestäms hemma. Det är det vanligaste i verkligheten för skorplavar och barksvampar, och det saknas i dag.

### 5.6 Flöde 4: nytt objekt

```
┌─────────────────────────────────────┐
│ Obj 4                    Klar  ✕    │
├─────────────────────────────────────┤
│ Gräns: [✎ Rita på kartan] [● Gå]    │
│        0,8 ha  ✓                    │
│ Biotop                              │
│ [Barrnatursk. gran✓][Lövrik barr]   │
│ [Sumpskog][Bäckravin][Annat…]       │
│ Strukturer (favoriter)              │
│ [Grova lågor✓][Olika nedbr.✓]       │
│ [Torrakor][Gamla träd✓][Hålträd]    │
│ [Grov asp/sälg][Bäck/källa][fler…]  │
│ Preliminär klass                    │
│ [ 1 ][ 2 ✓][ 3 ][ 4 ][Inget]        │
│ Anteckning 🎤                        │
│ ┌─────────────────────────────────┐ │
│ │ Rikligt med grova granlågor …   │ │
│ └─────────────────────────────────┘ │
│ Foton  [📷+] [▢↗NO] [▢↗S]            │
│ Underlag: 2 rödlistade · 3 signal   │
│ Nyckelbiotop (Skogsst.): Ja, delvis │
└─────────────────────────────────────┘
```

1. **+ → Objekt** → kartan går i ritläge. Tryck ut hörn på ortofotot, flytta hörn med fingret. Alternativt "Gå gränsen" där den är otydlig.
2. **Klar** → fältkortet ovan. Fyll i biotop, strukturer, preliminär klass, anteckning (diktera) och 1–3 foton.
3. Allt som registreras inom gränsen kopplas automatiskt. Gränsen kan justeras senare, och kopplingen följer med.
4. Hemma: **Mer → Kontorsläge → Obj 4**: Natura 2000, biotop-/artvärde med motivering (artvärdet föreslås), slutlig klass, osäkerhet.

### 5.7 Flöde 5: dagens slut (1 tryck)

**Mer → Säkerhetskopiera nu** (eller automatiskt vid wifi/laddning). Leverans till beställaren görs från kontoret, inte från skogen.

---

## 6. Topp 10 ändringar i prioritetsordning

| # | Ändring | Motivering från fältet |
|---|---|---|
| 1 | **Bakgrundskarta offline**: ortofoto + terrängkarta (+ höjdskuggning som tillval) via områdespaket. | Utan den kan man inte orientera sig eller avgränsa. Det är skälet till att kartan upplevs som "bara svart" och appen som oanvändbar som huvudverktyg. GPS ±10–30 m i tät granskog gör det ännu viktigare att kunna se terrängen. |
| 2 | **Kartan blir startsidan, med en plusknapp** (Art · Foto · Objekt · Punkt). Tre flikar i stället för fem. | Så fungerar alla fältverktyg som används på riktigt. En startsida med AI-nedladdning och artgruppschips säger fel sak om vad appen är till för. |
| 3 | **Projekt/område som arbetsyta** med import av områdesgränsen och paket med tematiska lager (nyckelbiotoper, naturvärden, sumpskog, skyddade områden, fornlämningar, avverkningsanmälningar). | Varje uppdrag börjar med en gräns från beställaren och kontroll av vad som redan är känt. I dag finns ingen gräns och ingen kontext. |
| 4 | **Dataskydd på riktigt**: automatisk säkerhetskopia (vid dagens slut eller vid wifi), och lös "ej skyddad lagring". | En PWA i en mobilwebbläsare kan få sin lagring rensad. Mer-sidan visar själv "ej skyddad". Att förlora en fältdag är det värsta som kan hända, och inventerare slutar använda en app efter första gången. [Tror-medel att iOS/Safari är strängare här än Android, särskilt om appen inte är installerad på hemskärmen.] |
| 5 | **Rita och justera polygoner på kartan**; att gå gränsen blir tillval. **Fynd kopplas till objekt rumsligt.** | I blockterräng, brant eller sumpskog går man inte gränsen. På ortofoto ritar man en bättre gräns på en minut. Rumslig koppling tar bort hela problemet med "fel aktivt objekt". |
| 6 | **Objektprotokollet blir ett fältkort** (biotop, 12 strukturfavoriter, preliminär klass, anteckning, foton). Natura 2000, biotopskydd, värden, motiveringar och osäkerhet flyttas till kontorsläget. Känd nyckelbiotop sätts automatiskt från lagret. | Ingen fyller i biotopvärde med motivering stående i en bäckravin. 47 chips i sex grupper betyder att man hoppar över dem och skriver i anteckningen i stället. |
| 7 | **Registrering av känd art = ett tryck.** Ersätt Säker/Osäker/Bara AI + metodchips med en osäker-växel. AI-status sätts automatiskt. Diameter, nedbrytning, antal och enhet blir avancerade fält per projekt. | 80 % av registreringarna är arter man känner igen. Varje extra tryck gånger 100 fynd om dagen är en halvtimme. |
| 8 | **Fri punkt med foto och anteckning** (typ: värdefullt träd, kulturlämning, körskada, "kontrollera", övrigt). | Det jag själv använder mest i Field Maps. I dag finns det inget sätt att spara "grov hålasp här" eller "kolbotten" utan att låtsas att det är en art. |
| 9 | **AI blir ett sekundärt verktyg**: valfri nedladdning under Mer, artgrupp väljs i resultatet, "Spara som obestämd" läggs till. | Träffsäkerheten för lavar och mossor (47–60 % topp 1) räcker inte för beslut. Värdet ligger i att fånga en okänd art med foto och position och bestämma den hemma. |
| 10 | **Förenkla kartsymbolerna och listorna**: naturvårdsart vs övrigt på kartan; Fynd + Objekt blir en Lista grupperad per objekt; Mer städas (leverans överst, internt hopfällt, "noggrann analys" bort). | I fält är frågan "var var den rödlistade och har jag täckt området?", inte "var var mossorna?". Färre val = färre felträffar med kalla fingrar. |

---

## 7. Saker som saknas helt (hårt rangordnade)

Målet är *mindre*. Bara de tre första är nödvändiga. Resten är "bra att ha" och kan vänta, eller ska inte byggas alls.

| Rang | Saknas | Bedömning |
|---|---|---|
| 1 | **Bakgrundskarta + lager + områdesgräns** (se 4) | Nödvändigt. Utan detta används appen inte som huvudverktyg. |
| 2 | **Fri punkt med foto och text** (värdefullt träd, kulturlämning, körskada, "kontrollera") | Nödvändigt. Billigt att bygga: det är ett fynd utan art. |
| 3 | **Spårlogg / täckning**: var har jag gått i dag? | Nödvändigt för NVI: beställaren frågar om hela området är genomgånget, och man ser själv luckor. Bygger på den inspelning som redan finns. Visas som en tunn linje på kartan. |
| 4 | **"Spara som obestämd"**: foto + position + grupp, bestäms hemma | Mycket värdefull och nästan gratis. |
| 5 | **Foto av objektet med kompassriktning** | Bra för rapporten och för att hitta tillbaka. Riktningen kan läsas från telefonens kompass (`deviceorientation`) [Tror-medel att det fungerar tillförlitligt i alla webbläsare; iOS kräver tillstånd]. Lågt pris om det bara blir en pil på fotot. |
| 6 | **Navigera till en punkt**: avstånd och riktning till ett tidigare fynd, objekt eller en nyckelbiotop | Används när man ska tillbaka till en låga eller visa beställaren. Enkelt med karta + "avstånd 85 m NO". |
| 7 | **Röstanteckning** | **Bygg inte en egen.** Telefonens diktering (mikrofonen på tangentbordet) fungerar redan i textfält och ger text som går att söka i. Se bara till att anteckningsfälten är stora. En separat ljudinspelning blir ofta liggande olyssnad. |
| 8 | Export i Artportalens importformat | Kontorsfunktion, nyttig men inte fält. Kan göras från CSV-exporten. |
| 9 | Synk mellan två inventerare i samma område | **Inte nu.** Kräver server, konton och konfliktlösning. Lös det med export/import av projekt. |
| 10 | Avverkningstrakt/fastighet som arbetsyta för planerare, med hänsynsytor, högstubbar och kantzoner | **Inte nu.** Det är en annan app för en annan målgrupp (se avsnitt 1), och bolagen har redan sina system. Områdespaketet i punkt 1 räcker för att en planerare ska kunna använda appen för naturvärdesdelen. |

---

## 8. Sammanfattning i en mening

Gör appen till **en karta över området där man med ett plus registrerar arter, punkter och objekt på 1–3 tryck**, flytta bedömningen och rapportmallen till kontoret, och lägg tiden på bakgrundskarta, lager och säker datalagring i stället för på fler fält.

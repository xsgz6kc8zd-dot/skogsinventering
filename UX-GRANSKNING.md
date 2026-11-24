# UX-granskning: Skogsinventering (PWA), version 1.3.0

Granskare: senior UI/UX-designer med inriktning på fältappar för inventering och GIS.
Underlag: `app/index.html`, `app/styles.css`, `app/js/app.js` (rader anges nedan), 54 skärmbilder (Pixel 7 ljust, iPhone SE, mörkt tema) och egna mätningar med Playwright (`scratchpad/ux/measure.js`, rådata i `scratchpad/ux/measure_raw.json`).
Expertgranskningen (EXPERTGRANSKNING.md) ligger till grund. Där den redan tar upp något hänvisar jag dit, till exempel "jfr 6.1", i stället för att upprepa det.

---

## 1. Helhetsomdöme

**Betyg för användbarhet i fält i dag: 5/10.**

Appen har en ovanligt gedigen fackmässig grund: skyddsklassning, SS 199000-matris, SWEREF 99 TM, checklista med ett-trycksregistrering och ångra, snabbval i stället för fritext och offline-AI. Gränssnittet är däremot byggt som en webbsida med bottenark. Det tål inte hur appen faktiskt används i fält. Formulären är långa, data kan försvinna utan varning, GPS-spårningen är bräcklig och många tryckytor är små. Inget av detta syns vid en skrivbordstest, men allt märks första regniga dagen i en granskog.

**De tre största problemen**

1. **Data kan försvinna utan varning.** Ett tryck utanför arket, krysset eller Androids bakåtknapp stänger formulär direkt, utan fråga och utan utkast (`modal()` rad 349, ingen History API). För objektprotokollet innebär det 5 skärmar ifyllt protokoll. Dessutom tappar "Byt art" allt man har fyllt i för ett nytt fynd (rad 442).
2. **GPS-data är otillförlitlig utan att användaren märker det.** Fynd sparas med en position som kan vara upp till 60 s gammal men visas som "±6 m" (`gps.fresh(60000)`, geo.js rad 81). Gränsinspelningen lever bara så länge objektarket är öppet. Den stoppas när man öppnar checklistan (rad 744), när skärmen släcks (ingen Wake Lock) och när man byter vy. Ett "aktivt objekt" förväljs dessutom tyst för alla nya fynd, också efter att man har lämnat objektet.
3. **Huvudflödena kräver för mycket scrollning och precision.** Spara-formuläret är 1 469 px högt i en vy på 772 px, och Spara-knappen ligger längst ned och är inte fast. På iPhone SE krävs fyra skärmhöjder, och där syns inte heller ett enda AI-förslag efter fotograferingen. 31 % av alla tryckytor är mindre än 44 px. Kartpunkterna är 6–8 px.

---

## 2. Mätresultat

### 2.1 Tryckytor (Pixel 7, 412×915 CSS-px, ljust tema, 14 vytillstånd)

Totalt 1 008 unika interaktiva element (per vy, klass och etikett): **311 är under 44 px** i minsta dimension (31 %) och **369 under 48 px** (37 %). Ingenting ligger mellan 48 och 56 px. Det som klarar 48 px klarar alltså också 56 px.

| Vy | Antal element | < 44 px | < 48 px |
|---|---|---|---|
| Start/Artbestäm | 17 | 10 | 10 |
| Resultat | 30 | 21 | 23 |
| Beskär | 34 | 22 | 27 |
| Spara fynd | 86 | 69 | 78 |
| Spara fågel (skyddsklassad) | 74 | 58 | 66 |
| Objektredigering | 92 | 72 | 83 |
| Checklista | 273 | 14 | 17 |
| Registrering (från checklistan) | 323 | 60 | 67 |
| Fyndlista | 11 | 3 | 4 |
| Fynddetalj | 15 | 3 | 7 |
| Objektlista | 9 | 2 | 3 |
| Mer | 16 | 2 | 8 |
| Karta | 8 | 3 | 3 |

Värst är följande, sorterat efter hur ofta de förekommer:

| Element | Storlek (px) | Var | CSS-orsak |
|---|---|---|---|
| `.chip` (artgrupp, mängd, substrat, strukturer, aktivitet) | **h 37** × 51–420 | alla formulär, 248 förekomster | `padding: 8px 14px` utan min-height |
| `.seg button` (Skogsurval/Utökad, Alla/Rödlistade, Naturvårdsarter …) | **h 36** | 10 vyer | `padding: 8px 6px` |
| `.btn.small` ("Välj", "+ Hörn här (GPS)", "● Spela in gräns", "Ångra", "Rensa", "Byt art", "✓ Checklista", "Ändra", "📷 Lägg till foto") | **h 34**, "Välj" 46×34 | resultat, objekt, spara | `.btn.small { min-height: 34px }` |
| `.thumb .x` (ta bort foto) | **26×26** | Artbestäm | ligger direkt intill bilden som öppnar beskärning |
| `circle.pt` (fynd på kartan) | **6–8** | Karta | `r=8` i en viewBox på 1 000 som skalas till ca 350 px |
| `#crop-size` (reglage) | 129×**16** | Beskär | standardreglage |
| Kryssrutor | 20×20 (etiketten gör ytan större) | Spara, Mer | `.check input` |
| `.toast-undo` "Ångra" | 52×**36** | Checklista | `min-height: 36px` |
| `select.input`, `.btn`, `.input`, `.modal-close` | **h 44** (klarar HIG men inte 48) | överallt | `min-height: 44px` |

Flikraden (82×64) och checklisteknapparna (186×90) är bra. De är de enda större ytorna som fungerar med handskar.

### 2.2 Kontrast

**Text (WCAG 1.4.3, mätt beräknat på verklig bakgrund):**

| Element | Färg på bakgrund | Kvot | Krav | Tema |
|---|---|---|---|---|
| Badge "Osäker" (`.badge.bad`) | #ff8a80 på #fde0dc | **1,83:1** | 4,5 | mörkt |
| Badge "EN" (`.rl-EN`) | #fff på #fc7f3f | **2,55:1** | 4,5 | båda |
| GPS-pill OK (`.pill.ok`, 12 px) | #fff på #2e9e4f | **3,43:1** | 4,5 | båda |
| Online-pill | #fff på rgba(255,255,255,.2) över #1f6b35 | 4,18:1 | 4,5 | ljust |

Grå hjälptext (`--muted`) håller 5,1:1 på bakgrunden och 4,67:1 på chips. Det klarar AA men inte AAA (7:1). I direkt solljus räcker det inte för fältetiketter som "Mängd", "Trädslag" och "Antal", som alla är grå och 13,6 px (`.field { font-size:.85rem; color: var(--muted) }`).

**Gränser och komponenter (WCAG 1.4.11, krav 3:1):**

| Komponent | Kvot | Konsekvens i fält |
|---|---|---|
| Ovald chip (#e6ece4) mot kort (#fff) | **1,20:1** | I solljus ser chips ut som lös text. Man ser inte att de går att trycka på. |
| Inmatningsfältens kant (`--line` #d9dfd6) mot bakgrund | **1,24–1,36:1** | Fälten "Antal" och "Kommentar" syns knappt. |
| Mörkt tema: chip mot kort | **1,20:1** | samma |
| Mörkt tema: toast #222 mot #0f1511 | **1,16:1** | Toasten flyter ihop med bakgrunden. |
| Kartsymbol "Du" (#1976d2) mot "Fågel" (#1e88e5) | **1,25:1** | Man kan inte skilja sig själv från en fågelobservation. |
| Kartsymbol "Kärlväxt" (#7cb342) mot kartbakgrund | **2,21:1** | Punkten försvinner. |
| Badge VU (#f9e814) och NT (#cce226) mot vitt kort | 1,27 / 1,45:1 | Acceptabelt, eftersom texten bär informationen. |

**Fokus:** Det finns ingen egen `:focus-visible`-stil. Webbläsarens standardring syns dåligt mot gröna primärknappar (#1f6b35).

### 2.3 Antal tryck för huvuduppgifterna

Räknat från en öppen app med modellen nedladdad. Svep = scrollgest. Systemkameran räknas som 2 tryck (avtryckare och bekräfta).

| Uppgift | I dag | Med förslagen i avsnitt 4 |
|---|---|---|
| **1. Fota okänd art → sparat fynd** med mängd, substrat (2 val), metod och "kontrollerat" | **12 tryck + 3 svep** (iPhone SE: 12 + 5). Utan att fylla i något: 6 tryck + 2–4 svep. | **8 tryck, 0 svep**. "Spara direkt" utan detaljer: **5 tryck** |
| **2. Registrera känd art i objekt via checklistan.** Första arten från start | **4 tryck + skrivning** (Objekt → Checklista → sökfält → art) | **2 tryck** (fältraden "Aktivt objekt" → art i "Senaste/vanliga") |
| … varje följande art | **2–3 tryck + skrivning** (sökningen töms inte) | **1 tryck** (lista utan sökning) eller 1 tryck + skrivning |
| … med mängd och substrat | **+5–6 tryck + 1–2 svep** (öppna art → mängd → 2 substrat → svep → Spara) | **+2–3 tryck** (mängdchips direkt i bekräftelseraden, substrat förvalt) |
| **3. Avgränsa och bedöma objekt** (6 hörn, 5 strukturer, 2 påverkan, värden, klass, 2 motiveringar) | **ca 32 tryck + 7 svep + 3 textfält**, allt i ett ark som kan stängas av misstag | **ca 27 tryck + 3 svep**, uppdelat i tre steg med autosparning. Avgränsningen körs i bakgrunden. |
| **4. Exportera till beställaren** (GeoJSON, fynd-CSV, objekt-CSV, rapport) | **ca 13 tryck + 1 svep** (Mer → svep → 4 × [knapp + delningsmål + bekräfta]) | **4 tryck** ("Leverans till beställare" ger en skyddad ZIP) |

---

## 3. Problemlista

Insats: **S** = under en timme, **M** = en halv till en dag, **L** = flera dagar.

### Kritiskt

| ID | Vy / skärmbild | Problem | Varför det spelar roll i fält | Konkret lösning | Insats |
|---|---|---|---|---|---|
| K1 | Alla ark: Spara fynd (23, 31), Objekt (10), Registrering (12) | Tryck på bakgrunden stänger arket direkt (`bg.onclick`, rad 349 och 361). Krysset och Avbryt frågar inte. Androids bakåtknapp lämnar appen eftersom ingen historikpost skapas. Arken lagrar inga utkast. | Med handskar eller regnvåt skärm är ett tryck utanför arket vanligt, och en 92vh-modal lämnar en remsa högst upp. Ett halvfärdigt objektprotokoll försvinner. | 1) Ta bort `bg.onclick` för formulärark (behåll för rena visningsark). 2) Kör `history.pushState({modal:true},'')` i `modal()`/`subModal()` och stäng det översta arket på `popstate`. 3) Sätt en `dirty`-flagga vid `input`/`click` och visa "Kasta ändringar?" vid stängning. 4) Spara utkast för objektet i `db.setKV('draft:'+ob.id, …)` var 5:e sekund. | M |
| K2 | Objekt (10_1) | Gränsinspelningen (`tracking`, rad 707) är bunden till objektarket. Den stoppas av "Öppna checklista" (rad 744 → `close()` → `stopTracking`). Stängs arket via bakgrunden fortsätter lyssnaren mot ett objekt som aldrig sparas (rad 349 anropar inte `close`). Ingen Wake Lock finns, så Geolocation stryps när skärmen släcks. | Man går gränsen i 10–30 minuter och vill samtidigt registrera arter och ha telefonen i fickan. I dag måste skärmen vara på och arket öppet hela tiden, annars blir avgränsningen trasig utan att man märker det. | Flytta inspelningen till ett globalt `state.recording = {obId, points}` som sparas löpande i IndexedDB. Visa en fast röd rad "● Spelar in gräns: Obj 1 · 14 punkter · 312 m · Stoppa" ovanför flikraden i alla vyer. Kör `navigator.wakeLock.request('screen')` under inspelning och förnya vid `visibilitychange`. Visa när det senaste glappet var över 30 s. | M |
| K3 | Spara fynd (23_3), Checklista (11) | `gps.fresh()` godtar en position som är 60 s gammal (geo.js rad 81). Etiketten visar bara "±6 m", inte positionens ålder. `quickRegister` (rad 806) sparar samma gamla punkt. | Går man 1 m/s kan fyndet hamna 60 m fel, trots att appen visar ±6 m. Det spelar roll för avgränsningen mot objekt och för Artportalen. | Använd `gps.fresh(10000)` för fynd. Visa åldern i `gpsLabel` ("±6 m · 3 s"). Om positionen är äldre än 10 s eller sämre än 20 m: visa "Väntar på bättre position …" i gult och "Spara ändå". Medelvärdesbildning: jfr 6.1. | S |
| K4 | Spara fynd (23_4: "Naturvärdesobjekt: Obj 1"), Objektlista (40) | Objektet blir "aktivt" bara när checklistan öppnas (rad 764). Det går inte att avaktivera, och det förväljs tyst för alla nya fynd, också fotofynd långt utanför (rad 420). | Efter objekt 1 går man vidare och fotograferar, och fynden hamnar i fel objekt. Artvärdet och därmed klassningen blir fel. | Visa aktivt objekt som en fast rad under rubriken: "🌲 Obj 1 – bäckravin ✕". Om fyndets position ligger utanför objektets polygon plus 25 m ska objektet inte förväljas. Visa i stället "Utanför Obj 1, koppla ändå?". Lägg till "Avsluta objekt" i checklistan. | M |
| K5 | Artbestäm-resultat (20, b_iphoneSE_20) | Efter fotot ligger tips, miniatyrer och den stora knappen "Börja om (nytt fynd)" ovanför resultaten. På iPhone SE syns inget förslag alls, och på Pixel 7 syns bara första raden, som dessutom täcks av toasten. | Man tar ett foto och ser ingenting hända. Användaren tror att appen hänger, eller svarar med ett "Välj" som döljs av toasten. | Gör fotokortet kompakt när det finns foton: miniatyrer och "+ foto" på en rad, tipsen bakom en ?-ikon, "Börja om" som en liten länk. Anropa `$('#results').scrollIntoView({block:'start'})` när `renderResults()` är klar. | S |

### Allvarligt

| ID | Vy / skärmbild | Problem | Varför det spelar roll i fält | Konkret lösning | Insats |
|---|---|---|---|---|---|
| A1 | Spara fynd (23_1–3, b_SE_23_1–4) | Formuläret är 1 469 px högt i 772 px vy, på SE fyra skärmar. Spara/Avbryt ligger sist och är inte fasta. Alla substratrader (4 × 5–19 chips) syns alltid. | Varje fynd kräver 2–4 svep och sedan ett sikte på Spara. Det tar tid och ger felträffar. | Gör en fast fot: `.modal .actions{position:sticky;bottom:calc(-18px - env(safe-area-inset-bottom));background:var(--card);padding:10px 0;box-shadow:0 -4px 12px #0001}`, med raden i `<div class="row gap actions">`. Visa Mängd och Typ och Trädslag öppna. Lägg Diameter, Nedbrytning, Antal/Enhet och Kommentar under "Fler detaljer ▾" (`<details>`), som öppnas automatiskt om de har värden. | S–M |
| A2 | Spara fynd → "Byt art" | `openSpeciesSearch` anropar `modal()`, som stänger spara-arket. Callbacken skickar `null` för nya fynd (rad 442), så mängd, substrat, kommentar och aktivitet raderas. AI-procenten för den nya arten (`prob`) går förlorad. GPS-lyssnaren `off()` anropas aldrig. | Byt art används ofta när förslag 1 var fel. Då måste man fylla i allt igen. | Rad 442: `openSaveSheet(id, state.result?.top.find(a=>a.id===id)?.p ?? null, existing ? {...o, ...collect()} : {...collect(), _draft:true})`. Låt `openSaveSheet` behandla `_draft` som förifyllt men nytt. Öppna sökningen med `subModal` så att arket ligger kvar under. Anropa `off()` före. | S |
| A3 | Alla | 311 av 1 008 tryckytor är under 44 px (se 2.1). Chips är 37 px, segmentknappar 36 px, `.btn.small` 34 px, fotokrysset 26 px och kartpunkterna 6–8 px. | Med handskar är träffytan ca 10–12 mm, alltså 55–65 px. Chips ligger med 6 px mellanrum, så man träffar grannen. | `.chip{min-height:48px;padding:10px 16px}` `.chips{gap:8px}` `.seg button{min-height:48px}` `.btn{min-height:48px}` `.btn.small{min-height:44px}` `.thumb .x{width:44px;height:44px;top:-12px;right:-12px}` `.modal-close{width:56px;height:56px}`. I resultatlistan ska hela raden vara tryckbar: `li.res{cursor:pointer}` med `onclick` på `li`. | S |
| A4 | Karta (50) | Kartan saknar panorering och zoom. Punkterna är 6–8 px. Fynd på samma plats ligger under "Du"-markören (i skärmbild 50 syns inget av de 6 fynden). Objekten går inte att trycka på. Texten är ca 8 px. "Du" och "Fågel" har nästan samma färg. Kartan skalar om till positionen "Du", så den hoppar när man rör sig. | Kartan är det enda sättet att se täckning och avgränsning i fält, och i dag kan man inte använda den till något. | 1) Rita "Du" först (under fynden) i en egen färg (#000 med vit ring), som en riktningspil. 2) `r` 14–18 i viewBox och en osynlig träffyta `<circle r="30" fill="transparent">`. 3) Klustra punkter inom 10 m och visa antalet. 4) Pinch/drag via `viewBox` (pointer events, ca 60 rader). 5) Tryck på polygon öppnar objektet. 6) Knappen "Centrera på mig" i stället för automatisk inpassning. 7) Svg-text `font-size` 40+. Bakgrundskarta: jfr 6.3. | M–L |
| A5 | Start (01), Mer (02) | Modellnedladdningen finns bara under Mer, och varningskortet på startsidan är inte en knapp. Lämnar man fliken Mer under nedladdningen ritas vyn om, förloppet försvinner och knappen kan startas igen, vilket ger dubbla 87 MB-nedladdningar (`renderMoreView` rad 916). Det finns ingen varning för mobildata, inget avbryt och inget "klart om ca 1 min". | Första intrycket är en gul text om något man måste leta upp. Går nedladdningen fel kvällen före fältdagen fungerar inte appens främsta funktion. | Gör startkortet till ett onboardingkort: "1. Ladda ner AI-modell (105 MB, wifi rekommenderas) [Ladda ner]" med förloppsindikator direkt i kortet. Lägg nedladdningsstatus i `state.download = {p, promise}` och rendera från state i alla vyer. Lägg till "Avbryt" (AbortController). Kontrollera `navigator.connection?.type === 'cellular'` och be om bekräftelse. När allt är klart: "✅ Klar för fält. Testa med en bild nu". | M |
| A6 | Checklista (11) | Läget "Naturvårdsarter" visar 439 arter i bokstavsordning (max 250 visas). Det går inte att hitta något utan att söka. Sökfältet töms inte efter registrering, så nästa art kräver att man raderar för hand. Tangentbordet täcker halva rutnätet. | Checklistan ska vara det snabba läget, men i praktiken blir det sökning, skrivning, radering och ny skrivning per art. | Överst: "Senast registrerade i uppdraget" och "Vanliga i biotopen" (från `ob.biotop`), 8–12 kort. Töm `q` och kör `blur()` efter `quickRegister`. Inför en bokstavsrad A–Ö (fast till höger) för bläddring. Visa högst 60 kort åt gången och "Visa fler". | M |
| A7 | Objekt (10_1–5) | Hela protokollet ligger i ett ark på ca 5 skärmar (grunddata, avgränsning, foton, 46 strukturchips, påverkan, arter, bedömning och fyra textfält). Bedömningen ligger längst ned, och det finns ingen översikt över vad som saknas. | Protokollet fylls i under flera besök och pauser. Man hittar inte tillbaka, och K1 gör det riskabelt. | Dela upp i tre flikar inne i arket: **Avgränsa · Beskriv · Bedöm**, med en fast fot (Spara, plus ✓/• per flik för klar eller ofullständig). Autospara varje ändring (ingen Avbryt behövs; "Ångra ändringar" i stället). Fäll ihop strukturgrupperna (`<details>`) och visa antal valda per grupp i rubriken. | M |
| A8 | Spara fynd (b_SE_23_4) | Bestämningsmetod "Endast AI-förslag" är förvald. För en rödlistad art sparas fyndet då som osäkert (rad 455), men kryssrutan "Osäker bestämning" visas okryssad. "Jag har själv kontrollerat" och "Osäker" kan kryssas samtidigt. | Användaren tror att fyndet räknas och upptäcker först i objektsummeringen att det är "osäkert räknas inte". Det ger förvirring och felaktiga artvärden. | Ersätt metod-`select` och båda kryssrutorna med en segmentrad i tre steg: **[Säker (kontrollerad)] [Osäker] [Bara AI-förslag]** plus metodchips (Okulärt, Lupp, Kemiskt, Mikroskop, Belägg). Gör att "Osäker" markeras direkt när man väljer "Bara AI" för en naturvårdsart, med texten "Räknas inte som naturvårdsart förrän kontrollerad". | S–M |
| A9 | Toast (alla skärmbilder) | Toasten visas i 2,6 s (ångra i 5 s, rad 370) och täcker innehåll (resultatknapp, formulärchips). Den saknar `role="status"`. En ny toast ersätter den gamla, så bara senaste registreringen går att ångra. "Ta bort" i registreringsarket (rad 838) raderar utan bekräftelse och utan ångra. På SE bryts "✓" till en egen rad. | Man hinner inte läsa eller ångra i fält, eftersom blicken är på arten och inte skärmen. Om man tar bort fel går fyndet inte att få tillbaka. | Ångra i 8 s, vanlig toast i 4 s. `t.setAttribute('role','status')`. Lägg toasten som en rad ovanför flikraden och lägg till `padding-bottom` på `main` medan den visas, så att den inte täcker innehåll. Gör "Ta bort" i registreringen till en ångrabar toast. `.toast span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`. | S |
| A10 | Alla formulär (23, 10, 12) | Ovalda chips har kontrasten 1,20:1 mot kortet och inmatningsfältens kanter 1,24–1,36:1 (se 2.2). Fältetiketterna är grå och 13,6 px. | I solljus syns inte vilka val som finns och vad som är fält. Valt eller ovalt syns bara på fyllnadsfärg. | `--line:#8f9c93` (3,0:1 mot #fff) för `.input` och `.chip{border:1.5px solid var(--line)}`. `.chip.on` får en ✓ före texten (`.chip.on::before{content:"✓ "}`). `.field{color:var(--text);font-weight:600;font-size:.9rem}`. | S |
| A11 | Mer (60) | Exporten består av fyra separata knappar för en leverans. Knappen "Full säkerhetskopia (ZIP, exakta uppgifter)" har samma utseende som de skyddade exporterna, och dess GeoJSON och CSV är oskyddade (rad 940–941). | Den lätta vägen, en ZIP till beställaren, läcker skyddsklassade lägen. Fyra delningar per kväll är också onödigt. | En primärknapp: **"Leverans till beställare (ZIP, skyddad)"**, som innehåller GeoJSON, båda CSV-filerna, rapport och foton på objekt med `protect:true`. Lägg säkerhetskopia och konfidentiell bilaga under en egen rubrik "Internt – innehåller exakta lägen 🔒" med varningsfärg. Visa "Senaste säkerhetskopia: i går 21:14" (jfr 6.1 om datasäkerhet). | M |

### Måttligt

| ID | Vy / skärmbild | Problem | Varför det spelar roll i fält | Konkret lösning | Insats |
|---|---|---|---|---|---|
| M1 | Flikrad, alla | Informationsarkitekturen speglar datamodellen och inte arbetsflödet. "Artbestäm" och checklistan, som är de två sätten att registrera, ligger på olika ställen (flik respektive knapp tre nivåer ned under Objekt). Mer blandar installation, export och inställningar. Upp till tre nästade ark: checklista → registrering, eller spara → sök (som stänger spara-arket). | Inventeraren tänker "jag är i objekt 3 och ser arter", inte "jag ska till fliken Objekt". | Flikar: **Fält** (kamera, checklista för aktivt objekt och "fynd utan foto" på en yta), **Fynd**, **Objekt**, **Karta**, **Mer**. Den globala raden för aktivt objekt (K4) ger ett tryck till checklistan från alla vyer. Regel: högst ett ark ovanpå en vy och högst ett underark. Sökningen ska alltid vara ett underark. | M |
| M2 | Mörkt tema (c_morkt_*) | Rubrikraden är ljusgrön (#5cbf74) över hela bredden och bländar i skymning. "Osäker"-badgen har kontrasten 1,83:1. Signalart-badgen är ljus (#dcefe0) mot mörkt. Toasten syns inte (1,16:1). | Mörkt tema används i skymning och gryning, när ögat är mörkeranpassat. Ett ljust fält stör, och statusbadgar går inte att läsa. | I mörkt tema: `header.top{background:var(--card);color:var(--text);border-bottom:1px solid var(--line)}`. `.badge.bad{background:#5c1f1b;color:#ffb4ab}`, `.badge.sig{background:#1f3d27;color:#a5e3b4}`, `.toast{background:#e8efe9;color:#0f1511}` och `.toast-undo{color:#1f6b35}`. | S |
| M3 | Rubrik (alla), badgar | GPS-pillen har kontrasten 3,43:1 vid 12 px. EN-badgen har 2,55:1. Pillen visar inte positionens ålder. "Online/Offline" tar plats men tillför inget (appen fungerar offline), och orange "Offline" ser ut som ett fel. | GPS-status är det viktigaste i rubriken men det svåraste att läsa. "Offline" i orange skapar oro i normalläget. | `.pill.ok{background:#1b6e34}` (5,9:1). `.rl-EN{color:#000!important}` (8,2:1). Byt nätverkspillen mot en status för säkerhetskopia ("💾 3 d") som blir gul efter 1 dygn. Visa "Offline" bara som en ikon. | S |
| M4 | Alla (tillgänglighet) | Chips och segmentknappar saknar `aria-pressed`, och flikarna saknar `aria-current`. Emoji i flikarna (`<span>📷</span>`) läses upp. Dialoger saknar `aria-modal`, `aria-labelledby`, flytt av fokus, fokusfälla och Esc. Toasten är inte en live-region. Kartan saknar textalternativ. Kryssrutor och fält har etiketter (bra). | VoiceOver/TalkBack används sällan i fält, men fokus och Esc behövs vid tangentbord på surfplatta och för den som har förstorat text. Kraven gäller också offentliga beställare (DOS-lagen). | `chipRow`: `aria-pressed="${selected===o}"` och uppdatering i `bindChipRows`. `render()`: `b.setAttribute('aria-current', on?'page':'false')`. `<span aria-hidden="true">📷</span>`. `modal()`: `role="dialog" aria-modal="true" aria-labelledby` (h3 får id). Sätt fokus på första h3 (`tabindex=-1`), lägg Esc-lyssnare och återställ fokus vid stängning. Kartan: `<svg role="img" aria-label="Karta: 6 fynd, 1 objekt">` och en dold lista med fynd. | M |
| M5 | Artbestäm (20), Beskär (22) | Fotokrysset (26 px) sitter i hörnet av miniatyren som öppnar beskärning. Ett fel tryck raderar fotot utan ångra. Beskärningen saknar nypzoom, och reglaget är 16 px högt. | Fotot går inte att ta om eftersom insekten flög iväg eller ljuset ändrades. | Ångrabar borttagning via toast. Flytta krysset utanför bildytan (se A3). Ersätt reglaget med knapparna `−` / `+` (48 px) och nyp på `.crop-wrap` (två pekare → `crop.s`). | S–M |
| M6 | Artbestäm (01, 20), Checklista (11) | Gruppchips rullar horisontellt både i artbestämningen (jfr 6.1) och i checklistan, där Svampar, Fåglar och Insekter inte syns. Det finns inget minne av senast valda grupp mellan sessioner. | Fel grupp ger sämre AI-svar (README) och fel urval i checklistan. | `.chips{flex-wrap:wrap}` med 4+4 i ett rutnät (`display:grid;grid-template-columns:repeat(4,1fr)`) och kortare etiketter ("Kärlv.") eller ikoner. Spara `state.group` i `settings`. | S |
| M7 | Alla registreringar | Inget haptiskt eller hörbart svar på registrering och sparning. | Blicken är på arten och inte på skärmen. Med handskar vet man inte om trycket tog. | `navigator.vibrate?.(30)` vid `quickRegister` och sparning, `vibrate([60,40,60])` vid fel eller fynd utan GPS. Inställning för att stänga av. | S |
| M8 | Artbestäm utan modell | Ett foto utan modell ger "Kunde inte analysera." och sedan ett tekniskt felmeddelande (`e.message`). | Användaren förstår inte vad som gick fel. | Kontrollera `state.modelReady` innan analysen. Visa "AI-modellen saknas. [Ladda ner nu] eller [Spara fynd utan AI → sök art]" och behåll fotot. | S |
| M9 | Objektlista (40) | Klassrutan "–" ser ut som en minusknapp. Hela raden öppnar redigering, och den 34 px höga knappen "Checklista" sitter tätt intill. "Aktivt" förklaras inte. | Felträffar: man hamnar i protokollet när man ville till checklistan. | Visa "Ej klassad" som text i rutan (`font-size:.65rem`) eller en streckad ram. Gör "Checklista" till en egen 48 px knapp på en egen rad i kortet, bredvid "Protokoll". Avstånd 12 px. | S |
| M10 | Fynddetalj (33) | "Radera" och "Redigera" har samma storlek och står bredvid varandra, med Radera till vänster. Bekräftelsen är `confirm()`. Fyndets punkt syns inte på en karta. | Risk för felträff. Man kan inte kontrollera positionen. | Gör "Radera" till en textlänk längst ned. Radera med ångrabar toast i stället för `confirm`. Mini-karta med punkt och objektpolygon (återanvänd `drawMap`). | S |
| M11 | Spara fynd, Checklista | Det går inte att lägga till ett foto i efterhand till ett checklistefynd eller ett fynd utan foto. | Man vill ofta belägga en rödlistad art som registrerades med ett tryck. | "📷 Lägg till belägg" i `openRegistration` och `openObsDetail`. Återanvänd `makePhoto`. | M |
| M12 | Mikrotext (flera) | Artnamn har liten bokstav i fyndlistan, resultaten och spara-arket ("tjäder", "lunglav") men stor i checklistan ("Duvhök"), eftersom `.sv::first-letter` inte fungerar på `inline`. Domen "lunglav är rödlistad" börjar med liten bokstav. "0.8 s" har decimalpunkt. Dagrubriken är "2026-11-23" i stället för "I dag". Termerna Fynd, Registrering och Lokal blandas. "Mer → Offline" hänvisar till ett kort, inte en meny. "Utökad (alla rödlistade)" bryts på SE. | Små inkonsekvenser sänker förtroendet för en app som annars är noggrann. | `.sv{display:inline-block}`. `toFixed(1)` → `toLocaleString('sv-SE',{maximumFractionDigits:1})`. Dagrubrik: "I dag", "I går", sedan "mån 23 nov". Ett ord: **Fynd** (och "ny lokal" → "nytt fynd, ny plats"). Segmentetikett: "Skogsurval" / "Alla rödlistade". | S |

### Kosmetiskt

| ID | Vy | Problem | Varför | Lösning | Insats |
|---|---|---|---|---|---|
| C1 | Artbestäm (01) | Tipstexten (tre rader) visas alltid. | Tar skärmyta från resultaten. | Visa tipset de första 3 gångerna, sedan bakom en ?-ikon. | S |
| C2 | Flikrad | Emoji-ikoner ser olika ut på olika plattformar, och `grayscale(.6)` gör inaktiva flikar grumliga. Etiketterna är 11,2 px. | Konsekvens och läsbarhet. | Inline-SVG-ikoner (24 px, `currentColor`). `nav.tabs button{font-size:.8rem}`. | S |
| C3 | Rubrik | Logotyp och namn tar 52 px höjd på varje vy. | Skärmyta på små telefoner. | Kortare namn eller bara ikonen. Låt raden för aktivt objekt (K4) få platsen. | S |
| C4 | Animering | `.btn:active{transform}` och spinnern respekterar inte `prefers-reduced-motion`. | WCAG 2.3.3 (AAA), en mindre sak. | `@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}.btn:active{transform:none}}` | S |
| C5 | Resultat | Procentkolumnen (74 px) och 1,5 rem gör att det vetenskapliga namnet radbryts ("Lobaria / pulmonaria"). | Svårläst. | `.res .pct{width:56px}`. Lägg det vetenskapliga namnet på en egen rad (`display:block`). | S |

---

## 4. Förslag på omdesign

### 4.1 Fältläget: ett ställe för att registrera (kamera, checklista och utan foto)

**Steg**
1. Fliken **Fält** öppnas alltid. Överst finns en fast rad för aktivt objekt. Den ändrar färg om man befinner sig utanför polygonen.
2. Två stora knappar: **📷 Fota okänd art** och **✓ Checklista**. Sökfältet "Känd art …" ligger direkt under.
3. Under knapparna visas "Senast registrerat" med de 6 senaste arterna i uppdraget, så att man kan registrera samma art på en ny plats med ett tryck.
4. Det globala statusfältet (GPS med ålder, inspelning och säkerhetskopia) ligger ovanför flikraden.

```
┌──────────────────────────────────────┐
│ 🌲 Obj 3 – Granbranten        [✕]   │  ← aktivt objekt (grön = innanför)
│ GPS ±5 m · 2 s     💾 i går 21:14    │
├──────────────────────────────────────┤
│ ┌───────────────┐ ┌───────────────┐  │
│ │  📷           │ │  ✓            │  │  ← 2 × 96 px
│ │  Fota okänd   │ │  Checklista   │  │
│ └───────────────┘ └───────────────┘  │
│ ┌──────────────────────────────────┐ │
│ │ 🔍 Känd art (utan foto) …        │ │  ← 56 px
│ └──────────────────────────────────┘ │
│ Senast i uppdraget                   │
│ [Lunglav ✓3] [Gränsticka ✓1]         │  ← 1 tryck = nytt fynd här
│ [Långfliksmossa] [Kattfotslav]       │
├──────────────────────────────────────┤
│ ● Spelar in gräns · 14 p · 312 m [■]│  ← bara när inspelning pågår
├──────────────────────────────────────┤
│  Fält   Fynd   Objekt  Karta  Mer    │
└──────────────────────────────────────┘
```

### 4.2 Fota → förslag → spara (kompakt)

**Steg**
1. Fotot tas. Fotokortet krymper till en rad med miniatyrer och "+ Närbild", och vyn rullar till resultaten.
2. De tre bästa förslagen visas som hela tryckbara rader (jfr 6.1 för "visa fler" och karaktärer). Ett **långt tryck** eller knappen ⚡ betyder "spara direkt" med senaste mängd och substrat.
3. Ett vanligt tryck öppnar ett **kort spara-ark** (en skärm): status i tre steg, mängd, typ och trädslag (förvalt senaste) och en fast fot med Spara. Resten ligger under "Fler detaljer".
4. Spara ger en vibration och toasten "Sparat: Lunglav · Obj 3 · ±5 m [Ångra]" (8 s).

```
┌──────────────────────────────────────┐
│ [▣][▣] + Närbild         Börja om ↺ │
├──────────────────────────────────────┤
│ Förslag · Lavar · 0,8 s              │
│ ⚠ Möjligt – jämför alternativen      │
│ ┌──────────────────────────────────┐ │
│ │ 65 %  Lunglav            NT   ⚡ │ │  ← hela raden = Välj (72 px)
│ │       Lobaria pulmonaria         │ │
│ ├──────────────────────────────────┤ │
│ │ 12 %  Näverlav                   │ │
│ ├──────────────────────────────────┤ │
│ │  6 %  Skrovellav                 │ │
│ └──────────────────────────────────┘ │
│ Visa 7 till ▾     Ingen stämmer 🔍   │
└──────────────────────────────────────┘

 Spara-ark (en skärm):
┌──────────────────────────────────────┐
│ Lunglav  NT · AI 65 %     [Byt art] │
│ Bestämning                           │
│ [Säker ✓] [Osäker] [Bara AI]         │  ← 3-läges, 48 px
│ Metod  [Okulärt][Lupp][Kem.][Belägg] │
│ Mängd  [Enstaka][Fåtal][Riklig]      │
│ Typ    [Lev. träd][Låga][Torraka]…   │
│ Träd   [Gran][Asp][Sälg][Björk]…     │
│ ▸ Fler detaljer (antal, ⌀, nedbr., …)│
│ Obj 3 – Granbranten · ±5 m · 2 s     │
├──────────────────────────────────────┤
│ [ Avbryt ]   [      SPARA      ]     │  ← sticky, 56 px
└──────────────────────────────────────┘
```

### 4.3 Naturvärdesobjekt i tre steg, med avgränsning i bakgrunden

**Steg**
1. **Avgränsa.** Välj sätt: "Gå gränsen" (spår i bakgrunden med Wake Lock, se K2), "Sätt hörn" eller "Rita på karta" (jfr 6.1 och 6.3). Efter start stängs arket. Inspelningsraden syns i alla vyer, och man kan registrera arter i checklistan samtidigt. "Stoppa" stänger polygonen och visar area.
2. **Beskriv.** Biotop, Natura 2000, skydd, strukturer (hopfällda grupper med antal) och påverkan. Varje ändring sparas direkt.
3. **Bedöm.** Underlaget från checklistan överst ("3 rödlistade, 2 signalarter, 1 osäker räknas inte"), sedan biotopvärde och artvärde som segmentknappar (inte select). Matrisförslaget visas som en stor ruta med "Använd", därefter osäkerhet och motiveringar.
4. Flikmarkeringen visar vad som saknas (• = ofullständig). Inga data går förlorade, eftersom allt sparas löpande.

```
┌──────────────────────────────────────┐
│ ← Obj 3 – Granbranten                │
│  [Avgränsa ✓] [Beskriv •] [Bedöm •]  │
├──────────────────────────────────────┤
│ Biotopvärde                          │
│ [obetydligt][visst][påtagligt][högt] │
│ Artvärde   underlag: 3 RL · 2 S      │
│ [obetydligt][visst][påtagligt][högt] │
│ ┌──────────────────────────────────┐ │
│ │ Förslag: KLASS 2 – Högt          │ │
│ │ naturvärde          [Använd]     │ │
│ └──────────────────────────────────┘ │
│ Osäkerhet  [Låg][Medel][Hög]         │
│ Motivering biotopvärde  🎤           │  ← röstinmatning via tangentbordet
│ ┌──────────────────────────────────┐ │
│ └──────────────────────────────────┘ │
├──────────────────────────────────────┤
│ Sparat automatiskt 14:02   [Klar]    │
└──────────────────────────────────────┘
```

---

## 5. Snabba förbättringar (under en timme var)

1. **Ta bort stängning vid tryck på bakgrunden** för formulärark (rad 349 och 361: villkora med `if (!bg.dataset.form)`). (K1, delvis)
2. **Fast Spara-fot** i alla ark (`.actions{position:sticky;bottom:…}`, se A1).
3. **Rulla till resultaten** efter analysen och fäll ihop tips och "Börja om" (K5).
4. **GPS-ålder:** `gps.fresh(10000)` för fynd och visning av ålder i `gpsLabel` (K3).
5. **Tryckytor:** `min-height:48px` på `.chip`, `.seg button` och `.btn`, 44 px på `.btn.small`, 44 px på fotokrysset (A3).
6. **Kontrastkanter:** `--line:#8f9c93`, kant på `.chip`, ✓ i `.chip.on` och mörka fältetiketter (A10).
7. **"Byt art" behåller ifyllda data** (rad 442, A2).
8. **Tydlig osäker-status:** kryssa "Osäker" automatiskt (`change` på `#sv-method`) och gör kryssrutorna ömsesidigt uteslutande (A8, första steget).
9. **Toast:** ångra i 8 s, `role="status"`, ingen radbrytning, ångrabar "Ta bort" i registreringen (A9).
10. **Töm checklistans sökning** efter registrering (A6, första steget).
11. **Mörkt tema:** mörk rubrik, mörka badgar och ljus toast (M2).
12. **Kontrast på pill och badge:** `.pill.ok` #1b6e34 och `.rl-EN` med svart text (M3).
13. **Vibration** vid registrering och sparning (M7).
14. **`.sv{display:inline-block}`**, decimalkomma och "I dag" (M12).
15. **Ladda ner-knapp direkt i varningskortet** på startsidan (A5, första steget).

---

## 6. Det som är bra och ska behållas

- **Ett tryck i checklistan med ångra.** Det är rätt grundmönster för fält. Behåll det och bygg ut runt det.
- **Snabbval i stället för fritext** för substrat, strukturer, påverkan och aktivitet, och **senaste substrat förvalt**.
- **Stora primärknappar** (Ta foto, 64 px), **flikraden** (64 px hög) och **checklistekorten** (90 px) har rätt storlek.
- **Ärlig AI-kommunikation:** dom i tre nivåer (starkt, möjligt, osäkert), släktesfallback, varning för låg likhet och kravet på verifiering för rödlistade arter och signalarter.
- **Skyddsklassning integrerad i flödet:** varning i spara-arket och aktivitetsval för fåglar.
- **Matrisförslag med "Använd"**, och spärr för klass 4 när tillägget inte ingår. Det är bra domänlogik i gränssnittet.
- **Atomiska skrivningar** (`db.atomic`) och **skydd mot dubbeltryck** på Spara.
- **Ljust tema märkt "bäst i solljus"**, `font-size:16px` på inmatningsfält (ingen iOS-zoom) och `inputmode="decimal"`.
- **SWEREF 99 TM och ± synligt** vid sparning, och GPS-pill alltid synlig.
- **Offline fullt ut,** med ärlig lagringsstatus ("ej skyddad mot rensning").

---

## 7. Rekommenderade tester med riktiga användare

### Det som bara kan avgöras i fält

- **Träffsäkerhet med handskar** (tunna arbetshandskar och tjocka vinterhandskar) och med våt skärm. Mät felträffar per 100 tryck på chips (37 px nu, 48 px efter åtgärd) och på "Välj".
- **Läsbarhet i solljus, i halvskugga under gran och i skymning**, med auto-ljusstyrka på och av. Klarar kanterna (A10) och de grå etiketterna 3:1 och 4,5:1 i praktiken?
- **GPS i sluten granskog och ravin:** hur ofta är positionen äldre än 10 s eller sämre än 20 m? Hur ser en inspelad gräns ut jämfört med en GNSS-referens? Vad händer när skärmen släcks?
- **Batteri:** en hel dag med GPS-bevakning, Wake Lock under avgränsning och modellen i minnet.
- **Arbetsrytm:** när växlar inventeraren mellan checklista och kamera, och hur ofta byter man objekt? Det avgör om fliken Fält i 4.1 är rätt.
- **Enhandsgrepp:** når tummen Spara och stängningskrysset (det sistnämnda sitter uppe till höger och gör det inte på stora telefoner)?
- **Röstinmatning** av motiveringar och kommentarer i vind och regn.

### Upplägg för ett pilottest

1. **Deltagare:** 5–6 inventerare med olika erfarenhet (2 seniora konsulter, 2 juniora och 1–2 från länsstyrelse eller kommun som beställare för exporten). Både Android och iPhone, minst en liten skärm.
2. **Förberedelse:** installera på deltagarnas egna telefoner hemma, utan hjälp. Mät tid och felsteg i startflödet (A5). Det är ett test i sig.
3. **Fältdag 1, styrda uppgifter** (2 h i ett känt objekt med kända arter utplacerade eller förmarkerade):
   - fota och spara 5 okända arter;
   - registrera 15 kända arter via checklistan, varav 5 med mängd och substrat;
   - avgränsa ett objekt genom att gå gränsen och samtidigt registrera arter;
   - bedöm objektet.
   Mät tid per uppgift, tryck och felträffar (logga `pointerdown` med koordinater och mål i en testbygge-flagga) samt antal ångra.
4. **Fältdag 2–5, eget arbete i verkliga uppdrag.** Appen loggar anonymt fynd utan GPS, positionsålder vid sparning, stängda ark med osparade data, avbrutna inspelningar och tid från foto till sparat.
5. **Kvällsintervju** varje dag (15 min) och SUS-enkät efter vecka 1. Exportera till en riktig beställare och fråga beställaren om leveransens innehåll och format.
6. **Kriterier för godkänt:**
   - ett fotofynd med detaljer under 30 s och högst 8 tryck;
   - en checklisteart under 3 s;
   - 0 förlorade formulär;
   - minst 95 % av fynden med en position som är under 10 s gammal och under 20 m;
   - SUS över 75.
7. **Iterera:** åtgärda K1–K5 och A1–A3 före piloten. Annars mäter piloten bara de kända bristerna. Upprepa fältdag 1 med samma deltagare efter åtgärderna och jämför.

# Simulering: 10 000 användarhandlingar i webbläsaren

`tools/simulate_ui.js` kör appen i Chromium med mobilskärm (Pixel 7). Den gör slumpmässiga men
realistiska handlingar och kontrollerar efter varje steg att datan är konsistent: inga föräldralösa
foton, inga fynd som pekar på raderade objekt eller saknade foton, att exporterna stämmer med
databasen och att visat resultat gäller vald artgrupp.

Handlingarna omfattar foto, beskärning, artgruppsbyte, spara, redigera, radera, snabbfynd,
naturvärdesobjekt med GPS-promenad, kartklick, export, återställning från säkerhetskopia,
offline/online, omladdning, slumpmässiga tryck och GPS-förflyttning.

## Omgång 1 (1 750 handlingar, appversion 1.0.1): fel som hittades och åtgärdades

| Fel | Följd i fält | Åtgärd |
|---|---|---|
| Gammalt analysresultat visades under ny gruppetikett efter gruppbyte | Man kunde välja art ur fel lista | Resultatet knyts till foton, grupp och lista och visas bara om allt matchar |
| Inaktuella analyser köades i AI-arbetaren | Analyser på upp till 60 s vid snabba gruppbyten | Fotots inbäddning cachas, så gruppbyte rankar bara om (direkt) |
| Foto och fynd sparades i separata steg | Föräldralösa foton om appen stängs mitt i en sparning | Sparning och radering sker i en enda IndexedDB-transaktion; skydd mot dubbeltryck |
| Fynd refererar arter via listindex | Fel art på gamla fynd efter uppdatering av artdatabasen | Vetenskapligt namn sparas, och fynden kopplas om vid start |

## Omgång 2 (10 000 handlingar, appversion 1.1.0, fyra parallella webbläsare)

| Mått | Resultat |
|---|---|
| Handlingar | 10 000 |
| Sparade / raderade fynd | 544 / 127 |
| Skapade/ändrade objekt | 253 |
| Omladdningar / offline-växlingar | 118 / 212 |
| Exporter kontrollerade mot databasen | 82 |
| Återställningar från säkerhetskopia | 49 |
| **Brott mot dataintegritet** | **0** |
| **JavaScript-fel i appen** | **0** |
| Analystid (median / 90:e percentil / max) | 2,3 s / 4,3 s / 12 s med fyra webbläsare på samma CPU |

**Kvarvarande avvikelser är fel i testmiljön och simulatorn, inte i appen:**
- **132 exporter gav ingen nedladdning.** Samma sak händer med en ren nedladdning av en blob i headless
  Chromium i offlineläge (1 av 6), även utan appens kod.
- **26 analyser "hängde".** Simulatorn försökte byta flik medan en dialog var öppen och fotograferade i en
  dold flik. Efter rättning i simulatorn: 0 av 700 handlingar.
- **24 klick på element som renderats om** under klicket. Det är simulatorns tidsberoende.

## Omgång 3 (10 000 handlingar, appversion 1.2.0: checklista, objektprotokoll, uppdrag)

Nya handlingar i simulatorn: checklista per objekt (registrera, ångra, mängd, substrat, ny lokal, ta bort),
ändra uppdrag, foton på objekt, Natura 2000-val samt export av objektprotokoll och rapportunderlag. Ny
kontroll: varje foto hör till ett fynd eller ett objekt, och varje objekt har sina foton kvar.

| Mått | Resultat |
|---|---|
| Handlingar | 10 000 (varav 522 checklisteomgångar, 116 ändringar av uppdrag) |
| Sparade / raderade fynd | 448 / 97 |
| Skapade/ändrade objekt | 243 |
| Omladdningar | 111 |
| **Brott mot dataintegritet** | **0** |
| **JavaScript-fel i appen** | **0** |
| **Hängda analyser** | **0** (median 2,3 s, max 11 s) |

Kvarvarande avvikelser är desamma som i omgång 2: nedladdningar i headless Chromium (107) och klick på element
som renderats om under klicket (10).

## Omgång 4 (appversion 1.5–1.7, efter UX-granskningen)

Simulatorn anpassades till det nya gränssnittet och fick nya handlingar:
- Androids bakåtknapp
- ⚡ spara direkt och "Senast registrerat"
- byt art i spara-formuläret och val av bestämningsstatus
- objektprotokoll i tre flikar med autosparning och "Ångra ändringar"
- gränsinspelning i bakgrunden och att stoppa den
- avsluta aktivt objekt och öppna checklistan från raden för aktivt objekt
- leverans-ZIP

**Fel som hittades och åtgärdades:**
- **Bakåt lämnade appen** från alla flikar. Nu leder bakåt till Fält.
- **Ett objekt kunde peka på ett raderat foto** när inspelning och redigering skedde samtidigt (två skrivare med gamla kopior).
- **AI-motorn kunde inte starta** när service workern inte styrde sidan. Motorn läses nu direkt ur cachen.

**Slutkörning på version 1.7 (4 × 2 500 handlingar):**

| Mått | Resultat |
|---|---|
| Handlingar | 10 000 |
| Sparade / raderade fynd | 418 / 82 |
| Objekt | 176 |
| Exporter kontrollerade mot databasen | 60 |
| Omladdningar / lämnade appen via bakåt och startade om | 115 / 17 |
| **Brott mot dataintegritet** | **0** |
| **JavaScript-fel i appen** | **0** |
| **Hängda analyser** | **0** (median 1,3 s, max 2,5 s) |

Kvarvarande avvikelser kommer från testmiljön: nedladdningar i headless Chromium (107) och `fill` på fält i en ihopfälld sektion (34).

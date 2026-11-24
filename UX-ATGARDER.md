# Åtgärder efter UX-granskningen

Granskningen finns i [`UX-GRANSKNING.md`](UX-GRANSKNING.md). Ändringarna gjordes i appversion 1.4–1.7.

## Mätt före och efter

Mätningen gjordes med `tools/ux_measure.js`: Playwright på Pixel 7, ljust och mörkt tema, samma vyer.

| Mått | Före (1.3) | Efter (1.7) |
|---|---|---|
| Tryckytor under 44 px | 311 av 1 008 | **5** (kryssrutor i rader som själva är 44 px höga) |
| Tryckytor under 48 px | 369 | 76 (nästan alla exakt 44 px: små knappar, ångra, raden för aktivt objekt) |
| Kontrastbrister för text (WCAG AA) | 8 | **0** |
| Kartpunkternas tryckyta | 6–8 px | 43 px |
| Tryck: foto → sparat fynd | 12 tryck och 3 svep | **2** med ⚡, eller ca 6 via formuläret (ingen scroll till Spara) |
| Tryck: checklista, första arten | 4 | **2** (Checklista i raden för aktivt objekt → art) |
| Tryck: checklista, nästa art | 2–3 (radera sökning) | **1** |
| Tryck: leverans till beställare | ca 13 | **2** (Mer → Leverans, ZIP via dela-menyn) |

## Status per problem

✅ = åtgärdat · ◐ = delvis · ○ = kvar

### Kritiskt
| ID | Status | Vad som gjordes |
|---|---|---|
| K1 Data försvinner | ✅ | Formulärark stängs inte av tryck utanför. Androids bakåtknapp stänger översta arket. "Kasta ändringarna?" vid osparat. Objektprotokollet autosparas. |
| K2 Gränsinspelning | ✅ | Global inspelning med Wake Lock och röd statusrad i alla vyer. Fortsätter när arket stängs och återupptas efter omstart. Varnar när det kommit glapp längre än 30 s. |
| K3 Gammal GPS-position | ✅ | Åldern visas och sparas (`pos.age`). Varning vid > 10 s eller > 20 m. Gamla positioner (> 2 min) används inte. |
| K4 Fel objekt | ✅ | Fast rad för aktivt objekt med innanför/vid gränsen/utanför och ✕. Objektet förväljs inte när du står mer än 25 m utanför det. |
| K5 Resultat syns inte | ✅ | Fältvy med kompakt fotokort. Vyn rullar automatiskt till förslagen. |

### Allvarligt
| ID | Status | Kommentar |
|---|---|---|
| A1 Långt spara-formulär | ✅ | Fast Spara-fot. Diameter, nedbrytning, antal och kommentar under "Fler detaljer". |
| A2 Byt art raderar | ✅ | Sökningen öppnas ovanpå. Ifyllda val följer med till den nya arten. |
| A3 Små tryckytor | ✅ | Se mätningen ovan. |
| A4 Kartan | ◐ | Panorering, nyp- och hjulzoom, centrera på mig, visa allt, större punkter och tryck på objekt. **Kvar:** klustring och bakgrundskarta. |
| A5 Modellnedladdning | ◐ | Knapp och förlopp direkt på startsidan, en enda nedladdning oavsett vy, varning vid mobildata. **Kvar:** möjlighet att avbryta nedladdningen. |
| A6 Checklistan | ◐ | "Senast i uppdraget" överst, sökningen töms efter registrering, 60 kort åt gången. **Kvar:** bokstavsregister och "vanliga i biotopen". |
| A7 Objektprotokollet | ✅ | Tre flikar (Avgränsa · Beskriv · Bedöm) med ✓/•, autosparning, Ångra ändringar och ihopfällda strukturgrupper. |
| A8 Osäker-status | ✅ | Val i tre lägen (Säker · Osäker · Bara AI) med metodchips och förklarande text. |
| A9 Toast och ångra | ✅ | 8 s med ångra, `role="status"`, ingen radbrytning. Borttagning går att ångra överallt. **Kvar:** bara senaste händelsen kan ångras. |
| A10 Kontrast | ✅ | Kanter på chips och fält, ✓ i valda chips, mörka etiketter. |
| A11 Export | ✅ | Primärknapp "Leverans till beställare (ZIP, skyddad)". Säkerhetskopia och konfidentiell bilaga ligger i en röd sektion "Internt", och säkerhetskopian innehåller bara återställningsdata. Påminnelse om säkerhetskopiering (💾 i rubriken). |

### Måttligt och kosmetiskt
| ID | Status | Kommentar |
|---|---|---|
| M1 Informationsarkitektur | ◐ | Fliken Fält samlar foto, checklista, känd art och senast registrerat. Bakåt från andra flikar går till Fält. Artsök är ett underark vid Byt art. |
| M2 Mörkt tema | ✅ | Mörk rubrik, läsbara märkningar, ljus toast. |
| M3 Statusrad | ✅ | Kontrast i GPS-pillen och märkningar. Nätverksstatus visas bara som ikon när nätet saknas. Status för säkerhetskopia. |
| M4 Tillgänglighet | ◐ | `aria-pressed`, `aria-current`, `aria-modal`/`aria-labelledby`, fokus och Esc, `aria-hidden` på emoji, textalternativ för kartan. **Kvar:** fokusfälla i dialoger. |
| M5 Foto och beskärning | ◐ | Krysset är 44 px, borttagning går att ångra, beskärning har ± knappar. **Kvar:** nypzoom i beskärningen. |
| M6 Gruppchips | ✅ | Rutnät 4 × 2. Vald grupp sparas. |
| M7 Vibration | ✅ | Vid registrering och sparning, med ett annat mönster utan GPS. Kan stängas av. |
| M8 Ingen modell | ✅ | Tydligt kort med "Välj art själv" och "Ladda ner". Fotot behålls. |
| M9 Objektlista | ✅ | Kort med separata knappar för Protokoll och Checklista. "Ej klass" i stället för "–". |
| M10 Fynddetalj | ◐ | Radera som länk med ångra. **Kvar:** minikarta. |
| M11 Belägg i efterhand | ✅ | "Lägg till belägg" i registrering och fynddetalj. |
| M12 Mikrotext | ✅ | Versaler i artnamn, decimalkomma, "I dag/I går", "Alla rödlistade". |
| C1 Tips | ✅ | Visas de tre första gångerna. |
| C2 Ikoner | ○ | Emoji finns kvar (döljs för skärmläsare). |
| C3 Rubrikens höjd | ○ | |
| C4 Rörelse | ✅ | `prefers-reduced-motion`. |
| C5 Procentkolumn | ✅ | Det vetenskapliga namnet står på egen rad. |

## Fel som simuleringarna hittade på vägen

Alla är åtgärdade.

- **Bakåt lämnade appen** från alla flikar. Nu leder bakåt först till Fält.
- **Objekt kunde peka på ett raderat foto** när gränsinspelning pågick samtidigt som objektet redigerades. Två skrivare använde var sin gammal kopia. Båda läser nu färsk data först.
- **AI-motorn kunde inte starta** om service workern inte styrde sidan när motorfilen hämtades. Arbetaren läser nu modell och motor direkt ur cachen och kontrollerar filen.

# Publicera appen och testa på en riktig telefon

Appen är en vanlig webbapp (PWA) i mappen `app/`. Den måste serveras över **HTTPS**. Det krävs för
kamera, GPS och offlineläge. Allt i mappen är statiska filer, och ingen server eller databas behövs.

## Alternativ A – Netlify Drop (snabbast, gratis, inget konto krävs för att prova)

1. Ladda ner repot till en dator: *Code → Download ZIP*. Packa upp det.
2. Gå till <https://app.netlify.com/drop>.
3. Dra mappen **`app`** dit, alltså hela mappen, inte filerna en och en.
4. Inom ungefär en minut får du en adress, t.ex. `https://namn-123.netlify.app`. Öppna den i mobilen.

Utan konto raderas sidan efter en timme. Med ett gratis konto ligger den kvar och kan uppdateras genom att man drar
mappen igen.

## Alternativ B – GitHub Pages (det här repot)

Repot är publikt, så GitHub Pages är gratis. Arbetsflödet `.github/workflows/pages.yml` publicerar mappen `app/`
varje gång den ändras på `main`.

1. Gå till *Settings → Pages* och välj **Source: GitHub Actions** (görs en gång).
2. Gå till *Actions → Publicera på GitHub Pages* och välj **Run workflow**, eller pusha en ändring i `app/`.
3. Adressen blir `https://<användarnamn>.github.io/<repo>/`.

## Installera på telefonen

| | Android (Chrome) | iPhone (Safari) |
|---|---|---|
| Öppna | Adressen i Chrome | Adressen i **Safari** (inte Chrome på iPhone) |
| Installera | Meny ⋮ → *Installera app* / *Lägg till på startskärmen* | Dela-knappen → **Lägg till på hemskärmen** |
| Varför installera | Startar i helskärm och får bättre lagringsskydd | **Viktigt:** Safari kan radera data för webbplatser som inte används på 7 dagar. En app på hemskärmen skyddas bättre. |
| Behörigheter | Tillåt kamera och plats när appen frågar | Tillåt kamera och plats (*Inställningar → Safari → Plats* om det nekats) |

Ladda sedan ner AI-modellen på startsidan (ca 105 MB, helst via wifi).

## Testplan för första fältdagen

Kryssa av och anteckna problem: vad du gjorde, vad som hände och telefonmodell.

**Innan du går ut (wifi)**
- [ ] Modellen laddas ner, och startsidan visar Fält-läget utan varning.
- [ ] Slå på **flygplansläge** och ladda om appen. Den startar, och en bild ger förslag.

**I skogen**
- [ ] GPS-pillen visar ±m, och åldern syns under tät granskog ("· 25 s").
- [ ] Fota en känd art. Förslagen syns direkt utan scrollning, och ⚡ sparar med ett tryck. Ångra fungerar.
- [ ] Spara via formuläret. Spara-knappen syns hela tiden, och "Byt art" behåller ifyllda val.
- [ ] Skapa ett objekt, tryck **Gå gränsen** och gå runt det. Lås inte skärmen. Kontrollera att den röda raden räknar
      punkter även när du registrerar arter i checklistan under tiden.
- [ ] Checklistan: registrera 10 arter med handskar på. Hur många felträffar blev det?
- [ ] Gå ut ur objektet. Raden ska visa "utanför", och nya fynd ska inte kopplas automatiskt.
- [ ] Androids bakåtknapp: den stänger det översta arket, och från andra flikar går den till Fält.
- [ ] Mörkt tema i skymning och ljust tema i sol. Är allt läsbart?

**På kvällen**
- [ ] **Säkerhetskopia** (Mer → Internt). Spara filen i molnet eller skicka den till dig själv. 💾-pillen ska bli "idag".
- [ ] **Leverans till beställare** (ZIP). Öppna `inventering.geojson` i QGIS och `fynd.csv` i Excel.
- [ ] Kontrollera att skyddsklassade arter (t.ex. tjäder vid spelplats) visas som ruta och inte som exakt punkt.

## Kända begränsningar att ha i bakhuvudet
- **Bakgrundskarta saknas.** Kartan visar bara fynd och objekt.
- **AI-förslagen för lavar och mossor** är rätt som förslag 1 i ungefär hälften av fallen på bra foton. Bekräfta alltid.
- **Data finns bara på telefonen** tills du gör en säkerhetskopia eller leverans. Det finns ingen synkning.

# BRAND — utsatt arbeid

Hver post er skrevet slik at den kan plukkes opp uten denne samtalen. Rekkefølgen
i CEO-planen (`~/.gstack/projects/brand/ceo-plans/2026-09-04-corpus-first.md`)
styrer hva som gjøres nå; denne filen er alt som bevisst er utsatt.

Innsats er oppgitt som menneskelag / med Claude Code.

---

## T-01 — Hele kapitler av alle fire verk (P2, L / M)

**Hva:** Utvide hvert verk fra åpningsutdrag (~850–930 ord) til hele kapittelet
eller akten.

**Hvorfor:** En Nonstop-økt tar i dag slutt etter tolv segmenter. Hele kapitler
gir sammenhengende lesing over flere økter.

**Fordeler:** Mer materiale per verk uten nytt kildearbeid; segmentgrensene
følger allerede samme mønster.
**Ulemper:** Mesteparten av teksten som må redaktørleses skapes her, så T-01 er
avhengig av at redaktørflyten finnes først.

**Kontekst:** `content/<pack>/segments.json` navngir hvert segment med første og
siste linje fra den arkiverte kildeteksten. Å utvide betyr å hente flere sider
(`scripts/import/runeberg.ts` / `wikikilden.ts`) og legge til flere segmenter.
Ingen kodeendring kreves.

**Avhenger av:** D11 (redaksjonell diff-flyt) og uken med faktisk bruk (D10).

**Merk 2026-09-08:** Q-006 gjør ETT verk komplett (`kielland-noveletter`, hele
*Noveletter*). T-01 er fortsatt de tre andre — Ibsen, Hamsun og Gift står
fortsatt på åpningsutdrag.

---

## T-02 — Øvingsverdi: feillokalisering og repetisjonskø (P2, L / M)

**Hva:** Vise hvilke tegn og ordformer som faktisk går galt (særlig æ, ø, å og
tegnsetting), og la vanskelige passasjer komme igjen.

**Hvorfor:** Codex' motargument i denne reviewen: appen måler aggregert WPM og
viser en flat liste, uten noe som forteller hva du bør øve på. Mer tekst kan
være en stedfortreder for at øvingssløyfen mangler.

**Fordeler:** Gjør historikken handlingsrettet; er den mest sannsynlige veien til
faktisk fremgang.
**Ulemper:** Krever at motoren lagrer mer enn aggregater. `TypingEvent` finnes
allerede i økten, men lagres bevisst ikke (`docs/spec/DATA_MODEL.md`), så dette
er en bevisst reversering av en spec-beslutning og må vurderes som det.

**Kontekst:** `src/domain/engine/engine.ts` fører `eventLog` i aktiv økt.
Feilposisjoner kan utledes uten å lagre tastetrykk: det holder å telle avvik per
måltegn ved øktslutt.

**Avhenger av:** uken med faktisk bruk (D10) avgjør om denne eller T-01 kommer
først.

---

## T-03 — Lesemodus for originalteksten (P3, S / S)

**Hva:** En lesevisning av `original`-utgaven ved siden av treningsutgaven.

**Hvorfor:** `docs/spec/LANGUAGE_PROFILE.md` sier originalen «kan tilbys som
lesemodus senere». Den gjør de redaksjonelle valgene synlige for leseren.

**Fordeler:** Bygger tillit til treningsutgaven; nesten all mekanikk finnes.
**Ulemper:** Enda en side å holde i stil.

**Kontekst:** `/skriv?edition=<id>` lar deg allerede skrive mot originalen;
det som mangler er en ren lesevisning og en lenke fra Om-siden.

---

## T-04 — Grensesnitt for stop-on-error (P3, S / S)

**Hva:** La brukeren velge `stop-on-error` som feilmodus.

**Hvorfor:** Strategien og testene finnes allerede
(`src/domain/engine/error-modes.ts`); bare valget mangler.

**Fordeler:** Nesten gratis.
**Ulemper:** V1-scope sier eksplisitt at UI for dette ikke trengs, og en modus
til gjør valgskjermen tettere enn spec ønsker.

**Kontekst:** `UserPreferences.defaultErrorMode` finnes og går allerede gjennom
hele kjeden til `SessionResult`.

---

## T-06 — Samle de åtte repository-lastene i én hook (P3, S / S)

**Hva:** `useEffect` + `getRepository()` + `setState`-mønsteret er kopiert åtte
steder i `src/components` og `src/app`.

**Hvorfor:** Hver ny side gjentar det, og hver kopi kan glemme opprydding.

**Fordeler:** Fjerner en voksende duplisering.
**Ulemper:** Kosmetisk mens tallet er åtte.

**Kontekst:** En liten `useRepositoryValue(load, deps)` som håndterer
avmontering dekker alle åtte.

---

## T-07 — Fremdriftsindikator inne i segmentet (P3, S / S)

**Hva:** Vise hvor langt i utdraget du er, uten å telle tegn med øynene.

**Hvorfor:** Markøren er eneste holdepunkt i dag.

**Fordeler:** Liten, rolig forbedring.
**Ulemper:** Må ikke bli et fremdriftsfelt som konkurrerer med teksten —
`docs/spec/PRODUCT.md` sier teksten skal dominere skjermen.

**Kontekst:** `RunnerState` har alt som trengs; det er et rent visningsvalg.

---

## T-08 — Tidsport for tid til første tegn (P2, S / S)

**Hva:** En e2e med strupet nettverk som måler tiden fra navigasjon til `/skriv`
til første tegn er malt, med to sekunder som tak.

**Hvorfor:** `docs/spec/PRODUCT.md` oppgir det som suksesskriterium («En økt kan
startes på under to sekunder etter at appen er lastet»). Fase 3 flytter
segmentteksten ut av bundelen og gir appen sin første nettverksavhengighet, og
fasens egne porter måler bundlestørrelse og feilveien, ikke tiden. Porten kan
altså være grønn mens det uttalte kriteriet brytes.

**Fordeler:** Gjør et uttalt løfte målbart; fanger en regresjon fase 3s egne
porter er blinde for.
**Ulemper:** Strupet nett i Playwright er støyende å få stabilt, så porten kan
bli flakete før den blir nyttig.

**Kontekst:** Fase 3 skriver `public/content/manifest.json` og én fil per
utgaveversjon, og gjør `loadEdition(id)` lat. Fase 3 punkt 4 fikser den
funksjonelle siden (skriveflaten får ikke fokus før teksten finnes), men måler
ikke ventetiden. Besluttet utsatt i plan-design-review D8, 2026-09-05.

**Avhenger av:** fase 3 punkt 1 og 2 — **landet 2026-09-05**, så porten er nå
ulåst. `e2e/content-loading.spec.ts` dekker at teksten faktisk hentes, at det
skjer én gang, og at feilveien stopper økten; det som gjenstår er selve
tidsmålingen under strupet nett.

---

## T-09 — De gjenstående danske formklassene (P1, delvis løst i base.v2)

**Status 2026-09-06:** `-erne` og de bløte konsonantene er løst som eksplisitte
ordpar i `brand-riksmaal.base.v2` (D12). Ingen pakke er kuttet til v3 ennå — det
venter på D11-lesning. Preteritum `-ede` er målt og bevisst holdt utenfor: se
D12 for hvorfor klassen ikke er mekanisk. Det som gjenstår av T-09 er altså (a)
å lese og kutte v3-utgaver, og (b) å avgjøre `-ede` ord for ord under lesningen.

**Hva:** Normalisere tre systematiske klasser som ingen av v1-ordlistene tok,
og som derfor står igjen i alle fire treningsutgavene:

- **Bestemt flertall `-erne` → `-ene`:** `bygderne`, `netterne`, `gjeiterne`,
  `ferierne`, `spidserne`, `penneposerne`, `adjunkterne`.
- **Preteritum `-ede` → `-et`/`-te`:** `telegraferede`, `samlede`, `rodede`,
  `strittede`, `skrabede`, `blekkede`, `stammede`, `skinnede`, `elskede`,
  `dansede`, `trykkede`, `stillede`.
- **Bløt konsonant i småord:** `sad` → `satt`, `lod` → `lot`, `gad` → `gadd`,
  `sagde` → `sa`, `bag` → `bak`, `nogle` → `noen`.

**Hvorfor:** Fant ved profilkonformans-skanningen i D9. Utgavene kaller seg
moderne-konservativt riksmål og inneholder fortsatt dansk bøyning. Dette er den
største gjenstående avstanden mellom det `LANGUAGE_PROFILE.md` lover og det
leseren faktisk skriver.

**Fordeler:** Mekanismen finnes nå — dette er nye grunnregler i
`brand-riksmaal.base.v2.json` pluss v3-utgaver, gjennom den samme porten.
**Ulemper:** Ikke rene ordlisteregler. Et mønster `/(\w+)erne\b/ → $1ene`
ødelegger `gjerne`, `moderne` og `skogstjerne`; `-ede` treffer `brede`, `nede`,
`fremmede` og `allerede`. Enten trengs en vokterliste, eller så må klassene
skrives ut som eksplisitte ordpar. Sistnevnte er tryggest og passer måten
resten av kjeden allerede virker på.

**Kontekst:** `sagde → sa` er ikke ren ortografi — det er et bøyningsvalg, og
`sagde → sagte` finnes ikke i moderne riksmål. Grensen mot «ikke bytt
forfatterens ordvalg» må trekkes eksplisitt for denne klassen før den kjøres.

**Avhenger av:** D11 (redaksjonell diff-flyt). Dette er nøyaktig den mengden
tekstendring som skal kunne leses av et menneske før den publiseres.

**Køført 2026-09-08 som Q-005**, med avstanden målt: 22 forekomster igjen i de
fire utgavene leseren faktisk skriver (Ibsen 3, Hamsun 3, Gift 14, Noveletter
2). Posten blokkerer på lesningen, og bærer også den nye porten
(`check:conformance`) som gjør avstanden til noe maskinen holder på null.

## T-10 — `ReadingProgress` overlever ikke et utgavebump — LØST 2026-09-07

**Løst i D14** (`docs/DECISIONS.md`): nøkkelen inneholder ikke lenger
`editionId`. Framgang hører til verket, ikke til én utgave av det, og gamle
poster foldes inn ved lesning fordi nøkkelen regnes ut av postens egne felter.
To poster for samme verk slås sammen (nyeste vinner, fullførte segmenter
unioneres), og sletting tar den gamle posten med seg.

**Det som gjenstår, og som er en annen feil enn denne:** en framtidig utgave som
**resegmenterer** et verk. Da betyr ikke lenger en segment-id samme passasje på
tvers av versjoner, og både unionen og gjenopptakelsespunktet blir meningsløse.
I dag bygges hver utgave av samme `segments.json`, så det kan ikke skje ved et
uhell — men porten mot det finnes ikke. Posten bærer `editionId`, som er nok til
å oppdage tilfellet; det som mangler er en sjekk mot katalogens `segmentCount`
(og helst id-listen) på lesetidspunktet. Tas når en utgave faktisk endrer
segmentgrensene, ikke før.

## T-11 — Oppslag av fremmedord (P2, M / L)

**Hva:** Slå opp et ord i teksten og få en kort forklaring. Korpuset er
1800-tallsprosa, så behovet er reelt: «Ansigt», «Katheder», «Fjerpen»,
«gardien’erne».

**Merk:** Dette er ikke en ordbok. En allmenn ordbok er et rettighets- og
størrelsesproblem, og appen har ingen sky å slå opp mot. Det som passer
arkitekturen er en glosse *per utgave*: kandidatordene utledes fra korpuset,
glosene skrives for hånd, og resultatet serveres som en statisk asset ved siden
av utgaven — samme fetch-not-bundled-mønster, samme uforanderlighet.

## T-12 — Merk et sitat og øv det på repeat (P2, M / M)

**Hva:** Marker en passasje mens du skriver, legg den i en kø, og skriv den om
igjen til den sitter.

**Merk:** Dette er samme maskineri som feilkø-modusen: en økt bygget av et
utvalg ekte utgavesegmenter i stedet for av hele utgaven. Kilden til utvalget
er det eneste som skiller dem — feil du gjorde, eller passasjer du valgte. Bygg
dem som én modus med to kilder, ikke som to moduser.

---

<!--
  T-10, T-11 og T-12 er tatt av språkrens-lanen (D10–D12) parallelt med
  designrevisjonen. Begge greiner delte ut de samme tre numrene fra samme
  utgangspunkt. Postene under er omnummerert til T-13–T-15 fordi de fortsatt
  lå til gjennomgang da kollisjonen ble oppdaget; de andre var alt på main.
  Sjekk høyeste tildelte nummer på main før du tar et nytt.
-->

## T-13 — Én beholder for varslene på resultatsiden — LØST 2026-09-07

**Løst, men premisset var galt, og det er verdt å skrive ned.** Posten sa at
margene «kolliderer» når alle tre varslene vises samtidig. Målt før endringen:
avstanden mellom varslene var **9 px**, ikke overlapp. Hver blokk hadde
`mb-8 -mt-6`, og tilstøtende marger faller sammen til `32 + (-24) = 8` — altså
en lovlig, men trang avstand, ikke et sammenbrudd. Ingenting lå oppå noe annet.

Det som faktisk var galt var at avstanden ble satt tre steder, og at rytmen
mellom varsler dermed var strammere enn resten av siden. Nå ligger de tre i én
`flex flex-col gap-3`-beholder som setter `-mt-6 mb-8` én gang: **13 px** mellom
varslene, uendret 56 px ned til tallene.

`e2e/result-notices.spec.ts` fremstiller kombinasjonen ingen lager ved et uhell
— avbrutt økt, tekstform som endrer teksten, og en nettleser som ikke lagrer —
og sjekker at alle tre vises, i rekkefølge, uten overlapp. **Den porten biter
ikke på den gamle koden**, siden den gamle koden heller ikke overlappet; den er
en regresjonsvakt for kombinasjonen, ikke et bevis på fiksen. Bevisene på fiksen
er de to målingene over.

## T-14 — Flytte overskriftene over på `--text-*`-tokenene — LØST 2026-09-07

Sytten `text-3xl`/`text-2xl`/`text-xl`/`text-lg` er borte fra `src/`. `@theme
inline` gjør hvert token til et verktøy med samme navn, så en visning skriver
`text-heading` og navngir aldri variabelen — og `check:design` teller nå begge
formene, siden en teller som bare så etter `--text-*` ville vist null gjennom en
fullført migrering.

**Ett tall flyttet seg:** forsidens h1 lå på `text-3xl` (1,875rem) mens DESIGN.md
sa 1,9rem. Nå stemmer dokumentet. 0,4 px.

`e2e/type-scale.spec.ts` måler det nettleseren faktisk gjengir. Den finnes fordi
`check:design` ikke kan se forskjell på et klassenavn som virker og ett som ikke
gjør det: `text-headnig` genererer ingenting, overskriften arver brødtekst, og
verken diffen eller den statiske porten sier fra. Vist: med `text-title` skrevet
feil måler h1 17 px i stedet for 32,3.

## T-15 — `pnpm check:all` faller lokalt, men ikke i CI — LØST 2026-09-07

**Årsaken var et kappløp i testen, ikke i appen — og ikke en tidsmargin.**
`onSegmentComplete` skriver framgangen, og ingenting venter på den. Testen
navigerte videre i det øyeblikket *grensesnittet* sa at segmentet var avansert
(«2 av N»), altså mens skrivingen til IndexedDB fortsatt var underveis. På en
maskin lastet av de to produksjonsbyggene `check:all` gjør først, rakk
navigasjonen å komme først, siden ble lastet ut midt i transaksjonen, og
velgeren rapporterte ærlig at det ikke fantes framgang. CI er raskere gjennom
akkurat det vinduet, og gikk derfor grønt.

**Målt, ikke antatt.** Tre `pnpm check:all` på rad på uendret `main` før
endringen: grønn, **rød**, grønn — samme test, samme påstand
(«Du har skrevet 1 av»). Tre på rad etter: grønn, grønn, grønn.

Testen venter nå på at posten faktisk ligger i IndexedDB
(`waitForStoredProgress` i `e2e/passage-flow.spec.ts`) før den navigerer. Det er
også en strengere påstand enn en fast ventetid ville vært: den sjekker at appen
*lagret*, ikke at den sannsynligvis rakk det.

**Observasjonen som følger med, og som ikke er fikset:** appen gir ingen garanti
for at framgangsskrivingen er ferdig før en navigasjon. For et menneske er
vinduet millisekunder etter siste tegn i et segment, og nettleseren fullfører
normalt en påbegynt IndexedDB-transaksjon — men garantien finnes ikke. Om det
noen gang skal lukkes, hører det hjemme i `SessionView`, ikke i en test.


---

## T-16 — Segmentlisten i velgeren har ingen ventetilstand — LØST 2026-09-07

Både Passage og Nonstop viser nå `Loading` der listen skal stå — men først etter
`LOADING_DELAY_MS` (300 ms). Regelen er tosidig, og begge sidene er testet i
`e2e/choose-loading.spec.ts`: en treg tekst SKAL navngi ventingen, og en tekst
som kommer med en gang skal ikke blinke med stolper. Et blink leses som en feil,
ikke som arbeid.

Nonstop beholder overskriften «Eller hopp til en passasje» over stolpene, så
leseren vet hva som er på vei. Primærhandlingen tegnes fortsatt uten å vente på
noe.

Vist at porten biter begge veier: uten blokken feiler de to tregt-tekst-testene;
med `LOADING_DELAY_MS = 0` feiler ingen-blink-testen.


---

## T-17 — Hyller som egen akse (P1, M / S)

**Hva:** Fire kuraterte hyller — Norske klassikere, Danske klassikere, Idé og
tro, Korte tekster — som leseren navigerer etter, og som et verk kan stå på
flere av uten at innholdsposten dupliseres.

**Hvorfor:** D17 gjør katalogen til 25 verk med flere verk per forfatter. I dag
er én `ContentPack` lik ett verk, og pakken er det eneste navigerbare nivået.
Med *Sult*, *Pan* og *Victoria* i katalogen er «Hamsun-pakken» ikke lenger et
svar på hva leseren leter etter.

**Hvorfor ikke `tags`:** feltet finnes (`["prosa", "novelle", "1800-tallet"]`),
men det er frie strenger uten kuratert rekkefølge og uten visningsnavn. En hylle
er et redaksjonelt utvalg med en tittel og en orden; en tag er en egenskap.
**Hvorfor ikke `ContentPack`:** en pakke eier verket sitt (`workIds`), og Georg
Brandes står på to hyller allerede ved katalogens start.

**Form:** en egen liste — `content/shelves.json` eller tilsvarende — som peker
på `workId`, bygges inn i `catalog.generated.ts` av `pnpm build:content`, og
valideres mot at hver `workId` finnes. Ingen endring i noen utgave, ingen
`contentHash` som beveger seg.

**Port:** `validate:content` feiler når en hylle navngir et verk som ikke
finnes, og når et verk ikke står på noen hylle.

## T-18 — Verksmetadata rettighetsvurderingen faktisk hviler på (P1, S / S)

**Hva:** Fire felter som mangler på `Work`/`SourceAttribution`:

- `authorDeathYear` — tallet grunnregelen «døde i 1955 eller tidligere» leser;
- `originalLanguage` — `da-NO`, `da-DK`, `nb-NO`, `nn-NO`, skilt fra
  transkripsjonens språk;
- `adaptationStatus` — hvor langt Brand-tilpasningen er kommet, som noe annet
  enn `verificationStatus` (transkripsjonen) og `reviewStatus` (lesningen);
- `rightsStatus` — status i det fri som en verdi, ikke som en setning inne i
  `license`.

**Hvorfor:** i dag står dødsåret i fritekst («Kielland d. 1906; verkets vernetid
er utløpt»). Førstesorteringen i `docs/spec/CORPUS.md` kan derfor ikke kjøres av
noen maskin, og med 25 verk er det den sorteringen som avgjør hva som i det hele
tatt kan importeres. `license` beholdes som den fulle, presise setningen —
feltene legges ved siden av, de erstatter den ikke.

**Med i samme post:** attribusjonslinjen der teksten skrives — «Språklig
bearbeidet etter Brand-standarden. Basert på [utgave og år].» — som i dag bare
finnes på `/om`.

**Port:** `validate:content` krever feltene på hvert verk, og feiler når
`authorDeathYear` er senere enn 1955 uten en eksplisitt begrunnelse i pakken.

## T-19 — Moduler med egen fremdrift (P1, L / M)

**Hva:** Et verk kan deles i moduler som har id, rekkefølge, visningsnavn og
**egen fremdrift, fullføring og vanskelighet**, samtidig som grensesnittet viser
at modulen hører til verket.

**Hvorfor:** *Enten–Eller* skal ikke først presenteres som én uavbrutt tekst.
Diapsalmata, Det umiddelbart erotiske, Forførerens Dagbog og utvalgte partier fra
«Eller» er skrivekurs hver for seg; Diapsalmata implementeres først.

**Hvorfor `part` ikke holder:** Q-007 grupperer segmentlisten etter en fri
streng på segmentet. Strengen har ingen id, ingen rekkefølge utover
segmentrekkefølgen, og — det avgjørende — ingen fremdriftsnøkkel. D14 la
fremdriften på verket, og det var riktig for et verk med én tekst. En modul er
et nivå til.

**Rekkefølge:** dette må inn **før** *Enten–Eller* importeres, ikke etter. En
modell som utvides etter at tekst er importert, endrer tekst som allerede er
skrevet mot — samme grunn som i D15.

**Merk:** `ReadingProgress`-nøkkelen endres. T-10s rettelse gjelder fortsatt
(nøkkelen skal ikke inneholde `editionId`), og migrasjonen må folde eksisterende
poster inn på verksnivået uten å miste fullførte segmenter.

## T-20 — Regelsett for dansk og for landsmål (P1, L / M)

**Hva:** To nye utgangspunkter for tilpasningen, hver med sitt eget regelsett.

**Dansk-dansk.** `RuleFamily` har i dag to verdier, og `historical-orthography`
beskriver seg selv som «19th-century Dano-Norwegian» — altså dansk-norsk, som er
det de fire nåværende pakkene har. Kierkegaard, Bang, Pontoppidan, Jacobsen,
Holberg, Andersen, Grundtvig og Brandes starter et annet sted. Sett skal legges
ved siden av det norske, ikke inn i det: en regel som er riktig for dansk-norsk
1880 er ikke automatisk riktig for dansk 1843.

**Grensen, skrevet ut:** for danske verk er tilpasningen ortografi og bøyning,
**ikke leksikon**. Ordforråd, argument, rytme og forfatterstemme står. Det er
samme grense `LANGUAGE_PROFILE.md` allerede trekker; det nye er at den må gjelde
mot et dansk utgangspunkt, der fristelsen til å bytte ord er større.

**Landsmål.** *Bondestudentar* krever en faktisk overføring, ikke modernisert
rettskrivning — den bytter per definisjon forfatterens ordvalg og bryter dermed
med profilens forbud. Den kan derfor ikke være en `training-edition` av samme
slag som de andre. Enten et eget `kind`, eller en `adaptationStatus` som sier
det høyt. Ellers betyr «treningsutgave» to forskjellige ting i samme katalog.

**Avhenger av:** D11-lesningen. Dette er nøyaktig den mengden tekstendring som
skal leses av et menneske før den publiseres — og for dansk er mengden større
enn noe pakkene har vært gjennom hittil.

## T-21 — Verseformatering (P2, M / M)

**Hva:** Verselinjer, innrykk og strofegrenser som noe utgaven bærer, ikke som
tilfeldige `\n` i en segmenttekst.

**Hvorfor:** *Peer Gynt* er nr. 17. `ibsen-brand` er også versedrama og virker i
dag, men trykkets halvlinje-innrykk er bevisst ikke gjengitt (se pakkens
`editorialNotes`) — det er en avgrensning, ikke en løsning.

**Regel fra D17:** versedramaet skal **ikke** få bestemme den første
prosaorienterte innholdsmodellen. Posten tas når prosakjeden står, ikke før.

**Drama for øvrig virker allerede:** `segments.json` har
`speakerLinePattern`, som holder replikknavnet sammen med replikken. *Et
dukkehjem* (nr. 3, første bølge) er første prosadrama som prøver den, og er
prøven på om replikknavn, sceneanvisninger og dialogstruktur overlever kjeden.

**Køført 2026-09-08 som Q-011** på operatørens beslutning, med en strengere port
enn de to postene foran: migrasjonen skal ikke bare passere, den skal vises å
ikke røre en fremdriftspost for et verk uten moduler.

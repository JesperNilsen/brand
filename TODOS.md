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

## T-09 — De gjenstående danske formklassene (P1, M / M)

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

---

## T-10 — Én beholder for varslene på resultatsiden (P3, S / S)

**Hva:** Erstatte de tre `mb-8 -mt-6`-blokkene i `ResultView` med én stablet
beholder som setter avstanden ett sted.

**Hvorfor:** Hvert varsel trekker seg selv oppover med en negativ marg, og
regner med å være det eneste på siden. En avbrutt økt, i et privat vindu,
skrevet med en tekstform, viser alle tre — og margene kolliderer.

**Fordeler:** Fjerner en layoutfeil i nøyaktig den situasjonen der leseren
allerede får dårlige nyheter.
**Ulemper:** Sjelden kombinasjon, og rent kosmetisk når den inntreffer.

**Kontekst:** `src/components/ResultView.tsx` — varslene `unsaved-notice`,
tekstform og `paused-notice`. Hvert av dem er riktig alene. Reproduseres med en
avbrutt økt i privat vindu med en tekstform som endrer teksten.

**Avhenger av:** ingenting. Funnet i designrevisjonen 2026-09-06.

---

## T-11 — Flytte overskriftene over på `--text-*`-tokenene (P3, S / M)

**Hva:** Bytte `text-3xl` / `text-2xl` / `text-xl` / `text-lg` i visningene ut
med målestokk-tokenene som nå finnes i `globals.css`.

**Hvorfor:** Tokenene finnes og `DESIGN.md` utpeker dem som fasit, men fem
visninger setter fortsatt størrelsen selv. En fasit ingen leser fra er pynt, og
størrelsene vil sprike første gang noen legger til en side.

**Fordeler:** Gjør målestokken ekte; neste skjerm arver den i stedet for å gjette.
**Ulemper:** En mekanisk endring over fem filer uten synlig resultat — akkurat
den typen støy som kan skjule en ekte regresjon.

**Kontekst:** `HomeView`, `ChooseView`, `ResultView`, `HistoryView` og
`src/app/om/page.tsx`. Størrelsene er tilfeldigvis konsistente i dag. Gjøres som
sin egen endring, med visuell sammenligning før og etter, slik at et utilsiktet
størrelsesbytte er synlig.

**Avhenger av:** tokenene, som landet 2026-09-06.

---

## T-12 — Nonstop-resume-testen faller i full kjøring (P1, M / M)

**Hva:** Finne og fjerne tilstanden som lekker mellom testfiler, slik at
`pnpm test:e2e` går grønt i én kjøring.

**Hvorfor:** `e2e/passage-flow.spec.ts:98` faller på `Du har skrevet 1 av` etter
en omlasting når hele suiten kjører, og består alene. Verifisert på ren `main`
2026-09-06: 32 bestått, 1 falt — den er altså ikke innført av en endring, den
står der. En port alle vet er rød, er ikke lenger en port.

**Fordeler:** Neste ekte regresjon lander i en suite man faktisk ser på.
**Ulemper:** Rekkefølgeavhengige feil er trege å spore.

**Kontekst:** `playwright.config.ts` har allerede `workers: 1` og
`fullyParallel: false` — det var fiksen forrige gang, og den holder ikke lenger.
Lagret Nonstop-fremdrift fra en tidligere testfil er den nærliggende mistanken:
testen forventer *1* fullført segment, og ville feilet på samme måte om noe
hadde lagt igjen et annet antall.

**Akseptanse:** `pnpm test:e2e` avslutter med 0 i én full kjøring, tre ganger på
rad, uten at noen test er hoppet over eller markert flaky.
**Verify:** `pnpm test:e2e`

**Avhenger av:** ingenting.

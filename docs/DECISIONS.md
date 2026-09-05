# BRAND — tekniske valg og avvik

Spesifikasjonene i `docs/spec/` er styrende. Dette dokumentet lister de valgene
spesifikasjonen lot stå åpne, og de få avvikene som var nødvendige.

## Stack

| Valg | Begrunnelse | Reversibelt? |
| --- | --- | --- |
| Next.js 16 (App Router, Turbopack) + TypeScript strict + Tailwind v4 | Foreslått stack; scaffoldet med `create-next-app`. Merk: Next 16 leverer `params`/`searchParams` som Promises og krever `<Suspense>` rundt `useSearchParams` ved bygg. | Ja |
| `pnpm` | Finnes lokalt (`~/.local/node24/bin`). | Ja |
| Vitest for enhetstester, Playwright for e2e | Chromium-1234 lå allerede i Playwright-cachen, så e2e krever ingen nedlasting. `fake-indexeddb` tester IndexedDB-adapteren i Node. | Ja |
| `idb` for IndexedDB | Liten, typet; ingen ORM. Preferanser i `localStorage` fordi temaet må leses før første paint. | Ja |
| System-serif-stack (Iowan Old Style / Palatino / Charter / Georgia) | Ingen fontnedlasting ved bygg; `next/font/google` krever nett. Kan byttes til bundlet Literata/Source Serif senere. | Ja |
| Eget tema-oppsett (`data-theme` + inline no-flash-skript + `useSyncExternalStore`) | Ingen avhengighet; lys/mørk/system med systemtema som standard. | Ja |
| Ingen state-bibliotek | Domenet er rene funksjoner; React-state holder bare runner-tilstanden. | Ja |

## Arkitektur

- `src/domain/engine` — tastemotoren. Rene funksjoner over `TypingSessionState`;
  klokken sendes alltid inn. `ErrorMode` er en strategi (`flow` og `stop-on-error`
  begge implementert; bare `flow` har UI).
- `src/domain/session/runner.ts` — `SessionRunner` kjører motoren segment for
  segment etter en `SessionPlan` og håndhever `EndRule`
  (`all-segments` | `time` | `user-stop`). Motoren kjenner ikke segmenter; runneren
  kjenner ikke bøker.
- `src/domain/modes` — `GameModeDefinition.buildPlan()` er det eneste stedet en
  modus «vet» noe om verk og utgaver. Nonstop = alle gjenstående segmenter fra
  lagret fremdrift; Passage = ett segment; Timed = seedet, stokket strøm uten
  umiddelbar repetisjon, dimensjonert for tidsgrensen.
- `src/domain/content/registry.ts` — statiske JSON-imports fra `content/`.
- `src/infra/repository` — `BrandRepository`-kontrakt, `IndexedDbRepository`,
  `MemoryRepository`, idempotente migrasjoner. UI bruker bare `getRepository()`.
- `src/lib/session-flow.ts` — URL-parametre ↔ plan ↔ fremdrift ↔ preferanser,
  uten React.

## Definisjoner (samme i live-visning, lagret økt og historikk)

- `comparedCharacters` = posisjoner med brukerinput, avgrenset til måltekstens lengde.
- `correctCharacters` = posisjoner der skrevet tegn er lik måltegnet.
- `accuracy = correct / compared`; `grossWpm = compared / 5 / minutter`; `netWpm = gross × accuracy`.
- `errorCount` = feiltastede innsettinger i løpet av økten, også de som senere rettes
  med Backspace. (Nøyaktigheten måler sluttteksten; feiltallet måler prosessen.)
- Økter under 5 s merkes `provisional`, og hastighet vises som «—».
- Varighet = fra første aksepterte tegn til avslutning; i Timed avsluttes økten
  nøyaktig ved grensen, uavhengig av tastetrykk.

## Avvik og presiseringer

1. **Ekstra tegn utover måltekst** aksepteres ikke (spec-anbefalingen). Økten
   fullføres én gang ved mållengde.
2. **Tab og piltaster** nøytraliseres bare mens en økt er aktiv; når økten er idle
   eller ferdig fungerer Tab normalt (tilgjengelighet). Escape slipper fokus.
3. **Nonstop-fremdrift** lagres etter hvert fullførte segment og ved avslutning;
   når siste segment er skrevet slettes fremdriften (verket regnes fullført).
4. **Avbrutte økter** lagres bare når brukeren avslutter eksplisitt («Avbryt»/
   «Avslutt økten»). Å navigere bort mid-økt lagrer ikke et resultat.
5. **Originaltekst** vises ikke som lesemodus i V1 (spec: «kan tilbys senere»), men
   `?edition=<id>` på `/skriv` lar en skrive mot originalen.
6. **Vindusrendering**: segmentene er ≤ ~1000 tegn, så hele segmentet rendres;
   markøren holdes i syne med `scrollIntoView`. Virtualisering utsettes til
   segmenter blir vesentlig lengre.
7. **`SessionQuery`** fikk `newestFirst`/`limit`, og repository fikk `getSession(id)`
   og `deleteProgress(key)` — nødvendige for resultatside og fullførte verk.
8. **`UserPreferences`** fikk `lastWorkId` og `lastTimedLimitMs` for «Fortsett».

## Korpus

Se `docs/CORPUS_STATUS.md`. Kort: originaltekst bygges av `scripts/import/build-original.ts`
fra arkivert kilde + `segments.json`; treningsutgaven bygges av
`scripts/import/build-training-edition.ts` fra `rules.vN.json` (ren ortografi, hver regel
loggføres i `editorialNotes`). `pnpm validate:content` verifiserer proveniens linje for
linje og at treningsutgaven ikke er skrevet om (samme segmenter, linjetall, ±10 % ord).

## Uforanderlige utgaver (fase 2)

- **Utgaver er uforanderlige.** `rules.vN.json` bygger `training-edition.vN.json`.
  En retting er en ny versjon, aldri en endring på stedet: en lagret økt navngir
  utgaven den ble skrevet mot, og den teksten må fortsatt finnes for at tallene
  skal bety noe.
- **`contentHash`** er SHA-256 over segmentene i leserekkefølge, og bare over
  `id`, `order` og `text`. En omformulert redaksjonsnotat, en ny etikett eller
  et omregnet ordtall flytter den ikke. Det ble bekreftet i praksis: alle fire
  notatene fikk rettet en filsti, filene endret seg, hashene stod stille.
- **Hashen dekker den ufiltrerte teksten.** Hvilken øvingsform en økt brukte er
  et eget faktum og bæres allerede av `textFilterId`.
- **`basedOnContentHash`** lar en treningsutgave si hvilken original den ble
  bygget fra, så drift under den er synlig i stedet for stille.
- **`SessionResult` er schema 3**: `editionVersion` og `editionContentHash` er
  påkrevd ved skriving. Rader fra schema 1 og 2 fylles med `"unknown"` ved
  lesing. Provenance for tekst som ikke kan identifiseres blir aldri gjettet.
- **Flere segmenter i et verk beholder `editionId`** og hever `version` og
  hash. `progressKey()` inneholder `editionId`, så en ny id ville nullstilt all
  lagret Nonstop-fremdrift.
- **Validatoren bygger på nytt og sammenligner bytes.** Alle andre sjekker
  sammenligner en utgave med seg selv; bare denne oppdager at en generert fil er
  håndredigert. Negativt testet: ett endret tegn, en tuklet hash og en slettet
  regelfil gir alle exit 1.

## Eksport og import (fase 2)

- **Formatet er de lagrede radene ordrett**, med egen `formatVersion`, så en fil
  skrevet i dag kan leses etter at øktskjemaet har flyttet seg: import kjører
  hver rad gjennom de samme migrasjonene som repositoryet bruker ved lesing.
- **Import er additiv.** Økter skrives på id, så samme fil to ganger gir én
  kopi av hver, og en gammel fil ved siden av nyere økter beholder begge.
- **En uleselig rad telles og hoppes over**, aldri gjettet på, og stopper aldri
  resten. En enkelt ødelagt rad skal ikke koste leseren de andre fire hundre.
- **`listProgress()`** måtte inn i repository-kontrakten: ingenting annet
  enumererer fremdriftsrader, så uten den kunne eksporten ikke se dem.

## Korpus som statiske assets (fase 3)

- **Katalogen er bundlet, teksten hentes.** `catalog.generated.ts` bærer pakker,
  verk og utgavehoder — navn, versjon, hash, segmenttall, ordtall og filsti — og
  ingen tekst. Den vokser med antall verk, ikke med lengden på dem. Alternativet,
  en `manifest.json` som også hentes, ville lagt en rundtur foran hver side for
  en fleksibilitet denne utrullingen ikke bruker: innholdet ligger i repoet og
  følger appen uansett.
- **Redaksjonsnotatene er ikke katalogen.** En treningsutgave loggfører én regel
  per endring, så notatene alene var 60 kB — fire ganger resten av katalogen. De
  ligger i `editorial-notes.generated.ts` og leses bare av Om-siden, som er en
  serverkomponent. De blir HTML, aldri JavaScript hos leseren.
- **Filnavnet er innholdshashen.** `<editionId>.<hash12>.json`, servert
  `immutable` i ett år. Trygt fordi en tekst som endrer seg får et nytt navn i
  stedet for en ny kopi under det gamle. Hashen fantes allerede (D7); en egen
  cache-nøkkel ville vært en identitet til å holde i takt.
- **Alle utgaver emitteres, ikke bare den nyeste.** En økt lagret mot v1 må
  fortsatt kunne slås opp etter at v2 finnes.
- **Teksten kontrolleres mot hashen i nettleseren.** Filen bærer sin egen id og
  hash, og hashen regnes om fra segmentene med WebCrypto før noe kan skrives.
  Bygget kontrollerer de samme bytene, men bygget er ikke det som serverer dem.
  Mangler `crypto.subtle` er kontrollen utelatt, aldri feilet: en manglende
  kontroll er ikke en feilet kontroll.
- **En feilet henting er en feilet økt.** Skriveflaten monteres ikke før teksten
  finnes, så et fokusert felt uten tekst å måle mot kan ikke oppstå. Feilen sier
  hva som skjedde og tilbyr «Prøv igjen»; et verk som ikke kan lastes vises
  aldri som startbart på velgesiden. Resultatsiden er unntaket: tallene venter
  aldri på nettet, det er bare lenken til neste utdrag som uteblir.
- **To porter, begge negativt testet.** `check:bundle` leter etter selve teksten
  i de bygde klientchunkene i stedet for å stole på importgrafen — en `import`
  av en innholdsfil fra en klientkomponent ble fanget. `validate:content`
  genererer katalog og assets på nytt og sammenligner byte for byte, og felte
  både en håndredigert assetfil, en foreldet katalog og en foreldreløs fil som
  ingen utgave peker på.

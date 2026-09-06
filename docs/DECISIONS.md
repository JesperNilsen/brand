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

## Pause og øktmeny

- **Én vei ut, ikke en knapp.** «Avbryt»/«Avslutt økten» var hele utgangen, og
  Escape slapp fokus uten å si det. Nå åpner Escape og «Meny» den samme
  dialogen: fortsett, avslutt og lagre, eller forlat uten å lagre. Å forlate
  uten å lagre er ikke ny oppførsel — å navigere bort mid-økt har alltid lagret
  ingenting — men den er nå et valg framfor en bivirkning.
- **Å åpne menyen pauser.** Klokken skal ikke gå mens leseren leser en meny i
  stedet for teksten. Konsekvensen er villet: å kikke på menyen teller som en
  pause og merker økten. Alternativet var en terskel, altså et magisk tall som
  avgjør når en pause er ekte nok.
- **Pausen trekkes fra, og noteres.** `runnerElapsedMs` måler til `pausedAt` når
  økten står, så en pause leses ikke som svært langsom skriving. `pausedMs` og
  `pauseCount` lagres, og resultat og historikk sier det: tallene gjelder tiden
  som faktisk ble skrevet, men en økt med hvil er ikke uten videre
  sammenlignbar med en sammenhengende. Samme linje som tekstformene følger.
- **Skjemaversjon 4.** Rader fra 1–3 får `pausedMs: 0`. Det er et faktum, ikke
  en gjetning som `"unknown"`-utgaven: pause fantes ikke da de ble skrevet.
- **Å avslutte fra pause lukker pausen først.** Ellers ville tiden mellom
  pausen og avslutningen stilltiende blitt lagt tilbake i den målte tiden.
- **En pauset økt er åpen, men døv.** `isOpen` og `acceptsInput` er nå to
  spørsmål: en pauset økt kan gjenopptas og avsluttes, men tar ikke imot
  tastetrykk.
- **Timed pauser også.** Nedtellingen fryser, og løpet bærer den samme
  merkingen. Et 5-minutters løp med hvil skal ikke kunne leses som et
  sammenhengende.
- **Menyens Escape-lytter ligger på panelet, ikke på `document`.** En
  document-lytter fanget selve tastetrykket som åpnet menyen — det bobler
  fortsatt opp fra skriveflaten når React monterer panelet — så menyen åpnet og
  lukket seg i ett trykk. Fanget av e2e-en, ikke av lesing.

## Profilen eier grunnreglene (D9)

- **Premisset i planen holdt ikke, og målingen ga en bedre grunn.** D9 var
  begrunnet med at de fire pakkene gjentok profilens felles regler. Av 287
  distinkte regelnøkler fantes 3 i alle fire pakkene og 255 i bare én: det var
  nesten ingen duplisering å fjerne. Målingen viste i stedet den virkelige
  gevinsten. Da de 31 reglene som faktisk er felles ble løftet opp, kom det
  fram at pakkene **manglet** regler søsknene hadde: 27 forekomster av former
  tre av fire pakker normaliserer, stående igjen i den fjerde bare fordi hver
  ordliste var skrevet for hånd hver for seg (`sig` ×8 hos Hamsun, `sig` ×12,
  `gik` ×3 og `nu` ×2 hos Noveletter, `magt` og `mig` hos Gift). Verdien er
  altså konsistens, ikke færre linjer.
- **Grunnreglene er frosset og versjonert som alt annet i kjeden.**
  `src/domain/language/brand-riksmaal.base.v1.json` endres aldri på stedet. En
  utgave bygges på nytt fra nøyaktig det grunnregelsettet den ble laget med, så
  et redigerbart felles sett ville brutt D8 i det stille: gamle utgaver ville
  sluttet å reprodusere uten at noen hadde rørt dem.
- **Pakken vinner ved sammenstøt, men må si hvorfor.** Base først, pakke over.
  Et verk med egen periodeortografi skal kunne avvike uten å redigere et sett
  fire verk deler. Til gjengjeld feiler `validate:content` på en pakke som
  gjentar en grunnregel uendret (duplisering sammenstillingen er til for å
  fjerne) og på et avvik som ikke er begrunnet i `retained`.
- **`preferredForms` er bevisst ikke mekaniske regler.** Profilen foretrekker
  `meget` framfor `mye` og `selv` framfor `sjøl`. Det er ordvalg, og
  `LANGUAGE_PROFILE.md` forbyr å bytte forfatterens ordvalg — å kjøre dem som
  substitusjoner ville skrevet om Kielland. De styrer vår egen prosa og valget
  mellom likeverdige normaliseringer. En test håndhever skillet.
- **Én feil ble rettet på veien.** `hænderne → henderne` sto i to pakker:
  hverken kildens danske form eller moderne riksmål — æ→e var gjort, den danske
  bestemte flertallsendelsen `-erne` sto igjen. Grunnreglene gir `hendene`.
- **`endnu` står igjen, med vilje.** To pakker gjør den til `ennu`, som beholder
  det `nu` grunnreglene ellers gjør om til `nå`. `ennu` er en forsvarlig
  konservativ riksmålsform, så motsetningen er en redaksjonell avgjørelse og
  ikke en mekanisk. Den ligger i pakkene til et menneske har avgjort den, ikke i
  profilen.
- **Tre pakker fikk v2, Ibsen ikke.** Bumpeutløseren fra D7 er tekstendring.
  Ibsens tekst er uendret av sammenstillingen, så en v2 ville vært en versjon
  uten forskjell. `rules.v1.json` er frosset og selvstendig i alle fire pakkene;
  mekanismen gjelder fra v2 og framover.
- **`defaultEdition` valgte med `.find()`.** Riktig så lenge det fantes nøyaktig
  én treningsutgave per profil, stille galt i det øyeblikket den andre kom:
  den ville servert den utgaven generatoren tilfeldigvis skrev først. Ingenting
  ville feilet — leseren ville bare skrevet en erstattet tekst, og den lagrede
  økten ville navngitt den. Valget er nå eksplisitt høyeste versjon.

## Én matcher, to utganger (D10)

- **Rapporten må komme fra samme matcher som omskrivningen.** Regelmotoren har
  fått en rapportutgang ved siden av omskrivningsutgangen: `analyzeText` sier
  hva reglene *ville* gjort, uten å gjøre det. Den er grunnlaget både for
  redaksjonell lesning (D11) og for å måle en tekst mot normen. To matchere
  ville vært billigere å skrive og verdiløse: en rapport fra en litt annen
  matcher er en rapport om en tekst ingen taster.
- **Flyttingen til `src/` er bevist, ikke antatt.** `scripts/lib/rules.ts` er nå
  en ren re-eksport fra `src/domain/language/rules/`, fordi rapporten på sikt
  skal kunne kjøre i nettleseren og en modul under `scripts/` ikke kan det.
  `applyRules` matcher ikke lenger selv; den forbruker `stageHits` som
  rapporten gjør. At det ikke endret noe utfall er ikke en påstand:
  `validate:content` bygger seks publiserte treningsutgaver på nytt gjennom den
  nye matcheren og byte-sammenligner dem.
- **Posisjoner projiseres tilbake til kallerens tekst.** Steg to matcher i steg
  én sitt resultat, så en rå posisjon derfra peker inn i en tekst leseren aldri
  har sett. Hvert steg bærer derfor en kartlegging tilbake, og et treff
  rapporteres på det stedet i originalen det hører hjemme. Et treff som lander
  inne i en tidligere erstatning kollapser til hele den erstatningen — det er
  det ærlige svaret, ikke en tilnærming.
- **To regelfamilier som aldri får møtes.** Grunnreglene går én vei: 1800-talls
  dansk-norsk → riksmål. Samtidsnormen går den andre: moderne bokmål →
  BRAND-riksmål (`boka` → `boken`), og den finnes for å *rapportere* på tekst
  brukeren har skrevet selv. Å folde den inn i en korpusbygging ville brutt
  `LANGUAGE_PROFILE.md`s forbud mot å bytte forfatterens ordvalg og den
  byte-identiske gjenoppbyggingen av hver publiserte utgave samtidig. Tre lag
  hindrer det: `family` på typen, et kast i `loadRules` der id-oppslag har
  fjernet typene, og tester. Ett lag ville vært en anbefaling.
- **`base.v1.json` fikk ikke feltet.** Filens egne notater sier at den aldri
  endres på stedet. Manglende `family` defaulter til korpusfamilien i kode.
- **To feller ble målt, ikke gjettet, og står nå som tester.** `applyRules`
  erstatter med en funksjon som returnerer `to`, så `$1` ekspanderes ikke — en
  regel skrevet som om den gjorde det, setter inn tegnene `$1`. Og `\w` matcher
  ikke æ ø å, så `(\w+)erne` mot «Hænderne» begynner å matche inne i ordet.
  Begge treffer nøyaktig den som skriver T-09 som mønster i stedet for som
  ordpar.
- **`pnpm sprakrens <fil>` er verktøyet.** Den rapporterer treff med posisjon og
  kontekst, teller per regel, og lister til slutt reglene som *ikke* traff.
  Den siste listen er halvparten av nytten: den er hvordan et regelsett viser
  seg å være skrevet for en annen tekst enn den man har.

## Redaksjonell lesning (D11)

- **Lesningen bor ved siden av utgaven, ikke i den.** `validate:content` bygger
  hver publiserte treningsutgave på nytt og byte-sammenligner hele filen, så
  ethvert felt i `training-edition.vN.json` må produseres av byggeren. Et
  menneskes navn er ikke det. Lesningen ligger derfor i
  `content/<pack>/review.json`, og `contentHash` er urørt av konstruksjon: den
  dekker bare `(id, order, text)`.
- **`reviewedContentHash` er hele poenget med formatet.** Den kan ikke drive
  for en genuint uforanderlig utgave. Et avvik betyr at noen har redigert en
  publisert `rules.vN.json` på stedet i stedet for å kutte neste versjon —
  nøyaktig den feilen uforanderlighetsregelen finnes for å hindre, og den
  eneste som ellers er usynlig. Validatoren feiler på den.
- **Feltene rir i katalogen, aldri i asseten.** Assetens byte er det det
  innholdshashede filnavnet lover. Lesestatus, leser og dato foldes inn i
  `editionMeta()`; hashen og lesningens egne notater blir igjen i review-filen
  og når aldri appen.
- **Fravær advarer, selvmotsigelse feiler.** Alle fire pakkene er skrevet av en
  agent og ingen er lest, så en hard gate ville landet rød på main og lært alle
  å overse den. `REVIEW_GATE` står på `"warn"` med begrunnelsen skrevet ned, og
  advarer bare om den utgaven leseren *faktisk skriver* — eldre versjoner er
  historie. En review-fil som motsier seg selv feiler uansett.
- **Verktøyet har ingen `--approve`.** `pnpm review:edition <editionId>` viser
  hver endring med posisjon, kontekst og hvilken regel som gjorde den, merket
  `grunn` eller `pakke`. Det skriver ingenting. Et flagg som fører
  godkjenningen ville vært ett tastetrykk fra å sertifisere ni hundre uleste
  ord; å føre en lesning er et menneske som redigerer `review.json`.
- **Verktøyet nekter å lese en fiksjon.** Før noe vises, kontrolleres det at
  reglene faktisk gir den forpliktede teksten. Hvis ikke, er utgaven
  håndredigert, og det er den som skal rettes — ikke lesningen.
- **`/om` beskrev feil utgave.** Siden hentet treningsutgaven med
  `getEdition()`, som gir første treff i listen — altså den generatoren tilfeldigvis
  skrev først. Tre av fire verk viste dermed v1s redaksjonsnotater mens
  skriveflaten serverte v2. Samme feil som `defaultEdition` fikk rettet i D9,
  ett kallsted lenger unna. Siden bruker nå `defaultEdition` og viser lesestatus
  ved siden av kontrollstatus.

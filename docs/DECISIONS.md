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
`scripts/import/build-training-edition.ts` fra `rules.json` (ren ortografi, hver regel
loggføres i `editorialNotes`). `pnpm validate:content` verifiserer proveniens linje for
linje og at treningsutgaven ikke er skrevet om (samme segmenter, linjetall, ±10 % ord).

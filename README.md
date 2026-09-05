# BRAND

Skriv deg inn i god norsk prosa — med ro, rytme og målbar fremgang.

BRAND er en web-first skrive- og tasteapp for litterær norsk prosa i
moderne-konservativt riksmål. V1 er et personlig verktøy uten konto: alt lagres
lokalt i nettleseren.

## Kjøre

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

## Kontroller

```bash
pnpm check:fast       # lint + typecheck + vitest + validate:content + check:css
pnpm check:all        # check:fast + build + playwright   (det CI krever)
```

Enkeltdelene:

```bash
pnpm lint
pnpm typecheck        # kjører next typegen først; .next/types er gitignorert
pnpm test             # vitest: motor, moduser, runner, repository-kontrakt
pnpm validate:content # proveniens + treningsutgave-invarianter
pnpm check:css        # klasseselektorer utenfor @layer er en stum feil
pnpm test:e2e         # playwright (bygger og starter egen server på :3199)
pnpm build
```

`check:all` er den påkrevde sjekken på `main`. Én sjekk, ikke seks, fordi én er
vanskeligere å uthule.

## Struktur

```
docs/spec/       styrende spesifikasjoner
docs/DECISIONS.md tekniske valg og avvik
docs/CORPUS_STATUS.md kildestatus per verk
content/<pack>/  pack.json, segments.json, rules.vN.json, original.json,
                 training-edition.vN.json, source/ (arkivert råkilde)
scripts/import/  importere og bygge utgaver (replaybart fra source/)
src/domain/      typer, språkprofil, innholdsregister, tastemotor, moduser, runner
src/infra/       repository (IndexedDB + localStorage) og migrasjoner
src/app/         Next.js App Router-sider
src/components/  UI
tests/, e2e/     vitest og playwright
```

## Legge til innhold

1. Arkiver kilden under `content/<pack>/source/` (se `scripts/import/runeberg.ts`
   og `scripts/import/wikikilden.ts`).
2. Skriv `pack.json` og `segments.json` (segmenter angis med første og siste linje).
3. `pnpm tsx scripts/import/build-original.ts --pack <pack>`
4. Skriv `rules.v1.json` (bare ortografi) og kjør
   `pnpm tsx scripts/import/build-training-edition.ts --pack <pack>`

   Utgaver er uforanderlige. En retting i en publisert utgave er en ny versjon
   (`rules.v2.json` → `training-edition.v2.json`), aldri en endring på stedet,
   fordi en lagret økt navngir utgaven den ble skrevet mot og den teksten må
   fortsatt finnes. Ved flere segmenter i samme verk: behold `editionId`, hev
   `version` og hashen. En ny `editionId` ville nullstilt all Nonstop-fremdrift.
5. Registrer pakken i `src/domain/content/registry.ts` og kjør `pnpm validate:content`.

## Innhold, kilder og attribusjon

Hver tekst finnes i to atskilte lag. **Originalen** er en nøyaktig transkripsjon
av kilden og overskrives aldri. **Brand Training Edition** er en avledet utgave
der bare ortografien er forsiktig modernisert; syntaks, rytme, billedbruk,
dialog og ordvalg står urørt. Hver enkelt normalisering er loggført i utgavens
`editorialNotes`, og `pnpm validate:content` verifiserer proveniens linje for
linje mot den arkiverte kilden.

Alle fire verkene er falt i det fri. Kildene og transkripsjonene:

| Verk | Kilde | Grunnlag |
| --- | --- | --- |
| Henrik Ibsen: *Brand* (1903-trykk) | [Project Runeberg](https://runeberg.org/brand/) | Ibsen d. 1906; vernetiden utløpt |
| Knut Hamsun: *Markens grøde* (1917) | [Wikikilden](https://no.wikisource.org/wiki/Markens_Gr%C3%B8de/1/01) | Hamsun d. 1952; vernetiden utløp 2023-01-01 |
| Alexander Kielland: *Gift* | [Wikikilden](https://no.wikisource.org/wiki/Gift/1) | Kielland d. 1906; siden er merket `{{PD-old|nb}}` |
| Alexander Kielland: *Noveletter* | [Wikikilden](https://no.wikisource.org/wiki/Novelletter) | Kielland d. 1906; vernetiden utløpt |

Transkripsjonene fra Wikikilden er hentet derfra og attribueres til Wikikilden,
som bærer en generell CC BY-SA 4.0-merknad på sine sider. Attribusjonen står
også i selve appen, på `/om`, sammen med kildelenke og redaksjonsnotater for
hvert verk.

**Redaksjonell status:** alle fire pakkene er `verificationStatus:
agent-drafted`. Ingen av dem er ennå lest gjennom av et menneske. Treningsutgavene
skal ikke siteres som pålitelige tekstkritiske utgaver før det er gjort.

## Lisens

Ingen lisens er gitt ennå, verken for koden eller for de avledede
treningsutgavene. Standard opphavsrett gjelder inntil videre: du kan lese
kildekoden her, men ikke gjenbruke den. Lisensposisjonen er en åpen beslutning i
prosjektplanen (fase 5) og avgjøres før noe distribueres videre.

Originaltekstene selv er i det fri, som tabellen over viser.

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
pnpm lint
pnpm typecheck
pnpm test             # vitest: motor, moduser, runner, repository
pnpm validate:content # proveniens + treningsutgave-invarianter
pnpm test:e2e         # playwright (starter egen dev-server på :3199)
pnpm build
pnpm check            # lint + typecheck + test + validate + build
```

## Struktur

```
docs/spec/       styrende spesifikasjoner
docs/DECISIONS.md tekniske valg og avvik
docs/CORPUS_STATUS.md kildestatus per verk
content/<pack>/  pack.json, segments.json, rules.json, original.json,
                 training-edition.v1.json, source/ (arkivert råkilde)
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
4. Skriv `rules.json` (bare ortografi) og kjør
   `pnpm tsx scripts/import/build-training-edition.ts --pack <pack>`
5. Registrer pakken i `src/domain/content/registry.ts` og kjør `pnpm validate:content`.

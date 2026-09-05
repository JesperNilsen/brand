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

**Avhenger av:** fase 3 punkt 1 og 2.

# BRAND — corpusstatus

Status per verk i `content/`. Se `docs/spec/CORPUS.md` og `docs/spec/LANGUAGE_PROFILE.md` for kontrakten disse pakkene følger, og hver pakkes egen `rules.v1.json` for den fulle, maskinlesbare regellisten bak treningsutgaven.

Alle fire pakker er bygd med samme pipeline: kildetekst arkiveres verbatim under `content/<pack>/source/`, `original.json` bygges med `scripts/import/build-original.ts` (kopierer tekst ord-for-ord fra det arkiverte kildeutdraget), og `training-edition.v1.json` bygges med `scripts/import/build-training-edition.ts` ut fra den enkelte pakkens `rules.v1.json`. `pnpm validate:content` kontrollerer at alt henger sammen (segmentgrenser, provenance mot kildefilen, ordtelling ±10 % mellom original og treningsutgave).

## ibsen-brand — Henrik Ibsen, *Brand* (1866)

| Felt | Verdi |
| --- | --- |
| Kilde | Project Runeberg, `https://runeberg.org/brand/` |
| Trykt utgave | *Brand. Et dramatisk digt.* Femtende oplag. København: Gyldendalske Boghandels Forlag (F. Hegel & Søn), 1903. |
| Hentet | 2026-09-04 |
| Rettighetsgrunnlag | Public domain (Ibsen d. 1906, mer enn 70 år siden). Runeberg-transkripsjonen er korrekturlest minst én gang. |
| Kontrollstatus | agent-drafted |
| Ordtall / segmenter | 931 ord, 12 segmenter |
| Inkludert | Åpningsscenen i første akt (fjellvidde-scenen mellom Brand, Bonden og Sønnen). |

Etablert før denne runden; uendret. Se `content/ibsen-brand/rules.v1.json` for det fulle regelsettet (af→av, ej→ei, hvad→hva m.fl.).

## hamsun-markens-groede — Knut Hamsun, *Markens Grøde* (1917)

| Felt | Verdi |
| --- | --- |
| Kilde | Wikikilden, `https://no.wikisource.org/wiki/Markens_Gr%C3%B8de/1/01` |
| Trykt utgave | *Markens Grøde.* Kristiania: Gyldendal, 1917. Første del, kapittel I. Transkribert etter Internet Archive-skanningen `markensgrde01hams`. |
| Hentet | 2026-09-04 |
| Rettighetsgrunnlag | Public domain i Norge (Hamsun d. 1952; vernetiden utløp 2023-01-01, life+70) og i USA (utgitt 1917). Wikikildens transkripsjon er CC BY-SA 4.0; attribusjon beholdt i pakken. |
| Kontrollstatus | agent-drafted |
| Ordtall / segmenter | 813 ord, 8 segmenter |
| Inkludert | Åpningen av første del, kapittel I: fra «Den lange, lange Sti …» til Isaks navn blir avslørt («— Isak.»). |

## kielland-gift — Alexander L. Kielland, *Gift* (1883)

| Felt | Verdi |
| --- | --- |
| Kilde | Wikikilden, `https://no.wikisource.org/wiki/Gift/1` |
| Trykt utgave | *Samlede Værker*, Andet Bind. Kristiania: Gyldendalske Boghandel Nordisk Forlag, 1907. Kapittel I (trykte sider 165–171). Merket `{{PD-old|nb}}` på Wikikilden. |
| Hentet | 2026-09-04 |
| Rettighetsgrunnlag | Public domain (Kielland d. 1906, mer enn 70 år siden). Wikikildens transkripsjon er CC BY-SA 4.0; attribusjon beholdt i pakken. |
| Kontrollstatus | agent-drafted |
| Ordtall / segmenter | 855 ord, 13 segmenter |
| Inkludert | Åpningen av kapittel I: klasserommet, geografitimen, Adjunkt Borring og Aalbom, fram til Adjunktens spørsmål om «Namür». |

## kielland-noveletter — Alexander L. Kielland, *Noveletter* (1879)

| Felt | Verdi |
| --- | --- |
| Kilde | Wikikilden: `https://no.wikisource.org/wiki/Haabet_er_lysegr%C3%B8nt` og `https://no.wikisource.org/wiki/Visne_Blade` |
| Trykt utgave | *Samlede Værker*, Første Bind. Kristiania: Gyldendalske Boghandel Nordisk Forlag, 1907. «Haabet er lysegrønt» (trykte sider 7–13) og «Visne Blade» (trykte sider 13–16). |
| Hentet | 2026-09-04 |
| Rettighetsgrunnlag | Public domain (Kielland d. 1906, mer enn 70 år siden). Wikikildens transkripsjon er CC BY-SA 4.0; attribusjon beholdt i pakken. |
| Kontrollstatus | agent-drafted |
| Ordtall / segmenter | 851 ord totalt, 13 segmenter (7 fra «Haabet er lysegrønt», 6 fra «Visne Blade») |
| Inkludert | Åpningen av hver novelle: «Haabet er lysegrønt» fra «Du støver!» til vognforbikjøringen; «Visne Blade» fra galleribetraktningen til beskrivelsen av det engelske maleriet. |

Ett verk (`kielland-noveletter`), to noveller i denne omgang. Segmentetiketter er prefikset med novelletittelen («Haabet er lysegrønt, 1» … «Visne Blade, 1» …). **Spesifikasjonens prioriterte tekst «Ballstemning» finnes på Wikikilden**, korrekturlest, i samme bind — under 1907-utgavens stavemåte **«Balstemning» med én L** (`https://no.wikisource.org/wiki/Balstemning`, ~2 100 ord). Se «Rettet 2026-09-04» under.

---

## Mangler / avgrensninger

- **RETTET 2026-09-04: «Ballstemning» finnes likevel — stavemåten var feilen, ikke kilden.**
  Den opprinnelige konklusjonen i denne filen («ingen bekreftet fri digital kilde») var
  gal. Alle søkene brukte den moderne stavemåten med to L-er; 1907-utgaven i *Samlede
  Værker* staver tittelen **«Balstemning» med én L**, og under den stavemåten er teksten
  fullt transkribert og korrekturlest på Wikikilden.
  - Kilde: `https://no.wikisource.org/wiki/Balstemning` — transkludert fra
    `Kielland - Samlede Værker 1.djvu`, sidene 27–32, korrekturkvalitet 4 (validert).
  - Trykt utgave: *Samlede Værker*, Første Bind. Kristiania: Gyldendalske Boghandel
    Nordisk Forlag, 1907. Samme bind som «Haabet er lysegrønt» og «Visne Blade».
  - Omfang: ~2 100 ord.
  - Rettighetsgrunnlag: uendret fra resten av pakken (Kielland d. 1906; Wikikildens
    transkripsjon CC BY-SA 4.0).
  - Lærdom for senere kildesøk: et negativt søkeresultat gjelder søkestrengen, ikke
    verket. Søk alltid på den stavemåten den aktuelle *utgaven* bruker, og kryssjekk mot
    bindets innholdsfortegnelse (`Indeks:`-siden på Wikikilden) før en tekst erklæres
    utilgjengelig.
- **Resten av *Noveletter* er også tilgjengelig i samme bind**, alle korrekturlest på
  Wikikilden: «Erotik og Idyl» (~4 700 ord), «En Middag» (~2 100), «To Venner» (~6 700),
  «Slaget ved Waterloo» (~8 300). Sammen med de to allerede importerte og «Balstemning»
  utgjør det hele samlingen fra 1879, ~26 000 ord, gjennom samme importer og samme
  regelsett. Ikke importert ennå; se CEO-planen for rekkefølge.
- **Corpuset er utdrag, ikke hele verk.** Alle fire pakker inneholder bare åpningen av det aktuelle kapittelet/den aktuelle novellen (i tråd med `docs/spec/CORPUS.md`s V1-avgrensning), ikke hele *Markens Grøde*, *Gift* eller de fullstendige novellene.
- **Alle treningsutgaver er agent-utkast (`verificationStatus: "agent-drafted"`).** Ingen av dem er lest av en menneskelig redaktør ennå. `docs/spec/LANGUAGE_PROFILE.md` krever at «en redaktør [skal] kontrollere at tekstens setningsmelodi og litterære særpreg er beholdt» før en pakke regnes som kontrollert — det gjenstår for alle fire pakker (ibsen-brand inkludert, som var ferdig fra før). Se hver pakkes `rules.v1.json`-felt `retained` for ord som bevisst er latt urørt fordi riktig moderne form var usikker, og selve sluttrapporten for denne runden for en kortere liste over de mest tvilsomme enkeltvalgene.
- **Én dokumentert transkripsjonsrettelse.** I `kielland-gift` er «Abrabam» (åpenbar bokstavfeil på Wikikilden, mot 10+ korrekte forekomster av «Abraham» ellers i samme kapittel) rettet til «Abraham» i treningsutgaven, i tråd med `docs/spec/LANGUAGE_PROFILE.md`s adgang til å rette dokumenterte transkripsjonsfeil. Originalteksten beholder «Abrabam» uendret (verbatim mot kilden).

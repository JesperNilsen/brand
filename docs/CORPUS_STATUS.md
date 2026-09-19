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
| Ordtall / segmenter | **v2 (gjeldende): 25 664 ord, 264 segmenter** — hele samlingen. v1: 851 ord, 13 segmenter (åpningen av de to første novellene), beholdt uendret. |
| Inkludert | **Alle syv novellene**, i bindets egen rekkefølge: «Haabet er lysegrønt» (26 segm.), «Visne Blade» (15), «Erotik og Idyl» (45), «Balstemning» (19), «En Middag» (17), «To Venner» (64), «Slaget ved Waterloo» (78). Rekkefølgen er lest av innholdsfortegnelsen på Wikikildens `Novelletter`-side. |

**Utvidet 2026-09-08 til hele samlingen (D10).** Originalen er versjonert:
`original.json` (v1) er åpningen av de to første novellene og er utgaven hver
økt skrevet før denne datoen ble skrevet mot; `original.v2.json` er hele
*Novelletter*. Begge står, og `training-edition.v3.json` er bygget av v2 med
samme regelsett som v2 brukte — se D15 for hvorfor originalen måtte bli
versjonerbar først.

Ett verk (`kielland-noveletter`), sju noveller. Segmentetiketter er prefikset med novelletittelen («Haabet er lysegrønt, 1» … «Visne Blade, 1» …). **Spesifikasjonens prioriterte tekst «Ballstemning» finnes på Wikikilden**, korrekturlest, i samme bind — under 1907-utgavens stavemåte **«Balstemning» med én L** (`https://no.wikisource.org/wiki/Balstemning`, ~2 100 ord). Se «Rettet 2026-09-04» under.

## hamsun-sult — Knut Hamsun, *Sult* (1890)

**Under bygging — ikke merget.** Kilde, `segments.json`, `original.json` og
`pack.json` er på plass; `rules.v1.json` og treningsutgaven gjenstår, så
`pnpm validate:content` melder «no training edition» inntil de er skrevet.

| Felt | Verdi |
| --- | --- |
| Kilde | Wikikilden, `https://no.wikisource.org/wiki/Sult` — transkludert fra `Indeks:Sult (Knut Hamsun).djvu`, fire stykker (`Sult/01`–`Sult/04`). Merk: `Sult/Sult/01`–`04` er en foreløpig, foreldreløs duplikattre på samme wiki og er **ikke** kilden. |
| Trykt utgave | *Sult.* København: P. G. Philipsens Forlag, 1890. Førsteutgaven, i sin helhet. Transkribert etter Wikikildens skannede utgave, Fremgang V (validert — Wikikildens høyeste korrekturnivå), 345 sider (trykt side 1 = djvu-side 13). |
| Hentet | 2026-09-10 |
| Rettighetsgrunnlag | Public domain i Norge (Hamsun d. 1952; vernetiden utløp 2023-01-01, life+70) og i USA (utgitt 1890). Wikikildens transkripsjon er CC BY-SA 4.0; attribusjon beholdt i pakken. |
| Kontrollstatus | agent-drafted |
| Ordtall / segmenter | 60 044 ord i 531 segmenter (Første stykke 138 seg./16 051 ord · Andet 112/12 884 · Tredje 165/18 315 · Fjerde 116/12 794). 1 285 linjer i kilden: 1 281 avsnitt pluss fire overskriftslinjer, som er modultitler og ikke inngår i noe segment. Ordtallet er `countWords`, som ikke teller tokens uten bokstav eller tall — Hamsuns lange punktrekker. En naiv whitespace-telling gir 61 228; det er samme tekst, ikke en annen. |
| Inkludert | Hele verket, firedelt i ekte moduler: Første, Andet, Tredje og Fjerde Stykke — første pakke i katalogen med reell modulstruktur (Q-011). |

Rå HTML arkivert under `source/wikikilden/sult-01.html`–`sult-04.html`; ekstrahert tekst i `source/sult-01.txt`–`sult-04.txt`, satt sammen til `source/sult-komplett.txt` fordi `build-original.ts` bare støtter én `sourceFile` per pakke. Hylle: `norske-klassikere` (lagt til `content/shelves.json`, append-only).

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

---

# Planlagt katalog (D17)

Rangeringen på 25 verk står i `docs/spec/CORPUS.md`. Denne seksjonen er
**forhåndssorteringen**, ikke verifiseringen: den svarer på om verket i det hele
tatt kan vurderes, og hvor en fri kilde eventuelt finnes. Hvert verk må
fortsatt verifiseres for seg, mot den konkrete kilden, før import.

## Dødsår — førstesorteringen

Grunnregelen er at forfatteren døde i 1955 eller tidligere. **Alle 25 verkene
består den**, med Hamsun (d. 1952) og Undset (d. 1949) som de seneste. Det er
nettopp derfor regelen ikke er nok alene: den utelukker ingen av dem, og alt
arbeidet ligger i det neste leddet — om det finnes en fri *digital utgave*.

| Forfatter | Levetid | Vernetid utløp (Norge, life+70) |
| --- | --- | --- |
| Ludvig Holberg | 1684–1754 | for lengst |
| N.F.S. Grundtvig | 1783–1872 | for lengst |
| H.C. Andersen | 1805–1875 | for lengst |
| Søren Kierkegaard | 1813–1855 | for lengst |
| Camilla Collett | 1813–1895 | for lengst |
| Henrik Ibsen | 1828–1906 | 1977 |
| Jonas Lie | 1833–1908 | 1979 |
| Georg Brandes | 1842–1927 | 1998 |
| J.P. Jacobsen | 1847–1885 | for lengst |
| Alexander Kielland | 1849–1906 | 1977 |
| Arne Garborg | 1851–1924 | 1995 |
| Herman Bang | 1857–1912 | 1983 |
| Henrik Pontoppidan | 1857–1943 | 2014 |
| Knut Hamsun | 1859–1952 | 2023 |
| Sigrid Undset | 1882–1949 | 2020 |

## Kildesøk 2026-09-08 — første bølge

Metode: HTTP-oppslag og Wikisource-søk mot no. og da.wikisource, samt oppslag
på Project Runeberg. **Et negativt resultat gjelder søkestrengen, ikke verket**
— samme lærdom som «Balstemning» kostet oss. Radene merket «ikke funnet» er
åpne spørsmål, ikke konklusjoner.

| # | Verk | Funnet | Kilde |
| --- | --- | --- | --- |
| 1 | *Sult* | **ja, skannbasert** | `no.wikisource.org/wiki/Sult` — transkludert fra `Sult (Knut Hamsun).djvu`, fire stykker (`Sult/01`–`Sult/04`) |
| 2 | *Gift* (hele) | **ja, skannbasert** | `no.wikisource.org/wiki/Gift` — 13 kapitler (`Gift/1`–`Gift/13`) fra `Kielland - Samlede Værker 2.djvu`, `{{PD-old|nb}}`. Pakken har i dag bare s. 167–173 §1 |
| 3 | *Et dukkehjem* | **ja, men ikke skannbasert der** | `no.wikisource.org/wiki/Et_Dukkehjem` er en elektronisk utgave **kopiert fra Project Runeberg**, med en `opprydning`-merkelapp om at teksten bør flyttes til de skannede sidene (`Side:Samfundets støtter, dukkehjem, gengangere.djvu/225`). `runeberg.org/dukkhjem/` svarer. **Bruk Runeberg direkte eller de skannede sidene — ikke en avskrift av en avskrift.** Runeberg er samme leverandør som `ibsen-brand` allerede bruker |
| 4 | *Frygt og Bæven* | **ikke funnet** | Ikke på da.wikisource under den tittelen; ikke på gjettet Runeberg-slug |
| 5 | *Amtmandens Døttre* | **ja** | `no.wikisource.org/wiki/Amtmandens_Døttre._En_Fortælling` |
| 6 | *Enten–Eller: Diapsalmata* | **ja, skannbasert, førsteutgaven** | `da.wikisource.org/wiki/Enten_—_Eller._Første_Deel/1` = Diapsalmata, transkludert fra `Enten-Eller Første Deel.djvu` s. 17–46 (1843). Første og Anden Deel finnes begge, med åtte underdeler i Første |
| 7 | *Pan* | **ikke funnet** | Ikke på no.wikisource; ikke på gjettet Runeberg-slug |
| 8 | *Kristin Lavransdatter: Kransen* | **ikke funnet** | Ingen treff på «Kristin Lavransdatter» eller «Undset» på no.wikisource. Verket er fritt i Norge fra 2020, men **fri status er ikke det samme som fri transkripsjon** |
| 9 | *Ved Vejen* | **ikke funnet** | Ikke på da.wikisource; andre Bang-verk finnes der (*Under Aaget*, *Liv og Død*, *De uden Fædreland*) |

Utenfor bølgen, funnet underveis og verdt å notere: *Garman og Worse* (nr. 10)
finnes på no.wikisource, og *Niels Lyhne* (nr. 15) svarer på
`runeberg.org/nielslyhne/`.

## Konsekvens for rekkefølgen

Rangeringen står. Men **nr. 4, 7, 8 og 9 har ikke en bekreftet fri digital kilde
per 2026-09-08**, og `docs/spec/CORPUS.md` tillater et midlertidig avvik når
kildekvalitet krever det — mot skriftlig begrunnelse. Denne seksjonen er den
begrunnelsen når den trengs.

Praktisk betyr det at bølgens tre første — *Sult*, *Gift*, *Et dukkehjem* — er
de eneste som er klare til import i dag, og at det passer nøyaktig med
rekkefølgeregelen i D17. Før noen av dem importeres skal Q-009 (hyller), Q-010
(verksmetadata) og Q-011 (moduler) stå.

### Avvik 1 — *Garman & Worse* inn i bølgen for *Kristin Lavransdatter: Kransen*

**Besluttet 2026-09-08 av operatøren.** `docs/spec/CORPUS.md` krever at et avvik
fra rangeringen begrunnes skriftlig; dette er den begrunnelsen.

- **Grunn:** *Kransen* har ingen fri transkripsjon. Undset døde i 1949 og verket
  er fritt i Norge fra 2020, så rettighetsporten er passert — men søk på både
  «Kristin Lavransdatter» og «Undset» på no.wikisource ga null treff
  2026-09-08. Alternativet ville vært å transkribere fra en skannet
  førsteutgave hos Nasjonalbiblioteket, som er et vesentlig større arbeid enn de
  øvrige åtte postene i bølgen til sammen.
- **Hva som ble byttet:** bølgens plass nr. 8. *Garman & Worse* (rangeringens nr.
  10) er funnet på no.wikisource og tar plassen.
- **Hva som IKKE ble byttet:** rangeringen. *Kransen* står fortsatt som nr. 8 og
  *Garman & Worse* som nr. 10. Byttet gjelder utgivelsesbølgen alene, og faller
  bort så snart det finnes en kilde for *Kransen*.
- **Hva byttet koster:** den historiske romanen faller ut av bølgen, og Kielland
  får to av ni plasser. Bølgen ble valgt for å slå an spennvidden; etter byttet
  bærer *Ved Vejen* den danske aksen og *Amtmandens Døttre* kvinneerfaringen
  hver for seg, uten reserve.
- **Ikke løst av byttet:** nr. 4 (*Frygt og Bæven*), nr. 7 (*Pan*) og nr. 9
  (*Ved Vejen*) mangler fortsatt en bekreftet fri kilde. De står i bølgen som
  før, og de fire åpne kildespørsmålene nedenfor gjelder uendret. Undset-punktet
  er beholdt der fordi det fortsatt skal besvares — byttet utsetter spørsmålet,
  det avlyser det ikke.

Åpne kildespørsmål å ta neste gang, i denne rekkefølgen:

1. **Kierkegaard nr. 4 og 19** — *Frygt og Bæven* og *Sygdommen til Døden*. Søk
   på 1843/1849-utgavenes egen stavemåte og på `Indeks:`-sider for skannede
   bind, slik `Enten — Eller. Første Deel` er bygget. Merk fellen fra D17: den
   moderne kritiske utgaven (*Søren Kierkegaards Skrifter*) er et eget verk med
   egne rettigheter — grunnlaget må være førsteutgaven.
2. **Hamsun nr. 7 og 11** — *Pan* og *Victoria*. Wikikilden har *Sult* og
   *Markens Grøde* skannbasert, så leverandøren finnes; spørsmålet er om disse
   to er transkribert ennå.
3. **Undset nr. 8 og 14** — *Kransen* og *Jenny*. Hvis ingen fri transkripsjon
   finnes, er alternativet en egen transkripsjon fra en skannet førsteutgave
   (Nasjonalbiblioteket), som er et vesentlig større arbeid enn de andre postene
   i bølgen. *Kransen* er tatt ut av bølgen i mellomtiden (avvik 1 over); det
   endrer ikke at spørsmålet skal besvares, bare når det haster.
4. **Bang nr. 9 og 18** — *Ved Vejen* og *Tine*. Andre Bang-verk finnes på
   da.wikisource, så søk på bindtittel og innholdsfortegnelse framfor på
   verkstittelen alene.

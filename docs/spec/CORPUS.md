# BRAND — corpus og redaksjon

## Formål

Corpuset skal gi litterært gode tekster med varierende rytme, setningslengde og
vanskelighetsgrad. Prinsippet er uendret fra V1: få verk med god metadata og
tydelige utgaver er bedre enn et stort ujevnt bibliotek.

## Produktretning (2026-09-08)

BRAND er mer enn en norsk skrivetrener. Katalogen skal bli et **kuratert
norsk–dansk dannelsesbibliotek**, bygget på:

- kanonisk nordisk litteratur;
- fremragende prosa, dialog og filosofisk skrift;
- konservativt moderne riksmål;
- kilder i det fri;
- aktiv læring gjennom avskrift;
- valgfri tilgang til den historiske originalen.

Alle importerte tekster tilpasses Brand-standarden (`docs/spec/LANGUAGE_PROFILE.md`):
konservativt moderne riksmål, ingen radikal bokmål og ingen a-endelser,
konsekvent moderne rettskrivning og tegnsetting.

**Danske verk kan gjengis i Brand-riksmål, men beholder sitt særpreg.**
Ordforråd, argument, rytme og forfatterstemme skal stå. Kierkegaard, Bang og
Pontoppidan skal ikke flates ut til generisk samtidsnorsk. Konkret betyr det at
tilpasningen av danske verk er **ortografi og bøyning, ikke leksikon** — som er
den samme grensen `LANGUAGE_PROFILE.md` allerede trekker under «Ikke tillatte
inngrep», anvendt på et dansk utgangspunkt. Ett unntak er navngitt nedenfor
(*Bondestudentar*), og det er merket som noe annet enn en treningsutgave.

## Grunnlaget som allerede står

Disse er valgt eller implementert, og rangeringen nedenfor gjelder ikke dem:

| Pakke | Verk | Tilstand i `content/` |
| --- | --- | --- |
| `ibsen-brand` | Henrik Ibsen, *Brand* | Åpningsscenen i første akt, 931 ord |
| `hamsun-markens-groede` | Knut Hamsun, *Markens grøde* | Åpningen av første del, kap. I, 813 ord |
| `kielland-noveletter` | Alexander Kielland, *Noveletter*, inkl. «Balstemning» | Hele samlingen, 25 664 ord i 264 segmenter |

`kielland-gift` står også i corpuset (åpningen av kapittel I, 855 ord) og er
samtidig nr. 2 i rangeringen nedenfor: **for et verk som allerede finnes som
utdrag betyr en plass i rangeringen at verket skal vokse til hele teksten**, ikke
at det skal importeres på nytt. Etter D15 er det en versjonering av originalen
(`original.vN.json`), aldri en overskriving av den utgaven tidligere økter er
skrevet mot.

## Katalogens rangering

Rekkefølgen uttrykker produktidentitet og redaksjonell prioritet, ikke hvor lett
noe er å bygge. **Den skal ikke omrokeres bare fordi et verk er enklere å
importere.** Et avvik er lov når kilde- eller rettighetsgrunnlaget krever det, og
skal da begrunnes skriftlig i `docs/CORPUS_STATUS.md`.

| # | Forfatter | Verk | Språk | Hylle |
| --- | --- | --- | --- | --- |
| 1 | Knut Hamsun | *Sult* (1890) | da-NO | Norske klassikere |
| 2 | Alexander Kielland | *Gift* (1883) | da-NO | Norske klassikere |
| 3 | Henrik Ibsen | *Et dukkehjem* (1879) | da-NO | Norske klassikere |
| 4 | Søren Kierkegaard | *Frygt og Bæven* (1843) | da-DK | Idé og tro |
| 5 | Camilla Collett | *Amtmandens Døttre* (1854–55) | da-NO | Norske klassikere |
| 6 | Søren Kierkegaard | *Enten–Eller* (1843) | da-DK | Idé og tro |
| 7 | Knut Hamsun | *Pan* (1894) | da-NO | Norske klassikere |
| 8 | Sigrid Undset | *Kristin Lavransdatter: Kransen* (1920) | nb-NO | Norske klassikere |
| 9 | Herman Bang | *Ved Vejen* (1886) | da-DK | Danske klassikere |
| 10 | Alexander Kielland | *Garman & Worse* (1880) | da-NO | Norske klassikere |
| 11 | Knut Hamsun | *Victoria* (1898) | da-NO | Norske klassikere |
| 12 | Henrik Ibsen | *En folkefiende* (1882) | da-NO | Norske klassikere |
| 13 | Henrik Pontoppidan | *Lykke-Per* (1898–1904) | da-DK | Danske klassikere |
| 14 | Sigrid Undset | *Jenny* (1911) | nb-NO | Norske klassikere |
| 15 | J.P. Jacobsen | *Niels Lyhne* (1880) | da-DK | Danske klassikere |
| 16 | Jonas Lie | *Familien paa Gilje* (1883) | da-NO | Norske klassikere |
| 17 | Henrik Ibsen | *Peer Gynt* (1867) | da-NO | Norske klassikere |
| 18 | Herman Bang | *Tine* (1889) | da-DK | Danske klassikere |
| 19 | Søren Kierkegaard | *Sygdommen til Døden* (1849) | da-DK | Idé og tro |
| 20 | Arne Garborg | *Bondestudentar* (1883) | nn-NO (landsmål) | Norske klassikere |
| 21 | Georg Brandes | Utvalg fra *Hovedstrømninger i det 19de Aarhundredes Litteratur* (1872–90) | da-DK | Idé og tro · Korte tekster |
| 22 | J.P. Jacobsen | *Fru Marie Grubbe* (1876) | da-DK | Danske klassikere |
| 23 | Ludvig Holberg | *Erasmus Montanus* (1723/1731) | da-DK | Danske klassikere |
| 24 | H.C. Andersen | Kuratert utvalg eventyr og historier | da-DK | Danske klassikere · Korte tekster |
| 25 | N.F.S. Grundtvig | Kuratert utvalg skrifter og taler | da-DK | Idé og tro · Korte tekster |

## Første utgivelsesbølge

Neste vesentlige utvidelse er disse ni, i denne rekkefølgen. Bølgen er valgt
for å slå an katalogens spennvidde: psykologisk roman, samfunnssatire, drama,
filosofi, kvinneerfaring, historisk roman og dansk litteratur.

1. *Sult*
2. *Gift*
3. *Et dukkehjem*
4. *Frygt og Bæven*
5. *Amtmandens Døttre*
6. *Enten–Eller: Diapsalmata*
7. *Pan*
8. *Garman & Worse* — **byttet inn for *Kristin Lavransdatter: Kransen***
9. *Ved Vejen*

**Dokumentert avvik, 2026-09-08.** Bølgens plass nr. 8 var *Kristin
Lavransdatter: Kransen*. Verket er fritt i Norge fra 2020, men det finnes ingen
fri transkripsjon av det — fri status er ikke en fri tekst. *Garman & Worse*
(rangeringens nr. 10) er funnet på Wikikilden og tar plassen i bølgen. **Dette
er et bytte i bølgen, ikke i rangeringen:** *Kransen* står fortsatt som nr. 8 og
*Garman & Worse* som nr. 10, og *Kransen* går inn så snart det finnes en kilde å
importere fra. Se `docs/CORPUS_STATUS.md` for grunnlaget.

Byttet koster bølgen litt av spennvidden den ble valgt for: den historiske
romanen faller ut, og Kielland får to plasser. *Ved Vejen* (dansk) og
*Amtmandens Døttre* (kvinneerfaring) bærer fortsatt hver sin akse alene, så det
er en tynnere bølge, ikke en annen bølge.

## Hyller

Katalogen presenteres på fire hyller. **En hylle er et kuratert utvalg, ikke en
eier**: et verk kan stå på flere hyller uten at innholdsposten dupliseres.
Hyllemedlemskap er derfor en egen akse som peker på `workId`, ikke et felt på
verket og ikke en `ContentPack`.

| Hylle | Innhold |
| --- | --- |
| **Norske klassikere** | Ibsen, Hamsun, Kielland, Undset, Lie, Collett og beslektede forfattere. |
| **Danske klassikere** | Bang, Pontoppidan, Jacobsen, Holberg og beslektede forfattere. |
| **Idé og tro** | Kierkegaard, Grundtvig, Georg Brandes og andre filosofiske, teologiske eller idéhistoriske tekster. |
| **Korte tekster** | Noveller, essays, taler, utdrag og utvalgte eventyr — egnet for korte økter. |

Hyllene står i `content/shelves.json` og emitteres til `SHELVES` i
`catalog.generated.ts`; `listShelves()`, `getShelf()` og `listShelvesForWork()`
leser dem. `pnpm validate:content` avviser en hylle som navngir et verk
katalogen ikke har, og et verk som ikke står på noen hylle. En hylle kan være
tom — «Danske klassikere» og «Idé og tro» er erklært før første import, slik at
den kuraterte rekkefølgen allerede er satt når den kommer — men en tom hylle
vises ikke.

## Enten–Eller som moduler

*Enten–Eller* skal ikke først presenteres som én uavbrutt tekst. Verket består
som ett verk i katalogens hierarki, men deles i brukbare skrivekurs:

- **Diapsalmata** — implementeres først;
- Det umiddelbart erotiske;
- Forførerens Dagbog;
- utvalgte brev og partier fra «Eller».

Grensesnittet skal vise at hver modul hører til *Enten–Eller*, samtidig som
fremdrift, fullføring og vanskelighet følges opp per modul. Det er strengere enn
dagens `part`-felt, som er en fri streng på segmentet uten egen identitet: en
modul må ha id, rekkefølge og egen fremdriftsnøkkel. Se T-19.

## Tekstversjoner

Hver passasje skal på sikt finnes i to versjoner:

- `original` — den historiske norske eller danske kildeteksten;
- `brand` — den redaksjonelt tilpassede Brand-riksmålsversjonen.

Brand-versjonen er standard. Brukeren kan valgfritt se eller skrive originalen.
Aksen finnes allerede i datamodellen som `TextEdition.kind`
(`original` | `training-edition`); det som mangler er skriveflaten for
originalen (T-03) og et ord for tilpasningens tilstand (T-18).

Vis en kort attribusjon der teksten skrives:

> Språklig bearbeidet etter Brand-standarden. Basert på [utgave og år].

## Metadata per verk

Hvert verk skal lagre:

- forfatter;
- tittel;
- førsteutgivelsesår;
- **forfatterens dødsår**;
- **originalspråk**;
- kildeutgave;
- kildelenke eller arkivreferanse;
- opphavsrettslig status / status i det fri;
- **tilpasningsstatus**;
- redaksjonelle merknader;
- inndeling i bind, deler, kapitler og passasjer;
- tilgjengelige tekstversjoner.

De uthevede feltene finnes ikke i dagens `Work`/`SourceAttribution` og er
oppført som T-18. Dødsåret er den ene opplysningen rettighetsvurderingen faktisk
hviler på, og i dag ligger den begravd i en fritekstlisens.

## Rettigheter og provenance

Et helt verk importeres først når kildens status er verifisert.

For alminnelige norske og danske verk er den trygge grunnregelen i 2026 at den
identifiserte forfatteren døde i **1955 eller tidligere**. Regelen er en
førstesortering, ikke en konklusjon: **verifiser hvert verk for seg.** Anta
aldri at en moderne transkripsjon, oversettelse, kommentert utgave eller
modernisering er fri bare fordi det underliggende verket er det.

Foretrukket importrekkefølge:

1. Finn en dokumentert historisk utgave.
2. Ta vare på bibliografisk og arkivmessig informasjon.
3. Trekk ut eller transkriber originalteksten.
4. Utfør vår egen Brand-tilpasning.
5. Bevar original og tilpasset versjon hver for seg.
6. Loggfør transformasjoner og redaksjonelle valg.
7. Kjør automatiske sjekker, deretter manuell stikkprøve.

**Ikke kopier tekst fra moderne kommersielle utgaver i det stille.** Foretrekk
nasjonalbibliotek, Wikikilden/Wikisource, Project Runeberg og andre institusjoner
med klar provenance.

Én kjent felle for denne katalogen: Kierkegaard-teksten finnes både som
originalutgave fra 1843 og som moderne kritiske utgaver (*Søren Kierkegaards
Skrifter* m.fl.). Den kritiske utgavens tekstetablering og apparat er et eget
verk med egne rettigheter. Grunnlaget må være originalutgaven eller en
transkripsjon av den. Samme resonnement gjelder enhver «modernisert» dansk eller
norsk utgave.

## Særskilte redaksjonelle tilfeller

- ***Bondestudentar* krever en faktisk overføring fra landsmål**, ikke bare
  modernisert rettskrivning. Det bryter med `LANGUAGE_PROFILE.md`s forbud mot å
  bytte forfatterens ordvalg, og skal derfor merkes som noe annet enn en
  treningsutgave av samme slag. Se T-20.
- **Versedrama som *Peer Gynt* krever støtte for verseformatering** og skal ikke
  få bestemme den første prosaorienterte innholdsmodellen.
- **Grundtvig og Georg Brandes** representeres først ved kuraterte tematiske
  utvalg, ikke ved enorme udifferensierte bind.
- **H.C. Andersen kurateres for litterær og voksen interesse**, slik at BRAND
  ikke fremstår som en leseapp for barn.
- **Danske tekster beholder sin intellektuelle og stilistiske identitet** også i
  Brand-riksmål.
- **Drama må bevare replikknavn, sceneanvisninger og dialogstruktur.**
  `segments.json` har allerede `speakerLinePattern`, som holder replikknavnet
  sammen med replikken; *Et dukkehjem* er første prosadrama som prøver den.

## Rekkefølgeregel: struktur før import

**Ikke importer alle 25 verkene nå.** Sørg først for at innholdsarkitekturen
tåler:

- bøker, skuespill, essays og kuraterte samlinger;
- hierarkiske verk og moduler;
- original og Brand-tilpasset tekst;
- norsk og dansk kildespråk;
- pålitelig segmentering;
- kilde- og rettighetsmetadata;
- fremtidige hyller, søk og filtrering.

Når strukturen står, begynn med *Sult*, deretter *Gift*, deretter *Et
dukkehjem* — med mindre kildekvalitet eller et importproblem tvinger fram en
midlertidig endring. Ethvert avvik fra rangeringen dokumenteres.

## ContentPack-kontrakt

Et innholdspakkeobjekt beskriver et kuratert sett med tekster, ikke en
treningsregel. Én pakke er i dag lik ett verk; med 25 verk og flere verk per
forfatter er hyllen — ikke pakken — det leseren navigerer etter.

```ts
type ContentPack = {
  id: string;
  title: string;
  description: string;
  languageProfileIds: string[];
  workIds: string[];
  tags: string[];
  status: "draft" | "active" | "archived";
  sourceAttribution: SourceAttribution[];
};
```

Hvert verk deles i stabile, navngitte segmenter. `Nonstop` bruker
segmentrekkefølge og lagrer fremdrift per verk. `Passage` og `Timed` bruker
segmenter eller nøye avgrensede utdrag med egen vanskelighetsmerking.

## Passasjekuratering

Et godt treningsutdrag skal:

- være semantisk avgrenset og ikke starte eller slutte midt i en setning;
- ha korrekt tegnsetting, avsnitt og anførselstegn;
- ha en kjent ordmengde og estimerbar varighet;
- representere verkets tone uten å kreve mye forkunnskap;
- merkes med vanskelighet basert på lengde, tegnsetting, sjeldne ord og
  setningsstruktur.

Anbefalt størrelse for `Passage`: 35–120 ord. `Timed` kan gjenbruke samme
passasjer, men skal ha nok materiale til å unngå umiddelbar repetisjon.
Segmentgrenser foreslås av `scripts/import/propose-segments.ts` og leses
etterpå; avvik fra lengdeintervallet registreres med begrunnelse i
`KNOWN_LENGTH_DEVIATIONS`.

## Struktur for tekstfiler

```
content/
  <pakke>/
    pack.json
    segments.json            # håndskrevet: grenser, deler, replikkmønster
    original.json            # v1, beholder uendret id
    original.v2.json         # en tekst som vokser, versjonert (D15)
    rules.vN.json
    training-edition.vN.json
    review.json              # redaksjonell lesning, søsken av utgaven
    source/                  # rå kilde, arkivert verbatim
```

Tekstfiler skal være UTF-8, versjonerte og strukturerte som segmenter fremfor
én udelelig streng. Bevar avsnitt, men bruk eksplisitte `segmentId`-er slik at
lagret fremdrift ikke bryter når grensesnittet endres.

## Kvalitetssjekk før publisering

1. Verifiser kilde- og rettighetsmetadata.
2. Kontroller original tekst mot kilden.
3. Utfør og loggfør forsiktig tilpasning i treningsutgaven.
4. Sammenlign original og treningsutgave for å oppdage utilsiktede omskrivinger.
5. Kjør `pnpm validate:content` for tomme segmenter, ugyldig Unicode, doble
   mellomrom og segmentgrenser.
6. Les minst én fullstendig økt i hver modus før pakken aktiveres.

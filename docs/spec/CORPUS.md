# BRAND — corpus og redaksjon

## Formål

Corpuset skal gi litterært gode tekster med varierende rytme, setningslengde og vanskelighetsgrad. V1 skal være lite, kuratert og ryddig: få verk med god metadata og tydelige utgaver er bedre enn et stort ujevnt bibliotek.

## V1-prioritet

| Prioritet | ContentPack | Verk | Rolle |
| --- | --- | --- | --- |
| 1 | `ibsen-brand` | Henrik Ibsen, *Brand* | Produktets navngivende kjernetekst; egnet for `Nonstop` og `Passage`. |
| 2 | `hamsun-markens-groede` | Knut Hamsun, *Markens grøde* | Langform, naturprosa og vedvarende rytme. |
| 3 | `kielland-noveletter` | Alexander Kielland, *Noveletter* | Korte, selvstendige økter; prioriter «Ballstemning». |
| 4 | `kielland-gift` | Alexander Kielland, *Gift* | Samfunnskritisk roman med variert dialog og fortellende prosa. |

Et minimum for første lansering er én kontrollert treningsutgave av alle fire verkene, med passasjer som kan brukes direkte i `Passage` og `Timed`. Hvis redaksjonelt arbeid må avgrenses, lanser *Brand* fullt og de øvrige verkene som utvalgte, kvalitetssikrede passasjer.

## ContentPack-kontrakt

Et innholdspakkeobjekt beskriver et kuratert sett med tekster, ikke en treningsregel:

```ts
type ContentPack = {
  id: string;
  title: string;
  description: string;
  languageProfileIds: string[];
  works: Work[];
  tags: string[];
  sourceAttribution: SourceAttribution[];
};
```

Hvert verk deles i stabile, navngitte segmenter. `Nonstop` bruker segmentrekkefølge og lagrer fremdrift per verk/utgave. `Passage` og `Timed` bruker segmenter eller nøye avgrensede utdrag med egen vanskelighetsmerking.

## Passasjekuratering

Et godt treningsutdrag skal:

- være semantisk avgrenset og ikke starte eller slutte midt i en setning;
- ha korrekt tegnsetting, avsnitt og anførselstegn;
- ha en kjent ordmengde og estimerbar varighet;
- representere verkets tone uten å kreve mye forkunnskap;
- merkes med vanskelighet basert på lengde, tegnsetting, sjeldne ord og setningsstruktur.

Anbefalt V1-størrelse for `Passage`: 35–120 ord. `Timed` kan gjenbruke samme passasjer, men skal ha nok materiale til å unngå umiddelbar repetisjon.

## Utgave- og rettighetskrav

Før inkludering må hvert verk ha verifisert status og kildegrunnlag. Vurderingen må gjøres for den konkrete digitale kilden, utgaven, jurisdiksjonen og eventuelle tilleggselementer; det er ikke tilstrekkelig å anta at et eldre verk kan brukes fritt.

For hver originaltekst lagres minst:

- forfatter, verkstittel, førsteutgivelsesår og språk;
- kildelenke eller arkividentifikator;
- hentet dato, tilgjengeliggjører og lisens/status;
- digital utgave/transkripsjon og eventuelle redaksjonelle merknader;
- kontrollstatus og redaktør.

Ikke importer tekst fra tilfeldige nettsider uten kilde- og rettighetskontroll. Foretrekk offentlige biblioteker, nasjonalbiblioteker, Wikikilden eller andre institusjoner med klar provenance.

## Struktur for tekstfiler

Forslag for innhold i kodebasen:

```
content/
  ibsen-brand/
    pack.json
    original.json
    training-edition.v1.json
  hamsun-markens-groede/
    pack.json
    original.json
    training-edition.v1.json
  kielland-noveletter/
    pack.json
    original.json
    training-edition.v1.json
  kielland-gift/
    pack.json
    original.json
    training-edition.v1.json
```

Tekstfiler skal være UTF-8, versjonerte og strukturerte som segmenter fremfor én udelelig streng. Bevar avsnitt, men bruk eksplisitte `segmentId`-er slik at lagret fremdrift ikke bryter når grensesnittet endres.

## Kvalitetssjekk før publisering

1. Verifiser kilde og rettighetsmetadata.
2. Kontroller original tekst mot kilden.
3. Utfør og loggfør forsiktig modernisering i treningutgaven.
4. Sammenlign original og treningsutgave for å oppdage utilsiktede omskrivinger.
5. Kjør automatisk validering for tomme segmenter, ugyldig Unicode, doble mellomrom og segmentgrenser.
6. Les minst én fullstendig økt i hver modus før pakken aktiveres.

# BRAND — tastemotor

## Ansvar

Tastemotoren sammenligner brukerens innskriving med den valgte tekstutgaven, leverer tilbakemelding mens brukeren skriver, og produserer en nøyaktig øktsoppsummering. Den skal være deterministisk, testbar og uavhengig av React-komponenter, lagring og innholdskilde.

Motoren mottar alltid den konkrete `TextEdition` som vises. Den skal ikke selv modernisere språk eller hente innhold.

## Feilmodus

### Flow — standard i V1

Brukeren kan skrive videre selv når neste tegn er feil. Motoren sammenligner tegn for tegn mot målet og viser feil diskret, men tastaturet blokkeres aldri.

- Feil tegn markeres visuelt nær eller i den skrevne teksten.
- Riktig posisjon fortsetter å bevege seg fremover med brukerens innskriving.
- Backspace lar brukeren rette tidligere inntasting.
- Resultatet beregner nøyaktighet ut fra faktisk input, også korrigerte eller ukorrigerte feil etter en tydelig definisjon.

### Stop-on-error — ikke i V1, men støttes i kontrakten

Når modusen aktiveres, avvises tastetrykk som ikke matcher neste forventede tegn. Dette skal være en `errorMode`-strategi, ikke en fork av tastemotoren.

```ts
type ErrorMode = 'flow' | 'stop-on-error';
```

## Tilstand

```ts
type TypingSessionState = {
  targetText: string;
  typedText: string;
  cursorIndex: number;
  startedAt: number | null;
  endedAt: number | null;
  status: 'idle' | 'active' | 'completed' | 'abandoned';
  errorMode: ErrorMode;
  eventLog: TypingEvent[];
};
```

`cursorIndex` er som hovedregel lengden på `typedText` i flow-modus, men beholdes eksplisitt for senere støtte av seleksjon, IME og alternative moduser. En `TypingEvent` registrerer tidspunkt og relevant handling (`insert`, `backspace`, `paste-rejected`, `complete`) uten å lagre mer data enn nødvendig.

## Inputregler

- Start klokken ved første aksepterte tegn.
- Aksepter vanlig tekstinput gjennom `beforeinput`/input-hendelser der mulig, ikke kun tastaturkoder. Det gir bedre støtte for norsk tegnsett og ulike tastaturoppsett.
- Tillat Backspace. Ikke la Tab, Enter eller piltaster uforvarende endre målteksten eller flytte fokus ut av økten.
- Lim inn tekst skal avvises i V1 for sammenlignbare resultater, med en rolig forklaring. Dette gjelder også drag-and-drop.
- Normaliser kun transporttegn på forhånd: linjeskift til `\n`, og Unicode til NFC. Ikke fjern tegnsetting, mellomrom eller forskjeller i store/små bokstaver.
- Når målet er nådd, fullføres økten én gang og inntasting stoppes eller ignoreres.

## Sammenligning og visning

For hvert måltegn kan renderen avlede én av tre visuelle tilstander:

- `pending`: ikke skrevet ennå;
- `correct`: skrevet tegn matcher målet på samme indeks;
- `incorrect`: et tegn finnes på indeksen, men matcher ikke målet.

Hvis brukeren i flow-modus skriver forbi måltekstens lengde, skal ekstra tegn markeres som feil i en separat hale eller ignoreres etter fullføring. Anbefalt V1: fullfør umiddelbart ved måltekstlengde og tillat ikke ekstra tegn.

For lange tekster skal bare et vindu rundt aktiv posisjon rendres; resten kan virtualiseres. Målet er stabil visning og ingen hopp i tekstlinjene mens brukeren skriver.

## Målinger

```ts
grossWpm = (typedCharacters / 5) / elapsedMinutes
netWpm = grossWpm * accuracy
accuracy = correctCharacters / comparedCharacters
```

`comparedCharacters` er antall posisjoner med brukerinput, avgrenset til måltekstens lengde. I V1 bør resultatet vise netto WPM, nøyaktighet, varighet, totale tegn og feil. Samme definisjoner må brukes i live-visning, lagret økt og historikk.

For økter under fem sekunder bør WPM merkes som foreløpig eller skjules for å unngå misvisende toppverdier.

## Modusadaptere

Spillmodus bestemmer måltekst og avslutningsregel, men bruker samme motor:

| Modus | Motorinput | Avslutning |
| --- | --- | --- |
| Nonstop | Neste segment(er) fra en kontinuerlig leseplan | Brukeren avslutter eller når valgt delmål |
| Passage | Ett avgrenset utdrag | Hele utdraget skrevet |
| Timed | Ett eller flere utdrag | Tidsgrense nådd |

En `GameMode` leverer en `SessionPlan`; motoren kjenner ikke til bøker, forfattere eller språkprofiler.

## Testkrav

- Norsk tegnsett: æ, ø, å, bindestrek, tankestrek, sitattegn og flere mellomrom.
- Feil, retting med Backspace og gjentatte rettinger.
- Start/stop, fullføring og tom økt.
- Tidsberegning med simulert klokke.
- NFC-normalisering og konsistente linjeskift.
- Avvist liming uten at tilstand eller statistikk korrumperes.
- Like resultater ved rendering og etter rehydrering fra lagret økt.

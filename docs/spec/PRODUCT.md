# BRAND — produktgrunnlag

## Kort fortalt

BRAND er en webbasert skrive- og tasteapp for konsentrert trening på norsk prosa. Den kombinerer gode litterære tekster med en bevisst, moderne-konservativ riksmålsprofil. Produktet skal først og fremst være et personlig verktøy: raskt å åpne, behagelig å lese og uten konto, støy eller gamifisering som avbryter skrivingen.

Navnet viser både til Henrik Ibsens *Brand*, startverket i biblioteket, og til en tydelig språklig identitet. BRAND er ikke en språkstandard; det er en valgfri språkprofil som gir teksten og grensesnittet en konsekvent stemme.

## Produktløfte

Skriv deg inn i god norsk prosa — med ro, rytme og målbar fremgang.

## Primærbruker og kontekst

V1 er laget for eieren av produktet: en norsk bruker som vil skrive mer, raskere og mer presist, og som foretrekker moderne, konservativt riksmål. Senere kan produktet publiseres gratis uten at dette endrer V1-prinsippene.

En typisk økt varer fra ett til tretti minutter. Brukeren velger en modus og en tekst, skriver, får tydelig men lavmælt tilbakemelding, og fortsetter derfra neste gang.

## Kjerneprinsipper

1. **Teksten først.** Skjermen skal føles som en god leseflate, ikke et kontrollpanel.
2. **Flyt før straff.** Feil skal registreres uten at brukeren stanses som standard.
3. **Språk, mekanikk og innhold er separate akser.** En språkprofil er ikke en spillmodus, og en bok er ikke en spillmodus.
4. **Originalen respekteres.** Kildeteksten beholdes uendret og skilles fra en forsiktig modernisert treningsutgave.
5. **Lokal først.** Ingen innlogging eller nettverksavhengighet i V1. Brukerens historikk bor i nettleseren.
6. **Rolig fremgang.** Statistikk skal gi innsikt, ikke presse frem en konkurranseopplevelse.

## Informasjonsmodell

| Lag | Spørsmål det svarer på | Eksempel |
| --- | --- | --- |
| `LanguageProfile` | Hvilken språkform trener jeg på? | `brand-riksmaal` |
| `GameMode` | Hvordan trener jeg? | `nonstop`, `passage`, `timed` |
| `ContentPack` | Hvilket innhold trener jeg på? | `ibsen-brand`, `hamsun-markens-groede` |
| `TextEdition` | Hvilken tekstversjon vises? | `original`, `training-edition` |

`LanguageProfile` former visning, normalisering og eventuell fremtidig språklig veiledning. `GameMode` bestemmer øktens regler og måling. `ContentPack` leverer verk, deler og passasjer. Ingen av disse lagene skal importere eller være avhengige av de andre på en måte som låser videre utvikling.

## Hovedflyt i V1

1. Åpne BRAND til en enkel startside med «Fortsett» som fremste handling.
2. Velg eller gjenoppta en økt i `Nonstop`, `Passage` eller `Timed`.
3. Velg innholdspakke, verk og eventuelt passasje.
4. Skriv mot valgt treningsutgave; feil markeres i flytmodus uten å stoppe innskrivingen.
5. Avslutt eller fullfør og se en kort oppsummering: netto WPM, nøyaktighet, varighet og fremgang.
6. Historikk og sist brukte konfigurasjon lagres lokalt.

## Ikke mål i V1

- Konto, synkronisering, sosial ranking eller deling.
- Mobilapp eller native-optimalisering.
- Automatisk språkvask, KI-generert tekst eller adaptive øvelser.
- Et komplett digitalt bibliotek eller juridisk usikre tekster.
- Fremtidige moduser som Markdown, Startup, Finance og Code.

## Suksesskriterier

- En økt kan startes på under to sekunder etter at appen er lastet.
- Brukeren kan skrive uten å møte modale avbrytelser eller krav om konto.
- Vist tekst er lesbar over lange økter i både lys og mørk modus.
- Statistikk er konsistent mellom økter og ligger trygt i lokal lagring.
- Nye språkprofiler, moduser og innholdspakker kan legges til uten å skrive om tastemotoren.

## Tonen

Språket i produktet skal være nøkternt, varmt og presist. Unngå teknologispråk, poengjag og utropstegn. Eksempler: «Fortsett økten», «2 minutter igjen», «Rolig og presist», «Se resultat».

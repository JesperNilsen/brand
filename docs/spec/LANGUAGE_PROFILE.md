# BRAND — språkprofil

## Formål

`LanguageProfile` er BRANDs språk- og stilkonfigurasjon. V1 har én aktiv profil: `brand-riksmaal`. Den skal gi en moderne og konservativ riksmålstonet treningsutgave uten å utgi seg for å være en offentlig norm eller erstatte originaltekst.

Profilen er uavhengig av spillmodus og innholdspakke. En fremtidig engelsk `Startup`-pakke kan for eksempel bruke en engelsk profil, uten at det påvirker norsk `Nonstop`.

## Profil: `brand-riksmaal`

### Identitet

- Språk: norsk, moderne-konservativt riksmål.
- Mål: lettlest, verdig og naturlig språk — aldri museumsaktig eller affektert.
- Virkeområde i V1: valg av treningsutgave, presentasjonstekst og fremtidig regelbasert normalisering.
- Ikke virkeområde: endring av originaltekster eller kontroll av brukerens frie skriving.

### Foretrukne former

Bruk den konservative formen når begge former er tilgjengelige og valget ikke forvrenger kildens stil:

| Foretrekk | Fremfor |
| --- | --- |
| frem | fram |
| boken | boka |
| syv | sju |
| nå | nu |
| etter | efter |
| meget | mye |
| selv | sjøl |
| bygget | bygd |

Samme prinsipp gjelder tilsvarende valg: moderat-konservative, allment forståelige former foretrekkes. Ikke innfør sjeldne eller markert høytidelige former bare for å gjøre teksten «riksmålspreget».

## Brand Training Edition

Hver tekst som behandles i V1 skal ha to tydelig atskilte lag:

1. **Originaltekst** — nøyaktig transkripsjon av kilden, med kildehenvisning og uten språklige inngrep.
2. **Brand Training Edition** — den teksten brukeren normalt skriver, tilpasset profilen etter prinsippene nedenfor.

### Tillatte inngrep

- Moderniser utvetydig foreldet ortografi når lesbarheten klart bedres.
- Normaliser konsekvent til profilens valgte form ved likeverdige, vanlige varianter.
- Oppdater tegnsetting eller store/små bokstaver bare når dette er nødvendig for stabil og moderne lesing.
- Rett åpenbare transkripsjonsfeil når de kan dokumenteres, med notat i redaksjonsmetadata.

### Ikke tillatte inngrep

- Ikke omskriv syntaks, rytme, billedbruk, dialog eller ordvalg for å gjøre teksten «enklere».
- Ikke bytt dialektnære, sosialt markerte eller karakterbærende former når de er litterært meningsfulle.
- Ikke moderniser betydning, historiske referanser eller grammatisk særpreg.
- Ikke bland original og treningsutgave i samme rendereflate uten eksplisitt merking.

## Redaksjonell arbeidsflyt

1. Innhent og registrer en offentlig tilgjengelig, lovlig kilde.
2. Lagre den rå transkripsjonen som `original` med uforanderlig kildemetadata.
3. Lag `training-edition` som en egen post eller fil, med henvisning til originalen.
4. Loggfør hver vesentlige normalisering i `editorialNotes` eller som en liten versjonslogg.
5. La en redaktør kontrollere at tekstens setningsmelodi og litterære særpreg er beholdt.

## Produktatferd

- Standardvisning i norsk litteratur er `training-edition`.
- Brukeren skal kunne se at utgaven er «Brand Training Edition» og åpne informasjon om redaksjonelle prinsipper.
- Originalteksten kan tilbys som lesemodus eller alternativ senere; den må aldri overskrives.
- Tastemotoren sammenligner mot nøyaktig den utgaven som vises.

## Fremtidig utvidelse

Kontrakten skal støtte flere profiler, for eksempel `bokmaal-neutral`, `nynorsk` eller `english-technical`. Profilobjektet må derfor ha eget id, språk, visningsnavn, regelsett og versjon. Gamemodes skal kun spørre profilen om nødvendig sammenlignings- og visningsatferd, ikke hardkode norske regler.

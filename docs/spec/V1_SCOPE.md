# BRAND — V1-scope

## Målet for V1

En ferdig webopplevelse der brukeren kan starte og fortsette en norsk skriveøkt med et lite, kuratert litteraturbibliotek, finne igjen fremgangen lokalt og se nøkterne resultater.

## Inkludert

### Moduser

- **Nonstop:** kontinuerlig skriving gjennom segmenter fra ett verk, med lokal fremdrift.
- **Passage:** velg eller få et avgrenset utdrag og skriv det ferdig.
- **Timed:** skriv mot en tidsgrense med et passende utdrag eller en kontinuerlig strøm av utdrag.

Alle tre bruker `flow` som standard feilmodus. Kontrakter og innstillinger kan forberede `stop-on-error`, men selve brukerflaten for den er ikke nødvendig i V1.

### Innhold

- Henrik Ibsen: *Brand*.
- Knut Hamsun: *Markens grøde*.
- Alexander Kielland: *Noveletter*, med «Ballstemning» prioritert.
- Alexander Kielland: *Gift*.
- Originaltekst og separat Brand Training Edition, med kildemetadata og enkel redaksjonell versjonering.

### Opplevelse

- Hjem/skriveflate med «Fortsett» og enkel modus-/tekstvelger.
- Klassisk, litterær typografi med god linjeavstand, begrenset linjebredde og tydelig aktiv skrivelinje.
- Lys, mørk og systembasert fargeinnstilling; mørk modus skal være like behagelig som lys.
- Live-måling av WPM, nøyaktighet og tid uten dominerende støy.
- Resultatskjerm og enkel økthistorikk.
- Lokal lagring av preferanser, siste valg, Nonstop-fremdrift og øktresultater.
- Tilgjengelig tastaturnavigasjon, synlige fokusmarkører og tilstrekkelig kontrast.

### Teknisk

- Next.js med TypeScript og Tailwind CSS.
- App Router og serverfrie, statiske innholdsfiler i V1 der det passer.
- Ren domenelogikk for tastemotor, moduser og repository.
- IndexedDB-adapter for historikk/fremdrift og `localStorage` for små preferanser.
- Enhetstester for tastemotor og statistikk, samt én eller flere ende-til-ende-flyter.

## Utenfor scope

- Innlogging, konto, synkronisering, database eller Supabase-integrasjon.
- Sosiale funksjoner, ranglister, vennelister, deling og varsler.
- Native iOS/Android-app, offline-installasjon eller særskilt mobiloptimalisering utover responsiv web.
- KI-funksjoner, skriveassistent, genererte øvelser eller automatisk modernisering i runtime.
- Anmeldelser, kommentarer eller et omfattende bibliotek.
- Avanserte dashboards, målplaner og achievements.
- `Markdown`, `Startup`, `Finance`, `Code` og `Endurance` som tilgjengelige moduser.

## Fremtidig kompatibilitet

Følgende skal være modellerbare fra første dag, men ikke eksponeres som V1-funksjoner:

| Fremtidig funksjon | Arkitektonisk forberedelse |
| --- | --- |
| Flere språkformer | `LanguageProfile` har eget id, språk og versjon. |
| Markdown/Startup/Finance/Code | `GameMode` og `ContentPack` er separate registre. |
| Stop-on-error | `ErrorMode` er en strategi i motoren. |
| Supabase | UI avhenger av repository-kontrakt, ikke IndexedDB direkte. |
| Konto/sync | Brukerdata har stabile identifikatorer, tidsstempler og schema-versjon. |

## Leveringsrekkefølge

1. Prosjektskall, design tokens og mørk/lys tema.
2. Innholdsmodell med én kontrollert *Brand*-treningsutgave.
3. Tastemotor i flow-modus med testdekning.
4. Passage som første komplette brukerflyt.
5. Resultatlagring og enkel historikk.
6. Nonstop med segmentfremdrift.
7. Timed med robust tidtaking.
8. *Markens grøde*, Kiellands *Noveletter* og *Gift*, responsivitet og sluttpolering.

## Akseptansekriterier

- En ny bruker kan velge *Brand*, starte en Passage-økt og få et korrekt resultat uten konto.
- En avbrutt Nonstop-økt gjenopptas ved riktig segment etter ny lasting av siden.
- Flow-modus lar brukeren skrive videre ved feil og beregner nøyaktighet korrekt.
- Tema- og preferansevalg består en omlasting.
- Historikk viser riktige tall og identifiserer hvilket verk og hvilken utgave som ble brukt.
- Appen er god å bruke på skrivebord og funksjonell på smale skjermer, uten å love app-lik mobilopplevelse.

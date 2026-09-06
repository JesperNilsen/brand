# BRAND — designsystem

Dette dokumentet beskriver systemet slik det faktisk er skipet, ikke slik det
kunne blitt. Alt her er utledet fra `src/app/globals.css` og komponentene i
`src/components/`. Endrer du en av dem, hører endringen hjemme her også.

Der en regel ennå ikke er innfridd i koden, står det eksplisitt, med
TODO-nummeret. Et designdokument som beskriver intensjoner i presens er verre
enn ingen: neste leser tar det for avgjort og bygger videre på noe som ikke
finnes. Skriver du inn en ny regel her, mål den først.

Kilden til produktgrunnlaget er `docs/spec/PRODUCT.md`. Der en regel under
finnes for å tjene et uttalt prinsipp, står prinsippet i parentes.

---

## Grunnholdning

**Teksten først.** Skjermen er en leseflate, ikke et kontrollpanel. Hver gang et
element konkurrerer med prosaen, taper elementet. Dette er ikke en preferanse,
det er kriteriet en uenighet avgjøres på.

Tre følger av det:

1. **Trekk fra før du legger til.** Et element som ikke fortjener plassen sin,
   fjernes. Resultatsiden hadde fem knapper på rad; to av dem gjentok
   toppmenyen, og de er borte.
2. **Ro er ikke det samme som fraværende.** Fokusmodus demper omgivelsene, men
   demping som gjør tekst uleselig er ikke ro — det er en feil. Se
   kontrastkapittelet.
3. **Ingen teknologistemme.** «Henter teksten …», ikke «Loading resources».
   Ingen utropstegn, ingen poengjag.

---

## Farger

Lys er grunnlaget. Mørkt tema settes enten eksplisitt (`[data-theme="dark"]`)
eller av systemet når intet lyst valg er lagret. Alt visuelt leser fra
variabler — ingen komponent skriver en heksverdi selv.

| Token | Lys | Mørk | Rolle |
| --- | --- | --- | --- |
| `--paper` | `#f7f3ec` | `#171614` | sidens bunn |
| `--surface` | `#fffdf8` | `#1f1d1a` | kort, knapper, felter |
| `--ink` | `#221f1b` | `#e9e3d8` | brødtekst, skrevne tegn |
| `--ink-muted` | `#625c53` | `#a8a094` | metatekst, ventende tegn |
| `--ink-faint` | `#746e65` | `#8f887e` | ↵-glyf, forhåndsvisning, lenkestrek |
| `--rule` | `#e3dcd0` | `#302d28` | **dekorative** hårstreker |
| `--rule-strong` | `#8f8b83` | `#6a6864` | **interaktive** komponentgrenser |
| `--accent` | `#7a2f2f` | `#d19a8a` | primærknapp, markør |
| `--accent-soft` | `#f0e3e0` | `#3a2a27` | markering, varselflate |
| `--error` | `#a63a3a` | `#e08a84` | feil tegn |
| `--focus` | `#3b5f8a` | `#9fbfe6` | fokusring |

### Kontrast er et krav, ikke en ambisjon

Alle forhold er WCAG 2.1 mot `--paper`. **Brødtekst skal ligge på 4,5:1 eller
over. Grensen som identifiserer en interaktiv komponent skal ligge på 3:1 eller
over** (WCAG 1.4.11).

To feil ble funnet i revisjonen 6. september 2026 og er rettet:

- `--ink-faint` lå på **2,75:1** (lys) og ble brukt til bunntekst og
  instruksjonsglyfer. Nå `#746e65` → 4,56:1 mot papir, 4,96:1 mot flate.
- `.btn` og `.card` hentet grensen sin fra `--rule` på **1,23:1**. Rammen rundt
  en sekundærknapp var i praksis usynlig. Derfor finnes `--rule-strong`.

**Skillet mellom `--rule` og `--rule-strong` er hele poenget.** 1.4.11 gjelder
grensen som forteller deg at noe er en kontroll, og fritar rent dekorative
skiller. En tabellrad og understreken under toppmenyen er dekor og beholder
`--rule`; en knapp, et kort og et skjemafelt er kontroller og skal ha
`--rule-strong`. Ikke gjør dem like igjen.

### Demping

To steder demper vi med `opacity`, og begge er *fremheving*, ikke informasjon:

| Regel | Verdi | Verste tekst innenfor |
| --- | --- | --- |
| `[data-typing="on"] .recedes` | `0.7` | 3,13:1 (lys) / 4,08:1 (mørk) |
| `.typing-surface:not(:focus-within) .typing-lines` | `0.75` | 3,13:1 ventende tekst |

Begge lå tidligere langt lavere — `.recedes` på `0.22`, altså **1,36:1**, med
en kommentar i kildekoden som påsto at kontrollene «stay legible». De gjorde de
ikke. Hvis du senker disse igjen, regn ut tallet først.

`@media (prefers-contrast: more)` slår begge av. En leser som har bedt
plattformen om mer kontrast, får grensesnittet i full styrke.

---

## Typografi

Én skriftfamilie, serif, gjennom hele appen. Ingen `system-ui`, ingen Inter.
Skriften bærer produktløftet og er et valg, ikke en standardverdi.

```
--font-serif: "Iowan Old Style", "Palatino Linotype", Palatino,
              "Book Antiqua", Charter, "Source Serif Pro", Georgia,
              "Times New Roman", serif;
```

Rot er `17px`. Målestokken finnes som tokens i `globals.css`:

| Token | Verdi | Til |
| --- | --- | --- |
| `--text-title` | `1.9rem` | forsidens h1 |
| `--text-heading` | `1.5rem` | sidetittel (verk, resultat, historikk) |
| `--text-section` | `1.25rem` | h2 på Om-siden |
| `--text-lead` | `1.125rem` | korttittel, ingress |
| `--text-body` | `1rem` | brødtekst |
| `--text-meta` | `0.875rem` | metatekst, tabelldata |
| `--text-label` | `0.8125rem` | `.label`, små kapitéler |

**Status: tokenene er fasit, men visningene leser ennå ikke fra dem.** Sytten
Tailwind-verktøy (`text-3xl`, `text-2xl`, `text-xl`, `text-lg`) står fortsatt
igjen i sju filer, og `--text-*` er referert null steder i TSX. Tallene i
tabellen over er de faktiske størrelsene de verktøyene gir i dag, så
målestokken er riktig beskrevet — den er bare ikke håndhevet noe sted ennå.
Migreringen er **T-14**. Skriver du en ny skjerm før den er gjort, bruk
tokenene: da er det én fil mindre å rydde.

**Under `--text-meta` går man ikke for tekst som skal leses.** Bunnteksten lå
på `text-xs` (12,75px) i `--ink-faint`, altså liten *og* svak samtidig; den er
nå `text-sm` i `--ink-muted`. Reduser vekt med farge og luft, ikke med
skriftstørrelse.

Lesebredden er `--measure: 34rem` og gjelder all prosa, inkludert skriveflaten.

---

## Komponenter

Alle komponentklasser ligger i `@layer components`, og de globale
elementreglene for `a` ligger i `@layer base`. **Dette er ikke valgfritt.** En
ulagd regel slår enhver lagd Tailwind-utility uansett spesifisitet, og den
feiler stille: elementet vises, bare med feil verdi.

Repoet er bitt av dette **tre** ganger. `a8386cb` og `0595a00` var
klasseselektorer. Den tredje, funnet 2026-09-06, var en elementselektor:
`a { text-decoration: underline }` lå ulagd og slo både `no-underline` på
ordmerket og menyen og den `text-decoration: none` som `.btn` og `.card` setter
selv — hver lenkeformet knapp og hvert kort på siden var understreket, og
ingenting rapporterte det. Porten så den gangen bare på klasseselektorer.
`pnpm check:css` dekker nå elementselektorer også, med `html`, `body`, `:root`
og `*` på allowlisten.

Unntaket er skriveflaten (`typing-*`, `ch-*`, `recedes`, `is-*`), som er
bevisst ulagd og står i allowlisten i `scripts/check-css-layers.ts` med
begrunnelse.

| Klasse | Bruk |
| --- | --- |
| `.btn` | rolige, klassiske kontroller; `--rule-strong` som ramme |
| `.btn-primary` | **én per skjerm.** Handlingen leseren kom for |
| `.card` | kun når kortet *er* interaksjonen — et verk, en passasje, panelet |
| `.label` | små kapitéler til metainformasjon; sparsomt |
| `.control` | `select` og `input` |
| `.placeholder` / `.placeholder-line` | venting, se under |
| `.prose-measure` | låser bredden til `--measure` |

**Kort fortjener plassen sin.** Et kort er ikke en dekorasjon rundt tekst. Er
det ingen interaksjon, er det en liste eller et avsnitt.

---

## Tilstander

Hver asynkron visning har fire, ikke én. Fram til revisjonen 6. september 2026
tegnet fire skjermer `null` mens de ventet, og en blank flate leser som en
ødelagt lenke — ikke som en side som arbeider. Etter fase 3 ligger korpuset
utenfor bundelen, så ventingen er ekte nettverkstid, og den er nøyaktig de to
sekundene `PRODUCT.md` lover en økt starter innenfor.

| Tilstand | Regel |
| --- | --- |
| **Laster** | `<Loading message="…" />`. Stolper som holder målestokken så ingenting hopper, og `role="status"` så ventingen ikke er taus for en skjermleser. Aldri `null`. |
| **Tom** | En setning med varme og *én* neste handling. «Ingen økter ennå» alene er ikke en tom tilstand. |
| **Feil** | `role="alert"`, en overskrift som sier hva som skjedde, og «Prøv igjen» rett under. Der skriveflaten forsvinner, flyttes fokus til overskriften. |
| **Ferdig** | Tallene først, så neste handling. |

Stolpene er statiske med vilje. En shimmer konkurrerer med prosaen den står i
stedet for, og tonen her er lav.

**Ingen `.then()` uten `.catch()`.** `HistoryView` manglet sin og kunne bli
stående blank for alltid, uten melding og uten vei ut.

---

## Respons

Ett bruddpunkt: `640px` (`sm:`).

- **Skriveflaten** faller fra `1.32rem` til `1.12rem`.
- **Historikken** er en stablet liste under 640px og en tabell fra 640px og
  opp. Ni kolonner bak en taus sidelengs rulling er ikke en mobilvisning. Den
  stablede listen leder med verk og hastighet — det man skanner etter — og
  folder resten inn i én metalinje.
- **Modusrutenettet** på forsiden går fra én til tre kolonner;
  **statistikkrutenettet** på resultatsiden fra to til tre.

Mobil-*app* er et ikke-mål i V1. Mobil *nett* er det ikke: skriveflaten har
alltid hatt et bruddpunkt, og resten skal holde samme standard.

---

## Tilgjengelighet

Dette er krav, ikke en sjekkliste å komme tilbake til.

- **Fokus er alltid synlig.** `:focus-visible` gir 2px `--focus` med 3px
  forskyvning. Skriveflaten er unntaket og viser fokus gjennom teksten selv:
  ufokusert faller den til `0.75` og markøren slutter å blinke. `:focus-visible`
  kan ikke brukes der — den treffer alltid på et tekstfelt, også ved museklikk.
- **Klikkbart skal se klikkbart ut, uten hover.** Berøringsskjermer har ingen
  hover. Tilbakelenken på `/velg/[mode]` var `hover:underline` inne i en
  `.label` og fantes dermed ikke på mobil. Lenker i brødtekst og metatekst er
  understreket.
- **Skjermleserkopi ligger utenfor beholderen** den beskriver, koblet med
  `aria-describedby`. Ligger den inni, havner den i containerens `innerText` og
  leses to ganger — og enhver test som leser containeren får den også dobbelt.
- **`aria-live` er grovkornet.** Segmentgrensen, ikke tastetrykket. Per
  tastetrykk gjør siden ubrukelig med skjermleser.
- **En dialog må gjøre skallet `inert`.** `aria-modal` er et løfte, ikke en
  mekanisme. `SessionMenu` portaleres til `<body>` nettopp for at resten kan
  gjøres inert uten å ramme panelet selv.
- **Berøringsmål: 44px gjelder kort og primærhandlinger, ikke lenketekst.**
  Målt på 375px er 23 av 31 mål under 44px: menylenkene i toppen er 21,3px,
  temavelgeren 35,9px og `.btn` 42,8px, mens kortene ligger på 91–185px. Det er
  et valg, ikke et etterslep: mobil-*app* er et ikke-mål i V1, og en tett
  tittellinje er en del av uttrykket. Kortene og primærknappene — det man
  faktisk trykker på i en økt — er komfortable mål.

  Grensen for å ta dette opp igjen: den dagen telefon blir en tiltenkt flate
  for BRAND, skal 44px gjelde alt som kan trykkes, og toppmenyen må da få
  luften det krever.
- **`prefers-reduced-motion`** slår av markørblink, rulleovergangen i
  skriveflaten og dempingsovergangen.

---

## Tone

Nøktern, varm, presis. Fra `PRODUCT.md`: «Fortsett økten», «2 minutter igjen»,
«Rolig og presist», «Se resultat».

Unngå teknologispråk, poengjag og utropstegn. Feilmeldinger sier hva som
skjedde og hva leseren kan gjøre — ikke hva som gikk galt internt.

---

## Når du endrer noe

1. Kontrast: regn ut forholdet før du velger verdien. Ikke bedøm det med øyet.
2. Ny CSS-klasse: inn i `@layer components`, ellers stopper `pnpm check:css`.
3. Ny asynkron visning: alle fire tilstander, ikke bare den som virker.
4. Ny primærknapp: sjekk at det fortsatt bare er én på skjermen.
5. Oppdater dette dokumentet i samme endring.

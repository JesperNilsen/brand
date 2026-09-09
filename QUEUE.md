# Work queue — brand

Drained daily by the `queue-runner` scheduled task. It works in an isolated
worktree, gates on each entry's `verify:` command, and leaves a
`queue/<id>-<slug>` branch for review. **It never merges, pushes, or deploys.**

### Contract for an entry

```
(entry heading: '## Q-NNN · Short title' — a '## Q-' heading is what makes it an entry)
status: <ready | blocked:WHAT | running:BRANCH | review:BRANCH | done>
lane: <one running task per lane>
acceptance: what "done" means, in terms someone else could check
verify: a command that actually FAILS when the work is wrong
notes: pointers, prior art, commits to follow
```

An entry without a real `verify:` gate is not ready to run unattended — the
runner will mark it `blocked:no verify gate` rather than guess one. Keep entries
bounded: one reviewable branch each.

**`verify: pnpm check:all` cannot pass in a queue worktree.** The worktree's
`node_modules` is a symlink to the main checkout's, and Turbopack refuses it
("Symlink [project]/node_modules is invalid, it points out of the filesystem
root"), so `pnpm build` — and therefore `check:all` — fails there for reasons
that have nothing to do with the branch. `check:fast` runs fine. Until the
runner installs into its own worktree, treat `check:fast` as the local gate and
**CI on the pull request as the real `check:all`**; that is where Q-001 and
Q-003 were actually verified.

---

## Q-001 · `check:design` — gate DESIGN.md's falsifiable claims
status: done — merged as `50fa8f2` (#16)
result: scripts/check-design.ts + a 10-case mutation self-test now recompute DESIGN.md's declared numeric claims from globals.css and src/**/*.tsx; wired into check:fast. Found and fixed two false numbers — the 0.75 typing-lines ratio (3,13 → 3,45, copied from the 0.7 recedes rule, same pair also wrong in the CSS comment) and the dark recedes figure (4,08 → 4,07).
lane: brand-main

acceptance:
A new `scripts/check-design.ts`, runnable as `pnpm check:design` and added to
the `check:fast` chain, that recomputes DESIGN.md's numeric claims from source
and fails when they disagree. Specifically:

1. **Contrast.** Parse the token values out of `src/app/globals.css` (light,
   `[data-theme="dark"]`, and the `prefers-color-scheme` block — all three must
   agree with each other, which is itself a claim worth gating). Recompute WCAG
   2.1 ratios and fail if:
   - any token DESIGN.md lists as carrying readable text is under **4.5:1**
     against both `--paper` and `--surface`;
   - `--rule-strong` is under **3:1** against both (WCAG 1.4.11);
   - any ratio *written in DESIGN.md* differs from the computed value by more
     than 0.05.
2. **Composited opacity.** Read the `opacity` from the `[data-typing="on"]
   .recedes` and `.typing-surface:not(:focus-within) .typing-lines` rules,
   composite the worst inner colour over `--paper`, and check the result against
   the ratio DESIGN.md states for that rule. This is the claim that was false
   for months behind a comment asserting the opposite, so it is the one that
   most needs a machine watching it.
3. **Type-scale adoption.** Count ad-hoc size utilities
   (`text-3xl|text-2xl|text-xl|text-lg`) across `src/**/*.tsx` and count
   `--text-*` references. Fail when DESIGN.md's stated adoption status
   contradicts the counts in either direction — including the case where the
   migration (T-14) has been finished but the doc still says it has not.

DESIGN.md gains machine-readable markers so the script parses declared claims
rather than scraping Norwegian prose. HTML comments keep them invisible in the
rendered document, e.g.:

```
<!-- check:design contrast token=--ink-faint theme=light vs=paper ratio=4.56 -->
<!-- check:design opacity rule=recedes value=0.7 worst=3.13 -->
<!-- check:design adoption adhoc=17 tokens=0 -->
```

**A self-test is part of the deliverable, not a nicety.** `scripts/check-design_test.ts`
runs FIRST, before the gate itself, and must prove the gate actually bites by
mutating real files in a temp copy of the repo and asserting a non-zero exit for
each of, at minimum:
- `--ink-faint` darkened back toward the old `#9a938a` → fails;
- `--rule-strong` set equal to `--rule` → fails;
- `.recedes` opacity returned to `0.22` → fails;
- a ratio in DESIGN.md edited to a number the tokens do not produce → fails;
- the light and dark blocks disagreeing about a token → fails;
- an unmodified tree → exits 0.

Mocks do not count. A gate that cannot be shown to fail is not a gate, and the
whole point of this entry is that DESIGN.md is currently the only file in the
repo whose correctness nothing checks.

verify: `pnpm check:design && pnpm check:fast`

notes:
- **Prior art, and the closest model: `ppr/scripts/check_prose_sync.py`**
  (queue Q-001/Q-002 in that repo). Same problem exactly — prose asserting
  numbers that silently drift from the data — and the same shape of answer:
  derive the number, pin it, fail the build on disagreement. Read that before
  designing this one; the deliverable there was the gate, not the number edit.
- Follow the local gate conventions in `scripts/check-css-layers.ts`: a doc
  comment at the top explaining *why the gate exists and what bit the repo*, an
  explicit allowlist where exceptions are deliberate, and an error message that
  tells the reader how to fix it rather than just what failed.
- The test-before-guard ordering is the pattern used by the `reader` repo's
  `check-*` gates (`make merge-check` runs `check-merge-product_test.py` first).
  Copy that shape rather than inventing a fourth one.
- Contrast maths must be WCAG 2.1 relative luminance. A scratch implementation
  that produced the numbers now in DESIGN.md is trivial to rewrite; do not pull
  in a dependency for it.
- Why this entry exists: the designrevisjon on 2026-09-06 wrote DESIGN.md, and
  three of its claims were false **inside the same commit that introduced them**
  (type scale declared adopted while `--text-*` was referenced 0 times; a 44px
  touch-target minimum stated as a requirement while 23 of 31 targets failed; a
  stale count of how often the unlayered-rule bug had bitten). They were caught
  by a manual audit, not by anything failing. That is the gap.
- **Non-goal for this entry:** the touch-target assertion. It needs a real
  browser and belongs in `e2e/`, not in a static script — and after the 2026-09-06
  decision the rule is scoped to cards and primary actions only, so it needs its
  own careful specification. File it separately if wanted; do not let it grow
  this branch.
- Unblocked 2026-09-06: PR #11 merged as `fc0e6b2`, so DESIGN.md and its
  claims are on main and there is something to gate.
- **Lane note.** This entry was written while the språkrens lane (D10–D12) was
  running unpushed on local main and a third lane held the shared checkout on
  `fix/mobile-backspace`. Nothing here touches `src/domain/language/` or
  `scripts/`, so it does not collide with that work — but check the highest
  allocated `T-` number in TODOS.md on main before adding new ones. This queue
  file exists partly because those two lanes silently allocated the same three
  T-numbers on 2026-09-06.

---

## Q-002 · Hopp til en bestemt passasje i boken du er på
status: done — merged as `034b140` (#22)
result: Nonstop-velgeren lister hvert segment via en delt `SegmentIndex`, skrevne segmenter er merket med ordet «Skrevet», et eksplisitt segmentvalg slår det lagrede gjenopptakelsespunktet, og gjenopptakelsen utledes nå av mengden fullførte segmenter i stedet for kjørerens posisjon. Porten er målt mot tre plausible naive implementasjoner, ikke bare mot tomt tre — tabellen står i commit-meldingen.
note: **kjøringen strandet.** Kjøreren døde etter siste filskriving 11:40 med arbeidet ukommittert i arbeidstreet og statusen stående på `running:` — nøyaktig det som ellers blokkerer en lane for alltid. Arbeidet ble tatt over, rebaset på main, ferdigstilt og verifisert i hovedutsjekket. Se også kontraktnotatet over om hvorfor `check:all` ikke kan passere i et køarbeidstre.
lane: brand-ui

acceptance:
The Nonstop chooser (`/velg/nonstop?work=…`) lists every segment in order — the
same ordered list Passage mode already renders in `ChooseView` — so a reader can
open a specific passage of the book they are on instead of only continuing where
they stopped. Specifically:

1. **Every segment is a link, labelled as it already is** ("Første akt, 3 — Liv
   og død"), starting a Nonstop session at that segment.
2. **Segments already written in this work's stored progress are marked**, and
   the mark is not colour alone.
3. **"Fortsett der du slapp" stays the primary action** and stays first. The
   index is the secondary route, not a replacement: the default behaviour of the
   page must not change for someone who just wants to continue.
4. **Jumping must not rewrite progress.** Opening segment 7 directly and
   finishing it marks 7 done and leaves 3–6 untouched. Progress is a set of
   completed segments, not a high-water mark, and this entry must not quietly
   turn it into one.
5. **Keyboard-reachable with accessible names**, so
   `e2e/accessibility.spec.ts`'s "every interactive control on the writing page
   has an accessible name" rule keeps holding for the chooser too.
6. **No horizontal scroll at 375px** — same bar `e2e/responsive-history.spec.ts`
   already sets for the history list. Twelve entries is comfortable; write it so
   sixty is not a redesign.

verify: `pnpm check:all`

The gate is a new `e2e/nonstop-navigation.spec.ts`, and **it must be shown to
fail on unmodified `src/`** — stash the implementation, run the spec, and record
in the branch's commit message which assertions failed and which passed. A
navigation test that passes against the current code is asserting something
trivially true: Passage mode already lists segments, so a selector that finds
"a list of segment links somewhere" finds one today. The assertions that
actually bite are (2) and (4) — the completed marks, and progress surviving a
jump.

Shape it as:
- write segment 1 of `ibsen-brand`, return to `/velg/nonstop?work=ibsen-brand`;
- assert the index is visible and that segment 1 is marked done and 2–12 are not;
- open segment 5 from the index directly, assert the surface shows segment 5's
  text (not segment 2's);
- finish it, return to the chooser, assert 1 and 5 are marked and 2–4 are not.

notes:
- **Prior art is in the same file.** `ChooseView.tsx` already renders the
  ordered segment list under `mode.id === "passage"` (~line 222) via
  `orderedSegments(text)`. This entry is largely about lifting that list so
  Nonstop can render it too, plus the completed-state marks — not about writing
  a new picker. Read that block before designing anything.
- The Nonstop chooser today shows only `Du har skrevet {done} av
  {totalSegments} segmenter. Fortsett der du slapp.` and a `Fortsett` link. That
  string is what `e2e/passage-flow.spec.ts:106` asserts on, so keep it, or fix
  that test deliberately rather than by accident.
- **Non-goal: jumping from inside a running session.** The session menu
  (Escape) is a separate surface with its own pause/finish semantics, and
  wiring a jump into it would grow this branch past one review. File it
  separately if wanted.
- **Non-goal: a hierarchical table of contents.** Every work is currently one
  act, part or chapter — 8 to 13 segments — so act/chapter grouping would be
  structure over nothing. Its trigger is **T-01** (hele kapitler av alle fire
  verk); revisit when a work has more than one act on main, not before.
- Why this entry exists: opening a specific passage already works from
  `/velg/passage`. Inside a book you are reading, it does not — Nonstop offers
  continue and nothing else. That asymmetry is the whole feature.
- **Lane note.** `brand-ui`, not `brand-main`, so it does not serialise behind
  Q-001. The two do not overlap: Q-001 is `scripts/` + `DESIGN.md`, this is
  `src/components/ChooseView.tsx` + `e2e/`. Check the highest allocated `T-`
  number in TODOS.md on main before adding new ones.

---

## Q-003 · Kortformbank: øvingsbiter utledet av utgaven
status: done — merged as `919fb4b` (#17)
result: build-drills.ts proposes candidates (143 for ibsen-brand, gitignored working file), the hand cut is 59 items (21 quote / 22 phrase / 16 word) in content/ibsen-brand/drills.v1.json, and validate:content now enforces verbatim-in-edition, editionContentHash freshness, unique ids/texts, a real segmentId and per-kind length floors — proven by 8 mutation cases in `pnpm check:drills`. No UI and no public/ emission: deferred to Q-004, see the commit message.
lane: brand-content

acceptance:
A new immutable, versioned asset per edition — `drills.v1.json` beside
`training-edition.v1.json` — holding short typing items, plus the generator that
proposes candidates and the validation that keeps the file honest. **No UI in
this entry.**

The shape follows T-11's decision exactly, and for the same reasons: candidates
are *derived from the corpus*, the selection is *written by hand*, and the result
is served as a static asset next to the edition under the same
fetch-not-bundled, same-immutability rules as the edition itself.

1. **Item kinds, all drawn from the edition's own text**: `quote` (one complete
   sentence or verse line that stands alone), `phrase` (a clause worth drilling
   for rhythm), `word` (a single form, grouped into a short run).
2. **`scripts/build-drills.ts` proposes candidates mechanically**, it does not
   author them. Word candidates come from the classes this corpus actually makes
   hard and which are already named in the repo: forms containing æ/ø/å, the
   1800s orthography T-11 lists (`Ansigt`, `Katheder`, `Fjerpen`), and
   punctuation-dense clauses. Quote and phrase candidates come from sentence and
   verse-line boundaries. The script writes a candidate file for a human to cut
   down; it never writes `drills.v1.json` itself.
3. **`validate:content` gains rules for the bank**, and they must fail on:
   - an item whose text does not occur verbatim in the edition it sits beside
     (this is the rule that matters — it is what keeps the bank from drifting
     into being an unversioned second corpus);
   - a bank whose `editionContentHash` does not match the edition next to it;
   - a duplicate item id, or an item shorter than a floor worth typing.
4. **A first bank for `ibsen-brand` only**, hand-cut, large enough to be real
   (target 40–60 items across the three kinds) and small enough to review.

verify: `pnpm validate:content && pnpm check:fast`

The gate must be shown to bite: `pnpm validate:content` has to fail when an item
is edited to a phrase that is not in the edition, and when the edition's hash
moves without the bank being rebuilt. Prove both by doing them in a temp copy,
the way Q-001 requires.

notes:
- **Rights are the reason this is derived, not sourced.** Every item comes out of
  an edition already in the repo — public-domain Ibsen, Hamsun, Kielland — so the
  bank inherits exactly the rights the edition has and introduces no new
  question. Quotes from anywhere else would be a different problem with a
  different answer. Do not widen the source.
- **Prior art: T-11**, which decided this pattern for glosses and gave the
  reasoning ("kandidatordene utledes fra korpuset, glosene skrives for hånd, og
  resultatet serveres som en statisk asset ved siden av utgaven"). Follow
  `scripts/build-content-assets.ts` for how an edition asset is built and hashed.
- **Not personalised, and the entry must not pretend otherwise.** "Words you
  need to practise" in the personal sense needs per-character error data, which
  nothing stores — see T-02, which records that blocker. This bank targets what
  is hard *in this corpus*, which is a different and honest claim. When T-02
  lands, a reader's own errors become a third selection source, which is exactly
  the one-mode-two-sources shape T-12 already settled.
- Editorial cutting of the banks for the other three works is human work, not
  runner work. Allocate it a `T-` number at the time and **check the highest
  allocated number on main first** — two lanes have already collided on this.

## Q-004 · Start å skrive uten å velge bok
status: done — merged as `185c795` (#24)
result: `drill`-modus registrert som de tre andre, med `hasChooser: false` — ingen `/velg/drill`, fordi det å slippe å velge ER modusen. Banken emitteres nå som en egen hashet asset ved siden av utgaven, hentes og verifiseres av `drill-loader.ts`, og `check:bundle` har lært at en bank også er korpustekst. Landingssidens FALLBACK er byttet ut; «Fortsett» er urørt.
lane: brand-ui

acceptance:
The landing page gains a primary action that starts typing immediately, with no
work, edition, segment or filter chosen first, drawing from Q-003's bank.

1. **It takes the primary slot that already exists, and only when it is free.**
   `HomeView` already renders one primary action: `Fortsett` when there is a
   stored last session, and otherwise a link to `/velg/passage` — which is still
   a chooser, and is exactly the first-time reader this entry is for. Replace
   *that fallback*, not `Fortsett`. A returning reader must still land on
   continue; changing that is a regression, not this feature.
2. **A `drill` game mode**, registered in `src/domain/modes/registry.ts` like the
   other three, building a `SessionPlan` from bank items with an `all-segments`
   end rule. It is a mode adapter, not a fork: the engine does not learn about
   banks, and `src/domain/engine/` is not touched.
3. **One edition per session.** `SessionPlan` carries a single `workId`,
   `editionId` and `editionContentHash`, so a drill mixes items from one edition,
   not across works. Changing that is a plan-shape change and is out of scope
   here — pick the edition, then the items.
4. **A finished drill is storable and appears in history**, marked as not
   comparable to a passage result, the way a filtered session already is. WPM
   over ten short items is not the same measurement as WPM over a passage, and
   the history must not quietly imply it is.
5. **Repeat without repetition**: two consecutive starts do not serve the same
   items in the same order. Deterministic under a seed, so the e2e can assert it.

verify: `pnpm check:all`

The gate is a new `e2e/drill-start.spec.ts`, shown to fail on unmodified `src/`.
The assertion that bites is (4) and (5), not "a button exists": assert that a
finished drill is stored and marked non-comparable, and that two seeded starts
differ.

notes:
- Unblocked 2026-09-07: Q-003 merged as `919fb4b`, so
  `content/ibsen-brand/drills.v1.json` (59 items) exists to read. It is not
  emitted under `public/` yet — Q-003 left that here deliberately, so this entry
  owns both the emission and the catalog field, and `validate:content`'s
  orphan-asset check is what makes the two land together.
- Read `src/domain/modes/passage.ts` and `timed.ts` first — `timed.ts` already
  takes a `seed` in `PlanSelection` for deterministic ordering under test, which
  is the mechanism (5) needs. Do not invent a second one.
- **Non-goal: personalisation.** See Q-003's note and T-02. A drill that claims
  to know what *you* need is a different feature and is blocked on data that is
  not stored.

---

## Q-005 · T-09: kutt v3-utgavene lesningen ber om
status: blocked:redaksjonell lesning — `content/*/review.json` finnes ikke ennå
lane: brand-content

acceptance:
Hver pakke som lesningen sier skal kuttes får en `rules.v3.json` på
`brand-riksmaal.base.v2` og en `training-edition.v3.json` bygget gjennom den
vanlige kjeden, pluss en ny port som holder resultatet ærlig.

**Målt 2026-09-07, mot `base.v2`, på de fire utgavene leseren faktisk skriver:**

| utgave | treff | formene |
| --- | --- | --- |
| `ibsen-brand.training.v1` | 3 | `fjellvidderne`, `Gad`, `gad` |
| `hamsun-markens-groede.training.v2` | 3 | `bygderne`, `netterne`, `gjeiterne` |
| `kielland-gift.training.v2` | 14 | `sad`, `ferierne`, `spidserne`, `penneposerne`, `adjunkterne`, `gad`, `bag` |
| `kielland-noveletter.training.v2` | 2 | `lod`, `sad` |

Tjueto forekomster til sammen. Det er hele avstanden mellom det
`LANGUAGE_PROFILE.md` lover og det leseren skriver i dag, og den er nå et tall
og ikke en anelse.

1. **En ny port, `scripts/check-conformance.ts` (`pnpm check:conformance`, i
   `check:fast`),** som kjører profilens gjeldende grunnregelsett over hver
   pakkes NYESTE treningsutgave og feiler på ethvert treff. Den feiler på main i
   dag — det er poenget: den blir grønn når kuttet er gjort, og rød igjen første
   gang et grunnregelsett vokser uten at utgavene følger etter.
2. **`rules.vN.json` per pakke som skal kuttes** — neste ledige nummer, ikke nødvendigvis v3: `kielland-noveletter` er allerede på v3 etter Q-006, så den pakken kuttes til v4. De tre andre står fortsatt på v1/v2, med `baseRules:
   "brand-riksmaal.base.v2"` og bare pakkespesifikke tillegg. Ikke rør v1/v2:
   de er oppskriften bak utgaver som allerede er skrevet mot.
3. **`training-edition.v3.json` bygget med `build-training-edition`**, aldri
   håndredigert — `validate:content` bygger den på nytt og sammenligner byte for
   byte.
4. **`-ede`-klassen røres ikke mekanisk.** D12 målte den og forkastet den:
   endelsen varierer med verbet, og de tretti avgjørelsene hører til lesningen.
   Det som kommer fra lesningen som ord-for-ord-valg legges i pakkens egen
   regelfil, ikke i grunnsettet.
5. **Kortformbanken følger med.** `content/ibsen-brand/drills.v1.json` navngir
   `ibsen-brand.training.v1`s contentHash, så et Ibsen-v3 gjør banken ugyldig
   med vilje. Hvert av de 59 elementene må kontrolleres mot den nye teksten og
   banken kuttes på nytt som `drills.v2.json` — `validate:content` feiler til
   det er gjort, og det er den porten som gjør at de to ikke kan skille lag.

verify: `pnpm check:conformance && pnpm check:all`

Porten må vises at den biter, slik Q-001 og Q-003 krevde: en muteringstest som
setter en normalisert form tilbake til den danske i en midlertidig kopi av
treet, og ser `check:conformance` gå rød. En port som ikke kan vises å feile er
ingen port.

notes:
- **Blokkeringen er ekte og kan ikke omgås.** Hvilke pakker som skal kuttes, og
  hva som skal skje med `Gad`/`gad` i Ibsen og `sagde`-klassen, er redaksjonelle
  avgjørelser. Lesepakkene ligger i `~/dev/brand-review-packets/`; når en
  lesning er ført inn i `content/<pakke>/review.json`, flipp denne til `ready`
  og skriv inn hvilke pakker den gjelder.
- **Fremgang overlever nå et utgavebump** (T-10, `2687cef`). Det var den ene
  grunnen til å utsette et v3-kutt, og den er borte.
- **Utgavene er allerede fikspunkter av sine egne regelsett** — null treff for
  alle sju, målt 2026-09-07. Det er en annen invariant enn den over, og den bør
  fortsette å holde: hvis `check:conformance` skrives generelt nok til å dekke
  begge, si det i doc-kommentaren hvorfor de er to påstander og ikke én.
- Kjeden står i `README.md`: `rules.vN.json` → `build-training-edition` →
  `pnpm build:content` → `pnpm validate:content`. Ingen kodeendring kreves for
  selve kuttet; porten er det eneste nye.
- `REVIEW_GATE` i `scripts/validate-content.ts:78` står på `"warn"`. Når en
  utgave er lest OG kuttet, er det den linjen som gjør ulest tekst til en hard
  feil — vurder den i samme runde, men ikke flipp den før alle fire pakkene er
  lest.

---

## Q-006 · D10: hele «Noveletter» inn i korpuset
status: done — `3ed5080` (#34, kilder + versjonerte originaler) og `a99fef1` (#35, hele samlingen: original.v2 + training-edition.v3, 264 segmenter, 25 664 ord)
lane: brand-content

acceptance:
Alle fem novellene i *Noveletter* (1879) står i `kielland-noveletter`, importert
gjennom den samme porten alt annet går gjennom. Pakken har i dag to av dem.

| novelle | ord | status |
| --- | --- | --- |
| «Haabet er lysegrønt» | ~450 (åpningen) | importert |
| «Visne Blade» | ~400 (åpningen) | importert |
| **«Balstemning»** | ~2 100 | denne posten |
| **«Erotik og Idyl»** | ~4 700 | denne posten |
| **«En Middag»** | ~2 100 | denne posten |
| **«To Venner»** | ~6 700 | denne posten |
| **«Slaget ved Waterloo»** | ~8 300 | denne posten |

1. **Hver kilde arkiveres verbatim** under `content/kielland-noveletter/source/`,
   hentet med `scripts/import/wikikilden.ts`. Søk på **«Balstemning» med én L** —
   1907-utgavens stavemåte. Den moderne «Ballstemning» gir null treff, og det var
   hele grunnen til at teksten sto oppført som utilgjengelig i et halvt år.
2. **De to allerede importerte novellene utvides til hele teksten**, ikke bare
   åpningen, slik at pakken er hele samlingen og ikke en blanding av utdrag og
   hele noveller. Er det for mye for én post, skal det stå her som en egen post —
   ikke gjøres halvveis.
3. **`segments.json` utvides per novelle**, med id-prefiks og etiketter som
   følger mønsteret som allerede finnes: `haabet-01` / «Haabet er lysegrønt, 1».
   Prefikset er det Q-007 grupperer på, så det er ikke kosmetikk.
4. **`original.json` og treningsutgaven bygges på nytt** med `build-original` og
   `build-training-edition`, aldri for hånd. `validate:content` kontrollerer
   proveniens linje for linje mot den arkiverte kildefilen.
5. **`docs/CORPUS_STATUS.md` oppdateres** med ordtall, segmenter og
   rettighetsgrunnlag per novelle — uendret fra resten av pakken (Kielland
   d. 1906; Wikikildens transkripsjon CC BY-SA 4.0).
6. **Kontrollstatus røres ikke.** Teksten er `agent-drafted` som resten.
7. **Én commit per novelle** på greinen. Diffen er stor og generert; det som gjør
   den lesbar er at hver kilde, hvert segmentsett og hver gjenoppbygging kan
   leses for seg.

verify: `pnpm validate:content && pnpm check:all`

Porten er `validate:content`s proveniensjekk, og den må vises at den biter: endre
ett ord i `original.json` uten å endre kilden, i en midlertidig kopi, og se den
gå rød. Det er den kontrollen som skiller «importert» fra «skrevet av».

notes:
- **Dette er hele D10 slik CEO-planen skrev den** (operatørens avgjørelse
  2026-09-08, etter at posten først var snevret inn til Balstemning alene).
  Konsekvensen skal være uttalt og ikke oppdages senere: pakken går fra 853 ord
  og 13 segmenter til rundt **26 800 ord og ~400 segmenter**, og
  `kielland-noveletter` blir dermed den desidert største lesegjelden av de fire —
  én størrelsesorden over de andre. Redaktørlesningen av denne pakken bør
  planlegges som novelle-for-novelle, ikke som én økt.
- **Q-007 er ikke en anbefaling, den er en forutsetning.** Ved ~66 ord per
  segment gir importen omtrent 400 segmenter i én flat liste, i to velgere som
  begge lister hvert segment. Q-002 skrev eksplisitt at hierarkiet skulle vente
  til et verk hadde mer enn én del på main — det er nøyaktig det denne posten
  gjør sant.
- **Rekkefølge mot Q-005:** hvis Q-005 kutter `kielland-noveletter` til v3, gjør
  det FØRST. Å importere ny tekst inn i en pakke som samtidig får nytt regelsett
  betyr to årsaker til at én utgave endret seg, og da er byte-sammenligningen
  ikke lenger et bevis på noe.
- Kilder: `https://no.wikisource.org/wiki/Balstemning` og de fire andre i samme
  bind, alle transkludert fra `Kielland - Samlede Værker 1.djvu` og korrekturlest
  på Wikikilden. Kryssjekk mot bindets `Indeks:`-side før noe erklæres
  utilgjengelig — et negativt søkeresultat gjelder søkestrengen, ikke verket.
- **T-01 (hele kapitler av alle fire verk) er ikke løst av dette.** Denne posten
  gjør ett verk komplett; de tre andre står fortsatt på åpningsutdrag.

---

## Q-007 · Grupper segmentlisten etter del
status: done — merged as `6ac1f40` (#31)
result: `part` er et felt i `segments.json`, båret gjennom byggekjeden og validert: `validate:content` krever at delene er sammenhengende og at enten alle eller ingen segmenter har en. `contentHash` dekker id/order/tekst, så å navngi delene av et verk lager ingen ny utgave — hverken lesningen, kortformbanken eller lagrede økter merker det. `kielland-noveletter` viser to navngitte grupper med skrevet-telling per gruppe; `ibsen-brand` er uendret, flat og uten overskrift.
lane: brand-ui

acceptance:
Segmentlisten grupperes etter delen segmentet hører til — novelle, akt eller
kapittel — i begge velgerne som lister segmenter, og et verk med bare én del ser
ut nøyaktig som i dag.

1. **Gruppene kommer fra data, ikke fra en strengsplitt på etiketten.**
   *Underspesifisert, avgjør før du begynner:* enten et `part`-felt i
   `segments.json` (håndskrevet, altså ærlig proveniens) eller id-prefikset
   (`haabet-`, `visne-`), som allerede finnes og allerede er meningsbærende. Å
   splitte etiketten «Haabet er lysegrønt, 1» på komma er en gjetning om
   tegnsetting i en tittel, og det er ikke et datamodellvalg.
2. **`ibsen-brand` ser ut som før.** Ett verk med én akt får ingen ekstra
   overskrift og ingen ekstra klikk: gruppering av én gruppe er struktur over
   ingenting, og Q-002 avviste den med rette da det var tilfellet for alle fire.
3. **`kielland-noveletter` viser to grupper i dag** («Haabet er lysegrønt» og
   «Visne Blade»), som er nok til å bygge og bevise dette før Q-006 gjør det til
   fem.
4. **Skrevne segmenter er fortsatt merket**, og merket er fortsatt et ord og
   ikke en farge. Gruppen bør også kunne si hvor mye av seg selv som er skrevet.
5. **Fortsatt ingen sidelengs rulling på 375px**, og fortsatt tastaturnåbart med
   navn på hver lenke — samme to krav Q-002 satte.
6. **Skrevet for 400, ikke for 26.** Det er tallet Q-006 gir, og det er hele
   grunnen til at denne posten finnes.

verify: `pnpm check:all`

Gaten utvides i `e2e/nonstop-navigation.spec.ts` (eller en søsterfil), og må
vises å feile på uendret `src/`: den påstanden som biter er at
`kielland-noveletter` viser to navngitte grupper med riktige segmenter under
hver, mens `ibsen-brand` viser nøyaktig én flat liste uten gruppeoverskrift.

notes:
- **Prior art er i filen selv.** `SegmentIndex` i `src/components/ChooseView.tsx`
  er allerede felles for Passage og Nonstop etter Q-002 — dette er én komponent
  å endre, ikke to.
- Q-002s ikke-mål sa at hierarkiet skulle revurderes «når et verk har mer enn én
  akt på main, ikke før». `kielland-noveletter` har hatt to noveller siden 4.
  september; det er den betingelsen, og Q-006 gjør den umulig å ignorere.
- **Ikke en innholdsfortegnelse med sammenklapping som standard.** Teksten skal
  dominere, og en leser som kommer for å hoppe skal se hvor hun er — ikke en
  liste av lukkede skuffer. Om noe skal kunne lukkes, avgjør det som et eget
  spørsmål med 400 elementer foran deg.

---

## Q-008 · Si fra når en lagret økt navngir en tekst som har endret seg
status: done — merged as `42891d8` (#37)
result: `editionDrift()` i `src/domain/content/edition-drift.ts` gir `match`/`moved`/`gone`/`unknown` av lagret økt + katalogutgave. Resultatsiden sier det i T-13s varselbeholder, historikken merker raden med et ord i linjen som allerede finnes. `unknown` merkes ikke: en økt fra schema 1–2 kan ikke si hva den ble skrevet mot.
lane: brand-ui

acceptance:
Historikken og resultatsiden sier fra når en økts `editionContentHash` ikke er
den katalogen har for den utgaven — i stedet for å merke økten stille med en
utgave hvis tekst er en annen enn den som ble skrevet.

1. **Sammenligningen finnes ett sted**, som en ren funksjon over lagret økt +
   katalog: `unknown` (økter fra schema 1–2, som er en ærlig ikke-verdi og ikke
   et avvik), `match`, `moved` (samme id, annen hash) og `gone` (id finnes ikke
   i katalogen lenger).
2. **Resultatsiden sier det i varselbeholderen som allerede finnes** (T-13), med
   samme tone som de andre varslene: hva som er sant, ikke hva som gikk galt.
   Tallene står — de ble målt — men de er ikke sammenlignbare med en økt mot
   dagens tekst.
3. **Historikken merker raden**, med et ord og ikke en farge, slik «pauset»
   allerede gjør.
4. **`unknown` merkes ikke som avvik.** En økt fra før utgavehashene fantes vet
   ikke hvilken tekst den ble skrevet mot, og å påstå at den har endret seg ville
   vært like galt som å påstå at den ikke har det.

verify: `pnpm check:all`

Gaten er en ny `e2e/edition-drift.spec.ts` som skriver en økt rett inn i
IndexedDB med en hash som ikke finnes i katalogen — samme grep som
`e2e/progress-edition-bump.spec.ts` bruker — og krever at både historikken og
resultatsiden sier fra. Den må vises å feile på uendret `src/`.

notes:
- **Hvorfor dette finnes:** D7 lagrer `editionVersion` og `editionContentHash`
  på hver økt nettopp for at en senere endring ikke skal kunne forfalske et
  gammelt resultat — men ingenting leser dem tilbake. Uforanderligheten ble
  holdt av disiplin alene, og disiplinen ble oppdaget som utilstrekkelig da
  Q-006 skulle legge tekst til et verk (se D15). Versjonerte originaler gjør at
  det ikke SKAL skje; denne posten gjør at det SYNES hvis det skjer likevel.
- Feltene finnes allerede på `SessionResult`; ingen skjemaendring, ingen
  migrasjon.
- Prior art for varselet: `ResultView`s beholder fra T-13 og tekstform-varselet
  ved siden av det. Prior art for merket i historikken: «pauset».
- **Ikke-mål:** å reparere eller skjule slike økter. De er ekte målinger av en
  ekte tekst; det eneste som mangler er at siden sier hvilken.

---

## Q-009 · Hyller som egen akse
status: done — merged as `3d3f2f0` (#41)
result: content/shelves.json + SHELVES i catalog.generated.ts; listShelves()/getShelf()/listShelvesForWork() i registry.ts. Tre porter vist å feile: en hylle som navngir et verk katalogen ikke har, et verk uten hylle, og et manglende shelves.json. «Noveletter» står på to hyller, så mange-til-mange er et faktisk tilfelle og ikke bare en fixture. Ingen contentHash beveget seg.
lane: brand-content

acceptance:
Katalogen får fire kuraterte hyller — **Norske klassikere**, **Danske
klassikere**, **Idé og tro**, **Korte tekster** — som et verk kan stå på flere
av uten at innholdsposten dupliseres.

1. **Hyllen er sin egen liste, ikke et felt på verket.** En ny
   `content/shelves.json` med `{ id, title, description, workIds[] }` per hylle,
   i kuratert rekkefølge. `pnpm build:content` emitterer den til
   `catalog.generated.ts` ved siden av `CONTENT_PACKS` og `WORKS`, og
   `registry.ts` får `listShelves()` / `getShelf(id)` / `listShelvesForWork(id)`.
2. **Mange-til-mange, uten duplikat.** Samme `workId` kan stå på to hyller. Det
   skal finnes én innholdspost per verk uansett hvor mange hyller den står på —
   verifiser at `WORKS` ikke vokser når et verk legges til på hylle nummer to.
3. **De fire verkene som finnes i dag plasseres**, alle på Norske klassikere.
   Hyllene for dansk og for idé står tomme til første import; en tom hylle skal
   ikke krasje noen liste, men den skal heller ikke vises som et tomt kort.
4. **Ingen utgave røres.** Ingen `contentHash` beveger seg, ingen lagret økt og
   ingen fremdriftspost påvirkes. Dette er ren katalogstruktur.

verify: `pnpm check:fast`

Porten er to nye tilfeller i `scripts/validate-content.ts`, hver vist å feile på
et konstruert dårlig input: (a) en hylle som navngir en `workId` som ikke finnes
i katalogen, (b) et verk som ikke står på noen hylle. Pluss en enhetstest på
`listShelvesForWork()` med et verk på to hyller.

notes:
- **Hvorfor ikke `tags`:** feltet finnes allerede, men er frie strenger uten
  kuratert rekkefølge og uten visningsnavn. En hylle er et redaksjonelt utvalg
  med tittel og orden; en tag er en egenskap ved verket.
- **Hvorfor ikke `ContentPack`:** en pakke eier verkene sine (`workIds`), og
  Georg Brandes står på to hyller allerede ved katalogens start (Idé og tro ·
  Korte tekster). Eierskap og kuratering er to forskjellige ting.
- Prior art for å emittere en ny toppnivåliste fra `content/` til
  `catalog.generated.ts`: Q-004s `drills`-felt, som la et søskenaktivum til uten
  å røre utgaven det hører til.
- **Ikke-mål:** navigasjon og søk. Denne posten er datastrukturen og porten;
  hylleflaten i grensesnittet er en egen post.
- Se D17 og T-17.

## Q-010 · Verksmetadata rettighetsvurderingen hviler på
status: review:queue/q-010-rettighetsmetadata
lane: brand-content

acceptance:
Fire felter som i dag bare finnes som prosa inne i `license` blir verdier
maskinen kan lese.

1. **`authorDeathYear: number`** på `SourceAttribution`. Tallet
   førstesorteringen i `docs/spec/CORPUS.md` leser («forfatteren døde i 1955
   eller tidligere»). Fylles for alle fire pakker: Ibsen 1906, Kielland 1906,
   Hamsun 1952.
2. **`originalLanguage`** på `Work`, skilt fra `SourceAttribution.language`
   (som beskriver transkripsjonen). Union: `"da-NO" | "da-DK" | "nb-NO" |
   "nn-NO"`. Alle fire nåværende verk er `da-NO`.
3. **`adaptationStatus`** på `TextEditionMeta`, som noe annet enn
   `verificationStatus` (er transkripsjonen tro mot kilden?) og `reviewStatus`
   (er normaliseringen forsvarlig?). Denne sier hvor langt selve tilpasningen er
   kommet: `"none" | "orthography" | "orthography-and-morphology" |
   "converted"`. De fire nåværende treningsutgavene er `"orthography"`;
   `"converted"` er reservert for *Bondestudentar* (T-20).
4. **`rightsStatus`** som verdi ved siden av `license`, ikke i stedet for den:
   `"public-domain" | "public-domain-verified" | "restricted" | "unknown"`.
   `license` beholder den fulle presise setningen — den er det leseren ser på
   `/om`, og den skal ikke forkortes til en enum.
5. **Attribusjonslinjen der teksten skrives:** «Språklig bearbeidet etter
   Brand-standarden. Basert på [utgave og år].» I dag finnes attribusjonen bare
   på `/om`; den hører hjemme der leseren faktisk møter den bearbeidede teksten.

verify: `pnpm check:fast`

Porten er nye tilfeller i `scripts/validate-content.ts`, hver vist å feile: (a)
et verk uten `authorDeathYear`, (b) `authorDeathYear` senere enn 1955 uten et
felt som begrunner det, (c) et verk uten `originalLanguage`, (d) en
treningsutgave uten `adaptationStatus`. Pluss en rendertest på at
attribusjonslinjen står på skriveflaten og navngir utgave og år.

notes:
- **Hvorfor dette er første post og ikke en opprydding:** med 25 verk i planen er
  dødsåret den ene opplysningen som avgjør hva som i det hele tatt kan
  importeres, og i dag kan ingen maskin lese det. Alle 25 forfatterne døde i
  1952 eller tidligere, så førstesorteringen slipper alle gjennom — det er
  nettopp derfor den ikke er nok alene, og derfor `rightsStatus` skiller
  `public-domain` (utledet av dødsåret) fra `public-domain-verified` (noen har
  sett på den konkrete kilden).
- **Skjemaendringen treffer ikke lagrede økter.** Feltene ligger på katalogen, og
  `contentHash` dekker bare id/order/text — se D17 og forrige gang notater ble
  endret på publiserte utgaver (`720cd3f`).
- Se D17 og T-18.

## Q-011 · T-19: moduler med egen fremdrift
status: ready
lane: brand-ui

acceptance:
Et verk kan deles i moduler som har egen identitet og **egen fremdrift**, mens
grensesnittet fortsatt viser at modulen hører til verket.

1. **Modulen er en post, ikke en streng.** `segments.json` kan erklære
   `modules: [{ id, title, order }]`, og et segment peker på `moduleId` i stedet
   for dagens frie `part`-streng. `part` beholdes som visningsnavn der en pakke
   allerede har det — Q-007s gruppering skal fortsette å virke uendret på de
   fire nåværende pakkene, og *Noveletter*s sju deler er prøven på det.
2. **Fremdrift per modul.** `ReadingProgress`-nøkkelen får modulen som et
   valgfritt ledd. Et verk uten moduler beholder nøyaktig dagens nøkkel og
   dagens oppførsel — ingen migrasjon for de fire pakkene som finnes.
3. **D14 og T-10 står.** Nøkkelen skal fortsatt ikke inneholde `editionId`:
   fremgang hører til verket (og nå til modulen i verket), aldri til én utgave
   av det. `migrateProgress` regner fortsatt nøkkelen ut av postens egne felter,
   og kolliderende poster slås sammen med nyeste vinner og fullførte segmenter
   unionert.
4. **Fullføring per modul.** En modul kan være ferdigskrevet mens verket ikke
   er. Velgeren merker den skrevne modulen med det samme ORDET Q-002 innførte
   («Skrevet»), ikke med en farge.
5. **Vanskelighet per modul.** Modulen kan bære sin egen vanskelighet, utledet
   av segmentene sine når den ikke er satt.

verify: `pnpm check:all`

Porten er tosidig og begge sidene må vises å bite:
- **En ny e2e** som skriver fremdrift på én modul rett inn i IndexedDB — samme
  grep som `e2e/progress-edition-bump.spec.ts` og `e2e/edition-drift.spec.ts` —
  og krever at bare den modulen er merket skrevet, ikke verket og ikke
  søskenmodulene.
- **En regresjonsport på nøkkelen:** en lagret post fra før modulene fantes skal
  gi nøyaktig samme nøkkel etter migrasjonen som før. Den testen skal FEILE hvis
  modulleddet skrives inn ubetinget.

**NB — en e2e som navigerer rett etter at et segment er fullført må vente på at
posten faktisk står i IndexedDB.** Det var T-15s flake, og den formen er
nøyaktig denne postens form.

notes:
- **Hvorfor dette må inn før importen, ikke etter:** *Enten–Eller* deles i
  Diapsalmata, Det umiddelbart erotiske, Forførerens Dagbog og utvalgte partier
  fra «Eller», og Diapsalmata skal kunne være ferdig mens resten ikke er. En
  modell som utvides etter at tekst er importert, endrer tekst som allerede er
  skrevet mot — samme grunn som i D15.
- **Hvorfor `part` ikke holder:** Q-007 (`6ac1f40`, #31) grupperer segmentlisten
  etter en fri streng på segmentet. Strengen har ingen id, ingen rekkefølge
  utover segmentrekkefølgen, og — det avgjørende — ingen fremdriftsnøkkel.
- **Denne posten var bevisst holdt utenfor køen** fordi den rører
  fremdriftsnøkkelen; køført 2026-09-08 på operatørens beslutning. Den er derfor
  strengere gated enn de to foran: migrasjonen skal ikke bare passere, den skal
  vises å ikke røre en post uten moduler.
- **Ikke-mål:** å innføre moduler i noen eksisterende pakke. De fire som finnes
  skal komme uendret ut på den andre siden; det er halve porten.
- Se D17 og T-19.

---

**Ikke køført, med vilje.** T-20 (regelsett for dansk og landsmål) og T-21
(verseformatering) står i `TODOS.md` og er bevisst holdt utenfor køen: T-20
avhenger av den redaksjonelle lesningen på samme måte som Q-005, og T-21 skal
ikke gjøres før prosakjeden står. **Ingen av de 25 verkene importeres før Q-009,
Q-010 og Q-011 er landet** — deretter *Sult*, *Gift*, *Et dukkehjem*, i den
rekkefølgen.

## Q-012 · En publisert treningsutgave kan ikke bytte original i det stille
status: ready
lane: brand-content

acceptance:
`scripts/import/build-training-edition.ts` skal nekte å skrive en
`training-edition.vN.json` som allerede finnes, dersom den nye `basedOnEditionId`
er en annen enn den committede filens — med mindre man ber om det uttrykkelig.

1. **Ny utgave: uendret.** Finnes ikke utfilen, er dagens oppførsel riktig og
   skal stå — nyeste original er det en ny cut vil ha.
2. **Eksisterende utgave: `basedOnEditionId` er låst.** Les den committede filen
   først. Er `basedOnEditionId` en annen enn den `--original` (eller defaulten)
   ville gi, avbryt med exit 1 og en melding som navngir begge, og som sier at
   `--original <N>` reproduserer den gamle utgaven.
3. **Én uttrykkelig vei ut**, for det tilfellet der ombasering faktisk er
   ønsket: et flagg (`--rebase-original`) som må stå sammen med `--original`.
   Aldri som default, aldri utledet.
4. **Meldingen skal si hva som ville skjedd**, ikke bare at noe er galt: antall
   segmenter som ville endret seg, og at `contentHash` ville flyttet seg.

verify: `pnpm check:originals && pnpm check:fast`

Porten er et nytt tilfelle i `scripts/check-originals_test.ts`, vist å feile før
fiksen og passere etter: bygg `training-edition.v1.json` på nytt i en temp-kopi
av en pakke som har to originaler, uten `--original`, og krev exit != 0 og at
filen på disk er uendret. Filen dekker allerede «originalens tekst redigert i
stedet for etterfulgt»; dette er søskentilfellet den mangler.

notes:
- **Dette skjedde 2026-09-09, under Q-010.** `--version 1` uten `--original` på
  `kielland-noveletter` bygde v1 fra `original.v2` i stedet for
  `kielland-noveletter.original`: 4 298 endrede linjer, ny `contentHash`, ny
  `basedOnEditionId`. Reversert samme økt.
- **`validate:content` fanger det ikke, og kan ikke.** Den bygger fra den
  `basedOnEditionId` filen *nå* påstår, så den omskrevne filen validerer rent.
  Det er ikke en feil i validatoren — den sjekker reproduserbarhet, og den
  omskrevne filen ER reproduserbar. Den påstanden som endret seg, er hvilken
  original utgaven hviler på, og ingen har den fra før.
- **`review.json` ville fanget det for en lest utgave** (`reviewedContentHash`
  går stalt), men ingen pakke har `review.json` ennå — det er Q-005, som er
  blokkert. Så i praksis er det ingenting.
- **Flagget finnes allerede.** `--original <N>` er implementert, og kommentaren
  i skriptet advarer alt mot driften. Det som mangler er at noe håndhever den:
  en advarsel i en kommentar er ikke en port. Dette er samme form som D8 og
  D15 — en regel repoet allerede har skrevet ned, men ikke har satt en maskin
  til å passe på.
- Oppdaget bare ved å lese `git diff --stat` etter en rebuild. En endring på
  4 298 linjer som ser ut som en formatering er nøyaktig den formen et
  menneske scroller forbi.

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

---

## Q-001 · `check:design` — gate DESIGN.md's falsifiable claims
status: ready
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
status: ready
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
status: ready
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
status: blocked:Q-003 — there is no bank to draw from until it lands
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
- Flip `status:` to `ready` once Q-003 has landed on main and a bank exists to
  read. Until then the runner would build a mode with nothing to serve.
- Read `src/domain/modes/passage.ts` and `timed.ts` first — `timed.ts` already
  takes a `seed` in `PlanSelection` for deterministic ordering under test, which
  is the mechanism (5) needs. Do not invent a second one.
- **Non-goal: personalisation.** See Q-003's note and T-02. A drill that claims
  to know what *you* need is a different feature and is blocked on data that is
  not stored.

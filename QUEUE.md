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
status: blocked:PR #11 must land first — DESIGN.md does not exist on main until it does
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
- Flip `status:` to `ready` once PR #11 is merged. Until then the runner has no
  DESIGN.md on main to gate and would produce a branch that cannot pass.
- **Lane note.** This entry was written while the språkrens lane (D10–D12) was
  running unpushed on local main and a third lane held the shared checkout on
  `fix/mobile-backspace`. Nothing here touches `src/domain/language/` or
  `scripts/`, so it does not collide with that work — but check the highest
  allocated `T-` number in TODOS.md on main before adding new ones. This queue
  file exists partly because those two lanes silently allocated the same three
  T-numbers on 2026-09-06.

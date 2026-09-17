/**
 * What the reader should actually practise, ranked (Q-014/T-02).
 *
 * Q-013 stores two lists on a finished session: `misses` (which target
 * character came out as what, and how often) and `opportunities` (how often
 * each target character stood there at all). This module turns that pair into
 * an ordered answer, and the ordering is the whole point of the module.
 *
 * **Rank on rate, never on count.** `misses` alone is a frequency table of
 * Norwegian prose: `e`, `r`, `n` and the space are the most-typed characters,
 * so they collect the most misses no matter how well anyone types them. A list
 * sorted by count is therefore very nearly the same list for every reader, in
 * every session, whatever they got wrong — which is worse than showing
 * nothing, because it reads as a personal diagnosis and is not one. The number
 * that carries information is misses divided by opportunities.
 *
 * The floor below is the other half of that. A rate needs a denominator big
 * enough to mean something: one miss out of two occurrences is 50 %, and
 * 50 % of nothing. Characters under the floor are withheld rather than ranked,
 * because a confident wrong answer is the failure mode this module exists to
 * avoid.
 */
import type { CharacterCount, CharacterMiss } from "./metrics";

/**
 * Fewest opportunities a character needs before its rate is shown at all.
 *
 * One number, in one place, deliberately. Twenty is roughly a sentence's worth
 * of a common letter and several passages' worth of a rare one — high enough
 * that a single slip cannot mint a 50 % rate, low enough that a real weakness
 * in a short session still surfaces.
 */
export const MIN_OPPORTUNITIES = 20;

/** How many characters the views show. More than a handful is not advice. */
export const FOCUS_LIMIT = 5;

export type FocusItem = {
  /** The target character — what the reader was supposed to type. */
  expected: string;
  misses: number;
  opportunities: number;
  /** misses / opportunities, in 0..1. The number the list is ordered by. */
  rate: number;
  /** Whatever came out most often instead. Ties resolve to the first seen. */
  topTyped: string;
};

export type FocusClassId = "nordic" | "punctuation";

export type FocusClass = {
  id: FocusClassId;
  label: string;
  misses: number;
  opportunities: number;
  rate: number;
};

const NORDIC = new Set(["æ", "ø", "å", "Æ", "Ø", "Å"]);

/**
 * Punctuation the corpus actually uses. 1800s prose is dense with the dash and
 * the guillemet, and both are exactly the keys a modern Norwegian keyboard
 * makes awkward — which is why they are worth naming as a class rather than
 * leaving as single rows in the list.
 */
const PUNCTUATION = new Set([
  ".", ",", ";", ":", "!", "?", "—", "–", "-",
  "«", "»", '"', "'", "’", "(", ")",
]);

/**
 * Sum misses per TARGET character, discarding which wrong character came out.
 *
 * What a reader practises is the key they meant to hit; splitting a row per
 * wrong output would rank the same weakness three times, each with a third of
 * its weight. `topTyped` keeps the most common wrong output because it is the
 * part that tells you *how* it goes wrong.
 */
function byExpected(misses: readonly CharacterMiss[]) {
  const totals = new Map<string, { misses: number; typed: Map<string, number> }>();
  for (const m of misses) {
    const row = totals.get(m.expected) ?? { misses: 0, typed: new Map() };
    row.misses += m.count;
    row.typed.set(m.typed, (row.typed.get(m.typed) ?? 0) + m.count);
    totals.set(m.expected, row);
  }
  return totals;
}

function topOf(typed: Map<string, number>): string {
  let best = "";
  let bestCount = -1;
  for (const [ch, count] of typed) {
    if (count > bestCount) {
      best = ch;
      bestCount = count;
    }
  }
  return best;
}

/**
 * The characters worth practising, most-wrong first.
 *
 * Ordered by rate descending; ties broken by miss count, then by the character
 * itself so the list is stable rather than dependent on Map insertion order.
 * Characters with fewer than `MIN_OPPORTUNITIES` are omitted entirely — not
 * ranked last, omitted, because showing them at all invites reading a rate the
 * data does not support.
 */
export function rankPracticeFocus(
  misses: readonly CharacterMiss[],
  opportunities: readonly CharacterCount[],
  limit: number = FOCUS_LIMIT,
): FocusItem[] {
  const opportunityByChar = new Map(opportunities.map((o) => [o.char, o.count]));
  const items: FocusItem[] = [];

  for (const [expected, row] of byExpected(misses)) {
    const total = opportunityByChar.get(expected) ?? 0;
    if (total < MIN_OPPORTUNITIES) continue;
    items.push({
      expected,
      misses: row.misses,
      opportunities: total,
      rate: row.misses / total,
      topTyped: topOf(row.typed),
    });
  }

  items.sort(
    (a, b) =>
      b.rate - a.rate ||
      b.misses - a.misses ||
      a.expected.localeCompare(b.expected, "nb-NO"),
  );
  return items.slice(0, limit);
}

/**
 * The two classes T-02 named, summed over their members.
 *
 * A class is summed before the floor is applied, which is the point of having
 * classes at all: no single guillemet may clear MIN_OPPORTUNITIES in one
 * session, while the punctuation the passage is full of easily does. A class
 * with no opportunities at all is omitted — the text simply did not contain it.
 */
export function practiceClasses(
  misses: readonly CharacterMiss[],
  opportunities: readonly CharacterCount[],
): FocusClass[] {
  const totals = byExpected(misses);
  const defs: { id: FocusClassId; label: string; members: Set<string> }[] = [
    { id: "nordic", label: "Æ, ø og å", members: NORDIC },
    { id: "punctuation", label: "Tegnsetting", members: PUNCTUATION },
  ];

  const out: FocusClass[] = [];
  for (const def of defs) {
    let missCount = 0;
    let opportunityCount = 0;
    for (const [ch, row] of totals) {
      if (def.members.has(ch)) missCount += row.misses;
    }
    for (const o of opportunities) {
      if (def.members.has(o.char)) opportunityCount += o.count;
    }
    if (opportunityCount === 0) continue;
    out.push({
      id: def.id,
      label: def.label,
      misses: missCount,
      opportunities: opportunityCount,
      rate: missCount / opportunityCount,
    });
  }
  return out;
}

/**
 * How a character is named on screen.
 *
 * A space rendered as a space is an empty box the reader cannot identify, and
 * it is a genuinely common miss, so it gets a word instead of a glyph.
 */
export function focusCharacterLabel(ch: string): string {
  if (ch === " ") return "mellomrom";
  if (ch === "\n") return "linjeskift";
  if (ch === "\t") return "tabulator";
  return ch;
}

/**
 * Fold several sessions' measurements into one, for the history view.
 *
 * Sessions written before Q-013 carry no measurement and are SKIPPED, not
 * treated as clean — which is why `measured` comes back alongside the totals.
 * An aggregate over 3 of 40 sessions that presents itself as «your typing» is
 * the same lie as an empty list on an unmeasured session, one level up, so the
 * caller is given the count it needs to say which it is.
 */
export function aggregateMeasured(
  sessions: readonly {
    misses?: readonly CharacterMiss[];
    opportunities?: readonly CharacterCount[];
  }[],
): {
  misses: CharacterMiss[];
  opportunities: CharacterCount[];
  measured: number;
  total: number;
} {
  const missTotals = new Map<string, CharacterMiss>();
  const opportunityTotals = new Map<string, CharacterCount>();
  let measured = 0;

  for (const s of sessions) {
    if (!s.misses || !s.opportunities) continue;
    measured += 1;
    for (const m of s.misses) {
      const key = `${m.expected}\u0000${m.typed}`;
      const existing = missTotals.get(key);
      missTotals.set(
        key,
        existing ? { ...existing, count: existing.count + m.count } : { ...m },
      );
    }
    for (const o of s.opportunities) {
      const existing = opportunityTotals.get(o.char);
      opportunityTotals.set(
        o.char,
        existing ? { ...existing, count: existing.count + o.count } : { ...o },
      );
    }
  }

  return {
    misses: [...missTotals.values()],
    opportunities: [...opportunityTotals.values()],
    measured,
    total: sessions.length,
  };
}

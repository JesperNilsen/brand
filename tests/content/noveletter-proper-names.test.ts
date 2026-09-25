/**
 * The gate Q-016 exists to keep shut: `lowercaseNouns` must not eat proper
 * names or the polite second person.
 *
 * `lowercaseNouns` lowercases every capitalised word that is not
 * sentence-initial and not in `properNames`. When the pack was ONE story its
 * six-name list covered it. Q-006 grew it to seven stories and 264 segments
 * and left the list alone, so everything the six new stories brought fell
 * through: ~245 character-name occurrences lowercased, and 81 occurrences of
 * polite «De»/«Dem»/«Deres» turned into the third person — «Dem» (you) became
 * «dem» (them), which changes what the sentence MEANS, in the edition readers
 * were actually typing. It shipped and stayed live for a week.
 *
 * WHY THE FIXTURE IS WRITTEN OUT HERE, and not derived:
 * Q-012's lesson is that an invariant reading the field its own writer wrote
 * proves only that the file equals itself. A test that pulled its expectations
 * from `rules.v4.json` would pass for any name list, including six. So the
 * phrases below are stated as bytes, independently, and the rules are free to
 * disagree with them — that disagreement is the whole signal.
 *
 * It runs against the edition the READER IS SERVED, not against v4 by name, so
 * a future v5 that reintroduces the bug fails here too. A legitimate v5 that
 * changes any phrase below is meant to fail: re-read it and restate the bytes.
 *
 * SHOWN TO BITE, as the entry required: run against v3 — the edition live when
 * this was written — 13 of these 15 phrases are absent and the test goes red,
 * across all four of the classes below. The two that pass in both versions are
 * the over-correction guards, which is what they are for.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { defaultEdition, getWork } from "@/domain/content/registry";
import { defaultPreferences } from "@/infra/repository/migrations";
import type { TextEdition } from "@/domain/types";
import { loadFromDisk } from "./load-from-disk";

/**
 * Polite address. This is the half that changes meaning rather than spelling,
 * so a reader cannot see the damage — «De har vist ikke moret Dem iaften» is
 * still grammatical after the corruption, it just addresses someone else.
 * «I» is the archaic second person plural and the same mistake in a fourth
 * guise; it was found only when the names were re-derived.
 */
const POLITE: [string, string][] = [
  ["haabet-16", "moret Dem iaften"],
  ["haabet-17", "Synes De ikke"],
  ["erotik-07", "Med Deres gode examen"],
  ["balstemning-16", "gav Dem denne"],
  ["erotik-03", "at I ikke"],
];

/**
 * One name from each of the seven stories, because the defect was precisely
 * that six of them were never looked at. «visne» is included even though its
 * two names were in the original six: a story that was always correct is still
 * a story that must stay correct.
 */
const NAMES: [string, string][] = [
  ["haabet-13", "Schubert og Kierulf"],
  ["visne-03", "mr. Everton Sainsbury"],
  ["erotik-02", "frøken Ludvigsen"],
  ["balstemning-02", "udkant av Paris"],
  ["middag-11", "Adjunkt Hansen"],
  ["venner-01", "Alphonse førte"],
  ["waterloo-21", "onkel Fredrik"],
];

/**
 * The opposite failure, which a panicked fix would cause: sweeping every
 * capitalised word into `properNames`. Titles take a small letter in modern
 * riksmål, and lowercasing common nouns is the entire point of the rule — so
 * these must NOT be "corrected". They pass against v3 as well, deliberately:
 * they guard the direction v3 never went wrong in.
 */
const STAYS_LOWERCASE: [string, string][] = [
  ["haabet-01", "ropte fetter Hans"],
  ["erotik-01", "sagde fru Olsen"],
  ["waterloo-17", "snak med kapteinen"],
];

describe("kielland-noveletter: the edition the reader is served", () => {
  let edition: TextEdition;
  let byId: Map<string, string>;

  beforeAll(async () => {
    const work = getWork("kielland-noveletter")!;
    edition = await loadFromDisk(defaultEdition(work, defaultPreferences().languageProfileId));
    byId = new Map(edition.segments.map((s) => [s.id, s.text]));
  });

  const check = ([id, phrase]: [string, string]) => {
    const text = byId.get(id);
    expect(text, `segment ${id} is missing from ${edition.id}`).toBeDefined();
    expect(text, `${edition.id}/${id} should contain «${phrase}»`).toContain(phrase);
  };

  it.each(POLITE)("keeps the polite address in %s", (id, phrase) => check([id, phrase]));

  it.each(NAMES)("keeps the personal names in %s", (id, phrase) => check([id, phrase]));

  it.each(STAYS_LOWERCASE)("does not capitalise titles in %s", (id, phrase) =>
    check([id, phrase]),
  );

  it("covers every one of the seven stories", () => {
    const stories = new Set(
      [...POLITE, ...NAMES, ...STAYS_LOWERCASE].map(([id]) => id.replace(/-\d+$/, "")),
    );
    expect([...stories].sort()).toEqual([
      "balstemning",
      "erotik",
      "haabet",
      "middag",
      "venner",
      "visne",
      "waterloo",
    ]);
  });
});

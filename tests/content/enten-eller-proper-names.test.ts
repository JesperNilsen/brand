/**
 * The same gate as `sult-proper-names.test.ts`, for Diapsalmata. The 1878
 * text capitalises every noun, and `lowercaseNouns` lowercases every
 * capitalised word that is not sentence-initial and not in `properNames`.
 * Without the list, «I, som endnu ikke har dristet Eder til» (you, plural)
 * loses its address, «vor Herre» becomes a gentleman, and Kierkegaard's own
 * German and Greek get Norwegian noun-lowercasing they were never written in.
 *
 * The phrases are stated as BYTES, independently of `rules.v1.json` (Q-012:
 * a fixture read from the rules file passes for any list, including an empty
 * one). They run against the edition the READER IS SERVED, so a future v2
 * that loses a name fails here too. A legitimate v2 that changes one of these
 * phrases is meant to fail: re-read it and restate the bytes.
 *
 * Three things are Diapsalmata-specific and deliberately pinned:
 *  - The address is «Du»/«Dig» and plural «I»/«Eder»; the polite «De» never
 *    occurs mid-sentence here (every «De»/«Deres» is sentence-initial «they»).
 *  - «Herre» (vor Herre, the Lord) keeps its capital; «herrer» (mine herrer)
 *    does not. The list is exact-form, and so is this test.
 *  - Hyphenated compounds are closed up by replacement keys (Syvmiils-Støvler
 *    → syvmilsstøvler); a name inside one keeps its capital (Fenrisulven).
 *
 * SHOWN TO BITE: built with an empty `properNames`, the POLITE, NAMES and
 * VERBATIM phrases are absent and the test goes red; STAYS_LOWERCASE passes
 * either way, which is what an over-correction guard is for.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { defaultEdition, getWork } from "@/domain/content/registry";
import { defaultPreferences } from "@/infra/repository/migrations";
import type { TextEdition } from "@/domain/types";
import { loadFromDisk } from "./load-from-disk";

/** Plural address to the readers, then the «Du»/«Dig» of the ecstatic lecture. */
const POLITE: [string, string][] = [
  ["diap-04", "I, som endnu ikke har dristet Eder til"],
  ["diap-57", "Gift Dig, Du vil fortryde det"],
];

/** The Lord, God, a title, persons, a myth and a place. */
const NAMES: [string, string][] = [
  ["diap-19", "vor Herre mætter maven"],
  ["diap-23", "tænker, Gud vet, hva vor Herre"],
  ["diap-26", "Hans Velærværdighet Jesper Morten"],
  ["diap-12", "skrider Don Juan over scenen"],
  ["diap-47", "hvormed Fenrisulven blev bunden"],
  ["diap-50", "barnepigen Maren gjennom stuen"],
  ["diap-56", "Som haren fra Ny-Holland har jeg"],
];

/** Kierkegaard's own German and Greek, untouched by noun-lowercasing. */
const VERBATIM: [string, string][] = [
  ["diap-07", "das Lachen zuerst bei Kindern zeiget"],
  ["diap-17", "Tvivleren er en Μεμαστίγομενος"],
];

/** Common nouns and closed compounds that a panicked fix would sweep into the list. */
const STAYS_LOWERCASE: [string, string][] = [
  ["diap-57", "mine herrer, er indbegrebet"],
  ["diap-46", "blev fremstillet som gudinden"],
  ["diap-30", "sine syvmilsstøvler på"],
  ["diap-49", "en ny plet i menneskelivet"],
];

describe("kierkegaard-enten-eller: the edition the reader is served", () => {
  let edition: TextEdition;
  let byId: Map<string, string>;

  beforeAll(async () => {
    const work = getWork("kierkegaard-enten-eller")!;
    edition = await loadFromDisk(defaultEdition(work, defaultPreferences().languageProfileId));
    byId = new Map(edition.segments.map((s) => [s.id, s.text]));
  });

  const check = ([id, phrase]: [string, string]) => {
    const text = byId.get(id);
    expect(text, `segment ${id} is missing from ${edition.id}`).toBeDefined();
    expect(text, `${edition.id}/${id} should contain «${phrase}»`).toContain(phrase);
  };

  it.each(POLITE)("keeps the address in %s", (id, phrase) => check([id, phrase]));

  it.each(NAMES)("keeps the names in %s", (id, phrase) => check([id, phrase]));

  it.each(VERBATIM)("leaves the foreign text alone in %s", (id, phrase) => check([id, phrase]));

  it.each(STAYS_LOWERCASE)("does not capitalise common nouns in %s", (id, phrase) =>
    check([id, phrase]),
  );

  it("covers every module the edition declares", () => {
    const moduleOf = new Map(edition.segments.map((s) => [s.id, s.moduleId]));
    const covered = new Set(
      [...POLITE, ...NAMES, ...VERBATIM, ...STAYS_LOWERCASE].map(([id]) => moduleOf.get(id)),
    );
    const declared = (edition.modules ?? []).map((m) => m.id);
    expect(declared.length).toBeGreaterThan(0);
    expect([...covered].sort()).toEqual([...declared].sort());
  });
});

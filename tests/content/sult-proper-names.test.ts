/**
 * The same gate as `noveletter-proper-names.test.ts`, for the first pack that
 * needed it from day one: *Sult* addresses strangers with polite «De»/«Dem»/
 * «Deres» 403 times, and the constable does it in dialect («Di», «Dere»,
 * «Demses»). `lowercaseNouns` lowercases every capitalised word that is not
 * sentence-initial and not in `properNames`, so without the list «De har
 * henvendt Dem til mig» (you) becomes «de har henvendt dem til mig» (they) —
 * grammatical, invisible, and 403 times wrong.
 *
 * The phrases are stated as BYTES, independently of `rules.v1.json` (Q-012:
 * a fixture read from the rules file passes for any list, including an empty
 * one). They run against the edition the READER IS SERVED, so a future v2
 * that loses a name fails here too. A legitimate v2 that changes one of these
 * phrases is meant to fail: re-read it and restate the bytes.
 *
 * Two things are Sult-specific and deliberately pinned:
 *  - «Kuboaa», the narrator's invented word, is not orthography and keeps
 *    its «aa» while every real «aa» becomes «å» around it.
 *  - «Herrens» (the Lord) keeps its capital; «Herren» (the gentleman, «Damen
 *    og Herren») does not. The list is exact-form, and so is this test.
 *
 * SHOWN TO BITE: built with an empty `properNames`, the POLITE and NAMES
 * phrases are absent and the test goes red; STAYS_LOWERCASE passes either
 * way, which is what an over-correction guard is for.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { defaultEdition, getWork } from "@/domain/content/registry";
import { defaultPreferences } from "@/infra/repository/migrations";
import type { TextEdition } from "@/domain/types";
import { loadFromDisk } from "./load-from-disk";

/** Polite address, one per stykke; the second is the constable's dialect. */
const POLITE: [string, string][] = [
  ["stykke1-15", "at De har henvendt Dem til meg"],
  ["stykke2-16", "Vil Di, atte jei ska' følle Dere"],
  ["stykke3-160", "må De forsvinde, for nu skal jeg gå"],
  ["stykke4-12", "skal De få Deres penge"],
];

/** Persons, a place, the coinage and the Lord — at least one per stykke. */
const NAMES: [string, string][] = [
  ["stykke1-11", "mødte jeg Hans Pauli"],
  ["stykke1-36", "Hadde Herrens finger pegt på meg"],
  ["stykke2-21", "Tangen – Andreas Tangen"],
  ["stykke2-28", "jeg har opfundet det, Kuboaa"],
  ["stykke3-90", "kom jeg ut på Grønland"],
  ["stykke4-38", "hos Christie endda"],
];

/** Common nouns that a panicked fix would sweep into the list. */
const STAYS_LOWERCASE: [string, string][] = [
  ["stykke1-125", "rundt hele kirken"],
  ["stykke3-54", "sammen med sin mama"],
  ["stykke4-43", "damen og herren, hilste på dem"],
];

describe("hamsun-sult: the edition the reader is served", () => {
  let edition: TextEdition;
  let byId: Map<string, string>;

  beforeAll(async () => {
    const work = getWork("hamsun-sult")!;
    edition = await loadFromDisk(defaultEdition(work, defaultPreferences().languageProfileId));
    byId = new Map(edition.segments.map((s) => [s.id, s.text]));
  });

  const check = ([id, phrase]: [string, string]) => {
    const text = byId.get(id);
    expect(text, `segment ${id} is missing from ${edition.id}`).toBeDefined();
    expect(text, `${edition.id}/${id} should contain «${phrase}»`).toContain(phrase);
  };

  it.each(POLITE)("keeps the polite address in %s", (id, phrase) => check([id, phrase]));

  it.each(NAMES)("keeps the names in %s", (id, phrase) => check([id, phrase]));

  it.each(STAYS_LOWERCASE)("does not capitalise common nouns in %s", (id, phrase) =>
    check([id, phrase]),
  );

  it("covers every one of the four stykker", () => {
    const stykker = new Set(
      [...POLITE, ...NAMES, ...STAYS_LOWERCASE].map(([id]) => id.replace(/-\d+$/, "")),
    );
    expect([...stykker].sort()).toEqual(["stykke1", "stykke2", "stykke3", "stykke4"]);
  });
});

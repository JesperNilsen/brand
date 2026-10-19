/**
 * The proper-names gate for *Gift* grown to the whole novel (13 chapters).
 * Like Sult, the book lives on address: the masters say «De»/«Dem»/«Deres» to
 * parents and colleagues, and «I»/«Jer»/«Eder»/«Eders» to the class and the
 * congregation. `lowercaseNouns` lowercases every capitalised word that is not
 * sentence-initial and not in `properNames`, so without the list «jeg skal
 * lære Jer» becomes «jeg skal lære jer» and «Abraham» becomes «abraham» —
 * grammatical, or nearly, and wrong hundreds of times.
 *
 * The phrases are stated as BYTES, independently of `rules.v4.json` (Q-012:
 * a fixture read from the rules file passes for any list, including an empty
 * one). They run against the edition the READER IS SERVED, so a future v5
 * that loses a name fails here too. A legitimate v5 that changes one of these
 * phrases is meant to fail: re-read it and restate the bytes.
 *
 * Gift-specific and deliberately pinned:
 *  - the God names (Vorherre, Helligånd) keep their capital; the titles
 *    (fru, rektor, adjunkt, professor, provsten) do not, even directly before
 *    a name: «fru Wenche», «professor Løvdahl».
 *  - kap13-42 holds «Gottwald» as the GottWald pattern repairs it, and the
 *    novel's last words.
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

/** Polite «De» to adults, and the old plural «I/Jer/Eder» to boys and flock. */
const POLITE: [string, string][] = [
  ["kap1-23", "Ja jeg skal lære Jer,"],
  ["kap2-30", "derfor kan De vel tænke Dem"],
  ["kap3-35", "min dom om Eders fremtid"],
  ["kap4-20", "At De ikke med Deres smukke"],
  ["kap6-06", "Værsågod at sætte Dem ned"],
  ["kap8-20", "Deres mann venter Dem da vist ikke"],
  ["kap8-36", "I som have helliget Eder til"],
  ["kap9-32", "jeg beder Dem Mordtmann!"],
  ["kap11-18", "her kommer jeg til Dem."],
];

/** Persons, an author and the Lord — at least one per chapter. */
const NAMES: [string, string][] = [
  ["kap1-02", "hadde Abraham innrettet"],
  ["kap2-25", "den lille Gottwald. Det er"],
  ["kap3-01", "al Marius’s latin"],
  ["kap4-01", "hvis navn var Michal Mordtmann"],
  ["kap5-01", "hos Tacitus opp imod"],
  ["kap5-12", "Gamle Betty løftede"],
  ["kap6-38", "bøye seg for Vorherre selv!"],
  ["kap7-01", "som professor Løvdahl hadde tegne"],
  ["kap8-01", "til fru Wenche"],
  ["kap9-02", "vi får lade Abraham indskrive"],
  ["kap10-07", "den unge Løvdahl"],
  ["kap10-11", "fader, søn og Helligånd,"],
  ["kap11-01", "noget til Mordtmann"],
  ["kap12-03", "fru professorinde Løvdahl"],
  ["kap13-01", "invitere Broch og andre"],
  ["kap13-42", "hadde fru Gottwald skrevet"],
];

/** Titles and offices that a panicked fix would sweep into the list. */
const STAYS_LOWERCASE: [string, string][] = [
  ["kap1-02", "sagde adjunkten oppe"],
  ["kap1-03", "Alligevel hadde adjunkt"],
  ["kap2-03", "som rektor triumferend"],
  ["kap13-35", "provsten og rektoren hadde holdt"],
];

describe("kielland-gift: the edition the reader is served", () => {
  let edition: TextEdition;
  let byId: Map<string, string>;

  beforeAll(async () => {
    const work = getWork("kielland-gift")!;
    edition = await loadFromDisk(defaultEdition(work, defaultPreferences().languageProfileId));
    byId = new Map(edition.segments.map((s) => [s.id, s.text]));
  });

  const check = ([id, phrase]: [string, string]) => {
    const text = byId.get(id);
    expect(text, `segment ${id} is missing from ${edition.id}`).toBeDefined();
    expect(text, `${edition.id}/${id} should contain «${phrase}»`).toContain(phrase);
  };

  it("serves the whole-novel edition", () => {
    expect(edition.id).toBe("kielland-gift.training.v4");
  });

  it.each(POLITE)("keeps the polite address in %s", (id, phrase) => check([id, phrase]));

  it.each(NAMES)("keeps the names in %s", (id, phrase) => check([id, phrase]));

  it.each(STAYS_LOWERCASE)("does not capitalise titles in %s", (id, phrase) => check([id, phrase]));

  it("covers every one of the thirteen chapters", () => {
    const chapters = new Set(
      [...POLITE, ...NAMES, ...STAYS_LOWERCASE].map(([id]) => id.replace(/-\d+$/, "")),
    );
    expect([...chapters].sort()).toEqual(
      Array.from({ length: 13 }, (_, i) => `kap${i + 1}`).sort(),
    );
  });
});

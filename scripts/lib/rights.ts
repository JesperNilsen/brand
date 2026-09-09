/**
 * The four fields the rights assessment rests on, checked as values rather
 * than read out of prose.
 *
 * The death year is the point. `docs/spec/CORPUS.md` sorts on «forfatteren døde
 * i 1955 eller tidligere», and until Q-010 that number existed only inside a
 * free-text `license` sentence, where no machine could read it. With 25 works
 * planned, it is the one fact that decides what may be imported at all.
 *
 * All 25 planned authors pass the death-year sort, which is exactly why passing
 * it is not sufficient — hence `rightsStatus` separating `public-domain`
 * (derived from the year) from `public-domain-verified` (someone looked at the
 * concrete source).
 *
 * A work whose author died after the cut-off is not refused outright. It is
 * refused a rights claim it has not earned: it must either say it is
 * restricted, or write down in `rightsBasis` why it is usable anyway. The
 * failure mode being gated is an enum quietly asserting public domain over a
 * text that is still in copyright.
 *
 * Pure, and returning problems rather than exiting, for the same reason as
 * `shelfProblems` and `reviewProblems`: a gate that cannot be handed bad input
 * in a test is a gate nobody has seen bite.
 */

/** docs/spec/CORPUS.md: the death year the first sort reads. */
export const PUBLIC_DOMAIN_DEATH_YEAR = 1955;

const RIGHTS_STATUSES = ["public-domain", "public-domain-verified", "restricted", "unknown"];
const ORIGINAL_LANGUAGES = ["da-NO", "da-DK", "nb-NO", "nn-NO"];
const ADAPTATION_STATUSES = ["none", "orthography", "orthography-and-morphology", "converted"];

type Unknowns = Record<string, unknown> | undefined;

/**
 * Complain about a work whose rights metadata is missing, unreadable, or
 * claims more than the death year supports.
 */
export function rightsProblems(work: Unknowns, source: Unknowns): string[] {
  const problems: string[] = [];

  const lang = work?.originalLanguage;
  if (!lang) {
    problems.push(
      `work.originalLanguage mangler — språket verket ble skrevet på, ikke transkripsjonens`,
    );
  } else if (!ORIGINAL_LANGUAGES.includes(String(lang))) {
    problems.push(`work.originalLanguage «${String(lang)}» er ikke en kjent verdi`);
  }

  if (!source) return problems;

  const death = source.authorDeathYear;
  if (death === undefined || death === null || death === "") {
    problems.push(`work.source.authorDeathYear mangler`);
  } else if (typeof death !== "number" || !Number.isInteger(death)) {
    problems.push(`work.source.authorDeathYear må være et helt tall, ikke «${String(death)}»`);
  }

  const status = String(source.rightsStatus ?? "");
  if (!status) {
    problems.push(`work.source.rightsStatus mangler`);
  } else if (!RIGHTS_STATUSES.includes(status)) {
    problems.push(`work.source.rightsStatus «${status}» er ikke en kjent verdi`);
  }

  if (
    typeof death === "number" &&
    death > PUBLIC_DOMAIN_DEATH_YEAR &&
    status.startsWith("public-domain") &&
    !String(source.rightsBasis ?? "").trim()
  ) {
    problems.push(
      `work.source: forfatteren døde i ${death}, etter ${PUBLIC_DOMAIN_DEATH_YEAR}, men rightsStatus ` +
        `er «${status}». Førstesorteringen i docs/spec/CORPUS.md slipper ikke dette gjennom — ` +
        `skriv grunnen i rightsBasis, eller sett rightsStatus til «restricted».`,
    );
  }

  return problems;
}

/**
 * Complain about a training edition that does not say what was done to it.
 *
 * Not derivable, which is why it is required rather than defaulted: an original
 * is `none`, but `orthography` and `converted` are different promises to the
 * reader, and D17 reserves the second one for a text carried across from
 * another written standard.
 */
export function adaptationProblems(where: string, edition: Unknowns): string[] {
  const status = edition?.adaptationStatus;
  if (!status) {
    return [`${where}: adaptationStatus mangler — sett den i regelsettet utgaven bygges av`];
  }
  if (!ADAPTATION_STATUSES.includes(String(status))) {
    return [`${where}: adaptationStatus «${String(status)}» er ikke en kjent verdi`];
  }
  return [];
}

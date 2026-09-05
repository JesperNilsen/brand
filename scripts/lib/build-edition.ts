/**
 * Assembling a training edition, as a pure function of its two inputs.
 *
 * It lives here rather than inside the CLI so `pnpm validate:content` can
 * rebuild every published edition from `original.json` + `rules.vN.json` and
 * compare the result byte for byte with what is committed. Without that, a
 * hand-edited training edition passes every other check: the ids match, the
 * line counts match, the word counts are within tolerance, and the text is
 * simply not what the rules produce.
 */
import { countWords } from "./text";
import { editionContentHash } from "./hash";
import { applyLowercaseNouns, applyRules, type Rules } from "./rules";

export type OriginalFile = {
  edition: {
    id: string;
    workId: string;
    contentHash?: string;
    segments: Array<{
      id: string;
      order: number;
      text: string;
      label?: string;
      difficulty?: number;
    }>;
  };
};

export type BuiltEdition = {
  edition: Record<string, unknown>;
  /** Replacement keys the source text never used. Reported, not fatal. */
  unusedReplacements: string[];
  appliedRuleCount: number;
};

export function buildTrainingEdition(original: OriginalFile, rules: Rules): BuiltEdition {
  const usage = new Map<string, number>();
  const properNames = new Set(rules.lowercaseNouns?.properNames ?? []);

  const segments = original.edition.segments.map((s) => {
    let text = applyRules(s.text, rules, usage);
    if (rules.lowercaseNouns) text = applyLowercaseNouns(text, properNames, usage);
    return { ...s, text, wordCount: countWords(text) };
  });

  const applied = [...usage.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const dict = rules.replacements ?? {};
  const editorialNotes = [
    ...(rules.notes ?? []),
    ...(rules.patterns ?? []).map(
      (p) =>
        `Mønster: /${p.from}/ → «${p.to}» (${usage.get(`pattern:${p.from}`) ?? 0} forekomster)${p.note ? ` — ${p.note}` : ""}`,
    ),
    ...applied
      .filter(([k]) => !k.startsWith("pattern:") && !k.startsWith("lowercase:"))
      .map(([k, n]) => `Ortografi: «${k}» → «${dict[k]}» (${n})`),
    ...applied
      .filter(([k]) => k.startsWith("lowercase:"))
      .map(([k, n]) => {
        const word = k.slice("lowercase:".length);
        return `Substantiv (stor → liten forbokstav): «${word}» → «${word[0].toLowerCase()}${word.slice(1)}» (${n})`;
      }),
    ...Object.entries(rules.retained ?? {}).map(([k, why]) => `Beholdt: «${k}» — ${why}`),
  ];

  return {
    edition: {
      id: rules.editionId,
      workId: original.edition.workId,
      kind: "training-edition",
      version: rules.version,
      contentHash: editionContentHash(segments),
      languageProfileId: rules.languageProfileId,
      basedOnEditionId: original.edition.id,
      basedOnContentHash: original.edition.contentHash,
      segments,
      editorialNotes,
    },
    unusedReplacements: Object.keys(dict).filter((k) => !usage.has(k)),
    appliedRuleCount: applied.length,
  };
}

/** The exact bytes a built edition is written as, so a comparison is a comparison. */
export function serializeEdition(edition: Record<string, unknown>): string {
  return JSON.stringify(edition, null, 2) + "\n";
}

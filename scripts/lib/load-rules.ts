/**
 * Reading a pack's rule set from disk and folding in the profile's base rules.
 *
 * It exists so the builder and `validate:content` cannot drift: the validator
 * proves an edition by rebuilding it, and that proof is worth nothing if the
 * two sides compose rules differently. One function, both callers.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { assertCorpusFamily, composeRules, type Rules } from "./rules";
import { requireBaseRuleSet } from "../../src/domain/language/base-rules";

/** Read `rules.vN.json` for a pack and return it composed with its base set. */
export async function loadRules(dir: string, version: number): Promise<Rules> {
  const raw = JSON.parse(
    await readFile(path.join(dir, `rules.v${version}.json`), "utf8"),
  ) as Rules;
  if (!raw.baseRules) return raw;

  const base = requireBaseRuleSet(raw.baseRules);
  // Resolving by id means the types are gone by the time we get here, so the
  // family is checked at the one point every corpus build passes through.
  assertCorpusFamily(base, `${raw.editionId} → ${base.id}`);
  if (base.languageProfileId !== raw.languageProfileId) {
    throw new Error(
      `${raw.editionId}: base rule set ${base.id} belongs to ${base.languageProfileId}, not ${raw.languageProfileId}`,
    );
  }
  const composed = composeRules(raw, base);
  // The edition should say what recipe produced it, not just what the pack added.
  return {
    ...composed,
    notes: [`Grunnregler: ${base.id} (${base.version}).`, ...(raw.notes ?? [])],
  };
}

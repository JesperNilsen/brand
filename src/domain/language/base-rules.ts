/**
 * The frozen base rule sets, and the only module that imports them.
 *
 * They are deliberately NOT hung off `LanguageProfile`. The profile is read by
 * client code — `migrations.ts` needs the default profile id — and a rule set
 * on the profile meant the whole orthographic dictionary travelled with it
 * into the browser bundle, where nothing reads it. `check:bundle` did not
 * notice, because it greps for corpus text and editorial notes, and a word
 * list is neither. It greps for a base rule now too.
 *
 * Only build scripts and the report tooling import this file. If a client
 * component ever does, the bundle check will say so.
 */
import type { LanguageBaseRuleSet } from "../types";
import baseV1 from "./brand-riksmaal.base.v1.json";
import baseV2 from "./brand-riksmaal.base.v2.json";

/** Oldest first: the newest set is the last one, and callers rely on that. */
export const BASE_RULE_SETS: readonly LanguageBaseRuleSet[] = [
  baseV1 as LanguageBaseRuleSet,
  baseV2 as LanguageBaseRuleSet,
];

export function listBaseRuleSets(languageProfileId: string): readonly LanguageBaseRuleSet[] {
  return BASE_RULE_SETS.filter((s) => s.languageProfileId === languageProfileId);
}

/** A frozen base rule set, looked up by its id. */
export function getBaseRuleSet(id: string): LanguageBaseRuleSet | undefined {
  return BASE_RULE_SETS.find((s) => s.id === id);
}

export function requireBaseRuleSet(id: string): LanguageBaseRuleSet {
  const s = getBaseRuleSet(id);
  if (!s) {
    throw new Error(
      `Unknown base rule set: ${id}. Known: ${BASE_RULE_SETS.map((r) => r.id).join(", ")}`,
    );
  }
  return s;
}

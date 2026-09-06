import type { LanguageBaseRuleSet, LanguageProfile } from "../types";
import { brandRiksmaal } from "./brand-riksmaal";

const profiles: readonly LanguageProfile[] = [brandRiksmaal];

export const DEFAULT_LANGUAGE_PROFILE_ID = brandRiksmaal.id;

export function listLanguageProfiles(): readonly LanguageProfile[] {
  return profiles;
}

export function getLanguageProfile(id: string): LanguageProfile | undefined {
  return profiles.find((p) => p.id === id);
}

export function requireLanguageProfile(id: string): LanguageProfile {
  const p = getLanguageProfile(id);
  if (!p) throw new Error(`Unknown language profile: ${id}`);
  return p;
}

/** A frozen base rule set, looked up by its id across every profile. */
export function getBaseRuleSet(id: string): LanguageBaseRuleSet | undefined {
  for (const p of profiles) {
    const found = p.baseRuleSets.find((s) => s.id === id);
    if (found) return found;
  }
  return undefined;
}

export function requireBaseRuleSet(id: string): LanguageBaseRuleSet {
  const s = getBaseRuleSet(id);
  if (!s) throw new Error(`Unknown base rule set: ${id}`);
  return s;
}

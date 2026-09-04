import type { LanguageProfile } from "../types";
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

import type { LanguageBaseRuleSet, LanguageProfile } from "../types";
import baseV1 from "./brand-riksmaal.base.v1.json";

/**
 * brand-riksmaal — moderne-konservativt riksmål (docs/spec/LANGUAGE_PROFILE.md).
 * The profile shapes which edition is shown and how the product speaks; it
 * never touches the typing engine, which compares against the exact edition.
 */
export const brandRiksmaal: LanguageProfile = {
  id: "brand-riksmaal",
  version: "1.0.0",
  displayName: "Brand riksmål",
  locale: "nb-NO",
  description:
    "Moderne, konservativt riksmål: lettlest, verdig og naturlig — aldri museumsaktig.",
  preferredForms: {
    frem: "fram",
    boken: "boka",
    syv: "sju",
    nå: "nu",
    etter: "efter",
    meget: "mye",
    selv: "sjøl",
    bygget: "bygd",
  },
  baseRuleSets: [baseV1 as LanguageBaseRuleSet],
};

/** Look up one of the profile's frozen base rule sets by id. */
export function getBaseRuleSet(id: string): LanguageBaseRuleSet | undefined {
  return brandRiksmaal.baseRuleSets.find((s) => s.id === id);
}

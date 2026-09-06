import type { LanguageProfile } from "../types";

/**
 * brand-riksmaal — moderne-konservativt riksmål (docs/spec/LANGUAGE_PROFILE.md).
 *
 * Identity and presentation only. The frozen base rule sets live in
 * `base-rules.ts` and are not reachable from here: this module is in the
 * client graph, and the orthographic dictionaries have no business there.
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
};


import type { LanguageProfile } from "../types";

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
};

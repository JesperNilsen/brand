import type { OrthographyProfile, OrthographyRuleset } from "../types";

/**
 * Bokmål, current and historical. Before 1929 the official name was riksmål,
 * so the two oldest norms carry that name.
 *
 * Kept apart from two things it is easily mixed with: modern riksmål, which
 * Det Norske Akademi maintains outside the official norm (see
 * docs/spec/ORTHOGRAPHY_NORMS.md on why it is not in this list), and
 * Brandmål, which is its own language.
 */

const EMPTY: OrthographyRuleset = {
  formStatuses: ["required", "outside"],
  rules: [],
  words: [],
  exampleTexts: [],
};

const OVERVIEW = { sourceId: "sprakradet-bokmal-1900", locator: "hele siden" };

export const BOKMAL_NORMS: readonly OrthographyProfile[] = [
  {
    id: "bokmal-current",
    languageId: "bokmal",
    displayName: "Moderne bokmål",
    historicalPeriod: { from: 2005 },
    authority: "Språkrådet",
    officialStatus: "current-official",
    isCurrent: true,
    implementationStatus: "metadata-only",
    sources: [{ sourceId: "sprakradet-rettskrivingsvedtak", locator: "hele siden" }],
    ruleset: { ...EMPTY, formStatuses: ["allowed", "outside"] },
  },
  {
    id: "bokmal-1907",
    languageId: "bokmal",
    displayName: "Riksmål 1907",
    historicalPeriod: { from: 1907, to: 1917 },
    authority: "Kirke- og undervisningsdepartementet",
    officialStatus: "historical-official",
    isCurrent: false,
    implementationStatus: "metadata-only",
    sources: [OVERVIEW],
    ruleset: { ...EMPTY, formStatuses: ["required", "optional", "outside"] },
  },
  {
    id: "bokmal-1917",
    languageId: "bokmal",
    displayName: "Riksmål 1917",
    historicalPeriod: { from: 1917, to: 1938 },
    authority: "Kirke- og undervisningsdepartementet",
    officialStatus: "historical-official",
    isCurrent: false,
    implementationStatus: "metadata-only",
    sources: [OVERVIEW],
    ruleset: { ...EMPTY, formStatuses: ["required", "optional", "outside"] },
  },
  {
    id: "bokmal-1938",
    languageId: "bokmal",
    displayName: "Bokmål 1938",
    historicalPeriod: { from: 1938, to: 1959 },
    authority: "Kirke- og undervisningsdepartementet",
    officialStatus: "historical-official",
    isCurrent: false,
    implementationStatus: "metadata-only",
    sources: [OVERVIEW],
    ruleset: { ...EMPTY, formStatuses: ["required", "main", "side", "bracket", "outside"] },
  },
  {
    id: "bokmal-1959",
    languageId: "bokmal",
    displayName: "Bokmål 1959",
    historicalPeriod: { from: 1959, to: 1981 },
    authority: "Kirke- og undervisningsdepartementet",
    officialStatus: "historical-official",
    isCurrent: false,
    implementationStatus: "metadata-only",
    sources: [OVERVIEW],
    ruleset: { ...EMPTY, formStatuses: ["required", "main", "side", "outside"] },
  },
  {
    id: "bokmal-1981",
    languageId: "bokmal",
    displayName: "Bokmål 1981",
    historicalPeriod: { from: 1981, to: 2005 },
    authority: "Kirke- og undervisningsdepartementet",
    officialStatus: "historical-official",
    isCurrent: false,
    implementationStatus: "metadata-only",
    sources: [OVERVIEW],
    ruleset: { ...EMPTY, formStatuses: ["required", "main", "side", "outside"] },
  },
  {
    id: "bokmal-2005",
    languageId: "bokmal",
    displayName: "Bokmål 2005",
    historicalPeriod: { from: 2005 },
    authority: "Kultur- og kirkedepartementet / Språkrådet",
    officialStatus: "historical-official",
    isCurrent: false,
    implementationStatus: "metadata-only",
    sources: [{ sourceId: "sprakradet-rettskrivingsvedtak", locator: "hele siden" }],
    ruleset: { ...EMPTY, formStatuses: ["allowed", "outside"] },
  },
];

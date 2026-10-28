import type { OrthographyProfile } from "../types";

/**
 * Brandmål — Brands egen husnorm (standards/brand/brand-skrivestandard-v0.1.md).
 *
 * Its own language, not a bokmål norm with extra rules: nothing here is
 * inherited from a historical bokmål norm, and nothing there from here.
 *
 * Only what the standard records as decided is entered. Where the standard
 * says an alternative's status is «ikke fastsatt» (fram, sju, tjue …), the
 * alternative is left out rather than marked `outside`: §4 says «Ikke
 * vedtatt» is not the same as «forbudt», and the judge reports a form that is
 * not here as undocumented, which is exactly that.
 */
const STANDARD = "brand-skrivestandard-0.1";

export const brandmal: OrthographyProfile = {
  id: "brandmal-0.1",
  languageId: "brandmal",
  displayName: "Brandmål",
  historicalPeriod: { from: 2026 },
  authority: "Brand (skrivestandard v0.1)",
  officialStatus: "house",
  isCurrent: true,
  implementationStatus: "partial",
  sources: [{ sourceId: STANDARD, locator: "§ 1–5" }],
  editionProfileId: "brand-riksmaal",
  ruleset: {
    formStatuses: ["required", "preferred", "tolerated", "style-marked", "outside"],
    rules: [
      {
        id: "brandmal-felleskjonn",
        kind: "inflection",
        summary:
          "Felleskjønn der det finnes en vanlig form: boken, jenten, døren — ikke radikale a-former.",
        sources: [
          { sourceId: STANDARD, locator: "§ 2 (radikale former) og § 5, Bøyning" },
          { sourceId: STANDARD, locator: "§ 4, eksempelet «Boka»" },
        ],
        confidence: "verified-primary",
      },
      {
        id: "brandmal-verb-et",
        kind: "inflection",
        summary: "Konservativ verbbøyning: kastet, snakket og bygget fremfor kasta, snakka og bygga.",
        sources: [{ sourceId: STANDARD, locator: "§ 5, Bøyning" }],
        confidence: "verified-primary",
      },
      {
        id: "brandmal-flertall-ene",
        kind: "inflection",
        summary: "Konservativ flertallsbøyning der normen har et valg: husene og årene fremfor husa og åra.",
        sources: [{ sourceId: STANDARD, locator: "§ 5, Bøyning" }],
        confidence: "verified-primary",
      },
      {
        id: "brandmal-tradisjonelle-former",
        kind: "spelling",
        summary:
          "Tradisjonelle former velges ordvis: efter og have foretrekkes; etter og hage tolereres.",
        sources: [
          { sourceId: STANDARD, locator: "§ 2, uttrykkelige krav" },
          { sourceId: STANDARD, locator: "§ 5, tabellen Tradisjonelle former" },
        ],
        confidence: "verified-primary",
      },
      {
        id: "brandmal-normalformer",
        kind: "spelling",
        summary:
          "Valgte normalformer: av, frem, syv, tyve, tredve, hverken, selv, sen, meget og nå.",
        sources: [{ sourceId: STANDARD, locator: "§ 2, tidligere valg; beslutning 10" }],
        confidence: "verified-primary",
      },
      {
        id: "brandmal-stilmarkert",
        kind: "form-status",
        summary:
          "Eldre former som nu og sprog er tillatt, men stilmarkert: aldri feil, ikke førstevalg ved nyskriving.",
        sources: [
          { sourceId: STANDARD, locator: "§ 2, om nu og formene i Q1 og Q2" },
          { sourceId: STANDARD, locator: "§ 4, eksempelet «sprog»" },
        ],
        confidence: "verified-primary",
      },
    ],
    words: [
      {
        id: "brandmal-boken",
        lexeme: "boka",
        forms: [
          { form: "boken", status: "preferred" },
          { form: "boka", status: "outside", note: "radikal form" },
        ],
        ruleId: "brandmal-felleskjonn",
      },
      {
        id: "brandmal-jenten",
        lexeme: "jenta",
        forms: [
          { form: "jenten", status: "preferred" },
          { form: "jenta", status: "outside", note: "radikal form" },
        ],
        ruleId: "brandmal-felleskjonn",
      },
      {
        id: "brandmal-doren",
        lexeme: "døra",
        forms: [
          { form: "døren", status: "preferred" },
          { form: "døra", status: "outside", note: "radikal form" },
        ],
        ruleId: "brandmal-felleskjonn",
      },
      {
        id: "brandmal-kastet",
        lexeme: "kastet",
        forms: [
          { form: "kastet", status: "preferred" },
          { form: "kasta", status: "outside", note: "radikal form" },
        ],
        ruleId: "brandmal-verb-et",
      },
      {
        id: "brandmal-snakket",
        lexeme: "snakket",
        forms: [
          { form: "snakket", status: "preferred" },
          { form: "snakka", status: "outside", note: "radikal form" },
        ],
        ruleId: "brandmal-verb-et",
      },
      {
        id: "brandmal-bygget",
        lexeme: "bygget",
        forms: [
          { form: "bygget", status: "preferred" },
          { form: "bygga", status: "outside", note: "radikal form" },
        ],
        ruleId: "brandmal-verb-et",
      },
      {
        id: "brandmal-husene",
        lexeme: "husene",
        forms: [
          { form: "husene", status: "preferred" },
          { form: "husa", status: "outside", note: "radikal form" },
        ],
        ruleId: "brandmal-flertall-ene",
      },
      {
        id: "brandmal-arene",
        lexeme: "årene",
        forms: [
          { form: "årene", status: "preferred" },
          { form: "åra", status: "outside", note: "radikal form" },
        ],
        ruleId: "brandmal-flertall-ene",
      },
      {
        id: "brandmal-efter",
        lexeme: "etter",
        forms: [
          { form: "efter", status: "preferred" },
          { form: "etter", status: "tolerated" },
        ],
        ruleId: "brandmal-tradisjonelle-former",
      },
      {
        id: "brandmal-have",
        lexeme: "hage",
        gloss: "dyrket område, ikke verbet å ha",
        forms: [
          { form: "have", status: "preferred" },
          { form: "hage", status: "tolerated" },
        ],
        ruleId: "brandmal-tradisjonelle-former",
      },
      {
        id: "brandmal-na",
        lexeme: "nå",
        forms: [
          { form: "nå", status: "preferred" },
          { form: "nu", status: "style-marked" },
        ],
        ruleId: "brandmal-stilmarkert",
        sources: [{ sourceId: STANDARD, locator: "§ 5, tabellen Tradisjonelle former, raden Nå" }],
      },
      {
        id: "brandmal-sprak",
        lexeme: "språk",
        forms: [
          { form: "språk", status: "preferred" },
          { form: "sprog", status: "style-marked" },
        ],
        ruleId: "brandmal-stilmarkert",
        sources: [{ sourceId: STANDARD, locator: "§ 4, eksempelet «sprog»" }],
      },
      {
        id: "brandmal-frem",
        lexeme: "fram",
        forms: [{ form: "frem", status: "preferred" }],
        ruleId: "brandmal-normalformer",
      },
      {
        id: "brandmal-syv",
        lexeme: "sju",
        forms: [{ form: "syv", status: "preferred" }],
        ruleId: "brandmal-normalformer",
      },
    ],
    exampleTexts: [],
  },
};

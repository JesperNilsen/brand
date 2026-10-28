/**
 * The norm registry. Client-safe and small: the menu, the chooser and the
 * orthography exercise read it in the browser. It holds a few sourced rules
 * per norm, not a dictionary — see ImplementationStatus.
 */
import { BOKMAL_NORMS } from "./norms/bokmal";
import { brandmal } from "./norms/brandmal";
import { ORTHOGRAPHY_SOURCES } from "./sources";
import type {
  OrthographyProfile,
  OrthographySource,
  WritingLanguage,
  WritingLanguageId,
  WritingNormSelection,
} from "./types";

const ORTHOGRAPHIES: readonly OrthographyProfile[] = [brandmal, ...BOKMAL_NORMS];

const LANGUAGES: readonly WritingLanguage[] = [
  {
    id: "brandmal",
    displayName: "Brandmål",
    description: "Brands egen konservative husnorm i riksmålstradisjonen.",
    orthographyIds: [brandmal.id],
    defaultOrthographyId: brandmal.id,
  },
  {
    id: "bokmal",
    displayName: "Bokmål",
    description: "Offentlig rettskrivning, gjeldende eller historisk.",
    orthographyIds: BOKMAL_NORMS.map((n) => n.id),
    defaultOrthographyId: "bokmal-current",
  },
];

/** Brandmål, as before there was a choice. */
export const DEFAULT_WRITING_LANGUAGE_ID: WritingLanguageId = "brandmal";

export function listWritingLanguages(): readonly WritingLanguage[] {
  return LANGUAGES;
}

export function getWritingLanguage(id: string): WritingLanguage | undefined {
  return LANGUAGES.find((l) => l.id === id);
}

export function isWritingLanguageId(id: unknown): id is WritingLanguageId {
  return typeof id === "string" && LANGUAGES.some((l) => l.id === id);
}

export function listOrthographies(languageId?: WritingLanguageId): readonly OrthographyProfile[] {
  return languageId ? ORTHOGRAPHIES.filter((o) => o.languageId === languageId) : ORTHOGRAPHIES;
}

export function getOrthography(id: string): OrthographyProfile | undefined {
  return ORTHOGRAPHIES.find((o) => o.id === id);
}

export function requireOrthography(id: string): OrthographyProfile {
  const o = getOrthography(id);
  if (!o) throw new Error(`Unknown orthography: ${id}`);
  return o;
}

export function getOrthographySource(id: string): OrthographySource | undefined {
  return ORTHOGRAPHY_SOURCES.find((s) => s.id === id);
}

/** Whether `orthographyId` is a norm the language offers. */
export function belongsTo(orthographyId: unknown, languageId: WritingLanguageId): boolean {
  if (typeof orthographyId !== "string") return false;
  return getWritingLanguage(languageId)?.orthographyIds.includes(orthographyId) ?? false;
}

/**
 * The norm a language is on: the one last chosen for it, or its default.
 * `remembered` is the per-language memory from preferences.
 */
export function orthographyFor(
  languageId: WritingLanguageId,
  remembered: Readonly<Record<string, string>>,
): string {
  const last = remembered[languageId];
  if (belongsTo(last, languageId)) return last;
  return getWritingLanguage(languageId)!.defaultOrthographyId;
}

export function resolveSelection(input: {
  writingLanguageId: string;
  orthographyByLanguage: Readonly<Record<string, string>>;
}): WritingNormSelection {
  const languageId = isWritingLanguageId(input.writingLanguageId)
    ? input.writingLanguageId
    : DEFAULT_WRITING_LANGUAGE_ID;
  return { languageId, orthographyId: orthographyFor(languageId, input.orthographyByLanguage) };
}

import type { FormStatus, OrthographyProfile, WordEntry, WordForm } from "./types";

/**
 * The two kinds of writing exercise, which judge the same keystrokes by
 * different questions.
 *
 * - `transcription` (avskrivning): did the reader reproduce the given text?
 *   Only the exact text is right. The norm can explain a deviation — «efter is
 *   allowed in your norm» — but never excuse it.
 * - `orthography` (rettskrivning): did the reader spell the word as the chosen
 *   norm allows? Any form the norm allows is right, and its standing (main,
 *   side …) is reported, not flattened.
 */
export type ExerciseKind = "transcription" | "orthography";

/** Strongest first; used to order answers, never to reject an allowed form. */
const RANK: readonly FormStatus[] = [
  "required",
  "main",
  "preferred",
  "allowed",
  "optional",
  "tolerated",
  "side",
  "bracket",
  "style-marked",
];

export function isAccepted(status: FormStatus): boolean {
  return status !== "outside";
}

/**
 * The comparison key for an orthography answer: Unicode-normalised, trimmed,
 * lower-cased. Capitalisation is not what these exercises judge, and a
 * decomposed «å» typed on one keyboard must equal a composed one from another.
 * Transcription does not use this; it compares exactly.
 */
export function formKey(s: string): string {
  return s.normalize("NFC").trim().toLocaleLowerCase("nb");
}

/** The forms the norm allows for this word, strongest standing first. */
export function acceptedForms(entry: WordEntry): WordForm[] {
  return entry.forms
    .filter((f) => isAccepted(f.status))
    .sort((a, b) => RANK.indexOf(a.status) - RANK.indexOf(b.status));
}

export type OrthographyVerdict =
  /** A documented, allowed form. `form.status` says which kind. */
  | { kind: "accepted"; form: WordForm; accepted: WordForm[] }
  /** A form the source documents as outside the norm. */
  | { kind: "outside"; form: WordForm; accepted: WordForm[] }
  /**
   * Not among the forms the sources document for this word. NOT a verdict of
   * wrong: a historically correct form the sources here do not name must not
   * be rejected for being unusual. The reader is told what is documented.
   */
  | { kind: "undocumented"; accepted: WordForm[] };

export function judgeOrthography(entry: WordEntry, typed: string): OrthographyVerdict {
  const key = formKey(typed);
  const accepted = acceptedForms(entry);
  const match = entry.forms.find((f) => formKey(f.form) === key);
  if (!match) return { kind: "undocumented", accepted };
  if (isAccepted(match.status)) return { kind: "accepted", form: match, accepted };
  return { kind: "outside", form: match, accepted };
}

export type TranscriptionVerdict =
  | { kind: "exact" }
  | {
      kind: "differs";
      /**
       * Set when the typed form is one the reader's norm allows for the same
       * word, so the result can say why it is still not a copy of the text.
       */
      allowedInNorm?: { entry: WordEntry; form: WordForm };
    };

/**
 * Judge one word of a transcription. Exact comparison, as the engine does it;
 * the norm is consulted only to explain a difference.
 */
export function judgeTranscription(
  expected: string,
  typed: string,
  orthography?: OrthographyProfile,
): TranscriptionVerdict {
  if (typed === expected) return { kind: "exact" };
  if (!orthography) return { kind: "differs" };
  const typedKey = formKey(typed);
  const expectedKey = formKey(expected);
  for (const entry of orthography.ruleset.words) {
    const keys = entry.forms.map((f) => formKey(f.form));
    if (!keys.includes(expectedKey)) continue;
    const form = entry.forms.find((f) => formKey(f.form) === typedKey);
    if (form && isAccepted(form.status)) return { kind: "differs", allowedInNorm: { entry, form } };
  }
  return { kind: "differs" };
}

/** One prompt in the orthography exercise: a form outside the norm, to be written in it. */
export type OrthographyItem = {
  entry: WordEntry;
  /** The spelling shown to the reader — documented as outside this norm. */
  cue: WordForm;
};

/**
 * The exercise items a norm can support: words with a documented form outside
 * the norm to show and at least one documented form inside it to accept. In
 * data order, so a session is reproducible.
 */
export function orthographyItems(orthography: OrthographyProfile): OrthographyItem[] {
  const items: OrthographyItem[] = [];
  for (const entry of orthography.ruleset.words) {
    const cue = entry.forms.find((f) => f.status === "outside");
    if (cue && entry.forms.some((f) => isAccepted(f.status))) items.push({ entry, cue });
  }
  return items;
}

/**
 * The polite second person must survive a training edition.
 *
 * `lowercaseNouns` lowercases every capitalised word that is not
 * sentence-initial and not in `properNames`. In 19th-century Dano-Norwegian
 * the polite «De» / «Dem» / «Deres» (and the archaic plural «I») are exactly
 * such words — and lowercasing them does not misspell anything, it changes who
 * the sentence is addressed to: «De har henvendt Dem til mig» becomes «de har
 * henvendt dem til mig», *you* becomes *them*, and the text stays grammatical.
 * The reader cannot see it. Q-016 found 81 such occurrences live in
 * `kielland-noveletter.training.v3`; *Sult* carries 403 of them.
 *
 * The check is count equality per segment: the exact-case token «Dem» occurs
 * N times in the original segment and must occur N times in the training
 * segment. That needs no word alignment, so a replacement that splits or
 * joins a neighbouring word cannot confuse it, and sentence-initial tokens
 * are untouched by the rule on both sides, so equality is exact rather than
 * approximate. Measured across every edition of the four packs before this
 * was written: zero mismatches anywhere except the 58 segments of the edition
 * Q-016 replaced.
 *
 * Pure, like `rights.ts` and `shelves.ts`: given two segment lists it returns
 * problems. Reading files and deciding fail-versus-warn is the validator's.
 */
import { isSentenceInitial, isWordToken, tokenize } from "../../src/domain/language/rules";

/** Tokens whose capital letter is address, not orthography. */
export const POLITE = ["De", "Dem", "Deres", "I"] as const;

type Segment = { id: string; text: string };

/** Occurrences of the exact token, and how many of them stand mid-sentence. */
function occurrences(text: string, token: string): { total: number; midSentence: number } {
  const tokens = tokenize(text);
  let total = 0;
  let midSentence = 0;
  tokens.forEach((tok, i) => {
    if (!isWordToken(tok) || tok !== token) return;
    total += 1;
    if (!isSentenceInitial(tokens, i)) midSentence += 1;
  });
  return { total, midSentence };
}

/**
 * Every segment where a polite form's count differs between the original and
 * the training edition. `file` is the training edition's file name, so the
 * message can be read like the validator's others: file/segment: what.
 */
export function politeAddressProblems(
  file: string,
  originalId: string,
  trainingId: string,
  original: readonly Segment[],
  training: readonly Segment[],
): string[] {
  const problems: string[] = [];
  const trained = new Map(training.map((s) => [s.id, s.text]));

  for (const seg of original) {
    const after = trained.get(seg.id);
    if (after === undefined) continue; // the id gate reports that, not this one
    for (const form of POLITE) {
      const before = occurrences(seg.text, form);
      if (before.total === 0) continue;
      const now = occurrences(after, form).total;
      if (now === before.total) continue;
      const lower = form[0].toLowerCase() + form.slice(1);
      problems.push(
        `${file}/${seg.id}: høflig tiltale «${form}» står ${before.total} ${before.total === 1 ? "gang" : "ganger"} ` +
          `(${before.midSentence} midt i setningen) i ${originalId}, men ${now} ${now === 1 ? "gang" : "ganger"} ` +
          `i ${trainingId} — lowercaseNouns har gjort «${form}» til «${lower}», som endrer hvem ` +
          `setningen snakker til, ikke hvordan den staves. Legg «${form}» i properNames.`,
      );
    }
  }
  return problems;
}

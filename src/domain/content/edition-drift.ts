import type { SessionResult, TextEditionMeta } from "../types";

/**
 * Whether the text a stored session was typed against is still the text the
 * catalog serves under that edition id.
 *
 * Every session records `editionId` and `editionContentHash` (D7), precisely so
 * that a later change cannot falsify an old result — but nothing read them back,
 * so the guarantee rested on discipline alone. It nearly went the other way in
 * Q-006: adding text to a work would have rewritten the edition every earlier
 * session named, and no gate, page or test would have said a word. Originals are
 * versioned now (D15) so it should not happen; this is what makes it visible if
 * it does.
 *
 * - `match`   — the edition is there and its text is the text that was typed.
 * - `moved`   — the id is there, the hash is not: the edition was re-cut.
 * - `gone`    — the id names no edition in the catalog any more.
 * - `unknown` — a record from schema 1 or 2, which predate the fields. Not a
 *   drift: those sessions cannot say what they were typed against, and calling
 *   that "changed" would be as wrong as calling it "unchanged".
 */
export type EditionDrift = "match" | "moved" | "gone" | "unknown";

/** Written by `migrateSession` where provenance cannot be recovered. */
const UNKNOWN = "unknown";

export function editionDrift(
  result: Pick<SessionResult, "editionId" | "editionContentHash">,
  edition: TextEditionMeta | undefined,
): EditionDrift {
  if (!result.editionContentHash || result.editionContentHash === UNKNOWN) return UNKNOWN;
  if (!edition) return "gone";
  return edition.contentHash === result.editionContentHash ? "match" : "moved";
}

/** Whether a drift is worth telling the reader about. */
export function isDrifted(drift: EditionDrift): boolean {
  return drift === "moved" || drift === "gone";
}

/** The short form, for a metadata line that already lists other facts. */
export function driftLabel(drift: EditionDrift): string | null {
  if (drift === "moved") return "endret tekst";
  if (drift === "gone") return "utgaven er borte";
  return null;
}

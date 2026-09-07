/**
 * Rules that keep a drill bank honest.
 *
 * The bank is short typing items — a quote, a clause, a single hard word —
 * derived from an edition already in the repo. The one rule that carries the
 * whole design is that every item must occur **verbatim** in the edition it
 * sits beside. Without it the bank drifts into being a second corpus: text
 * nobody sourced, nobody reviewed, and whose rights nobody established. With
 * it, the bank inherits exactly the rights the edition has, because it *is*
 * the edition, cut short.
 *
 * The second rule is the immutability binding. The bank names the edition's
 * contentHash, and this file fails when the two disagree — so an edition
 * cannot be re-cut underneath a bank that still quotes the old text. That is
 * the same mechanism `basedOnContentHash` gives a training edition, for the
 * same reason.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export type DrillKind = "quote" | "phrase" | "word";
export type DrillItem = { id: string; kind: DrillKind; text: string; segmentId: string };
export type DrillBank = {
  id: string;
  workId: string;
  editionId: string;
  editionContentHash: string;
  items: DrillItem[];
};

/**
 * Shortest text worth typing, per kind. A one-character "word" is a keystroke,
 * not a drill; a five-character "quote" is a fragment. The floors exist so the
 * bank cannot be padded to look larger than it is.
 */
export const MIN_LENGTH: Record<DrillKind, number> = { quote: 20, phrase: 12, word: 4 };
const KINDS = new Set<string>(["quote", "phrase", "word"]);

type Edition = {
  id: string;
  workId: string;
  contentHash: string;
  segments: { id: string; text: string }[];
};

/**
 * Every problem with the banks in `dir`, as flat strings. Returns empty when a
 * pack has no bank: a bank is optional, and only ibsen-brand has one today.
 */
export async function drillProblems(dir: string, editions: readonly Edition[]): Promise<string[]> {
  const problems: string[] = [];
  const files = (await readdir(dir)).filter((f) => /^drills\.v\d+\.json$/.test(f)).sort();

  for (const file of files) {
    const version = /^drills\.v(\d+)\.json$/.exec(file)![1];
    let bank: DrillBank;
    try {
      bank = JSON.parse(await readFile(path.join(dir, file), "utf8")) as DrillBank;
    } catch (e) {
      problems.push(`${file}: unreadable — ${(e as Error).message}`);
      continue;
    }

    const edition = editions.find((e) => e.id === bank.editionId);
    if (!edition) {
      problems.push(
        `${file}: editionId ${bank.editionId} names no edition in this pack — ` +
          `a bank must sit beside the edition it is cut from`,
      );
      continue;
    }
    if (!edition.id.endsWith(`.v${version}`)) {
      problems.push(`${file}: v${version} but points at ${edition.id} — the versions must line up`);
    }
    if (bank.workId !== edition.workId) {
      problems.push(`${file}: workId ${bank.workId} differs from the edition's`);
    }
    if (bank.editionContentHash !== edition.contentHash) {
      problems.push(
        `${file}: editionContentHash ${String(bank.editionContentHash).slice(0, 20)}… does not ` +
          `match ${edition.id} (${edition.contentHash.slice(0, 20)}…). The edition was re-cut ` +
          `under the bank — rebuild the candidates and re-check every item before moving the hash.`,
      );
    }

    const segments = new Map(edition.segments.map((s) => [s.id, s.text]));
    const seenIds = new Set<string>();
    const seenText = new Set<string>();
    if (!Array.isArray(bank.items) || bank.items.length === 0) {
      problems.push(`${file}: no items`);
      continue;
    }
    for (const item of bank.items) {
      const where = `${file}/${item.id ?? "?"}`;
      if (!item.id) problems.push(`${file}: an item has no id`);
      else if (seenIds.has(item.id)) problems.push(`${where}: duplicate item id`);
      seenIds.add(item.id);

      if (!KINDS.has(item.kind)) {
        problems.push(`${where}: kind «${item.kind}» is not quote|phrase|word`);
        continue;
      }
      if (typeof item.text !== "string" || item.text.trim() !== item.text) {
        problems.push(`${where}: text is missing or has leading/trailing whitespace`);
        continue;
      }
      if (item.text.length < MIN_LENGTH[item.kind]) {
        problems.push(
          `${where}: ${item.text.length} tegn, under gulvet på ${MIN_LENGTH[item.kind]} for «${item.kind}»`,
        );
      }
      if (seenText.has(item.text)) problems.push(`${where}: same text as an earlier item`);
      seenText.add(item.text);

      const segment = segments.get(item.segmentId);
      if (segment === undefined) {
        problems.push(`${where}: segmentId ${item.segmentId} is not in ${edition.id}`);
        continue;
      }
      // The rule the whole design rests on.
      if (!segment.includes(item.text)) {
        problems.push(
          `${where}: «${item.text.slice(0, 50)}» finnes ikke ordrett i ${edition.id}/${item.segmentId}. ` +
            `Banken er utledet av utgaven — den kan ikke inneholde tekst utgaven ikke har.`,
        );
      }
    }
  }
  return problems;
}

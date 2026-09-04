/**
 * Content registry: assembles ContentPacks and Works from the static JSON
 * files under content/. Adding a pack = adding a folder there and one line
 * in PACK_FILES below.
 */
import type {
  ContentPack,
  TextEdition,
  TextEditionKind,
  TextSegment,
  Work,
} from "../types";

import ibsenBrandPack from "../../../content/ibsen-brand/pack.json";
import ibsenBrandOriginal from "../../../content/ibsen-brand/original.json";
import ibsenBrandTraining from "../../../content/ibsen-brand/training-edition.v1.json";

type OriginalFile = {
  work: Omit<Work, "editions">;
  edition: TextEdition;
};

type PackFiles = {
  pack: ContentPack;
  works: { original: OriginalFile; training: TextEdition }[];
};

const PACK_FILES: PackFiles[] = [
  {
    pack: ibsenBrandPack as ContentPack,
    works: [
      {
        original: ibsenBrandOriginal as OriginalFile,
        training: ibsenBrandTraining as TextEdition,
      },
    ],
  },
];

const packs: ContentPack[] = [];
const works = new Map<string, Work>();
const packWorks = new Map<string, Work[]>();

for (const entry of PACK_FILES) {
  packs.push(entry.pack);
  const list: Work[] = [];
  for (const w of entry.works) {
    const work: Work = {
      ...w.original.work,
      editions: [w.original.edition, w.training],
    };
    works.set(work.id, work);
    list.push(work);
  }
  packWorks.set(entry.pack.id, list);
}

export function listContentPacks(): ContentPack[] {
  return packs.filter((p) => p.status === "active");
}

export function getContentPack(id: string): ContentPack | undefined {
  return packs.find((p) => p.id === id);
}

export function listWorks(packId: string): Work[] {
  return packWorks.get(packId) ?? [];
}

export function getWork(id: string): Work | undefined {
  return works.get(id);
}

export function requireWork(id: string): Work {
  const w = getWork(id);
  if (!w) throw new Error(`Unknown work: ${id}`);
  return w;
}

export function getEdition(work: Work, kind: TextEditionKind): TextEdition | undefined {
  return work.editions.find((e) => e.kind === kind);
}

export function getEditionById(work: Work, id: string): TextEdition | undefined {
  return work.editions.find((e) => e.id === id);
}

/** The edition the user normally types: the training edition for the profile, else the original. */
export function defaultEdition(work: Work, languageProfileId: string): TextEdition {
  const training = work.editions.find(
    (e) => e.kind === "training-edition" && e.languageProfileId === languageProfileId,
  );
  const original = getEdition(work, "original");
  const chosen = training ?? original;
  if (!chosen) throw new Error(`Work ${work.id} has no editions`);
  return chosen;
}

export function getSegment(edition: TextEdition, id: string): TextSegment | undefined {
  return edition.segments.find((s) => s.id === id);
}

export function firstSegment(edition: TextEdition): TextSegment {
  return [...edition.segments].sort((a, b) => a.order - b.order)[0];
}

/** Segments in reading order. */
export function orderedSegments(edition: TextEdition): TextSegment[] {
  return [...edition.segments].sort((a, b) => a.order - b.order);
}

/** Estimated minutes at a calm 35 net wpm. */
export function estimateMinutes(wordCount: number): number {
  return Math.max(1, Math.round(wordCount / 35));
}

/**
 * Split every content pack into the two things the app actually needs:
 *
 *  - `src/domain/content/catalog.generated.ts` — packs, works and edition
 *    headers. No text. Bundled, so naming a work costs no round trip.
 *  - `public/content/editions/<editionId>.<hash12>.json` — the segments, one
 *    file per edition version, fetched on demand.
 *
 * The filename carries the edition's own contentHash, so a file can be cached
 * forever: text that changes gets a new name rather than a new copy under an
 * old one. A rebuild that changes nothing produces byte-identical output,
 * which is what lets `pnpm validate:content` regenerate and compare.
 *
 *   pnpm build:content
 */
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { countWords } from "./lib/text";
import { editionContentHash } from "./lib/hash";
import { loadReviews, publishedReviewFields, type ReviewFile } from "./lib/review";

const contentRoot = path.resolve(process.cwd(), "content");
const assetsDir = path.resolve(process.cwd(), "public", "content", "editions");
const catalogFile = path.resolve(
  process.cwd(),
  "src",
  "domain",
  "content",
  "catalog.generated.ts",
);
const notesFile = path.resolve(
  process.cwd(),
  "src",
  "domain",
  "content",
  "editorial-notes.generated.ts",
);

/** Public path of an edition asset. `/content/...`, not `/public/content/...`. */
export const ASSET_URL_PREFIX = "/content/editions";

type Segment = { id: string; order: number; text: string; wordCount: number };
type RawEdition = {
  id: string;
  workId: string;
  kind: string;
  version: string;
  contentHash: string;
  languageProfileId?: string;
  basedOnEditionId?: string;
  basedOnContentHash?: string;
  editorialNotes?: string[];
  segments: Segment[];
  [key: string]: unknown;
};
type OriginalFile = { work: Record<string, unknown>; edition: RawEdition };

export type BuiltAsset = { file: string; contents: string };
export type BuildOutput = { catalog: string; notes: string; assets: BuiltAsset[] };

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

/** The twelve hex characters that name the file. Enough to be unique; short enough to read. */
function shortHash(contentHash: string): string {
  return contentHash.replace(/^sha256:/, "").slice(0, 12);
}

function assetName(edition: RawEdition): string {
  return `${edition.id}.${shortHash(edition.contentHash)}.json`;
}

/**
 * Metadata, in a fixed key order. Fixed because the output is compared byte
 * for byte; object-literal order is the serialisation here.
 */
function editionMeta(edition: RawEdition, reviews: ReviewFile) {
  const segments = edition.segments;
  const meta: Record<string, unknown> = {
    id: edition.id,
    workId: edition.workId,
    kind: edition.kind,
    version: edition.version,
    contentHash: edition.contentHash,
  };
  if (edition.languageProfileId) meta.languageProfileId = edition.languageProfileId;
  if (edition.basedOnEditionId) meta.basedOnEditionId = edition.basedOnEditionId;
  if (edition.basedOnContentHash) meta.basedOnContentHash = edition.basedOnContentHash;
  // Review state rides in the catalog, never in the asset: the asset's bytes
  // are what its content-hashed filename promises, and a reader's name is not
  // part of the text. See scripts/lib/review.ts.
  for (const [k, v] of Object.entries(publishedReviewFields(reviews[edition.id]))) {
    meta[k] = v;
  }
  meta.segmentCount = segments.length;
  meta.wordCount = segments.reduce((n, s) => n + s.wordCount, 0);
  meta.file = `${ASSET_URL_PREFIX}/${assetName(edition)}`;
  return meta;
}

/**
 * The asset itself carries its id and hash next to the segments. The loader
 * checks both against the catalog before a single character is typed against
 * the text, so a stale or misrouted file is caught rather than typed.
 */
function editionAsset(edition: RawEdition): string {
  return `${JSON.stringify(
    { id: edition.id, contentHash: edition.contentHash, segments: edition.segments },
    null,
    2,
  )}\n`;
}

/** Everything the generator would write, without writing it. */
export async function buildContentAssets(): Promise<BuildOutput> {
  const packDirs = (await readdir(contentRoot, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const packs: unknown[] = [];
  const works: unknown[] = [];
  const assets: BuiltAsset[] = [];
  const notesByEdition: Record<string, string[]> = {};

  for (const pack of packDirs) {
    const dir = path.join(contentRoot, pack);
    packs.push(await readJson(path.join(dir, "pack.json")));
    const reviews = await loadReviews(dir);

    const original = await readJson<OriginalFile>(path.join(dir, "original.json"));
    // Every training edition present, not just the newest: a session saved
    // against v1 must still resolve after v2 lands.
    const trainingFiles = (await readdir(dir))
      .filter((f) => /^training-edition\.v\d+\.json$/.test(f))
      .sort();
    const editions: RawEdition[] = [original.edition];
    for (const f of trainingFiles) {
      editions.push(await readJson<RawEdition>(path.join(dir, f)));
    }

    for (const edition of editions) {
      const recomputed = editionContentHash(edition.segments);
      if (recomputed !== edition.contentHash) {
        throw new Error(
          `${pack}/${edition.id}: contentHash does not match its segments. ` +
            `Rebuild the edition before building assets.`,
        );
      }
      for (const s of edition.segments) {
        if (s.wordCount !== countWords(s.text)) {
          throw new Error(`${pack}/${edition.id}/${s.id}: wordCount is stale.`);
        }
      }
      if (edition.editorialNotes?.length) {
        notesByEdition[edition.id] = edition.editorialNotes;
      }
      assets.push({ file: assetName(edition), contents: editionAsset(edition) });
    }

    works.push({ ...original.work, editions: editions.map((e) => editionMeta(e, reviews)) });
  }

  const catalog = `${[
    "/**",
    " * GENERATED by `pnpm build:content` — do not edit.",
    " *",
    " * Packs, works and edition headers. No segment text: that lives in",
    " * `public/content/editions/` and is fetched per edition, so the bundle does",
    " * not grow with the corpus.",
    " */",
    'import type { ContentPack, Work } from "../types";',
    "",
    `export const CONTENT_PACKS: ContentPack[] = ${JSON.stringify(packs, null, 2)};`,
    "",
    `export const WORKS: Work[] = ${JSON.stringify(works, null, 2)};`,
    "",
  ].join("\n")}`;

  const notes = `${[
    "/**",
    " * GENERATED by `pnpm build:content` — do not edit.",
    " *",
    " * Every normalisation an edition applied, one line each. Read only by the",
    " * About page, which is a server component: a training edition logs a rule",
    " * per change, so this is a page of prose per edition and has no business in",
    " * a bundle every reader downloads.",
    " */",
    `export const EDITORIAL_NOTES: Record<string, string[]> = ${JSON.stringify(notesByEdition, null, 2)};`,
    "",
  ].join("\n")}`;

  return { catalog, notes, assets };
}

async function main() {
  const { catalog, notes, assets } = await buildContentAssets();
  // Rebuilt from empty, so a renamed edition leaves no orphan behind for a
  // stale manifest to keep pointing at.
  await rm(assetsDir, { recursive: true, force: true });
  await mkdir(assetsDir, { recursive: true });
  for (const a of assets) {
    await writeFile(path.join(assetsDir, a.file), a.contents, "utf8");
  }
  await writeFile(catalogFile, catalog, "utf8");
  await writeFile(notesFile, notes, "utf8");
  console.log(
    `build:content — ${assets.length} editions to public/content/editions/, catalog written.`,
  );
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}

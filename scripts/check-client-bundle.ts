/**
 * The acceptance gate for corpus-as-static-assets: no corpus text in any
 * client JavaScript chunk.
 *
 * A bundled corpus is easy to reintroduce by accident — one `import` of a
 * content JSON from a client component and the whole text is back in the
 * download, with nothing visibly wrong. So this greps the built chunks for the
 * text itself rather than trusting the import graph.
 *
 * Editorial notes count as corpus text here: a training edition logs a rule per
 * change, they are read only by the About page, and that page is a server
 * component precisely so they stay out of the bundle.
 *
 * Run after `next build`:  pnpm check:bundle
 */
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { buildContentAssets } from "./build-content-assets";

const chunkRoot = path.resolve(process.cwd(), ".next", "static");

/**
 * A needle a minifier cannot disguise: a long run of plain ASCII letters and
 * spaces, so no escaping (\n, ø) can come between the text and the grep.
 */
function needle(text: string): string | null {
  const runs = text.match(/[A-Za-z ]{30,}/g);
  if (!runs) return null;
  return runs.sort((a, b) => b.length - a.length)[0]!.trim();
}

async function jsFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await jsFiles(full)));
    else if (entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

async function main() {
  try {
    await stat(chunkRoot);
  } catch {
    console.error("check:bundle — .next/static is missing. Run pnpm build first.");
    process.exit(1);
  }

  const { assets, notes } = await buildContentAssets();
  const needles: { what: string; text: string }[] = [];
  for (const asset of assets) {
    const parsed = JSON.parse(asset.contents) as {
      id: string;
      segments: { text: string }[];
    };
    for (const segment of parsed.segments) {
      const n = needle(segment.text);
      if (n) {
        needles.push({ what: `${parsed.id} text`, text: n });
        break;
      }
    }
  }
  const firstNote = (notes.match(/[A-Za-z ]{40,}/g) ?? [])[0];
  if (firstNote) {
    needles.push({ what: "editorial notes", text: firstNote.trim() });
  }
  if (needles.length === 0) {
    console.error("check:bundle — no usable needle found; the check would pass vacuously.");
    process.exit(1);
  }

  const files = await jsFiles(chunkRoot);
  if (files.length === 0) {
    console.error("check:bundle — no client chunks found; the check would pass vacuously.");
    process.exit(1);
  }

  const found: string[] = [];
  for (const file of files) {
    const contents = await readFile(file, "utf8");
    for (const n of needles) {
      if (contents.includes(n.text)) {
        found.push(`${path.relative(process.cwd(), file)} contains ${n.what}`);
      }
    }
  }

  if (found.length) {
    console.error(
      `check:bundle — corpus text is in the client bundle:\n${found.join("\n")}\n\n` +
        `Something imports content/ or a generated notes file from a client component. ` +
        `Text belongs in public/content/editions/, fetched by edition-loader.ts.`,
    );
    process.exit(1);
  }

  console.log(
    `check:bundle ok — ${needles.length} needles absent from ${files.length} client chunks.`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

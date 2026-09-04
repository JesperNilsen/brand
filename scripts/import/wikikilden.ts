/**
 * Fetch a chapter/page from Wikikilden (no.wikisource.org), archive the raw
 * HTML verbatim under content/<pack>/source/wikikilden/ and extract its
 * paragraph text into a plain-text file: one paragraph per line, paragraphs
 * separated by a blank line (the same convention build-original.ts expects
 * from runeberg.ts).
 *
 * Wikikilden's ProofreadPage rendering wraps real content in more structure
 * than Runeberg's OCR text: a chapter-nav "header" transclusion (title,
 * author, prev/next links) sits as a sibling of the actual paragraphs, and
 * templatestyles <style> blocks and page-number markers are interleaved
 * between them. A plain "strip all tags" regex pass would leak that
 * metadata/CSS into the extracted text (verified against archived Kielland
 * and Hamsun pages), so this parses the HTML with jsdom instead: it removes
 * <style> blocks, `div[itemscope]` header/footer transclusions,
 * `span.pagenum` markers and footnote-reference markers, then reads every
 * remaining <p>/<dl>/<blockquote> in document order. Text is verbatim: only
 * whitespace is normalised (line wraps and runs of spaces collapsed to one
 * space, NFC); no spelling, punctuation or wording is touched.
 *
 * Replayable: with --offline it re-extracts from the archived HTML without
 * touching the network.
 *
 *   pnpm tsx scripts/import/wikikilden.ts --pack hamsun-markens-groede \
 *     --title "Markens_Grøde/1/01" --slug markens-groede-1-01
 *   pnpm tsx scripts/import/wikikilden.ts --pack hamsun-markens-groede \
 *     --title "Markens_Grøde/1/01" --slug markens-groede-1-01 --offline
 */
import { JSDOM } from "jsdom";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const USER_AGENT = "brand-corpus-import/0.1 (personal project; contact via repo)";

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing --${name}`);
}

/** Extract paragraph texts from a Wikikilden action=render HTML fragment, in document order. */
export function extractWikikildenParagraphs(html: string): string[] {
  const dom = new JSDOM(`<div id="wikikilden-root">${html}</div>`);
  const doc = dom.window.document;
  const root =
    doc.querySelector(".prp-pages-output") ??
    doc.querySelector(".mw-parser-output") ??
    doc.getElementById("wikikilden-root")!;

  // templatestyles CSS source text lives as a text node inside <style> and
  // leaks into textContent unless the element itself is removed first.
  root.querySelectorAll("style").forEach((el: Element) => el.remove());
  // Chapter-nav header/footer transclusions: title, author, bind, prev/next.
  root.querySelectorAll("div[itemscope]").forEach((el: Element) => el.remove());
  // Page-number markers: empty spans carrying the printed page number in a
  // title attribute, not in text content, but removed defensively.
  root.querySelectorAll("span.pagenum").forEach((el: Element) => el.remove());
  // Footnote reference markers / reference lists, where present.
  root.querySelectorAll("sup.reference, ol.references").forEach((el: Element) => el.remove());

  const paragraphs: string[] = [];
  root.querySelectorAll("p, dl, blockquote").forEach((el: Element) => {
    // Skip nested matches (e.g. a <p> inside a <blockquote>) so a paragraph
    // is not emitted twice.
    if (el.closest("p, dl, blockquote") !== el) return;
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    if (text) paragraphs.push(text.normalize("NFC"));
  });
  return paragraphs;
}

async function main() {
  const pack = arg("pack");
  const title = arg("title"); // Wikikilden page title, e.g. "Markens_Grøde/1/01"
  const slug = arg("slug"); // filename-safe id for the archived HTML, e.g. "markens-groede-1-01"
  const outName = arg("out", slug); // basename (no extension) for the extracted .txt
  const offline = process.argv.includes("--offline");
  const dir = path.resolve(process.cwd(), "content", pack, "source", "wikikilden");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${slug}.html`);

  let html: string;
  if (offline) {
    html = await readFile(file, "utf8");
  } else {
    const url = `https://no.wikisource.org/w/index.php?title=${encodeURIComponent(title)}&action=render`;
    const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    html = await res.text();
    await writeFile(file, html, "utf8");
    process.stdout.write(`archived ${url}\n`);
  }

  const paragraphs = extractWikikildenParagraphs(html);
  const out = path.resolve(process.cwd(), "content", pack, "source", `${outName}.txt`);
  await writeFile(out, paragraphs.join("\n\n") + "\n", "utf8");
  const words = paragraphs.reduce((n, p) => n + p.split(/\s+/).filter(Boolean).length, 0);
  process.stdout.write(`wrote ${path.relative(process.cwd(), out)} (${paragraphs.length} paragraphs, ${words} words)\n`);
}

if (process.argv[1] && process.argv[1].endsWith("wikikilden.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

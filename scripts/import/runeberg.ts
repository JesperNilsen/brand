/**
 * Fetch a page range from Project Runeberg, archive the raw HTML under
 * content/<pack>/source/runeberg/ and extract the OCR text (the block between
 * `<!-- mode=normal -->` and `<!-- NEWIMAGE2 -->`) into one text file with
 * `=== NNNN` page markers. Replayable: with --offline it re-extracts from the
 * archived HTML without touching the network.
 *
 *   pnpm tsx scripts/import/runeberg.ts --pack ibsen-brand --work brand --from 3 --to 14
 *   pnpm tsx scripts/import/runeberg.ts --pack ibsen-brand --work brand --from 3 --to 14 --offline
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const USER_AGENT = "brand-corpus-import/0.1 (personal project; contact via repo)";

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing --${name}`);
}

export function extractRunebergText(html: string): string {
  const start = html.indexOf("<!-- mode=normal -->");
  const end = html.indexOf("<!-- NEWIMAGE2 -->");
  if (start === -1 || end === -1) return "";
  return html
    .slice(start + "<!-- mode=normal -->".length, end)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .split("\n")
    .map((l) => l.replace(/\s+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function main() {
  const pack = arg("pack");
  const work = arg("work");
  const from = Number(arg("from"));
  const to = Number(arg("to"));
  const offline = process.argv.includes("--offline");
  const root = path.resolve(process.cwd(), "content", pack, "source", "runeberg");
  await mkdir(root, { recursive: true });

  const chunks: string[] = [];
  for (let p = from; p <= to; p += 1) {
    const page = String(p).padStart(4, "0");
    const file = path.join(root, `${work}-${page}.html`);
    let html: string;
    if (offline) {
      html = await readFile(file, "utf8");
    } else {
      const url = `https://runeberg.org/${work}/${page}.html`;
      const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
      if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
      html = await res.text();
      await writeFile(file, html, "utf8");
      process.stdout.write(`archived ${url}\n`);
    }
    chunks.push(`=== ${page}\n${extractRunebergText(html)}`);
  }
  const out = path.join(root, "..", `runeberg-${work}-${String(from).padStart(4, "0")}-${String(to).padStart(4, "0")}.txt`);
  await writeFile(out, chunks.join("\n\n") + "\n", "utf8");
  process.stdout.write(`wrote ${path.relative(process.cwd(), out)}\n`);
}

if (process.argv[1] && process.argv[1].endsWith("runeberg.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

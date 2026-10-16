import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractWikikildenParagraphs } from "../../scripts/import/wikikilden";

const PAGENUM = (n: number) => `<span><span class="pagenum ws-noexport" id="${n}" title="Side:X.djvu/${n}"></span></span>`;
const SEPARATOR = `<div style="text-align:center;"><sup>*</sup></div>`;

describe("extractWikikildenParagraphs", () => {
  it("joins a page-opening line that ProofreadPage left outside its <p>", () => {
    const html = `<div class="mw-parser-output">${SEPARATOR} ${PAGENUM(4)}Jeg taler helst med Børn; thi om dem tør man dog
<p>haabe, at de kan blive Fornuft-Væsener.</p></div>`;
    expect(extractWikikildenParagraphs(html)).toEqual([
      "Jeg taler helst med Børn; thi om dem tør man dog haabe, at de kan blive Fornuft-Væsener.",
    ]);
  });

  it("gives an orphan run with no following <p> a paragraph of its own", () => {
    const html = `<div class="mw-parser-output"><p>Først.</p>${SEPARATOR}Sidst <i>her</i>.</div>`;
    expect(extractWikikildenParagraphs(html)).toEqual(["Først.", "Sidst her."]);
  });

  it("leaves ordinary pages untouched", () => {
    const html = `<div class="mw-parser-output"><p>En.</p>\n${PAGENUM(2)}<p>To.</p></div>`;
    expect(extractWikikildenParagraphs(html)).toEqual(["En.", "To."]);
  });

  // The fix must not move a single word in the packs already imported from
  // Wikikilden: re-extracting their archived HTML gives their source text back.
  const content = path.resolve(__dirname, "../../content");
  const archived = readdirSync(content).flatMap((pack) => {
    const dir = path.join(content, pack, "source", "wikikilden");
    try {
      return readdirSync(dir)
        .filter((f) => f.endsWith(".html"))
        .map((f) => ({ pack, slug: f.replace(/\.html$/, ""), dir }));
    } catch {
      return [];
    }
  });

  it.each(archived.filter((a) => a.pack !== "kierkegaard-enten-eller").map((a) => [`${a.pack}/${a.slug}`, a] as const))(
    "re-extracts %s word for word",
    (_, { pack, slug, dir }) => {
      const txt = path.join(content, pack, "source", `${slug}.txt`);
      let expected: string;
      try {
        expected = readFileSync(txt, "utf8");
      } catch {
        return; // archived under another .txt name (--out); covered by check:originals
      }
      const got = extractWikikildenParagraphs(readFileSync(path.join(dir, `${slug}.html`), "utf8"));
      expect(got.join("\n\n") + "\n").toBe(expected);
    },
  );
});

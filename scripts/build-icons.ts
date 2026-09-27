/**
 * Write BRAND's icon set from the mark's one geometry source,
 * `src/lib/brand-mark.ts`. Run by hand when the mark or the tagline changes;
 * the outputs are committed and `check:all` does not run this.
 *
 *   pnpm build:icons
 *
 * Writes:
 *   src/app/icon.svg              favicon for Chromium and Firefox, with a dark swap
 *   src/app/favicon.ico           16/32/48, for browsers that skip the SVG
 *   src/app/apple-icon.png        180×180 home-screen icon
 *   public/icon-192.png           manifest icons
 *   public/icon-512.png
 *   src/app/opengraph-image.png   1200×630 link preview, and its .alt.txt
 *
 * The OG image is a screenshot of a small HTML page rendered in Playwright's
 * Chromium, because it sets the wordmark and tagline in Literata and sharp
 * cannot lay out text in a web font. That fetches Literata from Google Fonts
 * at generation time only; the committed PNG makes no request (T-22).
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { chromium } from "@playwright/test";
import { BRAND_TAGLINE, MARK_CUTS, markSvgDocument } from "../src/lib/brand-mark";

const root = process.cwd();
const out = (...p: string[]) => path.resolve(root, ...p);

// Light and dark `--ink` and light `--paper` from src/app/globals.css.
const INK = "#221f1b";
const INK_DARK = "#e9e3d8";
const INK_MUTED = "#625c53";
const PAPER = "#f7f3ec";
const RULE = "#e3dcd0";

async function png(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

/** An ICO container holding PNG images, which every current browser reads. */
function ico(images: { size: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const dir = Buffer.alloc(16 * images.length);
  let offset = header.length + dir.length;
  images.forEach(({ size, data }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o);
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(data.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  return Buffer.concat([header, dir, ...images.map((i) => i.data)]);
}

async function main() {
  const heavy = MARK_CUTS.heavy;
  const standard = MARK_CUTS.standard;

  // Transparent, ink on whatever the tab bar is, swapped for dark schemes.
  await writeFile(out("src/app/icon.svg"), markSvgDocument(heavy, INK, { darkInk: INK_DARK }) + "\n");

  // Browsers that skip the SVG fall back to the ICO, which cannot swap colours
  // by scheme, so it carries its own paper tile: legible on a light and a dark
  // tab bar alike.
  const icoImages = await Promise.all(
    [16, 32, 48].map(async (size) => ({
      size,
      data: await png(markSvgDocument(heavy, INK, { background: PAPER, radius: 4, size })),
    })),
  );
  await writeFile(out("src/app/favicon.ico"), ico(icoImages));

  // Platforms mask these to their own shape, so the ground is square and the
  // mark is inset to stay clear of the rounding.
  const tile = (size: number) => markSvgDocument(standard, INK, { background: PAPER, size, inset: 3 });
  await writeFile(out("src/app/apple-icon.png"), await png(tile(180)));
  await writeFile(out("public/icon-192.png"), await png(tile(192)));
  await writeFile(out("public/icon-512.png"), await png(tile(512)));

  const mark = markSvgDocument(standard, INK, { size: 256 });
  const html = `<!doctype html><html lang="nb"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,400..600&display=block">
<style>
  html,body{margin:0;width:1200px;height:630px;background:${PAPER};color:${INK}}
  body{display:flex;align-items:center;gap:64px;padding:0 104px;box-sizing:border-box;
       font-family:Literata,serif;font-optical-sizing:auto}
  svg{flex:none}
  .wordmark{font-size:108px;font-weight:500;letter-spacing:0.18em;line-height:1;margin:0 0 28px}
  .rule{height:1px;background:${RULE};margin:0 0 28px}
  .tagline{font-size:34px;line-height:1.35;color:${INK_MUTED};margin:0;max-width:600px}
</style></head><body>
${mark}
<div><p class="wordmark">BRAND</p><div class="rule"></div><p class="tagline">${BRAND_TAGLINE}</p></div>
</body></html>`;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "networkidle" });
    // `document.fonts.check` answers true when no face matches at all, so ask
    // for a Literata face that actually finished loading.
    const family = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].some(
        (f) => f.family.replace(/"/g, "") === "Literata" && f.status === "loaded",
      );
    });
    if (!family) throw new Error("Literata did not load; refusing to write an OG image in a fallback face");
    await writeFile(out("src/app/opengraph-image.png"), await page.screenshot({ type: "png" }));
    await writeFile(
      out("src/app/opengraph-image.alt.txt"),
      `BRAND: monogrammet B ved siden av ordet BRAND og slagordet «${BRAND_TAGLINE}»`,
    );
  } finally {
    await browser.close();
  }

  console.log("Wrote icon.svg, favicon.ico, apple-icon.png, icon-192.png, icon-512.png, opengraph-image.png + alt");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * The geometry of BRAND's mark: a monogram B on a 32-unit grid, drawn as three
 * strokes (stem, upper bowl, lower bowl) with butt caps. See D19.
 *
 * One source for every rendering of the mark. `BrandMark` draws it in the page,
 * and `scripts/build-icons.ts` writes the favicon set from it. Change a number
 * here and rerun that script; nothing else holds a copy.
 *
 * Two cuts, because one stroke weight cannot serve both ends of the size range.
 * At 16–32 px the standard cut reads too light, so small sizes get a heavier
 * stroke with the bowls redrawn to fit it. Each cut is shifted onto the grid's
 * centre by its own measured ink bounds, so a favicon sits in the middle of its
 * square. The bounds are written next to each shift; the bottom edge is the
 * lower bowl's closing bar, which reaches past the stem's butt end.
 */

/**
 * The one-line description that goes with the mark: the page description, the
 * manifest, and the text in the OG image. Change it and rerun
 * `pnpm build:icons`, or the link preview goes on saying the old one (T-22).
 */
export const BRAND_TAGLINE = "Skriv deg inn i god norsk prosa — med ro, rytme og målbar fremgang.";

export type MarkCut = {
  /** Stroke width in grid units. */
  strokeWidth: number;
  /** Shift that centres the cut's ink on the 32-unit square. */
  dx: number;
  dy: number;
  /** Stem, upper bowl, lower bowl. */
  paths: readonly [string, string, string];
};

export const MARK_CUTS = {
  /** 33 px and up: the header lockup at large sizes, /om, the OG image. */
  standard: {
    strokeWidth: 3.7,
    // Ink spans x 5.75–25.05 (stem edge to the lower bowl's outer edge) and
    // y 3.85–29.85 (upper bar's top edge to the lower bar's bottom edge).
    dx: 0.6,
    dy: -0.85,
    paths: [
      "M7.6 4 V28",
      "M5.75 5.7 H16 A5.15 5.15 0 0 1 16 16 H5.75",
      "M5.75 16 H17.2 A6 6 0 0 1 17.2 28 H5.75",
    ],
  },
  /** Up to 32 px: favicons and the header lockup. */
  heavy: {
    strokeWidth: 4.6,
    // Ink spans x 5.2–24.55 and y 4.0–30.0.
    dx: 1.125,
    dy: -1,
    paths: [
      "M7.5 4 V28",
      "M5.2 6.3 H15.4 A5 5 0 0 1 15.4 16 H5.2",
      "M5.2 16 H16.4 A5.85 5.85 0 0 1 16.4 27.7 H5.2",
    ],
  },
} as const satisfies Record<string, MarkCut>;

/** The largest rendered size, in CSS px, that uses the heavy cut. */
export const HEAVY_CUT_MAX_PX = 32;

export function cutForSize(size: number): MarkCut {
  return size <= HEAVY_CUT_MAX_PX ? MARK_CUTS.heavy : MARK_CUTS.standard;
}

/**
 * The mark as a standalone SVG document, for the icon files. `ink` is the
 * stroke colour; `darkInk`, when given, is swapped in under
 * `prefers-color-scheme: dark` (Chromium and Firefox honour it in a favicon).
 */
export function markSvgDocument(
  cut: MarkCut,
  ink: string,
  opts: {
    darkInk?: string;
    background?: string;
    /** Corner radius of the background, in grid units. */
    radius?: number;
    size?: number;
    inset?: number;
  } = {},
): string {
  const { darkInk, background, radius = 0, size, inset = 0 } = opts;
  // `inset` shrinks the mark inside its square, in grid units per side, for
  // tiles whose platform crops or rounds the corners.
  const view = `${-inset} ${-inset} ${32 + 2 * inset} ${32 + 2 * inset}`;
  const dims = size ? ` width="${size}" height="${size}"` : "";
  const style = darkInk
    ? `<style>@media (prefers-color-scheme: dark){svg{stroke:${darkInk}}}</style>`
    : "";
  const ground = background
    ? `<rect x="${-inset}" y="${-inset}" width="${32 + 2 * inset}" height="${32 + 2 * inset}" rx="${radius}" fill="${background}" stroke="none"/>`
    : "";
  const strokes = cut.paths.map((d) => `<path d="${d}"/>`).join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view}"${dims} fill="none" stroke="${ink}" stroke-width="${cut.strokeWidth}" stroke-linecap="butt">` +
    style +
    ground +
    `<g transform="translate(${cut.dx} ${cut.dy})">${strokes}</g>` +
    `</svg>`
  );
}

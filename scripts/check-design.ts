/**
 * Fails when a numeric claim in DESIGN.md disagrees with `src/app/globals.css`
 * or with the components the document describes.
 *
 * DESIGN.md was written on 2026-09-06 and three of its claims were false inside
 * the same commit that introduced them: the type scale was declared adopted
 * while `--text-*` was referenced zero times in TSX, a 44px touch-target
 * minimum was stated as a requirement while 23 of 31 targets failed it, and the
 * count of how often the unlayered-rule bug had bitten was stale. A manual
 * audit caught them; nothing in the repo did. DESIGN.md was — and until this
 * file existed remained — the only document here whose correctness no gate
 * checked.
 *
 * The failure mode is specific and worth naming, because it is the reason a
 * comment is not enough. `.recedes` carried `opacity: 0.22` for months under a
 * source comment asserting the controls "stay legible"; composited, the meta
 * text inside it sat at 1.36:1. The prose was not merely out of date, it was
 * confidently wrong, and the next reader had no way to tell.
 *
 * So this gate does not scrape Norwegian prose. DESIGN.md carries HTML comment
 * markers — invisible in the rendered document — that declare each claim in a
 * form a machine can check, and this script recomputes every one of them from
 * source:
 *
 *   <!-- check:design role token=--ink-faint role=text -->
 *   <!-- check:design contrast token=--ink-faint theme=light vs=paper ratio=4.56 -->
 *   <!-- check:design opacity rule=recedes theme=light token=--ink-muted value=0.7 ratio=3.13 -->
 *   <!-- check:design adoption status=pending adhoc=17 files=7 tokens=0 -->
 *
 * A claim with no marker is not gated. That is deliberate: the document also
 * states historical ratios for values no longer in the tree (`--ink-faint` at
 * 2.75:1, `.recedes` at 1.36:1), and those are statements about the past that
 * no amount of reading the current CSS can confirm or refute.
 *
 * Prior art is `ppr/scripts/check_prose_sync.py` (queue Q-001/Q-002 there):
 * same problem — prose asserting numbers that drift silently from the data —
 * and the same shape of answer. Derive the number, pin it, fail on
 * disagreement. The deliverable is the gate, not the number edit.
 *
 * The self-test `scripts/check-design_test.ts` runs before this script and
 * proves it bites, by mutating real files in a temp copy of the tree. A gate
 * that cannot be shown to fail is not a gate.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const CSS = join(ROOT, "src/app/globals.css");
const DOC = join(ROOT, "DESIGN.md");

/** WCAG 2.1 floors. `text` is 1.4.3; `boundary` is 1.4.11 (non-text contrast). */
const FLOORS: Record<string, number> = { text: 4.5, boundary: 3 };
/** A pinned ratio may drift this far from the computed one before it is a lie. */
const RATIO_TOLERANCE = 0.05;

const errors: string[] = [];
const fail = (msg: string) => errors.push(msg);

/* ------------------------------------------------------------------ colour */

type Rgb = [number, number, number];

function parseHex(hex: string): Rgb {
  const h = hex.trim().replace(/^#/, "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

/** WCAG 2.1 relative luminance. Deliberately not a dependency — it is six lines. */
function luminance([r, g, b]: Rgb): number {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Source-over compositing of an opaque colour drawn at `alpha` onto `bg`. */
function composite(fg: Rgb, bg: Rgb, alpha: number): Rgb {
  return fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha))) as Rgb;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/* --------------------------------------------------------------------- css */

/* Comments are stripped before anything is parsed. Not tidiness: the file's
   header comment contains the literal `[data-theme="dark"]` while explaining
   the theming, and a plain indexOf for that prelude finds the prose first and
   then reads the `:root` block as if it were the dark one — which makes every
   token "disagree" between the two dark blocks and every dark ratio wrong. The
   opacity lookup has the same exposure: the rules this gate reads are the two
   in the file that carry long comments about their own measured ratios. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Body of the first block whose prelude ends with `prelude`, brace-matched. */
function blockBody(css: string, prelude: string, from = 0): string | null {
  const at = css.indexOf(prelude, from);
  if (at === -1) return null;
  const open = css.indexOf("{", at + prelude.length);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return css.slice(open + 1, i);
  }
  return null;
}

function declarations(body: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)) {
    out.set(m[1], m[2].trim());
  }
  return out;
}

const css = stripComments(readFileSync(CSS, "utf8"));

const lightBody = blockBody(css, ":root");
const darkBody = blockBody(css, '[data-theme="dark"]');
const mediaBody = blockBody(css, "@media (prefers-color-scheme: dark)");
const mediaRootBody = mediaBody === null ? null : blockBody(mediaBody, ":root:not(");

if (lightBody === null) fail("globals.css: no `:root` block found.");
if (darkBody === null) fail('globals.css: no `[data-theme="dark"]` block found.');
if (mediaRootBody === null) {
  fail("globals.css: no `:root:not([data-theme=\"light\"])` inside the prefers-color-scheme block.");
}
if (lightBody === null || darkBody === null || mediaRootBody === null) report();

const light = declarations(lightBody!);
const darkExplicit = declarations(darkBody!);
const darkMedia = declarations(mediaRootBody!);

/** A colour token is one whose light value is a literal hex. */
const isHex = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);
const colourTokens = [...light].filter(([, v]) => isHex(v)).map(([k]) => k);

/* Claim: the three token blocks agree. The two dark sources must be identical
   — a reader who set the theme explicitly and one who let the system choose
   must see the same page — and all three must define the same token set, so a
   token added to one is never silently missing from another. */
for (const [name, block] of [
  ["[data-theme=\"dark\"]", darkExplicit],
  ["@media (prefers-color-scheme: dark)", darkMedia],
] as const) {
  for (const token of colourTokens) {
    if (!block.has(token)) fail(`${token} is defined in :root but missing from ${name}.`);
  }
  for (const token of block.keys()) {
    if (isHex(block.get(token)!) && !light.has(token)) {
      fail(`${token} is defined in ${name} but missing from :root.`);
    }
  }
}
for (const token of darkExplicit.keys()) {
  const a = darkExplicit.get(token)!;
  const b = darkMedia.get(token);
  if (b !== undefined && a !== b) {
    fail(
      `${token} disagrees between the two dark blocks: ` +
        `[data-theme="dark"] says ${a}, the prefers-color-scheme block says ${b}.`,
    );
  }
}

const themes: Record<string, Map<string, string>> = { light, dark: darkExplicit };

function tokenRgb(theme: string, token: string): Rgb | null {
  const v = themes[theme]?.get(token);
  return v && isHex(v) ? parseHex(v) : null;
}

/** `opacity:` of the rule whose prelude ends with `prelude`. */
function opacityOf(prelude: string): number | null {
  const body = blockBody(css, prelude);
  const m = body?.match(/(?:^|[;{\s])opacity\s*:\s*([0-9.]+)\s*;/);
  return m ? Number(m[1]) : null;
}

/* ------------------------------------------------------------------ markers */

type Marker = { kind: string; fields: Record<string, string>; line: number };

function markers(doc: string): Marker[] {
  const out: Marker[] = [];
  const lines = doc.split("\n");
  lines.forEach((text, i) => {
    for (const m of text.matchAll(/<!--\s*check:design\s+(\S+)\s+(.*?)-->/g)) {
      const fields: Record<string, string> = {};
      for (const f of m[2].matchAll(/([\w-]+)=(\S+)/g)) fields[f[1]] = f[2];
      out.push({ kind: m[1], fields, line: i + 1 });
    }
  });
  return out;
}

const doc = readFileSync(DOC, "utf8");
const all = markers(doc);
const at = (m: Marker) => `DESIGN.md:${m.line}`;

/* Claim: a token the document says carries readable text meets 4.5:1, and a
   token it says identifies a control meets 3:1 — against BOTH grounds it can
   sit on, in BOTH themes. Both grounds, not either: `--surface` is the card and
   button fill and `--paper` is the page, and text of a given role lands on
   whichever the component it is in happens to use. */
const roleMarkers = all.filter((m) => m.kind === "role");
if (roleMarkers.length === 0) fail("DESIGN.md declares no `check:design role` markers.");
for (const m of roleMarkers) {
  const token = m.fields.token;
  const floor = FLOORS[m.fields.role];
  if (!token || floor === undefined) {
    fail(`${at(m)}: role marker needs token=--x and role=${Object.keys(FLOORS).join("|")}.`);
    continue;
  }
  for (const theme of ["light", "dark"]) {
    const fg = tokenRgb(theme, token);
    if (!fg) {
      fail(`${at(m)}: ${token} has no hex value in the ${theme} block.`);
      continue;
    }
    for (const ground of ["--paper", "--surface"]) {
      const bg = tokenRgb(theme, ground)!;
      const r = contrast(fg, bg);
      if (r < floor) {
        fail(
          `${token} (${m.fields.role}, ${theme}) is ${round2(r)}:1 against ${ground}, ` +
            `below the ${floor}:1 floor DESIGN.md states for that role.`,
        );
      }
    }
  }
}

/* Claim: a ratio written in the document is the ratio the tokens produce. */
for (const m of all.filter((x) => x.kind === "contrast")) {
  const { token, theme, vs } = m.fields;
  const claimed = Number(m.fields.ratio);
  const fg = tokenRgb(theme, token);
  const bg = tokenRgb(theme, `--${vs}`);
  if (!fg || !bg || !Number.isFinite(claimed)) {
    fail(`${at(m)}: contrast marker needs token, theme, vs=paper|surface and a numeric ratio.`);
    continue;
  }
  const actual = round2(contrast(fg, bg));
  if (Math.abs(actual - claimed) > RATIO_TOLERANCE) {
    fail(
      `${at(m)}: DESIGN.md states ${token} at ${claimed}:1 against --${vs} (${theme}); ` +
        `the tokens produce ${actual}:1.`,
    );
  }
}

/* Claim: the composited opacity rules leave their worst text readable at the
   ratio the document states. This is the claim that was false for months
   behind a source comment asserting the opposite, so it is the one that most
   needs a machine watching it: the number cannot be seen, only computed. */
for (const m of all.filter((x) => x.kind === "opacity")) {
  const { selector, theme, token } = m.fields;
  const claimedValue = Number(m.fields.value);
  const claimedRatio = Number(m.fields.ratio);
  if (!selector || !token || !Number.isFinite(claimedValue) || !Number.isFinite(claimedRatio)) {
    fail(`${at(m)}: opacity marker needs selector, theme, token, value and ratio.`);
    continue;
  }
  const prelude = selector.replace(/~/g, " ");
  const actualValue = opacityOf(prelude);
  if (actualValue === null) {
    fail(`${at(m)}: no \`opacity\` declaration found for \`${prelude}\` in globals.css.`);
    continue;
  }
  if (actualValue !== claimedValue) {
    fail(
      `${at(m)}: DESIGN.md states \`${prelude}\` at opacity ${claimedValue}; ` +
        `globals.css says ${actualValue}.`,
    );
  }
  const fg = tokenRgb(theme, token);
  const bg = tokenRgb(theme, "--paper");
  if (!fg || !bg) {
    fail(`${at(m)}: ${token} has no hex value in the ${theme} block.`);
    continue;
  }
  const actualRatio = round2(contrast(composite(fg, bg, actualValue), bg));
  if (Math.abs(actualRatio - claimedRatio) > RATIO_TOLERANCE) {
    fail(
      `${at(m)}: DESIGN.md states ${token} inside \`${prelude}\` at ${claimedRatio}:1 (${theme}); ` +
        `${token} composited at ${actualValue} over --paper gives ${actualRatio}:1.`,
    );
  }
}

/* ---------------------------------------------------------------- adoption */

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsxFiles(full));
    else if (full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

const ADHOC = /\btext-(?:3xl|2xl|xl|lg)\b/g;
/**
 * A use of the scale, in either form it can take.
 *
 * `@theme inline` turns each `--text-*` token into a utility of the same name,
 * so a component that adopts the scale writes `text-heading` and never names
 * the variable. Counting only `--text-*` would therefore have read zero
 * through a completed migration — the gate would have been watching for
 * something the finished state does not contain.
 */
const TOKEN_REF = /\btext-(?:title|heading|section|lead|body|meta|label)\b|--text-[a-z-]+/g;

let adhoc = 0;
let adhocFiles = 0;
let tokenRefs = 0;
for (const file of tsxFiles(join(ROOT, "src"))) {
  const text = readFileSync(file, "utf8");
  const hits = text.match(ADHOC)?.length ?? 0;
  adhoc += hits;
  if (hits > 0) adhocFiles++;
  tokenRefs += text.match(TOKEN_REF)?.length ?? 0;
}

/* Claim: the document's account of the T-14 migration matches the tree, in
   both directions. A doc that understates progress is as misleading as one
   that overstates it — the next reader plans around it either way. */
const adoption = all.find((m) => m.kind === "adoption");
if (!adoption) {
  fail("DESIGN.md declares no `check:design adoption` marker for the type scale.");
} else {
  const counted = { adhoc, files: adhocFiles, tokens: tokenRefs };
  for (const key of ["adhoc", "files", "tokens"] as const) {
    const claimed = Number(adoption.fields[key]);
    if (!Number.isFinite(claimed)) {
      fail(`${at(adoption)}: adoption marker needs a numeric ${key}=.`);
    } else if (claimed !== counted[key]) {
      fail(
        `${at(adoption)}: DESIGN.md states ${key}=${claimed} for the type scale; ` +
          `src/**/*.tsx has ${counted[key]}.`,
      );
    }
  }
  const status = adoption.fields.status;
  if (status !== "pending" && status !== "done") {
    fail(`${at(adoption)}: adoption marker needs status=pending|done.`);
  } else if (status === "pending" && adhoc === 0 && tokenRefs > 0) {
    fail(
      `${at(adoption)}: DESIGN.md still says the type-scale migration (T-14) is ` +
        `pending, but no ad-hoc size utility is left and --text-* is referenced ` +
        `${tokenRefs} time(s). The migration is done; say so.`,
    );
  } else if (status === "done" && adhoc > 0) {
    fail(
      `${at(adoption)}: DESIGN.md says the type-scale migration (T-14) is done, ` +
        `but ${adhoc} ad-hoc size utilit(y/ies) remain in ${adhocFiles} file(s).`,
    );
  }
}

/* ------------------------------------------------------------------ report */

function report(): never {
  if (errors.length === 0) {
    console.log(
      `check-design: ${all.length} claim marker(s) in DESIGN.md agree with source ` +
        `(${colourTokens.length} colour tokens, ${adhoc} ad-hoc size utilities).`,
    );
    process.exit(0);
  }
  console.error("DESIGN.md disagrees with the code it describes:\n");
  for (const e of errors) console.error(`  ${e}`);
  console.error(
    [
      "",
      "Every number above is recomputed from src/app/globals.css and src/**/*.tsx.",
      "Fix the code if the document is right, or the document if the code is —",
      "but do not lower a contrast floor to make this pass. DESIGN.md's rule is",
      "that you compute the ratio before choosing the value, not after.",
      "",
      "Claims are declared with HTML markers, e.g.",
      "  <!-- check:design contrast token=--ink-faint theme=light vs=paper ratio=4.56 -->",
      "See the header of scripts/check-design.ts for the full grammar.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

report();

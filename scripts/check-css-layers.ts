/**
 * Fails when a class selector in the project's CSS sits outside `@layer`.
 *
 * Tailwind v4 puts its utilities in cascade layers. An unlayered rule beats
 * every layered utility regardless of specificity, so `.btn { border-color: … }`
 * written outside a layer silently defeats `border-accent` wherever the two are
 * combined. The failure is invisible: the element renders, it is just the wrong
 * colour, and no tool complains.
 *
 * This repo has been bitten twice. `a8386cb` fixed one instance by hand (the
 * selected text form and time limit were impossible to see), and `0595a00`
 * fixed the class of bug by moving the component rules into
 * `@layer components`. A comment in the file was the only thing keeping them
 * there. Six phases of the long plan add CSS and four are meant to run
 * unattended, so the rule is enforced here instead.
 *
 * Deliberately unlayered, and therefore allowed: the typing surface. Its rules
 * are never combined with a conflicting utility, and moving them into a layer
 * would make them lose to utilities applied on the same elements.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SEARCH_DIRS = ["src"];

/** Prefixes and exact names permitted outside a layer. Each is a decision. */
const ALLOWED_PREFIXES = ["typing-", "ch-"];
const ALLOWED_EXACT = new Set([
  "recedes",
  // Status modifiers emitted by TypingSurface. They only ever appear compounded
  // with .typing-surface, so they belong to the same deliberately unlayered
  // block as the rules they qualify.
  "is-idle",
  "is-active",
  "is-done",
]);

type Violation = { file: string; line: number; className: string; selector: string };

function cssFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...cssFiles(full));
    else if (full.endsWith(".css")) out.push(full);
  }
  return out;
}

/** Blank out comments but keep every byte offset and newline intact. */
function maskComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

function isAllowed(name: string): boolean {
  return ALLOWED_EXACT.has(name) || ALLOWED_PREFIXES.some((p) => name.startsWith(p));
}

function check(file: string, css: string): Violation[] {
  const masked = maskComments(css);
  const stack: Array<"layer" | "keyframes" | "other"> = [];
  const violations: Violation[] = [];
  let preludeStart = 0;

  for (let i = 0; i < masked.length; i += 1) {
    const ch = masked[i];
    if (ch === "{") {
      const raw = masked.slice(preludeStart, i);
      const prelude = raw.trim();
      const inLayer = stack.includes("layer");
      const inKeyframes = stack.includes("keyframes");

      if (/^@layer\b/.test(prelude)) {
        stack.push("layer");
      } else if (/^@keyframes\b/.test(prelude)) {
        stack.push("keyframes");
      } else if (prelude.startsWith("@")) {
        // @media / @supports / @theme inherit whatever they are nested in.
        stack.push(inLayer ? "layer" : "other");
      } else {
        stack.push(inLayer ? "layer" : "other");
        if (!inLayer && !inKeyframes) {
          const offset = preludeStart + (raw.length - raw.trimStart().length);
          const line = masked.slice(0, offset).split("\n").length;
          for (const m of prelude.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
            if (!isAllowed(m[1])) {
              violations.push({ file, line, className: m[1], selector: prelude });
            }
          }
        }
      }
      preludeStart = i + 1;
    } else if (ch === "}") {
      stack.pop();
      preludeStart = i + 1;
    } else if (ch === ";") {
      preludeStart = i + 1;
    }
  }
  return violations;
}

const files = SEARCH_DIRS.flatMap((d) => cssFiles(join(ROOT, d)));
const violations = files.flatMap((f) => check(relative(ROOT, f), readFileSync(f, "utf8")));

if (violations.length > 0) {
  console.error("Class selectors outside @layer:\n");
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  .${v.className}   in  ${v.selector}`);
  }
  console.error(
    [
      "",
      "An unlayered rule beats every layered Tailwind utility regardless of",
      "specificity, and it fails silently: the element renders with the wrong",
      "value and nothing reports it. Move the rule into @layer components, or,",
      "if it is deliberately unlayered, add it to the allowlist at the top of",
      "scripts/check-css-layers.ts with a reason.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

console.log(`check-css-layers: ${files.length} file(s) clean`);

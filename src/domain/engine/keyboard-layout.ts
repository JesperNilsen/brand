/**
 * The Norwegian ISO keyboard, as the keyboard map draws it (Måling).
 *
 * The measurement counts per EXPECTED character (see KeyMeasurement), and a
 * character is not a key: «A» and «a» are one key pressed two ways, and so are
 * «?» and «+». The map is about the reader's hands, so it adds every character
 * onto the key that types it — capitals, Shift and AltGr included — and the
 * sums simply add, field by field, because every field of a KeyMeasurement is
 * a sum.
 *
 * What no single key types is not forced onto one. «» – — and the accented
 * letters reached through a dead key go in a separate list («Andre tegn»)
 * rather than being charged to whichever key looks closest, because that
 * would put a number on a key the reader never pressed for it.
 *
 * Only keys that type a character are listed: Shift, Tab, Backspace and the
 * other modifiers have nothing measured to show. `indent` keeps the rows'
 * stagger in key widths, measured from the left edge of the number row.
 */
import type { KeyMeasurement } from "@/domain/types";

export type KeySpec = {
  /** What the key types without a modifier; its identity. */
  base: string;
  /** What the map prints on the key. */
  label: string;
  /** Everything else the key types: Shift, then AltGr. */
  also: string;
  /** In letter-key widths; 1 when absent. */
  width?: number;
};

export type KeyRow = readonly KeySpec[];

const k = (base: string, also = "", label = base.toUpperCase()): KeySpec => ({
  base,
  label,
  also,
});

/** Rows top to bottom. Letters also type their capital; that is added below. */
export const NORWEGIAN_ISO_ROWS: readonly KeyRow[] = [
  [
    k("|", "§"),
    k("1", "!"),
    k("2", '"@'),
    k("3", "#£"),
    k("4", "¤$"),
    k("5", "%€"),
    k("6", "&"),
    k("7", "/{"),
    k("8", "(["),
    k("9", ")]"),
    k("0", "=}"),
    k("+", "?"),
    k("\\", "`´"),
  ],
  [
    ..."qwertyuiopå".split("").map((c) => k(c)),
    k("¨", "^~"),
    { base: "\n", label: "↵", also: "", width: 1.5 },
  ],
  [...[..."asdfghjkløæ"].map((c) => k(c)), k("'", "*")],
  [k("<", ">"), ...[..."zxcvbnm"].map((c) => k(c)), k(",", ";"), k(".", ":"), k("-", "_")],
  [{ base: " ", label: "mellomrom", also: "", width: 6 }],
];

/** Each row's start, in letter-key widths from the number row's left edge. */
export const ROW_INDENTS: readonly number[] = [0, 0.5, 0.75, 0.25, 3.5];

const BASE_OF: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const key of NORWEGIAN_ISO_ROWS.flat()) {
    map.set(key.base, key.base);
    const upper = key.base.toUpperCase();
    if (upper !== key.base) map.set(upper, key.base);
    for (const ch of key.also) map.set(ch, key.base);
  }
  return map;
})();

/** The key that types `ch`, by its base; null when no single key does. */
export function baseKeyFor(ch: string): string | null {
  return BASE_OF.get(ch) ?? null;
}

function byChar(a: KeyMeasurement, b: KeyMeasurement): number {
  return a.char < b.char ? -1 : a.char > b.char ? 1 : 0;
}

/**
 * The session's keys, added onto the keys that typed them. `onKeys` is keyed
 * by base and each value's `char` is that base; `others` holds what no key
 * types, unchanged and sorted the way the measurement sorts. A key nothing was
 * measured on is simply absent — the map shows it empty, never as a zero.
 */
export function mapKeysToLayout(keys: readonly KeyMeasurement[]): {
  onKeys: Map<string, KeyMeasurement>;
  others: KeyMeasurement[];
} {
  const onKeys = new Map<string, KeyMeasurement>();
  const others: KeyMeasurement[] = [];
  for (const m of keys) {
    const base = baseKeyFor(m.char);
    if (base === null) {
      others.push({ ...m });
      continue;
    }
    const sum = onKeys.get(base);
    onKeys.set(
      base,
      sum
        ? {
            char: base,
            firstTries: sum.firstTries + m.firstTries,
            firstTryCorrect: sum.firstTryCorrect + m.firstTryCorrect,
            flowMsSum: sum.flowMsSum + m.flowMsSum,
            flowCount: sum.flowCount + m.flowCount,
          }
        : { ...m, char: base },
    );
  }
  return { onKeys, others: others.sort(byChar) };
}

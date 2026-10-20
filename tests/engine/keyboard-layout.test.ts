import { describe, expect, it } from "vitest";
import {
  NORWEGIAN_ISO_ROWS,
  baseKeyFor,
  mapKeysToLayout,
} from "@/domain/engine/keyboard-layout";
import type { KeyMeasurement } from "@/domain/types";

const key = (
  char: string,
  firstTries: number,
  firstTryCorrect = firstTries,
  flowMsSum = 0,
  flowCount = 0,
): KeyMeasurement => ({ char, firstTries, firstTryCorrect, flowMsSum, flowCount });

describe("NORWEGIAN_ISO_ROWS", () => {
  const bases = NORWEGIAN_ISO_ROWS.map((row) => row.map((k) => k.base));

  it("is the Norwegian ISO layout, with å, ø and æ where the keyboard has them", () => {
    expect(bases[0].join("")).toBe("|1234567890+\\");
    expect(bases[1].slice(0, 12).join("")).toBe("qwertyuiopå¨");
    expect(bases[2].join("")).toBe("asdfghjkløæ'");
    expect(bases[3].join("")).toBe("<zxcvbnm,.-");
    expect(bases.flat()).toContain(" ");
    expect(bases.flat()).toContain("\n");
  });

  it("gives every key a distinct base", () => {
    const flat = bases.flat();
    expect(new Set(flat).size).toBe(flat.length);
  });

  it("maps every key's own base to itself", () => {
    for (const b of bases.flat()) expect(baseKeyFor(b)).toBe(b);
  });
});

describe("baseKeyFor", () => {
  it("maps capitals to their letter key, the Norwegian letters included", () => {
    expect(baseKeyFor("A")).toBe("a");
    expect(baseKeyFor("Å")).toBe("å");
    expect(baseKeyFor("Ø")).toBe("ø");
    expect(baseKeyFor("Æ")).toBe("æ");
  });

  it("maps Shift characters to the key they are printed on", () => {
    const pairs: [string, string][] = [
      ["§", "|"], ["!", "1"], ['"', "2"], ["#", "3"], ["¤", "4"], ["%", "5"],
      ["&", "6"], ["/", "7"], ["(", "8"], [")", "9"], ["=", "0"], ["?", "+"],
      ["`", "\\"], ["^", "¨"], ["*", "'"], [">", "<"], [";", ","], [":", "."],
      ["_", "-"],
    ];
    for (const [ch, base] of pairs) expect(baseKeyFor(ch), ch).toBe(base);
  });

  it("maps AltGr characters to the key they are printed on", () => {
    expect(baseKeyFor("@")).toBe("2");
    expect(baseKeyFor("$")).toBe("4");
    expect(baseKeyFor("€")).toBe("5");
    expect(baseKeyFor("{")).toBe("7");
    expect(baseKeyFor("}")).toBe("0");
  });

  it("returns null for characters no single key types", () => {
    for (const ch of ["«", "»", "–", "—", "é", "’", "…"]) {
      expect(baseKeyFor(ch), ch).toBeNull();
    }
  });
});

describe("mapKeysToLayout", () => {
  it("adds a capital onto its letter key, field by field", () => {
    const { onKeys } = mapKeysToLayout([key("a", 30, 28, 3000, 20), key("A", 4, 3, 900, 2)]);
    expect(onKeys.get("a")).toEqual({
      char: "a",
      firstTries: 34,
      firstTryCorrect: 31,
      flowMsSum: 3900,
      flowCount: 22,
    });
    expect(onKeys.has("A")).toBe(false);
  });

  it("lists characters without a key as «Andre tegn», sorted, and leaves them off the keys", () => {
    const { onKeys, others } = mapKeysToLayout([
      key("»", 3),
      key("e", 50),
      key("«", 3),
      key("–", 2),
    ]);
    expect(others.map((k) => k.char)).toEqual(["«", "»", "–"]);
    expect([...onKeys.keys()]).toEqual(["e"]);
  });

  it("does not invent keys that were never typed", () => {
    const { onKeys, others } = mapKeysToLayout([]);
    expect(onKeys.size).toBe(0);
    expect(others).toEqual([]);
  });
});

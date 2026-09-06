/**
 * The report path must agree with the rewrite path, because the report is what
 * a human reads when deciding whether an edition is fit to publish. If the two
 * ever disagree, the review certifies a text nobody types.
 *
 * The strongest form of that check is run against the real corpus: every
 * segment of every pack, through the rules those packs were actually built
 * with.
 */
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  analyzeText,
  applyLowercaseNouns,
  applyRules,
  assertCorpusFamily,
  composeRules,
  hitCounts,
  lineColumn,
  stageHits,
  type Rules,
} from "@/domain/language/rules";
import { loadRules } from "../../scripts/lib/load-rules";

const CONTENT = path.resolve(process.cwd(), "content");

/** Every (pack, rules version) pair on disk, discovered rather than listed. */
async function packEditions(): Promise<{ pack: string; version: number }[]> {
  const { readdir } = await import("node:fs/promises");
  const packs = (await readdir(CONTENT, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  const out: { pack: string; version: number }[] = [];
  for (const pack of packs) {
    for (const f of await readdir(path.join(CONTENT, pack))) {
      const m = /^rules\.v(\d+)\.json$/.exec(f);
      if (m) out.push({ pack, version: Number(m[1]) });
    }
  }
  return out.sort((a, b) => a.pack.localeCompare(b.pack) || a.version - b.version);
}

/** Exactly what buildTrainingEdition does to a segment, in the same order. */
function rewrite(text: string, rules: Rules): string {
  const usage = new Map<string, number>();
  let out = applyRules(text, rules, usage);
  if (rules.lowercaseNouns) {
    out = applyLowercaseNouns(out, new Set(rules.lowercaseNouns.properNames), usage);
  }
  return out;
}

describe("analyzeText against the real corpus", () => {
  it("finds at least one rules file to check", async () => {
    expect((await packEditions()).length).toBeGreaterThan(0);
  });

  it("reports the same text the builder would write, for every segment", async () => {
    for (const { pack, version } of await packEditions()) {
      const dir = path.join(CONTENT, pack);
      const rules = await loadRules(dir, version);
      const original = JSON.parse(
        await readFile(path.join(dir, "original.json"), "utf8"),
      ) as { edition: { segments: { id: string; text: string }[] } };

      for (const seg of original.edition.segments) {
        const report = analyzeText(seg.text, rules);
        expect(report.wouldBe, `${pack} v${version} ${seg.id}`).toBe(rewrite(seg.text, rules));
      }
    }
  });

  it("keeps every hit inside the text it was asked about, in reading order", async () => {
    for (const { pack, version } of await packEditions()) {
      const dir = path.join(CONTENT, pack);
      const rules = await loadRules(dir, version);
      const original = JSON.parse(
        await readFile(path.join(dir, "original.json"), "utf8"),
      ) as { edition: { segments: { id: string; text: string }[] } };

      for (const seg of original.edition.segments) {
        const { hits } = analyzeText(seg.text, rules);
        let last = -1;
        for (const h of hits) {
          expect(h.start).toBeGreaterThanOrEqual(0);
          expect(h.end).toBeLessThanOrEqual(seg.text.length);
          expect(h.end).toBeGreaterThanOrEqual(h.start);
          expect(h.start).toBeGreaterThanOrEqual(last);
          last = h.start;
        }
      }
    }
  });
});

describe("offsets point at the matched text", () => {
  const rules: Rules = {
    editionId: "test.v1",
    version: "1.0.0",
    languageProfileId: "brand-riksmaal",
    replacements: { blev: "ble", nu: "nå" },
  };

  it("round-trips a single-stage hit back to the source text", () => {
    const text = "Det blev mørkt, og nu kom hun. Blev det bedre?";
    const report = analyzeText(text, rules);
    expect(report.hits.length).toBe(3);
    for (const h of report.hits) {
      expect(text.slice(h.start, h.end)).toBe(h.from);
    }
  });

  it("preserves the source word's case in what it would write", () => {
    const report = analyzeText("Blev det BLEV blev", rules);
    expect(report.hits.map((h) => h.to)).toEqual(["Ble", "BLE", "ble"]);
  });

  it("carries surrounding context for each hit", () => {
    const report = analyzeText("Det blev mørkt", rules);
    expect(report.hits[0].context.before).toBe("Det ");
    expect(report.hits[0].context.after).toBe(" mørkt");
  });

  it("attributes a later stage's hit to the span of the original it came from", () => {
    // The pattern turns "Huset" into "Gaarden"; the replacement then fires on
    // the word the pattern produced. The report must locate that second hit at
    // "Huset" — the region of the caller's text the change belongs to.
    const staged: Rules = {
      editionId: "test.v1",
      version: "1.0.0",
      languageProfileId: "brand-riksmaal",
      patterns: [{ from: "Huset", to: "Gaarden" }],
      replacements: { gaarden: "gården" },
    };
    const text = "Huset stod tomt";
    const report = analyzeText(text, staged);
    expect(report.wouldBe).toBe("Gården stod tomt");
    const second = report.hits.find((h) => h.ruleKind === "replacement");
    expect(second).toBeDefined();
    expect(text.slice(second!.start, second!.end)).toBe("Huset");
    expect(second!.to).toBe("Gården");
  });
});

describe("pattern semantics the published editions depend on", () => {
  it("treats the replacement as literal text, not a capture reference", () => {
    // Two traps in one line, both waiting for whoever writes T-09 as a regex.
    // applyRules replaces with a function returning `to`, so `$1` never
    // expands — the characters are inserted. And `\w` does not match æ ø å, so
    // the match starts inside the word: "Hænderne" keeps its "Hæ".
    const rules: Rules = {
      editionId: "test.v1",
      version: "1.0.0",
      languageProfileId: "brand-riksmaal",
      patterns: [{ from: "(\\w+)erne", to: "$1ene" }],
    };
    expect(analyzeText("Hænderne", rules).wouldBe).toBe("Hæ$1ene");
  });

  it("matches Norwegian letters when the pattern uses a unicode class", () => {
    const rules: Rules = {
      editionId: "test.v1",
      version: "1.0.0",
      languageProfileId: "brand-riksmaal",
      patterns: [{ from: "[\\p{L}]+erne", to: "hendene", flags: "gu" }],
    };
    expect(analyzeText("Hænderne", rules).wouldBe).toBe("hendene");
  });

  it("stops after the first match when the pattern is not global", () => {
    const rules: Rules = {
      editionId: "test.v1",
      version: "1.0.0",
      languageProfileId: "brand-riksmaal",
      patterns: [{ from: "aa", to: "å", flags: "" }],
    };
    const report = analyzeText("aa og aa", rules);
    expect(report.hits.length).toBe(1);
    expect(report.wouldBe).toBe("å og aa");
  });

  it("refuses a sticky pattern rather than guessing what it means", () => {
    expect(() =>
      stageHits("aa", { kind: "pattern", pattern: { from: "aa", to: "å", flags: "gy" } }),
    ).toThrow(/[Ss]ticky/);
  });
});

describe("what did not fire", () => {
  const rules: Rules = {
    editionId: "test.v1",
    version: "1.0.0",
    languageProfileId: "brand-riksmaal",
    replacements: { blev: "ble", nu: "nå", hvad: "hva" },
    patterns: [{ from: "zzz", to: "!" }],
  };

  it("lists rules the text never used", () => {
    const report = analyzeText("Det blev mørkt", rules);
    expect(report.silent.map((s) => s.ruleKey).sort()).toEqual(["hvad", "nu", "pattern:zzz"]);
  });

  it("counts occurrences per rule, most frequent first", () => {
    const report = analyzeText("blev blev nu", rules);
    expect(hitCounts(report)).toEqual([
      { ruleKey: "blev", count: 2 },
      { ruleKey: "nu", count: 1 },
    ]);
  });
});

describe("the two rule families never mix", () => {
  const pack: Rules = {
    editionId: "test.v1",
    version: "1.0.0",
    languageProfileId: "brand-riksmaal",
  };

  it("composes a set that declares the corpus family", () => {
    expect(() => composeRules(pack, { family: "historical-orthography" })).not.toThrow();
  });

  it("composes a set that declares no family at all", () => {
    expect(() => composeRules(pack, { replacements: { blev: "ble" } })).not.toThrow();
  });

  it("refuses to compose a contemporary-usage set into a corpus build", () => {
    expect(() =>
      composeRules(pack, { family: "contemporary-usage", replacements: { boka: "boken" } }),
    ).toThrow(/contemporary-usage/);
  });

  it("refuses it at the id-resolution point too, where types are gone", () => {
    expect(() => assertCorpusFamily({ family: "contemporary-usage" }, "somewhere")).toThrow(
      /may not be composed/,
    );
  });
});

describe("lineColumn", () => {
  it("counts from one, per line", () => {
    const text = "abc\ndefg\nhi";
    expect(lineColumn(text, 0)).toEqual({ line: 1, column: 1 });
    expect(lineColumn(text, 4)).toEqual({ line: 2, column: 1 });
    expect(lineColumn(text, 7)).toEqual({ line: 2, column: 4 });
    expect(lineColumn(text, 9)).toEqual({ line: 3, column: 1 });
  });
});

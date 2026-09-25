/**
 * The polite second person is the one class `lowercaseNouns` can damage
 * without misspelling anything. These tests pin the gate to the exact shape
 * of that damage, and then run it over the real edition Q-016 replaced.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { politeAddressProblems } from "../../scripts/lib/polite-address";

const seg = (id: string, text: string) => ({ id, text });
const check = (original: { id: string; text: string }[], training: { id: string; text: string }[]) =>
  politeAddressProblems("training-edition.v9.json", "w.original", "w.training.v9", original, training);

describe("politeAddressProblems", () => {
  it("is silent when every polite form survives", () => {
    const o = [seg("a", "„De har vist ikke moret Dem iaften?“ sagde hun.")];
    expect(check(o, o)).toEqual([]);
  });

  it("catches «Dem» turned into «dem» mid-sentence — the Q-016 shape", () => {
    const o = [seg("a", "„De har vist ikke moret Dem iaften?“ sagde hun.")];
    const t = [seg("a", "„De har vist ikke moret dem iaften?“ sagde hun.")];
    const found = check(o, t);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/^training-edition\.v9\.json\/a: høflig tiltale «Dem» står 1 gang \(1 midt i setningen\)/);
    expect(found[0]).toMatch(/Legg «Dem» i properNames/);
  });

  it("names every damaged form separately, with its own counts", () => {
    const o = [seg("a", "Vil De ikke, saa maa De sige det, og Deres Broder med Dem.")];
    const t = [seg("a", "Vil de ikke, saa maa de sige det, og deres Broder med dem.")];
    const found = check(o, t);
    expect(found.map((p) => /«(\w+)» står/.exec(p)![1])).toEqual(["De", "Dem", "Deres"]);
    expect(found[0]).toMatch(/«De» står 2 ganger \(2 midt i setningen\) in?/);
  });

  it("treats the archaic plural «I» as address too", () => {
    const o = [seg("a", "Jeg undrer meg bare over, at I ikke blir kjede av det.")];
    const t = [seg("a", "Jeg undrer meg bare over, at i ikke blir kjede av det.")];
    expect(check(o, t)).toHaveLength(1);
    expect(check(o, t)[0]).toMatch(/«I» står 1 gang/);
  });

  it("does not count a lowercase «de» that was never polite", () => {
    // Third person from the start: nothing capitalised, nothing to protect.
    const o = [seg("a", "Da de kom hjem, sagde de ingenting.")];
    expect(check(o, o)).toEqual([]);
  });

  it("is unaffected by orthography changes around the form", () => {
    // Replacements move the neighbours; the count of «Dem» does not change.
    const o = [seg("a", "Han saa paa Dem og sagde: Kommer De efter?")];
    const t = [seg("a", "Han så på Dem og sagde: Kommer De etter?")];
    expect(check(o, t)).toEqual([]);
  });

  it("leaves a missing segment to the id gate", () => {
    const o = [seg("a", "Vil De?"), seg("b", "Jeg takker Dem.")];
    const t = [seg("a", "Vil De?")];
    expect(check(o, t)).toEqual([]);
  });
});

describe("against the real Noveletter editions", () => {
  const dir = path.resolve(process.cwd(), "content", "kielland-noveletter");
  const read = async (f: string) =>
    JSON.parse(await readFile(path.join(dir, f), "utf8")) as {
      id?: string;
      edition?: { id: string; segments: { id: string; text: string }[] };
      segments?: { id: string; text: string }[];
    };

  it("goes red on v3 — the edition that shipped the defect — and names the leaked segment", async () => {
    const o = (await read("original.v2.json")).edition!;
    const t = await read("training-edition.v3.json");
    const found = politeAddressProblems("training-edition.v3.json", o.id, t.id!, o.segments, t.segments!);
    expect(found.length).toBeGreaterThanOrEqual(50);
    expect(found.some((p) => p.startsWith("training-edition.v3.json/haabet-16: høflig tiltale «Dem»"))).toBe(true);
  });

  it("is clean on v5 — the edition readers are served", async () => {
    const o = (await read("original.v2.json")).edition!;
    const t = await read("training-edition.v5.json");
    expect(politeAddressProblems("training-edition.v5.json", o.id, t.id!, o.segments, t.segments!)).toEqual([]);
  });
});

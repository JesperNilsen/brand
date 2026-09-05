import { beforeAll, describe, expect, it } from "vitest";
import { defaultEdition, getWork } from "@/domain/content/registry";
import { defaultPreferences } from "@/infra/repository/migrations";
import {
  buildPlan,
  parseSessionParams,
  rememberChoice,
  sessionHref,
} from "@/lib/session-flow";
import type { TextEdition, UserPreferences } from "@/domain/types";
import { loadFromDisk } from "../content/load-from-disk";

const prefs: UserPreferences = defaultPreferences();

function params(overrides: Record<string, string>) {
  const q = new URLSearchParams(overrides);
  return parseSessionParams((k) => q.get(k));
}

describe("session params", () => {
  it("round-trips the text filter through the URL", () => {
    const href = sessionHref({
      mode: "passage",
      workId: "ibsen-brand",
      segmentId: "akt1-01",
      textFilterId: "words-only",
    });
    expect(href).toContain("filter=words-only");
    const parsed = params(Object.fromEntries(new URLSearchParams(href.split("?")[1])));
    expect(parsed?.textFilterId).toBe("words-only");
  });

  it("ignores an unknown filter value rather than failing", () => {
    expect(params({ mode: "passage", work: "ibsen-brand", filter: "loud" })?.textFilterId)
      .toBeUndefined();
  });
});

describe("buildPlan with a text filter", () => {
  const base = { mode: "passage", workId: "ibsen-brand", segmentId: "akt1-01" };
  const work = getWork("ibsen-brand")!;
  let edition: TextEdition;
  beforeAll(async () => {
    edition = await loadFromDisk(defaultEdition(work, prefs.languageProfileId));
  });
  const content = () => ({ work, edition });

  it("defaults to the stored preference", () => {
    const plan = buildPlan(base, { ...prefs, textFilterId: "no-punctuation" }, null, content());
    expect(plan.textFilterId).toBe("no-punctuation");
    expect(plan.segments[0].text).not.toMatch(/[.,!?]/);
  });

  it("a URL filter overrides the preference for that session", () => {
    const plan = buildPlan({ ...base, textFilterId: "words-only" }, prefs, null, content());
    expect(plan.textFilterId).toBe("words-only");
    expect(plan.segments[0].text).toBe(plan.segments[0].text.toLowerCase());
    expect(plan.segments[0].text).not.toContain("\n");
  });

  it("as-printed leaves the edition text exactly as stored", () => {
    const stored = edition.segments.find((s) => s.id === "akt1-01")!;
    const plan = buildPlan(base, prefs, null, content());
    expect(plan.textFilterId).toBe("as-printed");
    expect(plan.segments[0].text).toBe(stored.text);
  });

  it("filtering never changes which segment the mode picked", () => {
    const plan = buildPlan({ ...base, segmentId: "akt1-03", textFilterId: "words-only" }, prefs, null, content());
    expect(plan.segments.map((s) => s.id)).toEqual(["akt1-03"]);
  });

  it("remembers the filter as the new preference", () => {
    const plan = buildPlan({ ...base, textFilterId: "words-only" }, prefs, null, content());
    expect(rememberChoice(prefs, plan).textFilterId).toBe("words-only");
  });
});

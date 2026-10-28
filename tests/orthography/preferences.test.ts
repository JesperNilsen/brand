import { describe, expect, it } from "vitest";
import { resolveSelection } from "@/domain/orthography";
import { progressKey } from "@/domain/types";
import { LocalStoragePreferences } from "@/infra/preferences/local-storage";
import { defaultPreferences, migratePreferences } from "@/infra/repository/migrations";

/** A Storage over a plain map: the same object read by two instances is a restart. */
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
}

/** What a reader's disk held before D21: every field of schema 1, none of the new ones. */
const LEGACY = {
  schemaVersion: 1,
  theme: "dark",
  languageProfileId: "brand-riksmaal",
  defaultErrorMode: "stop-on-error",
  textFilterId: "words-only",
  lastModeId: "nonstop",
  lastContentPackId: "kielland",
  lastWorkId: "kielland-gift",
  lastTimedLimitMs: 120000,
};

describe("writing norm preferences", () => {
  it("defaults to Brandmål, with no bokmål norm remembered", () => {
    const p = defaultPreferences();
    expect(p.writingLanguageId).toBe("brandmal");
    expect(p.orthographyByLanguage).toEqual({});
    expect(resolveSelection(p)).toEqual({ languageId: "brandmal", orthographyId: "brandmal-0.1" });
  });

  it("reads a pre-D21 record as Brandmål and keeps every field it had", () => {
    const p = migratePreferences(LEGACY);
    expect(p).toEqual({ ...LEGACY, writingLanguageId: "brandmal", orthographyByLanguage: {} });
  });

  it("never touches languageProfileId, so no progress key moves", () => {
    const before = migratePreferences(LEGACY);
    const after = migratePreferences({
      ...LEGACY,
      writingLanguageId: "bokmal",
      orthographyByLanguage: { bokmal: "bokmal-1938" },
    });
    const key = (p: typeof before) =>
      progressKey({ languageProfileId: p.languageProfileId, gameModeId: "nonstop", workId: "kielland-gift" });
    expect(after.languageProfileId).toBe("brand-riksmaal");
    expect(key(after)).toBe(key(before));
    expect(key(after)).toBe("brand-riksmaal::nonstop::kielland-gift");
  });

  it("plain bokmål is modern bokmål until a norm is chosen", () => {
    const p = migratePreferences({ ...LEGACY, writingLanguageId: "bokmal" });
    expect(resolveSelection(p)).toEqual({ languageId: "bokmal", orthographyId: "bokmal-current" });
  });

  it("remembers the bokmål norm while the reader is on Brandmål, and restores it", () => {
    const onBrandmal = migratePreferences({
      ...LEGACY,
      writingLanguageId: "brandmal",
      orthographyByLanguage: { bokmal: "bokmal-1917" },
    });
    expect(resolveSelection(onBrandmal).orthographyId).toBe("brandmal-0.1");
    const back = { ...onBrandmal, writingLanguageId: "bokmal" };
    expect(resolveSelection(back)).toEqual({ languageId: "bokmal", orthographyId: "bokmal-1917" });
  });

  it("drops what this build cannot honour instead of guessing", () => {
    const p = migratePreferences({
      ...LEGACY,
      writingLanguageId: "nynorsk",
      orthographyByLanguage: {
        bokmal: "bokmal-1899",
        brandmal: "bokmal-1938",
        nynorsk: "nynorsk-1938",
      },
    });
    expect(p.writingLanguageId).toBe("brandmal");
    expect(p.orthographyByLanguage).toEqual({});
  });

  it("survives a restart: a second store over the same storage reads the choice back", () => {
    const storage = memoryStorage();
    const first = new LocalStoragePreferences(storage);
    first.write({
      ...first.read(),
      writingLanguageId: "bokmal",
      orthographyByLanguage: { bokmal: "bokmal-1959" },
    });
    const second = new LocalStoragePreferences(storage);
    expect(resolveSelection(second.read())).toEqual({ languageId: "bokmal", orthographyId: "bokmal-1959" });
  });

  it("is idempotent", () => {
    const once = migratePreferences({ ...LEGACY, writingLanguageId: "bokmal", orthographyByLanguage: { bokmal: "bokmal-2005" } });
    expect(migratePreferences(once)).toEqual(once);
  });
});

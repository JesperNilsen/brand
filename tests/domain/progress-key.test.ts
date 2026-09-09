/**
 * The progress key, and the one thing that must not happen to it.
 *
 * A key is not an implementation detail here: it is already written on readers'
 * disks. Change how it is composed and every stored record files itself under a
 * name the app never asks for — the reader's place is still there, and the app
 * starts them at page one anyway. That has happened once already (records
 * written before 2026-09-07 carried the edition id), which is why
 * `migrateProgress` recomputes the key from the record's own fields instead of
 * trusting the stored one.
 *
 * So the module element is appended only when there is a module. The assertions
 * below are on the exact string, deliberately: a test that only says "the key
 * is stable" passes just as happily against `a::b::c::` as against `a::b::c`.
 * Make the element unconditional — `parts.push(input.moduleId ?? "")` — and
 * every case in the first block goes red.
 */
import { describe, expect, it } from "vitest";
import { progressKey } from "@/domain/types";
import { migrateProgress } from "@/infra/repository/migrations";

const base = {
  languageProfileId: "brand-riksmaal",
  gameModeId: "nonstop",
  workId: "ibsen-brand",
};

describe("progressKey without modules", () => {
  it("is exactly the key it was before modules existed", () => {
    expect(progressKey(base)).toBe("brand-riksmaal::nonstop::ibsen-brand");
  });

  it("is unchanged by an absent, empty or undefined module", () => {
    const expected = "brand-riksmaal::nonstop::ibsen-brand";
    expect(progressKey({ ...base, moduleId: undefined })).toBe(expected);
    expect(progressKey({ ...base, moduleId: "" })).toBe(expected);
  });

  it("is unchanged by the edition id, which left the key in D14", () => {
    expect(progressKey({ ...base, editionId: "ibsen-brand.training.v2" })).toBe(
      "brand-riksmaal::nonstop::ibsen-brand",
    );
  });
});

describe("progressKey with modules", () => {
  it("appends the module, so two modules of one work are two places", () => {
    const a = progressKey({ ...base, moduleId: "diapsalmata" });
    const b = progressKey({ ...base, moduleId: "forforerens-dagbog" });
    expect(a).toBe("brand-riksmaal::nonstop::ibsen-brand::diapsalmata");
    expect(a).not.toBe(b);
  });

  it("keeps the work's own key distinct from any of its modules", () => {
    expect(progressKey({ ...base, moduleId: "diapsalmata" })).not.toBe(progressKey(base));
  });
});

describe("migrateProgress across the module change", () => {
  const stored = {
    key: "brand-riksmaal::nonstop::ibsen-brand",
    workId: "ibsen-brand",
    editionId: "ibsen-brand.training.v1",
    languageProfileId: "brand-riksmaal",
    gameModeId: "nonstop",
    nextSegmentId: "akt1-03",
    completedSegmentIds: ["akt1-01", "akt1-02"],
    updatedAt: "2026-09-08T10:00:00.000Z",
  };

  it("leaves a record written before modules exactly as it was", () => {
    const migrated = migrateProgress(stored);
    expect(migrated?.key).toBe("brand-riksmaal::nonstop::ibsen-brand");
    // Idempotence by identity: nothing changed, so nothing was rewritten.
    expect(migrated).toBe(stored);
  });

  it("keys a record that names a module under that module", () => {
    const migrated = migrateProgress({ ...stored, moduleId: "diapsalmata" });
    expect(migrated?.key).toBe("brand-riksmaal::nonstop::ibsen-brand::diapsalmata");
  });

  it("treats an empty moduleId as no module rather than as a module", () => {
    const migrated = migrateProgress({ ...stored, moduleId: "" });
    expect(migrated?.key).toBe("brand-riksmaal::nonstop::ibsen-brand");
  });
});

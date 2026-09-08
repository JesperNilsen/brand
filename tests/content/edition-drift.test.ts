import { describe, expect, it } from "vitest";
import { driftLabel, editionDrift, isDrifted } from "@/domain/content/edition-drift";
import type { TextEditionMeta } from "@/domain/types";

const edition = {
  id: "w.training.v2",
  workId: "w",
  kind: "training-edition",
  version: "2.0.0",
  contentHash: "sha256:abc",
  segmentCount: 3,
  wordCount: 100,
  file: "/content/editions/w.training.v2.abc.json",
} as TextEditionMeta;

const session = (extra: { editionId?: string; editionContentHash?: string } = {}) => ({
  editionId: "w.training.v2",
  editionContentHash: "sha256:abc",
  ...extra,
});

describe("editionDrift", () => {
  it("is a match when the hash is the one the catalog serves", () => {
    expect(editionDrift(session(), edition)).toBe("match");
    expect(isDrifted("match")).toBe(false);
    expect(driftLabel("match")).toBeNull();
  });

  it("is moved when the id is there and the text is not", () => {
    // The failure D7 exists to prevent, and the one Q-006 nearly caused: an
    // edition re-cut under the same id.
    expect(editionDrift(session({ editionContentHash: "sha256:xyz" }), edition)).toBe("moved");
    expect(driftLabel("moved")).toBe("endret tekst");
  });

  it("is gone when the catalog has no such edition", () => {
    expect(editionDrift(session(), undefined)).toBe("gone");
    expect(driftLabel("gone")).toBe("utgaven er borte");
  });

  // A record from schema 1 or 2 predates the fields. Saying its text changed
  // would be exactly as false as saying it did not.
  it("says nothing about a session that cannot say what it typed", () => {
    expect(editionDrift(session({ editionContentHash: "unknown" }), edition)).toBe("unknown");
    expect(editionDrift(session({ editionContentHash: "unknown" }), undefined)).toBe("unknown");
    expect(isDrifted("unknown")).toBe(false);
    expect(driftLabel("unknown")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  abandon,
  backspace,
  complete,
  createSession,
  elapsedMs,
  insertText,
  rejectPaste,
} from "@/domain/engine/engine";
import { deriveCharStates } from "@/domain/engine/render";
import { computeMetrics, countCharacters } from "@/domain/engine/metrics";

function typeAll(
  state: ReturnType<typeof createSession>,
  text: string,
  startAt: number,
  stepMs = 100,
) {
  let s = state;
  let t = startAt;
  for (const ch of Array.from(text)) {
    s = insertText(s, ch, t);
    t += stepMs;
  }
  return { state: s, now: t };
}

describe("createSession", () => {
  it("normalises the target to NFC and \\n line endings", () => {
    const decomposed = "blå"; // "blå" with combining ring
    const s = createSession({ targetText: `${decomposed}\r\nlinje` });
    expect(s.targetText).toBe("blå\nlinje");
    expect(s.status).toBe("idle");
    expect(s.errorMode).toBe("flow");
    expect(s.startedAt).toBeNull();
  });
});

describe("flow mode typing", () => {
  it("accepts Norwegian characters, hyphen, dash, quotes and multiple spaces", () => {
    const target = "Æ, ø og å – «sitat»  to mellomrom - bindestrek";
    const s0 = createSession({ targetText: target });
    const { state } = typeAll(s0, target, 1000);
    expect(state.typedText).toBe(target);
    expect(state.status).toBe("completed");
    expect(state.incorrectInsertCount).toBe(0);
    expect(deriveCharStates(state).every((c) => c.state === "correct")).toBe(
      true,
    );
  });

  it("keeps moving forward on errors and marks them incorrect", () => {
    const s0 = createSession({ targetText: "frem" });
    let s = insertText(s0, "f", 0);
    s = insertText(s, "x", 100);
    s = insertText(s, "e", 200);
    expect(s.typedText).toBe("fxe");
    expect(s.status).toBe("active");
    expect(s.incorrectInsertCount).toBe(1);
    expect(deriveCharStates(s).map((c) => c.state)).toEqual([
      "correct",
      "incorrect",
      "correct",
      "pending",
    ]);
  });

  it("starts the clock at the first accepted character", () => {
    const s0 = createSession({ targetText: "nå" });
    expect(elapsedMs(s0, 5000)).toBe(0);
    const s1 = insertText(s0, "n", 5000);
    expect(s1.startedAt).toBe(5000);
    expect(elapsedMs(s1, 7000)).toBe(2000);
  });

  it("lets Backspace correct earlier input, repeatedly", () => {
    const s0 = createSession({ targetText: "boken" });
    let s = insertText(s0, "b", 0);
    s = insertText(s, "u", 10);
    s = backspace(s, 20);
    s = insertText(s, "u", 30);
    s = backspace(s, 40);
    s = insertText(s, "o", 50);
    expect(s.typedText).toBe("bo");
    expect(s.incorrectInsertCount).toBe(2);
    const counts = countCharacters(s.targetText, s.typedText, s.incorrectInsertCount);
    expect(counts.correctCharacterCount).toBe(2);
    expect(counts.errorCount).toBe(2);
  });

  it("does nothing on Backspace with empty input", () => {
    const s0 = createSession({ targetText: "syv" });
    expect(backspace(s0, 0)).toBe(s0);
  });

  it("completes exactly once at target length and ignores further input", () => {
    const s0 = createSession({ targetText: "ab" });
    let s = insertText(s0, "a", 0);
    s = insertText(s, "b", 100);
    expect(s.status).toBe("completed");
    expect(s.endedAt).toBe(100);
    const after = insertText(s, "c", 200);
    expect(after).toBe(s);
    expect(backspace(s, 300)).toBe(s);
    expect(s.eventLog.filter((e) => e.type === "complete")).toHaveLength(1);
  });

  it("never accepts characters beyond the target length in one multi-char insert", () => {
    const s0 = createSession({ targetText: "ab" });
    const s = insertText(s0, "abcd", 0);
    expect(s.typedText).toBe("ab");
    expect(s.status).toBe("completed");
  });

  it("handles multi-character input (IME / dead keys) and NFC-normalises it", () => {
    const s0 = createSession({ targetText: "ålesund" });
    const s = insertText(s0, "åles", 0);
    expect(s.typedText).toBe("åles");
    expect(s.incorrectInsertCount).toBe(0);
  });

  it("treats \\r\\n input as \\n", () => {
    const s0 = createSession({ targetText: "a\nb" });
    const s = insertText(s0, "a\r\nb", 0);
    expect(s.typedText).toBe("a\nb");
    expect(s.status).toBe("completed");
  });
});

describe("paste rejection", () => {
  it("logs the rejection without touching text, clock or counts", () => {
    const s0 = createSession({ targetText: "etter" });
    const s1 = insertText(s0, "e", 0);
    const s2 = rejectPaste(s1, 50);
    expect(s2.typedText).toBe("e");
    expect(s2.startedAt).toBe(0);
    expect(s2.incorrectInsertCount).toBe(0);
    expect(s2.eventLog.at(-1)).toEqual({ at: 50, type: "paste-rejected" });
    const m = computeMetrics(
      countCharacters(s2.targetText, s2.typedText, s2.incorrectInsertCount),
      elapsedMs(s2, 50),
    );
    expect(m.typedCharacterCount).toBe(1);
  });
});

describe("empty and closed sessions", () => {
  it("an empty session has zero metrics and no start time", () => {
    const s = createSession({ targetText: "meget" });
    const m = computeMetrics(
      countCharacters(s.targetText, s.typedText, 0),
      elapsedMs(s, 10_000),
    );
    expect(m.grossWpm).toBe(0);
    expect(m.accuracy).toBe(0);
    expect(m.durationMs).toBe(0);
  });

  it("abandon closes the session and is idempotent", () => {
    const s0 = createSession({ targetText: "selv" });
    const s1 = insertText(s0, "s", 0);
    const s2 = abandon(s1, 500);
    expect(s2.status).toBe("abandoned");
    expect(s2.endedAt).toBe(500);
    expect(abandon(s2, 900)).toBe(s2);
    expect(insertText(s2, "e", 1000)).toBe(s2);
  });

  it("complete() can close an unfinished session (time limit) and sets startedAt if untouched", () => {
    const s0 = createSession({ targetText: "bygget" });
    const s1 = complete(s0, 100);
    expect(s1.status).toBe("completed");
    expect(s1.startedAt).toBe(100);
    expect(elapsedMs(s1, 999)).toBe(0);
  });
});

describe("stop-on-error strategy", () => {
  it("rejects non-matching characters and never records them", () => {
    const s0 = createSession({ targetText: "nå", errorMode: "stop-on-error" });
    let s = insertText(s0, "x", 0);
    expect(s.typedText).toBe("");
    expect(s.rejectedInsertCount).toBe(1);
    expect(s.startedAt).toBeNull();
    s = insertText(s, "n", 10);
    s = insertText(s, "å", 20);
    expect(s.status).toBe("completed");
    expect(s.incorrectInsertCount).toBe(0);
  });
});

describe("cursorIndex", () => {
  /**
   * `cursorIndex` equals `typedText.length` in every state the engine can
   * currently reach, so it looks redundant and reads like a field to delete.
   * docs/spec/TYPING_ENGINE.md keeps it on purpose: selection and IME
   * composition will move the caret away from the end of the typed text, and
   * at that point every caller that reached for `typedText.length` instead is
   * wrong in a way that renders fine and mis-measures.
   *
   * This test pins the invariant rather than the equality. If a future change
   * makes them differ, it fails here first, which is where the decision
   * belongs.
   */
  const target = "Hvor er du?";

  it("tracks the caret through insert, backspace and completion", () => {
    let s = createSession({ targetText: target });
    expect(s.cursorIndex).toBe(0);
    expect(s.cursorIndex).toBe(s.typedText.length);

    s = insertText(s, "Hvor", 1_000);
    expect(s.cursorIndex).toBe(4);
    expect(s.cursorIndex).toBe(s.typedText.length);

    s = backspace(s, 1_100);
    expect(s.cursorIndex).toBe(3);
    expect(s.cursorIndex).toBe(s.typedText.length);

    s = insertText(s, "r er du?", 1_200);
    expect(s.status).toBe("completed");
    expect(s.cursorIndex).toBe(target.length);
    expect(s.cursorIndex).toBe(s.typedText.length);
  });

  it("is unchanged by a rejected paste, which touches no text", () => {
    let s = insertText(createSession({ targetText: target }), "Hvor", 1_000);
    const before = s.cursorIndex;
    s = rejectPaste(s, 1_100);
    expect(s.cursorIndex).toBe(before);
    expect(s.typedText).toBe("Hvor");
  });

  it("never runs past the target text", () => {
    let s = createSession({ targetText: target });
    s = insertText(s, target + "og mere til", 1_000);
    expect(s.cursorIndex).toBe(target.length);
    expect(s.cursorIndex).toBe(s.typedText.length);
  });
});

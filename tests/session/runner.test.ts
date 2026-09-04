import { describe, expect, it } from "vitest";
import type { SessionPlan } from "@/domain/modes/types";
import {
  createRunner,
  currentSegment,
  metricsFromResult,
  runnerAbandon,
  runnerBackspace,
  runnerInsert,
  runnerMetrics,
  runnerRejectPaste,
  runnerRemainingMs,
  runnerResumeSegmentId,
  runnerStop,
  runnerTick,
  toSessionResult,
} from "@/domain/session/runner";
import type { TextSegment } from "@/domain/types";

function seg(id: string, text: string, order: number): TextSegment {
  return { id, order, text, wordCount: text.split(/\s+/).length };
}

function plan(overrides: Partial<SessionPlan>): SessionPlan {
  return {
    id: "plan1",
    gameModeId: "passage",
    languageProfileId: "brand-riksmaal",
    contentPackId: "pack",
    workId: "work",
    editionId: "edition",
    errorMode: "flow",
    segments: [seg("a", "nå", 1)],
    endRule: { kind: "all-segments" },
    ...overrides,
  };
}

function typeString(state: ReturnType<typeof createRunner>, text: string, from: number, step = 100) {
  let s = state;
  let t = from;
  for (const ch of Array.from(text)) {
    s = runnerInsert(s, ch, t);
    t += step;
  }
  return { state: s, now: t };
}

describe("Passage (all-segments)", () => {
  it("completes when the single segment is typed and produces a consistent result", () => {
    const r0 = createRunner(plan({ segments: [seg("a", "frem og etter", 1)] }));
    const { state, now } = typeString(r0, "frem og etter", 1000, 500);
    expect(state.status).toBe("completed");
    expect(state.completedSegmentIds).toEqual(["a"]);
    const result = toSessionResult(state, now, "s1");
    expect(result.status).toBe("completed");
    expect(result.segmentIds).toEqual(["a"]);
    expect(result.typedCharacterCount).toBe(13);
    expect(result.correctCharacterCount).toBe(13);
    expect(result.durationMs).toBe(12 * 500);
    expect(result.accuracy).toBe(1);
    // Rehydrating from the stored result reproduces the same numbers.
    const m = metricsFromResult(result);
    expect(m.netWpm).toBe(result.netWpm);
    expect(m.grossWpm).toBe(result.grossWpm);
    expect(m.accuracy).toBe(result.accuracy);
  });

  it("stopping an unfinished passage abandons it", () => {
    const r0 = createRunner(plan({ segments: [seg("a", "boken", 1)] }));
    const r1 = runnerInsert(r0, "b", 0);
    const r2 = runnerStop(r1, 700);
    expect(r2.status).toBe("abandoned");
    expect(toSessionResult(r2, 700, "x").status).toBe("abandoned");
    expect(runnerInsert(r2, "o", 800)).toBe(r2);
  });

  it("paste rejection is counted but does not alter typing state", () => {
    const r0 = createRunner(plan({ segments: [seg("a", "syv", 1)] }));
    const r1 = runnerInsert(r0, "s", 0);
    const r2 = runnerRejectPaste(r1, 10);
    expect(r2.pasteRejections).toBe(1);
    expect(r2.engine.typedText).toBe("s");
    expect(runnerMetrics(r2, 10).typedCharacterCount).toBe(1);
  });
});

describe("Nonstop (user-stop)", () => {
  const segments = [seg("a", "ab", 1), seg("b", "cd", 2), seg("c", "ef", 3)];

  it("advances through segments, aggregates counts and tracks resume position", () => {
    const r0 = createRunner(plan({ gameModeId: "nonstop", segments, endRule: { kind: "user-stop" } }));
    expect(runnerResumeSegmentId(r0)).toBe("a");
    let r = runnerInsert(r0, "a", 0);
    r = runnerInsert(r, "x", 100); // error on 'b'
    expect(r.completedSegmentIds).toEqual(["a"]);
    expect(currentSegment(r).id).toBe("b");
    expect(runnerResumeSegmentId(r)).toBe("b");
    r = runnerInsert(r, "c", 200);
    const stopped = runnerStop(r, 300);
    expect(stopped.status).toBe("completed");
    const counts = runnerMetrics(stopped, 300);
    expect(counts.comparedCharacterCount).toBe(3);
    expect(counts.correctCharacterCount).toBe(2);
    expect(counts.errorCount).toBe(1);
    const result = toSessionResult(stopped, 300, "n1");
    expect(result.segmentIds).toEqual(["a", "b"]);
    expect(result.durationMs).toBe(300);
  });

  it("finishes the work when the last segment is completed", () => {
    const r0 = createRunner(plan({ gameModeId: "nonstop", segments, endRule: { kind: "user-stop" } }));
    const { state } = typeString(r0, "abcdef", 0);
    expect(state.status).toBe("completed");
    expect(state.completedSegmentIds).toEqual(["a", "b", "c"]);
    expect(runnerResumeSegmentId(state)).toBeNull();
  });

  it("stopping before typing anything is an abandoned, zero-length session", () => {
    const r0 = createRunner(plan({ gameModeId: "nonstop", segments, endRule: { kind: "user-stop" } }));
    const r1 = runnerStop(r0, 5000);
    expect(r1.status).toBe("abandoned");
    expect(toSessionResult(r1, 5000, "z").durationMs).toBe(0);
  });

  it("backspace never crosses a segment boundary", () => {
    const r0 = createRunner(plan({ gameModeId: "nonstop", segments, endRule: { kind: "user-stop" } }));
    let r = runnerInsert(r0, "ab", 0);
    expect(currentSegment(r).id).toBe("b");
    r = runnerBackspace(r, 10);
    expect(r).toBe(runnerBackspace(r, 10));
    expect(r.engine.typedText).toBe("");
    expect(currentSegment(r).id).toBe("b");
  });
});

describe("Timed (time rule)", () => {
  const segments = [seg("a", "abc", 1), seg("b", "def", 2)];

  it("reports remaining time and closes exactly at the limit via tick", () => {
    const r0 = createRunner(plan({ gameModeId: "timed", segments, endRule: { kind: "time", limitMs: 1000 } }));
    expect(runnerRemainingMs(r0, 999_999)).toBe(1000); // clock not started
    const r1 = runnerInsert(r0, "a", 10_000);
    expect(runnerRemainingMs(r1, 10_400)).toBe(600);
    expect(runnerTick(r1, 10_400)).toBe(r1);
    const closed = runnerTick(r1, 11_250);
    expect(closed.status).toBe("completed");
    expect(closed.endedAt).toBe(11_000);
    expect(toSessionResult(closed, 11_250, "t").durationMs).toBe(1000);
  });

  it("input after the limit is not accepted and closes the session", () => {
    const r0 = createRunner(plan({ gameModeId: "timed", segments, endRule: { kind: "time", limitMs: 500 } }));
    const r1 = runnerInsert(r0, "a", 0);
    const r2 = runnerInsert(r1, "b", 600);
    expect(r2.status).toBe("completed");
    expect(r2.engine.typedText).toBe("a");
    expect(runnerMetrics(r2, 600).typedCharacterCount).toBe(1);
  });

  it("stopping early counts as completed with the actual elapsed time", () => {
    const r0 = createRunner(plan({ gameModeId: "timed", segments, endRule: { kind: "time", limitMs: 60_000 } }));
    const r1 = runnerInsert(r0, "a", 0);
    const r2 = runnerStop(r1, 2000);
    expect(r2.status).toBe("completed");
    expect(toSessionResult(r2, 2000, "t").durationMs).toBe(2000);
  });

  it("abandon closes with abandoned status", () => {
    const r0 = createRunner(plan({ gameModeId: "timed", segments, endRule: { kind: "time", limitMs: 60_000 } }));
    const r1 = runnerAbandon(runnerInsert(r0, "a", 0), 100);
    expect(r1.status).toBe("abandoned");
  });
});

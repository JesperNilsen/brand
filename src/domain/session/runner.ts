/**
 * SessionRunner: drives the typing engine segment by segment according to a
 * SessionPlan, aggregates measurements across segments and enforces the end
 * rule. Pure functions over an immutable RunnerState; the clock is always
 * passed in. Knows segments and end rules — never books, authors or
 * language profiles.
 */
import {
  abandon as engineAbandon,
  backspace as engineBackspace,
  complete as engineComplete,
  createSession,
  insertText as engineInsert,
  rejectPaste as engineRejectPaste,
  type TypingSessionState,
} from "../engine/engine";
import {
  addCounts,
  computeMetrics,
  countCharacters,
  EMPTY_COUNTS,
  type CharacterCounts,
  type Metrics,
} from "../engine/metrics";
import type { SessionPlan } from "../modes/types";
import type { SessionResult } from "../types";

export type RunnerStatus = "idle" | "active" | "completed" | "abandoned";

export type RunnerState = {
  plan: SessionPlan;
  /** Index into plan.segments of the segment currently being typed. */
  segmentIndex: number;
  engine: TypingSessionState;
  /** Aggregated counts from segments already finished. */
  finishedCounts: CharacterCounts;
  completedSegmentIds: string[];
  startedAt: number | null;
  endedAt: number | null;
  status: RunnerStatus;
  pasteRejections: number;
};

export function createRunner(plan: SessionPlan): RunnerState {
  if (plan.segments.length === 0) {
    throw new Error("SessionPlan has no segments");
  }
  return {
    plan,
    segmentIndex: 0,
    engine: createSession({
      targetText: plan.segments[0].text,
      errorMode: plan.errorMode,
    }),
    finishedCounts: EMPTY_COUNTS,
    completedSegmentIds: [],
    startedAt: null,
    endedAt: null,
    status: "idle",
    pasteRejections: 0,
  };
}

function isOpen(state: RunnerState): boolean {
  return state.status === "idle" || state.status === "active";
}

export function currentSegment(state: RunnerState) {
  return state.plan.segments[state.segmentIndex];
}

export function nextSegment(state: RunnerState) {
  return state.plan.segments[state.segmentIndex + 1];
}

export function runnerElapsedMs(state: RunnerState, now: number): number {
  if (state.startedAt === null) return 0;
  return Math.max(0, (state.endedAt ?? now) - state.startedAt);
}

export function runnerRemainingMs(state: RunnerState, now: number): number | null {
  if (state.plan.endRule.kind !== "time") return null;
  return Math.max(0, state.plan.endRule.limitMs - runnerElapsedMs(state, now));
}

function timeIsUp(state: RunnerState, now: number): boolean {
  const remaining = runnerRemainingMs(state, now);
  return remaining !== null && state.startedAt !== null && remaining <= 0;
}

function engineCounts(engine: TypingSessionState): CharacterCounts {
  return countCharacters(
    engine.targetText,
    engine.typedText,
    engine.incorrectInsertCount,
  );
}

export function runnerCounts(state: RunnerState): CharacterCounts {
  return addCounts(state.finishedCounts, engineCounts(state.engine));
}

export function runnerMetrics(state: RunnerState, now: number): Metrics {
  return computeMetrics(runnerCounts(state), runnerElapsedMs(state, now));
}

/** Close the runner at the exact limit time when the clock has run out. */
function closeAtLimit(state: RunnerState): RunnerState {
  const limitMs =
    state.plan.endRule.kind === "time" ? state.plan.endRule.limitMs : 0;
  const endAt = (state.startedAt ?? 0) + limitMs;
  return finish(state, endAt, "completed");
}

function finish(
  state: RunnerState,
  now: number,
  status: "completed" | "abandoned",
): RunnerState {
  if (!isOpen(state)) return state;
  const engine =
    status === "completed"
      ? engineComplete(state.engine, now)
      : engineAbandon(state.engine, now);
  return {
    ...state,
    engine,
    startedAt: state.startedAt ?? now,
    endedAt: now,
    status,
  };
}

/** Advance to the next segment after the current one is completed. */
function advance(state: RunnerState, now: number): RunnerState {
  const finishedCounts = addCounts(
    state.finishedCounts,
    engineCounts(state.engine),
  );
  const completedSegmentIds = [
    ...state.completedSegmentIds,
    currentSegment(state).id,
  ];
  const next = nextSegment(state);
  if (!next) {
    // Segments exhausted: every end rule counts this as completed. The
    // current engine stays in place, so its counts are NOT folded into
    // finishedCounts (runnerCounts adds the current engine itself).
    return {
      ...state,
      completedSegmentIds,
      endedAt: now,
      status: "completed",
    };
  }
  return {
    ...state,
    finishedCounts,
    completedSegmentIds,
    segmentIndex: state.segmentIndex + 1,
    engine: createSession({
      targetText: next.text,
      errorMode: state.plan.errorMode,
    }),
  };
}

export function runnerInsert(
  state: RunnerState,
  text: string,
  now: number,
): RunnerState {
  if (!isOpen(state)) return state;
  if (timeIsUp(state, now)) return closeAtLimit(state);

  const engine = engineInsert(state.engine, text, now);
  if (engine === state.engine) return state;

  let next: RunnerState = {
    ...state,
    engine,
    startedAt: state.startedAt ?? engine.startedAt ?? now,
    status: "active",
  };
  if (engine.status === "completed") {
    next = advance(next, now);
  }
  return next;
}

export function runnerBackspace(state: RunnerState, now: number): RunnerState {
  if (!isOpen(state)) return state;
  if (timeIsUp(state, now)) return closeAtLimit(state);
  const engine = engineBackspace(state.engine, now);
  return engine === state.engine ? state : { ...state, engine };
}

export function runnerRejectPaste(state: RunnerState, now: number): RunnerState {
  if (!isOpen(state)) return state;
  return {
    ...state,
    engine: engineRejectPaste(state.engine, now),
    pasteRejections: state.pasteRejections + 1,
  };
}

/** Called on a timer; ends the session when the time limit is reached. */
export function runnerTick(state: RunnerState, now: number): RunnerState {
  if (!isOpen(state)) return state;
  if (timeIsUp(state, now)) return closeAtLimit(state);
  return state;
}

/**
 * The user stops the session deliberately. Under `user-stop` and `time`
 * rules that is a completed session; under `all-segments` (Passage) an
 * unfinished passage is abandoned.
 */
export function runnerStop(state: RunnerState, now: number): RunnerState {
  if (!isOpen(state)) return state;
  if (state.plan.endRule.kind === "all-segments") {
    return finish(state, now, "abandoned");
  }
  if (state.startedAt === null) return finish(state, now, "abandoned");
  return finish(state, now, "completed");
}

export function runnerAbandon(state: RunnerState, now: number): RunnerState {
  return finish(state, now, "abandoned");
}

/**
 * The segment the user should resume at. While a segment is in progress that
 * is the current one; after the last segment it is null (work finished).
 */
export function runnerResumeSegmentId(state: RunnerState): string | null {
  if (state.status === "completed" && !nextSegment(state)) {
    const last = currentSegment(state);
    return state.completedSegmentIds.includes(last.id) ? null : last.id;
  }
  return currentSegment(state).id;
}

export function toSessionResult(
  state: RunnerState,
  now: number,
  id: string,
): SessionResult {
  const metrics = runnerMetrics(state, now);
  const startedAt = state.startedAt ?? now;
  const endedAt = state.endedAt ?? now;
  const status: SessionResult["status"] =
    state.status === "completed" ? "completed" : "abandoned";
  const touchedSegmentIds = state.plan.segments
    .slice(0, state.segmentIndex + 1)
    .map((s) => s.id);
  return {
    id,
    schemaVersion: 2,
    startedAt: new Date(startedAt).toISOString(),
    completedAt: new Date(endedAt).toISOString(),
    status,
    gameModeId: state.plan.gameModeId,
    languageProfileId: state.plan.languageProfileId,
    contentPackId: state.plan.contentPackId,
    workId: state.plan.workId,
    editionId: state.plan.editionId,
    segmentIds: touchedSegmentIds,
    errorMode: state.plan.errorMode,
    textFilterId: state.plan.textFilterId,
    durationMs: metrics.durationMs,
    targetCharacterCount: metrics.targetCharacterCount,
    typedCharacterCount: metrics.typedCharacterCount,
    correctCharacterCount: metrics.correctCharacterCount,
    errorCount: metrics.errorCount,
    grossWpm: metrics.grossWpm,
    netWpm: metrics.netWpm,
    accuracy: metrics.accuracy,
  };
}

/** Metrics recomputed from a stored result: must equal what was stored. */
export function metricsFromResult(result: SessionResult): Metrics {
  return computeMetrics(
    {
      targetCharacterCount: result.targetCharacterCount,
      typedCharacterCount: result.typedCharacterCount,
      comparedCharacterCount: result.typedCharacterCount,
      correctCharacterCount: result.correctCharacterCount,
      errorCount: result.errorCount,
    },
    result.durationMs,
  );
}

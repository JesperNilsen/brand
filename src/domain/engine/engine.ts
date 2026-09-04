/**
 * The typing engine: pure, deterministic functions over an immutable
 * TypingSessionState. It knows nothing about React, storage, books, authors
 * or language profiles. It receives the exact target text to compare against
 * and an explicit clock value (`now`, ms) on every call.
 */
import type { ErrorMode } from "../types";
import { getErrorModeStrategy } from "./error-modes";
import { normalizeText } from "./normalize";

export type TypingEventType =
  | "insert"
  | "backspace"
  | "paste-rejected"
  | "complete"
  | "abandon";

export type TypingEvent = {
  at: number;
  type: TypingEventType;
  /** Number of characters affected (insert/backspace). */
  length?: number;
};

export type TypingStatus = "idle" | "active" | "completed" | "abandoned";

export type TypingSessionState = {
  targetText: string;
  typedText: string;
  cursorIndex: number;
  startedAt: number | null;
  endedAt: number | null;
  status: TypingStatus;
  errorMode: ErrorMode;
  eventLog: TypingEvent[];
  /** Mistyped insertions so far, including ones later corrected with Backspace. */
  incorrectInsertCount: number;
  /** Characters rejected by the error-mode strategy (only non-zero in stop-on-error). */
  rejectedInsertCount: number;
};

export type CreateSessionInput = {
  targetText: string;
  errorMode?: ErrorMode;
};

export function createSession(input: CreateSessionInput): TypingSessionState {
  return {
    targetText: normalizeText(input.targetText),
    typedText: "",
    cursorIndex: 0,
    startedAt: null,
    endedAt: null,
    status: "idle",
    errorMode: input.errorMode ?? "flow",
    eventLog: [],
    incorrectInsertCount: 0,
    rejectedInsertCount: 0,
  };
}

function isOpen(state: TypingSessionState): boolean {
  return state.status === "idle" || state.status === "active";
}

function withEvent(
  state: TypingSessionState,
  event: TypingEvent,
): TypingSessionState {
  return { ...state, eventLog: [...state.eventLog, event] };
}

/**
 * Insert text typed by the user. Handles multi-character input (IME, dead
 * keys, a pasted-in composition is still rejected elsewhere). Starts the
 * clock on the first accepted character and completes the session exactly
 * once when the typed text reaches the target length. Characters beyond the
 * target length are never accepted.
 */
export function insertText(
  state: TypingSessionState,
  input: string,
  now: number,
): TypingSessionState {
  if (!isOpen(state) || input.length === 0) return state;

  const strategy = getErrorModeStrategy(state.errorMode);
  const chars = Array.from(normalizeText(input));
  let typed = state.typedText;
  let incorrect = state.incorrectInsertCount;
  let rejected = state.rejectedInsertCount;
  let accepted = 0;

  for (const ch of chars) {
    if (typed.length >= state.targetText.length) break;
    const expected = state.targetText[typed.length];
    if (!strategy.accept(expected, ch)) {
      rejected += 1;
      continue;
    }
    if (ch !== expected) incorrect += 1;
    typed += ch;
    accepted += 1;
  }

  if (accepted === 0) {
    return rejected === state.rejectedInsertCount
      ? state
      : { ...state, rejectedInsertCount: rejected };
  }

  let next: TypingSessionState = {
    ...state,
    typedText: typed,
    cursorIndex: typed.length,
    startedAt: state.startedAt ?? now,
    status: "active",
    incorrectInsertCount: incorrect,
    rejectedInsertCount: rejected,
  };
  next = withEvent(next, { at: now, type: "insert", length: accepted });

  if (typed.length === state.targetText.length) {
    next = complete(next, now);
  }
  return next;
}

/** Remove the last typed character. No-op when nothing is typed or the session is closed. */
export function backspace(
  state: TypingSessionState,
  now: number,
): TypingSessionState {
  if (!isOpen(state) || state.typedText.length === 0) return state;
  const typed = state.typedText.slice(0, -1);
  const next: TypingSessionState = {
    ...state,
    typedText: typed,
    cursorIndex: typed.length,
  };
  return withEvent(next, { at: now, type: "backspace", length: 1 });
}

/** Record that a paste/drop was rejected. State and statistics are untouched. */
export function rejectPaste(
  state: TypingSessionState,
  now: number,
): TypingSessionState {
  if (!isOpen(state)) return state;
  return withEvent(state, { at: now, type: "paste-rejected" });
}

/**
 * Complete the session (used internally when the target is reached, and by
 * mode adapters when a time limit or the user's own stop ends a session that
 * still counts as completed). Idempotent.
 */
export function complete(
  state: TypingSessionState,
  now: number,
): TypingSessionState {
  if (!isOpen(state)) return state;
  const next: TypingSessionState = {
    ...state,
    status: "completed",
    startedAt: state.startedAt ?? now,
    endedAt: now,
  };
  return withEvent(next, { at: now, type: "complete" });
}

/** Abandon the session (user left before finishing). Idempotent. */
export function abandon(
  state: TypingSessionState,
  now: number,
): TypingSessionState {
  if (!isOpen(state)) return state;
  const next: TypingSessionState = {
    ...state,
    status: "abandoned",
    startedAt: state.startedAt ?? now,
    endedAt: now,
  };
  return withEvent(next, { at: now, type: "abandon" });
}

/** Elapsed active time in ms; 0 before the first accepted character. */
export function elapsedMs(state: TypingSessionState, now: number): number {
  if (state.startedAt === null) return 0;
  const end = state.endedAt ?? now;
  return Math.max(0, end - state.startedAt);
}

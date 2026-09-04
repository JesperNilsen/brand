import type { TypingSessionState } from "./engine";

export type CharState = "pending" | "correct" | "incorrect";

export type RenderedChar = {
  index: number;
  /** The target character at this index. */
  char: string;
  /** What the user actually typed here, if anything. */
  typed?: string;
  state: CharState;
};

export function charStateAt(
  state: Pick<TypingSessionState, "targetText" | "typedText">,
  index: number,
): CharState {
  if (index >= state.typedText.length) return "pending";
  return state.typedText[index] === state.targetText[index]
    ? "correct"
    : "incorrect";
}

/**
 * Derive render states for a window of the target text. Long texts should
 * only render a window around the cursor; the caller decides the bounds.
 */
export function deriveCharStates(
  state: Pick<TypingSessionState, "targetText" | "typedText">,
  from = 0,
  to = state.targetText.length,
): RenderedChar[] {
  const start = Math.max(0, from);
  const end = Math.min(state.targetText.length, to);
  const out: RenderedChar[] = [];
  for (let i = start; i < end; i += 1) {
    const s = charStateAt(state, i);
    out.push({
      index: i,
      char: state.targetText[i],
      typed: i < state.typedText.length ? state.typedText[i] : undefined,
      state: s,
    });
  }
  return out;
}

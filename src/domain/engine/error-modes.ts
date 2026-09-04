import type { ErrorMode } from "../types";

/**
 * An error mode is a strategy that decides whether a typed character is
 * accepted into the typed text. It is the only place the two modes differ.
 */
export type ErrorModeStrategy = {
  id: ErrorMode;
  /** Return true to accept `typed` at the position where `expected` is the target. */
  accept(expected: string, typed: string): boolean;
};

const flow: ErrorModeStrategy = {
  id: "flow",
  accept: () => true,
};

const stopOnError: ErrorModeStrategy = {
  id: "stop-on-error",
  accept: (expected, typed) => expected === typed,
};

const strategies: Record<ErrorMode, ErrorModeStrategy> = {
  flow,
  "stop-on-error": stopOnError,
};

export function getErrorModeStrategy(mode: ErrorMode): ErrorModeStrategy {
  return strategies[mode];
}
